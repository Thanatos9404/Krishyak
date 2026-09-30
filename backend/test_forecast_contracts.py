import copy
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
import httpx
from weather_alerts import WeatherAlertService

class ForecastContracts(unittest.IsolatedAsyncioTestCase):
    def payload(self):
        start = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        values = dict(temperature_2m=25, relative_humidity_2m=70, apparent_temperature=26,
                      precipitation_probability=0, precipitation=0, wind_speed_10m=0,
                      wind_direction_10m=0, cloud_cover=0, weather_code=0)
        return {'utc_offset_seconds':0,'hourly': {'time':[(start+timedelta(hours=i)).isoformat() for i in range(168)],
                                                 **{k:[v]*168 for k,v in values.items()}}}

    async def fetch(self, payload, hours=168):
        client = AsyncMock()
        client.get.return_value = httpx.Response(200,json=payload)
        with patch('weather_alerts.httpx.AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            result = await WeatherAlertService().get_forecast(20,78,hours)
        return result, client

    async def test_seven_full_days_and_genuine_zero_rain(self):
        result, client = await self.fetch(self.payload())
        self.assertEqual(len(result),168)
        self.assertEqual(sum(f.precipitation for f in result),0)
        self.assertEqual(client.get.call_args.kwargs['params']['forecast_days'],8)

    async def test_null_nonfinite_negative_and_invalid_percentage_are_unavailable(self):
        for field,value in [('precipitation',None),('precipitation',-1),('temperature_2m',float('nan')),
                            ('cloud_cover',101),('wind_speed_10m',True)]:
            payload=self.payload()
            payload['hourly'][field][4]=value
            # httpx JSON serialization excludes NaN; directly mock the decoder for this case.
            response=AsyncMock()
            response.status_code=200
            from unittest.mock import Mock
            response.json=Mock(return_value=payload)
            client=AsyncMock()
            client.get.return_value=response
            with patch('weather_alerts.httpx.AsyncClient') as factory:
                factory.return_value.__aenter__.return_value=client
                self.assertEqual(await WeatherAlertService().get_forecast(20,78),[])

    async def test_missing_hour_or_short_horizon_is_unavailable(self):
        payload=self.payload()
        payload['hourly']['time'][10]=payload['hourly']['time'][9]
        self.assertEqual((await self.fetch(payload))[0],[])
        payload=self.payload()
        payload['hourly']['time'].pop()
        self.assertEqual((await self.fetch(payload))[0],[])

    async def test_invalid_horizon_rejected_before_network(self):
        for hours in (0,169,True,1.5):
            with self.assertRaises(ValueError):
                await WeatherAlertService().get_forecast(20,78,hours)
