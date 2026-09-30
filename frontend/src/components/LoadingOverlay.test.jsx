import React from 'react';
import {render,screen,act} from '@testing-library/react';
import LoadingOverlay from './LoadingOverlay';
jest.mock('../i18n',()=>({useTranslation:()=>({t:key=>key})}));

test('pending requests never acquire invented progress or completion markers',()=>{
  jest.useFakeTimers();
  try {
    const {container}=render(<LoadingOverlay isLoading />);
    const pending=container.textContent;
    act(()=>jest.advanceTimersByTime(120000));
    expect(container.textContent).toBe(pending);
    expect(container.textContent).not.toMatch(/%|simulation.complete|simulation.step/);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(jest.getTimerCount()).toBe(0);
  } finally {jest.useRealTimers();}
});

test('the actual request state controls visibility including subsequent retries',()=>{
  const {rerender}=render(<LoadingOverlay isLoading={false} />);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<LoadingOverlay isLoading />);
  expect(screen.getByText('simulation.running')).toBeTruthy();
  rerender(<LoadingOverlay isLoading={false} />);
  expect(screen.queryByRole('status')).toBeNull();
  rerender(<LoadingOverlay isLoading />);
  expect(screen.getByRole('status')).toBeTruthy();
});
