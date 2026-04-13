// Shared OCR types for all engines

// ============================================
// PDF Configuration
// ============================================

/** Maximum number of PDF pages to process. Adjust as needed. */
export const MAX_PDF_PAGES = 5;

// ============================================
// Core Types
// ============================================

export interface OcrBlock {
  text: string;
  confidence: number;
}

/** Result for a single page in multi-page documents */
export interface OcrPageResult {
  pageNumber: number;
  text: string;
  blocks: OcrBlock[];
  confidence: number; // Average confidence for the page
}

export interface OcrResult {
  success: true;
  text: string;
  blocks: OcrBlock[];
  /** Per-page results for multi-page documents (PDFs) */
  pages?: OcrPageResult[];
  /** Page-level errors encountered during processing (partial failure) */
  errors?: string[];
  metadata: {
    filename: string;
    type: string;
    size: number;
    processedAt: string;
    engine: string;
    /** Total number of pages processed (1 for images, 1+ for PDFs) */
    pageCount: number;
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

// ============================================
// Supported Engines
// ============================================

export const SUPPORTED_ENGINES = ['google', 'tesseract'] as const;
export type EngineName = (typeof SUPPORTED_ENGINES)[number];

// ============================================
// Allowed File Types
// ============================================

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
];

// ============================================
// Helper Functions
// ============================================

export function isValidEngine(engine: string): engine is EngineName {
  return SUPPORTED_ENGINES.includes(engine as EngineName);
}

export function isPdfFile(fileType: string): boolean {
  return fileType === 'application/pdf';
}

export function isImageFile(fileType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(fileType);
}
