import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';

const PriceForecastChart = ({ forecastData }) => {
  if (!forecastData || !forecastData.forecast_prices) {
    return null;
  }

  const data = forecastData.forecast_prices.map((price, idx) => ({
    day: idx,
    price: price,
  }));

  const optimalWindow = forecastData.optimal_selling_window;

  return (
    <div className="card-farm card-glow p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <TrendingUp className="w-6 h-6 text-sky-blue-600 mr-2" />
          <h3 className="text-xl font-bold text-gray-800">Price Forecast</h3>
        </div>
        <span className={`text-sm font-semibold px-4 py-2 rounded-full ${forecastData.trend === 'Upward' ? 'bg-green-100 text-green-700' :
            forecastData.trend === 'Downward' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
          }`}>
          {forecastData.trend} Trend
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            label={{ value: 'Days', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            label={{ value: 'Price (₹/quintal)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #0ea5e9',
              borderRadius: '12px',
              padding: '12px'
            }}
            formatter={(value) => [`₹${value.toFixed(2)}`, 'Price']}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#0ea5e9"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorPrice)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-sky-blue-50 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">Current Price</p>
          <p className="text-2xl font-bold text-sky-blue-700">
            ₹{forecastData.current_price}
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">Expected Peak</p>
          <p className="text-2xl font-bold text-green-700">
            ₹{optimalWindow.expected_peak_price}
          </p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
        <p className="text-sm font-semibold text-yellow-800 mb-1">
          Optimal Selling Window
        </p>
        <p className="text-xs text-yellow-700">
          {optimalWindow.recommendation}
        </p>
      </div>
    </div>
  );
};

export default PriceForecastChart;
