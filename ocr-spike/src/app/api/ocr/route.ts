import { NextRequest, NextResponse } from 'next/server';
import {
  getOcrEngine,
  getAvailableEngines,
  ALLOWED_FILE_TYPES,
  isValidEngine,
  SUPPORTED_ENGINES,
  isPdfFile,
  MAX_PDF_PAGES,
  convertPdfToImages,
  wasPdfTruncated,
  OcrEngine,
  OcrResult,
  OcrPageResult,
  OcrBlock,
} from '@/lib/ocr';

// GET: Return available engines
export async function GET() {
  const availableEngines = getAvailableEngines();
  return NextResponse.json({
    engines: SUPPORTED_ENGINES,
    available: availableEngines,
    default: availableEngines[0] || null,
  });
}

/**
 * Validate that the buffer's magic bytes match the declared MIME type.
 * Prevents MIME spoofing where a client sends an arbitrary file with a valid Content-Type.
 */
function validateFileBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  switch (mimeType) {
    case 'application/pdf':
      return buffer.slice(0, 5).toString('ascii') === '%PDF-';
    case 'image/jpeg':
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    case 'image/png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    case 'image/gif':
      return (
        buffer.slice(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.slice(0, 6).toString('ascii') === 'GIF89a'
      );
    case 'image/webp':
      return (
        buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
        buffer.slice(8, 12).toString('ascii') === 'WEBP'
      );
    default:
      return false;
  }
}

// POST: Process OCR with selected engine
export async function POST(request: NextRequest) {
  try {
    // Get engine from query param or default to first available
    const { searchParams } = new URL(request.url);
    const engineName = searchParams.get('engine') || getAvailableEngines()[0];

    if (!engineName) {
      return NextResponse.json(
        {
          success: false,
          error: 'No OCR engine available',
          details: 'Configure GOOGLE_CLOUD_API_KEY for Google Vision, or Tesseract should always be available.',
        },
        { status: 500 }
      );
    }

    if (!isValidEngine(engineName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid engine: ${engineName}`,
          details: `Supported engines: ${SUPPORTED_ENGINES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Sanitise filename at the boundary — file.name is client-supplied
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);

    // Validate file type (now supports images AND PDFs)
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${file.type}`,
          details: `Allowed: ${ALLOWED_FILE_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes — rejects MIME-spoofed payloads
    if (!validateFileBytes(buffer, file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file content',
          details: 'File content does not match the declared type.',
        },
        { status: 400 }
      );
    }

    // Get the engine
    const engine = getOcrEngine(engineName);

    // Handle PDF files
    if (isPdfFile(file.type)) {
      return await processPdf(buffer, safeFilename, file.type, file.size, engine);
    }

    // Handle image files
    const result = await engine.process(buffer, safeFilename, file.type, file.size);
    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'OCR processing failed',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * Process a multi-page PDF document.
 * Pages are consumed one at a time from the async iterable to minimise peak memory.
 */
async function processPdf(
  buffer: Buffer,
  filename: string,
  fileType: string,
  fileSize: number,
  engine: OcrEngine
) {
  // Convert PDF to a lazy stream of page images
  const conversionResult = await convertPdfToImages(buffer);

  if (!conversionResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: conversionResult.error,
        details: conversionResult.details,
      },
      { status: conversionResult.clientError ? 400 : 500 }
    );
  }

  const { pages, pageCount, totalPages } = conversionResult;

  // Process each page as it is yielded — buffers are released between iterations
  const pageResults: OcrPageResult[] = [];
  const allBlocks: OcrBlock[] = [];
  const allTexts: string[] = [];
  const pageErrors: string[] = [];

  let i = 0;
  for await (const pageBuffer of pages) {
    const pageFilename = `${filename}_page_${i + 1}.png`;

    try {
      const pageResult = await engine.process(pageBuffer, pageFilename, 'image/png', pageBuffer.length);

      // Calculate average confidence for the page
      const avgConfidence =
        pageResult.blocks.length > 0
          ? pageResult.blocks.reduce((sum, b) => sum + b.confidence, 0) / pageResult.blocks.length
          : 0;

      pageResults.push({
        pageNumber: i + 1,
        text: pageResult.text,
        blocks: pageResult.blocks,
        confidence: avgConfidence,
      });

      allTexts.push(pageResult.text);
      allBlocks.push(...pageResult.blocks);
    } catch (pageError) {
      console.error(`Error processing page ${i + 1}:`, pageError);
      const errMsg = pageError instanceof Error ? pageError.message : 'Unknown error';
      pageErrors.push(`Page ${i + 1}: ${errMsg}`);
      pageResults.push({
        pageNumber: i + 1,
        text: `[Error processing page ${i + 1}]`,
        blocks: [],
        confidence: 0,
      });
    }

    i++;
  }

  // Build the response
  const truncationNote = wasPdfTruncated(totalPages)
    ? `\n\n[Note: PDF had ${totalPages} pages. Only first ${MAX_PDF_PAGES} pages were processed.]`
    : '';

  const result: OcrResult = {
    success: true,
    text: allTexts.join('\n\n--- Page Break ---\n\n') + truncationNote,
    blocks: allBlocks,
    pages: pageResults,
    ...(pageErrors.length > 0 && { errors: pageErrors }),
    metadata: {
      filename,
      type: fileType,
      size: fileSize,
      processedAt: new Date().toISOString(),
      engine: engine.name,
      pageCount,
    },
  };

  return NextResponse.json(result);
}
