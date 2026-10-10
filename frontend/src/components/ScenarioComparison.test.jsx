import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ScenarioComparison from './ScenarioComparison';
jest.mock('../i18n', () => ({ useTranslation: () => ({ t: key => key, languageInfo: { speechCode: 'en-IN' } }) }));
const plan = profit => ({ profit, roi_percentage: -20, risk: { overall_risk_score: .3 }, costs: { total_cost: 5000 }, yield: { total_production_quintals: 4, yield_per_hectare: 400 } });
test('scenario cards retain the minus sign for losses and show positive profit correctly', () => {
  render(<ScenarioComparison comparisonData={{ current_plan: plan(-1000), ai_optimal_plan: plan(2000), worst_case_plan: plan(-3000) }} />);
  expect(screen.getByText('₹-1,000')).toBeInTheDocument();
  expect(screen.getByText('₹-3,000')).toBeInTheDocument();
  expect(screen.getByText('₹2,000')).toBeInTheDocument();
  expect(screen.queryByText('₹1,000')).not.toBeInTheDocument();
});
