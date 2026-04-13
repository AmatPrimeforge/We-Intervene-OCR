// OCR Engine Factory
// Provides a unified interface to get different OCR engines

import { OcrEngine, EngineName, isValidEngine, SUPPORTED_ENGINES } from './types';
import { createGoogleVisionEngine } from './google-vision';
import { createTesseractEngine } from './tesseract';

export * from './types';
export * from './pdf-converter';

/**
 * Get an OCR engine by name
 * @param engineName - The name of the engine ('google' or 'tesseract')
 * @returns The OCR engine instance
 * @throws Error if engine name is invalid or engine cannot be initialized
 */
export function getOcrEngine(engineName: string): OcrEngine {
  if (!isValidEngine(engineName)) {
    throw new Error(
      `Invalid OCR engine: "${engineName}". Supported engines: ${SUPPORTED_ENGINES.join(', ')}`
    );
  }

  switch (engineName) {
    case 'google':
      return createGoogleVisionEngine();
    case 'tesseract':
      return createTesseractEngine();
    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = engineName;
      throw new Error(`Unhandled engine: ${_exhaustive}`);
  }
}

/**
 * Check if a specific engine is available (has required config)
 * @param engineName - The name of the engine to check
 * @returns true if the engine can be used
 */
export function isEngineAvailable(engineName: EngineName): boolean {
  switch (engineName) {
    case 'google':
      return !!process.env.GOOGLE_CLOUD_API_KEY;
    case 'tesseract':
      return true; // Always available (runs locally)
    default:
      return false;
  }
}

/**
 * Get list of available engines based on configuration
 * @returns Array of available engine names
 */
export function getAvailableEngines(): EngineName[] {
  return SUPPORTED_ENGINES.filter(isEngineAvailable);
}
