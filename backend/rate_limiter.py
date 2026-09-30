"""Bounded, thread-safe rolling limits for a single application process.

Replicas still require a shared limiter at the gateway or a shared datastore.
"""
from collections import OrderedDict, deque
from threading import Lock
import time


class RateLimiter:
    def __init__(self, rate_per_minute=60, rate_per_day=1000, max_clients=10000, clock=time.monotonic):
        for value in (rate_per_minute, rate_per_day, max_clients):
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                raise ValueError('Rate limits and client capacity must be positive integers')
        self.rate_per_minute = rate_per_minute
        self.rate_per_day = rate_per_day
        self.max_clients = max_clients
        self.clock = clock
        self.requests = OrderedDict()
        self._lock = Lock()

    def is_allowed(self, client_ip):
        with self._lock:
            now = self.clock()
            # Ordered by last accepted request, so inactive clients can expire globally.
            while self.requests:
                oldest = next(iter(self.requests))
                if self.requests[oldest][-1] > now - 86400:
                    break
                self.requests.popitem(last=False)
            history = self.requests.get(client_ip)
            if history is None:
                if len(self.requests) >= self.max_clients:
                    return False, 'Request tracking capacity reached; please retry later'
                history = deque()
            while history and history[0] <= now - 86400:
                history.popleft()
            recent = 0
            for timestamp in reversed(history):
                if timestamp <= now - 60:
                    break
                recent += 1
                if recent >= self.rate_per_minute:
                    return False, f'Rate limit exceeded: {self.rate_per_minute} requests per minute'
            if len(history) >= self.rate_per_day:
                return False, f'Rate limit exceeded: {self.rate_per_day} requests per day'
            history.append(now)
            self.requests[client_ip] = history
            self.requests.move_to_end(client_ip)
            return True, ''
