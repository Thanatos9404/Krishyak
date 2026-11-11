import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  EyeOff,
  FileCheck2,
  Satellite,
  Users,
} from "lucide-react";
import { farmApi } from "../../features/farms/api";
import { ConsentPrompt } from "../../features/farms/ConsentPrompt";
import { useProductLocale } from "../../features/product/ProductLocale";
import { cropLabel, findCrop } from "../../features/product/crops";

export const VERDICTS = {
  consistent: ["The satellite record matches what was declared.", "good"],
  needs_review: ["A person needs to look at this check.", "review"],
  not_enough_evidence: ["Not enough clear satellite views yet.", "wait"],
  too_early: [
    "It is too early after sowing for the satellite to see the crop.",
    "wait",
  ],
};
export const REASONS = {
  crop_growth_after_declared_sowing:
    "The field turned green after the declared sowing date.",
  crop_growth_not_visible_yet: "Crops take about a month to show from space.",
  no_clear_view_since_sowing: "Cloud has hidden the field since sowing.",
  satellite_check_running:
    "The satellite views are still being fetched. Open this again in a few minutes.",
  green_before_declared_sowing:
    "The field was already green before the declared sowing date.",
  no_crop_growth_seen:
    "The satellite did not see crop growth after the declared sowing date.",
  growth_signal_unclear: "The growth signal is not clear enough to say.",
  mapped_area_differs_from_declared:
    "The mapped area differs from the declared area by more than a quarter.",
};
export const PURPOSES = {
  crop_loan: "Crop loan",
  crop_insurance: "Crop insurance",
  other: "Other",
};

function CodeEntry({ label, onFound, lookup, disabled }) {
  const { tx } = useProductLocale();
  const [code, setCode] = useState(""),
    [problem, setProblem] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="code-entry"
      data-voice-controls="own"
      onSubmit={async (event) => {
        event.preventDefault();
        setProblem("");
        setBusy(true);
        try {
          onFound(
            code.trim().toUpperCase(),
            await lookup(code.trim().toUpperCase()),
          );
        } catch (error) {
          setProblem(
            error.status === 404
              ? "This code was not found. Check it and try again."
              : error.status === 429
                ? "Too many tries. Please wait an hour."
                : "The code could not be checked. Please retry.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="v2-label">
        {tx(label)}
        <input
          value={code}
          dir="ltr"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          minLength={8}
          maxLength={12}
          placeholder="ABCD2345"
          onChange={(event) =>
            setCode(event.target.value.replace(/[^A-Za-z0-9]/g, ""))
          }
        />
      </label>
      <button
        className="button primary"
        disabled={disabled || busy || code.trim().length < 8}
      >
        {tx("Check code")}
      </button>
      {problem && (
        <p role="alert" className="error-panel inline">
          {tx(problem)}
        </p>
      )}
    </form>
  );
}

function SharedLists({ shared, never }) {
  const { tx } = useProductLocale();
  return (
    <div className="shared-lists">
      <div>
        <h3>
          <Check size={18} aria-hidden="true" /> {tx("They will see")}
        </h3>
        <ul>
          {shared.map((item) => (
            <li key={item}>{tx(item)}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3>
          <EyeOff size={18} aria-hidden="true" /> {tx("They will never see")}
        </h3>
        <ul>
          {never.map((item) => (
            <li key={item}>{tx(item)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Share chosen fields with the farmer's FPO or cooperative.
export function GroupView({ workspace: w }) {
  const { tx } = useProductLocale();
  const [mine, setMine] = useState(null),
    [found, setFound] = useState(null),
    [picked, setPicked] = useState([]);
  const load = useCallback(
    () =>
      farmApi("/groups/mine")
        .then(setMine)
        .catch(() => setMine({ items: [], shared: [], never_shared: [] })),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const allowed = w.consents.includes("organisation_sharing");
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("My farmer group")}</h1>
        <p>
          {tx(
            "Share chosen fields with your FPO or cooperative, so it can warn and help its members faster.",
          )}
        </p>
      </header>
      {mine?.items.length > 0 && (
        <section className="product-card" aria-labelledby="my-groups">
          <h2 id="my-groups">
            <Users size={22} aria-hidden="true" /> {tx("Groups you share with")}
          </h2>
          <ul className="claim-list">
            {mine.items.map((group) => (
              <li key={group.id}>
                <div>
                  <Building2 size={24} aria-hidden="true" />
                  <span>
                    <strong>{group.name}</strong>
                    {group.district} ·{" "}
                    {tx("{{v0}} fields shared", { v0: group.plot_ids.length })}
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={w.busy}
                    onClick={() =>
                      w.act(async () => {
                        await farmApi(`/pilot-enrollments/${group.id}`, {
                          method: "DELETE",
                        });
                        await load();
                        w.setNotice(
                          "You left the group. It can no longer see your fields.",
                        );
                      })
                    }
                  >
                    {tx("Stop sharing")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="product-card" aria-labelledby="join-group">
        <h2 id="join-group">{tx("Join a group")}</h2>
        <p>{tx("Ask your group for its 8-letter Krishyak code.")}</p>
        <CodeEntry
          label="Group code"
          disabled={w.offline}
          lookup={(code) =>
            farmApi(`/groups/lookup?code=${encodeURIComponent(code)}`)
          }
          onFound={(code, group) => {
            setFound({ code, ...group });
            setPicked(w.plots.map((plot) => plot.id));
          }}
        />
        {found && (
          <div className="share-review">
            <h3>
              {found.name} · {found.district}
            </h3>
            <p>{tx("Run by {{v0}}", { v0: found.organiser })}</p>
            <SharedLists shared={found.shared} never={found.never_shared} />
            {w.plots.length ? (
              <fieldset className="setup-choice">
                <legend>{tx("Fields to share")}</legend>
                {w.plots.map((plot) => (
                  <label key={plot.id}>
                    <input
                      type="checkbox"
                      checked={picked.includes(plot.id)}
                      onChange={(event) =>
                        setPicked((values) =>
                          event.target.checked
                            ? [...values, plot.id]
                            : values.filter((id) => id !== plot.id),
                        )
                      }
                    />
                    {plot.name}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="inline-note">
                {tx("Add a field first.")}{" "}
                <a href="/app/setup">{tx("Tell Krishyak about your farm")}</a>
              </p>
            )}
            <ConsentPrompt
              workspace={w}
              purposes={["organisation_sharing"]}
              title="Allow sharing with my group"
              reason="Your group's organiser will see the fields you pick, as listed above. You can stop sharing at any time here or in Settings."
            >
              <button
                type="button"
                className="button primary large"
                disabled={w.busy || w.offline || !picked.length || !allowed}
                onClick={() =>
                  w.act(async () => {
                    await farmApi("/groups/join", {
                      method: "POST",
                      body: { code: found.code, plot_ids: picked },
                    });
                    setFound(null);
                    await load();
                    w.setNotice("You joined the group.");
                  })
                }
              >
                {tx("Join and share these fields")}
              </button>
            </ConsentPrompt>
          </div>
        )}
      </section>
    </>
  );
}

export function VerdictBadge({ verdict }) {
  const { tx } = useProductLocale();
  const [text, tone] = VERDICTS[verdict] || VERDICTS.not_enough_evidence;
  return <p className={`verdict verdict-${tone}`}>{tx(text)}</p>;
}

// Answer a lender's or insurer's farm check for one field.
export function VerifyView({ workspace: w }) {
  const { tx, formatDate } = useProductLocale();
  const [mine, setMine] = useState(null),
    [found, setFound] = useState(null),
    [field, setField] = useState("");
  const load = useCallback(
    () =>
      farmApi("/verifications/mine")
        .then(setMine)
        .catch(() => setMine({ items: [] })),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  const mapped = w.plots.filter((plot) => plot.boundary);
  return (
    <>
      <header className="home-greeting">
        <h1>{tx("Farm check for a loan or insurance")}</h1>
        <p>
          {tx(
            "Your bank or insurer can ask Krishyak to check one field from space. Nothing is shared until you agree here.",
          )}
        </p>
      </header>
      <section className="product-card" aria-labelledby="verify-code">
        <h2 id="verify-code">
          <FileCheck2 size={22} aria-hidden="true" />{" "}
          {tx("Enter the code they gave you")}
        </h2>
        <CodeEntry
          label="Check code"
          disabled={w.offline}
          lookup={(code) =>
            farmApi(`/verifications/lookup/${encodeURIComponent(code)}`)
          }
          onFound={(code, request) => {
            setFound({ code, ...request });
            setField(mapped[0]?.id || "");
          }}
        />
        {found && (
          <div className="share-review">
            <h3>
              {found.requester} · {tx(PURPOSES[found.purpose])}
            </h3>
            <p>{tx("Their reference: {{v0}}", { v0: found.reference })}</p>
            <SharedLists shared={found.shared} never={found.never_shared} />
            <ul className="care-steps">
              {found.limitations.map((item) => (
                <li key={item}>{tx(item)}</li>
              ))}
            </ul>
            {mapped.length ? (
              <fieldset className="setup-choice">
                <legend>{tx("Which field?")}</legend>
                {mapped.map((plot) => (
                  <label key={plot.id}>
                    <input
                      type="radio"
                      name="verify-field"
                      checked={field === plot.id}
                      onChange={() => setField(plot.id)}
                    />
                    {plot.name}
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="inline-note">
                <Satellite size={16} aria-hidden="true" />{" "}
                {tx(
                  "The satellite needs your field's outline. Draw it in My fields first.",
                )}{" "}
                <a href="/app/farm">{tx("Open my fields")}</a>
              </p>
            )}
            <ConsentPrompt
              workspace={w}
              purposes={["location_processing", "satellite_processing"]}
              title="Allow the satellite check"
              reason="Krishyak sends this field's outline to the Copernicus satellite service to read how green it has been since sowing."
            >
              <button
                type="button"
                className="button primary large"
                disabled={w.busy || w.offline || !field}
                onClick={() =>
                  w.act(async () => {
                    await farmApi(`/verifications/${found.code}/accept`, {
                      method: "POST",
                      body: { plot_id: field },
                      timeoutMs: 40000,
                    });
                    setFound(null);
                    await load();
                    w.setNotice(
                      "The check was shared. You can withdraw it at any time.",
                    );
                  })
                }
              >
                {tx("I agree. Share this check")}{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </ConsentPrompt>
          </div>
        )}
      </section>
      {mine?.items.length > 0 && (
        <section className="product-card" aria-labelledby="my-checks">
          <h2 id="my-checks">{tx("Checks you shared")}</h2>
          {mine.items.map((item) => (
            <article className="verify-item" key={item.id}>
              <h3>
                {item.requester} · {tx(PURPOSES[item.purpose])}
              </h3>
              <p>
                {cropLabel(findCrop(item.declared?.crop_id), tx) ||
                  item.declared?.crop}{" "}
                ·{" "}
                {tx("sown {{v0}}", {
                  v0: formatDate(item.declared?.sowing_date),
                })}{" "}
                · {tx("shared {{v0}}", { v0: formatDate(item.accepted_at) })}
              </p>
              {item.result ? (
                <>
                  <VerdictBadge verdict={item.result.verdict} />
                  <p>{tx(REASONS[item.result.reason] || "")}</p>
                </>
              ) : (
                <p>{tx("The satellite check is running.")}</p>
              )}
              <button
                type="button"
                className="button secondary"
                disabled={w.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      tx(
                        "Withdraw this check? They will no longer see the report.",
                      ),
                    )
                  )
                    w.act(async () => {
                      await farmApi(`/verifications/${item.id}`, {
                        method: "DELETE",
                      });
                      await load();
                    });
                }}
              >
                {tx("Withdraw this check")}
              </button>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
