# Setup and deployment

1. Register a [CDSE account](https://dataspace.copernicus.eu/).
2. Open the [Sentinel Hub dashboard](https://shapps.dataspace.copernicus.eu/),
   create an OAuth client under user settings, and securely retain the secret.
   See [official authentication](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html).
3. Put the values only in `backend/.env` or backend host secrets. Never use a
   VITE/REACT_APP variable for these values. Restart the backend after changes.

```dotenv
REMOTE_SENSING_ENABLED=true
REMOTE_SENSING_PROVIDER=cdse
CDSE_CLIENT_ID=<server-only value>
CDSE_CLIENT_SECRET=<server-only value>
REMOTE_SENSING_DECISION_INFLUENCE=false
REMOTE_SENSING_MAX_AREA_HA=500
REMOTE_SENSING_CACHE_TTL=3600
REMOTE_SENSING_IMAGE_TTL=1800
REMOTE_SENSING_IP_PER_MINUTE=6
REMOTE_SENSING_IP_PER_DAY=60
REMOTE_SENSING_GLOBAL_PER_DAY=300
```

Only cdse is active. Maximum area is capped at 500 ha even if configuration is
larger. TTLs clamp to 60–86,400 seconds. Influence is unimplemented and remains
false regardless of requested flag. With enable=false or absent credentials,
existing app routes start normally and the module shows a controlled setup
state. `/status` reports configuration, not verified credential health.

Frontend public setting:
`VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty`.
Only that specific basemap variable is exposed. OpenFreeMap requests carry
viewed map region; the boundary goes to Krishyak/CDSE only on analysis. There
is no backend boundary persistence. Explicit Save stores one boundary on the
device; summary caching stores evidence, without geometry. Delete or logout
removes the boundary and summary.

From the repository root (Windows):
```powershell
backend/venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm.cmd --prefix frontend ci
backend/venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
# In another terminal:
npm.cmd --prefix frontend start
```
Open http://localhost:3000. For a different frontend port, set the existing
`CORS_ORIGINS` accordingly. Linux uses your activated Python and npm.

Deploy frontend using existing Vercel project rooted at frontend (`npm ci`,
`npm run build`, output build). Deploy backend using its existing project
rooted at backend (`requirements.txt`, main.py routing). Add backend secrets
to the hosting environment, not just a local .env. Set existing production
CORS/API URL. The new dependencies need normal wheels, not GDAL/system packages.
Keep remote sensing disabled until account quotas, shared gateway rate limits,
runtime duration limits and administrator monitoring are configured. CDSE free
quota is a pilot allowance, not a deployment-wide spending guarantee or SLA.
No deployment was performed as part of implementation.

## Tests
```powershell
backend/venv/Scripts/python.exe -m unittest discover -s backend -p 'test_*.py'
npm.cmd --prefix frontend test -- --runInBand
npm.cmd --prefix frontend run build
backend/venv/Scripts/python.exe backend/verify_sarvam_locales.py
backend/venv/Scripts/python.exe backend/verify_remote_sensing_locales.py
```

Opt-in live smoke (credentials needed, uses quota):
```powershell
$env:RUN_CDSE_LIVE='1'
backend/venv/Scripts/python.exe -m unittest discover -s backend -p 'test_remote_sensing.py'
```
The smoke uses `frontend/src/data/remoteSensingDemo.json`, an illustrative 4.4 ha
Rajasthan rectangle near 73°E, 26.8°N. It is not a registered farmer's field.
Without credentials it skips. A cloudy candidate produces a documented skip,
not fabricated imagery. Three candidates maximum; layers use 128² PNG.

Generate additive translations (requires permission to send feature copy to
Sarvam; current implementation run was explicitly approved):
```powershell
backend/venv/Scripts/python.exe backend/generate_sarvam_locales.py --source frontend/src/i18n/locales/remote-sensing/en.json --output frontend/src/i18n/locales/remote-sensing
```
Runtime translation makes no paid calls. Packs are machine translated and
require native review; text coverage does not expand existing TTS support.

Troubleshooting: 503 setup → enable/credentials/provider; 401/403-derived
access error → administrator checks client and entitlement; 429 → honor retry
and inspect account usage; timeout/outage → retry later; no clear data → change
date/inspect field; rejected AOI → smaller valid Polygon; map failure → GeoJSON
coordinate editor. Poor connectivity supports a labelled last summary only;
imagery and new analysis need internet.

## Device location and context

Use HTTPS in production (localhost works in development). Browser/OS location
permission cannot be bypassed. The page requests one fix on entry, not ongoing
tracking. Reported accuracy ≤100 m permits automatic EO over a 200 m square
labelled device_neighborhood, not ownership/farm size. Numeric entry is in a
closed advanced disclosure. Draw actual corners and Analyze for a field; no
coordinates are needed. A late GPS response cannot overwrite a selected field.
Automatic preview uses 256² pixels and at most two candidate days; the heavy
basemap stays opt-in. Nearby geometry cannot be saved as a confirmed field.

The key-free climate endpoint is independent of CDSE enable/credentials. It
uses fixed ERA5/1991–2020 daily data, rounds location to 0.1°, caches seven days
and applies separate 6/IP/min, 60/IP/day, 30/global/min, 300/global/day limits,
two processing slots and a 2 MiB response cap. Complete coverage/units are
required. It never fills seasonal rainfall or economic inputs. Browser weather
rounds position to 0.01°; it is a current model estimate. Place lookup uses a
backend proxy, not unbounded automatic public browser geocoding.

Optional `REMOTE_SENSING_PLACE_LOOKUP_ENABLED=false` defaults off. For a small
single-worker noncommercial pilot, explicitly set true: Nominatim calls then
use 0.01° rounding, identified User-Agent, daily cache, one in-flight request,
≥1.05 seconds between uncached calls and bounded quotas. Without place lookup,
weather/climate/EO still work; regional report lookup may be unavailable.
No government pest-history feed or verified soil/classification map is added.

**Public service policies matter:** [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
requires application-wide ≤1 request/second, caching, attribution and moderate
use. These local controls are per worker; leave public place lookup disabled
on serverless/replicated deployment until shared pacing is configured, or use
a hosted/self-hosted provider. This is a farmer-specific optional lookup, not
a generic public geocoding service. [Open-Meteo terms](https://open-meteo.com/en/terms)
restrict free API access to noncommercial usage with published quotas; commercial
deployment needs a licensed provider configuration. Weather/place providers
may retain request logs under their policies; application code does not
automatically persist precise device coordinates. OSM/Open-Meteo attribution
is visible. Neither this implementation nor this task deploys a paid service.
