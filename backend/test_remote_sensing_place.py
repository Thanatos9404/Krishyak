import os
import unittest
from unittest.mock import patch
import httpx
from remote_sensing.place import PlaceService
from remote_sensing.schemas import LocationRequest
from remote_sensing.providers.base import ProviderError

class PlaceTests(unittest.TestCase):
    def setUp(self):
        self.enabled=patch.dict(os.environ,{'REMOTE_SENSING_PLACE_LOOKUP_ENABLED':'true'});self.enabled.start()
    def tearDown(self):
        self.enabled.stop()
    def service(self, handler, clock=lambda:10):
        return PlaceService(httpx.Client(transport=httpx.MockTransport(handler)),clock=clock)

    def test_coarse_cached_lookup_and_identifying_agent(self):
        calls=[]
        def handler(req):
            calls.append(req);return httpx.Response(200,json={'address':{'state':'Rajasthan','country':'India','county':'Jodhpur'}})
        service=self.service(handler)
        first=service.get(LocationRequest(latitude=26.80123,longitude=73.00123),'test')
        second=service.get(LocationRequest(latitude=26.80124,longitude=73.00124),'test')
        self.assertEqual(first,second);self.assertEqual(len(calls),1)
        self.assertEqual(calls[0].url.params['lat'],'26.8')
        self.assertIn('KrishyakFieldIntelligence',calls[0].headers['User-Agent'])
        self.assertNotIn('26.80123',str(calls[0].url))
        self.assertNotIn('latitude',first)

    def test_global_one_per_second_and_disable(self):
        service=self.service(lambda req:httpx.Response(200,json={'address':{}}))
        service.get(LocationRequest(latitude=26,longitude=73),'test')
        with self.assertRaises(ProviderError) as ctx: service.get(LocationRequest(latitude=27,longitude=73),'other')
        self.assertEqual(ctx.exception.status,429)
        with patch.dict(os.environ,{'REMOTE_SENSING_PLACE_LOOKUP_ENABLED':'false'}), self.assertRaises(ProviderError):
            service.get(LocationRequest(latitude=26,longitude=73),'test')

    def test_malformed_and_outage_stay_redacted(self):
        for status,data in ((503,{}),(200,{'address':'bad'}),(200,{'address':{'city':{'private':'value'}}})):
            service=self.service(lambda req:httpx.Response(status,json=data))
            with self.assertRaises(ProviderError) as ctx: service.get(LocationRequest(latitude=26,longitude=73),'test')
            self.assertNotIn('private',str(ctx.exception))
