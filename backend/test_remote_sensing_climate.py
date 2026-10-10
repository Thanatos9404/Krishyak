"""Climate normalization is tested with fixtures, never fake farm measurements."""
import json
import unittest
from datetime import timedelta
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch
from remote_sensing.climate import ClimateService, START, END
from remote_sensing.schemas import LocationRequest
from remote_sensing.providers.base import ProviderError
from remote_sensing.router import router

def fixture():
    n=(END-START).days+1
    return {'utc_offset_seconds':0,'daily_units':{'temperature_2m_mean':'°C','precipitation_sum':'mm'},
        'daily':{'time':[(START+timedelta(days=i)).isoformat() for i in range(n)],'temperature_2m_mean':[20]*n,'precipitation_sum':[1]*n}}

class ClimateTests(unittest.TestCase):
    def test_baseline_units_and_leap_days(self):
        data=ClimateService.summarize(fixture())
        self.assertEqual(data['valid_days'],10958)
        self.assertEqual(data['mean_temperature_c'],20)
        self.assertEqual(data['mean_annual_precipitation_mm'],365.3)
        self.assertEqual(data['evidence_type'],'gridded_climate_reanalysis')
        self.assertEqual(data['nominal_resolution_km'],25)

    def test_incomplete_or_invalid_baseline_is_not_filled(self):
        for mutation in ('missing','units','nan','dates','null'):
            with self.subTest(mutation=mutation):
                data=fixture()
                if mutation=='missing': data['daily']['time'].pop()
                if mutation=='units': data['daily_units']['precipitation_sum']='inch'
                if mutation=='nan': data['daily']['temperature_2m_mean'][5]=float('nan')
                if mutation=='dates': data['daily']['time'][2]=data['daily']['time'][1]
                if mutation=='null': data['daily']['precipitation_sum'][1]=None
                with self.assertRaises(ValueError): ClimateService.summarize(data)

    def test_coarse_location_cache_and_fixed_source(self):
        requests=[]
        def handle(req): requests.append(req); return httpx.Response(200,json=fixture())
        service=ClimateService(httpx.Client(transport=httpx.MockTransport(handle)))
        point=LocationRequest(latitude=26.80123,longitude=73.00123)
        first=service.get(point,'test')
        second=service.get(LocationRequest(latitude=26.80124,longitude=73.00124),'test')
        self.assertEqual(len(requests),1)
        self.assertEqual(second['cache_status'],'hit')
        self.assertEqual(first['computed_at'],second['computed_at'])
        self.assertEqual(requests[0].url.params['latitude'],'26.8')
        self.assertEqual(requests[0].url.params['models'],'era5')
        self.assertNotIn('26.80123',str(requests[0].url))

    def test_network_failures_are_redacted(self):
        for state in ('timeout','malformed','outage'):
            def handle(req):
                if state=='timeout': raise httpx.ReadTimeout('private provider payload')
                return httpx.Response(503,text='private provider payload') if state=='outage' else httpx.Response(200,json={'daily':{}})
            service=ClimateService(httpx.Client(transport=httpx.MockTransport(handle)))
            with self.assertRaises(ProviderError) as ctx: service.get(LocationRequest(latitude=26,longitude=73),'test')
            self.assertNotIn('private',str(ctx.exception))

    def test_climate_route_does_not_need_cdse_and_redacts_invalid_point(self):
        app=FastAPI();app.include_router(router)
        service=ClimateService(httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(200,json=fixture()))))
        with patch('remote_sensing.router.get_climate_service',return_value=service), TestClient(app) as client:
            self.assertEqual(client.post('/remote-sensing/climate',json={'latitude':26.8,'longitude':73}).status_code,200)
            invalid=client.post('/remote-sensing/climate',json={'latitude':90.12345,'longitude':73})
            self.assertEqual(invalid.status_code,422);self.assertNotIn('90.12345',invalid.text)

    def test_quota_limits_new_climate_requests(self):
        service=ClimateService(httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(200,json=fixture()))))
        for i in range(6): service.get(LocationRequest(latitude=26,longitude=73+i),'test')
        with self.assertRaises(ProviderError) as ctx: service.get(LocationRequest(latitude=26,longitude=80),'test')
        self.assertEqual(ctx.exception.code,'local_quota')
