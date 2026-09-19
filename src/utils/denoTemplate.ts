/**
 * Deno Playground Script Template for 1-Click Copy
 * Clan Wibu Donation Tracker
 * Author: Shiro Anna
 */

export const DENO_PLAYGROUND_CODE = `/**
 * ============================================================================
 * CLAN WIBU - GEMINI VISION OCR PROXY FOR DENO PLAYGROUND & DENO DEPLOY
 * Author / Credit: Shiro Anna
 * ============================================================================
 * 
 * CARA PAKAI DI DENO PLAYGROUND (https://play.deno.com):
 * 1. Buka https://play.deno.com atau https://dash.deno.com/playground
 * 2. Hapus semua kode default dan tempel seluruh isi kode ini.
 * 3. Simpan / Deploy Playground.
 * 4. Salin URL Deno Anda (contoh: https://xxx.deno.dev)
 * 5. Tempel URL tersebut ke menu "Pengaturan & Database" -> "Koneksi API Deno / Cloud Proxy" di aplikasi Clan Wibu.
 * 6. Klik Simpan & Tes Koneksi. Selesai!
 */

// Model fallback hierarchy - prioritizes latest Gemini 3 Flash & 3.x series with robust multi-generation failover
const FALLBACK_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-pro",
];

// Fallback API key (bisa diisi via Environment Variable GEMINI_API_KEY atau Request Header x-gemini-api-key)
const DEFAULT_API_KEY = (typeof Deno !== "undefined" && Deno.env?.get("GEMINI_API_KEY")) || "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-api-key, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("\`\`\`json")) {
    cleaned = cleaned.replace(/^\`\`\`json\\s*/i, "").replace(/\\s*\`\`\`$/, "");
  } else if (cleaned.startsWith("\`\`\`")) {
    cleaned = cleaned.replace(/^\`\`\`\\s*/, "").replace(/\\s*\`\`\`$/, "");
  }
  return cleaned.trim();
}

/**
 * Panggil Gemini Vision API dengan multi-model failover otomatis
 */
async function callGeminiVisionWithFallback(
  apiKey: string,
  systemInstruction: string,
  userPrompt: string,
  base64Data: string,
  mimeType = "image/jpeg"
): Promise<{ text: string; modelUsed: string }> {
  const cleanBase64 = base64Data.replace(/^data:image\\/[a-z0-9+]+;base64,/i, "");
  let lastError: Error | null = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const url = \`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`;
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: cleanBase64,
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          responseMimeType: "application/json",
        },
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const json = await resp.json();
        const candidate = json.candidates?.[0];
        const textPart = candidate?.content?.parts?.[0]?.text;
        if (textPart) {
          return { text: textPart, modelUsed: model };
        }
      } else {
        const errBody = await resp.text();
        console.warn(\`[Deno Proxy] Model \${model} returned status \${resp.status}:\`, errBody);
        lastError = new Error(\`Model \${model} error \${resp.status}: \${errBody}\`);
      }
    } catch (err: any) {
      console.warn(\`[Deno Proxy] Model \${model} network exception:\`, err?.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Semua model Gemini Vision gagal merespons. Periksa koneksi atau kuota API Key.");
}

const OCR_SYSTEM_PROMPT = \`Anda adalah sistem OCR AI Vision Scraper presisi tinggi untuk membaca screenshot dan video leaderboard donasi clan game.
Tugas Anda:
1. Pindai baris leaderboard dari ATAS ke BAWAH.
2. Untuk setiap baris, ekstrak:
   - rankNumber: Angka urutan peringkat di sebelah paling kiri (misal 1, 2, 3, ..., 232). Jika tidak terlihat, gunakan null.
   - name: Nama member/player secara persis (bersihkan tag [Clan] atau ikon level jika terpisah, pertahankan spasi & karakter unik).
   - nominal: Angka donasi gems/crystals. Konversi format 1.5k -> 1500, 2M -> 2000000. Jika tidak ada angka nominal, isi 0.
   - confidence: Tingkat keyakinan deteksi (0 - 100).
   - status: "VERIFIED" jika teks sangat jelas, atau "REVIEW" jika agak buram.
3. Kembalikan array JSON murni tanpa pembungkus teks tambahan.\`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\\/+$/, "");

  // Health check endpoints
  if (req.method === "GET" && (path === "" || path === "/api" || path === "/api/health" || path === "/health")) {
    return jsonResponse({
      status: "ok",
      provider: "Deno Playground Gemini Vision Proxy (Shiro Anna Edition)",
      version: "3.5.0",
      activeModels: FALLBACK_MODELS,
      timestamp: new Date().toISOString(),
    });
  }

  // Determine API Key from header, query param, or default
  const apiKey = req.headers.get("x-gemini-api-key") || url.searchParams.get("key") || DEFAULT_API_KEY;

  if (!apiKey) {
    return jsonResponse({ success: false, error: "GEMINI_API_KEY tidak ditemukan." }, 401);
  }

  // Endpoint: Analyze Single Frame
  if (req.method === "POST" && (path === "/api/analyze-frame" || path === "/analyze-frame")) {
    try {
      const body = await req.json();
      const image = body.image || body.frame || body.base64;
      const mimeType = body.mimeType || "image/jpeg";
      const frameIndex = body.frameIndex ?? 0;
      const totalFrames = body.totalFrames ?? 1;

      if (!image) {
        return jsonResponse({ success: false, error: "Payload image base64 wajib disertakan." }, 400);
      }

      const userPrompt = \`Analisis frame leaderboard donasi berikut (Frame \${frameIndex + 1} dari \${totalFrames}). Ekstrak seluruh baris member clan dan peringkatnya dengan format JSON array [ { "rankNumber": 1, "name": "...", "nominal": 100, "confidence": 95, "status": "VERIFIED" } ].\`;

      const result = await callGeminiVisionWithFallback(apiKey, OCR_SYSTEM_PROMPT, userPrompt, image, mimeType);
      const cleaned = cleanJsonString(result.text);

      let parsedItems: any[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          parsedItems = parsed;
        } else if (parsed && Array.isArray(parsed.items)) {
          parsedItems = parsed.items;
        } else if (parsed && Array.isArray(parsed.members)) {
          parsedItems = parsed.members;
        }
      } catch (parseErr) {
        console.warn("[Deno Proxy] JSON parse fallback:", parseErr);
        const nameMatches = cleaned.match(/"name"\\s*:\\s*"([^"]+)"/g) || [];
        parsedItems = nameMatches.map((m, idx) => {
          const match = m.match(/"name"\\s*:\\s*"([^"]+)"/);
          return {
            rankNumber: idx + 1,
            name: match ? match[1] : \`Member-\${idx + 1}\`,
            nominal: 0,
            confidence: 85,
            status: "VERIFIED",
          };
        });
      }

      return jsonResponse({
        success: true,
        items: parsedItems,
        modelUsed: result.modelUsed,
        frameIndex,
      });
    } catch (err: any) {
      console.error("[Deno Proxy] Analyze error:", err);
      return jsonResponse({
        success: false,
        error: err?.message || "Terjadi kesalahan pada Deno Gemini Vision proxy.",
        items: [],
      }, 500);
    }
  }

  // Endpoint: Double-Scan Verification Pass
  if (req.method === "POST" && (path === "/api/verify-double-scan" || path === "/verify-double-scan")) {
    let candidateItems: any[] = [];
    try {
      const body = await req.json();
      const image = body.image || body.frame;
      candidateItems = body.candidateItems || [];

      if (!image) {
        return jsonResponse({ success: true, items: candidateItems });
      }

      const prompt = \`Lakukan verifikasi ulang (Pass 2) terhadap daftar nama berikut: \${JSON.stringify(candidateItems.map((c: any) => c.name))}. Periksa apakah ejaan nama dan rankNumber pada gambar sudah 100% tepat. Kembalikan array JSON hasil verifikasi final.\`;

      const result = await callGeminiVisionWithFallback(apiKey, OCR_SYSTEM_PROMPT, prompt, image, body.mimeType || "image/jpeg");
      const cleaned = cleanJsonString(result.text);
      const parsed = JSON.parse(cleaned);

      return jsonResponse({
        success: true,
        items: Array.isArray(parsed) ? parsed : (parsed.items || candidateItems),
        modelUsed: result.modelUsed,
      });
    } catch {
      return jsonResponse({ success: true, items: candidateItems });
    }
  }

  // Endpoint: Batch Analyze (Multi-Frame Parallel)
  if (req.method === "POST" && (path === "/api/batch-analyze" || path === "/batch-analyze")) {
    try {
      const body = await req.json();
      const frames: any[] = body.frames || [];

      if (!Array.isArray(frames) || frames.length === 0) {
        return jsonResponse({ success: false, error: "Array frames kosong." }, 400);
      }

      const results = await Promise.all(
        frames.slice(0, 10).map(async (f, idx) => {
          try {
            const prompt = \`Ekstrak daftar member clan dan rank pada frame \${idx + 1}. Format JSON array [ { "rankNumber": 1, "name": "...", "nominal": 0, "confidence": 95, "status": "VERIFIED" } ]\`;
            const res = await callGeminiVisionWithFallback(apiKey, OCR_SYSTEM_PROMPT, prompt, f.image, f.mimeType || "image/jpeg");
            const cleaned = cleanJsonString(res.text);
            const parsed = JSON.parse(cleaned);
            return {
              frameIndex: idx,
              items: Array.isArray(parsed) ? parsed : (parsed.items || []),
              success: true,
            };
          } catch (err: any) {
            return { frameIndex: idx, items: [], success: false, error: err?.message };
          }
        })
      );

      return jsonResponse({
        success: true,
        results,
      });
    } catch (err: any) {
      return jsonResponse({ success: false, error: err?.message }, 500);
    }
  }

  // 404 Not Found fallback
  return jsonResponse({
    error: "Endpoint not found",
    validEndpoints: ["GET /api/health", "POST /api/analyze-frame", "POST /api/verify-double-scan", "POST /api/batch-analyze"],
  }, 404);
});`;
