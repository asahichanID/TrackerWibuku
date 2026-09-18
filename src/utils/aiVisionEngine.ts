import { ScanResultItem } from '../types';
import { stringSimilarity, sanitizeName } from './fuzzyMatching';

function normalizeClanName(str: string): string {
  return sanitizeName(str || '').toLowerCase().replace(/[\s_\-.]+/g, '');
}

function calculateSimilarity(a: string, b: string): number {
  return stringSimilarity(a, b);
}

export interface VisionProgressInfo {
  status: 'idle' | 'extracting' | 'analyzing' | 'deduplicating' | 'completed' | 'error';
  currentFrame: number;
  totalFrames: number;
  currentTimeSec: number;
  durationSec: number;
  percent: number;
  message: string;
  detectedCount: number;
  engineUsed: 'gemini_vision' | 'ocr_fallback';
}

export interface VisionEngineOptions {
  sampleIntervalSec?: number; // e.g. 1.0s, 2.0s
  minConfidence?: number;
  existingMemberNames?: string[];
  onProgress?: (info: VisionProgressInfo) => void;
}

export interface ApiDetectedDonation {
  name: string;
  nominal: number;
  confidence: number;
  status: 'VERIFIED' | 'REVIEW';
  notes?: string;
  rowPosition?: number;
}

/**
 * Checks if the server Gemini Vision API is accessible
 */
export async function checkGeminiVisionHealth(): Promise<{ available: boolean; provider?: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { available: false };
    const data = await res.json();
    return { available: data.status === 'ok', provider: data.provider };
  } catch {
    return { available: false };
  }
}

/**
 * Converts a browser File object to Base64 string and data URL
 */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(';base64,');
      const mimeType = header.replace('data:', '');
      resolve({ base64, mimeType, dataUrl });
    };
    reader.onerror = () => {
      reject(new Error(reader.error?.message || 'Gagal membaca berkas gambar.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Analyzes a single Image (photo) with Gemini Vision via server API
 */
export async function analyzeImageWithGemini(
  file: File,
  options: VisionEngineOptions = {},
  cancelSignal?: { isCancelled: boolean }
): Promise<ScanResultItem[]> {
  const { onProgress, existingMemberNames = [] } = options;

  if (cancelSignal?.isCancelled) return [];

  onProgress?.({
    status: 'extracting',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 20,
    message: 'Membaca gambar foto asli...',
    detectedCount: 0,
    engineUsed: 'gemini_vision',
  });

  const { base64, mimeType, dataUrl } = await fileToBase64(file);

  if (cancelSignal?.isCancelled) return [];

  onProgress?.({
    status: 'analyzing',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 50,
    message: 'Menganalisis baris visual, nama member & donasi Gems dengan Gemini Vision...',
    detectedCount: 0,
    engineUsed: 'gemini_vision',
  });

  const res = await fetch('/api/analyze-frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      mimeType,
      frameIndex: 0,
      totalFrames: 1,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Server returned error ${res.status}`);
  }

  const json = await res.json();
  if (json.success === false && json.error) {
    throw new Error(json.error);
  }
  const rawItems: ApiDetectedDonation[] = json.items || [];

  if (cancelSignal?.isCancelled) return [];

  onProgress?.({
    status: 'deduplicating',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 85,
    message: 'Memvalidasi baris data dan mencocokkan status review...',
    detectedCount: rawItems.length,
    engineUsed: 'gemini_vision',
  });

  // Map to ScanResultItem
  const existingSet = new Set(existingMemberNames.map(normalizeClanName));
  const results: ScanResultItem[] = rawItems.map((item, idx) => {
    const norm = normalizeClanName(item.name);
    const isNew = !existingSet.has(norm);
    const isReview = item.status === 'REVIEW' || item.confidence < 60 || item.nominal === 0;

    return {
      id: `gemini_img_${Date.now()}_${idx}`,
      rawText: `${item.name} | ${item.nominal} Gems [${item.notes || ''}]`,
      name: item.name,
      nominal: item.nominal,
      confidence: item.confidence,
      frameTimeSec: 0,
      status: isReview ? 'review' : 'accepted',
      isNewMember: isNew,
      notes: item.notes || (isReview ? 'Perlu konfirmasi visual manual' : 'Terverifikasi Gemini Vision'),
      engine: 'gemini_vision',
      thumbnailUrl: dataUrl,
      rowPosition: item.rowPosition || idx + 1,
    };
  });

  onProgress?.({
    status: 'completed',
    currentFrame: 1,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 100,
    message: `Berhasil mendeteksi ${results.length} member dari foto dengan Gemini Vision.`,
    detectedCount: results.length,
    engineUsed: 'gemini_vision',
  });

  return results;
}

/**
 * Helper to ensure HTMLVideoElement has metadata loaded and resolve a valid duration.
 * Handles WebM/streaming infinite durations, asynchronous metadata load, and NaN/0 fallbacks.
 */
export async function ensureVideoReadyAndGetDuration(videoElement: HTMLVideoElement): Promise<number> {
  if (videoElement.readyState < 1 || isNaN(videoElement.duration) || videoElement.duration === 0) {
    await new Promise<void>((resolve) => {
      let isDone = false;
      let timer: any = null;

      const finish = () => {
        if (isDone) return;
        isDone = true;
        if (timer) clearTimeout(timer);
        videoElement.removeEventListener('loadedmetadata', finish);
        videoElement.removeEventListener('canplay', finish);
        videoElement.removeEventListener('durationchange', finish);
        videoElement.removeEventListener('error', finish);
        resolve();
      };

      videoElement.addEventListener('loadedmetadata', finish, { once: true });
      videoElement.addEventListener('canplay', finish, { once: true });
      videoElement.addEventListener('durationchange', finish, { once: true });
      videoElement.addEventListener('error', finish, { once: true });

      if (videoElement.readyState === 0 && videoElement.src) {
        try {
          videoElement.load();
        } catch {
          // ignore
        }
      }

      timer = setTimeout(finish, 3500);
    });
  }

  let duration = videoElement.duration;

  // Handle Infinity or NaN or <= 0 (common in browser blob recordings or WebM files)
  if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
    try {
      const originalTime = videoElement.currentTime;
      videoElement.currentTime = 1e6;
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          videoElement.removeEventListener('seeked', onSeek);
          resolve();
        };
        videoElement.addEventListener('seeked', onSeek, { once: true });
        setTimeout(onSeek, 1000);
      });

      if (isFinite(videoElement.duration) && videoElement.duration > 0) {
        duration = videoElement.duration;
      } else if (videoElement.currentTime > 0 && isFinite(videoElement.currentTime)) {
        duration = videoElement.currentTime;
      }

      videoElement.currentTime = Math.min(originalTime || 0, Math.max(0, (duration || 1) - 0.1));
      await new Promise<void>((resolve) => {
        const onSeekBack = () => {
          videoElement.removeEventListener('seeked', onSeekBack);
          resolve();
        };
        videoElement.addEventListener('seeked', onSeekBack, { once: true });
        setTimeout(onSeekBack, 500);
      });
    } catch (seekErr) {
      console.warn('[GeminiVision] Could not seek to probe infinite video duration:', seekErr);
    }
  }

  if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
    console.warn('[GeminiVision] Video duration is not available, falling back to 1.5s default duration.');
    return 1.5;
  }

  return duration;
}

/**
 * Analyzes a Video with Gemini Vision by sampling multiple frames across the duration,
 * then performing deduplication and discrepancy review.
 */
export async function analyzeVideoWithGemini(
  videoElement: HTMLVideoElement,
  options: VisionEngineOptions = {},
  cancelSignal?: { isCancelled: boolean }
): Promise<ScanResultItem[]> {
  const {
    sampleIntervalSec = 2.0,
    minConfidence = 50,
    existingMemberNames = [],
    onProgress,
  } = options;

  onProgress?.({
    status: 'extracting',
    currentFrame: 0,
    totalFrames: 1,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 5,
    message: 'Mempersiapkan pemindaian video...',
    detectedCount: 0,
    engineUsed: 'gemini_vision',
  });

  const duration = await ensureVideoReadyAndGetDuration(videoElement);

  // Calculate sample timestamps across video
  // Ensure enough frames to capture scrolling without missing members
  const timestamps: number[] = [];
  const interval = Math.max(0.75, sampleIntervalSec);
  for (let t = 0.2; t < duration; t += interval) {
    timestamps.push(t);
  }
  // Include close to the end if not covered
  if (timestamps.length === 0 || timestamps[timestamps.length - 1] < duration - 0.5) {
    timestamps.push(Math.max(0, duration - 0.5));
  }

  const totalFrames = timestamps.length;
  const offscreenCanvas = document.createElement('canvas');
  const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

  const rawDetectionsByFrame: Array<{
    timeSec: number;
    frameIndex: number;
    items: ApiDetectedDonation[];
    frameThumbnail: string;
  }> = [];

  // Seek video helper with timeout and error resilience
  const seekTo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
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
        videoElement.currentTime = time;
      } catch {
        cleanup();
        resolve();
      }
    });
  };

  // Process frames sequentially with rate safety
  for (let i = 0; i < totalFrames; i++) {
    if (cancelSignal?.isCancelled) break;

    const timeSec = timestamps[i];
    const percent = Math.round(((i + 0.2) / totalFrames) * 80);

    onProgress?.({
      status: 'extracting',
      currentFrame: i + 1,
      totalFrames,
      currentTimeSec: timeSec,
      durationSec: duration,
      percent,
      message: `Mengambil Frame #${i + 1}/${totalFrames} (detik ${timeSec.toFixed(1)}s)...`,
      detectedCount: rawDetectionsByFrame.reduce((acc, f) => acc + f.items.length, 0),
      engineUsed: 'gemini_vision',
    });

    await seekTo(timeSec);

    // Wait brief render tick
    await new Promise((r) => setTimeout(r, 80));

    // Capture frame into canvas
    const videoWidth = videoElement.videoWidth || 1280;
    const videoHeight = videoElement.videoHeight || 720;
    offscreenCanvas.width = videoWidth;
    offscreenCanvas.height = videoHeight;

    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
    }

    let frameDataUrl = '';
    let base64 = '';
    try {
      frameDataUrl = offscreenCanvas.toDataURL('image/jpeg', 0.85);
      const parts = frameDataUrl.split(';base64,');
      base64 = parts[1] || '';
    } catch (exportErr) {
      console.warn('[GeminiVision] Canvas export error, retrying without taint:', exportErr);
      try {
        frameDataUrl = offscreenCanvas.toDataURL();
        const parts = frameDataUrl.split(';base64,');
        base64 = parts[1] || '';
      } catch {
        // Skip frame if canvas cannot be read
        continue;
      }
    }

    onProgress?.({
      status: 'analyzing',
      currentFrame: i + 1,
      totalFrames,
      currentTimeSec: timeSec,
      durationSec: duration,
      percent: Math.round(((i + 0.8) / totalFrames) * 80),
      message: `Menganalisis Frame #${i + 1}/${totalFrames} via Gemini Vision...`,
      detectedCount: rawDetectionsByFrame.reduce((acc, f) => acc + f.items.length, 0),
      engineUsed: 'gemini_vision',
    });

    try {
      const res = await fetch('/api/analyze-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          mimeType: 'image/jpeg',
          frameIndex: i,
          totalFrames,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const items: ApiDetectedDonation[] = json.items || [];
        rawDetectionsByFrame.push({
          timeSec,
          frameIndex: i,
          items,
          frameThumbnail: frameDataUrl,
        });
      } else {
        console.warn(`[GeminiVision] Frame ${i + 1} analysis returned status ${res.status}`);
      }
    } catch (frameErr) {
      console.warn(`[GeminiVision] Frame ${i + 1} analysis error:`, frameErr);
    }

    // Gentle pacing between frames
    await new Promise((r) => setTimeout(r, 200));
  }

  if (cancelSignal?.isCancelled) return [];

  onProgress?.({
    status: 'deduplicating',
    currentFrame: totalFrames,
    totalFrames,
    currentTimeSec: duration,
    durationSec: duration,
    percent: 90,
    message: 'Mendeduplikasi member dari berbagai frame & memverifikasi konsistensi nominal Gems...',
    detectedCount: rawDetectionsByFrame.reduce((acc, f) => acc + f.items.length, 0),
    engineUsed: 'gemini_vision',
  });

  // Deduplication & Aggregation logic across video frames
  const consolidated = deduplicateVideoFrames(
    rawDetectionsByFrame,
    minConfidence,
    existingMemberNames
  );

  onProgress?.({
    status: 'completed',
    currentFrame: totalFrames,
    totalFrames,
    currentTimeSec: duration,
    durationSec: duration,
    percent: 100,
    message: `Selesai! Berhasil mengidentifikasi ${consolidated.length} member unik dari rekaman video.`,
    detectedCount: consolidated.length,
    engineUsed: 'gemini_vision',
  });

  return consolidated;
}

/**
 * Deduplicates raw detections across multiple video frames
 * Flags any nominal discrepancies between frames as 'review'
 */
function deduplicateVideoFrames(
  frames: Array<{
    timeSec: number;
    frameIndex: number;
    items: ApiDetectedDonation[];
    frameThumbnail: string;
  }>,
  minConfidence: number,
  existingMemberNames: string[]
): ScanResultItem[] {
  const existingSet = new Set(existingMemberNames.map(normalizeClanName));

  // Flatten all detections with frame context
  interface ExtendedDetection {
    name: string;
    nominal: number;
    confidence: number;
    timeSec: number;
    status: 'VERIFIED' | 'REVIEW';
    notes?: string;
    thumbnail: string;
    rowPosition?: number;
  }

  const allDetections: ExtendedDetection[] = [];
  for (const f of frames) {
    for (const item of f.items) {
      if (item.confidence >= minConfidence || item.status === 'REVIEW') {
        allDetections.push({
          name: item.name,
          nominal: item.nominal,
          confidence: item.confidence,
          timeSec: f.timeSec,
          status: item.status,
          notes: item.notes,
          thumbnail: f.frameThumbnail,
          rowPosition: item.rowPosition,
        });
      }
    }
  }

  // Group by normalized name (exact or fuzzy similarity >= 0.85)
  const clusters: Array<{
    canonicalName: string;
    detections: ExtendedDetection[];
  }> = [];

  for (const det of allDetections) {
    const norm = normalizeClanName(det.name);
    let matchedCluster = clusters.find((c) => {
      const cNorm = normalizeClanName(c.canonicalName);
      if (norm === cNorm) return true;
      return calculateSimilarity(norm, cNorm) >= 0.88;
    });

    if (matchedCluster) {
      matchedCluster.detections.push(det);
      // If current detection has higher confidence, update canonical display name
      const best = matchedCluster.detections.reduce((a, b) => (b.confidence > a.confidence ? b : a));
      matchedCluster.canonicalName = best.name;
    } else {
      clusters.push({
        canonicalName: det.name,
        detections: [det],
      });
    }
  }

  // Convert each cluster into a final ScanResultItem
  const results: ScanResultItem[] = clusters.map((cluster, idx) => {
    const dets = cluster.detections;
    const bestDet = dets.reduce((a, b) => (b.confidence > a.confidence ? b : a));
    const highestConfidence = Math.max(...dets.map((d) => d.confidence));

    // Check nominal consistency across frames
    const nominals = Array.from(new Set(dets.map((d) => d.nominal).filter((n) => n > 0)));
    const hasNominalConflict = nominals.length > 1;
    const isExplicitReview = dets.some((d) => d.status === 'REVIEW');

    // Determine representative nominal (pick highest nominal among high-confidence detections)
    const finalNominal = nominals.length > 0 ? Math.max(...nominals) : bestDet.nominal;

    let finalStatus: 'accepted' | 'review' = 'accepted';
    let notes = `Terdeteksi di ${dets.length} frame (detik ${dets.map((d) => d.timeSec.toFixed(1) + 's').join(', ')})`;

    if (hasNominalConflict) {
      finalStatus = 'review';
      notes = `⚠️ Ambiguitas nominal di frame berbeda (${nominals.join(', ')} 💎). Periksa referensi visual!`;
    } else if (isExplicitReview || highestConfidence < 60 || finalNominal === 0) {
      finalStatus = 'review';
      notes = bestDet.notes || '⚠️ Kualitas visual samar / perlu verifikasi manual.';
    }

    const norm = normalizeClanName(cluster.canonicalName);
    const isNew = !existingSet.has(norm);

    return {
      id: `gemini_vid_${Date.now()}_${idx}`,
      rawText: `${cluster.canonicalName} | ${finalNominal} Gems (${dets.length} frames)`,
      name: cluster.canonicalName,
      nominal: finalNominal,
      confidence: highestConfidence,
      frameTimeSec: bestDet.timeSec,
      status: finalStatus,
      isNewMember: isNew,
      notes,
      engine: 'gemini_vision',
      thumbnailUrl: bestDet.thumbnail,
      rowPosition: bestDet.rowPosition,
    };
  });

  return results;
}
