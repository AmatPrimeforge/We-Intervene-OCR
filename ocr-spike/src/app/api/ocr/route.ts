import { NextRequest, NextResponse } from 'next/server';
import { getOcrEngine, getAvailableEngines, ALLOWED_IMAGE_TYPES, isValidEngine, SUPPORTED_ENGINES } from '@/lib/ocr';

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

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid file type: ${file.type}`, 
          details: `Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get the engine and process
    const engine = getOcrEngine(engineName);
    const result = await engine.process(buffer, file.name, file.type, file.size);

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
