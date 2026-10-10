"""Optional gridded climate context. No crop/soil/disease inference."""
import hashlib
import json
import math
from datetime import date, datetime, timedelta, timezone
from threading import Lock, Semaphore

import httpx
from rate_limiter import RateLimiter
from .cache import TTLCache
from .providers.base import ProviderError

URL = 'https://archive-api.open-meteo.com/v1/archive'
START, END = date(1991,1,1), date(2020,12,31)


class ClimateService:
    def __init__(self, client=None):
        self.client = client or httpx.Client(timeout=httpx.Timeout(20,connect=5),follow_redirects=False)
        self.cache = TTLCache(max_items=128,max_bytes=2*1024*1024)
        self.limiter = RateLimiter(6,60)
        self.global_limiter = RateLimiter(30,300,max_clients=1)
        self.slots = Semaphore(2)
        self.locks = [Lock() for _ in range(32)]

    def get(self, point, identity):
        # Coarse coordinates suit ERA5 (~25 km); do not disclose precision needlessly.
        lat, lon = round(point.latitude,1), round(point.longitude,1)
        key = hashlib.sha256(f'era5-1991-2020-v1:{lat}:{lon}'.encode()).hexdigest()
        lock = self.locks[int(key[:8],16)%len(self.locks)]
        if not lock.acquire(timeout=1):
            raise ProviderError('busy','Climate context is busy; retry later',429,5)
        try:
            cached = self.cache.get(key)
            if cached is not None:
                cached['cache_status']='hit'
                return cached
            for limiter, client in ((self.limiter,identity),(self.global_limiter,'global')):
                if not limiter.is_allowed(client)[0]:
                    raise ProviderError('local_quota','Climate context limit reached; retry later',429,60)
            if not self.slots.acquire(blocking=False):
                raise ProviderError('busy','Climate context is busy; retry later',429,5)
            try:
                params={'latitude':lat,'longitude':lon,'start_date':START.isoformat(),'end_date':END.isoformat(),
                    'daily':'temperature_2m_mean,precipitation_sum','models':'era5','timezone':'UTC'}
                try:
                    with self.client.stream('GET',URL,params=params) as response:
                        if response.status_code != 200:
                            raise ProviderError('unavailable','Climate provider is unavailable',503)
                        parts,size=[],0
                        for chunk in response.iter_bytes():
                            size+=len(chunk)
                            if size>2*1024*1024:
                                raise ValueError()
                            parts.append(chunk)
                        value=json.loads(b''.join(parts))
                    result=self.summarize(value)
                except httpx.TimeoutException:
                    raise ProviderError('timeout','Climate context timed out',504) from None
                except httpx.RequestError:
                    raise ProviderError('unavailable','Climate provider is unreachable',503) from None
                except (ValueError,KeyError,TypeError,OverflowError):
                    raise ProviderError('malformed_response','Climate provider returned incomplete data',502) from None
                self.cache.put(key,result,7*86400)
                return result
            finally:
                self.slots.release()
        finally:
            lock.release()

    @staticmethod
    def summarize(value):
        daily, units = value['daily'], value['daily_units']
        if units['temperature_2m_mean']!='°C' or units['precipitation_sum']!='mm' or value['utc_offset_seconds']!=0:
            raise ValueError()
        count=(END-START).days+1
        times, temps, rain = daily['time'], daily['temperature_2m_mean'], daily['precipitation_sum']
        if any(not isinstance(items,list) or len(items)!=count for items in (times,temps,rain)):
            raise ValueError()
        total_t,total_r=0,0
        for i,(day,temp,precip) in enumerate(zip(times,temps,rain)):
            if day!=(START+timedelta(days=i)).isoformat():
                raise ValueError()
            for number,low,high in ((temp,-90,60),(precip,0,3000)):
                if isinstance(number,bool) or not isinstance(number,(int,float)) or not math.isfinite(number) or not low<=number<=high:
                    raise ValueError()
            total_t+=temp; total_r+=precip
        return {'evidence_type':'gridded_climate_reanalysis','provider':'Open-Meteo / ECMWF ERA5',
            'period':{'from':START.isoformat(),'to':END.isoformat(),'years':30},
            'mean_temperature_c':round(total_t/count,2),'mean_annual_precipitation_mm':round(total_r/30,1),
            'valid_days':count,'nominal_resolution_km':25,'request_coordinate_rounding_degrees':.1,
            'computed_at':datetime.now(timezone.utc).isoformat(),'cache_status':'miss',
            'source_url':'https://open-meteo.com/en/docs/historical-weather-api',
            'limitations':['Gridded model reanalysis, not a measurement at the farm.',
                '1991–2020 baseline, not a forecast or expected rainfall for this crop season.',
                'No irrigation, disease, crop species or soil nutrient inference.']}
