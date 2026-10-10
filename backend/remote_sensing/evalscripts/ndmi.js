//VERSION=3
// Trusted Krishyak S2 v1. Accept vegetation/bare soil only; all other SCL classes masked.
function setup() {
  return {input: ["B08", "B11", "SCL", "dataMask"], output: {bands: 4, sampleType: "AUTO"}};
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5);
  const d = s.B08 + s.B11;
  if (!Number.isFinite(s.B08) || !Number.isFinite(s.B11) || s.B08 < 0 || s.B11 < 0 || Math.abs(d) <= 1e-6) return [0,0,0,0];
  const v = (s.B08 - s.B11) / d;
  // Fixed spectral ramp, not disease classes or within-field quantile zoning.
  const t = Math.max(0, Math.min(1, (v + 1) / 2));
  return [1-t, 0.2+0.6*t, 0.15+0.15*(1-t), valid ? 1 : 0];
}
