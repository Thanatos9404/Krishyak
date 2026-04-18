import React from 'react';
import { Settings } from 'lucide-react';

const FloatingActionButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-5 right-4 z-40 bg-gradient-to-r from-farm-green-500 to-farm-green-600 text-white rounded-2xl shadow-lg p-3.5 sm:px-4 sm:py-3.5 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
      style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))', marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
      <span className="font-semibold text-sm hidden sm:inline">Adjust Inputs</span>
    </button>
  );
};

export default FloatingActionButton;
