import { useProductLocale } from "../../features/product/ProductLocale";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Printer,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import {
  createAccount,
  passkeysSupported,
  recoverAccount,
  signInWithPasskey,
} from "../../features/farms/passkeys";
import { revokeDeviceSession } from "../../features/product/useAccountSession";
import { Photo } from "../public/Photo";
import { normalizeIndianMobile } from "../../features/product/india";
import { GovernmentLogin } from "./GovernmentLogin";

function Terms({ checked, onChange }) {
  const { tx } = useProductLocale();
  return (
    <label className="v2-check">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {tx("I accept the")} <a href="/terms">{tx("Terms")}</a> {tx("and")}{" "}
        <a href="/privacy">{tx("Privacy Policy")}</a>.
      </span>
    </label>
  );
}

export function RecoveryCodeNotice({ code, onDone, doneLabel }) {
  const { tx } = useProductLocale();
  const [saved, setSaved] = useState(false);
  return (
    <section className="recovery-card" aria-labelledby="recovery-heading">
      <KeyRound size={28} aria-hidden="true" />
      <h2 id="recovery-heading">{tx("Write down your recovery code")}</h2>
      <p>
        {tx(
          "If you lose or change this phone, this code is the only way back into your account. Keep it on paper, somewhere safe. Do not share it.",
        )}
      </p>
      <output
        className="recovery-code"
        dir="ltr"
        aria-label={tx("Recovery code")}
      >
        {code}
      </output>
      <div className="button-row">
        <button
          type="button"
          className="button secondary"
          onClick={() => window.print()}
        >
          <Printer size={18} /> {tx("Print")}
        </button>
      </div>
      <label className="v2-check">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <span>{tx("I have written down my recovery code")}</span>
      </label>
      <button
        type="button"
        className="button primary large"
        disabled={!saved}
        onClick={onDone}
      >
        {doneLabel || tx("Open my farm")} <ArrowRight size={18} />
      </button>
    </section>
  );
}

function PhoneCode({ w, run }) {
  const { tx } = useProductLocale();
  const [mobile, setMobile] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(null),
    [policy, setPolicy] = useState(false);
  return (
    <form
      className="signin-form"
      onSubmit={(event) => {
        event.preventDefault();
        run(async () => {
          await revokeDeviceSession();
          if (!challenge) {
            setChallenge(
              await farmApi("/auth/request-otp", {
                method: "POST",
                body: { mobile: normalizeIndianMobile(mobile) },
              }),
            );
            return;
          }
          const session = await farmApi("/auth/verify-otp", {
            method: "POST",
            body: {
              challenge_id: challenge.challenge_id,
              code,
              accept_policy_version: "2026-10-03",
            },
          });
          await w.establish(session);
          await w.loadConsents();
          setCode("");
          setChallenge(null);
        });
      }}
    >
      <label className="v2-label">
        {tx("Mobile number")}
        <input
          type="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="98765 43210"
          inputMode="tel"
          maxLength={40}
          minLength={10}
          required
          disabled={Boolean(challenge)}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
        />
      </label>
      {challenge && (
        <label className="v2-label">
          {tx("Six-digit code")}
          <input
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      )}
      <Terms checked={policy} onChange={setPolicy} />
      <button className="button primary large" disabled={w.busy || !policy}>
        {challenge ? tx("Verify & continue") : tx("Send sign-in code")}
        <ArrowRight size={18} />
      </button>
      {challenge && (
        <button
          className="button text"
          type="button"
          disabled={w.busy}
          onClick={() => {
            setChallenge(null);
            setCode("");
          }}
        >
          {tx("Change number or request another code")}
        </button>
      )}
    </form>
  );
}

export function SignIn({ workspace: w }) {
  const { tx, language } = useProductLocale();
  const [mode, setMode] = useState("welcome"),
    [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [policy, setPolicy] = useState(false),
    [recovery, setRecovery] = useState(""),
    [pending, setPending] = useState(null),
    [problem, setProblem] = useState(""),
    [supported, setSupported] = useState(true);
  useEffect(() => setSupported(passkeysSupported()), []);
  const passkeys = Boolean(w.status?.enabled && w.status.passkey_available);
  const otp = Boolean(w.status?.enabled && w.status.otp_available);
  // Errors appear beside the action the farmer just took, not only at the top.
  const run = (task) =>
    w.act(async () => {
      setProblem("");
      try {
        await task();
      } catch (error) {
        if (!error.cancelled) setProblem(error.message);
        throw error;
      }
    });
  const finish = async (session) => {
    await w.establish(session);
    await w.loadConsents();
  };
  if (pending)
    return (
      <div className="signin-layout single">
        <RecoveryCodeNotice
          code={pending.recovery_code}
          onDone={() => run(() => finish(pending))}
        />
      </div>
    );
  return (
    <div className="signin-layout">
      <div className="signin-photo">
        <Photo name="fieldwork" sizes="(max-width: 800px) 100vw, 42vw" />
        <span>
          {tx("Illustrative photograph \xB7 field work in Nashik, India")}
        </span>
      </div>
      <section className="signin-card">
        <span className="eyebrow">{tx("YOUR FARM WORKSPACE")}</span>
        <h1>{tx("Your fields, crops and prices in one place.")}</h1>
        {!passkeys && !otp ? (
          <div className="status-panel">
            <h2>{tx("Account sign-in is unavailable")}</h2>
            <p>
              {tx(
                "The account service has not been enabled here. You can still explore the clearly marked demo or use the planning simulator.",
              )}
            </p>
          </div>
        ) : (
          <>
            {passkeys && !supported && (
              <p className="inline-note">
                {tx(
                  "This browser cannot use fingerprint or screen-lock sign-in. Open Krishyak in Chrome on Android or Safari on iPhone.",
                )}
              </p>
            )}
            {passkeys && supported && mode === "welcome" && (
              <div className="signin-actions">
                <button
                  type="button"
                  className="button primary large"
                  disabled={w.busy}
                  onClick={() =>
                    run(async () => {
                      await revokeDeviceSession();
                      await finish(await signInWithPasskey());
                    })
                  }
                >
                  <Fingerprint size={22} />
                  {tx("Sign in with fingerprint or screen lock")}
                </button>
                <button
                  type="button"
                  className="button secondary large"
                  onClick={() => setMode("create")}
                >
                  <UserPlus size={20} /> {tx("New here? Create my account")}
                </button>
                <button
                  type="button"
                  className="button text"
                  onClick={() => setMode("recover")}
                >
                  {tx("Lost your phone? Use your recovery code")}
                </button>
              </div>
            )}
            {passkeys && supported && mode === "create" && (
              <form
                className="signin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    await revokeDeviceSession();
                    setPending(
                      await createAccount({
                        displayName: name.trim(),
                        contactMobile: contact.trim()
                          ? normalizeIndianMobile(contact)
                          : null,
                        language,
                      }),
                    );
                  });
                }}
              >
                <p>
                  {tx(
                    "Your phone's fingerprint or screen lock will protect your account. No password or SMS is needed.",
                  )}
                </p>
                <label className="v2-label">
                  {tx("Your name")}
                  <input
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="v2-label">
                  {tx("Mobile number (optional)")}
                  <input
                    type="tel"
                    dir="ltr"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="98765 43210"
                    maxLength={40}
                    aria-describedby="contact-hint"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                  />
                </label>
                <small id="contact-hint" className="field-hint">
                  {tx("Saved for your records only. It is not verified.")}
                </small>
                <Terms checked={policy} onChange={setPolicy} />
                <button
                  className="button primary large"
                  disabled={w.busy || !policy || !name.trim()}
                >
                  <Fingerprint size={22} /> {tx("Create account")}
                </button>
                <button
                  type="button"
                  className="button text"
                  onClick={() => setMode("welcome")}
                >
                  {tx("Back")}
                </button>
              </form>
            )}
            {passkeys && mode === "recover" && (
              <form
                className="signin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    await revokeDeviceSession();
                    setPending(await recoverAccount(recovery));
                  });
                }}
              >
                <label className="v2-label">
                  {tx("Recovery code")}
                  <input
                    dir="ltr"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                    required
                    minLength={16}
                    maxLength={40}
                    value={recovery}
                    onChange={(event) => setRecovery(event.target.value)}
                  />
                </label>
                <p className="inline-note">
                  {tx(
                    "After you sign in, add this phone in Settings so you can use your fingerprint next time.",
                  )}
                </p>
                <button className="button primary large" disabled={w.busy}>
                  {tx("Continue")} <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="button text"
                  onClick={() => setMode("welcome")}
                >
                  {tx("Back")}
                </button>
              </form>
            )}
            {otp && (
              <details className="signin-otp" open={!passkeys || undefined}>
                <summary>{tx("Sign in with a code sent by SMS")}</summary>
                <PhoneCode w={w} run={run} />
              </details>
            )}
          </>
        )}
        {problem && (
          <p role="alert" className="error-panel inline">
            {tx(problem)}
          </p>
        )}
        <GovernmentLogin workspace={w} />
        <p className="signin-privacy">
          <ShieldCheck size={18} />
          {tx(
            "Private records stay in your account. Offline storage is your choice.",
          )}
        </p>
        <a className="button secondary" href="/demo">
          {tx("Explore without an account")} <ArrowRight size={18} />
        </a>
        <a className="text-link" href="/app/more/planning">
          {tx("Open the planning simulator")}
        </a>
      </section>
    </div>
  );
}
