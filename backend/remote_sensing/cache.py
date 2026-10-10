import copy
import hashlib
import json
import time
from collections import OrderedDict
from threading import Lock


def cache_key(provider, operation, request):
    from .geometry import geometry_hash
    payload = request.model_dump(mode="json")
    payload["geometry"] = geometry_hash(payload["geometry"])
    return hashlib.sha256(json.dumps([provider, "sentinel-2-l2a", "krishyak-s2-v1", operation, payload],
                                    sort_keys=True, separators=(",", ":")).encode()).hexdigest()


class TTLCache:
    def __init__(self, max_items=128, max_bytes=32 * 1024 * 1024, clock=time.monotonic):
        self.items = OrderedDict()
        self.max_items, self.max_bytes, self.clock = max_items, max_bytes, clock
        self.bytes = 0
        self.lock = Lock()

    def get(self, key):
        with self.lock:
            record = self.items.get(key)
            if record is None:
                return None
            expiry, size, value = record
            if expiry <= self.clock():
                self.bytes -= size
                del self.items[key]
                return None
            self.items.move_to_end(key)
            return copy.deepcopy(value)

    def put(self, key, value, ttl):
        size = len(value) if isinstance(value, bytes) else len(json.dumps(value))
        if size > self.max_bytes:
            return
        with self.lock:
            old = self.items.pop(key, None)
            if old:
                self.bytes -= old[1]
            while self.items and (len(self.items) >= self.max_items or self.bytes + size > self.max_bytes):
                _, (_, removed_size, _) = self.items.popitem(last=False)
                self.bytes -= removed_size
            self.items[key] = (self.clock() + ttl, size, copy.deepcopy(value))
            self.bytes += size
