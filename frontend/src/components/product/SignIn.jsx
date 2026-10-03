import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { revokeDeviceSession } from "../../features/product/useAccountSession";
import { Photo } from "../public/Photo";

export function SignIn({ workspace: w }) {
  const [mobile, setMobile] = useState(""),
    [code, setCode] = useState(""),
    [challenge, setChallenge] = useState(null),
    [policy, setPolicy] = useState(false);
  return (
    <div className="signin-layout">
      <div className="signin-photo">
        <Photo name="fieldwork" sizes="(max-width: 800px) 100vw, 42vw" />
        <span>Illustrative photograph · field work in Nashik, India</span>
      </div>
      <section className="signin-card">
        <span className="eyebrow">YOUR FARM WORKSPACE</span>
        <h1>A good day starts with a clearer picture.</h1>
        <p>
          Sign in to keep your fields, observations and next steps together.
        </p>
        {w.status?.enabled && w.status.otp_available ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              w.act(async () => {
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
                  await w.establish(session);
                  await w.loadConsents();
                  setCode("");
                  setChallenge(null);
                }
              });
            }}
          >
            <label className="v2-label">
              Mobile number
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                pattern="(\+91)?[6-9][0-9]{9}"
                required
                disabled={Boolean(challenge)}
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
              />
            </label>
            {challenge && (
              <label className="v2-label">
                Six-digit code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </label>
            )}
            <label className="v2-check">
              <input
                type="checkbox"
                required
                checked={policy}
                onChange={(event) => setPolicy(event.target.checked)}
              />
              <span>
                I accept the <a href="/terms">Terms</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </span>
            </label>
            <button className="button primary" disabled={w.busy || !policy}>
              {challenge ? "Verify & continue" : "Send sign-in code"}
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
                Change number or request another code
              </button>
            )}
          </form>
        ) : (
          <div className="status-panel">
            <h2>Account sign-in is unavailable</h2>
            <p>
              The account service has not been enabled here. You can still
              explore the clearly marked demo or use the planning simulator.
            </p>
          </div>
        )}
        <p className="signin-privacy">
          <ShieldCheck size={18} />
          Private records stay in your account. Offline storage is your choice.
        </p>
        <a className="button secondary" href="/demo">
          Explore without an account <ArrowRight size={18} />
        </a>
        <a className="text-link" href="/app/more/planning">
          Open the planning simulator
        </a>
      </section>
    </div>
  );
}
