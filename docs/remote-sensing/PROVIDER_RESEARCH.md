# Provider research

GPS-context follow-up checked on 1 October 2026: Open-Meteo historical weather
offers ERA5 reanalysis; [official baseline documentation](https://open-meteo.com/en/docs/historical-weather-api)
supports long-term climate context at coarse resolution. It is not field soil
or seasonal rainfall. [ISRIC status](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)
reports SoilGrids REST paused with no restoration ETA; stable raster/web-service
integration and uncertainty review remain future work. Existing regional pest
history is not connected, and a farm-plan crop is not satellite classification.
[Open-Meteo terms](https://open-meteo.com/en/terms) restrict free API use to
noncommercial applications; [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
requires application-wide 1/s maximum, cache/attribution, identified requests and
moderate user-triggered use. Place proxy is optional/default off until a small
single-worker pilot or appropriate shared gateway is deliberately configured.

Research date: 2026-09-30. Official documentation checked live. Published quotas
are account-dependent and may change; an open dataset does not imply unlimited compute.

| Option | Data / resolution / timing | API, authentication and runtime fit | Quota / constraints / risks |
|---|---|---|---|
| CDSE Sentinel Hub | Sentinel-2 L2A surface reflectance, 10 m visible/NIR, 20 m red edge/SWIR/SCL; nominal multi-day revisit, clear observations weather-dependent. Sentinel-1 GRD radar also available. India covered. | OAuth2 client credentials; Catalog search, Process PNG, Statistical parcel series. Small REST requests fit FastAPI/mobile. Moderate API lock-in isolated behind adapter. | General users: 10,000 requests/month and 10,000 PU/month, 300 requests/minute and 300 PU/minute. Batch APIs not generally available to free users. Commercial credits/sponsorship via ecosystem; no guaranteed free SLA. |
| CDSE openEO | Same EO ecosystem; resolution depends on collection/process | Open process graphs; authenticated synchronous/batch jobs. Suitable future district pipeline; unnecessary first-release runtime | Credits/quotas differ from Sentinel Hub; validate account entitlement and sponsorship/commercial offering before scale |
| Google Earth Engine | Sentinel optical/radar plus many research datasets; source resolutions retained | Cloud project, OAuth/service account, hosted computation. Useful seasonal research and validated classifier experiments; separate licensing/runtime dependency | Verified noncommercial Community: 150 EECU-hours/month (undergraduate use), Contributor: 1,000, Partner: 100,000 with application. Billing-account requirements differ by tier. Commercial Limited is usage-only; Basic $500/month, Professional $2,000/month plus usage. Noncommercial status must be verified; cannot assume a deployed commercial farmer service qualifies. |
| ISRO/NRSC Bhoonidhi | Indian missions, Sentinel access, NISAR S-SAR collections published from 2026-07-08; resolution/revisit product-specific | /auth/token user/password JWT, /data search/STAC, /download. API access contact required. Strong India relevance, not a drop-in Statistical/Process replacement. | Open/priced products and user eligibility differ; Indian policy distinguishes 5 m and finer data. Account/EULA approval needed; no verified account quota here. Access/data processing unverified, therefore no active adapter. |
| AWS Sentinel-2 COGs / STAC | Open surface reflectance bands; source 10/20/60 m | Public COG range reads plus STAC discovery; client/server raster stack, reprojection, masking and statistics needed | Open data licensing separate from compute/egress. Less vendor lock-in but more operations, heavy GDAL/Rasterio packaging. Defer for this deployment. |

Sources:
- [CDSE quotas](https://documentation.dataspace.copernicus.eu/Quotas.html)
- [Sentinel Hub APIs](https://dataspace.copernicus.eu/analyse/apis/sentinel-hub)
- [Authentication](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html)
- [2026 API paths](https://dataspace.copernicus.eu/news/2026-3-9-api-path-structure-updates-sentinel-hub-services)
- [Processing units](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/ProcessingUnit.html)
- [Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html) and [examples / per-output masks](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical/Examples.html)
- [S2 L2A bands/SCL](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)
- [S1 GRD](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S1GRD.html)
- [openEO](https://documentation.dataspace.copernicus.eu/APIs/openEO.html)
- [Earth Engine tiers](https://developers.google.com/earth-engine/guides/noncommercial_tiers), [quotas](https://developers.google.com/earth-engine/guides/usage), [commercial pricing](https://cloud.google.com/earth-engine/pricing)
- [Bhoonidhi API](https://bhoonidhi.nrsc.gov.in/bhoonidhi-api/index.html), [access contact / current collections](https://bhoonidhi.nrsc.gov.in/bhoonidhi/home.html), [data policy](https://bhoonidhi.nrsc.gov.in/bhoonidhi_resources/help/UIM2024/4-UIM2024-Bhoonidhi_SpacePolicy_Implementation.pdf), [NISAR](https://bhoonidhi.nrsc.gov.in/NISAR/)
- [AWS COG registry](https://registry.opendata.aws/sentinel-2-l2a-cogs/)

## Basemap and UX

MapLibre is maintained, BSD-3-Clause, WebGL and vendor-independent. Current v6
Vite worker setup uses `?worker&url`, not plain `?url`. OpenFreeMap public styles
currently require no key, registration or cookies and advertise no request/view
limits; attribution must remain visible. Donation-funded hosting is suitable for
a pilot, not a contractual SLA. MapTiler Free is noncommercial/testing; Flex
starts at $30/month with traffic charges. Map styles remain configurable.
Leaflet is lighter for simple raster maps, OpenLayers offers broader GIS tools;
neither outweighs the configurable vector-map/imagery-source fit here.

- [MapLibre installation / worker / CSP](https://maplibre.org/maplibre-gl-js/docs/)
- [OpenFreeMap](https://openfreemap.org/) / [quick start](https://openfreemap.org/quick_start/)
- [MapTiler terms](https://www.maptiler.com/terms/cloud/) / [pricing](https://www.maptiler.com/cloud/pricing/)
- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): community tiles have capacity, attribution, caching and bulk/offline restrictions. They are not used here.

Official product references show established field mapping, imagery dates/cloud
quality, historical indices and scouting workflows. These are UX patterns, not
evidence that their proprietary crop/yield models validate Krishyak.

- [EOSDA monitoring](https://eos.com/products/crop-monitoring/): drawn/imported fields, historical graphs, dated imagery and scouting; mobile scouting complements web analysis.
- [OneSoil scouting](https://blog.onesoil.ai/en/crop-scouting-tips-from-onesoil): field notes, rotation and NDVI on mobile.
- [Cropin](https://www.cropin.com/cropin-ai-info/): field/weather/satellite integration and plot/regional offerings.
- [SatSure](https://www.satsure.co/): enterprise EO decision context; no proprietary algorithm reproduced.

Recommendation: CDSE for field monitoring; OpenFreeMap/MapLibre for a replaceable
pilot basemap; Earth Engine for research; Bhoonidhi when approved access and
verified processing are available. Basic NDVI is established technology.
Differentiation is satellite observation → ground verification → transparent
existing decision support in local languages.
