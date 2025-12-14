import React, { useState, useEffect } from 'react';

const RiskScoreGauge = ({ score = 0 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate the score from 0 to actual value
  useEffect(() => {
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(score * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [score]);

  // Calculate needle rotation (-90 to 90 degrees based on 0-100 score)
  const needleRotation = (animatedScore / 100) * 180 - 90;

  // Get color based on score segments
  const getScoreColor = (s) => {
    if (s <= 20) return '#22c55e'; // Green
    if (s <= 40) return '#84cc16'; // Lime
    if (s <= 60) return '#facc15'; // Yellow
    if (s <= 80) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  // Get risk category
  const getRiskCategory = (s) => {
    if (s <= 20) return { text: 'Low Risk', badge: '🟢', desc: 'Safe to Proceed', bgColor: 'bg-green-100', textColor: 'text-green-700' };
    if (s <= 40) return { text: 'Moderate Risk', badge: '🟡', desc: 'Monitor Closely', bgColor: 'bg-yellow-100', textColor: 'text-yellow-700' };
    if (s <= 60) return { text: 'High Risk', badge: '🟠', desc: 'Take Precautions', bgColor: 'bg-orange-100', textColor: 'text-orange-700' };
    return { text: 'Very High Risk', badge: '🔴', desc: 'Reconsider Plan', bgColor: 'bg-red-100', textColor: 'text-red-700' };
  };

  const category = getRiskCategory(score);
  const color = getScoreColor(animatedScore);

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative w-56 h-32 mb-2">
        <svg className="w-full h-full" viewBox="0 0 200 120" overflow="visible">
          {/* Background arc segments with colors */}
          {/* Green segment (0-20) */}
          <path
            d="M 20 100 A 80 80 0 0 1 35.86 50.34"
            fill="none"
            stroke="#22c55e"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Lime segment (20-40) */}
          <path
            d="M 38 47.5 A 80 80 0 0 1 66.94 24.5"
            fill="none"
            stroke="#84cc16"
            strokeWidth="14"
          />

          {/* Yellow segment (40-60) */}
          <path
            d="M 70 22.5 A 80 80 0 0 1 130 22.5"
            fill="none"
            stroke="#facc15"
            strokeWidth="14"
          />

          {/* Orange segment (60-80) */}
          <path
            d="M 133.06 24.5 A 80 80 0 0 1 162 47.5"
            fill="none"
            stroke="#f97316"
            strokeWidth="14"
          />

          {/* Red segment (80-100) */}
          <path
            d="M 164.14 50.34 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#ef4444"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Needle */}
          <g transform={`rotate(${needleRotation}, 100, 100)`}>
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="35"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Needle shadow/glow */}
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="38"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>

          {/* Center circle */}
          <circle cx="100" cy="100" r="10" fill={color} />
          <circle cx="100" cy="100" r="6" fill="white" />
        </svg>
      </div>

      {/* Score display BELOW the gauge (not overlapping) */}
      <div className="text-center mb-3">
        <span className="text-4xl font-bold" style={{ color }}>{Math.round(animatedScore)}</span>
        <span className="text-gray-400 text-lg ml-1">/100</span>
      </div>

      {/* Risk badge */}
      <div className={`${category.bgColor} ${category.textColor} px-6 py-3 rounded-xl text-center shadow-sm`}>
        <div className="flex items-center justify-center space-x-2">
          <span className="text-2xl">{category.badge}</span>
          <div>
            <p className="font-bold text-lg">{category.text}</p>
            <p className="text-sm opacity-80">{category.desc}</p>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
        Lower scores indicate safer farming conditions.
        Your score is in the <span className={category.textColor + ' font-semibold'}>{score <= 40 ? 'safe' : 'elevated'}</span> range.
      </p>
    </div>
  );
};

export default RiskScoreGauge;
