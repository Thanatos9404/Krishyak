import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'krishyak_farmer_session';
const DRAFT_KEY = 'krishyak_registration_draft';
const GUEST_KEY = 'krishyak_guest_session';

// Strict array of fields safe for offline persistent storage
const SAFE_DRAFT_FIELDS = [
  'state', 'district', 'tehsil', 'village', 'pinCode', 
  'totalLandArea', 'landUnit', 'irrigatedLand', 'rainfedLand', 
  'ownershipType', 'primaryCrop', 'secondaryCrops', 
  'farmingType', 'experience'
];

export const useFarmerSession = () => {
  const [farmer, setFarmer] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    const authSession = sessionStorage.getItem(STORAGE_KEY);
    const guestSession = localStorage.getItem(GUEST_KEY);
    
    if (authSession) {
      try {
        const parsed = JSON.parse(authSession);
        setFarmer(parsed);
        setIsRegistered(true);
      } catch (e) {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } else if (guestSession) {
      setFarmer(JSON.parse(guestSession));
      setIsRegistered(false);
    }
    setLoading(false);
  }, []);

  // Save farmer session after registration (Secure: Session Storage only)
  const login = useCallback((farmerData) => {
    const sessionData = {
      ...farmerData,
      registeredAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      isGuest: false
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    localStorage.removeItem(GUEST_KEY); // Kill guest status
    localStorage.removeItem(DRAFT_KEY); // Clear draft after successful registration
    setFarmer(sessionData);
    setIsRegistered(true);
    return sessionData;
  }, []);

  // Set Guest Session (Persistent: Local Storage)
  const guestLogin = useCallback(() => {
    const guestData = { isGuest: true, fullName: 'Guest Farmer', primaryCrop: 'Rice' };
    localStorage.setItem(GUEST_KEY, JSON.stringify(guestData));
    sessionStorage.removeItem(STORAGE_KEY);
    setFarmer(guestData);
    setIsRegistered(false);
    return guestData;
  }, []);

  // Logout
  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(GUEST_KEY);
    setFarmer(null);
    setIsRegistered(false);
  }, []);

  // Update farmer profile
  const updateProfile = useCallback((updates) => {
    if (!farmer || farmer.isGuest) return null;
    const updatedFarmer = {
      ...farmer,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFarmer));
    setFarmer(updatedFarmer);
    return updatedFarmer;
  }, [farmer]);

  // Draft management for auto-save (PII Scrubbed)
  const saveDraft = useCallback((formData) => {
    const safeData = {};
    SAFE_DRAFT_FIELDS.forEach(field => {
      if (formData[field] !== undefined) {
        safeData[field] = formData[field];
      }
    });
    
    const draftData = {
      ...safeData,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
  }, []);

  const loadDraft = useCallback(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        return JSON.parse(draft);
      } catch (e) {
        console.error('Failed to parse draft:', e);
        return null;
      }
    }
    return null;
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  return {
    farmer,
    isRegistered,
    loading,
    login,
    guestLogin,
    logout,
    updateProfile,
    saveDraft,
    loadDraft,
    clearDraft
  };
};

export default useFarmerSession;
