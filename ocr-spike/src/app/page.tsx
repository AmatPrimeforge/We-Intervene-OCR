'use client';

import { useState, useCallback } from 'react';
import FileUpload from '@/components/FileUpload';
import CameraCapture from '@/components/CameraCapture';
import OcrResults from '@/components/OcrResults';
import EngineSelector from '@/components/EngineSelector';

type Tab = 'upload' | 'camera';

interface OcrResult {
  success: boolean;
  text: string;
  blocks: Array<{ text: string; confidence: number }>;
  metadata: {
    filename: string;
    type: string;
    size: number;
    processedAt: string;
    engine: string;
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>('tesseract');

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Pass selected engine as query param
      const response = await fetch(`/api/ocr?engine=${selectedEngine}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'OCR processing failed');
      }

      setResult(data);
    } catch (err) {
      console.error('OCR error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedEngine]);

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Flyer OCR Extraction
          </h1>
          <p className="mt-2 text-gray-600">
            Extract vendor data from flyer images using OCR
          </p>
        </div>

        {/* Engine Selector */}
        <div className="mb-6">
          <EngineSelector 
            selectedEngine={selectedEngine} 
            onEngineChange={setSelectedEngine} 
          />
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload File
            </span>
          </button>
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-3 px-4 text-sm font-medium text-center transition-colors ${
              activeTab === 'camera'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </span>
          </button>
        </div>

        {/* Input section */}
        <div className="mb-6">
          {activeTab === 'upload' ? (
            <FileUpload onFileSelect={processFile} isProcessing={isProcessing} />
          ) : (
            <CameraCapture onCapture={processFile} isProcessing={isProcessing} />
          )}
        </div>

        {/* Results section */}
        <OcrResults result={result} error={error} isLoading={isProcessing} />

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-gray-400">
          <p>OCR Spike PoC • Multi-Engine Support</p>
          <p className="mt-1">
            Supports: JPG, PNG, GIF, WebP
          </p>
        </div>
      </div>
    </main>
  );
}
