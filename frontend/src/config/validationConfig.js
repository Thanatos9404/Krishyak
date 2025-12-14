// Validation configuration for farming inputs
// Defines optimal ranges, feedback messages, and color coding by crop type

export const FERTILIZER_RANGES = {
  Rice: {
    Urea: { optimal: [100, 120], acceptable: [80, 140], warning: [60, 160], unit: 'kg/ha' },
    DAP: { optimal: [40, 60], acceptable: [30, 70], warning: [20, 80], unit: 'kg/ha' },
    MOP: { optimal: [30, 50], acceptable: [20, 60], warning: [15, 70], unit: 'kg/ha' },
    NPK: { optimal: [0, 30], acceptable: [0, 50], warning: [0, 70], unit: 'kg/ha' },
    Organic: { optimal: [15, 25], acceptable: [10, 35], warning: [5, 50], unit: 'kg/ha' }
  },
  Wheat: {
    Urea: { optimal: [110, 130], acceptable: [90, 150], warning: [70, 170], unit: 'kg/ha' },
    DAP: { optimal: [50, 70], acceptable: [40, 80], warning: [30, 90], unit: 'kg/ha' },
    MOP: { optimal: [25, 40], acceptable: [20, 50], warning: [15, 60], unit: 'kg/ha' },
    NPK: { optimal: [0, 30], acceptable: [0, 50], warning: [0, 70], unit: 'kg/ha' },
    Organic: { optimal: [20, 30], acceptable: [15, 40], warning: [10, 50], unit: 'kg/ha' }
  },
  // Default values for crops not specifically configured
  default: {
    Urea: { optimal: [90, 130], acceptable: [70, 150], warning: [50, 180], unit: 'kg/ha' },
    DAP: { optimal: [40, 70], acceptable: [30, 80], warning: [20, 100], unit: 'kg/ha' },
    MOP: { optimal: [25, 50], acceptable: [15, 60], warning: [10, 80], unit: 'kg/ha' },
    NPK: { optimal: [0, 40], acceptable: [0, 60], warning: [0, 80], unit: 'kg/ha' },
    Organic: { optimal: [15, 30], acceptable: [10, 40], warning: [5, 60], unit: 'kg/ha' }
  }
};

export const RAINFALL_RANGES = {
  Rice: { optimal: [750, 1200], acceptable: [600, 1500], warning: [400, 2000] },
  Wheat: { optimal: [400, 700], acceptable: [300, 900], warning: [200, 1100] },
  Maize: { optimal: [500, 900], acceptable: [400, 1100], warning: [300, 1300] },
  Cotton: { optimal: [600, 1000], acceptable: [500, 1200], warning: [400, 1400] },
  Sugarcane: { optimal: [1000, 1500], acceptable: [800, 1800], warning: [600, 2100] },
  default: { optimal: [500, 1000], acceptable: [400, 1200], warning: [300, 1500] }
};

export const IRRIGATION_RANGES = {
  Rice: { optimal: [4, 8], acceptable: [3, 10], warning: [2, 12] },
  Wheat: { optimal: [3, 6], acceptable: [2, 8], warning: [1, 10] },
  default: { optimal: [3, 7], acceptable: [2, 9], warning: [1, 11] }
};

// Get validation status and message for a value
export const getValidationStatus = (value, ranges) => {
  if (value >= ranges.optimal[0] && value <= ranges.optimal[1]) {
    return {
      status: 'optimal',
      color: 'border-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      message: '✅ Optimal range'
    };
  } else if (value >= ranges.acceptable[0] && value <= ranges.acceptable[1]) {
    return {
      status: 'acceptable',
      color: 'border-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      message: '⚠️ Acceptable, but not optimal'
    };
  } else if (value >= ranges.warning[0] && value <= ranges.warning[1]) {
    return {
      status: 'warning',
      color: 'border-orange-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      message: '⚠️ May affect yield or cost'
    };
  } else {
    return {
      status: 'danger',
      color: 'border-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      message: '❌ Outside recommended range'
    };
  }
};

export const getFertilizerMessage = (fertilizer, value, crop) => {
  const ranges = FERTILIZER_RANGES[crop] || FERTILIZER_RANGES.default;
  const fertRanges = ranges[fertilizer];

  if (!fertRanges) return null;

  const status = getValidationStatus(value, fertRanges);

  if (status.status === 'optimal') {
    return { ...status, message: `✅ Optimal for ${crop} cultivation` };
  } else if (value > fertRanges.optimal[1]) {
    const excess = value - fertRanges.optimal[1];
    return {
      ...status,
      message: `⚠️ High ${fertilizer}. Consider reducing by ${excess.toFixed(0)} kg to avoid waste`
    };
  } else if (value < fertRanges.optimal[0]) {
    const deficit = fertRanges.optimal[0] - value;
    return {
      ...status,
      message: `⚠️ Below recommended. May reduce yield by 10-15%`
    };
  }

  return status;
};
