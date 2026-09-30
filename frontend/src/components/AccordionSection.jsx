import React from 'react';
import { ChevronDown } from 'lucide-react';

const AccordionSection = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children
}) => {
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Accordion Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-farm-green-50 transition-colors duration-150 rounded-lg"
      >
        <div className="flex items-center">
          {icon ? <span className="text-xl mr-3" aria-hidden="true">{icon}</span> : null}
          <span className="text-base font-bold text-gray-800">{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-farm-green-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'
            }`}
        />
      </button>

      {/* Accordion Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="px-4 py-4 space-y-4 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AccordionSection;
