import asyncio
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request
from main import app, http_exception_handler, general_exception_handler
from rate_limiter import RateLimiter
from test_system_integrity import PARAMS


class ErrorContracts(unittest.TestCase):
    def test_wrapped_engine_failures_do_not_expose_details(self):
        with patch('main.simulation_engine.run_whatif_simulation', side_effect=RuntimeError('private-key internal-path')):
            with patch('main.rate_limiter',RateLimiter()), TestClient(app) as client:
                for endpoint in ('/compare_scenarios','/recommend'):
                    response=client.post(endpoint,json={'farming_input':PARAMS,'num_simulations':100},
                        headers={'X-Request-ID':'error-test','Origin':'http://localhost:3000'})
                    self.assertEqual(response.status_code,500)
                    self.assertEqual(response.json(),{'success':False,'error':'Internal server error','request_id':'error-test'})
                    self.assertEqual(response.headers['x-request-id'],'error-test')
                    self.assertEqual(response.headers['access-control-allow-origin'],'http://localhost:3000')

    def test_explicit_status_and_headers_are_preserved(self):
        request=Request({'type':'http','headers':[(b'x-request-id',b'error-test')]})
        response=asyncio.run(http_exception_handler(request,HTTPException(429,'Try later',headers={'Retry-After':'60'})))
        self.assertEqual(response.status_code,429)
        self.assertEqual(response.headers['retry-after'],'60')
        self.assertIn(b'Try later',response.body)

    def test_unexpected_errors_never_disclose_payload_even_in_development(self):
        request=Request({'type':'http','headers':[(b'x-request-id',b'error-test')]})
        with patch('main.logger.error') as log:
            response=asyncio.run(general_exception_handler(request,ValueError('private-farmer-data')))
        self.assertNotIn(b'private-farmer-data',response.body)
        self.assertNotIn('private-farmer-data',str(log.call_args))
        self.assertEqual(response.headers['x-request-id'],'error-test')

    def test_invalid_image_is_a_client_error(self):
        with patch('main.rate_limiter',RateLimiter()), TestClient(app) as client:
            response=client.post('/detect_disease',files={'file':('leaf.png',b'not an image','image/png')})
        self.assertEqual(response.status_code,400)
        self.assertNotIn('ValueError',response.text)

    def test_request_error_logging_omits_raw_exception_payload(self):
        from logging_config import RequestLogger
        logger=RequestLogger()
        with patch.object(logger.logger,'error') as log:
            logger.log_error('trace',ValueError('private-farmer-data'),'POST /simulate')
        self.assertNotIn('private-farmer-data',str(log.call_args))
        self.assertFalse(log.call_args.kwargs['exc_info'])
