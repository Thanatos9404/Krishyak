export function areaInHectares(value, unit = 'hectares') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === 'hectares') return amount;
  if (unit === 'acres') return amount * 0.40468564224;
  return null;
}
