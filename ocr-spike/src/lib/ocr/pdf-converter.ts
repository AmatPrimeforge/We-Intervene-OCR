// PDF to Image Conversion Utility
// Converts PDF pages to PNG image buffers for OCR processing

// NOTE: pdf-to-img is dynamically imported to avoid Next.js bundling issues with pdfjs-dist
import { MAX_PDF_PAGES } from './types';

export interface PdfConversionResult {
  success: true;
  pages: AsyncIterable<Buffer>;
  pageCount: number;
  totalPages: number; // Total pages in PDF (may be > pageCount if truncated)
}

export interface PdfConversionError {
  success: false;
  error: string;
  details?: string;
  clientError: boolean; // true = bad input (400), false = server fault (500)
}

export type PdfConversionResponse = PdfConversionResult | PdfConversionError;

/**
 * Convert PDF pages to a lazy stream of PNG image buffers.
 * Pages are yielded one at a time to avoid holding all buffers in memory simultaneously.
 * @param buffer - The PDF file as a Buffer
 * @returns Async iterable of PNG image buffers (one per page, up to MAX_PDF_PAGES)
 */
export async function convertPdfToImages(buffer: Buffer): Promise<PdfConversionResponse> {
  try {
    // Dynamic import to avoid Next.js webpack bundling issues with pdfjs-dist
    const { pdf } = await import('pdf-to-img');

    const document = await pdf(buffer, { scale: 2.0 }); // scale 2.0 for better OCR quality
    const totalPages = document.length; // pdf-to-img v5 exposes numPages via .length

    if (totalPages === 0) {
      return {
        success: false,
        error: 'PDF contains no pages',
        details: 'The uploaded PDF file appears to be empty.',
        clientError: true,
      };
    }

    // Lazy async generator — yields one page buffer at a time up to MAX_PDF_PAGES.
    // Breaking early avoids rendering unused pages.
    const limitedPages = async function* (): AsyncGenerator<Buffer> {
      let count = 0;
      for await (const page of document) {
        yield page;
        count++;
        if (count >= MAX_PDF_PAGES) break;
      }
    };

    return {
      success: true,
      pages: limitedPages(),
      pageCount: Math.min(totalPages, MAX_PDF_PAGES),
      totalPages,
    };
  } catch (error) {
    // Log full error server-side for debugging
    console.error('PDF conversion error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle common PDF errors
    if (errorMessage.includes('password')) {
      return {
        success: false,
        error: 'Password-protected PDF',
        details: 'Cannot process password-protected PDF files. Please remove the password and try again.',
        clientError: true,
      };
    }

    if (errorMessage.includes('Invalid') || errorMessage.includes('corrupt')) {
      return {
        success: false,
        error: 'Invalid PDF file',
        details: 'The uploaded file appears to be corrupted or is not a valid PDF.',
        clientError: true,
      };
    }

    return {
      success: false,
      error: 'PDF conversion failed',
      details: 'An unexpected error occurred while processing the PDF.',
      clientError: false,
    };
  }
}

export function wasPdfTruncated(totalPages: number): boolean {
  return totalPages > MAX_PDF_PAGES;
}
