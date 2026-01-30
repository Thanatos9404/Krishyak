import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import { useTranslation } from '../i18n';

const YieldChart = ({ yieldData }) => {
  const { t } = useTranslation();

  const data = [
    {
      name: t('yieldChart.modifiers'),
      Soil: (yieldData.modifiers.soil * 100),
      Rainfall: (yieldData.modifiers.rainfall * 100),
      Irrigation: (yieldData.modifiers.irrigation * 100),
      Fertilizer: (yieldData.modifiers.fertilizer * 100),
      Seed: (yieldData.modifiers.seed_quality * 100),
      Pest: (yieldData.modifiers.pest_impact * 100),
    }
  ];

  return (
    <div className="card-farm card-glow p-6 animate-fade-in">
      <div className="flex items-center mb-4">
        <Activity className="w-6 h-6 text-farm-green-600 mr-2" />
        <h3 className="text-xl font-bold text-gray-800">{t('yieldChart.title')}</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: t('yieldChart.impact'), angle: -90, position: 'insideLeft' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '12px'
            }}
          />
          <Legend />
          <Bar dataKey="Soil" name={t('yieldChart.factors.soil')} fill="#86efac" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Rainfall" name={t('yieldChart.factors.rainfall')} fill="#7dd3fc" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Irrigation" name={t('yieldChart.factors.irrigation')} fill="#60a5fa" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Fertilizer" name={t('yieldChart.factors.fertilizer')} fill="#fbbf24" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Seed" name={t('yieldChart.factors.seed')} fill="#a78bfa" radius={[8, 8, 0, 0]} />
          <Bar dataKey="Pest" name={t('yieldChart.factors.pest')} fill="#f87171" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 p-4 bg-farm-green-50 rounded-xl">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{t('yieldChart.totalModifier')}: </span>
          {(yieldData.modifiers.total * 100).toFixed(1)}% {t('yieldChart.ofBaseYield')}
        </p>
      </div>
    </div>
  );
};

export default YieldChart;
