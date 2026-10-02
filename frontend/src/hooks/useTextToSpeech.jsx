import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { getSpeechCapabilities, speechError, synthesizeSpeech } from '../api/speechApi';

export const splitSpeechText = (text, limit = 2400) => {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf(' ', limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(rest.slice(0, cut)); rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
};

export const useTextToSpeech = () => {
  const { language, t } = useI18n();
  const [isSpeaking, setSpeaking] = useState(false);
  const [supportedLanguages, setLanguages] = useState([]);
  const [error, setError] = useState(null);
  const current = useRef(null);
  const audioContext = useRef(null);
  const request = useRef(null);
  const sequence = useRef(0);
  const resolvePlayback = useRef(null);
  const stop = useCallback(() => {
    sequence.current += 1;
    request.current?.abort();
    if (current.current) {
      if (typeof current.current.stop === 'function') current.current.stop();
      else {
        current.current.pause();
        current.current.removeAttribute('src');
      }
      current.current = null;
    }
    audioContext.current?.close().catch(() => {});
    audioContext.current = null;
    resolvePlayback.current?.();
    resolvePlayback.current = null;
    setSpeaking(false);
  }, []);
  useEffect(() => {
    let alive = true;
    let retry;
    const refresh = () => {
      clearTimeout(retry);
      getSpeechCapabilities().then((caps) => {
        if (!alive) return;
        const languages = caps.configured && Array.isArray(caps.tts_languages) ? caps.tts_languages : [];
        setLanguages(languages);
        if (!languages.length) retry = setTimeout(refresh, 30000);
      }).catch(() => { if (alive) { setLanguages([]); retry = setTimeout(refresh, 30000); } });
    };
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false; clearTimeout(retry);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      stop();
    };
  }, [stop]);
  useEffect(() => { stop(); }, [language, stop]);

  const speak = useCallback(async (text, options = {}) => {
    stop(); setError(null);
    const code = (options.language || language).split('-')[0];
    if (!supportedLanguages.includes(code) || !text?.trim()) return false;
    if (text.length > 10000) { setError(t('speech.tooLong')); return false; }
    const id = sequence.current;
    const controller = new AbortController(); request.current = controller;
    setSpeaking(true);
    try {
      // Resume inside the tap handler, before the network await: mobile browsers
      // discard the user gesture while synthesis is in flight.
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = Context ? new Context() : null;
      audioContext.current = context;
      if (context) await context.resume();
      if (id !== sequence.current) return false;
      options.onStart?.();
      for (const chunk of splitSpeechText(text)) {
        const result = await synthesizeSpeech(chunk, code, options.rate || 0.9, controller.signal);
        if (id !== sequence.current) return false;
        for (const encoded of result.audios) {
          if (id !== sequence.current) return false;
          if (context) {
            const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
            const buffer = await context.decodeAudioData(bytes.buffer);
            if (id !== sequence.current) return false;
            const source = context.createBufferSource();
            source.buffer = buffer; source.connect(context.destination);
            current.current = source;
            await new Promise(resolve => {
              resolvePlayback.current = resolve;
              source.onended = resolve; source.start();
            });
            if (id !== sequence.current) return false;
            source.disconnect();
            current.current = null;
          } else {
            const audio = new Audio(`data:audio/wav;base64,${encoded}`);
            current.current = audio;
            await new Promise((resolve, reject) => {
              resolvePlayback.current = resolve;
              audio.onended = resolve;
              audio.onerror = () => reject(new Error('Audio playback failed.'));
              Promise.resolve(audio.play()).catch(reject);
            });
            if (id !== sequence.current) return false;
            current.current = null;
          }
          resolvePlayback.current = null;
        }
      }
      if (id === sequence.current) { setSpeaking(false); current.current = null; options.onEnd?.(); }
      return true;
    } catch (failure) {
      if (id === sequence.current) {
        stop();
        setSpeaking(false);
        setError(speechError(failure, t('speech.unavailable'), t('speech.limitReached')));
        options.onError?.(failure);
      }
      return false;
    } finally {
      if (id === sequence.current) {
        request.current = null;
        resolvePlayback.current = null;
        audioContext.current?.close().catch(() => {});
        audioContext.current = null;
      }
    }
  }, [language, supportedLanguages, stop, t]);
  const pause = useCallback(() => {
    if (audioContext.current) audioContext.current.suspend().catch(() => {});
    else current.current?.pause();
  }, []);
  const resume = useCallback(() => {
    const pending = audioContext.current ? audioContext.current.resume() : current.current?.play();
    pending?.catch(() => setError(t('speech.unavailable')));
  }, [t]);
  return { speak, stop, pause, resume, isSpeaking, isSupported: supportedLanguages.includes(language), error,
    speakTranslation: (key, t, options) => speak(t(key), options) };
};

export const SpeakButton = ({ text, getText, resetKey, className = '' }) => {
  const { t } = useI18n();
  const { speak, stop, isSpeaking, isSupported, error } = useTextToSpeech();
  useEffect(() => { stop(); }, [resetKey, stop]);
  return <div className={className} data-no-speech>
    <button type="button" disabled={!isSupported}
      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
      title={!isSupported ? t('speech.unavailable') : undefined}
      onClick={() => isSpeaking ? stop() : speak(getText ? getText() : text)}>
      {isSpeaking ? t('speech.stop') : t('speech.readAloud')}
    </button>
    {!isSupported && <span className="ml-2 text-xs text-gray-600">{t('speech.unavailable')}</span>}
    {isSupported && <span className="ml-2 text-xs text-gray-600">{t('speech.privacyNotice')}</span>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
};

export const visiblePageText = () => {
  const content = document.querySelector('.workspace-main');
  if (!content) return '';
  const selection = window.getSelection();
  if (selection?.toString().trim() && content.contains(selection.anchorNode) && content.contains(selection.focusNode)) {
    return selection.toString();
  }
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  const text = [];
  while (walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (parent && !parent.closest('[data-no-speech],button,input,textarea,select,script,style,[hidden],[aria-hidden="true"]') && parent.getClientRects().length) {
      text.push(walker.currentNode.textContent.trim());
    }
  }
  return text.filter(Boolean).join(' ');
};
export default useTextToSpeech;
