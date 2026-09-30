import React from 'react';
import { render, screen } from '@testing-library/react';
import ScenarioPriceSource from './ScenarioPriceSource';
import en from '../i18n/locales/en.json';

jest.mock('../i18n', () => ({ useTranslation: () => ({
  t: key => key.split('.').reduce((value, part) => value?.[part], require('../i18n/locales/en.json')) || key,
}) }));

test('entered scenario prices never claim to be a live feed', () => {
  render(<ScenarioPriceSource forecast={{method:'persistence_baseline', source_metadata:{
    source_type:'user_input', freshness_status:'user_supplied', source_label:'Entered market price',
  }}} />);
  expect(screen.getByText(en.soilSensor.manualEntry, {exact:false})).toBeTruthy();
  expect(screen.getByText(en.scenarioDetails.disclaimer)).toBeTruthy();
  expect(screen.queryByText(en.scenarioDetails.livePriceNotice)).toBeNull();
  expect(screen.queryByText(en.mandi.source)).toBeNull();
});

test.each([undefined, {source_metadata:{freshness_status:'live'}}])('missing provenance does not imply live prices', forecast => {
  render(<ScenarioPriceSource forecast={forecast} />);
  expect(screen.queryByText(en.scenarioDetails.livePriceNotice)).toBeNull();
  expect(screen.getAllByText(en.common.notAvailable, {exact:false}).length).toBeGreaterThan(0);
});

test('stale verified source keeps its label, date and stale notice', () => {
  render(<ScenarioPriceSource forecast={{source_metadata:{source_type:'cached',
    source_label:'AGMARKNET saved quote', freshness_status:'stale', record_date:'2026-09-01'}}} />);
  expect(screen.getByText(/AGMARKNET saved quote/)).toBeTruthy();
  expect(screen.getByText(/2026-09-01/)).toBeTruthy();
  expect(screen.getByText(en.scenarioDetails.stalePriceNotice)).toBeTruthy();
});
