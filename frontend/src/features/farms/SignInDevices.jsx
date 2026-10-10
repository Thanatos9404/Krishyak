import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, Smartphone, Trash2 } from "lucide-react";
import { useProductLocale } from "../product/ProductLocale";
import {
  addThisDevice,
  listDevices,
  newRecoveryCode,
  passkeysSupported,
  removeDevice,
  signInWithPasskey,
} from "./passkeys";
import { RecoveryCodeNotice } from "../../components/product/SignIn";

const date = (value, language) =>
  value
    ? new Intl.DateTimeFormat(language === "en" ? "en-IN" : language, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : null;

export default function SignInDevices({ workspace: w }) {
  const { tx, language } = useProductLocale();
  const [devices, setDevices] = useState(null),
    [code, setCode] = useState(""),
    [problem, setProblem] = useState("");
  const load = useCallback(
    () =>
      listDevices()
        .then(setDevices)
        .catch((error) => setProblem(error.message)),
    [],
  );
  useEffect(() => {
    if (w.status?.passkey_available) load();
  }, [load, w.status?.passkey_available]);
  if (!w.status?.passkey_available) return null;
  // Changing sign-in methods needs a fresh confirmation with the phone lock.
  const sensitive = (task) =>
    w.act(async () => {
      setProblem("");
      try {
        try {
          return await task();
        } catch (error) {
          if (error.status !== 401 || !passkeysSupported()) throw error;
          await w.establish(await signInWithPasskey());
          return await task();
        }
      } catch (error) {
        if (!error.cancelled) setProblem(error.message);
        throw error;
      }
    });
  if (code)
    return (
      <section className="product-card">
        <RecoveryCodeNotice
          code={code}
          doneLabel={tx("Done")}
          onDone={() => {
            setCode("");
            load();
          }}
        />
      </section>
    );
  return (
    <section className="product-card" aria-labelledby="devices-heading">
      <h2 id="devices-heading">{tx("Sign-in devices")}</h2>
      <p>
        {tx(
          "Phones that can open your account with their fingerprint or screen lock. Add a family member's phone so you are never locked out.",
        )}
      </p>
      {devices && (
        <ul className="device-list">
          {devices.items.map((device) => (
            <li key={device.id}>
              <Smartphone size={20} aria-hidden="true" />
              <span>
                <strong>{tx(device.device_label)}</strong>
                <small>
                  {tx("Added")} {date(device.created_at, language)}
                  {device.last_used_at
                    ? ` · ${tx("Last used")} ${date(device.last_used_at, language)}`
                    : ""}
                </small>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label={tx("Remove this device")}
                disabled={w.busy}
                onClick={() =>
                  sensitive(async () => {
                    await removeDevice(device.id);
                    await load();
                  })
                }
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        {passkeysSupported() && (
          <button
            type="button"
            className="button primary"
            disabled={w.busy || w.offline}
            onClick={() =>
              sensitive(async () => {
                setDevices(await addThisDevice());
                await load();
              })
            }
          >
            <Fingerprint size={18} /> {tx("Add this phone")}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          disabled={w.busy || w.offline}
          onClick={() =>
            sensitive(async () =>
              setCode((await newRecoveryCode()).recovery_code),
            )
          }
        >
          <KeyRound size={18} /> {tx("Make a new recovery code")}
        </button>
      </div>
      {devices && !devices.recovery_code_active && (
        <p className="inline-note">
          {tx("You have no recovery code. Make one and keep it on paper.")}
        </p>
      )}
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}
        </p>
      )}
    </section>
  );
}
