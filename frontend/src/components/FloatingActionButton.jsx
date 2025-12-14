import React from 'react';
import { Settings } from 'lucide-react';

const FloatingActionButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-6 right-6 z-40 bg-gradient-to-r from-farm-green-500 to-farm-green-600 text-white rounded-2xl shadow-lg p-4 transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center space-x-2"
    >
      <Settings className="w-6 h-6" />
      <span className="font-semibold">Adjust Inputs</span>
    </button>
  );
};

export default FloatingActionButton;
