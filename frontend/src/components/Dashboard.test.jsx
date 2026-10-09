import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';

jest.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key) => key, languageInfo: { speechCode: 'en-IN' } }),
}));
jest.mock('./YieldChart', () => () => <div>yield chart</div>);
jest.mock('./RiskGauge', () => () => <div>risk gauge</div>);
jest.mock('./RiskScoreGauge', () => () => <div>risk score</div>);
jest.mock('./WeatherAlertCard', () => () => <div>weather alerts</div>);
jest.mock('./FertilizerRecommendationCard', () => () => <div>fertilizer</div>);

const simulation = {
  yield: { total_production_quintals: 50, yield_per_hectare: 2500 },
  costs: { total_cost: 40000, cost_per_quintal: 800, breakdown: { seeds: 4000 } },
  revenue: 100000,
  profit: 60000,
  roi_percentage: 150,
  risk: { overall_risk_score: 30, insights: [] },
};

test('planning results contain no identity verification, demo numbers or unfed pest card', () => {
  const { container } = render(<Dashboard simulationData={simulation} formData={{ crop: 'Rice', area_hectares: 2 }} />);
  expect(screen.getByText('dashboard.netProfit')).toBeTruthy();
  const text = container.textContent;
  expect(text).not.toMatch(/jam\.|aadhaar|demo numbers|1234/i);
  expect(text).not.toMatch(/pest\./);
  expect(container.querySelector('input')).toBeNull();
});
