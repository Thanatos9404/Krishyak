import React, { useCallback, useEffect, useRef, useState } from "react";
import LanguageSelector from "../../components/LanguageSelector";
import { useTranslation } from "../../i18n";
import { deferredFeature } from "../../components/deferredFeature";
import { farmApi, restoreFarmSession, setCsrfToken } from "./api";
import {
  clearOwner,
  activateOwner,
  pendingOperations,
  queueOperation,
  readRecord,
  saveRecord,
  synchronize,
} from "./offline";
import { farmStrings } from "./strings";

const FieldMap = deferredFeature(() => import("../../components/FieldMap"));
const MandiPriceCard = deferredFeature(
  () => import("../../components/MandiPriceCard"),
);
const MSPRateCard = deferredFeature(
  () => import("../../components/MSPRateCard"),
);
const BenefitsPanel = deferredFeature(() => import("./BenefitsPanel"));
const PlotContext = deferredFeature(() => import("./PlotContext"));
const InstitutionConsole = deferredFeature(
  () => import("./InstitutionConsole"),
);
const AccountDetails = deferredFeature(() => import("./AccountDetails"));
const PendingPanel = deferredFeature(() => import("./PendingPanel"));
const NoticeList = deferredFeature(() => import("./NoticeList"));
const FieldManagement = deferredFeature(() => import("./FieldManagement"));
const ScanHistory = deferredFeature(() => import("./ScanHistory"));
const LocalReadout = deferredFeature(() => import("./LocalReadout"));
const OUTCOMES = {
  harvest: ["quantity_kg", "kg"],
  actual_cost: ["cost_inr", "INR"],
  market_sale: ["sale_price_inr_per_kg", "INR/kg"],
  crop_loss: ["loss_percent", "%"],
  irrigation: ["water_litres", "L"],
  fertilizer_action: ["fertilizer_kg", "kg"],
  satisfaction: ["rating", "1–5"],
  advisory_usefulness: ["rating", "1–5"],
};
const PlotHealth = deferredFeature(() => import("./PlotHealth"));
const PURPOSES = [
  "location_processing",
  "satellite_processing",
  "agronomic_analysis",
  "model_improvement",
  "pilot_research",
];

function safeSession(action, value) {
  try {
    if (action === "get")
      return JSON.parse(sessionStorage.getItem("krishyak_v2_offline_owner"));
    if (action === "clear")
      sessionStorage.removeItem("krishyak_v2_offline_owner");
    else if (action === "set")
      sessionStorage.setItem(
        "krishyak_v2_offline_owner",
        JSON.stringify(value),
      );
  } catch {
    /* Storage permission failure is shown when offline is enabled. */
  }
  return null;
}

function Field({ label, children }) {
  return (
    <label className="v2-label">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Card({ title, children }) {
  return (
    <section className="v2-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

async function revokeDeviceSession() {
  if (!document.cookie.split("; ").includes("krishyak_logout_pending=yes"))
    return;
  try {
    await farmApi("/auth/session", { retry: false });
    await farmApi("/auth/logout", { method: "POST", retry: false });
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  document.cookie = "krishyak_logout_pending=; Path=/; Max-Age=0; SameSite=Lax";
  setCsrfToken(null);
}

function eventDescription(item) {
  const payload = item.payload;
  if (payload.note) return payload.note;
  if (item.kind === "remote_sensing")
    return `${payload.index?.toUpperCase()} · ${payload.observation?.quality_status || "unavailable"}`;
  if (item.kind === "weather")
    return "Weather model and forecast retrieved; not a field measurement.";
  if (item.kind === "disease_scan")
    return `Crop photograph: ${payload.status || payload.result?.status || "recorded"}. Review model limitations.`;
  if (Array.isArray(payload.measurements))
    return payload.measurements
      .map((row) => `${row.parameter}: ${row.value} ${row.unit}`)
      .join(" · ");
  return "Stored evidence. Review its source and limitations.";
}

export default function FarmWorkspace() {
  const { language } = useTranslation();
  const copy = farmStrings(language);
  const [status, setStatus] = useState(null),
    [farmer, setFarmer] = useState(null);
  const [farms, setFarms] = useState([]),
    [plots, setPlots] = useState([]),
    [selected, setSelected] = useState("");
  const [today, setToday] = useState(null),
    [timeline, setTimeline] = useState([]),
    [cycles, setCycles] = useState([]);
  const [tab, setTab] = useState("today"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine),
    [offlineOpt, setOfflineOpt] = useState(false),
    [pending, setPending] = useState(0);
  const [mobile, setMobile] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(null),
    [policy, setPolicy] = useState(false);
  const [consents, setConsents] = useState([]),
    [farmName, setFarmName] = useState("");
  const [plotName, setPlotName] = useState(""),
    [farmId, setFarmId] = useState(""),
    [area, setArea] = useState("");
  const [vertices, setVertices] = useState([]),
    [boundaryText, setBoundaryText] = useState(""),
    [mapOpen, setMapOpen] = useState(false),
    [drawing, setDrawing] = useState(false),
    [center, setCenter] = useState(null);
  const [note, setNote] = useState(""),
    [kind, setKind] = useState("farmer_observation");
  const [crop, setCrop] = useState("Tomato"),
    [sowing, setSowing] = useState(""),
    [harvest, setHarvest] = useState("");
  const [photo, setPhoto] = useState(null),
    [result, setResult] = useState(null),
    [model, setModel] = useState(null);
  const [outcomeValue, setOutcomeValue] = useState("");
  const [todaySavedAt, setTodaySavedAt] = useState(null);
  const [satelliteRefreshVersion, setSatelliteRefreshVersion] = useState(0);
  const inFlight = useRef(false);
  const generation = useRef(0),
    alive = useRef(true),
    ownerRef = useRef(null);
  ownerRef.current = farmer?.id || null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const plot = plots.find((item) => item.id === selected);
  const resetAccountView = useCallback(() => {
    generation.current++;
    ownerRef.current = null;
    setFarmer(null);
    setFarms([]);
    setPlots([]);
    setSelected("");
    setConsents([]);
    setToday(null);
    setTimeline([]);
    setCycles([]);
    setResult(null);
    setPhoto(null);
    setOfflineOpt(false);
    setPending(0);
    safeSession("clear");
    setCsrfToken(null);
  }, []);

  const refreshEvidence = useCallback(async () => {
    const owner = farmer?.id;
    const field = selected;
    if (!owner || !field) return;
    const [attention, events] = await Promise.all([
      farmApi(`/plots/${field}/today`),
      farmApi(`/plots/${field}/timeline`),
    ]);
    if (ownerRef.current !== owner || selectedRef.current !== field) return;
    setToday(attention);
    setTimeline(events.items);
    if (offlineOpt) {
      await saveRecord(owner, `plot:${field}`, {
        attention,
        events,
        cropCycles: { items: cycles },
      });
    }
  }, [farmer?.id, selected, offlineOpt, cycles]);

  useEffect(() => {
    if (!window.BroadcastChannel) return;
    const channel = new BroadcastChannel("krishyak-v2-session-events");
    channel.onmessage = async (event) => {
      if (
        event.data?.kind === "signed_out" &&
        event.data.owner === ownerRef.current
      ) {
        const owner = ownerRef.current;
        resetAccountView();
        await clearOwner(owner, true).catch(() =>
          setError(
            "Private offline storage could not be cleared. Clear this site’s storage in your browser.",
          ),
        );
      }
    };
    return () => channel.close();
  }, [resetAccountView]);

  useEffect(() => {
    alive.current = true;
    const sequence = generation;
    return () => {
      alive.current = false;
      sequence.current++;
    };
  }, []);

  const act = async (action) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (problem) {
      if (alive.current) setError(problem.message);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const loadFields = useCallback(async (owner, cache) => {
    const [farmData, plotData] = await Promise.all([
      farmApi("/farms?limit=100"),
      farmApi("/plots?limit=100"),
    ]);
    if (!alive.current || ownerRef.current !== owner) return;
    setFarms(farmData.items);
    setPlots(plotData.items);
    setFarmId((previous) => previous || farmData.items[0]?.id || "");
    setSelected((previous) =>
      plotData.items.some((item) => item.id === previous)
        ? previous
        : plotData.items[0]?.id || "",
    );
    if (cache)
      await saveRecord(owner, "fields", {
        selected: plotData.items.some((item) => item.id === selectedRef.current)
          ? selectedRef.current
          : plotData.items[0]?.id,
        farms: farmData.items,
        plots: plotData.items,
      });
  }, []);

  const loadConsents = useCallback(async () => {
    const owner = ownerRef.current;
    const response = await farmApi("/consents");
    if (alive.current && ownerRef.current === owner)
      setConsents(
        response.items
          .filter((item) => !item.withdrawn_at)
          .map((item) => item.purpose),
      );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const provider = await farmApi("/status");
        if (cancelled) return;
        setStatus(provider);
        if (provider.enabled) {
          await revokeDeviceSession();
          try {
            const session = await restoreFarmSession();
            if (cancelled) return;
            ownerRef.current = session.farmer.id;
            activateOwner(session.farmer.id);
            setFarmer(session.farmer);
            setCsrfToken(session.csrf_token);
            const stored = safeSession("get");
            const caching = stored?.owner === session.farmer.id;
            setOfflineOpt(caching);
            await Promise.all([
              loadFields(session.farmer.id, caching),
              loadConsents(),
            ]);
          } catch (problem) {
            if (problem.status !== 401) throw problem;
          }
        }
      } catch (problem) {
        const stored = safeSession("get");
        if (stored?.owner && problem.network) {
          const saved = await readRecord(stored.owner, "fields").catch(
            () => null,
          );
          if (saved && !cancelled) {
            setFarmer({ id: stored.owner, display_name: stored.display_name });
            setFarms(saved.data.farms);
            setPlots(saved.data.plots);
            setSelected(
              saved.data.plots.some((item) => item.id === saved.data.selected)
                ? saved.data.selected
                : saved.data.plots[0]?.id || "",
            );
            setOffline(true);
            setOfflineOpt(true);
            setNotice(
              `${copy.updated}: ${new Date(saved.saved_at).toLocaleString()}`,
            );
          }
        } else if (!cancelled) setError(problem.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [loadFields, loadConsents, copy.updated]);

  const sync = useCallback(async () => {
    if (!farmer) return;
    // Revalidate identity before sending any queued private data.
    const session = await farmApi("/me");
    if (session.farmer.id !== farmer.id)
      throw new Error(
        "The signed-in account changed. Sign out before synchronizing.",
      );
    if (ownerRef.current !== farmer.id) return;
    setFarmer(session.farmer);
    await loadConsents();
    const response = await synchronize(farmer.id, farmApi);
    if (alive.current) {
      setPending(response.pending);
      setOffline(false);
    }
    if (response.error) throw response.error;
    await loadFields(farmer.id, offlineOpt);
  }, [farmer, offlineOpt, loadFields, loadConsents]);

  useEffect(() => {
    const disconnected = () => setOffline(true);
    const connected = () => {
      setOffline(false);
      revokeDeviceSession()
        .then(sync)
        .catch((problem) => setError(problem.message));
    };
    window.addEventListener("offline", disconnected);
    window.addEventListener("online", connected);
    return () => {
      window.removeEventListener("offline", disconnected);
      window.removeEventListener("online", connected);
    };
  }, [sync]);

  useEffect(() => {
    if (!farmer || (!offline && !pending)) return;
    let checking = false;
    const retry = async () => {
      if (checking || document.hidden || ownerRef.current !== farmer.id) return;
      checking = true;
      try {
        await revokeDeviceSession();
        await sync();
      } catch (problem) {
        if (!problem.network) setError(problem.message);
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(retry, 10000);
    window.addEventListener("focus", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", retry);
    };
  }, [farmer, offline, pending, sync]);

  useEffect(() => {
    const request = ++generation.current;
    setToday(null);
    setTodaySavedAt(null);
    setTimeline([]);
    setCycles([]);
    setResult(null);
    if (!selected || !farmer) return;
    const update = async () => {
      try {
        const [attention, events, cropCycles] = await Promise.all([
          farmApi(`/plots/${selected}/today`),
          farmApi(`/plots/${selected}/timeline`),
          farmApi(`/plots/${selected}/crop-cycles`),
        ]);
        if (generation.current !== request || !alive.current) return;
        setToday(attention);
        setTimeline(events.items);
        setCycles(cropCycles.items);
        if (cropCycles.items[0]?.crop) setCrop(cropCycles.items[0].crop);
        if (offlineOpt)
          await saveRecord(farmer.id, `plot:${selected}`, {
            attention,
            events,
            cropCycles,
          });
      } catch (problem) {
        const saved = offlineOpt
          ? await readRecord(farmer.id, `plot:${selected}`).catch(() => null)
          : null;
        if (generation.current !== request || !alive.current) return;
        if (saved && problem.network) {
          setTodaySavedAt(saved.saved_at);
          setToday(saved.data.attention);
          setTimeline(saved.data.events.items);
          setCycles(saved.data.cropCycles.items);
          setOffline(true);
        } else setError(problem.message);
      }
      setPending((await pendingOperations(farmer.id).catch(() => [])).length);
    };
    update();
  }, [selected, farmer, offlineOpt]);

  useEffect(() => {
    if (tab === "health")
      farmApi("/model")
        .then(setModel)
        .catch((problem) => setError(problem.message));
  }, [tab]);

  const submitNote = () =>
    act(async () => {
      if (!selected || !note.trim()) return;
      const operation = {
        operation_id: crypto.randomUUID(),
        path: `/plots/${selected}/observations`,
        body: {
          operation_id: crypto.randomUUID(),
          kind,
          observed_at: new Date().toISOString(),
          note: note.trim(),
          ...(OUTCOMES[kind] && outcomeValue !== ""
            ? {
                measurements: { [OUTCOMES[kind][0]]: Number(outcomeValue) },
                unit: OUTCOMES[kind][1],
              }
            : {}),
        },
      };
      operation.body.operation_id = operation.operation_id;
      try {
        if (!navigator.onLine) {
          const problem = new Error();
          problem.network = true;
          throw problem;
        }
        await farmApi(operation.path, { method: "POST", body: operation.body });
        const events = await farmApi(`/plots/${selected}/timeline`);
        if (ownerRef.current === farmer.id && selectedRef.current === selected)
          setTimeline(events.items);
      } catch (problem) {
        if (!problem.network || !offlineOpt) throw problem;
        await queueOperation(farmer.id, operation);
        setPending((value) => value + 1);
        setNotice(copy.queued);
      }
      setNote("");
      setOutcomeValue("");
    });

  const signOut = () =>
    act(async () => {
      if (
        pending &&
        !window.confirm(
          "Pending observations on this device will be removed. Continue signing out?",
        )
      )
        return;
      const owner = farmer.id;
      let revokeError = null;
      try {
        document.cookie = `krishyak_logout_pending=yes; Path=/; Max-Age=604800; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
        if (navigator.onLine) await revokeDeviceSession();
      } catch (problem) {
        revokeError = problem;
      }
      resetAccountView();
      if (window.BroadcastChannel) {
        const channel = new BroadcastChannel("krishyak-v2-session-events");
        channel.postMessage({ kind: "signed_out", owner });
        channel.close();
      }
      await clearOwner(owner, true);
      if (!navigator.onLine || revokeError)
        setNotice(
          "Private data was cleared from this device. Reconnect to revoke the server session; sign-in resumes after revocation.",
        );
    });

  const enableOffline = (enabled) => {
    if (
      !enabled &&
      pending &&
      !window.confirm(
        "Turning off offline storage removes pending observations. Continue?",
      )
    )
      return;
    setOfflineOpt(enabled);
    return act(async () => {
      try {
        if (enabled) {
          await saveRecord(farmer.id, "fields", { farms, plots, selected });
          if (selected && today)
            await saveRecord(farmer.id, `plot:${selected}`, {
              attention: today,
              events: { items: timeline },
              cropCycles: { items: cycles },
            });
          safeSession("set", {
            owner: farmer.id,
            display_name: farmer.display_name,
          });
        } else {
          await clearOwner(farmer.id);
          safeSession("clear");
          setPending(0);
        }
      } catch (problem) {
        setOfflineOpt(!enabled);
        throw problem;
      }
    });
  };

  return (
    <div className="v2-shell">
      <a href="#farm-content" className="v2-skip">
        Skip to field content
      </a>
      <header className="v2-header">
        <a href="/farm" className="v2-brand">
          Krishyak <span>{copy.title}</span>
        </a>
        <LanguageSelector />
        {farmer && (
          <button disabled={busy} onClick={signOut}>
            {copy.logout}
          </button>
        )}
      </header>
      <main id="farm-content" className="v2-main">
        <p className="v2-eyebrow">OBSERVE · UNDERSTAND · VERIFY IN THE FIELD</p>
        <h1>{farmer ? `${copy.attention}` : copy.signin}</h1>
        <p>{copy.subtitle}</p>
        {!["en", "hi"].includes(language) && (
          <p role="status" className="v2-notice">
            New farm workflows use English in this language. Translation review
            is pending.
          </p>
        )}
        {status?.development_identity && (
          <p className="v2-notice" role="status">
            {copy.development}
          </p>
        )}
        {error && (
          <div role="alert" className="v2-error">
            {error}{" "}
            <button onClick={() => window.location.reload()}>
              {copy.retry}
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="v2-notice">
            {notice}
          </p>
        )}
        {offline && (
          <p role="status" className="v2-notice">
            {copy.offline}. {copy.offlineLimit}
          </p>
        )}
        {loading ? (
          <p role="status">{copy.loading}</p>
        ) : !farmer ? (
          <Card title={copy.signin}>
            {status?.enabled && status?.otp_available ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  act(async () => {
                    await revokeDeviceSession();
                    if (!challenge)
                      setChallenge(
                        await farmApi("/auth/request-otp", {
                          method: "POST",
                          body: {
                            mobile: mobile.startsWith("+")
                              ? mobile
                              : `+91${mobile}`,
                          },
                        }),
                      );
                    else {
                      const session = await farmApi("/auth/verify-otp", {
                        method: "POST",
                        body: {
                          challenge_id: challenge.challenge_id,
                          code,
                          accept_policy_version: "2026-10-03",
                        },
                      });
                      const stored = safeSession("get");
                      if (stored?.owner && stored.owner !== session.farmer.id) {
                        await clearOwner(stored.owner);
                        safeSession("clear");
                      }
                      ownerRef.current = session.farmer.id;
                      activateOwner(session.farmer.id);
                      setFarmer(session.farmer);
                      setCode("");
                      setChallenge(null);
                      await Promise.all([
                        loadFields(session.farmer.id, false),
                        loadConsents(),
                      ]);
                    }
                  });
                }}
              >
                <Field label={copy.mobile}>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={mobile}
                    disabled={Boolean(challenge)}
                    onChange={(event) => setMobile(event.target.value)}
                    required
                    pattern="(\+91)?[6-9][0-9]{9}"
                    placeholder="+91"
                  />
                </Field>
                {challenge && (
                  <Field label={copy.code}>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      required
                      pattern="[0-9]{6}"
                    />
                  </Field>
                )}
                <label className="v2-check">
                  <input
                    type="checkbox"
                    checked={policy}
                    onChange={(event) => setPolicy(event.target.checked)}
                    required
                  />
                  {copy.policy}
                </label>
                <p>
                  <a href="/privacy">Privacy Policy</a> ·{" "}
                  <a href="/terms">Terms</a>
                </p>
                <button className="v2-primary" disabled={busy || !policy}>
                  {challenge ? copy.verify : copy.request}
                </button>
                {challenge && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setChallenge(null);
                      setCode("");
                    }}
                  >
                    Change number / request a new code
                  </button>
                )}
              </form>
            ) : (
              <p>{copy.unavailable}</p>
            )}
            <a href="/planning">{copy.planning} →</a>
          </Card>
        ) : (
          <>
            <nav className="v2-nav" aria-label="Farm navigation">
              {[
                "today",
                "farms",
                "health",
                "market",
                "benefits",
                "privacy",
              ].map((item) => (
                <button
                  key={item}
                  aria-current={tab === item ? "page" : undefined}
                  onClick={() => setTab(item)}
                >
                  {copy[item]}
                </button>
              ))}
              <a href="/planning">{copy.planning}</a>
              {["admin", "organisation_admin", "agronomist"].includes(
                farmer.role,
              ) && (
                <button onClick={() => setTab("institution")}>
                  Institutional workspace
                </button>
              )}
            </nav>
            <div className="v2-field-bar">
              <Field label={copy.select}>
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">—</option>
                  {plots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="v2-check">
                <input
                  type="checkbox"
                  checked={offlineOpt}
                  disabled={busy}
                  onChange={(event) => enableOffline(event.target.checked)}
                />
                {copy.offlineOpt}
              </label>
              {pending > 0 && (
                <button disabled={busy} onClick={() => act(sync)}>
                  {copy.sync} ({pending})
                </button>
              )}
            </div>
            <PendingPanel
              owner={farmer.id}
              count={pending}
              onChanged={setPending}
            />
            {tab === "today" && (
              <>
                <Card title={plot?.name || copy.empty}>
                  {todaySavedAt && (
                    <p>
                      Saved on this device:{" "}
                      {new Date(todaySavedAt).toLocaleString()}. Advice and
                      freshness labels reflect that saved snapshot; confirm
                      current conditions before acting.
                    </p>
                  )}
                  {today && (
                    <LocalReadout
                      text={today.actions
                        .map(
                          (action) =>
                            `${action.title}. ${action.why}. Source: ${action.evidence.source}. ${action.evidence.limitations.join(". ")}`,
                        )
                        .join(". ")}
                    />
                  )}
                  {today?.actions?.map((action, index) => (
                    <article className="v2-action" key={index}>
                      <h3>{action.title}</h3>
                      <details>
                        <summary>{copy.why}</summary>
                        <p>{action.why}</p>
                        <p>
                          {copy.source}: {action.evidence.source} ·{" "}
                          {action.evidence.freshness}
                        </p>
                        {action.evidence.observed_at && (
                          <time>
                            {new Date(
                              action.evidence.observed_at,
                            ).toLocaleString()}
                          </time>
                        )}
                        <ul>
                          {action.evidence.limitations.map((limit) => (
                            <li key={limit}>{limit}</li>
                          ))}
                        </ul>
                      </details>
                    </article>
                  ))}
                  {today && !today.actions.length && <p>{copy.noActions}</p>}
                  <p>
                    {copy.latest}:{" "}
                    <strong>{today?.satellite_status || copy.unknown}</strong>
                  </p>
                  {plot && (
                    <button
                      disabled={
                        busy ||
                        offline ||
                        !plot.boundary ||
                        !consents.includes("location_processing") ||
                        !consents.includes("satellite_processing") ||
                        status?.satellite_configuration !== "ready"
                      }
                      onClick={() =>
                        act(async () => {
                          await farmApi(
                            `/plots/${selected}/remote-sensing/refresh`,
                            {
                              method: "POST",
                              body: { operation_id: crypto.randomUUID() },
                            },
                          );
                          setSatelliteRefreshVersion((value) => value + 1);
                          setNotice(
                            "Satellite request queued. The timeline updates after processing.",
                          );
                        })
                      }
                    >
                      {copy.refresh}
                    </button>
                  )}
                </Card>
                {plot && (
                  <Card title={copy.observations}>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitNote();
                      }}
                    >
                      <Field label={copy.kind}>
                        <select
                          value={kind}
                          onChange={(event) => {
                            setKind(event.target.value);
                            setOutcomeValue("");
                          }}
                        >
                          {[
                            "farmer_observation",
                            "soil",
                            "pest_report",
                            "irrigation",
                            "fertilizer_action",
                            "harvest",
                            "market_sale",
                            "advisory_acknowledgement",
                            "follow_up",
                            "crop_loss",
                            "actual_cost",
                            "treatment_action",
                            "satisfaction",
                            "advisory_usefulness",
                          ].map((type) => (
                            <option key={type} value={type}>
                              {type.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {OUTCOMES[kind] && (
                        <Field
                          label={`Optional reported ${OUTCOMES[kind][0].replaceAll("_", " ")} (${OUTCOMES[kind][1]})`}
                        >
                          <input
                            type="number"
                            step="any"
                            min={
                              ["satisfaction", "advisory_usefulness"].includes(
                                kind,
                              )
                                ? 1
                                : 0
                            }
                            max={
                              kind === "crop_loss"
                                ? 100
                                : [
                                      "satisfaction",
                                      "advisory_usefulness",
                                    ].includes(kind)
                                  ? 5
                                  : 1000000000
                            }
                            value={outcomeValue}
                            onChange={(event) =>
                              setOutcomeValue(event.target.value)
                            }
                          />
                        </Field>
                      )}
                      <Field label={copy.note}>
                        <textarea
                          value={note}
                          maxLength={2000}
                          required
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </Field>
                      <button
                        className="v2-primary"
                        disabled={
                          busy ||
                          (!consents.includes("agronomic_analysis") && !offline)
                        }
                      >
                        {copy.record}
                      </button>
                      {!consents.includes("agronomic_analysis") && !offline && (
                        <p>
                          Enable agronomic analysis in Privacy to record field
                          evidence.
                        </p>
                      )}
                    </form>
                  </Card>
                )}
                {plot && (
                  <Card title={copy.timeline}>
                    {timeline.length ? (
                      timeline.map((item) => (
                        <article className="v2-event" key={item.id}>
                          <h3>{item.kind.replaceAll("_", " ")}</h3>
                          <time>
                            {new Date(item.observed_at).toLocaleString()}
                          </time>
                          <p>{eventDescription(item)}</p>
                          <p>
                            {copy.source}: {item.source_type} · {item.source}
                          </p>
                        </article>
                      ))
                    ) : (
                      <p>{copy.unknown}</p>
                    )}
                    {timeline.length > 0 && timeline.length % 20 === 0 && (
                      <button
                        disabled={busy || offline}
                        onClick={() =>
                          act(async () => {
                            const records = await farmApi(
                              `/plots/${selected}/timeline?offset=${timeline.length}`,
                            );
                            setTimeline((values) => [
                              ...values,
                              ...records.items,
                            ]);
                          })
                        }
                      >
                        Load earlier observations
                      </button>
                    )}
                  </Card>
                )}
                <NoticeList
                  owner={farmer.id}
                  act={act}
                  busy={busy}
                  offline={offline}
                />
              </>
            )}
            {tab === "institution" && (
              <InstitutionConsole farmer={farmer} act={act} busy={busy} />
            )}
            {tab === "farms" && (
              <div className="v2-grid">
                <Card title={copy.createFarm}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      act(async () => {
                        const savedFarm = await farmApi("/farms", {
                          method: "POST",
                          body: {
                            operation_id: crypto.randomUUID(),
                            name: farmName,
                          },
                        });
                        setFarmId(savedFarm.id);
                        setFarmName("");
                        await loadFields(farmer.id, offlineOpt);
                      });
                    }}
                  >
                    <Field label={copy.farmName}>
                      <input
                        value={farmName}
                        maxLength={100}
                        required
                        onChange={(event) => setFarmName(event.target.value)}
                      />
                    </Field>
                    <button disabled={busy || offline} className="v2-primary">
                      {copy.createFarm}
                    </button>
                  </form>
                </Card>
                <Card title={copy.createPlot}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      act(async () => {
                        const boundary =
                          vertices.length >= 3
                            ? {
                                type: "Polygon",
                                coordinates: [[...vertices, vertices[0]]],
                              }
                            : boundaryText.trim()
                              ? JSON.parse(boundaryText)
                              : null;
                        const savedPlot = await farmApi("/plots", {
                          method: "POST",
                          body: {
                            operation_id: crypto.randomUUID(),
                            farm_id: farmId,
                            name: plotName,
                            entered_area_hectares: area ? Number(area) : null,
                            boundary,
                            boundary_quality: boundary
                              ? "approximate"
                              : "manual",
                          },
                        });
                        setPlotName("");
                        setArea("");
                        setVertices([]);
                        setBoundaryText("");
                        setSelected(savedPlot.id);
                        await loadFields(farmer.id, offlineOpt);
                      });
                    }}
                  >
                    <Field label={copy.farm}>
                      <select
                        value={farmId}
                        onChange={(event) => setFarmId(event.target.value)}
                        required
                      >
                        <option value="">—</option>
                        {farms.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={copy.plotName}>
                      <input
                        value={plotName}
                        maxLength={100}
                        required
                        onChange={(event) => setPlotName(event.target.value)}
                      />
                    </Field>
                    <Field label={copy.area}>
                      <input
                        type="number"
                        min="0.01"
                        max="500"
                        step="any"
                        value={area}
                        onChange={(event) => setArea(event.target.value)}
                        required={vertices.length < 3 && !boundaryText.trim()}
                      />
                    </Field>
                    <p>{copy.mapPrivacy}</p>
                    <button
                      type="button"
                      onClick={() => setMapOpen((value) => !value)}
                    >
                      {copy.openMap}
                    </button>
                    {mapOpen && (
                      <>
                        <label className="v2-check">
                          <input
                            type="checkbox"
                            checked={drawing}
                            onChange={(event) =>
                              setDrawing(event.target.checked)
                            }
                          />
                          {copy.drawing}
                        </label>
                        <FieldMap
                          vertices={vertices}
                          onVertices={setVertices}
                          drawing={drawing}
                          editing={!drawing}
                          center={center}
                          instructions={copy.drawing}
                          unavailable="Map unavailable. Use manual area or GeoJSON below."
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setVertices((value) => value.slice(0, -1))
                          }
                          disabled={!vertices.length}
                        >
                          {copy.undo}
                        </button>
                        <button type="button" onClick={() => setVertices([])}>
                          {copy.clear}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.geolocation?.getCurrentPosition(
                              (position) =>
                                setCenter([
                                  position.coords.longitude,
                                  position.coords.latitude,
                                ]),
                              () =>
                                setError(
                                  "Location unavailable. Use manual area or map taps.",
                                ),
                            );
                          }}
                        >
                          {copy.gps}
                        </button>
                        <p>{vertices.length} corners</p>
                      </>
                    )}
                    <details>
                      <summary>{copy.boundary}</summary>
                      <textarea
                        aria-label={copy.boundary}
                        value={boundaryText}
                        maxLength={20000}
                        onChange={(event) =>
                          setBoundaryText(event.target.value)
                        }
                      />
                    </details>
                    <button
                      className="v2-primary"
                      disabled={busy || offline || !farmId}
                    >
                      {copy.save}
                    </button>
                  </form>
                </Card>
                {plot && (
                  <Card title={copy.cycle}>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        act(async () => {
                          await farmApi(`/plots/${selected}/crop-cycles`, {
                            method: "POST",
                            body: {
                              operation_id: crypto.randomUUID(),
                              crop,
                              sowing_date: sowing,
                              expected_harvest: harvest,
                              status:
                                sowing > new Date().toISOString().slice(0, 10)
                                  ? "planned"
                                  : "active",
                            },
                          });
                          setCycles(
                            (await farmApi(`/plots/${selected}/crop-cycles`))
                              .items,
                          );
                        });
                      }}
                    >
                      <Field label={copy.crop}>
                        <input
                          value={crop}
                          required
                          onChange={(event) => setCrop(event.target.value)}
                        />
                      </Field>
                      <Field label={copy.sowing}>
                        <input
                          type="date"
                          value={sowing}
                          required
                          onChange={(event) => setSowing(event.target.value)}
                        />
                      </Field>
                      <Field label={copy.harvest}>
                        <input
                          type="date"
                          value={harvest}
                          required
                          onChange={(event) => setHarvest(event.target.value)}
                        />
                      </Field>
                      <button disabled={busy || offline} className="v2-primary">
                        {copy.addCycle}
                      </button>
                    </form>
                    {cycles.map((cycle) => (
                      <p key={cycle.id}>
                        {cycle.crop} · {cycle.sowing_date} →{" "}
                        {cycle.expected_harvest}
                      </p>
                    ))}
                  </Card>
                )}
                <Card title={copy.farms}>
                  {plots.map((item) => (
                    <article key={item.id}>
                      <h3>{item.name}</h3>
                      <p>
                        {item.area_hectares || item.entered_area_hectares} ha ·{" "}
                        {item.boundary_quality === "manual"
                          ? copy.manual
                          : item.boundary_quality}
                      </p>
                      <button
                        onClick={() => {
                          setSelected(item.id);
                          setTab("today");
                        }}
                      >
                        View field
                      </button>
                    </article>
                  ))}
                  {plots.length > 0 && plots.length % 100 === 0 && (
                    <button
                      disabled={busy || offline}
                      onClick={() =>
                        act(async () => {
                          const response = await farmApi(
                            `/plots?offset=${plots.length}&limit=100`,
                          );
                          setPlots((values) => [...values, ...response.items]);
                        })
                      }
                    >
                      Load more fields
                    </button>
                  )}
                </Card>
                <FieldManagement
                  farms={farms}
                  plot={plot}
                  cycles={cycles}
                  busy={busy}
                  offline={offline}
                  act={act}
                  reload={() => loadFields(farmer.id, offlineOpt)}
                  reloadCycles={async () =>
                    setCycles(
                      (await farmApi(`/plots/${selected}/crop-cycles`)).items,
                    )
                  }
                />
              </div>
            )}
            {tab === "today" && plot && (
              <PlotHealth
                refreshToken={satelliteRefreshVersion}
                onUpdated={refreshEvidence}
                providerStatus={status?.satellite_configuration}
                key={`health:${selected}`}
                plot={plot}
                owner={farmer.id}
                consents={consents}
                cache={offlineOpt}
                offline={offline}
                busy={busy}
                act={act}
              />
            )}
            {["today", "farms"].includes(tab) && plot && (
              <PlotContext
                key={selected}
                plot={plot}
                owner={farmer.id}
                cache={offlineOpt}
                consents={consents}
                offline={offline}
                act={act}
                busy={busy}
                onUpdated={refreshEvidence}
              />
            )}
            {tab === "health" && (
              <Card title={copy.health}>
                {model && (
                  <details>
                    <summary>
                      {model.release.architecture} · {model.release.classes}{" "}
                      classes
                    </summary>
                    <p>
                      Internal test:{" "}
                      {(model.release.metrics.test.accuracy * 100).toFixed(2)}%;
                      external PlantDoc:{" "}
                      {(
                        model.release.metrics.external_test.accuracy * 100
                      ).toFixed(2)}
                      %.
                    </p>
                    <p>Supported crops: {model.supported_crops.join(", ")}</p>
                    <p>{copy.modelLimit}</p>
                  </details>
                )}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    act(async () => {
                      const data = new FormData();
                      data.set("operation_id", crypto.randomUUID());
                      data.set("plot_id", selected);
                      data.set("crop", crop);
                      if (!photo || photo.size > 4 * 1000000)
                        throw new Error(
                          "Choose a photograph smaller than 4 MB. This keeps uploads within the deployed gateway limit.",
                        );
                      data.set("image", photo);
                      const scan = await farmApi("/disease-scans", {
                        method: "POST",
                        body: data,
                      });
                      if (
                        ownerRef.current === farmer.id &&
                        selectedRef.current === selected
                      )
                        setResult(scan);
                    });
                  }}
                >
                  <Field label={copy.crop}>
                    <input
                      value={crop}
                      required
                      onChange={(event) => setCrop(event.target.value)}
                    />
                  </Field>
                  <Field label={copy.photo}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      required
                      onChange={(event) => {
                        setPhoto(event.target.files[0]);
                        setResult(null);
                      }}
                    />
                  </Field>
                  <button
                    disabled={
                      busy ||
                      offline ||
                      !selected ||
                      !consents.includes("agronomic_analysis")
                    }
                    className="v2-primary"
                  >
                    {copy.scan}
                  </button>
                </form>
                {result && (
                  <article aria-live="polite">
                    <h3>{result.result.status}</h3>
                    <p>{result.result.predicted_class}</p>
                    {result.result.model_score != null && (
                      <p>
                        {copy.modelScore}:{" "}
                        {result.result.model_score.toFixed(3)}
                      </p>
                    )}
                    <p>{copy.modelLimit}</p>
                    <h3>{copy.feedback}</h3>
                    {["yes", "no", "unsure"].map((verdict) => (
                      <button
                        key={verdict}
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            await farmApi("/feedback", {
                              method: "POST",
                              body: {
                                operation_id: crypto.randomUUID(),
                                image_id: result.image_id,
                                verdict,
                              },
                            });
                            setNotice("Feedback saved.");
                          })
                        }
                      >
                        {copy[verdict]}
                      </button>
                    ))}
                  </article>
                )}
              </Card>
            )}
            {tab === "health" && (
              <Card title="Photograph history">
                <ScanHistory
                  plotId={selected}
                  refresh={result?.image_id}
                  act={act}
                  busy={busy}
                  offline={offline}
                />
              </Card>
            )}
            {tab === "market" && (
              <>
                <MandiPriceCard
                  commodity={crop}
                  state={farmer.state}
                  district={farmer.district}
                />
                <MSPRateCard primaryCrop={crop} />
              </>
            )}
            {tab === "benefits" && <BenefitsPanel />}
            {tab === "privacy" && (
              <Card title={copy.consent}>
                <AccountDetails
                  farmer={farmer}
                  language={language}
                  plots={plots}
                  consents={consents}
                  act={act}
                  busy={busy}
                  offline={offline}
                  onUpdated={(updated) => {
                    if (ownerRef.current === updated.id) setFarmer(updated);
                  }}
                />
                {PURPOSES.map((purpose) => (
                  <label key={purpose} className="v2-check">
                    <input
                      type="checkbox"
                      checked={consents.includes(purpose)}
                      disabled={busy || offline}
                      onChange={(event) => {
                        const granted = event.target.checked;
                        const previous = consents;
                        setConsents((values) =>
                          granted
                            ? [...values, purpose]
                            : values.filter((value) => value !== purpose),
                        );
                        act(async () => {
                          try {
                            await farmApi("/consents", {
                              method: "POST",
                              body: {
                                purpose,
                                granted,
                                policy_version: "2026-10-03",
                              },
                            });
                            await loadConsents();
                          } catch (problem) {
                            setConsents(previous);
                            throw problem;
                          }
                        });
                      }}
                    />
                    {purpose.replaceAll("_", " ")}
                    {["model_improvement", "pilot_research"].includes(purpose)
                      ? " (optional)"
                      : ""}
                  </label>
                ))}
                <p>
                  Model improvement consent is separate from basic crop
                  analysis. Withdrawal stops future research linkage and review.
                </p>
                <button
                  disabled={busy || offline}
                  onClick={() =>
                    act(async () => {
                      const data = await farmApi("/me/export");
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(data, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const anchor = document.createElement("a");
                      anchor.href = url;
                      anchor.download = "krishyak-account.json";
                      anchor.click();
                      URL.revokeObjectURL(url);
                    })
                  }
                >
                  {copy.export}
                </button>
                <button
                  className="v2-danger"
                  disabled={busy || offline}
                  onClick={() =>
                    act(async () => {
                      if (!window.confirm(copy.deleteWarning)) return;
                      await farmApi("/me", { method: "DELETE" });
                      await clearOwner(farmer.id);
                      safeSession("clear");
                      setCsrfToken(null);
                      window.location.reload();
                    })
                  }
                >
                  {copy.delete}
                </button>
                <p>
                  <a href="/privacy">Privacy Policy</a> ·{" "}
                  <a href="/terms">Terms</a> · Legal review required before
                  commercial rollout.
                </p>
              </Card>
            )}
          </>
        )}
      </main>
      <footer className="v2-footer">
        Plot-level decision support for Indian farmers. Observations and
        simulations need field verification.
      </footer>
    </div>
  );
}
