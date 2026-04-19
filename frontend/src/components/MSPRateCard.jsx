import React from 'react';
import { TrendingUp, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from '../i18n';
import mspData from '../data/msp_data.json';

const MSPRateCard = ({ primaryCrop, currentMarketPrice }) => {
  const { t } = useTranslation();

  const cropMspData = mspData.crops[primaryCrop];
  const mspRate = cropMspData?.msp || null;

  const priceDifference = mspRate && currentMarketPrice
    ? ((currentMarketPrice - mspRate) / mspRate * 100).toFixed(1)
    : null;

  const isAboveMsp = priceDifference && parseFloat(priceDifference) > 0;

  if (!mspRate) {
    return (
      <div className="card-farm p-6 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="flex items-center mb-4">
          <div className="bg-yellow-100 p-2 rounded-lg mr-3">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">
            {t('msp.title') || 'MSP Rate Card'}
          </h3>
        </div>
        <p className="text-gray-600 text-sm">
          {t('msp.selectCrop') || 'Run a simulation to see MSP for your selected crop'}
        </p>
      </div>
    );
  }

  return (
    <div className="card-farm p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-l-4 border-yellow-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-yellow-100 p-2 rounded-lg mr-3">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {t('msp.title') || 'MSP Rate Card'}
            </h3>
            <p className="text-xs text-gray-500">{t(`seasons.${mspData.season?.toLowerCase()}`) || mspData.season}</p>
          </div>
        </div>
        <a
          href="/msp"
          className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center"
        >
          {t('msp.viewAll') || 'View All'}
          <ExternalLink className="w-4 h-4 ml-1" />
        </a>
      </div>

      {/* Main MSP Display */}
      <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">{t('msp.currentMsp') || 'Current MSP'}</p>
            <p className="text-2xl font-bold text-gray-900">
              {t(`crops.${primaryCrop.toLowerCase()}`) || primaryCrop}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-yellow-600">₹{Math.round(mspRate).toLocaleString('en-IN')}</p>
            <p className="text-sm text-gray-500">{t('msp.perQuintal') || 'per quintal'}</p>
          </div>
        </div>
      </div>

      {/* Market Price Comparison */}
      {currentMarketPrice && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600">{t('sidebar.marketInfo') || 'Market Price'}</p>
              <p className="text-xl font-semibold text-gray-800">₹{Math.round(currentMarketPrice).toLocaleString('en-IN')}</p>
            </div>
            <div className={`text-right px-3 py-1 rounded-lg ${isAboveMsp ? 'bg-green-100' : 'bg-red-100'
              }`}>
              <p className={`text-lg font-bold ${isAboveMsp ? 'text-green-600' : 'text-red-600'}`}>
                {isAboveMsp ? '+' : ''}{priceDifference}%
              </p>
              <p className="text-xs text-gray-600">
                {isAboveMsp ? t('common.increase') || 'vs MSP' : t('common.decrease') || 'vs MSP'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-4 flex items-start text-xs text-gray-500">
        <Info className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
        <p>{t('msp.infoText') || 'MSP is the minimum price at which the government purchases crops from farmers.'}</p>
      </div>
    </div>
  );
};

export default MSPRateCard;
