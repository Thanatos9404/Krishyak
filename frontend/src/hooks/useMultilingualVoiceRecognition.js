import { useEffect, useState } from 'react';
import useSarvamRecognition from './useSarvamRecognition';
import { SUPPORTED_LANGUAGES, getSpeechCode } from '../i18n/config';
export { parseVoiceCommand as parseMultilingualVoiceCommand } from './useVoiceRecognition';

const useMultilingualVoiceRecognition = ({ language = 'en', onResult, onError } = {}) => {
  const [currentLanguage, changeLanguage] = useState(language);
  useEffect(() => { changeLanguage(language); }, [language]);
  const result = useSarvamRecognition({ speechCode: getSpeechCode(currentLanguage) });
  useEffect(() => { if (result.transcript) onResult?.(result.transcript, null, currentLanguage); }, [result.transcript, currentLanguage, onResult]);
  useEffect(() => { if (result.error) onError?.(result.error); }, [result.error, onError]);
  return { ...result, interimTranscript: '', currentLanguage, changeLanguage, supportedLanguages: Object.keys(SUPPORTED_LANGUAGES) };
};

export { useMultilingualVoiceRecognition };
export default useMultilingualVoiceRecognition;
