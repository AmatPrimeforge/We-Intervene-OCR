import { OcrEngine, OcrResult, OcrBlock } from './types';

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

export class GoogleVisionEngine implements OcrEngine {
  name = 'google';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async process(buffer: Buffer, filename: string, fileType: string, fileSize: number): Promise<OcrResult> {
    const base64 = buffer.toString('base64');
    const visionResponse = await callVisionApi(base64, this.apiKey);
    
    const result = visionResponse.responses[0];
    
    if (result.error) {
      throw new Error(result.error.message);
    }

    const annotation = result.fullTextAnnotation;
    const fullText = annotation?.text || '';
    
    // Extract blocks with confidence scores
    const blocks: OcrBlock[] = [];
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

    return {
      success: true,
      text: fullText,
      blocks,
      metadata: {
        filename,
        type: fileType,
        size: fileSize,
        processedAt: new Date().toISOString(),
        engine: this.name,
      },
    };
  }
}

export function createGoogleVisionEngine(): GoogleVisionEngine {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY environment variable is not set');
  }
  return new GoogleVisionEngine(apiKey);
}
