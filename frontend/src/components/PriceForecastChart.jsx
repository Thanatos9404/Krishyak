import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Analyze the actual forecast curve shape to derive an honest trend label.
 * Compares first-third average vs last-third average.
 */
function analyzeForecastShape(prices) {
  if (!prices || prices.length < 6) return { label: 'Insufficient Data', type: 'stable' };

  const third = Math.floor(prices.length / 3);
  const firstThirdAvg = prices.slice(0, third).reduce((a, b) => a + b, 0) / third;
  const lastThirdAvg = prices.slice(-third).reduce((a, b) => a + b, 0) / third;
  const peakPrice = Math.max(...prices);
  const peakIdx = prices.indexOf(peakPrice);
  const peakPct = (peakIdx / prices.length) * 100;

  // Determine shape
  if (peakPct < 40 && lastThirdAvg < firstThirdAvg * 0.95) {
    return { label: 'Early Peak, Later Decline', type: 'peak_early' };
  }
  if (peakPct > 60 && lastThirdAvg > firstThirdAvg * 1.05) {
    return { label: 'Late Season Rise', type: 'upward' };
  }
  if (lastThirdAvg > firstThirdAvg * 1.05) {
    return { label: 'Upward Trend', type: 'upward' };
  }
  if (lastThirdAvg < firstThirdAvg * 0.95) {
    return { label: 'Downward Trend', type: 'downward' };
  }
  return { label: 'Relatively Stable', type: 'stable' };
}

const PriceForecastChart = ({ forecastData }) => {
  if (!forecastData || !forecastData.forecast_prices) {
    return null;
  }

  // Generate real calendar dates from today
  const startDate = new Date();
  const data = forecastData.forecast_prices.map((price, idx) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + idx);
    return {
      day: idx,
      date: date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      price: price,
    };
  });

  const optimalWindow = forecastData.optimal_selling_window;

  // Derive honest trend from actual curve shape
  const trendAnalysis = analyzeForecastShape(forecastData.forecast_prices);

  // Build honest selling window text with real dates
  const peakDate = new Date(startDate);
  peakDate.setDate(peakDate.getDate() + (optimalWindow.recommended_day || 0));
  const windowStartDate = new Date(startDate);
  windowStartDate.setDate(windowStartDate.getDate() + (optimalWindow.window_start_day || 0));
  const windowEndDate = new Date(startDate);
  windowEndDate.setDate(windowEndDate.getDate() + (optimalWindow.window_end_day || 0));
  const dateFormatter = { month: 'short', day: 'numeric' };

  const sellingAdvice = `Best to sell around ${peakDate.toLocaleDateString('en-IN', dateFormatter)} (${windowStartDate.toLocaleDateString('en-IN', dateFormatter)} – ${windowEndDate.toLocaleDateString('en-IN', dateFormatter)} are favorable)`;

  // Badge colors based on actual trend
  const trendBadge = {
    upward: { bg: 'bg-green-100 text-green-700', Icon: TrendingUp },
    peak_early: { bg: 'bg-amber-100 text-amber-700', Icon: TrendingDown },
    downward: { bg: 'bg-red-100 text-red-700', Icon: TrendingDown },
    stable: { bg: 'bg-gray-100 text-gray-700', Icon: Minus },
  }[trendAnalysis.type] || { bg: 'bg-gray-100 text-gray-700', Icon: Minus };

  const BadgeIcon = trendBadge.Icon;

  return (
    <div className="card-farm card-glow p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <TrendingUp className="w-6 h-6 text-sky-blue-600 mr-2" />
          <h3 className="text-xl font-bold text-gray-800">Price Forecast</h3>
        </div>
        <span className={`text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 ${trendBadge.bg}`}>
          <BadgeIcon className="w-4 h-4" />
          {trendAnalysis.label}
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
            dataKey="date"
            interval={Math.floor(data.length / 6)}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            label={{ value: '₹/quintal', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '2px solid #0ea5e9',
              borderRadius: '12px',
              padding: '12px'
            }}
            formatter={(value) => [`₹${value.toFixed(0)}/quintal`, 'Price']}
            labelFormatter={(label) => `📅 ${label}`}
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
          <p className="text-xs text-gray-500">{peakDate.toLocaleDateString('en-IN', dateFormatter)}</p>
        </div>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
        <p className="text-sm font-semibold text-yellow-800 mb-1">
          Optimal Selling Window
        </p>
        <p className="text-xs text-yellow-700">
          {sellingAdvice}
        </p>
      </div>

      {/* Honest disclaimer */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        Forecast based on mandi trend simulation · Actual prices may vary
      </p>
    </div>
  );
};

export default PriceForecastChart;
