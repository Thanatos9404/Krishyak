import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechCapabilities, speechError, transcribeAudio } from '../api/speechApi';

export const STATUS = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', ERROR: 'error', NO_SUPPORT: 'no_support' };
const canRecord = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

export default function useSarvamRecognition({ speechCode = 'en-IN', errorMessages = {} } = {}) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setSupported] = useState(canRecord);
  const [activeSpeechCode, setActiveSpeechCode] = useState(speechCode);
  const recording = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const request = useRef(null);
  const sequence = useRef(0);
  const busy = useRef(false);
  const options = useRef({ speechCode, errorMessages });
  options.current = { speechCode, errorMessages };

  const cancel = useCallback(() => {
    sequence.current += 1;
    busy.current = false;
    clearTimeout(timer.current);
    request.current?.abort();
    if (recording.current && recording.current.state !== 'inactive') recording.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    recording.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    cancel();
    setTranscript('');
    setStatus(STATUS.IDLE);
    if (!canRecord()) { setSupported(false); return () => { alive = false; cancel(); }; }
    getSpeechCapabilities().then((caps) => {
      if (alive) setSupported(caps.configured && caps.stt_languages.includes(speechCode.split('-')[0]));
    }).catch(() => { if (alive) setSupported(false); });
    return () => { alive = false; cancel(); };
  }, [speechCode, cancel]);

  const stopListening = useCallback(() => {
    clearTimeout(timer.current);
    if (recording.current?.state === 'recording') {
      setStatus(STATUS.PROCESSING);
      recording.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    } else if (busy.current && !recording.current) {
      cancel(); // Cancel a still-pending microphone permission request.
      setStatus(STATUS.IDLE);
    }
  }, [cancel]);

  const startListening = useCallback(async () => {
    if (!isSupported || busy.current) return false;
    cancel();
    const id = sequence.current;
    busy.current = true;
    setTranscript(''); setError(null); setStatus(STATUS.PROCESSING);
    const { speechCode: code, errorMessages: messages } = options.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (sequence.current !== id) { media.getTracks().forEach((track) => track.stop()); return false; }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('No supported microphone audio format.');
      const recorder = new MediaRecorder(media, { mimeType: mime });
      recording.current = recorder;
      const chunks = [];
      let bytes = 0;
      recorder.ondataavailable = (event) => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes > 5 * 1024 * 1024 && recorder.state === 'recording') recorder.stop();
      };
      recorder.onerror = () => {
        if (sequence.current !== id) return;
        cancel(); setStatus(STATUS.ERROR); setError(messages.noMicrophone || 'Audio recording failed. Please use text input.');
      };
      recorder.onstop = async () => {
        media.getTracks().forEach((track) => track.stop());
        if (sequence.current !== id) return;
        clearTimeout(timer.current);
        setStatus(STATUS.PROCESSING);
        const controller = new AbortController(); request.current = controller;
        try {
          const result = await transcribeAudio(new Blob(chunks, { type: mime }), code, controller.signal);
          if (sequence.current !== id) return;
          if (!result.transcript?.trim()) throw new Error('No speech detected.');
          setTranscript(result.transcript);
          setActiveSpeechCode(result.language_code || code);
          setStatus(STATUS.IDLE);
        } catch (failure) {
          if (sequence.current !== id) return;
          setError(speechError(failure, messages.serviceUnavailable || 'Speech could not be transcribed. Please retry or type.', messages.limitReached));
          setStatus(STATUS.ERROR);
        } finally {
          if (sequence.current === id) { busy.current = false; recording.current = null; }
        }
      };
      recorder.start(1000);
      setActiveSpeechCode(code); setStatus(STATUS.LISTENING);
      timer.current = setTimeout(stopListening, 29000);
      return true;
    } catch (failure) {
      if (sequence.current !== id) return false;
      cancel(); setStatus(STATUS.ERROR);
      setError(failure.name === 'NotAllowedError'
        ? (messages.microphoneDenied || 'Microphone permission denied.')
        : (messages.couldNotStart || 'Could not record audio. Please use text input.'));
      return false;
    }
  }, [cancel, isSupported, stopListening]);

  const resetTranscript = useCallback(() => { cancel(); setTranscript(''); setError(null); setStatus(STATUS.IDLE); }, [cancel]);
  const setManualTranscript = useCallback((text) => { cancel(); setTranscript(text); setError(null); setStatus(STATUS.IDLE); }, [cancel]);
  return { isListening: status === STATUS.LISTENING, transcript, confidence: null, activeSpeechCode,
    error, isSupported, status, startListening, stopListening, resetTranscript, setManualTranscript, STATUS };
}
