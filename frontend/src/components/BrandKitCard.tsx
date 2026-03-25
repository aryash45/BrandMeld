import React, { useState } from 'react';
import { BrandDNA } from '../services/apiService';

interface BrandKitCardProps {
  brandKit: BrandDNA;
}

const BrandKitCard: React.FC<BrandKitCardProps> = ({ brandKit }) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="mt-4 border border-slate-700 rounded-lg bg-slate-800/30 p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-sm font-medium text-teal-400 hover:underline"
      >
        {collapsed ? 'View Brand Kit ▾' : 'Hide Brand Kit ▴'}
      </button>
      {!collapsed && (
        <div className="mt-3 space-y-3">
          {/* Color Swatch */}
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded" style={{ backgroundColor: brandKit.primary_hex }} />
            <span className="text-sm">Primary Color: {brandKit.primary_hex}</span>
          </div>
          {/* Typography */}
          <div>
            <span className="font-semibold text-slate-300">Typography:</span>
            <span className="ml-2 text-sm">{brandKit.typography.join(', ')}</span>
          </div>
          {/* Personality */}
          <div>
            <span className="font-semibold text-slate-300">Personality:</span>
            <span className="ml-2 text-sm">{brandKit.voice_personality}</span>
          </div>
          {/* Banned concepts */}
          <div>
            <span className="font-semibold text-slate-300">Banned Concepts:</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {brandKit.banned_concepts.map((c, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-900/60 text-red-300 text-xs rounded">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandKitCard;
