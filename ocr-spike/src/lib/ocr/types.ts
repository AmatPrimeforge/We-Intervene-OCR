// Shared OCR types for all engines

export interface OcrBlock {
  text: string;
  confidence: number;
}

export interface OcrResult {
  success: true;
  text: string;
  blocks: OcrBlock[];
  metadata: {
    filename: string;
    type: string;
    size: number;
    processedAt: string;
    engine: string;
  };
}

export interface OcrError {
  success: false;
  error: string;
  details?: string;
}

export type OcrResponse = OcrResult | OcrError;

export interface OcrEngine {
  name: string;
  process(buffer: Buffer, filename: string, fileType: string, fileSize: number): Promise<OcrResult>;
}

export const SUPPORTED_ENGINES = ['google', 'tesseract'] as const;
export type EngineName = (typeof SUPPORTED_ENGINES)[number];

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export function isValidEngine(engine: string): engine is EngineName {
  return SUPPORTED_ENGINES.includes(engine as EngineName);
}
