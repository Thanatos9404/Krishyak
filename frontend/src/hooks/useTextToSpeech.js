/**
 * Krishyak Text-to-Speech (TTS) Hook
 * Provides multilingual speech synthesis for accessibility
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Custom hook for Text-to-Speech functionality
 */
export const useTextToSpeech = () => {
  const { language, languageInfo } = useI18n();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const utteranceRef = useRef(null);

  // Check browser support and load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      // Load available voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      // Voices may load asynchronously
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // Find best voice for current language
  const getBestVoice = useCallback((langCode) => {
    if (availableVoices.length === 0) return null;

    // Try to find exact match
    let voice = availableVoices.find(v =>
      v.lang.toLowerCase().startsWith(langCode.toLowerCase() + '-')
    );

    // Try language code only
    if (!voice) {
      voice = availableVoices.find(v =>
        v.lang.toLowerCase().startsWith(langCode.toLowerCase())
      );
    }

    // Fallback to English-India or any English
    if (!voice) {
      voice = availableVoices.find(v => v.lang.includes('en-IN')) ||
        availableVoices.find(v => v.lang.includes('en'));
    }

    return voice;
  }, [availableVoices]);

  // Speak text function
  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text) return false;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Set language
    const langCode = options.language || language;
    utterance.lang = languageInfo.speechCode || `${langCode}-IN`;

    // Set voice
    const voice = getBestVoice(langCode);
    if (voice) {
      utterance.voice = voice;
    }

    // Speech parameters
    utterance.rate = options.rate || 0.9; // Slightly slower for clarity
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
      options.onStart?.();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      options.onEnd?.();
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      console.error('TTS Error:', event.error);
      options.onError?.(event);
    };

    // Start speaking
    window.speechSynthesis.speak(utterance);
    return true;
  }, [isSupported, language, languageInfo, getBestVoice]);

  // Stop speaking
  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Pause speaking
  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
    }
  }, [isSupported, isSpeaking]);

  // Resume speaking
  const resume = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.resume();
    }
  }, [isSupported]);

  // Speak translation key
  const speakTranslation = useCallback((translationKey, t, options = {}) => {
    const text = t(translationKey);
    return speak(text, options);
  }, [speak]);

  // Get available voices for current language
  const getVoicesForLanguage = useCallback((langCode) => {
    return availableVoices.filter(v =>
      v.lang.toLowerCase().startsWith(langCode.toLowerCase())
    );
  }, [availableVoices]);

  return {
    // State
    isSpeaking,
    isSupported,
    availableVoices,

    // Actions
    speak,
    stop,
    pause,
    resume,
    speakTranslation,

    // Helpers
    getBestVoice,
    getVoicesForLanguage,
  };
};

/**
 * TTS Button Component
 * Speak button that reads text aloud
 */
export const SpeakButton = ({
  text,
  className = '',
  size = 'md',
  showLabel = false
}) => {
  const { speak, stop, isSpeaking, isSupported } = useTextToSpeech();
  const { t } = useI18n();

  if (!isSupported) return null;

  const handleClick = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  const sizeClasses = {
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1.5',
    lg: 'w-10 h-10 p-2',
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-full 
                  transition-colors duration-200
                  ${isSpeaking
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                  ${className}`}
      aria-label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
      title={isSpeaking ? 'Stop' : 'Read aloud'}
    >
      {isSpeaking ? (
        <svg className={sizeClasses[size]} viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg className={sizeClasses[size]} viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      )}
      {showLabel && (
        <span className="ml-2 text-sm">{isSpeaking ? 'Stop' : 'Listen'}</span>
      )}
    </button>
  );
};

export default useTextToSpeech;
