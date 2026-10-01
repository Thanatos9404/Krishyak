"""Offline contracts: transport fixtures are not live satellite verification."""
import io
import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from remote_sensing.cache import TTLCache, cache_key
from remote_sensing.config import Settings
from remote_sensing.geometry import area_details, geometry_hash, normalize_geometry
from remote_sensing.indices import INDICES, normalized_difference
from remote_sensing.providers.base import ProviderError, RemoteSensingProvider
from remote_sensing.providers.copernicus import CopernicusSentinelHubProvider, TOKEN_URL, BASE_URL
from remote_sensing.quality import trend
from remote_sensing.router import router, get_service
from remote_sensing.schemas import FieldRequest, Polygon, PreviewRequest, Provenance
from remote_sensing.service import RemoteSensingService

GEOMETRY = {"type": "Polygon", "coordinates": [[[73, 26.8], [73.002, 26.8], [73.002, 26.802], [73, 26.802]]]}
SETTINGS = Settings(enabled=True, client_id="fixture-client", client_secret="fixture-secret")


def request(**kwargs):
    return FieldRequest(geometry=GEOMETRY, start_date="2026-01-01", end_date="2026-03-31", **kwargs)


def stats_fixture(valid=400, total=441, mean=.6):
    return {"data": [{"interval": {"from": "2026-01-01T00:00:00Z", "to": "2026-01-11T00:00:00Z"},
        "outputs": {"index": {"bands": {"B0": {"stats": {"sampleCount": 500, "noDataCount": 500-valid,
            "mean": mean, "stDev": .1, "min": .2, "max": .9,
            "percentiles": {"25.0": .4, "50.0": .6, "75.0": .8}}}}},
            "footprint": {"bands": {"B0": {"stats": {"sampleCount": 500, "noDataCount": 500-total}}}}}}]}


def png(alpha=255, size=(128, 128)):
    out = io.BytesIO()
    Image.new("RGBA", size, (50, 100, 20, alpha)).save(out, format="PNG")
    return out.getvalue()


class GeometryTests(unittest.TestCase):
    def test_closes_and_normalizes_ring(self):
        result = Polygon(**GEOMETRY).model_dump()
        self.assertEqual(result["coordinates"][0][0], result["coordinates"][0][-1])
        for points in (GEOMETRY["coordinates"][0][1:] + GEOMETRY["coordinates"][0][:1], GEOMETRY["coordinates"][0][::-1]):
            self.assertEqual(geometry_hash(GEOMETRY), geometry_hash({"type": "Polygon", "coordinates": [points]}))
        floats = {"type": "Polygon", "coordinates": [[[float(x) for x in p] for p in GEOMETRY["coordinates"][0]]]}
        self.assertEqual(geometry_hash(GEOMETRY), geometry_hash(floats))

    def test_geodesic_area_reference_and_units(self):
        area = area_details(GEOMETRY)
        self.assertAlmostEqual(area["square_metres"], 44067.09, delta=.1)
        self.assertAlmostEqual(area["hectares"] * 10000, area["square_metres"], delta=1)
        self.assertAlmostEqual(area["acres"] * 4046.8564224, area["square_metres"], delta=1)

    def test_rejects_self_intersection(self):
        with self.assertRaises(ValueError):
            Polygon(type="Polygon", coordinates=[[[73,26.8],[73.002,26.802],[73.002,26.8],[73,26.802]]])

    def test_bad_coordinates_and_holes(self):
        for ring in ([[[181,26],[73,26],[73,27]]], [[[73,86],[73,26],[73,27]]],
                     [[[True,26],[73,26],[73,27]]], [[[float('nan'),26],[73,26],[73,27]]],
                     [[[73,26,10],[73,26],[73,27]]], [[[73,26],[73,26],[73,27]]],
                     GEOMETRY["coordinates"] * 2):
            with self.subTest(ring=ring), self.assertRaises(ValueError):
                Polygon(type="Polygon", coordinates=ring)

    def test_limits_vertices_area_and_extent(self):
        import math
        points=[[73+.001*math.cos(i*math.tau/200),26.8+.001*math.sin(i*math.tau/200)] for i in range(200)]
        self.assertEqual(len(Polygon(type='Polygon',coordinates=[points+[points[0]]]).coordinates[0]),201)
        with self.assertRaises(ValueError):
            normalize_geometry({"type":"Polygon","coordinates":[[[73,26.8]]*201]})
        with self.assertRaises(ValueError): area_details(GEOMETRY, 1)
        with self.assertRaises(ValueError):
            area_details({"type":"Polygon","coordinates":[[[73,26.8],[73.00001,26.8],[73,26.80001]]]})
        with self.assertRaises(ValueError):
            Polygon(type="Polygon", coordinates=[[[73,26.8],[74,26.8],[74,26.8001]]])

    def test_dates_layers_output_limits(self):
        for updates in ({"end_date":"2027-01-01"}, {"start_date":"2025-01-01"}, {"index":"evil script"}, {"interval_days":1}):
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                FieldRequest(**{**request().model_dump(), **updates})
        for updates in ({"width":4000}, {"height":True}, {"layer":"javascript"}):
            with self.subTest(updates=updates), self.assertRaises(ValueError):
                PreviewRequest(geometry=GEOMETRY,start_date="2026-01-01",end_date="2026-01-01", **updates)
        with self.assertRaises(ValueError): PreviewRequest(**request().model_dump())


class TransportTests(unittest.TestCase):
    def adapter(self, handler, **kwargs):
        return CopernicusSentinelHubProvider(SETTINGS, client=httpx.Client(transport=httpx.MockTransport(handler)), sleep=Mock(), **kwargs)

    def token_response(self):
        return httpx.Response(200, json={"access_token":"fixture-token", "expires_in":3600})

    def test_token_reuse_expiry_and_concurrency(self):
        now, calls = [0], []
        def handle(req): calls.append(req); return self.token_response()
        provider = self.adapter(handle, clock=lambda:now[0])
        with ThreadPoolExecutor(max_workers=5) as pool:
            self.assertEqual(list(pool.map(lambda _:provider._get_token(), range(10))), ["fixture-token"]*10)
        self.assertEqual(len(calls), 1)
        now[0] = 3550
        provider._get_token()
        self.assertEqual(len(calls), 2)
        self.assertIn(b"grant_type=client_credentials", calls[0].content)

    def test_401_refresh_once(self):
        tokens, requests = [], []
        def handle(req):
            if str(req.url) == TOKEN_URL: tokens.append(req); return self.token_response()
            requests.append(req)
            return httpx.Response(401) if len(requests) == 1 else httpx.Response(200,json={"features":[]})
        provider = self.adapter(handle)
        self.assertEqual(provider.search_acquisitions(request())["acquisitions"], [])
        self.assertEqual(len(tokens), 2)
        self.assertEqual(len(requests), 2)

    def test_authentication_and_access_errors_are_redacted(self):
        for status in (401, 403):
            with self.subTest(status=status):
                def handle(req):
                    return self.token_response() if str(req.url)==TOKEN_URL else httpx.Response(status,text="secret upstream body")
                with self.assertRaises(ProviderError) as ctx: self.adapter(handle).search_acquisitions(request())
                self.assertEqual(ctx.exception.code, "access_denied")
                self.assertNotIn("secret", str(ctx.exception))

    def test_429_retry_after_milliseconds(self):
        calls = []
        def handle(req):
            if str(req.url)==TOKEN_URL: return self.token_response()
            calls.append(req)
            return httpx.Response(429,headers={"Retry-After":"1200"}) if len(calls)<3 else httpx.Response(200,json={"features":[]})
        provider = self.adapter(handle)
        provider.search_acquisitions(request())
        self.assertEqual(len(calls),3)
        self.assertGreaterEqual(provider.sleep.call_args_list[0].args[0], 1.2)
        self.assertLess(provider.sleep.call_args_list[0].args[0], 1.5)

    def test_429_long_wait_propagates_without_sleep(self):
        def handle(req):
            return self.token_response() if str(req.url)==TOKEN_URL else httpx.Response(429,headers={"Retry-After":"60000"})
        provider=self.adapter(handle)
        with self.assertRaises(ProviderError) as ctx: provider.search_acquisitions(request())
        self.assertEqual(ctx.exception.retry_after,60)
        provider.sleep.assert_not_called()

    def test_5xx_is_bounded(self):
        calls=[]
        def handle(req):
            if str(req.url)==TOKEN_URL: return self.token_response()
            calls.append(req); return httpx.Response(500,text="unsafe coordinates")
        provider=self.adapter(handle)
        with self.assertRaises(ProviderError) as ctx: provider.search_acquisitions(request())
        self.assertEqual(len(calls),3)
        self.assertEqual(ctx.exception.code,"provider_outage")

    def test_timeout_and_connection_failure(self):
        for exception in (httpx.ReadTimeout, httpx.ConnectError):
            def handle(req): raise exception("secret context",request=req)
            with self.subTest(exception=exception), self.assertRaises(ProviderError) as ctx:
                self.adapter(handle).search_acquisitions(request())
            self.assertNotIn("secret",str(ctx.exception))

    def test_malformed_auth(self):
        for response in ({}, {"access_token":"x","expires_in":float('nan')}, {"access_token":23,"expires_in":3600}):
            def handle(req): return httpx.Response(200,content=json.dumps(response).encode())
            with self.subTest(response=response), self.assertRaises(ProviderError): self.adapter(handle)._get_token()

    def test_catalog_dates_sort_cloud_and_no_data(self):
        fixture={"features":[{"id":"a","properties":{"datetime":"2026-02-01T10:00:00Z","eo:cloud_cover":12}},
            {"id":"b","properties":{"datetime":"2026-03-01T10:00:00Z","eo:cloud_cover":80}}]}
        def handle(req): return self.token_response() if str(req.url)==TOKEN_URL else httpx.Response(200,json=fixture)
        result=self.adapter(handle).search_acquisitions(request())
        self.assertEqual(result["acquisitions"][0]["id"],"b")
        self.assertFalse(result["scene_cloud_is_field_quality"])
        fixture["features"][0]["properties"]["datetime"]="not a date"
        with self.assertRaises(ProviderError): self.adapter(handle).search_acquisitions(request())

    def test_catalog_pagination_is_bounded(self):
        calls=[]
        def handle(req):
            if str(req.url)==TOKEN_URL: return self.token_response()
            calls.append(req); return httpx.Response(200,json={"features":[],"context":{"next":len(calls)}})
        result=self.adapter(handle).search_acquisitions(request())
        self.assertEqual(len(calls),3); self.assertTrue(result["truncated"])

    def test_statistical_contract_percentiles_and_field_mask(self):
        bodies=[]
        def handle(req):
            if str(req.url)==TOKEN_URL: return self.token_response()
            bodies.append(json.loads(req.content)); return httpx.Response(200,json=stats_fixture())
        data=self.adapter(handle).get_statistics(request())
        self.assertAlmostEqual(data[0]["mean"],.6)
        self.assertAlmostEqual(data[0]["p75"],.8)
        self.assertEqual(data[0]["quality_status"],"clear")
        self.assertAlmostEqual(data[0]["valid_fraction_among_available"],400/441)
        self.assertLess(bodies[0]["aggregation"]["resx"], .001)
        self.assertIn('bands: ["index", "footprint"]',bodies[0]["aggregation"]["evalscript"])
        self.assertEqual(bodies[0]["input"]["bounds"]["geometry"]["type"],"Polygon")

    def test_cloudy_partial_and_empty_statistics(self):
        for fixture in (stats_fixture(valid=100), stats_fixture(valid=50,total=50), stats_fixture(valid=0,total=0), {"data":[]}):
            def handle(req): return self.token_response() if str(req.url)==TOKEN_URL else httpx.Response(200,json=fixture)
            data=self.adapter(handle).get_statistics(request())
            if data: self.assertEqual(data[0]["quality_status"],"insufficient"); self.assertIsNone(data[0]["mean"])
            else: self.assertEqual(data,[])

    def test_bad_stats_not_accepted(self):
        for fixture in ({}, {"data":[{}]}, stats_fixture(valid=450,total=441), stats_fixture(mean=float('nan'))):
            def handle(req): return self.token_response() if str(req.url)==TOKEN_URL else httpx.Response(200,content=json.dumps(fixture).encode())
            with self.subTest(fixture=fixture), self.assertRaises(ProviderError): self.adapter(handle).get_statistics(request())

    def test_preview_png_alpha_validation_and_trusted_scripts(self):
        payload=png()
        bodies=[]
        def handle(req):
            if str(req.url)==TOKEN_URL: return self.token_response()
            bodies.append(json.loads(req.content)); return httpx.Response(200,content=payload)
        provider=self.adapter(handle)
        preview=PreviewRequest(geometry=GEOMETRY,start_date="2026-01-01",end_date="2026-01-01",width=128,height=128)
        self.assertEqual(provider.get_visualization(preview),payload)
        self.assertIn("SCL === 4",bodies[-1]["evalscript"])
        payload=png(alpha=0)
        with self.assertRaises(ProviderError) as ctx: provider.get_visualization(preview)
        self.assertEqual(ctx.exception.code,"no_clear_observations")
        payload=b"not PNG"
        with self.assertRaises(ProviderError): provider.get_visualization(preview)


class ServiceTests(unittest.TestCase):
    def provider(self):
        provider=Mock(spec=RemoteSensingProvider)
        provider.name="cdse"; provider.capabilities=RemoteSensingProvider.capabilities
        provider.healthcheck.return_value=True
        provider.get_time_series.return_value=[]
        provider.search_acquisitions.return_value={"acquisitions":[],"truncated":False}
        return provider

    def test_feature_disabled_and_unconfigured_do_not_call(self):
        for settings in (Settings(),Settings(enabled=True),Settings(enabled=True,provider="bhoonidhi")):
            provider=self.provider(); provider.healthcheck.return_value=False
            service=RemoteSensingService(settings,provider)
            with self.assertRaises(ProviderError): service.execute("timeseries",request(),"test")
            provider.get_time_series.assert_not_called()
        self.assertFalse(CopernicusSentinelHubProvider.capabilities["supports_sar"])
        self.assertFalse(CopernicusSentinelHubProvider.capabilities["supports_crop_classification"])

    def test_cache_provenance_and_equivalent_request(self):
        provider=self.provider(); service=RemoteSensingService(SETTINGS,provider)
        result,hit=service.execute("timeseries",request(),"test")
        self.assertFalse(hit); Provenance(**result["provenance"])
        self.assertEqual(result["status"],"insufficient_data")
        result["provenance"]["provider"]="tampered"
        cached,hit=service.execute("timeseries",request(),"test")
        self.assertTrue(hit); self.assertEqual(cached["provenance"]["provider"],"cdse")
        self.assertEqual(cached["provenance"]["cache_status"],"hit")
        self.assertFalse(cached["remote_sensing_context"]["economic_influence"])
        self.assertEqual(provider.get_time_series.call_count,1)

    def test_cache_key_changes_with_processing_inputs(self):
        a=request(); b=request(index="ndmi")
        self.assertNotEqual(cache_key("cdse","timeseries",a),cache_key("cdse","timeseries",b))
        self.assertNotEqual(cache_key("cdse","timeseries",a),cache_key("other","timeseries",a))
        self.assertNotEqual(cache_key("cdse","timeseries",a),cache_key("cdse","acquisitions",a))
        geometry={"type":"Polygon","coordinates":[GEOMETRY["coordinates"][0][::-1]]}
        b=FieldRequest(**{**a.model_dump(),"geometry":geometry})
        self.assertEqual(cache_key("cdse","timeseries",a),cache_key("cdse","timeseries",b))

    def test_ttl_expiry_and_memory_eviction(self):
        now=[0]; cache=TTLCache(max_items=1,max_bytes=32,clock=lambda:now[0])
        cache.put("a",{"v":1},2); self.assertEqual(cache.get("a"),{"v":1})
        now[0]=2; self.assertIsNone(cache.get("a"))
        cache.put("a",b"1",10); cache.put("b",b"2",10); self.assertIsNone(cache.get("a"))
        cache.put("huge",b"x"*33,10); self.assertIsNone(cache.get("huge"))

    def test_quota_applies_to_misses_and_not_cached_requests(self):
        provider=self.provider(); service=RemoteSensingService(Settings(**{**SETTINGS.__dict__,"per_minute":1}),provider)
        service.execute("timeseries",request(),"test")
        service.execute("timeseries",request(),"test")
        with self.assertRaises(ProviderError) as ctx: service.execute("timeseries",request(index="ndmi"),"test")
        self.assertEqual(ctx.exception.code,"local_quota")

    def test_preview_checks_quality_before_provider_image(self):
        provider=self.provider(); provider.get_statistics.return_value=[]
        service=RemoteSensingService(SETTINGS,provider)
        with self.assertRaises(ProviderError): service.execute("preview",PreviewRequest(geometry=GEOMETRY,start_date="2026-01-01",end_date="2026-01-01"),"test")
        provider.get_visualization.assert_not_called()

    def test_preview_embeds_quality_provenance_and_cached_timestamp(self):
        provider=self.provider()
        provider.get_statistics.return_value=[{"quality_status":"clear","valid_fraction":.9}]
        provider.get_visualization.return_value=png()
        service=RemoteSensingService(SETTINGS,provider)
        req=PreviewRequest(geometry=GEOMETRY,start_date="2026-01-01",end_date="2026-01-01")
        first,hit=service.execute("preview",req,"test")
        self.assertFalse(hit)
        with Image.open(io.BytesIO(first)) as image:
            metadata=json.loads(image.info["krishyak_provenance"])
        Provenance(**metadata)
        self.assertEqual(metadata["valid_pixel_fraction"],.9)
        self.assertEqual(metadata["index"],"true_color")
        self.assertFalse(metadata["contributing_dates_verified"])
        second,hit=service.execute("preview",req,"test")
        self.assertTrue(hit)
        with Image.open(io.BytesIO(second)) as image:
            cached=json.loads(image.info["krishyak_provenance"])
        self.assertEqual(cached["computed_at"],metadata["computed_at"])
        self.assertEqual(cached["cache_status"],"hit")
        provider.get_visualization.assert_called_once()

    def test_trends_and_boundaries(self):
        def rows(values): return [{"quality_status":"clear","mean":v} for v in values]
        self.assertEqual(trend(rows([.5]*4))["status"],"insufficient_data")
        self.assertEqual(trend(rows([.5]*4+[.5]))["status"],"stable")
        self.assertEqual(trend(rows([.5]*4+[.6]))["status"],"improving")
        self.assertEqual(trend(rows([.5]*4+[.4]))["status"],"declining")
        self.assertEqual(trend(rows([.5]*4+[.5-.03]))["status"],"stable")
        self.assertEqual(trend(rows([.5]*4+[.5+.03]))["status"],"stable")
        self.assertEqual(trend(rows([.5]*5)+[{"quality_status":"insufficient","mean":None}])["status"],"insufficient_data")

    def test_index_formulas_and_zero_denominator(self):
        self.assertAlmostEqual(normalized_difference(.8,.2),.6)
        self.assertIsNone(normalized_difference(0,0)); self.assertIsNone(normalized_difference(1,-1))
        self.assertIsNone(normalized_difference(float('nan'),1))
        self.assertIsNone(normalized_difference(-.1,.2))
        self.assertEqual(INDICES["ndre"]["bands"],["B8A","B05"])
        self.assertEqual(INDICES["ndmi"]["resolution"],20)

    def test_env_fails_closed(self):
        with patch.dict("os.environ",{"REMOTE_SENSING_ENABLED":"false","REMOTE_SENSING_MAX_AREA_HA":"99999","REMOTE_SENSING_CACHE_TTL":"bad"}):
            settings=Settings.from_env()
        self.assertFalse(settings.enabled); self.assertEqual(settings.max_area_ha,500); self.assertEqual(settings.cache_ttl,3600)
        self.assertNotIn("fixture-secret",repr(SETTINGS))


class RouterTests(unittest.TestCase):
    def setUp(self):
        app=FastAPI(); app.include_router(router); self.client=TestClient(app)
        self.service=RemoteSensingService(Settings())
        self.patch=patch("remote_sensing.router.get_service",return_value=self.service); self.patch.start()
    def tearDown(self): self.patch.stop(); self.client.close()

    def test_disabled_route_and_other_routes_remain_available(self):
        self.assertEqual(self.client.get("/remote-sensing/status").json()["data"]["status"],"disabled")
        response=self.client.post("/remote-sensing/timeseries",json=request().model_dump(mode="json"))
        self.assertEqual(response.status_code,503)
        self.assertEqual(response.json()["code"],"disabled")

    def test_area_without_credentials(self):
        response=self.client.post("/remote-sensing/geometry",json=GEOMETRY)
        self.assertEqual(response.status_code,200)
        self.assertAlmostEqual(response.json()["data"]["area"]["hectares"],4.4067)

    def test_openapi_has_inline_bounded_request_schemas(self):
        document=self.client.get("/openapi.json").json()
        schema=document["paths"]["/remote-sensing/preview"]["post"]["requestBody"]["content"]["application/json"]["schema"]
        self.assertEqual(schema["properties"]["width"]["maximum"],768)
        self.assertEqual(schema["properties"]["geometry"]["properties"]["type"]["const"],"Polygon")
        self.assertNotIn("$ref",json.dumps(schema))

    def test_redacted_validation_and_body_limit(self):
        for value in ({"geometry":{"type":"Polygon","coordinates":[[[73.123456789,26.123456789]]]}}, {**request().model_dump(mode="json"),"evalscript":"alert('evil')"}):
            response=self.client.post("/remote-sensing/timeseries",json=value)
            self.assertEqual(response.status_code,422)
            self.assertNotIn("73.123456789",response.text); self.assertNotIn("evil",response.text)
        response=self.client.post("/remote-sensing/timeseries",content=b"x"*40000)
        self.assertEqual(response.status_code,422)

    def test_slow_body_timeout_is_redacted(self):
        async def timeout(coroutine, timeout):
            coroutine.close()
            raise TimeoutError()
        with patch('remote_sensing.router.asyncio.wait_for',new=timeout):
            response=self.client.post('/remote-sensing/geometry',json=GEOMETRY)
        self.assertEqual(response.status_code,422)
        self.assertNotIn('coordinates',response.text)

    def test_ready_json_and_png_routes_preserve_provenance(self):
        provider=Mock(spec=RemoteSensingProvider)
        provider.name='cdse';provider.capabilities=RemoteSensingProvider.capabilities
        provider.healthcheck.return_value=True;provider.get_time_series.return_value=[]
        provider.get_statistics.return_value=[{'quality_status':'clear','valid_fraction':.9}]
        provider.get_visualization.return_value=png()
        self.service.settings=SETTINGS;self.service.provider=provider
        response=self.client.post('/remote-sensing/timeseries',json=request().model_dump(mode='json'))
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data']['status'],'insufficient_data')
        self.assertFalse(response.json()['data']['remote_sensing_context']['economic_influence'])
        body=PreviewRequest(geometry=GEOMETRY,start_date='2026-01-01',end_date='2026-01-01',width=128,height=128,spatial_scope='device_neighborhood').model_dump(mode='json')
        for state in ('miss','hit'):
            image=self.client.post('/remote-sensing/preview',json=body)
            self.assertEqual(image.status_code,200)
            self.assertEqual(image.headers['X-Remote-Sensing-Cache'],state)
            with Image.open(io.BytesIO(image.content)) as payload:
                source=json.loads(payload.info['krishyak_provenance'])
            self.assertEqual(source['spatial_scope'],'device_neighborhood')
            self.assertEqual(source['cache_status'],state)

    def test_ready_json_and_png_routes_preserve_provenance(self):
        provider=Mock(spec=RemoteSensingProvider)
        provider.name='cdse';provider.capabilities=RemoteSensingProvider.capabilities
        provider.healthcheck.return_value=True;provider.get_time_series.return_value=[]
        provider.get_statistics.return_value=[{'quality_status':'clear','valid_fraction':.9}]
        provider.get_visualization.return_value=png()
        self.service.settings=SETTINGS;self.service.provider=provider
        response=self.client.post('/remote-sensing/timeseries',json=request().model_dump(mode='json'))
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['data']['status'],'insufficient_data')
        self.assertFalse(response.json()['data']['remote_sensing_context']['economic_influence'])
        body=PreviewRequest(geometry=GEOMETRY,start_date='2026-01-01',end_date='2026-01-01',width=128,height=128,spatial_scope='device_neighborhood').model_dump(mode='json')
        for state in ('miss','hit'):
            image=self.client.post('/remote-sensing/preview',json=body)
            self.assertEqual(image.status_code,200)
            self.assertEqual(image.headers['X-Remote-Sensing-Cache'],state)
            with Image.open(io.BytesIO(image.content)) as payload:
                source=json.loads(payload.info['krishyak_provenance'])
            self.assertEqual(source['spatial_scope'],'device_neighborhood')
            self.assertEqual(source['cache_status'],state)


@unittest.skipUnless(__import__('os').getenv('RUN_CDSE_LIVE') == '1', "Set RUN_CDSE_LIVE=1 and CDSE server credentials for the real smoke test")
class LiveSmoke(unittest.TestCase):
    def test_rajasthan_catalog_statistics_and_layers(self):
        import os
        settings=Settings.from_env()
        if not settings.client_id or not settings.client_secret:
            self.skipTest("CDSE credentials absent; no live calls made")
        today=datetime.now(timezone.utc).date()
        geometry=json.loads((Path(__file__).parents[1]/"frontend/src/data/remoteSensingDemo.json").read_text())
        req=FieldRequest(geometry=geometry,start_date=today-timedelta(days=90),end_date=today)
        provider=CopernicusSentinelHubProvider(settings)
        try:
            catalog=provider.search_acquisitions(req)
            for index in ("ndvi","ndmi","ndre"):
                observations=provider.get_statistics(req.model_copy(update={"index":index}))
                self.assertIsInstance(observations,list)
            usable_day=None
            for item in catalog["acquisitions"][:3]:
                day=datetime.fromisoformat(item["acquired_at"].replace("Z","+00:00")).date()
                daily=req.model_copy(update={"start_date":day,"end_date":day})
                points=provider.get_statistics(daily)
                if points and points[-1]["quality_status"]=="clear": usable_day=day; break
            if usable_day is None:
                self.skipTest("Live catalog/statistics verified; no clear day among three latest candidates for imagery")
            for layer in ("true_color","ndvi","ndmi","ndre"):
                preview=PreviewRequest(geometry=geometry,start_date=usable_day,end_date=usable_day,layer=layer,width=128,height=128)
                self.assertTrue(provider.get_visualization(preview).startswith(b"\x89PNG"))
        finally:
            provider.close()
