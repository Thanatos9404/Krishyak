import React from 'react';
import { Shield, ChevronLeft, Lock, Database, Clock, UserCheck, FileText, Globe } from 'lucide-react';
import { useTranslation } from '../i18n';

const PrivacyPolicy = ({ onBack }) => {
  const { t } = useTranslation();

  const Section = ({ icon: Icon, title, children }) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Icon className="w-6 h-6 mr-2 text-farm-green-600" />
        {title}
      </h2>
      <div className="text-gray-600 space-y-3 pl-8">
        {children}
      </div>
    </div>
  );

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
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <Shield className="w-8 h-8 mr-3 text-farm-green-600" />
              {t('privacy.title') || 'Privacy Policy'}
            </h1>
            <p className="text-gray-600 mt-1">{t('privacy.lastUpdated') || 'Last Updated: January 2026'}</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Introduction */}
          <div className="mb-8 p-4 bg-farm-green-50 rounded-xl border-l-4 border-farm-green-500">
            <p className="text-gray-700">
              {t('privacy.intro') || 'Krishyak is committed to protecting your privacy and complying with the Digital Personal Data Protection (DPDP) Act, 2023. This policy explains how we collect, use, and protect your personal information.'}
            </p>
          </div>

          <Section icon={Database} title={t('privacy.dataCollected') || 'Data We Collect'}>
            <p><strong>{t('privacy.personalData') || 'Personal Information'}:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('privacy.namePhone') || 'Full name, mobile number, date of birth'}</li>
              <li>{t('privacy.aadhaar') || 'Aadhaar number (optional, for government scheme verification)'}</li>
              <li>{t('privacy.address') || 'Address details (State, District, Village, PIN code)'}</li>
            </ul>

            <p className="mt-4"><strong>{t('privacy.landData') || 'Land & Farming Information'}:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('privacy.landRecords') || 'Khasra/Survey number, land area, ownership type'}</li>
              <li>{t('privacy.cropInfo') || 'Crop types, farming methods, experience level'}</li>
            </ul>

            <p className="mt-4"><strong>{t('privacy.usageData') || 'Usage Data'}:</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>{t('privacy.appUsage') || 'Simulation parameters, crop health checks, scheme applications'}</li>
            </ul>
          </Section>

          <Section icon={Lock} title={t('privacy.dataProtection') || 'How We Protect Your Data'}>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{t('privacy.encryption') || 'Encryption'}:</strong> {t('privacy.encryptionDesc') || 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256)'}</li>
              <li><strong>{t('privacy.tokenization') || 'Aadhaar Tokenization'}:</strong> {t('privacy.tokenizationDesc') || 'We never store your full Aadhaar number. Only tokenized references are used for verification.'}</li>
              <li><strong>{t('privacy.accessControl') || 'Access Control'}:</strong> {t('privacy.accessControlDesc') || 'Only authorized personnel can access personal data'}</li>
              <li><strong>{t('privacy.secureServers') || 'Secure Servers'}:</strong> {t('privacy.secureServersDesc') || 'Data is stored on secure cloud servers within India'}</li>
            </ul>
          </Section>

          <Section icon={FileText} title={t('privacy.dataUse') || 'How We Use Your Data'}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('privacy.useSchemes') || 'To match you with eligible government schemes (PM-KISAN, PMFBY, etc.)'}</li>
              <li>{t('privacy.useRecommendations') || 'To provide personalized farming recommendations'}</li>
              <li>{t('privacy.useAlerts') || 'To send weather alerts and pest warnings for your region'}</li>
              <li>{t('privacy.useAnalytics') || 'To improve our AI models and services (anonymized data only)'}</li>
            </ul>
          </Section>

          <Section icon={Globe} title={t('privacy.dataSharing') || 'Data Sharing'}>
            <p className="mb-3">{t('privacy.shareIntro') || 'We may share your data with:'}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{t('privacy.govDepts') || 'Government Departments'}:</strong> {t('privacy.govDeptsDesc') || 'For scheme eligibility verification (only with your explicit consent)'}</li>
              <li><strong>{t('privacy.serviceProviders') || 'Service Providers'}:</strong> {t('privacy.serviceProvidersDesc') || 'Third-party services that help us operate (under strict data protection agreements)'}</li>
            </ul>
            <p className="mt-3 font-semibold text-farm-green-700">
              {t('privacy.noSell') || '✓ We will NEVER sell your personal data to advertisers or third parties.'}
            </p>
          </Section>

          <Section icon={Clock} title={t('privacy.retention') || 'Data Retention'}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('privacy.activeAccount') || 'Active account data is retained as long as you use the service'}</li>
              <li>{t('privacy.inactiveAccount') || 'Inactive accounts are anonymized after 3 years of inactivity'}</li>
              <li>{t('privacy.deleteRequest') || 'You can request complete data deletion at any time'}</li>
            </ul>
          </Section>

          <Section icon={UserCheck} title={t('privacy.yourRights') || 'Your Rights (DPDP Act 2023)'}>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>{t('privacy.rightAccess') || 'Right to Access'}:</strong> {t('privacy.rightAccessDesc') || 'Request a copy of all data we hold about you'}</li>
              <li><strong>{t('privacy.rightCorrect') || 'Right to Correction'}:</strong> {t('privacy.rightCorrectDesc') || 'Update or correct your personal information'}</li>
              <li><strong>{t('privacy.rightErase') || 'Right to Erasure'}:</strong> {t('privacy.rightEraseDesc') || 'Request deletion of your personal data'}</li>
              <li><strong>{t('privacy.rightWithdraw') || 'Right to Withdraw Consent'}:</strong> {t('privacy.rightWithdrawDesc') || 'Withdraw consent for data processing at any time'}</li>
              <li><strong>{t('privacy.rightGrievance') || 'Right to Grievance Redressal'}:</strong> {t('privacy.rightGrievanceDesc') || 'File complaints about data handling'}</li>
            </ul>
          </Section>

          {/* Contact */}
          <div className="mt-8 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-bold text-blue-800 mb-2">{t('privacy.contact') || 'Contact Us'}</h3>
            <p className="text-blue-700 text-sm">
              {t('privacy.contactDesc') || 'For any privacy-related questions or to exercise your rights, contact our Data Protection Officer at:'}<br />
              <strong>privacy@krishyak.in</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
