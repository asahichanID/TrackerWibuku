import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { defaultGeminiVisionProvider } from "./server/geminiVisionProvider";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support base64 image frame payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Health Check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      provider: defaultGeminiVisionProvider.name,
      timestamp: new Date().toISOString(),
    });
  });

  // Gemini Vision Frame Analysis Endpoint
  // Accepts { image: string, mimeType?: string, frameIndex?: number, totalFrames?: number }
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

  // Vite middleware for development vs Static file serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clan Wibu Donation Tracker Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
