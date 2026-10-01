//VERSION=3
// Multiple output masks preserve available-pixel counts separately from clear-pixel indices.
function setup() {
  return {input: ["B8A", "B05", "SCL", "dataMask"], output: [
    {id: "index", bands: 1, sampleType: "FLOAT32"},
    {id: "footprint", bands: 1, sampleType: "FLOAT32"},
    {id: "dataMask", bands: ["index", "footprint"]}
  ]};
}
function evaluatePixel(s) {
  const d = s.B8A + s.B05;
  const valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5)
    && Number.isFinite(s.B8A) && Number.isFinite(s.B05) && s.B8A >= 0 && s.B05 >= 0 && Math.abs(d) > 1e-6;
  return {index: [valid ? (s.B8A - s.B05) / d : 0], footprint: [1],
    dataMask: [valid ? 1 : 0, s.dataMask]};
}
