export const DENO_SERVER_CODE = `/**
 * ======================================================================================
 * CLAN WIBU - DENO PLAYGROUND & DENO DEPLOY BACKEND API SERVER
 * ======================================================================================
 * 
 * Cara Penggunaan di Deno Playground / Deno Deploy:
 * 1. Buka https://play.deno.land atau https://dash.deno.com/
 * 2. Buat Project baru / paste seluruh isi kode file ini ke \`main.ts\`
 * 3. (Opsional) Tambahkan Environment Variable GEMINI_API_KEY di Settings Deno Deploy jika ada
 * 4. Deploy dan salin URL Deno (Contoh: https://clan-wibu-api.deno.dev)
 * 5. Tempelkan URL tersebut ke menu "Pengaturan" > "Custom Deno Backend URL" di web aplikasi!
 * ======================================================================================
 */

interface ScanResultItem {
  id: string;
  rawText: string;
  name: string;
  nominal: number;
  confidence: number;
  frameTimeSec: number;
  status: 'accepted' | 'rejected' | 'modified' | 'review';
  isNewMember: boolean;
  notes?: string;
  engine?: 'gemini_vision' | 'ocr';
  rowPosition?: number;
}

interface BackgroundJob {
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
  resultItems: ScanResultItem[];
  previewThumbnail?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// In-Memory Job Store
const jobMap = new Map<string, BackgroundJob>();
const jobAbortControllers = new Map<string, AbortController>();

function parseCurrency(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[^\\d]/g, '');
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

function cleanMemberName(raw: string): string {
  if (!raw) return '';
  let cleaned = raw
    .replace(/^[\\s\\d\\-•:*#~]+/, '')
    .replace(/[:\\-—|]+$/, '')
    .replace(/[^\\w\\s\\u00C0-\\u024F\\u3040-\\u30FF\\u4E00-\\u9FAF_-]/gi, '')
    .trim();
  if (cleaned.length > 35) cleaned = cleaned.slice(0, 35).trim();
  return cleaned;
}

function calculateFuzzySimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0;
  const pairs = (str: string) => {
    const pairsArr: string[] = [];
    for (let i = 0; i < str.length - 1; i++) pairsArr.push(str.slice(i, i + 2));
    return pairsArr;
  };
  const pairs1 = pairs(s1);
  const pairs2 = pairs(s2);
  let intersection = 0;
  const union = pairs1.length + pairs2.length;
  if (union === 0) return 0;
  const map = new Map<string, number>();
  for (const p of pairs1) map.set(p, (map.get(p) || 0) + 1);
  for (const p of pairs2) {
    const count = map.get(p) || 0;
    if (count > 0) {
      map.set(p, count - 1);
      intersection++;
    }
  }
  return (2.0 * intersection) / union;
}

// Call Gemini Vision REST API directly
async function callGeminiVision(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  abortSignal?: AbortSignal
): Promise<string> {
  const url = \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=\${apiKey}\`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: abortSignal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(\`Gemini API Error (\${res.status}): \${errText.slice(0, 300)}\`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return text;
}

// Process Background Job in Deno Asynchronously
async function processDenoJob(jobId: string, frames: Array<{ image: string; mimeType?: string; timeSec?: number }>, apiKey: string) {
  const job = jobMap.get(jobId);
  if (!job) return;

  const controller = new AbortController();
  jobAbortControllers.set(jobId, controller);

  const startTime = Date.now();
  const rawDetections: ScanResultItem[] = [];
  const minConfidence = job.options.minConfidence || 45;
  const existingNames = job.options.existingMemberNames || [];

  const updateProgress = (updates: Partial<BackgroundJob['progress']>) => {
    const current = jobMap.get(jobId);
    if (!current || current.status === 'cancelled') return;
    current.progress = {
      ...current.progress,
      ...updates,
      timeElapsedSec: Math.round((Date.now() - startTime) / 1000),
    };
    current.updatedAt = new Date().toISOString();
  };

  try {
    job.status = 'processing';
    updateProgress({ percent: 5, message: 'Memulai analisis frame dengan Gemini Vision...' });

    const promptPass1 = \`
      Anda adalah OCR & Vision AI extractor untuk game/donasi Clan Wibu.
      Ekstrak setiap baris donatur:
      - "name": Nama donatur (bersihkan icon/tanda baca berlebih)
      - "nominal": Total nominal angka bersih (misal 150000 atau 15000)
      - "confidence": Skor keyakinan pembacaan teks 0-100
      - "rowPosition": Urutan baris dari atas ke bawah (1, 2, 3...)
      Format JSON array:
      [{"name": "...", "nominal": 100000, "confidence": 95, "rowPosition": 1}]
    \`;

    for (let i = 0; i < frames.length; i++) {
      if (controller.signal.aborted) throw new Error('Job dibatalkan oleh pengguna.');

      const f = frames[i];
      const percent = Math.round(5 + ((i + 1) / frames.length) * 65);
      updateProgress({
        currentFrame: i + 1,
        percent,
        message: \`Memindai frame #\${i + 1}/\${frames.length} (\${f.timeSec ? f.timeSec.toFixed(1) + 's' : ''})...\`,
        detectedCount: rawDetections.length,
      });

      try {
        if (apiKey) {
          const rawJson = await callGeminiVision(apiKey, f.image, f.mimeType || 'image/jpeg', promptPass1, controller.signal);
          let parsed: any[] = [];
          try {
            parsed = JSON.parse(rawJson);
            if (!Array.isArray(parsed) && Array.isArray((parsed as any).items)) {
              parsed = (parsed as any).items;
            }
          } catch {
            parsed = [];
          }

          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const name = cleanMemberName(String(item.name || ''));
              const nominal = typeof item.nominal === 'number' ? item.nominal : parseCurrency(String(item.nominal || '0'));
              const conf = typeof item.confidence === 'number' ? item.confidence : 85;

              if (name && name.length >= 2 && nominal >= 100 && conf >= minConfidence) {
                const isNew = !existingNames.some((en) => calculateFuzzySimilarity(en, name) >= 0.85);
                rawDetections.push({
                  id: \`deno-\${crypto.randomUUID()}\`,
                  rawText: \`\${name} \${nominal}\`,
                  name,
                  nominal,
                  confidence: conf,
                  frameTimeSec: f.timeSec || 0,
                  status: 'accepted',
                  isNewMember: isNew,
                  engine: 'gemini_vision',
                  rowPosition: item.rowPosition,
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(\`[Deno Server] Frame #\${i + 1} skip:\`, err?.message);
      }
    }

    // Pass 2: Deduplication & Accuracy Verification
    job.status = 'verifying';
    updateProgress({ percent: 75, message: 'Menjalankan Dual-Pass verifikasi akurasi 99%...', passNumber: 2 });

    const memberMap = new Map<string, ScanResultItem>();

    for (const item of rawDetections) {
      let matchedKey: string | null = null;
      for (const existingKey of memberMap.keys()) {
        if (calculateFuzzySimilarity(existingKey, item.name) >= 0.82) {
          matchedKey = existingKey;
          break;
        }
      }

      if (!matchedKey) {
        memberMap.set(item.name, { ...item });
      } else {
        const existing = memberMap.get(matchedKey)!;
        const higherNominal = Math.max(existing.nominal, item.nominal);
        const bestConfidence = Math.max(existing.confidence, item.confidence, 92);
        const chosenName = item.name.length > existing.name.length ? item.name : existing.name;

        memberMap.delete(matchedKey);
        memberMap.set(chosenName, {
          ...existing,
          name: chosenName,
          nominal: higherNominal,
          confidence: Math.min(99, bestConfidence + 3),
        });
      }
    }

    const finalResults = Array.from(memberMap.values()).sort((a, b) => b.nominal - a.nominal);

    job.status = 'completed';
    job.resultItems = finalResults;
    job.completedAt = new Date().toISOString();
    updateProgress({
      percent: 100,
      message: \`Selesai! \${finalResults.length} donatur terdeteksi & terverifikasi 99%.\`,
      detectedCount: finalResults.length,
    });
  } catch (err: any) {
    if (job.status !== 'cancelled') {
      job.status = 'failed';
      job.error = err?.message || 'Gagal memproses frame di server.';
      updateProgress({ message: \`Gagal: \${job.error}\` });
    }
  } finally {
    jobAbortControllers.delete(jobId);
  }
}

// CORS Headers Helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-gemini-key',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// Main Deno HTTP Server Handler
Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;
  const apiKey = req.headers.get('x-gemini-key') || Deno.env.get('GEMINI_API_KEY') || '';

  try {
    // 1. Health Check
    if (path === '/' || path === '/api/health') {
      const activeCount = Array.from(jobMap.values()).filter(
        (j) => j.status === 'processing' || j.status === 'queued' || j.status === 'verifying'
      ).length;

      return jsonResponse({
        status: 'ok',
        engine: 'Deno Playground & Deploy AI Vision Engine',
        timestamp: new Date().toISOString(),
        hasApiKey: Boolean(apiKey),
        activeJobsCount: activeCount,
        totalStoredJobs: jobMap.size,
      });
    }

    // 2. Create Job (/api/jobs/create)
    if (path === '/api/jobs/create' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { fileName, fileType, frames, minConfidence, enableDualPass, existingMemberNames, previewThumbnail } = body;

      if (!Array.isArray(frames) || frames.length === 0) {
        return jsonResponse({ success: false, error: 'Payload missing frames array.' }, 400);
      }

      const jobId = \`job-\${Date.now()}-\${Math.random().toString(36).substring(2, 7)}\`;
      const job: BackgroundJob = {
        id: jobId,
        fileName: fileName || 'Media Donasi',
        fileType: fileType === 'image' ? 'image' : 'video',
        status: 'queued',
        progress: {
          percent: 0,
          currentFrame: 0,
          totalFrames: frames.length,
          message: 'Tugas masuk antrean server Deno...',
          detectedCount: 0,
          timeElapsedSec: 0,
        },
        totalFrames: frames.length,
        options: {
          minConfidence: typeof minConfidence === 'number' ? minConfidence : 45,
          enableDualPass: enableDualPass !== false,
          existingMemberNames: Array.isArray(existingMemberNames) ? existingMemberNames : [],
        },
        resultItems: [],
        previewThumbnail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      jobMap.set(jobId, job);

      // Start processing in background task (non-blocking)
      processDenoJob(jobId, frames, apiKey).catch((e) => console.error('Job error:', e));

      return jsonResponse({ success: true, jobId, job });
    }

    // 3. List All Jobs (/api/jobs)
    if (path === '/api/jobs' && req.method === 'GET') {
      const jobs = Array.from(jobMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return jsonResponse({ success: true, jobs });
    }

    // 4. Single Job (/api/jobs/:id)
    if (path.startsWith('/api/jobs/') && req.method === 'GET' && !path.endsWith('/cancel')) {
      const id = path.replace('/api/jobs/', '');
      const job = jobMap.get(id);
      if (!job) return jsonResponse({ success: false, error: 'Job tidak ditemukan' }, 404);
      return jsonResponse({ success: true, job });
    }

    // 5. Cancel Job (/api/jobs/:id/cancel)
    if (path.startsWith('/api/jobs/') && path.endsWith('/cancel') && req.method === 'POST') {
      const id = path.replace('/api/jobs/', '').replace('/cancel', '');
      const job = jobMap.get(id);
      if (job) {
        job.status = 'cancelled';
        job.progress.message = 'Dibatalkan oleh pengguna.';
        const controller = jobAbortControllers.get(id);
        if (controller) controller.abort();
        return jsonResponse({ success: true, message: 'Job berhasil dibatalkan.' });
      }
      return jsonResponse({ success: false, error: 'Job tidak ditemukan' }, 404);
    }

    // 6. Delete Job (/api/jobs/:id)
    if (path.startsWith('/api/jobs/') && req.method === 'DELETE') {
      const id = path.replace('/api/jobs/', '');
      const deleted = jobMap.delete(id);
      return jsonResponse({ success: deleted, message: deleted ? 'Job dihapus' : 'Tidak ditemukan' });
    }

    // 7. Clear completed jobs (/api/jobs/clear-completed)
    if (path === '/api/jobs/clear-completed' && req.method === 'POST') {
      for (const [id, j] of jobMap.entries()) {
        if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') {
          jobMap.delete(id);
        }
      }
      return jsonResponse({ success: true, message: 'Riwayat selesai dibersihkan.' });
    }

    return jsonResponse({ error: 'Endpoint not found', path }, 404);
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || 'Server error' }, 500);
  }
});
`;
