# MVP Execution Plan: Krishyak Platform Enhancements

This document outlines the execution plan for upgrading the Krishyak platform to a production-grade application, focusing on the Farmer Registration flow, Multilingual support, Mobile responsiveness, and essential feature additions.

## 1. Farmer Registration Form (Detailed Specification)

**Objective:** Replace the simple login with a comprehensive data collection wizard to build a farmer database and enable scheme eligibility matching.

**Current Constraints:** 
- **No OTP/Password Auth:** For this MVP phase, bypass complex authentication. The form submission should directly log the user in (session based on Mobile Number/LocalStorage).
- **Future Scope:** Real OTP verification and secure passwordless login will be implemented in Phase 2.

### A. Recommended Form Fields & Structure
The form will be a **Multi-Step Wizard (4 Steps)** to ensure good UX on mobile devices.

#### Step 1: Personal Information
*   **Full Name (पूरा नाम):** Text input, Required.
*   **Father's/Husband's Name (पिता/पति का नाम):** Text input, Required.
*   **Mobile Number (मोबाइल नंबर):** 10-digit Numeric, Required. (Acts as the primary User ID for this MVP).
*   **Date of Birth (जन्म तिथि):** Date picker, Optional.
*   **Aadhaar Number (आधार संख्या):** 12-digit masked input, Optional (Data field ready for future eKYC).

#### Step 2: Location Details
*   **State (राज्य):** Dropdown (List of Indian States), Required.
*   **District (जिला):** Dropdown (Dependent on State), Required.
*   **Tehsil/Block (तहसील/ब्लॉक):** Dropdown (Dependent on District), Required.
*   **Village (गाँव):** Text Input, Required.
*   **Pin Code (पिन कोड):** 6-digit Numeric, Required.

#### Step 3: Land Details
*   **Khasra / Survey Number (खसरा संख्या):** Text Input, Required (Critical for Land Record verification).
*   **Total Land Area:** Numeric Input with Unit Toggle (Hectares vs Acres), Required.
*   **Irrigated Land:** Numeric Input, Optional.
*   **Rain-fed Land:** Numeric Input, Optional.
*   **Land Ownership Type:** Dropdown (Own / Leased / Shared), Required.

#### Step 4: Farming Information & Consent
*   **Primary Crop (मुख्य फसल):** Dropdown (Populated from the app's supported 56 crops), Required.
*   **Secondary Crops:** Multi-select Dropdown, Optional.
*   **Farming Type:** Radio Group (Organic / Conventional / Mixed), Required.
*   **Experience:** Dropdown (0-5, 5-10, 10-20, 20+ years).
*   **Terms & Consent (Legal):**
    *   [x] "I consent to share my data with government departments for scheme eligibility" (Required).
    *   [x] "I agree to Terms of Service and Privacy Policy" (Required).

### B. UI/UX Implementation Requirements
1.  **Progress Stepper:** visually indicate "Step X of 4".
2.  **Auto-Save:** Implement `localStorage` saving of form data so users don't lose progress if the page reloads.
3.  **Voice Input:** (Optional but Recommended) Add microphone icon on text fields to allow filling via voice (leveraging existing speech-to-text capabilties).
4.  **Component Design:** Use high-contrast inputs and large touch targets (min 44px height) for accessibility.

---

## 2. Complete Multilingual Translation
**Objective:** Achieve 100% localization coverage across the application.

*   **Audit:** Identify all hardcoded English strings in components (especially `Placeholder` attributes, Dropdown options, and Error messages).
*   **Action:** Update `src/i18n/locales/*.json` for all 12 supported languages.
*   **Specific Targets:**
    *   Form Labels ("Basic Information", "Total Land Area", etc.)
    *   Dropdown Options ("Organic", "Conventional", State names)
    *   Navigation Menu items
    *   Dynamic notifications/toasts.

---

## 3. Mobile Responsiveness & Testing
**Objective:** Ensure the application is fully functional on standard smartphone viewports (360px - 420px width).

*   **Grid Framework:** Review all `grid-cols-x` and `flex` layouts. Ensure they stack vertically (`flex-col`) on mobile (`< md` breakpoint).
*   **Touch Optimization:**
    *   Increase padding on buttons.
    *   Ensure form inputs have `font-size: 16px` to prevent iOS auto-zoom on focus.
*   **Testing:** Verify layout integrity on simulated devices:
    *   Android (Pixel 5/Samsung Galaxy S20)
    *   iOS (iPhone 12/14)

---

## 4. MSP (Minimum Support Price) Integration
**Objective:** Provide farmers with financial awareness regarding Government guaranteed prices.

*   **Data Source:** Create a static data file `msp_data.json` containing current government MSP rates for supported crops.
*   **UI Implementation:**
    *   Add an "MSP Rate Card" on the Dashboard.
    *   Logic: If the user selects "Wheat" as Primary Crop, display the current MSP for Wheat prominently.
    *   Include a "View All MSP" link to a dedicated table view.

---

## 5. robust Error Handling
**Objective:** Provide clear, localized feedback when actions fail.

*   **Form Validation:** Replace generic HTML validation with custom UI messages (e.g., "Please enter a valid 10-digit mobile number" in the selected regional language).
*   **API Errors:** Implement a global toaster/notification system to handle backend failures gracefully (e.g., "Network Error, please try again").

---

## 6. Privacy Policy & Terms of Service
**Objective:** DPDP Act Compliance and Trust.

*   **Route Creation:** Add `/privacy` and `/terms` pages.
*   **Content:**
    *   **Privacy Policy:** Clearly state what data is collected (Land, Personal, Banking), how it is encrypted, and retention policies.
    *   **Terms:** Define acceptable use and liability disclaimers.
*   **Integration:** Link these pages in the Footer and the Registration Form consent step.
