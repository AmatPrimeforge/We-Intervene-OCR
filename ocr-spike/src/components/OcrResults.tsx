'use client';

interface OcrResult {
  success: boolean;
  text: string;
  blocks: Array<{ text: string; confidence: number }>;
  metadata: {
    filename: string;
    type: string;
    size: number;
    processedAt: string;
  };
}

interface OcrResultsProps {
  result: OcrResult | null;
  error: string | null;
  isLoading: boolean;
}

export default function OcrResults({ result, error, isLoading }: OcrResultsProps) {
  if (isLoading) {
    return (
      <div className="w-full p-8 bg-white border border-gray-200 rounded-xl">
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Processing image with OCR...</p>
          <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-6 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="font-medium text-red-800">OCR Processing Failed</h3>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-full p-8 bg-gray-50 border border-gray-200 border-dashed rounded-xl">
        <div className="flex flex-col items-center justify-center text-gray-400">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No results yet</p>
          <p className="text-xs mt-1">Upload or capture a flyer to extract text</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header with metadata */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-gray-900">Extraction Complete</span>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(result.metadata.processedAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          {result.metadata.filename} • {(result.metadata.size / 1024).toFixed(1)} KB
        </div>
      </div>

      {/* Extracted text */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Extracted Text</h4>
        {result.text ? (
          <div className="p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
              {result.text}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No text detected in the image</p>
        )}
      </div>

      {/* Copy button */}
      {result.text && (
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              navigator.clipboard.writeText(result.text);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* Confidence blocks (collapsible) */}
      {result.blocks.length > 0 && (
        <details className="border-t border-gray-200">
          <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
            View confidence breakdown ({result.blocks.length} blocks)
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {result.blocks.map((block, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">Block {index + 1}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    block.confidence >= 0.9 
                      ? 'bg-green-100 text-green-700' 
                      : block.confidence >= 0.7 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {(block.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="text-sm text-gray-700">{block.text}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
