"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  SUPPORTED_LANGUAGES,
  getLanguage,
  loadLanguagePreference,
} from "../../i18n/config";

export function interpolate(message, parameters = {}) {
  return String(message).replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.hasOwn(parameters, key) ? String(parameters[key] ?? "") : match,
  );
}
const English = {
  language: "en",
  info: getLanguage("en"),
  tx: interpolate,
  loading: false,
  error: "",
  changeLanguage: async () => false,
};
const Locale = createContext(English);
export const useProductLocale = () => useContext(Locale);

export function ProductLocaleProvider({ children }) {
  const [language, setLanguage] = useState("en"),
    [messages, setMessages] = useState({}),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const cache = useRef({ en: {} }),
    sequence = useRef(0),
    active = useRef(null);
  const changeLanguage = useCallback(async (code) => {
    if (!Object.hasOwn(SUPPORTED_LANGUAGES, code)) return false;
    const request = ++sequence.current;
    active.current?.abort();
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);
    active.current = controller;
    setLoading(true);
    setError("");
    try {
      if (!cache.current[code]) {
        const response = await fetch(`/locales/workspace/${code}.json`, {
          signal: controller.signal,
          credentials: "omit",
        });
        if (!response.ok) throw new Error("Locale unavailable");
        const pack = await response.json();
        if (
          !pack ||
          typeof pack !== "object" ||
          Array.isArray(pack) ||
          !Object.keys(pack).length ||
          Object.values(pack).some((value) => typeof value !== "string")
        )
          throw new Error("Invalid locale");
        cache.current[code] = pack;
      }
      if (request !== sequence.current) return false;
      setMessages(cache.current[code]);
      setLanguage(code);
      try {
        localStorage.setItem("krishyak_language", code);
      } catch {
        /* Private browsing still permits this session's language choice. */
      }
      return true;
    } catch {
      if (
        request === sequence.current &&
        (timedOut || !controller.signal.aborted)
      )
        setError(
          "This language could not be loaded. Your previous language is still available. Reconnect and retry.",
        );
      return false;
    } finally {
      clearTimeout(timeout);
      if (request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const currentSequence = sequence,
      currentRequest = active;
    let saved = "en";
    try {
      saved = loadLanguagePreference();
    } catch {
      /* Storage is optional. */
    }
    changeLanguage(saved);
    return () => {
      currentSequence.current++;
      currentRequest.current?.abort();
    };
  }, [changeLanguage]);
  useEffect(() => {
    const info = getLanguage(language);
    document.documentElement.lang = info.speechCode;
    document.documentElement.dir = info.direction;
  }, [language]);
  const tx = useCallback(
    (source, params = {}) => {
      const key = String(source)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
      const translated = Object.hasOwn(messages, key)
        ? (String(source).match(/^\s+/)?.[0] || "") +
          messages[key] +
          (String(source).match(/\s+$/)?.[0] || "")
        : source;
      return interpolate(translated, params);
    },
    [messages],
  );
  return (
    <Locale.Provider
      value={{
        language,
        info: getLanguage(language),
        tx,
        loading,
        error,
        changeLanguage,
      }}
    >
      {children}
    </Locale.Provider>
  );
}
