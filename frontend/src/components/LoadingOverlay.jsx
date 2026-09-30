import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';

// The API does not report intermediate progress. Show only the pending state.
const LoadingOverlay = ({ isLoading }) => {
  const { t } = useTranslation();
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div role="status" aria-live="polite" aria-busy="true"
        className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-farm-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-white animate-spin motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold text-gray-800">{t('simulation.running')}</h3>
        <p className="text-sm text-gray-500 mt-2">{t('common.loading')}</p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
