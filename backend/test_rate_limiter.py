from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from rate_limiter import RateLimiter


class RateLimitContracts(unittest.TestCase):
    def test_rolling_minute_and_day_boundaries(self):
        now = [0.0]
        limiter = RateLimiter(2, 3, clock=lambda: now[0])
        self.assertTrue(limiter.is_allowed('a')[0])
        self.assertTrue(limiter.is_allowed('a')[0])
        self.assertFalse(limiter.is_allowed('a')[0])
        now[0] = 60
        self.assertTrue(limiter.is_allowed('a')[0])
        self.assertIn('per day', limiter.is_allowed('a')[1])
        now[0] = 86400
        self.assertTrue(limiter.is_allowed('a')[0])
        self.assertEqual(len(limiter.requests['a']), 2)

    def test_concurrent_requests_cannot_exceed_quota(self):
        limiter = RateLimiter(7, 20, clock=lambda: 0)
        with ThreadPoolExecutor(max_workers=16) as executor:
            results = list(executor.map(lambda _: limiter.is_allowed('same-client')[0], range(100)))
        self.assertEqual(sum(results), 7)

    def test_capacity_does_not_evict_active_quota_and_expires_inactive_clients(self):
        now = [0.0]
        limiter = RateLimiter(1, 2, max_clients=2, clock=lambda: now[0])
        self.assertTrue(limiter.is_allowed('a')[0])
        self.assertTrue(limiter.is_allowed('b')[0])
        self.assertFalse(limiter.is_allowed('c')[0])
        self.assertFalse(limiter.is_allowed('a')[0])
        self.assertEqual(len(limiter.requests), 2)
        now[0] = 86400
        self.assertTrue(limiter.is_allowed('c')[0])
        self.assertEqual(list(limiter.requests), ['c'])

    def test_invalid_limits_are_rejected(self):
        for value in (0, -1, True, 1.5):
            with self.subTest(value=value), self.assertRaises(ValueError):
                RateLimiter(rate_per_minute=value)


class RateLimitApiContracts(unittest.TestCase):
    def test_error_body_and_header_share_validated_trace_identifier(self):
        from main import app
        with patch('main.rate_limiter', RateLimiter()), TestClient(app) as client:
            for supplied in ('valid-trace-01', 'x' * 1000):
                response = client.get('/diseases/unknown-crop', headers={'X-Request-ID': supplied})
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.headers['x-request-id'], response.json()['request_id'])
                self.assertLessEqual(len(response.headers['x-request-id']), 64)
                if len(supplied) <= 64:
                    self.assertEqual(response.headers['x-request-id'], supplied)

    def test_preflight_and_rate_limited_responses_preserve_cors(self):
        from main import app
        limiter = RateLimiter(1, 2)
        with patch('main.rate_limiter', limiter), TestClient(app) as client:
            headers = {'Origin': 'http://localhost:3000'}
            preflight = client.options('/health', headers={**headers, 'Access-Control-Request-Method': 'GET'})
            self.assertEqual(preflight.status_code, 200)
            self.assertEqual(len(limiter.requests), 0)
            client.get('/health', headers=headers)
            denied = client.get('/health', headers=headers)
            self.assertEqual(denied.status_code, 429)
            self.assertEqual(denied.headers['access-control-allow-origin'], headers['Origin'])
            self.assertEqual(denied.headers['x-request-id'], denied.json()['request_id'])
