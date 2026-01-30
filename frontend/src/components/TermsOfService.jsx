import React from 'react';
import { FileText, ChevronLeft, CheckCircle, AlertTriangle, Scale, Shield, Users, Ban } from 'lucide-react';
import { useTranslation } from '../i18n';

const TermsOfService = ({ onBack }) => {
  const { t } = useTranslation();

  const Section = ({ icon: Icon, title, children }) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <Icon className="w-6 h-6 mr-2 text-blue-600" />
        {title}
      </h2>
      <div className="text-gray-600 space-y-3 pl-8">
        {children}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-8 px-4">
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
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              {t('terms.title') || 'Terms of Service'}
            </h1>
            <p className="text-gray-600 mt-1">{t('terms.lastUpdated') || 'Last Updated: January 2026'}</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Introduction */}
          <div className="mb-8 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
            <p className="text-gray-700">
              {t('terms.intro') || 'Welcome to Krishyak. By using our services, you agree to these terms. Please read them carefully before proceeding.'}
            </p>
          </div>

          <Section icon={CheckCircle} title={t('terms.acceptance') || 'Acceptance of Terms'}>
            <p>{t('terms.acceptanceDesc') || 'By registering on or using the Krishyak platform, you agree to be bound by these Terms of Service, our Privacy Policy, and all applicable laws and regulations. If you do not agree with any of these terms, you must not use our services.'}</p>
          </Section>

          <Section icon={Users} title={t('terms.eligibility') || 'Eligibility'}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('terms.eligibility1') || 'You must be at least 18 years old to register'}</li>
              <li>{t('terms.eligibility2') || 'You must provide accurate and truthful information during registration'}</li>
              <li>{t('terms.eligibility3') || 'You must be a farmer or authorized representative of a farming entity'}</li>
              <li>{t('terms.eligibility4') || 'You are responsible for maintaining the security of your account'}</li>
            </ul>
          </Section>

          <Section icon={Shield} title={t('terms.services') || 'Our Services'}>
            <p className="mb-3">{t('terms.servicesIntro') || 'Krishyak provides:'}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('terms.service1') || 'AI-powered farming simulations and predictions'}</li>
              <li>{t('terms.service2') || 'Crop health diagnosis through image analysis'}</li>
              <li>{t('terms.service3') || 'Weather alerts and agricultural advisories'}</li>
              <li>{t('terms.service4') || 'Government scheme eligibility matching'}</li>
              <li>{t('terms.service5') || 'MSP information and market price data'}</li>
            </ul>
          </Section>

          <Section icon={Ban} title={t('terms.prohibited') || 'Prohibited Activities'}>
            <p className="mb-3">{t('terms.prohibitedIntro') || 'You agree NOT to:'}</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('terms.prohibited1') || 'Provide false or misleading information'}</li>
              <li>{t('terms.prohibited2') || 'Use the platform for any illegal purpose'}</li>
              <li>{t('terms.prohibited3') || 'Attempt to access other users\' accounts or data'}</li>
              <li>{t('terms.prohibited4') || 'Interfere with or disrupt the platform\'s operation'}</li>
              <li>{t('terms.prohibited5') || 'Use automated tools to scrape or collect data'}</li>
              <li>{t('terms.prohibited6') || 'Impersonate another person or entity'}</li>
            </ul>
          </Section>

          <Section icon={AlertTriangle} title={t('terms.disclaimer') || 'Disclaimer of Warranties'}>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-yellow-800">
                <strong>{t('terms.important') || 'IMPORTANT'}:</strong> {t('terms.disclaimerText') || 'The farming predictions, recommendations, and simulations provided by Krishyak are for informational purposes only. They are based on AI models and historical data, and may not accurately predict actual farming outcomes.'}
              </p>
            </div>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>{t('terms.disclaimer1') || 'We do not guarantee accuracy of yield predictions or profit estimates'}</li>
              <li>{t('terms.disclaimer2') || 'Weather forecasts and alerts are provided by third-party services'}</li>
              <li>{t('terms.disclaimer3') || 'Government scheme information is provided as-is and may change'}</li>
              <li>{t('terms.disclaimer4') || 'MSP rates are sourced from official government notifications'}</li>
            </ul>
          </Section>

          <Section icon={Scale} title={t('terms.liability') || 'Limitation of Liability'}>
            <p>{t('terms.liabilityText') || 'To the maximum extent permitted by law, Krishyak and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from:'}</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>{t('terms.liability1') || 'Your use or inability to use the service'}</li>
              <li>{t('terms.liability2') || 'Any decisions made based on platform recommendations'}</li>
              <li>{t('terms.liability3') || 'Crop failures or financial losses from farming activities'}</li>
              <li>{t('terms.liability4') || 'Service interruptions or data loss'}</li>
            </ul>
          </Section>

          <Section icon={FileText} title={t('terms.termination') || 'Account Termination'}>
            <ul className="list-disc pl-6 space-y-2">
              <li>{t('terms.termination1') || 'You may delete your account at any time through settings'}</li>
              <li>{t('terms.termination2') || 'We may suspend accounts that violate these terms'}</li>
              <li>{t('terms.termination3') || 'Upon termination, your data will be handled per our Privacy Policy'}</li>
            </ul>
          </Section>

          <Section icon={Scale} title={t('terms.governing') || 'Governing Law'}>
            <p>{t('terms.governingText') || 'These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in New Delhi, India.'}</p>
          </Section>

          {/* Changes to Terms */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl">
            <h3 className="font-bold text-gray-800 mb-2">{t('terms.changes') || 'Changes to Terms'}</h3>
            <p className="text-gray-600 text-sm">
              {t('terms.changesText') || 'We may update these terms from time to time. We will notify you of significant changes via the app or email. Continued use after changes constitutes acceptance of new terms.'}
            </p>
          </div>

          {/* Contact */}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-bold text-blue-800 mb-2">{t('terms.contact') || 'Questions?'}</h3>
            <p className="text-blue-700 text-sm">
              {t('terms.contactText') || 'If you have any questions about these Terms, contact us at:'}<br />
              <strong>support@krishyak.in</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
