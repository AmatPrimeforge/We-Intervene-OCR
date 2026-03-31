'use client';

import { useEffect, useState } from 'react';

interface EngineInfo {
  engines: string[];
  available: string[];
  default: string | null;
}

interface EngineSelectorProps {
  selectedEngine: string;
  onEngineChange: (engine: string) => void;
}

const ENGINE_LABELS: Record<string, { name: string; description: string }> = {
  google: {
    name: 'Google Vision',
    description: 'High accuracy, cloud-based (requires billing)',
  },
  tesseract: {
    name: 'Tesseract',
    description: 'Free, runs locally (slower, less accurate)',
  },
};

export default function EngineSelector({ selectedEngine, onEngineChange }: EngineSelectorProps) {
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ocr')
      .then((res) => res.json())
      .then((data: EngineInfo) => {
        setEngineInfo(data);
        // Set default engine if none selected
        if (!selectedEngine && data.default) {
          onEngineChange(data.default);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedEngine, onEngineChange]);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg h-12"></div>
    );
  }

  if (!engineInfo) {
    return (
      <div className="text-sm text-red-500">Failed to load OCR engines</div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        OCR Engine
      </label>
      <div className="grid grid-cols-2 gap-2">
        {engineInfo.engines.map((engine) => {
          const isAvailable = engineInfo.available.includes(engine);
          const info = ENGINE_LABELS[engine] || { name: engine, description: '' };
          const isSelected = selectedEngine === engine;

          return (
            <button
              key={engine}
              type="button"
              disabled={!isAvailable}
              onClick={() => onEngineChange(engine)}
              className={`
                relative p-3 rounded-lg border-2 text-left transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : isAvailable
                    ? 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                  {info.name}
                </span>
                {isSelected && (
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className={`text-xs mt-1 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                {info.description}
              </p>
              {!isAvailable && (
                <span className="absolute top-1 right-1 text-xs text-orange-500 font-medium">
                  Not configured
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
