import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield } from 'lucide-react';

const RiskGauge = ({ riskData }) => {
  const data = [
    { name: 'Weather Risk', value: riskData.components.weather_risk },
    { name: 'Price Risk', value: riskData.components.price_volatility_risk },
    { name: 'Pest Risk', value: riskData.components.pest_attack_risk },
    { name: 'Soil Risk', value: riskData.components.soil_mismatch_risk },
  ];

  const COLORS = ['#7dd3fc', '#fbbf24', '#f87171', '#a78bfa'];

  return (
    <div className="card-farm card-glow p-6 animate-fade-in">
      <div className="flex items-center mb-4">
        <Shield className="w-6 h-6 text-farm-green-600 mr-2" />
        <h3 className="text-xl font-bold text-gray-800">Risk Distribution</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #86efac',
              borderRadius: '12px',
              padding: '12px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center bg-gray-50 rounded-lg p-3">
            <div
              className="w-4 h-4 rounded-full mr-2"
              style={{ backgroundColor: COLORS[idx] }}
            ></div>
            <div>
              <p className="text-xs text-gray-600">{item.name}</p>
              <p className="text-sm font-bold text-gray-900">{item.value.toFixed(1)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RiskGauge;
