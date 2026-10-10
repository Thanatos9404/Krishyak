//VERSION=3
// Multiple output masks preserve available-pixel counts separately from clear-pixel indices.
function setup() {
  return {input: ["B08", "B11", "SCL", "dataMask"], output: [
    {id: "index", bands: 1, sampleType: "FLOAT32"},
    {id: "footprint", bands: 1, sampleType: "FLOAT32"},
    {id: "dataMask", bands: ["index", "footprint"]}
  ]};
}
function evaluatePixel(s) {
  const d = s.B08 + s.B11;
  const valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5)
    && Number.isFinite(s.B08) && Number.isFinite(s.B11) && s.B08 >= 0 && s.B11 >= 0 && Math.abs(d) > 1e-6;
  return {index: [valid ? (s.B08 - s.B11) / d : 0], footprint: [1],
    dataMask: [valid ? 1 : 0, s.dataMask]};
}
