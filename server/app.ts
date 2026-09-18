import express, { Request, Response } from "express";
import { defaultGeminiVisionProvider } from "./geminiVisionProvider";
import { serverJobQueue } from "./jobQueue";

export function createApiApp() {
  const app = express();

  // Support base64 image frame payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Health Check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      provider: defaultGeminiVisionProvider.name,
      timestamp: new Date().toISOString(),
      activeJobsCount: serverJobQueue.getJobs().filter((j) => j.status === "processing" || j.status === "queued" || j.status === "verifying").length,
    });
  });

  // ==========================================
  // BACKGROUND JOB MANAGEMENT ENDPOINTS
  // ==========================================

  // Create & Start a Background Job
  app.post("/api/jobs/create", (req: Request, res: Response) => {
    try {
      const {
        fileName,
        fileType,
        frames,
        minConfidence,
        enableDualPass,
        existingMemberNames,
        previewThumbnail,
      } = req.body;

      if (!Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({
          success: false,
          error: "Payload missing 'frames' array.",
        });
        return;
      }

      const job = serverJobQueue.createJob({
        fileName: fileName || "Media Donasi",
        fileType: fileType === "image" ? "image" : "video",
        frames,
        minConfidence: typeof minConfidence === "number" ? minConfidence : 45,
        enableDualPass: enableDualPass !== false,
        existingMemberNames: Array.isArray(existingMemberNames) ? existingMemberNames : [],
        previewThumbnail: typeof previewThumbnail === "string" ? previewThumbnail : undefined,
      });

      res.json({
        success: true,
        jobId: job.id,
        job,
      });
    } catch (err: any) {
      console.error("[Server API /api/jobs/create] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error creating background job.",
      });
    }
  });

  // Get all Background Jobs
  app.get("/api/jobs", (_req: Request, res: Response) => {
    try {
      const jobs = serverJobQueue.getJobs();
      res.json({
        success: true,
        jobs,
      });
    } catch (err: any) {
      console.error("[Server API /api/jobs] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error fetching jobs.",
        jobs: [],
      });
    }
  });

  // Get single Job by ID
  app.get("/api/jobs/:id", (req: Request, res: Response) => {
    try {
      const job = serverJobQueue.getJob(req.params.id);
      if (!job) {
        res.status(404).json({
          success: false,
          error: "Job tidak ditemukan.",
        });
        return;
      }
      res.json({
        success: true,
        job,
      });
    } catch (err: any) {
      console.error(`[Server API /api/jobs/${req.params.id}] Error:`, err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error fetching job.",
      });
    }
  });

  // Cancel a Job
  app.post("/api/jobs/:id/cancel", (req: Request, res: Response) => {
    try {
      const success = serverJobQueue.cancelJob(req.params.id);
      res.json({
        success,
        message: success ? "Job berhasil dibatalkan." : "Job tidak ditemukan.",
      });
    } catch (err: any) {
      console.error(`[Server API /api/jobs/${req.params.id}/cancel] Error:`, err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error cancelling job.",
      });
    }
  });

  // Delete a Job
  app.delete("/api/jobs/:id", (req: Request, res: Response) => {
    try {
      const success = serverJobQueue.deleteJob(req.params.id);
      res.json({
        success,
        message: success ? "Job berhasil dihapus." : "Job tidak ditemukan.",
      });
    } catch (err: any) {
      console.error(`[Server API /api/jobs/${req.params.id}] Error:`, err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error deleting job.",
      });
    }
  });

  // Clear finished jobs
  app.post("/api/jobs/clear-completed", (_req: Request, res: Response) => {
    try {
      serverJobQueue.clearCompletedJobs();
      res.json({
        success: true,
        message: "Riwayat job selesai berhasil dibersihkan.",
      });
    } catch (err: any) {
      console.error("[Server API /api/jobs/clear-completed] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error clearing completed jobs.",
      });
    }
  });

  // ==========================================
  // DIRECT SCAN & VERIFICATION ENDPOINTS
  // ==========================================

  // Gemini Vision Frame Analysis Endpoint
  app.post("/api/analyze-frame", async (req: Request, res: Response) => {
    try {
      const { image, mimeType, frameIndex, totalFrames } = req.body;

      if (!image || typeof image !== "string") {
        res.status(400).json({
          success: false,
          error: "Payload missing 'image' base64 string.",
        });
        return;
      }

      const result = await defaultGeminiVisionProvider.analyzeFrame(
        image,
        mimeType || "image/jpeg",
        {
          frameIndex: typeof frameIndex === "number" ? frameIndex : undefined,
          totalFrames: typeof totalFrames === "number" ? totalFrames : undefined,
        }
      );

      res.json(result);
    } catch (err: any) {
      console.error("[Server API /api/analyze-frame] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error during image analysis.",
        items: [],
      });
    }
  });

  // Pass 2: Double-Scan Verification & Anomaly Reconciliation Endpoint
  app.post("/api/verify-double-scan", async (req: Request, res: Response) => {
    try {
      const { image, mimeType, candidateItems } = req.body;

      if (!image || typeof image !== "string") {
        res.status(400).json({
          success: false,
          error: "Payload missing 'image' base64 string.",
        });
        return;
      }

      const result = await defaultGeminiVisionProvider.verifyAnomalies(
        image,
        mimeType || "image/jpeg",
        Array.isArray(candidateItems) ? candidateItems : []
      );

      res.json(result);
    } catch (err: any) {
      console.error("[Server API /api/verify-double-scan] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error during double scan verification.",
        items: [],
      });
    }
  });

  // Batch Analyze Multiple Frames (Optimized for Video)
  app.post("/api/analyze-frames-batch", async (req: Request, res: Response) => {
    try {
      const { frames } = req.body;
      if (!Array.isArray(frames) || frames.length === 0) {
        res.status(400).json({
          success: false,
          error: "Payload missing 'frames' array.",
        });
        return;
      }

      const batchResults = [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        if (!frame || !frame.image) continue;

        const result = await defaultGeminiVisionProvider.analyzeFrame(
          frame.image,
          frame.mimeType || "image/jpeg",
          {
            frameIndex: i,
            totalFrames: frames.length,
          }
        );
        batchResults.push({
          frameIndex: i,
          timeSec: frame.timeSec ?? i,
          items: result.items,
          success: result.success,
        });
      }

      res.json({
        success: true,
        batchResults,
        provider: defaultGeminiVisionProvider.name,
      });
    } catch (err: any) {
      console.error("[Server API /api/analyze-frames-batch] Error:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Internal server error during batch frame analysis.",
      });
    }
  });

  return app;
}
