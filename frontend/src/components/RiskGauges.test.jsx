import React from 'react';
import {render,screen} from '@testing-library/react';
import RiskScoreGauge from './RiskScoreGauge';
import RiskGauge from './RiskGauge';
import {getRiskInfo,getRiskHexColor} from '../utils/riskHelper';
import {riskInsightKey} from '../utils/localization';
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key})}));

test.each([[0,'low'],[25,'low'],[25.01,'moderate'],[50,'moderate'],[50.01,'high'],[75,'high'],[75.01,'severe'],[100,'severe']])(
  'risk %s uses consistent thresholds', (score,id)=>{
    render(<RiskScoreGauge score={score} />);
    expect(getRiskInfo(score).id).toBe(id);
    expect(screen.getByText(`risk.levels.${id}`)).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe(String(score));
    expect(screen.queryByText(/risk.explanation|risk.guidance.low/)).toBeNull();
  });

test.each([undefined,null,NaN,Infinity,-1,101,'0',false])('invalid score %s is unavailable', score=>{
  render(<RiskScoreGauge score={score} />);
  expect(screen.queryByRole('meter')).toBeNull();
  expect(screen.getByText('common.notAvailable')).toBeTruthy();
  expect(getRiskInfo(score).id).toBe('unknown');
  expect(getRiskHexColor(score)).toBe('#6b7280');
});

test('components retain independent scores, including zero and missing values',()=>{
  render(<RiskGauge riskData={{components:{weather_risk:0,price_volatility_risk:60,pest_attack_risk:20}}} />);
  expect(screen.getAllByRole('meter')).toHaveLength(3);
  expect(screen.getByRole('meter',{name:'risk.components.price'}).getAttribute('aria-valuenow')).toBe('60');
  expect(screen.getByText('risk.components.weather: 0/100')).toBeTruthy();
  expect(screen.getByText('risk.components.soil: common.notAvailable')).toBeTruthy();
});

test('heuristic inputs do not become claims of a safe season or observed weather',()=>{
  expect(riskInsightKey('Low pest-risk input supplied; this does not rule out an outbreak')).toBe('pestModerate');
  expect(riskInsightKey('Weather conditions appear favorable')).toBe('weatherModerate');
});
