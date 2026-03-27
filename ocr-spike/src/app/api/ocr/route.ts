import { NextRequest, NextResponse } from 'next/server';

// Use Vision API REST endpoint with API key (no service account needed)
const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

interface VisionApiResponse {
  responses: Array<{
    fullTextAnnotation?: {
      text: string;
      pages?: Array<{
        blocks?: Array<{
          confidence?: number;
          paragraphs?: Array<{
            words?: Array<{
              symbols?: Array<{
                text: string;
              }>;
            }>;
          }>;
        }>;
      }>;
    };
    error?: {
      message: string;
    };
  }>;
}

async function callVisionApi(imageBase64: string, apiKey: string): Promise<VisionApiResponse> {
  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: imageBase64,
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: 'Google Cloud API key not configured', 
          details: 'Set GOOGLE_CLOUD_API_KEY in .env.local' 
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (Note: PDF requires different handling with REST API)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // Call Vision API
    const visionResponse = await callVisionApi(base64, apiKey);
    
    const result = visionResponse.responses[0];
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    const annotation = result.fullTextAnnotation;
    const fullText = annotation?.text || '';
    
    // Extract blocks with confidence scores
    const blocks: Array<{ text: string; confidence: number }> = [];
    if (annotation?.pages) {
      for (const page of annotation.pages) {
        for (const block of page.blocks || []) {
          const blockText = block.paragraphs
            ?.map(p => p.words?.map(w => w.symbols?.map(s => s.text).join('')).join(' '))
            .join('\n') || '';
          blocks.push({
            text: blockText,
            confidence: block.confidence || 0,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      text: fullText,
      blocks,
      metadata: {
        filename: file.name,
        type: file.type,
        size: file.size,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('OCR Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'OCR processing failed', 
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
