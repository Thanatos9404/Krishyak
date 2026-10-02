# PostgreSQL and PostGIS

Alembic revisions `v2_0001` through `v2_0004` create 17 v2 tables. No API startup
calls `create_all`. Extensions are PostGIS and `btree_gist`; the migration role
needs permission to install them. Runtime deployments should use a narrower
application role after migration.

Polygon storage is EPSG:4326. Database checks enforce valid single polygons,
geodesic area, centroid consistency, supported bounds and 0.01–500 hectares.
Only one outer ring is accepted, with at most 200 vertices. Holes,
antimeridian/polar/extreme extents and multipolygons are rejected rather than
misprocessed. Manual area is separately labelled and cannot enable satellite
processing. PostGIS geography computes square metres; display converts to hectares.

Alembic drift checks manage the `v2_` table namespace only. PostGIS topology/TIGER
extension tables and unrelated applications are never proposed for removal.
Foreign keys cascade owner-domain deletion. An independent object-deletion
queue survives account removal. Partial consent uniqueness preserves withdrawal
history. Active/planned crop cycles have a database exclusion constraint against
overlapping dates. UUID operation indexes, owner/time indexes and a GiST boundary
index support bounded queries. Farmer-first lock ordering serializes account
mutations and consent withdrawal; durable job claims use `SKIP LOCKED`.

From `backend`, run `python -m alembic upgrade head`, then `python -m alembic check`.
Never run `downgrade base` on production. The round-trip verifier only accepts
loopback development databases with two fixed disposable names and checks they
contain no application records before recreation.

Legacy CSV personal data is **not automatically imported or treated as verified
identity**. Leave it outside images/builds/Git. An operator must inventory and
lawfully reconcile existing data, obtain current consent, and map ownership
before an independently reviewed import. New OTP users start with their own
account. Deployed legacy personal-data endpoints return 410.

See [disaster recovery](DISASTER_RECOVERY.md) for the tested restore scope.
