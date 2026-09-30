import React from 'react';
import { useTranslation } from '../i18n';
import { isRiskScore } from '../utils/riskHelper';

export default function RiskGauge({ riskData }) {
  const { t } = useTranslation();
  const components = riskData?.components || {};
  const fields = [['weather','weather_risk'],['price','price_volatility_risk'],
    ['pest','pest_attack_risk'],['soil','soil_mismatch_risk']];
  return (
    <div className="card-farm p-6">
      <h3 className="text-xl font-bold mb-4">{t('dashboard.riskDistribution')}</h3>
      <div className="space-y-4">
        {fields.map(([id,key]) => {
          const value = components[key];
          return <div key={id}>
            <p>{t(`risk.components.${id}`)}: {isRiskScore(value) ? `${Number(value.toFixed(2))}/100` : t('common.notAvailable')}</p>
            {isRiskScore(value) && <div role="meter" aria-label={t(`risk.components.${id}`)}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-2 rounded bg-gray-100 mt-1">
              <div className="h-2 rounded bg-sky-600" style={{width:`${value}%`}} />
            </div>}
          </div>;
        })}
      </div>
      <p className="text-xs text-gray-500 mt-4">{t('scenarioDetails.disclaimer')}</p>
    </div>
  );
}
