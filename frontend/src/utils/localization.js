export const riskInsightKey = (insight = '') => {
  const value = String(insight).toLowerCase();
  if (value.includes('weather uncertainty')) return 'weatherHigh';
  if (value.includes('moderate weather')) return 'weatherModerate';
  if (value.includes('weather conditions')) return 'weatherModerate';
  if (value.includes('high market price')) return 'priceHigh';
  if (value.includes('moderate price')) return 'priceModerate';
  if (value.includes('stable market')) return 'priceLow';
  if (value.includes('significant pest')) return 'pestHigh';
  if (value.includes('moderate pest')) return 'pestModerate';
  if (value.includes('low pest')) return 'pestModerate';
  if (value.includes('soil compatibility is poor')) return 'soilHigh';
  if (value.includes('moderately suitable')) return 'soilModerate';
  if (value.includes('excellent soil')) return 'soilLow';
  return 'reviewInputs';
};
