//VERSION=3
// Trusted Krishyak S2 v1. Accept vegetation/bare soil only; all other SCL classes masked.
function setup() {
  return {input: ["B04", "B03", "B02", "SCL", "dataMask"], output: {bands: 4, sampleType: "AUTO"}};
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1 && (s.SCL === 4 || s.SCL === 5);
  return [2.5*s.B04, 2.5*s.B03, 2.5*s.B02, valid ? 1 : 0];
}
