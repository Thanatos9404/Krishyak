import {renderHook, act} from '@testing-library/react';
import useFormValidation from './useFormValidation';
jest.mock('../i18n', () => ({useTranslation: () => ({t: key => key})}));

test('area fields reject infinite and negative values but preserve optional zero', () => {
  const {result} = renderHook(() => useFormValidation());
  act(() => expect(result.current.validateField('totalLandArea', 'Infinity')).toBe(false));
  act(() => expect(result.current.validateField('irrigatedLand', '-1')).toBe(false));
  act(() => expect(result.current.validateField('irrigatedLand', '0')).toBe(true));
  act(() => expect(result.current.validateField('rainfedLand', '')).toBe(true));
});

test('land step validates the combined partition and accepts partial reporting', () => {
  const {result} = renderHook(() => useFormValidation());
  const base = {khasraNumber:'Test',totalLandArea:'1',ownershipType:'owned'};
  act(() => expect(result.current.validateStep(3, {...base,irrigatedLand:'.6',rainfedLand:'.6'})).toBe(false));
  expect(result.current.errors.irrigatedLand).toBeTruthy();
  act(() => expect(result.current.validateStep(3, {...base,irrigatedLand:'.3',rainfedLand:''})).toBe(true));
  expect(result.current.errors).toEqual({});
});

test('clearing one field error preserves others and clearing all resets validation', () => {
  const {result} = renderHook(() => useFormValidation());
  act(() => result.current.validateStep(1, {}));
  expect(result.current.errors.fullName).toBeTruthy();
  act(() => result.current.clearFieldError('fullName'));
  expect(result.current.errors.fullName).toBeUndefined();
  expect(result.current.errors.mobileNumber).toBeTruthy();
  act(() => result.current.clearErrors());
  expect(result.current.errors).toEqual({});
});
