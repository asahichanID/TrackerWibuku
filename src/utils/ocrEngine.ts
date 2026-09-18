/**
 * Core Video OCR Engine with Frame Sampling, Tesseract Web Worker, and Deduplication
 * Author/Credit: Shiro Anna
 */

import { createWorker, Worker } from 'tesseract.js';
import { ScanResultItem } from '../types';
import { parseOcrLine, stringSimilarity } from './fuzzyMatching';
import { captureVideoFrame, calculateFrameDifference, preprocessCanvasForOcr, PreprocessOptions } from './imagePreprocessing';
import { ensureVideoReadyAndGetDuration } from './aiVisionEngine';

export interface OcrProgressInfo {
  status: 'idle' | 'initializing' | 'sampling' | 'processing' | 'completed' | 'cancelled' | 'error';
  currentFrame: number;
  totalFrames: number;
  currentTimeSec: number;
  durationSec: number;
  percent: number;
  message: string;
  currentThumbnail?: string;
  detectedCount: number;
}

export interface OcrEngineOptions {
  sampleIntervalSec: number; // e.g. 0.5s to 1.5s
  minConfidence: number; // e.g. 50
  preprocessOptions?: PreprocessOptions;
  existingMemberNames: string[];
  onProgress: (info: OcrProgressInfo) => void;
  onItemDetected?: (item: ScanResultItem) => void;
}

let activeWorker: Worker | null = null;
let isWorkerInitializing = false;

/**
 * Initialize or get active Tesseract Worker
 */
export async function getTesseractWorker(onLog?: (msg: string) => void): Promise<Worker> {
  if (activeWorker) return activeWorker;
  if (isWorkerInitializing) {
    // Wait until initialized
    while (isWorkerInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (activeWorker) return activeWorker;
  }

  isWorkerInitializing = true;
  try {
    if (onLog) onLog('Memulai Tesseract OCR Web Worker...');
    const worker = await createWorker('eng+ind', 1, {
      logger: (m) => {
        if (onLog && m.status === 'recognizing text') {
          // Worker recognition progress
        }
      },
    });

    // Configure Tesseract parameters for high OCR accuracy on screen text
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;-_/+=()[]#@$ kKmMjJtTrRbB \n\t',
      tessedit_pageseg_mode: '6' as any, // Assume a single uniform block of text
    });

    activeWorker = worker;
    isWorkerInitializing = false;
    return worker;
  } catch (err: any) {
    isWorkerInitializing = false;
    const errMsg =
      err instanceof Error
        ? err.message
        : err && typeof err === 'object' && err.type
        ? `Worker event error (${err.type})`
        : String(err);
    console.warn('Failed to initialize Tesseract worker:', errMsg, err);
    throw new Error(`Mesin Tesseract OCR tidak dapat diinisialisasi di browser ini: ${errMsg}. Silakan beralih ke Gemini Vision AI.`);
  }
}

/**
 * Terminate worker to free memory when needed
 */
export async function terminateTesseractWorker(): Promise<void> {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('Worker termination error:', e);
    }
    activeWorker = null;
  }
}

/**
 * Detect file type automatically (video or image)
 */
export function detectFileType(file: File): 'video' | 'image' | 'unsupported' {
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)) {
    return 'video';
  }
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif|svg)$/i.test(file.name)) {
    return 'image';
  }
  return 'unsupported';
}

/**
 * Process single image donation OCR directly
 */
export async function processImageDonations(
  imageElement: HTMLImageElement,
  options: OcrEngineOptions,
  cancelSignal: { isCancelled: boolean }
): Promise<ScanResultItem[]> {
  const {
    minConfidence = 50,
    preprocessOptions = { grayscale: true, contrastStretch: true, sharpen: true },
    existingMemberNames = [],
    onProgress,
  } = options;

  onProgress({
    status: 'initializing',
    currentFrame: 0,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 1,
    percent: 10,
    message: 'Menyiapkan OCR engine untuk foto...',
    detectedCount: 0,
  });

  const worker = await getTesseractWorker();

  if (cancelSignal.isCancelled) {
    onProgress({
      status: 'cancelled',
      currentFrame: 0,
      totalFrames: 1,
      currentTimeSec: 0,
      durationSec: 1,
      percent: 0,
      message: 'Pemindaian dibatalkan.',
      detectedCount: 0,
    });
    return [];
  }

  onProgress({
    status: 'processing',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 1,
    durationSec: 1,
    percent: 35,
    message: 'Mempersiapkan gambar dan meningkatkan kontras...',
    detectedCount: 0,
  });

  // Create canvas from image
  const canvas = document.createElement('canvas');
  canvas.width = imageElement.naturalWidth || imageElement.width || 800;
  canvas.height = imageElement.naturalHeight || imageElement.height || 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia.');

  ctx.drawImage(imageElement, 0, 0);

  // Thumbnail
  const thumbnailCanvas = document.createElement('canvas');
  thumbnailCanvas.width = 160;
  thumbnailCanvas.height = Math.max(90, Math.round((canvas.height / canvas.width) * 160));
  const thumbCtx = thumbnailCanvas.getContext('2d');
  if (thumbCtx) {
    thumbCtx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
  }
  let thumbnailData = '';
  try {
    thumbnailData = thumbnailCanvas.toDataURL('image/jpeg', 0.6);
  } catch (err) {
    console.warn('[OcrEngine] Thumbnail canvas export skipped:', err);
  }

  // Preprocess for OCR
  const preprocessedCanvas = preprocessCanvasForOcr(canvas, preprocessOptions);

  onProgress({
    status: 'processing',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 1,
    durationSec: 1,
    percent: 65,
    message: 'Menganalisis teks nama & donasi gems dari foto...',
    currentThumbnail: thumbnailData,
    detectedCount: 0,
  });

  const rawDetections: Array<{
    name: string;
    nominal: number;
    confidence: number;
    frameTimeSec: number;
    rawText: string;
    thumbnailUrl: string;
  }> = [];

  try {
    const { data } = await worker.recognize(preprocessedCanvas);
    const recognizedLines: Array<{ text: string; confidence: number }> = [];

    const rawLines = (data as any).lines;
    if (Array.isArray(rawLines) && rawLines.length > 0) {
      for (const lineObj of rawLines) {
        recognizedLines.push({
          text: lineObj.text ? lineObj.text.trim() : '',
          confidence: typeof lineObj.confidence === 'number' ? lineObj.confidence : data.confidence || 75,
        });
      }
    } else if (data.text) {
      const splitLines = data.text.split('\n');
      for (const str of splitLines) {
        if (str.trim()) {
          recognizedLines.push({
            text: str.trim(),
            confidence: data.confidence || 75,
          });
        }
      }
    }

    for (const lineObj of recognizedLines) {
      const lineText = lineObj.text;
      const lineConfidence = lineObj.confidence;

      if (lineText.length >= 3 && lineConfidence >= minConfidence) {
        const parsed = parseOcrLine(lineText);
        if (parsed && parsed.name.length >= 2) {
          const finalConfidence = Math.min(100, Math.max(0, Math.round(lineConfidence + parsed.confidenceBonus)));

          if (finalConfidence >= minConfidence) {
            rawDetections.push({
              name: parsed.name,
              nominal: parsed.nominal,
              confidence: finalConfidence,
              frameTimeSec: 0,
              rawText: lineText,
              thumbnailUrl: thumbnailData,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error recognizing image:', err);
  }

  const consolidated = consolidateOcrResults(rawDetections, existingMemberNames);

  onProgress({
    status: cancelSignal.isCancelled ? 'cancelled' : 'completed',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 1,
    durationSec: 1,
    percent: 100,
    message: cancelSignal.isCancelled
      ? 'Pemindaian dibatalkan.'
      : consolidated.length > 0
      ? `Pemindaian foto selesai! Terbaca ${consolidated.length} donatur gems.`
      : 'Selesai: Tidak ditemukan teks donasi gems/kristal yang terbaca pada foto ini.',
    detectedCount: consolidated.length,
    currentThumbnail: thumbnailData,
  });

  return consolidated;
}

/**
 * Process entire video stream frame-by-frame
 */
export async function processVideoDonations(
  videoElement: HTMLVideoElement,
  options: OcrEngineOptions,
  cancelSignal: { isCancelled: boolean }
): Promise<ScanResultItem[]> {
  const {
    sampleIntervalSec = 0.8,
    minConfidence = 50,
    preprocessOptions = { grayscale: true, contrastStretch: true, sharpen: true },
    existingMemberNames = [],
    onProgress,
  } = options;

  const duration = await ensureVideoReadyAndGetDuration(videoElement);

  onProgress({
    status: 'initializing',
    currentFrame: 0,
    totalFrames: 0,
    currentTimeSec: 0,
    durationSec: duration,
    percent: 0,
    message: 'Menyiapkan OCR engine & model...',
    detectedCount: 0,
  });

  const worker = await getTesseractWorker();

  const timeStep = Math.max(0.2, sampleIntervalSec);
  const estimatedTotalFrames = Math.ceil(duration / timeStep);

  const rawDetections: Array<{
    name: string;
    nominal: number;
    confidence: number;
    frameTimeSec: number;
    rawText: string;
    thumbnailUrl: string;
  }> = [];

  let previousFrameCanvas: HTMLCanvasElement | null = null;
  let currentFrameIndex = 0;

  for (let t = 0; t <= duration; t += timeStep) {
    if (cancelSignal.isCancelled) {
      onProgress({
        status: 'cancelled',
        currentFrame: currentFrameIndex,
        totalFrames: estimatedTotalFrames,
        currentTimeSec: t,
        durationSec: duration,
        percent: Math.round((t / duration) * 100),
        message: 'Pemindaian video dibatalkan.',
        detectedCount: rawDetections.length,
      });
      break;
    }

    // Seek video to timestamp with timeout and error protection
    await new Promise<void>((resolve) => {
      let timeoutId: any = null;
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        videoElement.removeEventListener('seeked', onSeeked);
        videoElement.removeEventListener('error', onError);
      };
      videoElement.addEventListener('seeked', onSeeked, { once: true });
      videoElement.addEventListener('error', onError, { once: true });
      timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, 2500);

      try {
        videoElement.currentTime = t;
      } catch {
        cleanup();
        resolve();
      }
    });

    // Capture frame
    const rawFrame = captureVideoFrame(videoElement, 1.0);
    let thumbnailData = '';
    try {
      thumbnailData = captureVideoFrame(videoElement, 0.25).toDataURL('image/jpeg', 0.6);
    } catch (thumbErr) {
      console.warn('[OcrEngine] Video thumbnail capture skipped:', thumbErr);
    }

    // Frame differencing to skip static paused scenes and catch fast scrolls
    if (previousFrameCanvas) {
      const diff = calculateFrameDifference(previousFrameCanvas, rawFrame);
      if (diff < 0.012 && t > 0) {
        // Less than 1.2% difference -> skip OCR recognition to save CPU & time!
        currentFrameIndex++;
        continue;
      }
    }
    previousFrameCanvas = rawFrame;
    currentFrameIndex++;

    // Preprocess frame for high OCR accuracy
    const preprocessedCanvas = preprocessCanvasForOcr(rawFrame, preprocessOptions);

    const percent = Math.min(99, Math.round((t / duration) * 100));
    onProgress({
      status: 'processing',
      currentFrame: currentFrameIndex,
      totalFrames: estimatedTotalFrames,
      currentTimeSec: t,
      durationSec: duration,
      percent,
      message: `Menganalisis frame detik ${Math.floor(t)}s / ${Math.floor(duration)}s (${rawDetections.length} donatur ditemukan)...`,
      currentThumbnail: thumbnailData,
      detectedCount: rawDetections.length,
    });

    try {
      // Run Tesseract OCR on preprocessed frame
      const { data } = await worker.recognize(preprocessedCanvas);

      // Parse text line by line with word/line confidence
      const recognizedLines: Array<{ text: string; confidence: number }> = [];

      const rawLines = (data as any).lines;
      if (Array.isArray(rawLines) && rawLines.length > 0) {
        for (const lineObj of rawLines) {
          recognizedLines.push({
            text: lineObj.text ? lineObj.text.trim() : '',
            confidence: typeof lineObj.confidence === 'number' ? lineObj.confidence : data.confidence || 75,
          });
        }
      } else if (data.text) {
        const splitLines = data.text.split('\n');
        for (const str of splitLines) {
          if (str.trim()) {
            recognizedLines.push({
              text: str.trim(),
              confidence: data.confidence || 75,
            });
          }
        }
      }

      for (const lineObj of recognizedLines) {
        const lineText = lineObj.text;
        const lineConfidence = lineObj.confidence;

        if (lineText.length >= 3 && lineConfidence >= minConfidence) {
          const parsed = parseOcrLine(lineText);
          if (parsed && parsed.name.length >= 2) {
            const finalConfidence = Math.min(100, Math.max(0, Math.round(lineConfidence + parsed.confidenceBonus)));

            if (finalConfidence >= minConfidence) {
              rawDetections.push({
                name: parsed.name,
                nominal: parsed.nominal,
                confidence: finalConfidence,
                frameTimeSec: Math.round(t * 10) / 10,
                rawText: lineText,
                thumbnailUrl: thumbnailData,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Error recognizing frame at ${t}s:`, err);
    }
  }

  // Deduplicate and consolidate results
  const consolidated = consolidateOcrResults(rawDetections, existingMemberNames);

  onProgress({
    status: cancelSignal.isCancelled ? 'cancelled' : 'completed',
    currentFrame: currentFrameIndex,
    totalFrames: estimatedTotalFrames,
    currentTimeSec: duration,
    durationSec: duration,
    percent: 100,
    message: cancelSignal.isCancelled
      ? 'Pemindaian dibatalkan.'
      : `Pemindaian selesai! Berhasil mengekstrak ${consolidated.length} donatur siap direview.`,
    detectedCount: consolidated.length,
  });

  return consolidated;
}

/**
 * Consolidate raw multi-frame OCR detections into a clean list
 * Merges duplicate names across frames and picks highest confidence / most consistent nominal
 */
export function consolidateOcrResults(
  rawList: Array<{
    name: string;
    nominal: number;
    confidence: number;
    frameTimeSec: number;
    rawText: string;
    thumbnailUrl: string;
  }>,
  existingMemberNames: string[] = []
): ScanResultItem[] {
  const groups: Array<{
    canonicalName: string;
    bestNominal: number;
    highestConfidence: number;
    earliestTime: number;
    rawTexts: string[];
    thumbnailUrl: string;
    occurrences: number;
  }> = [];

  for (const item of rawList) {
    let matchedGroup: (typeof groups)[0] | null = null;
    let highestSim = 0;

    for (const group of groups) {
      const sim = stringSimilarity(item.name, group.canonicalName);
      if (sim > 0.82 && sim > highestSim) {
        highestSim = sim;
        matchedGroup = group;
      }
    }

    if (matchedGroup) {
      matchedGroup.occurrences += 1;
      matchedGroup.rawTexts.push(item.rawText);

      // If new item has higher confidence, update canonical name and thumbnail
      if (item.confidence > matchedGroup.highestConfidence) {
        matchedGroup.highestConfidence = item.confidence;
        matchedGroup.canonicalName = item.name;
        matchedGroup.thumbnailUrl = item.thumbnailUrl;
      }

      // If existing nominal was 0 but new has positive nominal, adopt positive nominal
      if (matchedGroup.bestNominal === 0 && item.nominal > 0) {
        matchedGroup.bestNominal = item.nominal;
      } else if (item.nominal > 0 && item.confidence >= matchedGroup.highestConfidence - 10) {
        // Adopt the highest nominal detected with high confidence
        matchedGroup.bestNominal = Math.max(matchedGroup.bestNominal, item.nominal);
      }
    } else {
      groups.push({
        canonicalName: item.name,
        bestNominal: item.nominal,
        highestConfidence: item.confidence,
        earliestTime: item.frameTimeSec,
        rawTexts: [item.rawText],
        thumbnailUrl: item.thumbnailUrl,
        occurrences: 1,
      });
    }
  }

  // Convert groups into ScanResultItem
  return groups.map((g, idx) => {
    // Check if member already exists in database (exact or fuzzy)
    let isExisting = false;
    let existingNameMatch: string | undefined;

    for (const exName of existingMemberNames) {
      if (stringSimilarity(g.canonicalName, exName) >= 0.88) {
        isExisting = true;
        existingNameMatch = exName;
        break;
      }
    }

    return {
      id: `scan-item-${Date.now()}-${idx}`,
      name: existingNameMatch || g.canonicalName,
      nominal: g.bestNominal,
      confidence: g.highestConfidence,
      frameTimeSec: g.earliestTime,
      rawText: g.rawTexts[0] || g.canonicalName,
      status: 'accepted',
      isNewMember: !isExisting,
      thumbnailUrl: g.thumbnailUrl,
    };
  });
}
