import React from 'react';
import { Shield, ChevronLeft } from 'lucide-react';

const PrivacyPolicy = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-farm-green-50 to-white py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
          )}
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-farm-green-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Privacy Policy</h1>
              <p className="text-sm text-gray-500">Last Updated: January 2026</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 space-y-8">
          {/* Introduction */}
          <section>
            <p className="text-gray-700 leading-relaxed">
              Krishyak ("we", "our", or "the app") is an AI-powered farming decision-support tool 
              built to help Indian farmers make better crop, input, and market decisions. We take 
              your privacy seriously. This document explains, in plain language, what data we collect, 
              why we collect it, and how we protect it.
            </p>
          </section>

          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">1. What Data We Collect</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p><strong>Registration data:</strong> Your name, mobile number, father's/husband's name, 
                date of birth, state, district, village, PIN code, land details (khasra number, area, 
                ownership type), primary crop, and farming experience.</p>
              <p><strong>Optional data:</strong> Aadhaar number (last 4 digits only for JAM Trinity 
                verification — you can skip this entirely), secondary crops, and bank account linkage status.</p>
              <p><strong>Farm simulation inputs:</strong> Crop type, soil type, area, seed quality, 
                rainfall, irrigation frequency, fertilizer mix, pest risk, and market price — all entered 
                by you through the sidebar form.</p>
              <p><strong>Location data:</strong> If you grant permission, we use your GPS coordinates to 
                auto-detect soil type, weather, and regional rainfall. We never track your location 
                in the background.</p>
              <p><strong>Uploaded images:</strong> If you use the Crop Health Check feature, the plant 
                images you upload are sent to our server for analysis and are not stored permanently.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">2. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Running AI-powered yield simulations, risk assessments, and price forecasts.</li>
              <li>Matching you with eligible government schemes (PM-KISAN, PM-FASAL Bima, etc.).</li>
              <li>Providing personalized fertilizer and pest management recommendations.</li>
              <li>Detecting crop diseases from uploaded images.</li>
              <li>Auto-filling weather and soil data based on your location.</li>
            </ul>
            <p className="text-gray-700 mt-3">
              We <strong>do not</strong> sell, rent, or share your personal data with any third party 
              for advertising or marketing purposes.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">3. Data Storage</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p><strong>Local storage:</strong> Your registration profile, form drafts, and simulation 
                results are stored locally on your device using your browser's storage. This data 
                stays on your device and is not sent to our servers unless you explicitly run a simulation.</p>
              <p><strong>Server storage:</strong> When you register or run simulations, a summary may 
                be saved on our backend server for analytics and service improvement. This data is 
                stored securely and not linked to any third-party accounts.</p>
              <p><strong>No cloud sync:</strong> We do not upload your data to any cloud storage 
                service. All processing happens on our servers and results are returned to your device.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">4. Aadhaar & Sensitive Data</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-4">
              <p className="text-gray-700 leading-relaxed">
                <strong>🔒 Aadhaar is always optional.</strong> If you choose to use the JAM Trinity 
                verification feature, we only ask for the last 4 digits of your Aadhaar number. 
                Your full Aadhaar number is <strong>never collected or stored</strong>. The verification 
                is performed using a tokenized reference, not your actual Aadhaar.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">5. Data Retention & Deletion</h2>
            <div className="space-y-3 text-gray-700 leading-relaxed">
              <p>You can delete your local data at any time by logging out of the app, which clears 
                your registration from the browser. You can also clear your browser's local storage.</p>
              <p>Server-side records are retained for up to 12 months for service improvement and 
                are then automatically deleted.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">6. Third-Party Services</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>OpenWeatherMap:</strong> We may use this API to fetch real-time weather data 
                based on your coordinates. Only coordinates are shared — no personal information.</li>
              <li><strong>OpenStreetMap Nominatim:</strong> Used for reverse geocoding (converting GPS 
                coordinates to city/district names). No personal data is shared.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>You can refuse location access — the app works with manual inputs.</li>
              <li>You can skip Aadhaar verification entirely.</li>
              <li>You can log out to clear all locally stored data.</li>
              <li>You can contact us to request deletion of server-side data.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">8. Contact</h2>
            <p className="text-gray-700">
              For questions or concerns about this privacy policy, reach us at:{' '}
              <strong>privacy@krishyak.app</strong>
            </p>
          </section>

          {/* Disclaimer */}
          <section className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-500">
              This privacy policy applies to the Krishyak web application. We may update this policy 
              from time to time. Continued use of the app after changes constitutes acceptance of the 
              updated policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
