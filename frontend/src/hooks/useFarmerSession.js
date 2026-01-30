import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'krishyak_farmer_session';
const DRAFT_KEY = 'krishyak_registration_draft';

export const useFarmerSession = () => {
  const [farmer, setFarmer] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    const storedSession = localStorage.getItem(STORAGE_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setFarmer(parsed);
        setIsRegistered(true);
      } catch (e) {
        console.error('Failed to parse farmer session:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Save farmer session after registration
  const login = useCallback((farmerData) => {
    const sessionData = {
      ...farmerData,
      registeredAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    localStorage.removeItem(DRAFT_KEY); // Clear draft after successful registration
    setFarmer(sessionData);
    setIsRegistered(true);
    return sessionData;
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setFarmer(null);
    setIsRegistered(false);
  }, []);

  // Update farmer profile
  const updateProfile = useCallback((updates) => {
    if (!farmer) return null;
    const updatedFarmer = {
      ...farmer,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFarmer));
    setFarmer(updatedFarmer);
    return updatedFarmer;
  }, [farmer]);

  // Draft management for auto-save
  const saveDraft = useCallback((formData) => {
    const draftData = {
      ...formData,
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
    logout,
    updateProfile,
    saveDraft,
    loadDraft,
    clearDraft
  };
};

export default useFarmerSession;
