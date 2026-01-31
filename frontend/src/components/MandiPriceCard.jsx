import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, MapPin, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchMandiPrices, formatIndianPrice } from '../services/govApiService';

/**
 * MandiPriceCard Component
 * Displays live mandi (market) prices for agricultural commodities
 */
const MandiPriceCard = ({
  commodity = null,
  state = null,
  district = null,
  showFilters = true,
  maxItems = 5,
  className = ''
}) => {
  const { t, i18n } = useTranslation();
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchMandiPrices({
        commodity,
        state,
        district,
        limit: 50
      });

      if (result.success && result.prices) {
        setPrices(result.prices);
        setLastUpdated(new Date(result.fetched_at || Date.now()));
      } else {
        setError(result.error || t('mandi.fetchError'));
        setPrices([]);
      }
    } catch (err) {
      setError(t('mandi.fetchError'));
      setPrices([]);
    } finally {
      setLoading(false);
    }
  }, [commodity, state, district, t]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const displayPrices = expanded ? prices : prices.slice(0, maxItems);

  const getPriceChangeIcon = (minPrice, maxPrice) => {
    const range = maxPrice - minPrice;
    const percentageRange = (range / minPrice) * 100;

    if (percentageRange > 10) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (percentageRange < 3) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {t('mandi.title')}
          </h3>
        </div>
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-green-600" />
          <span className="ml-2 text-gray-600">{t('mandi.loading')}</span>
        </div>
      </div>
    );
  }

  if (error && prices.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {t('mandi.title')}
          </h3>
          <button
            onClick={loadPrices}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-10 h-10 text-yellow-500 mb-2" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadPrices}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            {t('mandi.title')}
          </h3>
          <button
            onClick={loadPrices}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        </div>
        {lastUpdated && (
          <p className="text-green-100 text-xs mt-1">
            {t('mandi.lastUpdated')}: {lastUpdated.toLocaleTimeString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN')}
          </p>
        )}
      </div>

      {/* Price List */}
      <div className="divide-y divide-gray-100">
        {displayPrices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {t('mandi.noData')}
          </div>
        ) : (
          displayPrices.map((item, index) => (
            <div
              key={index}
              className="p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">
                    {item.commodity}
                    {item.variety && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({item.variety})
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <MapPin className="w-3 h-3 mr-1" />
                    {item.market}, {item.district}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end">
                    <span className="font-semibold text-green-700">
                      {formatIndianPrice(item.modal_price)}
                    </span>
                    {getPriceChangeIcon(item.min_price, item.max_price)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatIndianPrice(item.min_price)} - {formatIndianPrice(item.max_price)}
                  </div>
                  {item.arrival_date && (
                    <div className="text-xs text-gray-400 mt-1">
                      {item.arrival_date}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Expand/Collapse */}
      {prices.length > maxItems && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center text-sm text-gray-600"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              {t('mandi.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              {t('mandi.showMore')} ({prices.length - maxItems} {t('mandi.more')})
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          {t('mandi.source')}
        </p>
      </div>
    </div>
  );
};

export default MandiPriceCard;
