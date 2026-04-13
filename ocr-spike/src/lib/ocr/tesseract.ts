import { createWorker, PSM, OEM } from 'tesseract.js';
import sharp from 'sharp';
import { OcrEngine, OcrResult, OcrBlock } from './types';

/**
 * Preprocess image for better OCR results
 * - Convert to grayscale
 * - Increase contrast
 * - Upscale for better recognition
 * - Apply threshold for cleaner text
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    // Get image metadata first
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;

    // Calculate scale factor to get ~300 DPI equivalent
    // Tesseract works best with larger images (minimum 300 DPI)
    const minDimension = Math.min(width, height);
    const scaleFactor = minDimension < 1000 ? Math.ceil(1500 / minDimension) : 1;

    let processed = sharp(buffer)
      // Convert to grayscale - removes color noise
      .grayscale()
      // Normalize contrast - spreads histogram for better contrast
      .normalize()
      // Increase sharpness slightly
      .sharpen({ sigma: 1.5 })
      // Increase contrast
      .linear(1.2, -(128 * 1.2 - 128));

    // Upscale if image is small
    if (scaleFactor > 1) {
      processed = processed.resize({
        width: width * scaleFactor,
        height: height * scaleFactor,
        kernel: 'lanczos3', // High quality upscaling
      });
    }

    // Output as PNG (lossless) for best OCR results
    return await processed.png().toBuffer();
  } catch (error) {
    console.warn('Image preprocessing failed, using original:', error);
    return buffer;
  }
}

export class TesseractEngine implements OcrEngine {
  name = 'tesseract';

  async process(buffer: Buffer, filename: string, fileType: string, fileSize: number): Promise<OcrResult> {
    // Preprocess image for better OCR
    console.log('Preprocessing image for Tesseract...');
    const processedBuffer = await preprocessImage(buffer);
    console.log(`Original: ${buffer.length} bytes, Processed: ${processedBuffer.length} bytes`);

    // Create worker with explicit configuration for Node.js
    // OEM.LSTM_ONLY (1) uses the newer LSTM neural network engine for better accuracy
    const worker = await createWorker('eng', OEM.LSTM_ONLY, {
      logger: (m) => {
        if (process.env.NODE_ENV === 'development' && m.status === 'recognizing text') {
          console.log(`Tesseract progress: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });

    try {
      // Set parameters for better text detection on complex images like flyers
      await worker.setParameters({
        // PSM 11 = Sparse text. Find as much text as possible in no particular order.
        // This is best for flyers/posters with scattered text
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        // Preserve interword spaces
        preserve_interword_spaces: '1',
        // Don't limit character set - recognize all
        tessedit_char_blacklist: '',
      });

      // Convert processed buffer to base64 data URL for Tesseract
      const base64 = processedBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      const result = await worker.recognize(dataUrl);

      const fullText = result.data.text || '';
      
      // Extract blocks with confidence scores
      const blocks: OcrBlock[] = [];
      if (result.data.blocks) {
        for (const block of result.data.blocks) {
          blocks.push({
            text: block.text || '',
            confidence: (block.confidence || 0) / 100, // Normalize to 0-1 range
          });
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
          pageCount: 1,
        },
      };
    } finally {
      // Always terminate the worker to free resources
      await worker.terminate();
    }
  }
}

export function createTesseractEngine(): TesseractEngine {
  return new TesseractEngine();
}
