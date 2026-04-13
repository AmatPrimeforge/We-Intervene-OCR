// PDF to Image Conversion Utility
// Converts PDF pages to PNG image buffers for OCR processing

// NOTE: pdf-to-img is dynamically imported to avoid Next.js bundling issues with pdfjs-dist
import { MAX_PDF_PAGES } from './types';

export interface PdfConversionResult {
  success: true;
  images: Buffer[];
  pageCount: number;
  totalPages: number; // Total pages in PDF (may be > pageCount if truncated)
}

export interface PdfConversionError {
  success: false;
  error: string;
  details?: string;
}

export type PdfConversionResponse = PdfConversionResult | PdfConversionError;

/**
 * Convert PDF pages to PNG image buffers
 * @param buffer - The PDF file as a Buffer
 * @returns Array of PNG image buffers (one per page, up to MAX_PDF_PAGES)
 */
export async function convertPdfToImages(buffer: Buffer): Promise<PdfConversionResponse> {
  try {
    // Dynamic import to avoid Next.js webpack bundling issues with pdfjs-dist
    const { pdf } = await import('pdf-to-img');
    
    const images: Buffer[] = [];
    let pageNumber = 0;
    let totalPages = 0;

    // pdf-to-img returns an async iterator of pages
    const document = await pdf(buffer, { scale: 2.0 }); // scale 2.0 for better OCR quality
    
    for await (const page of document) {
      totalPages++;
      
      // Enforce page limit
      if (pageNumber >= MAX_PDF_PAGES) {
        continue; // Continue counting total pages but don't process
      }
      
      // page is a Buffer containing PNG data
      images.push(page);
      pageNumber++;
    }

    if (images.length === 0) {
      return {
        success: false,
        error: 'PDF contains no pages',
        details: 'The uploaded PDF file appears to be empty.',
      };
    }

    return {
      success: true,
      images,
      pageCount: images.length,
      totalPages,
    };
  } catch (error) {
    // Log full error for debugging
    console.error('PDF conversion error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    // Handle common PDF errors
    if (errorMessage.includes('password')) {
      return {
        success: false,
        error: 'Password-protected PDF',
        details: 'Cannot process password-protected PDF files. Please remove the password and try again.',
      };
    }
    
    if (errorMessage.includes('Invalid') || errorMessage.includes('corrupt')) {
      return {
        success: false,
        error: 'Invalid PDF file',
        details: 'The uploaded file appears to be corrupted or is not a valid PDF.',
      };
    }

    return {
      success: false,
      error: 'PDF conversion failed',
      details: `${errorMessage}${errorStack ? '\n' + errorStack : ''}`,
    };
  }
}
//  * @param totalPages - Total number of pages in the PDF
//  * @returns true if the PDF was truncated
//  */
export function wasPdfTruncated(totalPages: number): boolean {
  return totalPages > MAX_PDF_PAGES;
}
