# Government integration boundary

The shipped integration is public source information for PM-KISAN, PMFBY and
Soil Health Card. It does not submit applications, verify an Aadhaar/bank/land
record, query a Farmer Registry, or claim an authorized AgriStack/Krishi-DSS link.
The adapter capability declares those operations unavailable without authorization.

PM-KISAN public information was checked in the browser: landholding farmer
families are subject to eligibility/exclusion and verification requirements.
The old blanket tenant eligibility claim was removed. Scheme cards cannot
sum presumed benefits into a farmer's expected income. Legacy rules are shown
as needs verification, including where earlier code classified likely eligible.

| Source | Scope |
|---|---|
| [PM-KISAN](https://pmkisan.gov.in/) | Public program information; individual eligibility unverified |
| [PMFBY](https://pmfby.gov.in/) | Public insurance portal; state/season/crop enrollment terms require verification |
| [Soil Health Card](https://soilhealth.dac.gov.in/) | Public soil-card information; uploaded measurements remain farmer reported |

An authorized adapter would require a written program agreement, documented
scopes, purpose-specific consent, minimization, provider authentication,
retention, audit and actual provider smoke tests. Ordinary portal login or an
email OTP does not grant backend API authorization. No government credentials
or personal verification data were collected for this release.
