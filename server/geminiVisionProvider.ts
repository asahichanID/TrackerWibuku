import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Gemini Vision Scraper / Unofficial Access Provider Module
 * 
 * Modular provider architecture: easily interchangeable or upgradable
 * if endpoints, scraper routes, or models change.
 * Requires NO user API key from UI (uses injected server runtime or scraper fallback).
 */

export interface DetectedDonation {
  name: string;
  nominal: number; // Gems / Crystals count
  confidence: number; // 0 - 100
  status: 'VERIFIED' | 'REVIEW';
  notes?: string;
  rowPosition?: number;
}

export interface VisionAnalysisResult {
  success: boolean;
  items: DetectedDonation[];
  rawResponse?: string;
  provider: string;
  error?: string;
}

export interface GeminiVisionProviderInterface {
  name: string;
  analyzeFrame(
    base64Data: string,
    mimeType: string,
    options?: { frameIndex?: number; totalFrames?: number }
  ): Promise<VisionAnalysisResult>;
}

/**
 * Gemini Vision Provider Implementation
 * Model: gemini-3.8-flash (fast, high-precision visual recognition)
 */
export class GeminiVisionProvider implements GeminiVisionProviderInterface {
  public name = "Gemini Vision Scraper Provider (Autonomous)";
  private client: GoogleGenAI | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    // Uses process.env.GEMINI_API_KEY injected by runtime. No user input required.
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (apiKey) {
      try {
        this.client = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
      } catch (err) {
        console.error("[GeminiVisionProvider] Initialization error:", err);
      }
    }
  }

  /**
   * Analyzes an image frame using Gemini Vision to read member names and Gems/Crystals.
   * Uses strict spatial visual matching to match names with numbers in the same row.
   */
  async analyzeFrame(
    base64Data: string,
    mimeType: string = "image/jpeg",
    options?: { frameIndex?: number; totalFrames?: number }
  ): Promise<VisionAnalysisResult> {
    // If client is not yet initialized, try to reinitialize
    if (!this.client) {
      this.initClient();
    }

    if (!this.client) {
      return {
        success: false,
        items: [],
        provider: this.name,
        error: "Gemini provider runtime credentials not available on server.",
      };
    }

    // Strip header if data URL format (e.g. data:image/png;base64,...)
    let cleanBase64 = base64Data;
    let resolvedMime = mimeType;
    if (base64Data.includes(";base64,")) {
      const parts = base64Data.split(";base64,");
      const mimePart = parts[0].replace("data:", "");
      if (mimePart) resolvedMime = mimePart;
      cleanBase64 = parts[1];
    }

    const frameInfo = options?.frameIndex !== undefined && options?.totalFrames
      ? `(Frame ${options.frameIndex + 1} of ${options.totalFrames})`
      : "";

    const systemPrompt = `You are an expert AI Vision auditor extracting Clan Wibu donation list records from this game screenshot / video frame ${frameInfo}.
Your objective: Extract every visibly listed clan member name and their corresponding donated Gems/Crystals quantity (💎).

CRITICAL VISUAL RECOGNITION RULES:
1. SPATIAL ROW ALIGNMENT:
   - Carefully inspect each horizontal line/row or column structure in the screenshot.
   - Match each member's name strictly to the Gems/Crystals count displayed on the EXACT SAME row or corresponding table cell.
   - Do not associate a number from an adjacent row or unrelated UI counter (like total clan bank, player level, VIP level, or date).

2. FACTUAL VISUAL FIDELITY (NO HALLUCINATION / NO GUESSING):
   - Only extract names and numbers that are ACTUALLY, CLEARLY VISIBLE in this image.
   - Do NOT invent, assume, or guess characters that are obscured, off-screen, or missing.
   - If the image has NO donation list, NO player names, or is completely blank/unrelated, return an empty array [].

3. AMBIGUITY & "REVIEW" STATUS:
   - If a name is partially covered by a popup, motion blur, cut off by screen boundaries, or difficult to read:
     set "status": "REVIEW", "confidence": between 35 and 59, and describe the issue in "notes".
   - If the number of Gems is blurry, ambiguous between similar digits (like 1 and 7, or 8 and 0):
     set "status": "REVIEW", "confidence": between 40 and 59, and explain in "notes".
   - If the name and Gems number are clearly crisp and unambiguous:
     set "status": "VERIFIED", and "confidence": between 85 and 99.

4. DONATION CURRENCY:
   - The clan donates GEMS / CRYSTALS (not money, not rupiah, not dollars).
   - Extract "nominal" as a pure positive integer (e.g. 100, 500, 2000, 50000).
   - Strip any clan tag brackets, comma separators, dots, or diamond/gem symbols from the nominal value.

5. OUTPUT FORMAT:
   Return ONLY a strict JSON array with no markdown backticks or commentary outside the JSON:
   [
     {
       "name": "MemberName",
       "nominal": 1500,
       "confidence": 95,
       "status": "VERIFIED",
       "notes": "Clear row alignment",
       "rowPosition": 1
     }
   ]
`;

    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response: GenerateContentResponse = await this.client.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: resolvedMime,
                  data: cleanBase64,
                },
              },
              {
                text: systemPrompt,
              },
            ],
          },
        });

        const responseText = response.text || "";

        // Parse JSON from model output
        const items = this.parseModelJson(responseText);

        return {
          success: true,
          items,
          rawResponse: responseText,
          provider: `${this.name} (${modelName})`,
        };
      } catch (err: any) {
        lastError = err;
        console.log(`[GeminiVisionProvider] Model ${modelName} busy or unavailable, trying next candidate...`);
      }
    }

    console.error("[GeminiVisionProvider] All vision models failed:", lastError?.message || String(lastError));
    return {
      success: false,
      items: [],
      provider: this.name,
      error: lastError?.message || String(lastError || "Semua model vision sedang mengalami beban tinggi."),
    };
  }

  /**
   * Safely parses JSON array from model text response, stripping any wrapping codeblocks
   */
  private parseModelJson(rawText: string): DetectedDonation[] {
    let clean = rawText.trim();

    // Strip markdown json fences
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Find array start and end
    const firstBracket = clean.indexOf("[");
    const lastBracket = clean.lastIndexOf("]");

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      clean = clean.substring(firstBracket, lastBracket + 1);
    }

    try {
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item: any) => item && typeof item === "object")
        .map((item: any, idx: number) => {
          const name = String(item.name || "").trim();
          const rawNom = typeof item.nominal === "number" ? item.nominal : parseInt(String(item.nominal || "0").replace(/\D/g, ""), 10);
          const nominal = isNaN(rawNom) ? 0 : Math.max(0, rawNom);
          const rawConf = typeof item.confidence === "number" ? item.confidence : 75;
          const confidence = Math.max(10, Math.min(100, Math.round(rawConf)));
          const status: 'REVIEW' | 'VERIFIED' = item.status === "REVIEW" || confidence < 60 || !name || nominal === 0 ? "REVIEW" : "VERIFIED";
          const notes = item.notes ? String(item.notes) : status === "REVIEW" ? "Perlu pengecekan visual manual" : "Terdeteksi visual";
          const rowPosition = typeof item.rowPosition === "number" ? item.rowPosition : idx + 1;

          return {
            name,
            nominal,
            confidence,
            status,
            notes,
            rowPosition,
          };
        })
        .filter((item) => item.name.length > 0); // Keep rows with extracted name
    } catch (parseErr) {
      console.warn("[GeminiVisionProvider] Could not parse JSON directly:", parseErr, "Raw output:", rawText);
      return [];
    }
  }
}

// Export singleton instance for easy use
export const defaultGeminiVisionProvider = new GeminiVisionProvider();
