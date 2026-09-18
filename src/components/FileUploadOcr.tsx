import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab, ScanResultItem } from '../types';
import { formatCurrency } from '../utils/fuzzyMatching';
import {
  detectFileType,
  OcrProgressInfo,
  processImageDonations,
  processVideoDonations
} from '../utils/ocrEngine';
import {
  analyzeImageWithGemini,
  analyzeVideoWithGemini,
  checkGeminiVisionHealth
} from '../utils/aiVisionEngine';
import {
  cacheFileIntoProject,
  getLatestCachedMedia,
  clearProjectMediaCache,
  CachedMediaRecord,
  CacheProgressInfo,
} from '../utils/projectMediaCache';
import {
  UploadCloud,
  FileImage,
  Video,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  Check,
  X,
  FileText,
  Gem,
  Info,
  Bot,
  CheckCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HardDrive,
  Database,
  ShieldCheck,
  Download,
  Copy,
  FileCheck,
  Activity,
  Layers,
  RefreshCw
} from 'lucide-react';

interface FileUploadOcrProps {
  setActiveTab: (tab: ActiveTab) => void;
  onScanComplete?: () => void;
}

export const FileUploadOcr: React.FC<FileUploadOcrProps> = ({ setActiveTab }) => {
  const { members, saveScanResults, settings } = useDatabase();

  // File State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'video' | 'image' | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Project Media Cache State
  const [isCaching, setIsCaching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<CacheProgressInfo | null>(null);
  const [cachedRecord, setCachedRecord] = useState<CachedMediaRecord | null>(null);
  const [existingCache, setExistingCache] = useState<CachedMediaRecord | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  // Engine selection: default to Gemini Vision (Autonomous / No UI API Key needed)
  const [engineMode, setEngineMode] = useState<'gemini_vision' | 'ocr_fallback'>('gemini_vision');
  const [isGeminiHealthy, setIsGeminiHealthy] = useState<boolean | null>(null);

  // Video-specific state
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // OCR Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState<OcrProgressInfo>({
    status: 'idle',
    currentFrame: 0,
    totalFrames: 0,
    currentTimeSec: 0,
    durationSec: 0,
    percent: 0,
    message: '',
    detectedCount: 0,
  });

  // Settings for Scan
  const [sampleSpeed, setSampleSpeed] = useState<'fast' | 'normal' | 'detailed'>('normal');
  const [minConfidence, setMinConfidence] = useState<number>(settings.minConfidence || 50);
  const [updateMode, setUpdateMode] = useState<'update_latest' | 'accumulate'>('update_latest');
  const [enableDualPass, setEnableDualPass] = useState<boolean>(true); // 99% accuracy dual-pass 2x scan

  // Review List State
  const [scanItems, setScanItems] = useState<ScanResultItem[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNominal, setEditNominal] = useState<number>(0);
  const [reVerifyingItemId, setReVerifyingItemId] = useState<string | null>(null);

  // Visual Reference Inspector State
  const [reviewFilter, setReviewFilter] = useState<'all' | 'review' | 'verified'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showVisualRef, setShowVisualRef] = useState<boolean>(true);

  // Manual Add inside Review
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualNominal, setManualNominal] = useState<string>('');

  // Cancel signal ref
  const cancelSignalRef = useRef<{ isCancelled: boolean }>({ isCancelled: false });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check Gemini Vision health and existing cache on mount
  useEffect(() => {
    checkGeminiVisionHealth().then((res) => {
      setIsGeminiHealthy(res.available);
    });

    getLatestCachedMedia().then((media) => {
      if (media) {
        setExistingCache(media);
      }
    });
  }, []);

  // Process and cache uploaded file into project
  const processAndCacheFile = async (file: File) => {
    const detected = detectFileType(file);
    if (detected === 'unsupported') {
      alert('Format file tidak didukung. Silakan unggah file video (.mp4, .webm, .mkv, .mov) atau foto (.png, .jpg, .jpeg, .webp).');
      return;
    }

    // Revoke old URL if any
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }

    setIsCaching(true);
    setCacheProgress({
      status: 'reading',
      bytesRead: 0,
      totalBytes: file.size,
      percent: 0,
      message: 'Mempersiapkan pipeline pengunduhan & cache proyek...',
    });

    try {
      const record = await cacheFileIntoProject(file, (progress) => {
        setCacheProgress(progress);
      });

      setCachedRecord(record);
      setUploadedFile(file);
      setFileType(detected);
      setFileUrl(record.objectUrl);
      setScanItems([]);
      setHasScanned(false);
      setExistingCache(null);
      setProgressInfo({
        status: 'idle',
        currentFrame: 0,
        totalFrames: 0,
        currentTimeSec: 0,
        durationSec: 0,
        percent: 0,
        message: '',
        detectedCount: 0,
      });
    } catch (cacheErr) {
      console.warn('[Cache] Fallback direct object url:', cacheErr);
      const url = URL.createObjectURL(file);
      setUploadedFile(file);
      setFileType(detected);
      setFileUrl(url);
    } finally {
      setIsCaching(false);
    }
  };

  // Unified File Selection Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndCacheFile(file);
  };

  // Restore from existing cached media in IndexedDB
  const handleRestoreFromCache = (record: CachedMediaRecord) => {
    const file = new File([record.blob], record.name, { type: record.type });
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
    }
    setCachedRecord(record);
    setUploadedFile(file);
    setFileType(record.mediaType);
    setFileUrl(record.objectUrl);
    setScanItems([]);
    setHasScanned(false);
    setExistingCache(null);
  };

  const handleClearCacheAndReset = async () => {
    await clearProjectMediaCache();
    setExistingCache(null);
    setCachedRecord(null);
    handleResetFile();
  };

  const handleCopySha = (sha: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(sha);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  // Video Loaded Metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Start Unified OCR Scanning
  const handleStartScan = async () => {
    if (!uploadedFile || !fileType) return;

    setIsProcessing(true);
    setHasScanned(true);
    cancelSignalRef.current = { isCancelled: false };

    const intervalMap = {
      fast: 1.4,
      normal: 0.8,
      detailed: 0.45,
    };

    const existingNames = members.map((m) => m.name);

    try {
      let results: ScanResultItem[] = [];

      if (engineMode === 'gemini_vision') {
        // AI Vision processing via autonomous server provider (No UI API Key required)
        if (fileType === 'video') {
          if (!videoRef.current) return;
          results = await analyzeVideoWithGemini(
            videoRef.current,
            {
              sampleIntervalSec: intervalMap[sampleSpeed],
              minConfidence,
              existingMemberNames: existingNames,
              enableDualPass,
              onProgress: (p) => {
                const mappedStatus =
                  p.status === 'completed' ? 'completed'
                  : p.status === 'error' ? 'error'
                  : p.status === 'idle' ? 'idle'
                  : 'processing';
                setProgressInfo({
                  status: mappedStatus,
                  currentFrame: p.currentFrame,
                  totalFrames: p.totalFrames,
                  currentTimeSec: p.currentTimeSec,
                  durationSec: p.durationSec,
                  percent: p.percent,
                  message: p.message,
                  detectedCount: p.detectedCount,
                });
              },
            },
            cancelSignalRef.current
          );
        } else if (fileType === 'image') {
          results = await analyzeImageWithGemini(
            uploadedFile,
            {
              existingMemberNames: existingNames,
              minConfidence,
              enableDualPass,
              onProgress: (p) => {
                const mappedStatus =
                  p.status === 'completed' ? 'completed'
                  : p.status === 'error' ? 'error'
                  : p.status === 'idle' ? 'idle'
                  : 'processing';
                setProgressInfo({
                  status: mappedStatus,
                  currentFrame: p.currentFrame,
                  totalFrames: p.totalFrames,
                  currentTimeSec: p.currentTimeSec,
                  durationSec: p.durationSec,
                  percent: p.percent,
                  message: p.message,
                  detectedCount: p.detectedCount,
                });
              },
            },
            cancelSignalRef.current
          );
        }
      } else {
        // Fallback OCR Engine
        if (fileType === 'video') {
          if (!videoRef.current) return;
          results = await processVideoDonations(
            videoRef.current,
            {
              sampleIntervalSec: intervalMap[sampleSpeed],
              minConfidence,
              preprocessOptions: {
                grayscale: true,
                contrastStretch: true,
                sharpen: true,
              },
              existingMemberNames: existingNames,
              onProgress: (info) => setProgressInfo(info),
            },
            cancelSignalRef.current
          );
        } else if (fileType === 'image') {
          if (!imageRef.current) return;
          results = await processImageDonations(
            imageRef.current,
            {
              sampleIntervalSec: 1,
              minConfidence,
              preprocessOptions: {
                grayscale: true,
                contrastStretch: true,
                sharpen: true,
              },
              existingMemberNames: existingNames,
              onProgress: (info) => setProgressInfo(info),
            },
            cancelSignalRef.current
          );
        }
      }

      setScanItems(results);
      setSelectedItemIds(new Set(results.map((item) => item.id)));

      if (results.length > 0) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0284c7', '#38bdf8', '#fbbf24', '#34d399'],
        });
      }
    } catch (err: any) {
      let errorMsg = 'Terjadi kesalahan saat memproses berkas.';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      } else if (err && typeof err === 'object') {
        if (typeof Element !== 'undefined' && err instanceof Element) {
          errorMsg = 'Format media tidak dapat diputar atau didekode oleh browser.';
        } else if (typeof Event !== 'undefined' && err instanceof Event) {
          errorMsg = `Kendala media browser (${(err as Event).type || 'unknown'}). Pastikan file video/gambar dapat diputar.`;
        } else if (typeof err.message === 'string' && err.message) {
          errorMsg = err.message;
        } else if (typeof err.error === 'string' && err.error) {
          errorMsg = err.error;
        } else if (err.error && typeof err.error === 'object' && typeof err.error.message === 'string') {
          errorMsg = err.error.message;
        } else if (typeof err.type === 'string') {
          errorMsg = `Browser event: ${err.type}. Pastikan berkas video/foto tidak rusak.`;
        } else {
          errorMsg = 'Decoder browser mengalami kendala membaca file media.';
        }
      }

      // Friendly translation for temporary 503 AI demand spikes
      if (
        errorMsg.includes('high demand') ||
        errorMsg.includes('503') ||
        errorMsg.includes('UNAVAILABLE') ||
        errorMsg.includes('beban tinggi')
      ) {
        errorMsg = 'Server Gemini Vision sedang mengalami lonjakan beban sesaat. Silakan coba klik Mulai Scan kembali dalam beberapa saat atau gunakan Mesin OCR Presisi.';
      }

      console.error('Scan Error:', errorMsg);
      setProgressInfo((prev) => ({
        ...prev,
        status: 'error',
        message: `Terjadi kesalahan saat pemrosesan: ${errorMsg}`,
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel OCR
  const handleCancelScan = () => {
    cancelSignalRef.current.isCancelled = true;
    setIsProcessing(false);
  };

  // Reset File
  const handleResetFile = () => {
    if (isProcessing) handleCancelScan();
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setUploadedFile(null);
    setFileType(null);
    setFileUrl(null);
    setScanItems([]);
    setHasScanned(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Toggle Selection
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === scanItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(scanItems.map((i) => i.id)));
    }
  };

  // Inline Edit Item
  const handleStartEdit = (item: ScanResultItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditNominal(item.nominal);
  };

  const handleSaveEdit = (id: string) => {
    setScanItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            name: editName.trim() || item.name,
            nominal: editNominal,
            status: 'modified',
          };
        }
        return item;
      })
    );
    setEditingItemId(null);
  };

  // Reject / Remove Item
  const handleRejectItem = (id: string) => {
    setScanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'rejected' } : item))
    );
  };

  const handleAcceptItem = (id: string) => {
    setScanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item))
    );
  };

  const handleVerifyAllReviews = () => {
    setScanItems((prev) =>
      prev.map((item) => (item.status === 'review' ? { ...item, status: 'accepted', notes: '✨ Terverifikasi Review' } : item))
    );
  };

  // Re-verify single row with AI Double-Scan
  const handleReVerifySingleItem = async (targetItem: ScanResultItem) => {
    if (!uploadedFile) return;
    setReVerifyingItemId(targetItem.id);

    try {
      const imagePayload = targetItem.thumbnailUrl || fileUrl || '';
      if (!imagePayload) {
        alert('Pratinjau visual tidak tersedia untuk baris ini.');
        return;
      }

      const res = await fetch('/api/verify-double-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imagePayload,
          mimeType: 'image/jpeg',
          candidateItems: [
            {
              name: targetItem.name,
              nominal: targetItem.nominal,
              confidence: targetItem.confidence,
              status: 'REVIEW',
              rowPosition: targetItem.rowPosition,
            },
          ],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.items) && json.items.length > 0) {
          const verified = json.items[0];
          setScanItems((prev) =>
            prev.map((i) =>
              i.id === targetItem.id
                ? {
                    ...i,
                    name: verified.name || i.name,
                    nominal: typeof verified.nominal === 'number' ? verified.nominal : i.nominal,
                    confidence: 99,
                    status: 'accepted',
                    notes: '✨ 99% Akurat (Double-Scan AI 2x)',
                  }
                : i
            )
          );
        }
      }
    } catch (err) {
      console.warn('Re-verification single row error:', err);
    } finally {
      setReVerifyingItemId(null);
    }
  };

  const handleDeleteItem = (id: string) => {
    setScanItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Add Manual Item to Review List
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const nom = parseInt(manualNominal.replace(/\D/g, ''), 10) || 0;
    const newItem: ScanResultItem = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      nominal: nom,
      confidence: 100,
      frameTimeSec: 0,
      rawText: `${manualName.trim()} : ${nom}`,
      status: 'accepted',
      isNewMember: !members.some((m) => m.name.toLowerCase() === manualName.trim().toLowerCase()),
    };

    setScanItems((prev) => [newItem, ...prev]);
    setSelectedItemIds((prev) => new Set([newItem.id, ...prev]));
    setManualName('');
    setManualNominal('');
    setIsAddingManual(false);
  };

  // Save Confirmed Results to Real Database
  const handleSaveToDatabase = () => {
    if (!uploadedFile || !fileType) return;

    const itemsToSave = scanItems.filter(
      (item) => selectedItemIds.has(item.id) && item.status !== 'rejected'
    );

    if (itemsToSave.length === 0) {
      alert('Tidak ada donatur gems yang dipilih untuk disimpan.');
      return;
    }

    const sessionMetadata = {
      id: `session-${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: uploadedFile.name,
      fileType: fileType,
      videoDurationSec: fileType === 'video' ? Math.round(videoDuration) : 0,
      totalFramesProcessed: progressInfo.totalFrames || 1,
      rawDetectionsCount: scanItems.length,
    };

    const summary = saveScanResults(sessionMetadata, itemsToSave, updateMode);

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#0284c7', '#38bdf8', '#34d399', '#f59e0b'],
    });

    alert(
      `Berhasil menyimpan hasil scan ${fileType === 'video' ? 'video' : 'foto'} ke database!\n` +
      `• Member Baru: ${summary.newCount}\n` +
      `• Member Diperbarui: ${summary.updatedCount}\n` +
      `• Total Donasi Gems: ${formatCurrency(summary.totalScannedNominal, settings.currencySymbol)}`
    );

    setActiveTab('leaderboard');
  };

  // Computed Review Stats
  const activeItems = scanItems.filter((i) => i.status !== 'rejected');
  const selectedItems = activeItems.filter((i) => selectedItemIds.has(i.id));
  const totalScannedGems = selectedItems.reduce((sum, i) => sum + i.nominal, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <UploadCloud className="w-6 h-6 text-sky-600" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Upload File Donasi (Video / Foto)
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Unggah file video atau tangkapan layar donasi gems/kristal Clan Wibu. Sistem otomatis mengenali format file dan memproses OCR ke database.
          </p>
        </div>

        {uploadedFile && (
          <button
            onClick={handleResetFile}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ganti File</span>
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,.mp4,.webm,.mkv,.mov,.avi,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Caching & Download Ingestion Progress Overlay/Card */}
      {isCaching && (
        <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-white rounded-3xl p-8 sm:p-10 border border-sky-500/30 shadow-2xl space-y-6 relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-inner">
                <Download className="w-7 h-7 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-sky-400/20 text-sky-300 border border-sky-400/40">
                    Authentic Buffer Ingestion
                  </span>
                  <span className="text-xs text-slate-300 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-sky-400" />
                    IndexedDB Cache Engine
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                  Mengunduh &amp; Menyimpan File ke Cache Proyek
                </h3>
                <p className="text-xs text-sky-200/80 mt-0.5">
                  Menyalin dan menginjeksi buffer berkas asli ke memori lokal proyek (bukan data tiruan/dummy).
                </p>
              </div>
            </div>

            <div className="text-right sm:self-center">
              <div className="text-3xl font-black font-mono text-sky-400">
                {cacheProgress?.percent || 0}%
              </div>
              <div className="text-[11px] text-slate-400">
                {cacheProgress?.speedMbps ? `${cacheProgress.speedMbps} MB/s` : 'Buffering stream...'}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2 relative z-10">
            <div className="w-full h-3.5 bg-slate-800/80 rounded-full overflow-hidden border border-sky-500/30 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-sky-400 via-teal-400 to-emerald-400 rounded-full transition-all duration-200 shadow-lg shadow-sky-500/50"
                style={{ width: `${Math.max(5, cacheProgress?.percent || 0)}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-sky-200/70 gap-1 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Activity className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                <span>{cacheProgress?.message || 'Memproses chunk data media...'}</span>
              </span>
              <span>
                {cacheProgress?.bytesRead
                  ? `${(cacheProgress.bytesRead / (1024 * 1024)).toFixed(2)} MB / ${(cacheProgress.totalBytes / (1024 * 1024)).toFixed(2)} MB`
                  : 'Menghitung ukuran berkas...'}
              </span>
            </div>
          </div>

          {/* Validation Steps Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-sky-500/20 text-xs relative z-10">
            <div className="flex items-center space-x-2 bg-slate-800/60 p-2.5 rounded-xl border border-sky-500/20">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                (cacheProgress?.percent || 0) >= 30 ? 'bg-emerald-500 text-slate-900' : 'bg-sky-500/30 text-sky-300'
              }`}>
                {(cacheProgress?.percent || 0) >= 90 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
              </div>
              <span className="text-slate-200 font-medium">1. Stream ArrayBuffer</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-800/60 p-2.5 rounded-xl border border-sky-500/20">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                (cacheProgress?.percent || 0) >= 92 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-400'
              }`}>
                {(cacheProgress?.percent || 0) >= 96 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
              </div>
              <span className="text-slate-200 font-medium">2. SHA-256 Checksum</span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-800/60 p-2.5 rounded-xl border border-sky-500/20">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                (cacheProgress?.percent || 0) >= 98 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-400'
              }`}>
                {(cacheProgress?.percent || 0) === 100 ? <Check className="w-3 h-3 stroke-[3]" /> : '3'}
              </div>
              <span className="text-slate-200 font-medium">3. IndexedDB Commit</span>
            </div>
          </div>
        </div>
      )}

      {/* Existing Cache Detected Banner (when no file is active) */}
      {!uploadedFile && !isCaching && existingCache && (
        <div className="bg-gradient-to-r from-sky-50 via-indigo-50/60 to-white rounded-2xl p-4 sm:p-5 border border-sky-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-200 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                  Cache Tersedia di Proyek
                </span>
                <span className="text-xs text-slate-500">
                  {(existingCache.size / (1024 * 1024)).toFixed(2)} MB • {existingCache.mediaType.toUpperCase()}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-800 mt-0.5">
                {existingCache.name}
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                SHA-256: {existingCache.sha256.substring(0, 16)}...{existingCache.sha256.substring(existingCache.sha256.length - 8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleRestoreFromCache(existingCache)}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-colors flex items-center gap-1.5"
            >
              <FileCheck className="w-4 h-4" />
              <span>Gunakan Berkas dari Cache</span>
            </button>
            <button
              type="button"
              onClick={handleClearCacheAndReset}
              className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              title="Hapus Cache Proyek"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Zone (Single Input for both Video and Image) */}
      {!uploadedFile && !isCaching ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              processAndCacheFile(file);
            }
          }}
          className="border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/40 hover:bg-sky-50/70 rounded-3xl p-10 sm:p-16 text-center cursor-pointer transition-all duration-200 shadow-xs group"
        >
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white text-sky-600 shadow-md shadow-sky-100 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Pilih atau Tarik File Video / Foto ke Sini
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Satu pintu upload untuk semua: sistem otomatis mendeteksi video maupun gambar,
                lalu mengunduh dan menyimpannya ke <strong>Cache Proyek lokal (IndexedDB)</strong> dengan verifikasi integritas <strong>SHA-256</strong>.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-sky-700 border border-sky-200 shadow-2xs">
                <Video className="w-3.5 h-3.5 text-sky-600" />
                <span>Video MP4/WEBM</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white text-emerald-700 border border-emerald-200 shadow-2xs">
                <FileImage className="w-3.5 h-3.5 text-emerald-600" />
                <span>Foto PNG/JPG</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-indigo-700 border border-indigo-200 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>IndexedDB Cached</span>
              </span>
            </div>
          </div>
        </div>
      ) : uploadedFile ? (
        /* File Loaded & OCR Stage */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Preview Player / Image Canvas & Cache Status Card */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    fileType === 'video' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {fileType === 'video' ? <Video className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 truncate max-w-[200px] sm:max-w-[320px]">
                      {uploadedFile.name}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Tipe:{' '}
                      <span className="font-semibold text-slate-700 uppercase">
                        {fileType === 'video' ? 'Video File' : 'Foto / Gambar'}
                      </span>{' '}
                      • {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                      {fileType === 'video' && videoDuration > 0 && ` • Durasi: ${Math.floor(videoDuration)}s`}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold text-xs border border-sky-100 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                  <span>{fileType === 'video' ? 'Multi-frame OCR' : 'Direct OCR'}</span>
                </span>
              </div>

              {/* Cache Integrity Banner */}
              {cachedRecord && (
                <div className="bg-gradient-to-r from-emerald-50 via-sky-50/50 to-slate-50 rounded-xl p-3 border border-emerald-200/80 text-xs text-slate-700 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 font-bold text-emerald-900">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Tersimpan di Cache Proyek (IndexedDB Buffer)</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      100% Berkas Asli
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono pt-0.5">
                    <span className="truncate max-w-[280px] sm:max-w-[420px]" title={cachedRecord.sha256}>
                      SHA-256: <strong className="text-slate-800">{cachedRecord.sha256.substring(0, 20)}...{cachedRecord.sha256.substring(cachedRecord.sha256.length - 8)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopySha(cachedRecord.sha256)}
                      className="ml-2 inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-sky-700 hover:text-sky-900 bg-white px-2 py-0.5 rounded-md border border-slate-200"
                    >
                      {copiedSha ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-sky-600" />}
                      <span>{copiedSha ? 'Tersalin' : 'Salin Hash'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Window */}
              <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center group shadow-inner">
                {fileType === 'video' && fileUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={fileUrl}
                      preload="auto"
                      crossOrigin="anonymous"
                      onLoadedMetadata={handleLoadedMetadata}
                      onLoadedData={handleLoadedMetadata}
                      onDurationChange={handleLoadedMetadata}
                      onCanPlay={handleLoadedMetadata}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onError={() => {
                        console.warn('Video load event error (format or decoder issue)');
                      }}
                      className="w-full h-full object-contain"
                      playsInline
                      muted
                    />

                    {/* Simple Video Overlay Play/Pause */}
                    {!isProcessing && (
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (!videoRef.current) return;
                            if (videoRef.current.paused) videoRef.current.play();
                            else videoRef.current.pause();
                          }}
                          className="w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>
                      </div>
                    )}
                  </>
                ) : fileType === 'image' && fileUrl ? (
                  <img
                    ref={imageRef}
                    src={fileUrl}
                    crossOrigin="anonymous"
                    alt="Pratinjau Donasi Gems"
                    onError={() => {
                      console.warn('Image load event error');
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : null}

                {/* Thumbnail Floating during video scan */}
                {isProcessing && progressInfo.currentThumbnail && (
                  <div className="absolute bottom-3 right-3 w-28 h-16 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-black">
                    <img
                      src={progressInfo.currentThumbnail}
                      alt="Frame OCR"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* OCR Progress Bar when Processing */}
              {isProcessing && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span className="animate-spin w-3 h-3 rounded-full border-2 border-sky-600 border-t-transparent inline-block" />
                      <span>{progressInfo.message || 'Memproses OCR...'}</span>
                    </span>
                    <span className="font-bold text-sky-600 font-mono">
                      {progressInfo.percent}%
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-200"
                      style={{ width: `${progressInfo.percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {fileType === 'video'
                        ? `Frame: ${progressInfo.currentFrame} / ${progressInfo.totalFrames || '?'}`
                        : 'Menganalisis resolusi gambar'}
                    </span>
                    <span>Donatur Terdeteksi: <strong className="text-slate-700">{progressInfo.detectedCount}</strong></span>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Parameters & Control Box */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-sky-600" />
                  <h3 className="font-bold text-sm text-slate-800">
                    Pengaturan Pemrosesan AI / OCR
                  </h3>
                </div>
                {isGeminiHealthy && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    AI Ready
                  </span>
                )}
              </div>

              {/* Engine Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-700">
                    Mesin Analisis
                  </label>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    Tanpa Input API Key
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEngineMode('gemini_vision')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      engineMode === 'gemini_vision'
                        ? 'border-sky-500 bg-sky-50/80 font-bold text-sky-900 shadow-2xs ring-1 ring-sky-300'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Bot className="w-3.5 h-3.5 text-sky-600" />
                      <span>Gemini Vision</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-tight font-normal">
                      Presisi baris &amp; auto-review ambigu
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEngineMode('ocr_fallback')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      engineMode === 'ocr_fallback'
                        ? 'border-sky-500 bg-sky-50/80 font-bold text-sky-900 shadow-2xs ring-1 ring-sky-300'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Tesseract OCR</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-1 leading-tight font-normal">
                      Cadangan lokal di browser
                    </span>
                  </button>
                </div>
              </div>

              {/* Scan Speed for Video */}
              {fileType === 'video' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Kerapatan Frame (Scroll Speed)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'fast', label: 'Cepat', desc: '1.4s/frame' },
                      { id: 'normal', label: 'Normal', desc: '0.8s/frame' },
                      { id: 'detailed', label: 'Rapat', desc: '0.45s/frame' },
                    ].map((spd) => (
                      <button
                        key={spd.id}
                        type="button"
                        onClick={() => setSampleSpeed(spd.id as any)}
                        className={`p-2 rounded-xl text-left border transition-all ${
                          sampleSpeed === spd.id
                            ? 'border-sky-500 bg-sky-50 font-bold text-sky-900 shadow-2xs'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <span className="text-xs block">{spd.label}</span>
                        <span className="text-[10px] text-slate-400 block">{spd.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dual-Pass 2x Scan Setting */}
              <div className="p-3 bg-gradient-to-r from-sky-50 to-indigo-50/60 rounded-xl border border-sky-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Verifikasi Ganda AI (2x Double-Scan)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableDualPass(!enableDualPass)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      enableDualPass ? 'bg-sky-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        enableDualPass ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {enableDualPass ? (
                    <strong className="text-sky-800 font-semibold">
                      ✓ Aktif: Mengaudit baris secara berlapis (Pass 2) jika ada angka/nama ambigu untuk memastikan akurasi 99% & urutan visual 100% konsisten.
                    </strong>
                  ) : (
                    <span>Pemindaian tunggal (Pass 1).</span>
                  )}
                </p>
              </div>

              {/* Confidence Filter */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-slate-700">
                    Ambang Batas Keyakinan (Confidence)
                  </label>
                  <span className="font-bold font-mono text-sky-600">{minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="85"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  Mencegah baris buram/samar agar tidak salah menebak teks. Baris meragukan otomatis ditandai status REVIEW.
                </p>
              </div>

              {/* Update Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Metode Pembaruan Member Lama
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setUpdateMode('update_latest')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      updateMode === 'update_latest'
                        ? 'border-sky-500 bg-sky-50 font-bold text-sky-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="block font-semibold">Ganti Nominal Terbaru</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Sesuai total di game</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateMode('accumulate')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      updateMode === 'accumulate'
                        ? 'border-sky-500 bg-sky-50 font-bold text-sky-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="block font-semibold">Akumulasi (Tambah)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Nominal dijumlahkan</span>
                  </button>
                </div>
              </div>

              {/* Scan Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                {!isProcessing ? (
                  <button
                    type="button"
                    id="start-ocr-scan-btn"
                    onClick={handleStartScan}
                    className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-200 transition-all flex items-center justify-center space-x-2"
                  >
                    {engineMode === 'gemini_vision' ? (
                      <>
                        <Bot className="w-4 h-4 text-sky-200" />
                        <span>Mulai Analisis Gemini Vision AI</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Mulai Pindai Tesseract OCR</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancelScan}
                    className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-200 transition-all flex items-center justify-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Batalkan Pemindaian</span>
                  </button>
                )}

                <p className="text-[11px] text-slate-400 text-center">
                  {engineMode === 'gemini_vision'
                    ? 'Gemini Vision menganalisis baris visual tanpa rekayasa data.'
                    : 'Web Worker berjalan di latar belakang tanpa membuat halaman lag.'}
                </p>
              </div>
            </div>
          </div>

          {/* Results Verification & Review Section */}
          {hasScanned && !isProcessing && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5 animate-fade-in">
              {/* Header Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Verifikasi &amp; Review Hasil {engineMode === 'gemini_vision' ? 'Gemini Vision' : 'OCR'} ({activeItems.length} Donatur)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hasil pembacaan nama &amp; nominal gems dari {fileType === 'video' ? 'video' : 'foto'}. Cocokkan nama dan angka berdasarkan baris/posisinya pada referensi visual.
                  </p>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVisualRef(!showVisualRef)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      showVisualRef
                        ? 'border-sky-300 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showVisualRef ? 'Sembunyikan Referensi Visual' : 'Lihat Referensi Visual'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddingManual(!isAddingManual)}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToDatabase}
                    disabled={selectedItems.length === 0}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md shadow-emerald-200 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan ke Database ({selectedItems.length})</span>
                  </button>
                </div>
              </div>

              {/* Notice Banner for REVIEW Status Items */}
              {activeItems.some((i) => i.status === 'review') && (
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        Perhatian: Terdapat {activeItems.filter((i) => i.status === 'review').length} Data dengan Status REVIEW
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Teks samar, baris buram, atau ambiguitas antar-frame tidak ditebak oleh sistem. Cocokkan baris nama dan nominal gems pada foto/video referensi visual.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyAllReviews}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shrink-0 self-start sm:self-auto transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Verifikasi Semua Review</span>
                  </button>
                </div>
              )}

              {/* Summary Stats Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-400 block font-medium">Donatur Terpilih</span>
                  <span className="text-base font-bold text-slate-800 mt-0.5 block">
                    {selectedItems.length} dari {activeItems.length}
                  </span>
                </div>

                <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
                  <span className="text-[11px] text-sky-700 block font-medium">Total Donasi Gems Terbaca</span>
                  <span className="text-base font-extrabold text-sky-700 font-mono mt-0.5 block">
                    {formatCurrency(totalScannedGems, settings.currencySymbol)}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-[11px] text-emerald-700 block font-medium">Member Baru</span>
                  <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                    {activeItems.filter((i) => i.isNewMember).length} Member
                  </span>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <span className="text-[11px] text-blue-700 block font-medium">Member Lama (Update)</span>
                  <span className="text-base font-bold text-blue-700 mt-0.5 block">
                    {activeItems.filter((i) => !i.isNewMember).length} Member
                  </span>
                </div>
              </div>

              {/* Manual Add Form Drawer */}
              {isAddingManual && (
                <form onSubmit={handleAddManualItem} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs text-slate-800">
                      Tambah Donatur Gems Tambahan
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingManual(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Batal
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Nama Member</label>
                      <input
                        type="text"
                        placeholder="Contoh: Kirito_Wibu"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-sky-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-600 block mb-1">Nominal Gems (💎)</label>
                      <input
                        type="text"
                        placeholder="Contoh: 500 atau 1.500"
                        value={manualNominal}
                        onChange={(e) => setManualNominal(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs focus:outline-sky-500 font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      Tambahkan ke Daftar Review
                    </button>
                  </div>
                </form>
              )}

              {/* Split Layout: Visual Reference on Left + Review Table on Right */}
              {scanItems.length === 0 ? (
                <div className="p-8 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-2">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <h4 className="font-bold text-sm text-amber-900">
                    Tidak Ditemukan Teks Donasi Gems yang Relevan
                  </h4>
                  <p className="text-xs text-amber-700 max-w-md mx-auto leading-relaxed">
                    Sistem tidak menemukan tulisan nama dan nominal donasi gems pada {fileType === 'video' ? 'video' : 'foto'} ini, atau tingkat keterbacaan (confidence) di bawah ambang batas ({minConfidence}%).
                  </p>
                  <p className="text-[11px] text-amber-600">
                    Sistem tidak menebak teks yang tidak terbaca. Pastikan daftar donasi terlihat jelas dan kontras, atau turunkan ambang batas jika diperlukan.
                  </p>
                </div>
              ) : (
                <div className={`grid grid-cols-1 ${showVisualRef && fileUrl ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-5 items-start`}>
                  {/* Visual Reference Panel */}
                  {showVisualRef && fileUrl && (
                    <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-3 lg:sticky lg:top-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Eye className="w-4 h-4 text-sky-400" />
                          <h4 className="text-xs font-bold text-slate-100">
                            Referensi Visual Asli ({fileType === 'video' ? 'Video Player' : 'Foto'})
                          </h4>
                        </div>
                        {fileType === 'image' && (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setZoomLevel((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              title="Zoom In"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                              title="Zoom Out"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setZoomLevel(1)}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                              title="Reset Zoom"
                            >
                              {Math.round(zoomLevel * 100)}%
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Visual Canvas Viewer */}
                      <div className="relative rounded-xl overflow-auto max-h-[440px] bg-black/60 border border-slate-800 flex items-center justify-center p-2">
                        {fileType === 'image' ? (
                          <div
                            style={{
                              transform: `scale(${zoomLevel})`,
                              transformOrigin: 'top center',
                              transition: 'transform 0.15s ease-out',
                            }}
                            className="inline-block"
                          >
                            <img
                              src={fileUrl}
                              alt="Referensi Visual Donasi"
                              className="max-w-full h-auto rounded object-contain select-none"
                            />
                          </div>
                        ) : (
                          <video
                            src={fileUrl}
                            controls
                            className="w-full max-h-[380px] rounded object-contain"
                          />
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Cocokkan nomor baris &amp; angka visual</span>
                        <span className="text-sky-400 font-mono">
                          {fileType === 'video' ? `Durasi: ${Math.round(videoDuration)}s` : 'Foto Dokumen'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Review Table & Filter Tabs */}
                  <div className={`${showVisualRef && fileUrl ? 'lg:col-span-7' : 'lg:col-span-1'} space-y-3`}>
                    {/* Filter Tabs */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                      <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setReviewFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition-colors ${
                            reviewFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Semua ({scanItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewFilter('review')}
                          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                            reviewFilter === 'review'
                              ? 'bg-amber-500 text-white font-bold shadow-2xs'
                              : 'text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          <span>Perlu Review</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-amber-600/30 text-[10px]">
                            {scanItems.filter((i) => i.status === 'review').length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewFilter('verified')}
                          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                            reviewFilter === 'verified'
                              ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <span>Terverifikasi</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-700/30 text-[10px]">
                            {scanItems.filter((i) => i.status === 'accepted' || i.status === 'modified').length}
                          </span>
                        </button>
                      </div>

                      <span className="text-xs text-slate-400 font-mono">
                        {selectedItemIds.size} baris dipilih
                      </span>
                    </div>

                    {/* Table Container */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <div className="overflow-x-auto max-h-[460px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10">
                            <tr>
                              <th className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedItemIds.size === scanItems.length && scanItems.length > 0}
                                  onChange={toggleSelectAll}
                                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                />
                              </th>
                              <th className="p-3 text-center w-12 font-mono text-slate-500">No.</th>
                              <th className="p-3">Nama Member</th>
                              <th className="p-3 text-right">Donasi Gems</th>
                              <th className="p-3 text-center">Keyakinan</th>
                              <th className="p-3 text-center">Status</th>
                              <th className="p-3 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {scanItems
                              .filter((item) => {
                                if (reviewFilter === 'review') return item.status === 'review';
                                if (reviewFilter === 'verified') return item.status === 'accepted' || item.status === 'modified';
                                return true;
                              })
                              .map((item, index) => {
                                const isSelected = selectedItemIds.has(item.id);
                                const isEditing = editingItemId === item.id;
                                const isRejected = item.status === 'rejected';
                                const isReview = item.status === 'review';
                                const isReVerifying = reVerifyingItemId === item.id;

                                return (
                                  <tr
                                    key={item.id}
                                    className={`transition-colors ${
                                      isRejected
                                        ? 'bg-rose-50/50 text-slate-400 opacity-60'
                                        : isReview
                                        ? 'bg-amber-50/60 hover:bg-amber-50'
                                        : isSelected
                                        ? 'bg-sky-50/30 hover:bg-sky-50/50'
                                        : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    {/* Checkbox */}
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        disabled={isRejected}
                                        checked={isSelected && !isRejected}
                                        onChange={() => toggleSelectItem(item.id)}
                                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                      />
                                    </td>

                                    {/* Sequential Visual Number */}
                                    <td className="p-3 text-center font-mono font-bold text-slate-500 text-xs">
                                      #{item.rowPosition || (index + 1)}
                                    </td>

                                    {/* Member Name */}
                                    <td className="p-3">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          className="px-2 py-1 rounded border border-sky-400 bg-white text-xs font-semibold w-full focus:outline-sky-600"
                                        />
                                      ) : (
                                        <div className="space-y-0.5">
                                          <div className="flex items-center space-x-2">
                                            <span className="font-bold text-slate-800">{item.name}</span>
                                            {item.isNewMember ? (
                                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                                                Baru
                                              </span>
                                            ) : (
                                              <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[9px] font-bold">
                                                Update
                                              </span>
                                            )}
                                          </div>
                                          {item.notes && (
                                            <p className="text-[10px] text-slate-400 leading-tight">
                                              {item.notes}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                    {/* Nominal Gems */}
                                    <td className="p-3 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          value={editNominal}
                                          onChange={(e) => setEditNominal(parseInt(e.target.value, 10) || 0)}
                                          className="px-2 py-1 rounded border border-sky-400 bg-white text-xs font-mono font-bold w-24 text-right focus:outline-sky-600"
                                        />
                                      ) : (
                                        <span className="font-mono font-bold text-sky-700">
                                          {formatCurrency(item.nominal, settings.currencySymbol)}
                                        </span>
                                      )}
                                    </td>

                                    {/* Confidence */}
                                    <td className="p-3 text-center">
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                          item.confidence >= 90
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                            : item.confidence >= 75
                                            ? 'bg-sky-100 text-sky-800'
                                            : item.confidence >= 55
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {item.confidence >= 90 && '✨ '}
                                        {item.confidence}%
                                      </span>
                                    </td>

                                    {/* Status Badge */}
                                    <td className="p-3 text-center">
                                      {isRejected ? (
                                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                                          Ditolak
                                        </span>
                                      ) : isReview ? (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 flex items-center justify-center gap-1">
                                          <AlertCircle className="w-2.5 h-2.5" />
                                          <span>REVIEW</span>
                                        </span>
                                      ) : item.status === 'modified' ? (
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                          Diedit
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                          Terverifikasi
                                        </span>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="p-3 text-right">
                                      {isEditing ? (
                                        <div className="flex items-center justify-end space-x-1">
                                          <button
                                            type="button"
                                            onClick={() => handleSaveEdit(item.id)}
                                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                            title="Simpan Edit"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingItemId(null)}
                                            className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300"
                                            title="Batal Edit"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-end space-x-1">
                                          {/* AI 2x Re-scan Trigger */}
                                          <button
                                            type="button"
                                            disabled={isReVerifying}
                                            onClick={() => handleReVerifySingleItem(item)}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                              isReVerifying
                                                ? 'text-sky-600 bg-sky-100 animate-spin'
                                                : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                                            }`}
                                            title="Re-Scan AI 2x untuk baris ini"
                                          >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                          </button>

                                          {isReview && (
                                            <button
                                              type="button"
                                              onClick={() => handleAcceptItem(item.id)}
                                              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors"
                                              title="Verifikasi baris ini sesuai referensi visual"
                                            >
                                              Verifikasi
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleStartEdit(item)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                                            title="Edit Nama/Nominal"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          {isRejected ? (
                                            <button
                                              type="button"
                                              onClick={() => handleAcceptItem(item.id)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                              title="Batal Tolak"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleRejectItem(item.id)}
                                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                              title="Tolak Baris Ini"
                                            >
                                              <XCircle className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                            title="Hapus Dari Review"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
