import React from 'react';
import { useTranslation } from '../i18n';

export default function ScenarioPriceSource({ forecast }) {
  const { t } = useTranslation();
  const metadata = forecast?.source_metadata;
  const entered = metadata?.source_type === 'user_input';
  const live = metadata?.source_type === 'live_api' && metadata?.freshness_status === 'live';
  const stale = metadata?.freshness_status === 'stale';
  const source = entered ? `${t('soilSensor.manualEntry')} - ${t('sidebar.marketPrice')}`
    : metadata?.source_label || t('common.notAvailable');
  const notice = forecast?.method === 'persistence_baseline' || entered
    ? t('scenarioDetails.disclaimer')
    : live ? t('scenarioDetails.livePriceNotice')
    : stale ? t('scenarioDetails.stalePriceNotice') : t('common.notAvailable');
  return (
    <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
      <p><strong>{t('scenarioDetails.priceSource')}:</strong> {source}</p>
      {metadata?.record_date && <p>{t('mandi.lastUpdated')}: {metadata.record_date}</p>}
      <p className="mt-2">{notice}</p>
    </div>
  );
}
