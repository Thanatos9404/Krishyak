import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '../i18n';

const FloatingActionButton = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="fab lg:hidden flex items-center gap-2"
      aria-label={t('sidebar.adjustInputs')}
    >
      <SlidersHorizontal className="w-5 h-5 sm:w-6 sm:h-6" />
      <span className="font-semibold text-sm">{t('sidebar.adjustInputs')}</span>
    </button>
  );
};

export default FloatingActionButton;
