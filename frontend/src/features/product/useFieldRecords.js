import { useCallback, useEffect, useRef, useState } from "react";
import { farmApi } from "../farms/api";
import { readRecord, saveRecord } from "../farms/offline";
import { fieldChoice } from "./sessionStorage";

export function useFieldRecords({
  farmer,
  ownerRef,
  offlineOpt,
  setError,
  setOffline,
}) {
  const [farms, setFarms] = useState([]),
    [plots, setPlots] = useState([]),
    [selected, setSelected] = useState("");
  const [today, setToday] = useState(null),
    [timeline, setTimeline] = useState([]),
    [cycles, setCycles] = useState([]);
  const [savedAt, setSavedAt] = useState(null),
    [loading, setLoading] = useState(false);
  const selectedRef = useRef(selected),
    generation = useRef(0),
    alive = useRef(true);
  const evidenceRequest = useRef(null);
  selectedRef.current = selected;
  useEffect(() => {
    alive.current = true;
    const counter = generation;
    const stopReads = () => {
      alive.current = false;
      counter.current++;
      evidenceRequest.current?.abort();
    };
    window.addEventListener("beforeunload", stopReads);
    window.addEventListener("pagehide", stopReads);
    return () => {
      stopReads();
      window.removeEventListener("beforeunload", stopReads);
      window.removeEventListener("pagehide", stopReads);
    };
  }, []);
  const loadFields = useCallback(async () => {
    const owner = ownerRef.current;
    if (!owner) return;
    try {
      const [farmsResult, plotsResult] = await Promise.all([
        farmApi("/farms?limit=100"),
        farmApi("/plots?limit=100"),
      ]);
      if (!alive.current || ownerRef.current !== owner) return;
      setFarms(farmsResult.items);
      setPlots(plotsResult.items);
      const previous = selectedRef.current || fieldChoice(owner);
      const choice = plotsResult.items.some((item) => item.id === previous)
        ? previous
        : plotsResult.items[0]?.id || "";
      setSelected(choice);
      if (offlineOpt)
        await saveRecord(owner, "fields", {
          selected: choice,
          farms: farmsResult.items,
          plots: plotsResult.items,
        });
    } catch (problem) {
      const saved =
        offlineOpt && problem.network
          ? await readRecord(owner, "fields").catch(() => null)
          : null;
      if (!alive.current || ownerRef.current !== owner) return;
      if (!saved) throw problem;
      setFarms(saved.data.farms);
      setPlots(saved.data.plots);
      setSelected(saved.data.selected || saved.data.plots[0]?.id || "");
      setOffline(true);
    }
  }, [ownerRef, offlineOpt, setOffline]);
  useEffect(() => {
    generation.current++;
    setFarms([]);
    setPlots([]);
    setSelected("");
    setToday(null);
    setTimeline([]);
    setCycles([]);
    if (farmer?.id) loadFields().catch((problem) => setError(problem.message));
  }, [farmer?.id, loadFields, setError]);
  const refreshEvidence = useCallback(async () => {
    const owner = ownerRef.current,
      field = selectedRef.current;
    if (!owner || !field) return;
    evidenceRequest.current?.abort();
    const controller = new AbortController();
    evidenceRequest.current = controller;
    const request = ++generation.current;
    setLoading(true);
    try {
      const [attention, events, cropCycles] = await Promise.all([
        farmApi(`/plots/${field}/today`, { signal: controller.signal }),
        farmApi(`/plots/${field}/timeline`, { signal: controller.signal }),
        farmApi(`/plots/${field}/crop-cycles`, { signal: controller.signal }),
      ]);
      if (
        !alive.current ||
        ownerRef.current !== owner ||
        selectedRef.current !== field ||
        request !== generation.current
      )
        return;
      setToday(attention);
      setTimeline(events.items);
      setCycles(cropCycles.items);
      setSavedAt(null);
      if (offlineOpt)
        await saveRecord(owner, `plot:${field}`, {
          attention,
          events,
          cropCycles,
        });
    } catch (problem) {
      if (problem.cancelled) return;
      const saved =
        offlineOpt && problem.network
          ? await readRecord(owner, `plot:${field}`).catch(() => null)
          : null;
      if (
        !alive.current ||
        ownerRef.current !== owner ||
        selectedRef.current !== field ||
        request !== generation.current
      )
        return;
      if (saved) {
        setToday(saved.data.attention);
        setTimeline(saved.data.events.items);
        setCycles(saved.data.cropCycles.items);
        setSavedAt(saved.saved_at);
        setOffline(true);
      } else setError(problem.message);
    } finally {
      if (alive.current && request === generation.current) setLoading(false);
    }
  }, [ownerRef, offlineOpt, setError, setOffline]);
  useEffect(() => {
    generation.current++;
    setToday(null);
    setTimeline([]);
    setCycles([]);
    setSavedAt(null);
    if (selected && farmer?.id) refreshEvidence();
    if (selected && farmer?.id) fieldChoice(farmer.id, selected);
  }, [selected, farmer?.id, refreshEvidence]);
  return {
    farms,
    plots,
    setPlots,
    selected,
    setSelected,
    selectedRef,
    plot: plots.find((item) => item.id === selected),
    today,
    timeline,
    setTimeline,
    cycles,
    savedAt,
    evidenceLoading: loading,
    loadFields,
    refreshEvidence,
  };
}
