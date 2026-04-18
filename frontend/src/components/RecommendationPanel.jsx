import React from 'react';
import { Lightbulb, TrendingUp, Shield, Target, ArrowRight } from 'lucide-react';
import PriceForecastChart from './PriceForecastChart';
import GovernmentSchemes from './GovernmentSchemes';

// Helper function to format recommendation text (remove markdown asterisks, format properly)
const formatRecommendation = (text) => {
  if (!text) return null;

  // Process the text into formatted sections
  const lines = text.split('\n').filter(line => line.trim());

  return lines.map((line, index) => {
    let processedLine = line.trim();

    // Handle **bold** text by converting to strong styling
    processedLine = processedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Check if it's a bullet point
    const isBullet = processedLine.startsWith('•') || processedLine.startsWith('-');

    // Check if it's a header (starts with emoji or uppercase)
    const isHeader = /^[🌾💡📊💰✅🎯]/.test(processedLine) ||
      (processedLine.startsWith('<strong>') && processedLine.endsWith('</strong>'));

    if (isBullet) {
      return (
        <li key={index} className="text-gray-700 ml-4 mb-1">
          <span dangerouslySetInnerHTML={{ __html: processedLine.replace(/^[•-]\s*/, '') }} />
        </li>
      );
    } else if (isHeader) {
      return (
        <p key={index} className="font-semibold text-gray-800 mt-4 mb-2">
          <span dangerouslySetInnerHTML={{ __html: processedLine }} />
        </p>
      );
    } else {
      return (
        <p key={index} className="text-gray-700 mb-2">
          <span dangerouslySetInnerHTML={{ __html: processedLine }} />
        </p>
      );
    }
  });
};

const RecommendationPanel = ({ recommendationData, simulationData, formData }) => {
  if (!recommendationData) return null;

  return (
    <div className="space-y-6">
      {/* AI Recommendation Card */}
      <div className="card-farm card-glow p-4 sm:p-8 bg-gradient-to-br from-farm-green-50 to-white animate-fade-in">
        <div className="flex items-start mb-6">
          <div className="bg-gradient-to-r from-farm-green-500 to-farm-green-600 p-3 sm:p-4 rounded-2xl mr-3 sm:mr-4 flex-shrink-0">
            <Lightbulb className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
              AI-Powered Strategy Recommendation
            </h2>
            <p className="text-gray-600">
              Based on advanced simulation and market analysis
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border-l-4 border-farm-green-500">
          <div className="prose max-w-none">
            {formatRecommendation(recommendationData.recommendation_text)}
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Profit Impact */}
        <div className="card-farm card-glow p-6 animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-3 rounded-xl mr-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Profit Impact</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Profit</p>
              <p className="text-2xl font-bold text-gray-700">
                ₹{(recommendationData.current_profit / 1000).toFixed(1)}k
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-green-500 mx-auto" />
            <div>
              <p className="text-sm text-gray-600 mb-1">Optimized Profit</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{(recommendationData.optimal_profit / 1000).toFixed(1)}k
              </p>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Improvement</p>
              <p className="text-xl font-bold text-green-500">
                +₹{(recommendationData.profit_improvement / 1000).toFixed(1)}k
              </p>
            </div>
          </div>
        </div>

        {/* Risk Improvement */}
        <div className="card-farm card-glow p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-3 rounded-xl mr-3">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Risk Reduction</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Risk</p>
              <p className="text-2xl font-bold text-red-600">
                {recommendationData.current_risk.toFixed(0)}/100
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-500 mx-auto" />
            <div>
              <p className="text-sm text-gray-600 mb-1">Optimized Risk</p>
              <p className="text-2xl font-bold text-green-600">
                {recommendationData.optimal_risk.toFixed(0)}/100
              </p>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Reduction</p>
              <p className="text-xl font-bold text-blue-500">
                -{recommendationData.risk_reduction.toFixed(1)} points
              </p>
            </div>
          </div>
        </div>

        {/* Key Optimizations */}
        <div className="card-farm card-glow p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center mb-4">
            <div className="bg-yellow-100 p-3 rounded-xl mr-3">
              <Target className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Key Changes</h3>
          </div>
          <div className="space-y-2">
            <div className="bg-farm-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Seed Quality</p>
              <p className="text-sm font-bold text-farm-green-700">
                {(recommendationData.optimal_parameters.seed_quality * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-sky-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Irrigation</p>
              <p className="text-sm font-bold text-sky-blue-700">
                {recommendationData.optimal_parameters.irrigation_frequency}x/month
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Pest Control</p>
              <p className="text-sm font-bold text-yellow-700">
                {(recommendationData.optimal_parameters.pest_control_intensity * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="card-farm card-glow p-6 animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Action Items</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendationData.key_insights.map((insight, idx) => (
            <div
              key={idx}
              className="flex items-start p-4 bg-gradient-to-r from-farm-green-50 to-white rounded-xl border-l-4 border-farm-green-500"
            >
              <div className="bg-farm-green-500 rounded-full p-2 mr-3 flex-shrink-0">
                <span className="text-white font-bold text-sm">{idx + 1}</span>
              </div>
              <p className="text-sm text-gray-700">{insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Price Forecast */}
      {simulationData && simulationData.price_forecast && (
        <PriceForecastChart forecastData={simulationData.price_forecast} />
      )}

      {/* Government Schemes */}
      <GovernmentSchemes formData={formData} simulationData={simulationData} />
    </div>
  );
};

export default RecommendationPanel;
