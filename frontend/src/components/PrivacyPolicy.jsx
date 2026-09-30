import React from 'react';
import { ArrowLeft, Database, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';

const SECTION_ICONS = [Database, MapPin, ShieldCheck, Trash2];

const PrivacyPolicy = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-stone-50 py-6 px-4">
      <article className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <header className="p-5 sm:p-7 border-b border-stone-200">
          <button onClick={onBack} className="min-h-11 inline-flex items-center gap-2 text-green-800 font-semibold mb-4">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" /> {t('common.back')}
          </button>
          <h1 className="text-2xl font-bold text-stone-900">{t('privacy.title')}</h1>
          <p className="text-sm text-stone-500 mt-1">{t('privacy.lastUpdated')}</p>
          <p className="mt-4 text-stone-700 leading-relaxed">{t('privacy.summary')}</p>
        </header>

        <div className="p-5 sm:p-7 space-y-5">
          {[1, 2, 3, 4].map((index) => {
            const Icon = SECTION_ICONS[index - 1];
            return (
              <section key={index} className="rounded-xl border border-stone-200 p-4 sm:p-5">
                <h2 className="font-bold text-stone-900 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-green-700" aria-hidden="true" />
                  {t(`privacy.sections.${index}.title`)}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-700">{t(`privacy.sections.${index}.body`)}</p>
              </section>
            );
          })}
          <p className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{t('privacy.contact')}</p>
        </div>
      </article>
    </main>
  );
};

export default PrivacyPolicy;
