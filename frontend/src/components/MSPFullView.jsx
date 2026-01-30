import React, { useState, useMemo } from 'react';
import { TrendingUp, Search, Filter, ArrowUpDown, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../i18n';
import mspData from '../data/msp_data.json';

const MSPFullView = ({ onBack }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'crop', direction: 'asc' });

  const crops = useMemo(() => {
    return Object.entries(mspData.crops).map(([name, data]) => ({
      name,
      translatedName: t(`crops.${name.toLowerCase()}`) || name,
      msp: data.msp,
      unit: data.unit,
      season: data.season,
      translatedSeason: t(`seasons.${data.season.toLowerCase()}`) || data.season
    }));
  }, [t]);

  const filteredAndSortedCrops = useMemo(() => {
    let result = [...crops];

    // Filter by search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(crop =>
        crop.name.toLowerCase().includes(searchLower) ||
        crop.translatedName.toLowerCase().includes(searchLower)
      );
    }

    // Filter by season
    if (seasonFilter !== 'all') {
      result = result.filter(crop => crop.season === seasonFilter);
    }

    // Sort
    result.sort((a, b) => {
      let aValue = sortConfig.key === 'crop' ? a.name : a.msp;
      let bValue = sortConfig.key === 'crop' ? b.name : b.msp;

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [crops, searchTerm, seasonFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSeasonColor = (season) => {
    switch (season) {
      case 'Kharif': return 'bg-green-100 text-green-700';
      case 'Rabi': return 'bg-blue-100 text-blue-700';
      case 'Annual': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            {onBack && (
              <button
                onClick={onBack}
                className="mr-4 p-2 hover:bg-white rounded-lg transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                <TrendingUp className="w-7 h-7 mr-2 text-yellow-600" />
                {t('msp.allRates') || 'All MSP Rates'}
              </h1>
              <p className="text-sm text-gray-600">{mspData.season}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('common.search') || 'Search crops...'}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none"
                style={{ fontSize: '16px' }}
              />
            </div>

            {/* Season Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none"
              >
                <option value="all">{t('msp.allSeasons') || 'All Seasons'}</option>
                <option value="Kharif">{t('seasons.kharif') || 'Kharif'}</option>
                <option value="Rabi">{t('seasons.rabi') || 'Rabi'}</option>
                <option value="Annual">{t('seasons.annual') || 'Annual'}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-yellow-50 border-b-2 border-yellow-100">
                <tr>
                  <th
                    className="px-6 py-4 text-left cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => handleSort('crop')}
                  >
                    <div className="flex items-center font-semibold text-gray-700">
                      {t('msp.cropName') || 'Crop Name'}
                      <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">
                    {t('msp.season') || 'Season'}
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => handleSort('msp')}
                  >
                    <div className="flex items-center justify-end font-semibold text-gray-700">
                      {t('msp.mspRate') || 'MSP Rate (₹/quintal)'}
                      <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedCrops.map((crop, index) => (
                  <tr
                    key={crop.name}
                    className={`border-b border-gray-100 hover:bg-yellow-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{crop.translatedName}</p>
                        <p className="text-sm text-gray-500">{crop.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeasonColor(crop.season)}`}>
                        {crop.translatedSeason}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xl font-bold text-yellow-600">₹{crop.msp.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedCrops.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('common.noResults') || 'No crops found'}
            </div>
          )}
        </div>

        {/* Source Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>{t('msp.source') || 'Source'}: {mspData.source}</p>
          <p>{t('msp.lastUpdated') || 'Last Updated'}: {mspData.lastUpdated}</p>
        </div>
      </div>
    </div>
  );
};

export default MSPFullView;
