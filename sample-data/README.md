# Sample data

Synthetic inputs for trying Krishyak and its API. Nothing here is a real farm.

- `simulate_wheat_jaipur.json`: request body for `POST /simulate` (season simulator, 500 runs).
- `field_jaipur_synthetic.geojson`: synthetic field boundary near Chomu, Jaipur district.

```sh
curl -X POST https://krishyak.vercel.app/api/public/simulate \
  -H "Content-Type: application/json" \
  --data @sample-data/simulate_wheat_jaipur.json
```

More sample data and every test suite: [docs/SAMPLE_DATA_AND_TESTS.md](../docs/SAMPLE_DATA_AND_TESTS.md).
