const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const nonemptyText = value => typeof value === 'string' && value.trim().length > 0;
const textList = value => Array.isArray(value) && value.every(nonemptyText) ? value : undefined;
const canonicalCrop = crop => ({corn:'maize',grapes:'grape',citrus:'orange'}[crop] || crop);

// Validate diagnosis fields before React renders them. Optional advice is never coerced into text.
export const parseDiseaseResponse = (data, selectedCrop) => {
  if (!data || data.model_available !== true) return null;
  if (data.status === 'healthy') {
    if (!probability(data.confidence) || data.disease != null || !nonemptyText(data.crop_detected)
        || canonicalCrop(data.crop_detected) !== canonicalCrop(selectedCrop)) return null;
    return {...data, suggestions:textList(data.suggestions)};
  }
  if (data.status !== 'disease_detected') return null;
  const disease = data.disease;
  if (!nonemptyText(disease?.id) || !nonemptyText(disease?.name) || !probability(disease?.confidence)
      || (disease.severity != null && !['low','medium','high'].includes(disease.severity))
      || !nonemptyText(data.crop_detected)
      || canonicalCrop(data.crop_detected) !== canonicalCrop(selectedCrop)) return null;
  // The installed classifier has no severity estimator; older servers sent static disease metadata.
  return {...data, disease:{...disease,severity:null,severity_source:'not_measured'}, diseaseDetails:undefined, treatment:{
    chemical:textList(data.treatment?.chemical), organic:textList(data.treatment?.organic),
    prevention:textList(data.treatment?.prevention),
  }};
};
