/**
 * Video Frame Extraction and Image Preprocessing for High-Accuracy OCR
 * Author/Credit: Shiro Anna
 */

// Image preprocessing options
export interface PreprocessOptions {
  grayscale?: boolean;
  contrastStretch?: boolean;
  binarize?: boolean;
  binarizeThreshold?: number; // 0-255, default 130
  sharpen?: boolean;
  invert?: boolean;
}

/**
 * Preprocess a canvas or image for optimal OCR character recognition
 */
export function preprocessCanvasForOcr(
  sourceCanvas: HTMLCanvasElement,
  options: PreprocessOptions = {}
): HTMLCanvasElement {
  const {
    grayscale = true,
    contrastStretch = true,
    binarize = false,
    binarizeThreshold = 135,
    sharpen = true,
  } = options;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const ctx = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  // Draw original image
  ctx.drawImage(sourceCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Step 1: Grayscale & find min/max intensity for contrast stretch
  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Rec. 709 luma formula
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;

    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // Step 2: Contrast Stretching (Normalize 0..255)
  if (contrastStretch && maxLum > minLum) {
    const range = maxLum - minLum;
    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i];
      const stretched = Math.min(255, Math.max(0, Math.round(((lum - minLum) / range) * 255)));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }
  }

  // Step 3: Optional Adaptive Binarization
  if (binarize) {
    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i];
      const val = lum >= binarizeThreshold ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Step 4: Simple sharpen via unsharp mask convolution if requested
  if (sharpen && !binarize) {
    applySharpenFilter(ctx, width, height);
  }

  return outputCanvas;
}

/**
 * 3x3 Convolution Sharpen Kernel
 */
function applySharpenFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const input = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = input.data;
  const dst = output.data;

  // Kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const val = 5 * src[idx + c] - src[top + c] - src[bottom + c] - src[left + c] - src[right + c];
        dst[idx + c] = Math.min(255, Math.max(0, val));
      }
      dst[idx + 3] = src[idx + 3]; // Alpha
    }
  }

  ctx.putImageData(output, 0, 0);
}

/**
 * Calculate difference (MSE) between two sampled frames to detect scrolling movement
 */
export function calculateFrameDifference(
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement,
  sampleWidth = 120,
  sampleHeight = 90
): number {
  const helperCanvas = document.createElement('canvas');
  helperCanvas.width = sampleWidth;
  helperCanvas.height = sampleHeight;
  const ctx = helperCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return 1.0;

  ctx.drawImage(canvasA, 0, 0, sampleWidth, sampleHeight);
  const dataA = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;

  ctx.clearRect(0, 0, sampleWidth, sampleHeight);
  ctx.drawImage(canvasB, 0, 0, sampleWidth, sampleHeight);
  const dataB = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let totalDiff = 0;
  const totalPixels = sampleWidth * sampleHeight;

  for (let i = 0; i < dataA.length; i += 4) {
    const diffR = Math.abs(dataA[i] - dataB[i]);
    const diffG = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const diffB = Math.abs(dataA[i + 2] - dataB[i + 2]);
    totalDiff += (diffR + diffG + diffB) / 3;
  }

  const avgPixelDiff = totalDiff / totalPixels; // 0 to 255
  return avgPixelDiff / 255; // Normalized 0.0 to 1.0
}

/**
 * Capture single frame from HTMLVideoElement to Canvas
 */
export function captureVideoFrame(video: HTMLVideoElement, scale = 1.0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale) || 1280;
  canvas.height = Math.round(video.videoHeight * scale) || 720;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}
