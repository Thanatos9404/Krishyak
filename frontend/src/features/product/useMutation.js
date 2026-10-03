import { useCallback, useEffect, useRef, useState } from "react";

export function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const running = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const act = useCallback(async (action) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (problem) {
      if (mounted.current) setError(problem.message);
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  return { act, busy, error, setError, notice, setNotice };
}
