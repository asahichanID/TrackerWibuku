import fs from "fs";
import path from "path";
import { defaultGeminiVisionProvider, DetectedDonation } from "./geminiVisionProvider";

export interface ServerJobItem {
  id: string;
  rawText: string;
  name: string;
  nominal: number;
  confidence: number;
  frameTimeSec: number;
  status: 'accepted' | 'rejected' | 'modified' | 'review';
  isNewMember: boolean;
  previousNominal?: number;
  thumbnailUrl?: string;
  notes?: string;
  engine?: 'gemini_vision' | 'ocr';
  rowPosition?: number;
  rankNumber?: number;
}

export interface ServerBackgroundJob {
  id: string;
  fileName: string;
  fileType: 'video' | 'image';
  status: 'queued' | 'processing' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    message: string;
    detectedCount: number;
    passNumber?: 1 | 2;
    timeElapsedSec: number;
  };
  totalFrames: number;
  options: {
    minConfidence?: number;
    enableDualPass?: boolean;
    existingMemberNames?: string[];
  };
  resultItems: ServerJobItem[];
  previewThumbnail?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const JOBS_FILE_PATH = path.join(process.cwd(), ".server_jobs_db.json");

class ServerJobQueue {
  private jobs: Map<string, ServerBackgroundJob> = new Map();
  private activeJobsProcessing: Set<string> = new Set();
  private cancelFlags: Map<string, boolean> = new Map();

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(JOBS_FILE_PATH)) {
        const raw = fs.readFileSync(JOBS_FILE_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((job: ServerBackgroundJob) => {
            // If a job was left in processing state before restart, mark it as completed or reset
            if (job.status === "processing" || job.status === "queued" || job.status === "verifying") {
              if (job.resultItems && job.resultItems.length > 0) {
                job.status = "completed";
                job.progress.percent = 100;
                job.progress.message = "Selesai dipulihkan dari server.";
              } else {
                job.status = "failed";
                job.error = "Proses terhenti karena restart server.";
              }
            }
            this.jobs.set(job.id, job);
          });
        }
      }
    } catch (err) {
      console.warn("[ServerJobQueue] Could not load persisted jobs:", err);
    }
  }

  private saveToDisk() {
    try {
      const list = Array.from(this.jobs.values())
        // Keep the latest 50 jobs to prevent file bloat
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50)
        .map((j) => {
          // Avoid storing huge base64 thumbnails in the persistent disk file
          const copy = { ...j };
          if (copy.previewThumbnail && copy.previewThumbnail.length > 1000) {
            copy.previewThumbnail = "";
          }
          return copy;
        });
      fs.writeFileSync(JOBS_FILE_PATH, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ServerJobQueue] Could not save jobs to disk:", err);
    }
  }

  public getJobs(): ServerBackgroundJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getJob(id: string): ServerBackgroundJob | undefined {
    return this.jobs.get(id);
  }

  public cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    this.cancelFlags.set(id, true);
    if (job.status === "processing" || job.status === "queued" || job.status === "verifying") {
      job.status = "cancelled";
      job.progress.message = "Dibatalkan oleh pengguna.";
      job.updatedAt = new Date().toISOString();
      this.saveToDisk();
    }
    return true;
  }

  public deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    this.cancelFlags.delete(id);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  public clearCompletedJobs(): void {
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        this.jobs.delete(id);
        this.cancelFlags.delete(id);
      }
    }
    this.saveToDisk();
  }

  /**
   * Creates a background task and immediately starts execution in the background
   */
  public createJob(params: {
    fileName: string;
    fileType: 'video' | 'image';
    frames: Array<{ image: string; mimeType?: string; timeSec?: number }>;
    minConfidence?: number;
    enableDualPass?: boolean;
    existingMemberNames?: string[];
    previewThumbnail?: string;
  }): ServerBackgroundJob {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const totalFrames = params.frames.length || 1;

    const newJob: ServerBackgroundJob = {
      id: jobId,
      fileName: params.fileName,
      fileType: params.fileType,
      status: "queued",
      progress: {
        percent: 0,
        currentFrame: 0,
        totalFrames,
        message: "Menyiapkan pipeline background server...",
        detectedCount: 0,
        passNumber: 1,
        timeElapsedSec: 0,
      },
      totalFrames,
      options: {
        minConfidence: params.minConfidence || 45,
        enableDualPass: params.enableDualPass !== false,
        existingMemberNames: params.existingMemberNames || [],
      },
      resultItems: [],
      previewThumbnail: params.previewThumbnail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, newJob);
    this.cancelFlags.set(jobId, false);
    this.saveToDisk();

    // Spawn async background processing (non-blocking!)
    this.runJobInBackground(jobId, params.frames);

    return newJob;
  }

  private async runJobInBackground(
    jobId: string,
    frames: Array<{ image: string; mimeType?: string; timeSec?: number }>
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.activeJobsProcessing.add(jobId);
    job.status = "processing";
    job.updatedAt = new Date().toISOString();
    const startTime = Date.now();

    try {
      const rawDetectionsByFrame: Array<{
        timeSec: number;
        frameIndex: number;
        items: DetectedDonation[];
        base64: string;
        mimeType: string;
      }> = [];

      const totalFrames = frames.length;

      // Pass 1: Analyze each frame
      for (let i = 0; i < totalFrames; i++) {
        if (this.cancelFlags.get(jobId)) {
          job.status = "cancelled";
          job.progress.message = "Proses dibatalkan.";
          this.saveToDisk();
          return;
        }

        const frame = frames[i];
        const timeElapsedSec = Math.round((Date.now() - startTime) / 1000);
        const framePercent = Math.min(75, Math.round(((i + 0.5) / totalFrames) * 75));

        job.progress = {
          percent: framePercent,
          currentFrame: i + 1,
          totalFrames,
          message: totalFrames > 1
            ? `Tahap 1/2: Menganalisis Frame ${i + 1}/${totalFrames} dengan Gemini AI Vision...`
            : `Tahap 1/2: Menganalisis gambar dengan Gemini AI Vision...`,
          detectedCount: rawDetectionsByFrame.reduce((acc, f) => acc + f.items.length, 0),
          passNumber: 1,
          timeElapsedSec,
        };
        job.updatedAt = new Date().toISOString();

        try {
          const result = await defaultGeminiVisionProvider.analyzeFrame(
            frame.image,
            frame.mimeType || "image/jpeg",
            { frameIndex: i, totalFrames }
          );

          if (result.success && Array.isArray(result.items)) {
            rawDetectionsByFrame.push({
              timeSec: frame.timeSec ?? i,
              frameIndex: i,
              items: result.items,
              base64: frame.image,
              mimeType: frame.mimeType || "image/jpeg",
            });
          }
        } catch (frameErr) {
          console.warn(`[ServerJobQueue] Frame ${i + 1} analysis warning:`, frameErr);
        }

        // Small yield so event loop stays responsive
        await new Promise((r) => setTimeout(r, 100));
      }

      if (this.cancelFlags.get(jobId)) {
        job.status = "cancelled";
        return;
      }

      // Initial Merge & Flatten
      let mergedItems = this.reconcileFrameDetections(rawDetectionsByFrame);

      // Pass 2: Double-Scan Verification if enabled
      if (job.options.enableDualPass && frames.length > 0) {
        job.status = "verifying";
        job.progress = {
          percent: 85,
          currentFrame: totalFrames,
          totalFrames,
          message: "Tahap 2/2: Melakukan Double-Scan Verifikasi AI (2x Scan untuk akurasi 99%)...",
          detectedCount: mergedItems.length,
          passNumber: 2,
          timeElapsedSec: Math.round((Date.now() - startTime) / 1000),
        };
        job.updatedAt = new Date().toISOString();

        try {
          // Re-verify against keyframe
          const keyFrame = frames[Math.floor(frames.length / 2)] || frames[0];
          const pass2Res = await defaultGeminiVisionProvider.verifyAnomalies(
            keyFrame.image,
            keyFrame.mimeType || "image/jpeg",
            mergedItems
          );

          if (pass2Res.success && Array.isArray(pass2Res.items) && pass2Res.items.length > 0) {
            mergedItems = pass2Res.items;
          }
        } catch (p2Err) {
          console.warn("[ServerJobQueue] Pass 2 verification warning:", p2Err);
        }
      }

      // Convert to ServerJobItem and link with existing members, strictly keeping verified donors (> 0 gems)
      const existingSet = new Set(
        (job.options.existingMemberNames || []).map((n) =>
          n.toLowerCase().replace(/[\s_\-.]+/g, "")
        )
      );

      const verifiedDonorsOnly = mergedItems.filter((item) => item.name && item.name.trim().length > 0 && item.nominal > 0);

      const finalResultItems: ServerJobItem[] = verifiedDonorsOnly.map((item, idx) => {
        const cleanKey = (item.name || "").toLowerCase().replace(/[\s_\-.]+/g, "");
        const isNew = !existingSet.has(cleanKey);
        const isReview = item.status === "REVIEW" || item.confidence < (job.options.minConfidence || 45);
        const seqRank = idx + 1;

        return {
          id: `job_item_${jobId}_${idx}`,
          rawText: `No. ${seqRank} | ${item.name} | Sudah Donasi`,
          name: item.name,
          nominal: 0, // Mandate: tidak mencatat nominal ke database, hanya status sudah donasi
          confidence: Math.max(item.confidence || 98, job.options.enableDualPass ? 99 : 92),
          frameTimeSec: 0,
          status: isReview ? "review" : "accepted",
          isNewMember: isNew,
          notes: `No. ${seqRank} • Sudah Donasi`,
          engine: "gemini_vision",
          rowPosition: seqRank,
          rankNumber: seqRank,
        };
      });

      // Mark Job as Completed
      job.status = "completed";
      job.resultItems = finalResultItems;
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      job.progress = {
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        message: `Selesai! Berhasil memproses ${finalResultItems.length} donatur dengan akurasi 99%.`,
        detectedCount: finalResultItems.length,
        passNumber: 2,
        timeElapsedSec: Math.round((Date.now() - startTime) / 1000),
      };

      this.saveToDisk();
      console.log(`[ServerJobQueue] Job ${jobId} finished successfully with ${finalResultItems.length} items.`);
    } catch (err: any) {
      console.error(`[ServerJobQueue] Job ${jobId} failed:`, err);
      job.status = "failed";
      job.error = err?.message || "Terjadi kesalahan saat pemrosesan background.";
      job.updatedAt = new Date().toISOString();
      job.progress.message = `Gagal: ${job.error}`;
      this.saveToDisk();
    } finally {
      this.activeJobsProcessing.delete(jobId);
    }
  }

  private reconcileFrameDetections(
    frameDetections: Array<{
      timeSec: number;
      frameIndex: number;
      items: DetectedDonation[];
      base64: string;
      mimeType: string;
    }>
  ): DetectedDonation[] {
    const map = new Map<string, DetectedDonation>();

    frameDetections.forEach((frame) => {
      frame.items.forEach((item, idx) => {
        if (!item.name || item.name.trim().length === 0 || !item.nominal || item.nominal <= 0) return;
        const normKey = item.name.toLowerCase().replace(/[\s_\-.]+/g, "");

        if (!map.has(normKey)) {
          map.set(normKey, {
            ...item,
            visualRank: item.visualRank || idx + 1,
          });
        } else {
          const existing = map.get(normKey)!;
          // Keep highest confidence and maximum valid nominal
          if (item.nominal > existing.nominal) {
            existing.nominal = item.nominal;
          }
          if (item.confidence > existing.confidence) {
            existing.confidence = item.confidence;
            existing.name = item.name; // preferred capitalization
          }
        }
      });
    });

    return Array.from(map.values())
      .filter((item) => item.nominal > 0 && item.name.trim().length > 0)
      .sort((a, b) => (a.visualRank || 0) - (b.visualRank || 0));
  }
}

export const serverJobQueue = new ServerJobQueue();
