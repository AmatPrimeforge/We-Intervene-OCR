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
          details: 'Configure GOOGLE_CLOUD_API_KEY for Google Vision, or Tesseract should always be available.' 
        },
        { status: 500 }
      );
    }

    if (!isValidEngine(engineName)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid engine: ${engineName}`, 
          details: `Supported engines: ${SUPPORTED_ENGINES.join(', ')}` 
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

    // Validate file type (now supports images AND PDFs)
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid file type: ${file.type}`, 
          details: `Allowed: ${ALLOWED_FILE_TYPES.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the engine
    const engine = getOcrEngine(engineName);

    // Handle PDF files
    if (isPdfFile(file.type)) {
      return await processPdf(buffer, file.name, file.type, file.size, engine);
    }

    // Handle image files (original logic)
    const result = await engine.process(buffer, file.name, file.type, file.size);
    
    // Add pageCount for consistency
    return NextResponse.json({
      ...result,
      metadata: {
        ...result.metadata,
        pageCount: 1,
      },
    });
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
 * Process a multi-page PDF document
 */
async function processPdf(
  buffer: Buffer,
  filename: string,
  fileType: string,
  fileSize: number,
  engine: { name: string; process: (buffer: Buffer, filename: string, fileType: string, fileSize: number) => Promise<OcrResult> }
) {
  // Convert PDF to images
  const conversionResult = await convertPdfToImages(buffer);
  
  if (!conversionResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: conversionResult.error,
        details: conversionResult.details,
      },
      { status: 400 }
    );
  }

  const { images, pageCount, totalPages } = conversionResult;
  
  // Process each page
  const pageResults: OcrPageResult[] = [];
  const allBlocks: OcrBlock[] = [];
  const allTexts: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const pageBuffer = images[i];
    const pageFilename = `${filename}_page_${i + 1}.png`;
    
    try {
      const pageResult = await engine.process(pageBuffer, pageFilename, 'image/png', pageBuffer.length);
      
      // Calculate average confidence for the page
      const avgConfidence = pageResult.blocks.length > 0
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
      // Add error placeholder for this page
      pageResults.push({
        pageNumber: i + 1,
        text: `[Error processing page ${i + 1}]`,
        blocks: [],
        confidence: 0,
      });
    }
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
