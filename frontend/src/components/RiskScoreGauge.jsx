import React, { useState, useEffect } from 'react';
import { getRiskInfo, getRiskHexColor } from '../utils/riskHelper';

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

  // Use centralized risk helper for color and label
  const color = getRiskHexColor(animatedScore);
  const category = getRiskInfo(score);

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative w-56 h-32 mb-2">
        <svg className="w-full h-full" viewBox="0 0 200 120" overflow="visible">
          {/* Background arc segments — using standardized thresholds: 0-25, 26-50, 51-75, 76-100 */}
          {/* Green segment (0-25) */}
          <path
            d="M 20 100 A 80 80 0 0 1 35.86 50.34"
            fill="none"
            stroke="#22c55e"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Yellow segment (26-50) */}
          <path
            d="M 38 47.5 A 80 80 0 0 1 66.94 24.5"
            fill="none"
            stroke="#eab308"
            strokeWidth="14"
          />

          {/* Orange segment (51-75) */}
          <path
            d="M 70 22.5 A 80 80 0 0 1 130 22.5"
            fill="none"
            stroke="#f97316"
            strokeWidth="14"
          />

          {/* Red segment (76-100) */}
          <path
            d="M 133.06 24.5 A 80 80 0 0 1 180 100"
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

      {/* Risk badge — using centralized thresholds */}
      <div className={`${category.badgeBg} px-6 py-3 rounded-xl text-center shadow-sm`}>
        <div className="flex items-center justify-center space-x-2">
          <span className="text-2xl">{category.emoji}</span>
          <div>
            <p className="font-bold text-lg">{category.label}</p>
            <p className="text-sm opacity-80">{category.desc}</p>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs text-gray-500 mt-3 text-center max-w-xs">
        Lower scores indicate safer farming conditions.
        Your score is in the <span className={category.textClass + ' font-semibold'}>{score <= 50 ? 'safe' : 'elevated'}</span> range.
      </p>
    </div>
  );
};

export default RiskScoreGauge;
