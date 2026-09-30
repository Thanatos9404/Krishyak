import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'krishyak_farmer_session';
const DRAFT_KEY = 'krishyak_registration_draft';
const GUEST_KEY = 'krishyak_guest_session';
const SAFE_DRAFT_FIELDS = [
  'state', 'district', 'tehsil', 'village', 'pinCode',
  'totalLandArea', 'landUnit', 'irrigatedLand', 'rainfedLand',
  'ownershipType', 'primaryCrop', 'secondaryCrops', 'farmingType', 'experience'
];

// Storage may be unavailable in private browsing or when the quota is exhausted.
const storage = (kind, action, key, value) => {
  try { return window[kind][action](key, value); } catch { return null; }
};
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const scrubProfile = value => Object.fromEntries(Object.entries(value).filter(
  ([key]) => !/aadhaar|aadhar/i.test(key)
));
const readRecord = (kind, key) => {
  try {
    const value = JSON.parse(storage(kind, 'getItem', key));
    if (record(value)) return value;
  } catch { /* Remove malformed legacy storage below. */ }
  storage(kind, 'removeItem', key);
  return null;
};
const safeDraft = value => Object.fromEntries(
  [...SAFE_DRAFT_FIELDS, 'savedAt'].filter(key => value[key] !== undefined)
    .map(key => [key, value[key]])
);

export const useFarmerSession = () => {
  const [farmer, setFarmer] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = readRecord('sessionStorage', STORAGE_KEY);
    if (auth && auth.isGuest !== true) {
      const clean = scrubProfile(auth);
      storage('sessionStorage', 'setItem', STORAGE_KEY, JSON.stringify(clean));
      setFarmer(clean);
      setIsRegistered(true);
    } else {
      const guest = readRecord('localStorage', GUEST_KEY);
      if (guest?.isGuest === true) {
        const clean = { isGuest: true, fullName: 'Guest Farmer', primaryCrop: 'Rice' };
        storage('localStorage', 'setItem', GUEST_KEY, JSON.stringify(clean));
        setFarmer(clean);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback((farmerData) => {
    const sessionData = {
      ...scrubProfile(farmerData), registeredAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(), isGuest: false
    };
    storage('sessionStorage', 'setItem', STORAGE_KEY, JSON.stringify(sessionData));
    storage('localStorage', 'removeItem', GUEST_KEY);
    storage('localStorage', 'removeItem', DRAFT_KEY);
    setFarmer(sessionData);
    setIsRegistered(true);
    return sessionData;
  }, []);

  const guestLogin = useCallback(() => {
    const guestData = { isGuest: true, fullName: 'Guest Farmer', primaryCrop: 'Rice' };
    storage('localStorage', 'setItem', GUEST_KEY, JSON.stringify(guestData));
    storage('sessionStorage', 'removeItem', STORAGE_KEY);
    setFarmer(guestData);
    setIsRegistered(false);
    return guestData;
  }, []);

  const logout = useCallback(() => {
    storage('sessionStorage', 'removeItem', STORAGE_KEY);
    [GUEST_KEY, DRAFT_KEY, 'krishyak_sim_cache', 'pestAlerts', 'pestPredictions',
      'krishyak_soil_data', 'fertilizerRecommendation'].forEach(key => storage('localStorage', 'removeItem', key));
    setFarmer(null);
    setIsRegistered(false);
  }, []);

  const updateProfile = useCallback((updates) => {
    if (!farmer || farmer.isGuest) return null;
    const updated = {
      ...scrubProfile({ ...farmer, ...updates }), isGuest: false,
      updatedAt: new Date().toISOString()
    };
    storage('sessionStorage', 'setItem', STORAGE_KEY, JSON.stringify(updated));
    setFarmer(updated);
    return updated;
  }, [farmer]);

  const saveDraft = useCallback((formData) => {
    const draft = { ...safeDraft(formData), savedAt: new Date().toISOString() };
    storage('localStorage', 'setItem', DRAFT_KEY, JSON.stringify(draft));
  }, []);
  const loadDraft = useCallback(() => {
    const draft = readRecord('localStorage', DRAFT_KEY);
    if (!draft) return null;
    const clean = safeDraft(draft);
    storage('localStorage', 'setItem', DRAFT_KEY, JSON.stringify(clean));
    return clean;
  }, []);
  const clearDraft = useCallback(() => {
    storage('localStorage', 'removeItem', DRAFT_KEY);
  }, []);

  return { farmer, isRegistered, loading, login, guestLogin, logout,
    updateProfile, saveDraft, loadDraft, clearDraft };
};
export default useFarmerSession;
