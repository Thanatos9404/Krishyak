import { useProductLocale } from "../product/ProductLocale";
import React, { useEffect, useState } from "react";
import { farmApi } from "./api";
export default function AccountDetails({
  farmer,
  language,
  plots,
  consents,
  act,
  busy,
  offline,
  onUpdated,
}) {
  const { tx } = useProductLocale();
  const [profile, setProfile] = useState({
    display_name: farmer.display_name,
    state: farmer.state || "",
    district: farmer.district || "",
    village: farmer.village || "",
  });
  const [enrollments, setEnrollments] = useState([]),
    [cohort, setCohort] = useState(""),
    [selected, setSelected] = useState([]);
  useEffect(() => {
    let cancelled = false;
    farmApi("/pilot-enrollments")
      .then((result) => {
        if (!cancelled) setEnrollments(result.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <>
      <h3>{tx("My account details")}</h3>
      <p>
        {tx(
          "Your mobile number is used for sign-in. You can use a preferred name; location details below are optional.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            const result = await farmApi("/me", {
              method: "PATCH",
              body: {
                ...profile,
                preferred_language: language,
              },
            });
            onUpdated(result.farmer);
          });
        }}
      >
        {["display_name", "state", "district", "village"].map((key) => (
          <label className="v2-label" key={key}>
            {key === "display_name"
              ? tx("Preferred name")
              : key[0].toUpperCase() + key.slice(1)}
            <input
              required={key === "display_name"}
              maxLength={100}
              value={profile[key]}
              onChange={(event) =>
                setProfile((previous) => ({
                  ...previous,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        ))}
        <button disabled={busy || offline}>{tx("Save account details")}</button>
      </form>
      <h3>{tx("Optional pilot enrollment")}</h3>
      <p>
        {tx(
          "A pilot organiser provides an enrollment code. Only the fields you select are included in permitted aggregate reports. Yield and income impact remain unmeasured until evidence is collected and evaluated.",
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          act(async () => {
            await farmApi(`/pilot-enrollments/${cohort}`, {
              method: "POST",
              body: {
                plot_ids: selected,
              },
            });
            setEnrollments((await farmApi("/pilot-enrollments")).items);
            setCohort("");
          });
        }}
      >
        <label className="v2-label">
          {tx("Pilot enrollment code")}
          <input
            required
            pattern="[a-fA-F0-9-]{36}"
            value={cohort}
            maxLength={36}
            onChange={(event) => setCohort(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>{tx("Fields to enroll")}</legend>
          {plots.map((plot) => (
            <label className="v2-check" key={plot.id}>
              <input
                type="checkbox"
                checked={selected.includes(plot.id)}
                onChange={(event) =>
                  setSelected((previous) =>
                    event.target.checked
                      ? [...previous, plot.id]
                      : previous.filter((id) => id !== plot.id),
                  )
                }
              />
              {plot.name}
            </label>
          ))}
        </fieldset>
        <button
          disabled={
            busy ||
            offline ||
            !consents.includes("pilot_research") ||
            !selected.length
          }
        >
          {tx("Join consented pilot")}
        </button>
        {!consents.includes("pilot_research") && (
          <p>{tx("Enable optional pilot research consent to enroll.")}</p>
        )}
      </form>
      {enrollments
        .filter((item) => !item.withdrawn_at)
        .map((item) => (
          <p key={item.id}>
            {tx("Enrolled")} {new Date(item.created_at).toLocaleDateString()} ·{" "}
            {item.plot_ids.length} {tx("field(s)")}{" "}
            <button
              disabled={busy || offline}
              onClick={() =>
                act(async () => {
                  await farmApi(`/pilot-enrollments/${item.id}`, {
                    method: "DELETE",
                  });
                  setEnrollments((await farmApi("/pilot-enrollments")).items);
                })
              }
            >
              {tx("Withdraw this enrollment")}
            </button>
          </p>
        ))}
    </>
  );
}
