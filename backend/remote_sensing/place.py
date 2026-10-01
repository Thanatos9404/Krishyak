"""Optional small-pilot place lookup: coarse location, caching and 1/s pacing."""
import hashlib
import json
import os
import time
from threading import Lock
import httpx
from rate_limiter import RateLimiter
from .cache import TTLCache
from .providers.base import ProviderError


class PlaceService:
    def __init__(self, client=None, clock=time.monotonic):
        self.client=client or httpx.Client(timeout=httpx.Timeout(10,connect=5),follow_redirects=False)
        self.cache=TTLCache(max_items=512,max_bytes=1024*1024)
        self.limiter=RateLimiter(6,60)
        self.global_limiter=RateLimiter(60,300,max_clients=1)
        self.lock=Lock();self.clock=clock;self.next_call=0

    def get(self, point, identity):
        if os.getenv('REMOTE_SENSING_PLACE_LOOKUP_ENABLED','false').lower()!='true':
            raise ProviderError('disabled','Place lookup is disabled',503)
        lat,lon=round(point.latitude,2),round(point.longitude,2)
        key=hashlib.sha256(f'nominatim-v1:{lat}:{lon}'.encode()).hexdigest()
        if not self.lock.acquire(timeout=.1):
            raise ProviderError('busy','Place lookup is busy',429,1)
        try:
            result=self.cache.get(key)
            if result is not None: return result
            if self.clock()<self.next_call:
                raise ProviderError('busy','Place lookup is busy',429,1)
            for limiter,client in ((self.limiter,identity),(self.global_limiter,'global')):
                if not limiter.is_allowed(client)[0]:
                    raise ProviderError('local_quota','Place lookup limit reached',429,60)
            self.next_call=self.clock()+1.05
            try:
                with self.client.stream('GET','https://nominatim.openstreetmap.org/reverse',
                    params={'format':'json','lat':lat,'lon':lon,'zoom':10,'accept-language':'en'},
                    headers={'User-Agent':'KrishyakFieldIntelligence/1.0 (+https://krishyak.vercel.app)'}) as response:
                    if response.status_code!=200:
                        raise ProviderError('unavailable','Place lookup is unavailable',503)
                    parts,size=[],0
                    for chunk in response.iter_bytes():
                        size+=len(chunk)
                        if size>256*1024: raise ValueError()
                        parts.append(chunk)
                    address=json.loads(b''.join(parts))['address']
                result={'city':address.get('city') or address.get('town') or address.get('village') or address.get('county'),
                    'district':address.get('state_district') or address.get('county'),
                    'state':address.get('state'),'country':address.get('country'),
                    'source':'OpenStreetMap / Nominatim','coordinate_rounding_degrees':.01}
                if any(value is not None and (not isinstance(value,str) or len(value)>150) for name,value in result.items() if name not in ('coordinate_rounding_degrees',)):
                    raise ValueError()
            except httpx.TimeoutException:
                raise ProviderError('timeout','Place lookup timed out',504) from None
            except httpx.RequestError:
                raise ProviderError('unavailable','Place lookup is unreachable',503) from None
            except (ValueError,KeyError,TypeError,AttributeError):
                raise ProviderError('malformed_response','Place lookup returned invalid data',502) from None
            self.cache.put(key,result,86400)
            return result
        finally:
            self.lock.release()
