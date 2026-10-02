# Backup and restore runbook

Implemented verification uses actual `pg_dump`/`pg_restore` inside local PostGIS
containers, plus schema inspection, upgrade → downgrade-base → upgrade and
Alembic drift checks. It targets two fixed disposable empty databases only.
It is **not** a production-data restore or an off-site backup system.

```sh
python scripts/verify_v2_database.py
# Repeat only after the verifier confirms both named databases contain no app rows:
python scripts/verify_v2_database.py --reuse-empty
```

The report is `output/database-verification.json`; dumps remain ignored local
artifacts. Do not publish backup contents. The production operator must configure
encrypted off-site backups, restricted access, expiry and restore credentials.
Suggested pilot objectives are daily backups (RPO ≤24 hours) and a rehearsed
four-hour RTO; these are targets, not measured guarantees for public hosting.
Database and private-object versions must be recoverable to a consistent point.

Recovery procedure:

1. Declare incident, stop incoming mutations and worker/scheduler, preserve safe
   diagnostic metadata and identify the last known-good release/backup.
2. Restore into a separate restricted database and object bucket. Never overwrite
   the only retained copy. Verify database roles/extensions and migrate to the
   selected application revision.
3. Verify constraints, owner row counts, geometry/cycles, object references,
   consent history and pending/dead-letter jobs. Reapply deletion/withdrawal
   requests since backup; do not resurrect consented access from an old snapshot.
4. Rotate credentials and revoke restored sessions. Start one worker and test
   cleanup/idempotency/readiness with a designated synthetic account.
5. Switch routing after operator review; monitor failures/queues and document
   actual lost interval and time to recovery. Retire old copies per policy.

Restore drills with representative consented records, object versions and
deletion ledgers remain an operator release requirement. No live farmer records
were available or used during the local drill.
