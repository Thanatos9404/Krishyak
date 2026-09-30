import React from 'react';
import { Shield } from 'lucide-react';
import { getRiskInfo, getRiskHexColor, isRiskScore } from '../utils/riskHelper';
import { useTranslation } from '../i18n';

export default function RiskScoreGauge({ score }) {
  const { t } = useTranslation();
  if (!isRiskScore(score)) return <p role="status">{t('common.notAvailable')}</p>;
  const category = getRiskInfo(score);
  const color = getRiskHexColor(score);
  const arc = Math.PI * 80;
  return (
    <div className="flex flex-col items-center">
      <svg className="w-full max-w-[14rem] h-32" viewBox="0 0 200 120" aria-hidden="true">
        {['#22c55e','#eab308','#f97316','#ef4444'].map((stroke,index)=>(
          <path key={stroke} d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={stroke}
            strokeWidth="14" strokeDasharray={`${arc / 4} ${arc * 3 / 4}`}
            strokeDashoffset={-index * arc / 4} />
        ))}
        <g transform={`rotate(${score * 1.8 - 90}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="35" stroke={color} strokeWidth="4" />
        </g>
        <circle cx="100" cy="100" r="8" fill={color} />
      </svg>
      <div role="meter" aria-label={t('dashboard.riskScore')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}
        className="text-3xl font-bold mb-3" style={{color}}>{Number(score.toFixed(2))}/100</div>
      <div className={`${category.badgeBg} px-6 py-3 rounded-xl text-center`}>
        <Shield className="w-6 h-6 inline" aria-hidden="true" />
        <p className="font-bold">{t(`risk.levels.${category.id}`)}</p>
      </div>
      <p className="text-xs text-gray-500 mt-3 text-center">{t('scenarioDetails.disclaimer')}</p>
    </div>
  );
}
