import { useProductLocale } from "../product/ProductLocale";
import React from "react";
export default function V2LegalNotice({ terms = false }) {
  const { tx } = useProductLocale();
  return (
    <section className="rounded-xl border border-stone-200 p-4 sm:p-5">
      <h2 className="font-bold text-stone-900">
        {tx("Field Intelligence account notice \xB7 3 October 2026")}
      </h2>
      {terms ? (
        <>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "Krishyak provides farm records, evidence and decision support. Simulations, classifier scores, forecasts and vegetation indices are estimates with limitations. They do not guarantee yield, income, disease status, treatment safety, government eligibility or benefit approval.",
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "Inspect your field and confirm crop treatments with a qualified local expert and the applicable product label. No chemical dose is approved by a photograph or satellite index. Government links lead to the responsible authority; Krishyak does not submit applications or verify Aadhaar, banking or land ownership.",
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "The engineering release has not established independent Indian field accuracy or measured farmer impact. These notices are a draft and require legal and agronomic review before commercial rollout.",
            )}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed">
            Accounts store your sign-in mobile number, preferred name, optional
            village/district/state, farms, selected plot boundaries, crop
            cycles, field observations, photographs and feedback. Photographs
            are private and their metadata is stripped before storage.
            Model-improvement and pilot research permissions are separate,
            optional choices.
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "Satellite processing sends the selected boundary to the configured Copernicus provider. Weather uses an approximate grid location with the configured weather provider. Opening a map contacts its basemap service. OTP verification uses the configured verification provider. Each service has its own processing and retention terms.",
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "Offline storage is optional and stays on this device. Anyone with access to an unlocked device may access saved fields. Signing out clears this account\u2019s private cache and unsynchronized observations. Saved field evidence expires after seven days; pending observations stay reviewable until synchronized or removed. When offline, sign-out clears device data immediately and revokes the server session on reconnect. Photographs and authentication tokens are not cached. Account export, permission withdrawal and account deletion are available in Privacy.",
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "Deletion removes account records and queues private-photo cleanup. Provider records and retained backups need separate retention controls. The default application worker expires photos after 365 days and audit records after 180 days; the operator must publish any deployment-specific changes. Research withdrawal stops new research review and pilot reporting of your records.",
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            {tx(
              "The service operator must publish a privacy contact and complete legal review before commercial account processing. Do not post account exports, phone numbers or field locations in public repository issues.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
