import React, { useRef, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useDatabase } from '../context/DatabaseContext';
import { useBackgroundJobs } from '../context/BackgroundJobContext';
import { ActiveTab } from '../types';
import { formatCurrency } from '../utils/fuzzyMatching';
import { DENO_PLAYGROUND_CODE } from '../utils/denoTemplate';
import {
  Settings as SettingsIcon,
  Heart,
  Save,
  Download,
  Upload,
  Trash2,
  Plus,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Sliders,
  Users,
  Database,
  Info,
  Server,
  Zap,
  Activity,
  ShieldCheck,
  Check,
  Clock,
  Globe,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  KeyRound
} from 'lucide-react';

interface SettingsProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const Settings: React.FC<SettingsProps> = ({ setActiveTab }) => {
  const {
    members,
    scanSessions,
    settings,
    updateSettings,
    addManualMember,
    clearDatabase,
    exportDatabaseJson,
    importDatabaseJson,
  } = useDatabase();

  const { activeJobs, completedJobs } = useBackgroundJobs();

  // Form State
  const [clanName, setClanName] = useState(settings.clanName);
  const [reportTitle, setReportTitle] = useState(settings.reportTitle);
  const [creatorCredit, setCreatorCredit] = useState(settings.creatorCredit || 'Shiro Anna');
  const [targetDonation, setTargetDonation] = useState(settings.targetDonation);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol || '💎');
  const [minConfidence, setMinConfidence] = useState(settings.minConfidence || 50);

  // Custom Vision API / Deno Proxy URL State
  const [customApiUrl, setCustomApiUrl] = useState(() => {
    return settings.customApiUrl || localStorage.getItem('custom_vision_api_url') || '';
  });
  const [customApiKey, setCustomApiKey] = useState(() => {
    return localStorage.getItem('custom_gemini_key') || '';
  });
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pingMessage, setPingMessage] = useState('');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [copiedDenoCode, setCopiedDenoCode] = useState(false);

  // Manual Add Form
  const [manualName, setManualName] = useState('');
  const [manualNominal, setManualNominal] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // Clear Confirm Dialog
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanCustomUrl = customApiUrl.trim().replace(/\/+$/, '');
    const cleanApiKey = customApiKey.trim();

    if (cleanCustomUrl) {
      localStorage.setItem('custom_vision_api_url', cleanCustomUrl);
    } else {
      localStorage.removeItem('custom_vision_api_url');
    }

    if (cleanApiKey) {
      localStorage.setItem('custom_gemini_key', cleanApiKey);
    } else {
      localStorage.removeItem('custom_gemini_key');
    }

    updateSettings({
      clanName: clanName.trim() || 'CLAN WIBU',
      reportTitle: reportTitle.trim() || 'LAPORAN DONASI',
      creatorCredit: creatorCredit.trim() || 'Shiro Anna',
      targetDonation: Math.max(0, targetDonation),
      currencySymbol: currencySymbol.trim() || '💎',
      minConfidence,
      customApiUrl: cleanCustomUrl,
    });

    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  // Test Ping Connection to API Endpoint
  const handleTestConnection = async () => {
    const targetBase = customApiUrl.trim().replace(/\/+$/, '');
    const testUrl = targetBase ? `${targetBase}/api/health` : '/api/health';

    setPingStatus('testing');
    setPingMessage('Menghubungi endpoint server...');
    setPingLatency(null);

    const startTime = performance.now();
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (customApiKey.trim()) {
        headers['x-gemini-api-key'] = customApiKey.trim();
      }

      const res = await fetch(testUrl, {
        method: 'GET',
        headers,
      });
      const latencyMs = Math.round(performance.now() - startTime);
      setPingLatency(latencyMs);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setPingStatus('success');
        setPingMessage(
          `Koneksi Berhasil! (${latencyMs}ms) • ${data.provider || data.status || 'Server Siap'}`
        );
      } else {
        setPingStatus('error');
        setPingMessage(`Server merespons error ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      setPingStatus('error');
      setPingMessage(`Gagal terhubung ke ${testUrl}: ${err?.message || 'CORS / Network Error'}`);
    }
  };

  // Copy Deno Code
  const handleCopyDenoScript = () => {
    navigator.clipboard.writeText(DENO_PLAYGROUND_CODE);
    setCopiedDenoCode(true);
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 },
      colors: ['#0284c7', '#38bdf8', '#34d399'],
    });
    setTimeout(() => setCopiedDenoCode(false), 3000);
  };

  // Add Manual Member
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const nom = parseInt(manualNominal.replace(/\D/g, ''), 10) || 0;
    const success = addManualMember(manualName.trim(), nom, manualNotes.trim());

    if (success) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#0284c7', '#38bdf8', '#fbbf24'],
      });
      setManualName('');
      setManualNominal('');
      setManualNotes('');
      alert(`Member "${manualName}" berhasil ditambahkan ke database.`);
    }
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const jsonString = exportDatabaseJson();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_clan_wibu_donation_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import JSON Backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importDatabaseJson(content);
        alert(res.message);
        if (res.success) {
          setActiveTab('dashboard');
        }
      }
    };
    reader.readAsText(file);
  };

  // Clear DB
  const handleConfirmClear = () => {
    clearDatabase();
    setShowClearConfirm(false);
    alert('Database telah dikosongkan.');
    setActiveTab('dashboard');
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-6 h-6 text-sky-600" />
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Pengaturan &amp; Database
          </h2>
        </div>
        <p className="text-slate-500 text-sm mt-1">
          Kelola konfigurasi Clan Wibu, status pemrosesan realtime latar belakang lokal, input data manual, dan cadangan database.
        </p>
      </div>

      {/* Creator Credit Hero Badge */}
      <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 rounded-2xl p-6 border border-sky-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-200">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold border border-sky-200 mb-1">
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
              <span>Official Creator Credit</span>
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">
              Clan Wibu Donation Tracker
            </h3>
            <p className="text-xs text-slate-600">
              Dikembangkan dan dirancang oleh <strong className="text-sky-700 font-bold">Shiro Anna</strong>.
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Versi 3.5 (AI Vision Scraper &amp; Local Engine)</p>
          <p>Realtime Background • 0 API Key Required</p>
        </div>
      </div>

      {/* Local Background Engine Status Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-800">
              Status Server &amp; Realtime Background Lokal
            </h3>
          </div>
          <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Online &amp; Aktif</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
            <span className="text-slate-500 block mb-1 font-semibold">Engine Pemrosesan</span>
            <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Vision Scraper 3.5</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Tanpa API key dari user</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
            <span className="text-slate-500 block mb-1 font-semibold">Tugas Berjalan (Active)</span>
            <div className="font-extrabold text-indigo-600 flex items-center gap-1.5 text-sm">
              <Activity className="w-4 h-4 text-indigo-500" />
              <span>{activeJobs.length} Job Aktif</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Tetap jalan saat tab ditutup</span>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/60">
            <span className="text-slate-500 block mb-1 font-semibold">Riwayat Selesai</span>
            <div className="font-extrabold text-emerald-600 flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{completedJobs.length} Job Selesai</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Tersimpan di database lokal</span>
          </div>
        </div>

        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 text-xs text-indigo-900 flex items-start space-x-2.5">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-indigo-950">
              Pemrosesan Realtime Latar Belakang Mandiri
            </p>
            <p className="text-[11px] text-indigo-800 leading-relaxed">
              Saat Anda memproses video atau foto donasi, antrean berjalan di background server lokal. Anda dapat menutup halaman web, beralih aplikasi, atau bermain game tanpa khawatir progres terhenti atau terulang kembali.
            </p>
          </div>
        </div>
      </div>

      {/* Deno Playground / Cloud Proxy Configuration Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-sky-600" />
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Koneksi API Deno Playground / Cloud Vision Proxy
              </h3>
              <p className="text-xs text-slate-500">
                Gunakan URL backend Deno Playground sendiri jika server lokal / hosting production mengalami batasan request.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyDenoScript}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200/80 transition-colors shrink-0 cursor-pointer"
            title="Salin seluruh kode server Deno Playground siap pakai"
          >
            {copiedDenoCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Kode Disalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Script Deno (1-Klik)</span>
              </>
            )}
          </button>
        </div>

        {/* Step by step guide banner */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-xs space-y-2">
          <p className="font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Cara Menjalankan di Deno Playground (Gratis &amp; Cepat):</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1 leading-relaxed">
            <li>Buka <a href="https://play.deno.com" target="_blank" rel="noreferrer" className="text-sky-600 font-semibold underline inline-flex items-center gap-0.5">play.deno.com <ExternalLink className="w-3 h-3 inline" /></a> atau Deno Deploy dashboard.</li>
            <li>Klik tombol <strong>"Salin Script Deno (1-Klik)"</strong> di atas, lalu tempel (paste) menggantikan kode default di Deno Playground.</li>
            <li>Klik tombol <strong>Save / Deploy</strong> di Deno Playground, lalu salin URL yang dihasilkan (misal: <code className="bg-white px-1.5 py-0.5 rounded border text-slate-700 font-mono">https://nama-projek.deno.dev</code>).</li>
            <li>Tempel URL tersebut pada kolom input di bawah, lalu klik <strong>Tes Koneksi</strong> &amp; <strong>Simpan</strong>.</li>
          </ol>
        </div>

        {/* URL Input Form & Controls */}
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              URL Endpoint Deno Playground / Cloud Proxy
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="Contoh: https://my-ocr-proxy.deno.dev (Kosongkan jika ingin pakai server lokal)"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-mono text-slate-800 text-xs"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={pingStatus === 'testing'}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin' : ''}`} />
                <span>{pingStatus === 'testing' ? 'Memeriksa...' : 'Tes Koneksi'}</span>
              </button>
              {customApiUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomApiUrl('');
                    localStorage.removeItem('custom_vision_api_url');
                    updateSettings({ customApiUrl: '' });
                    setPingStatus('idle');
                    setPingMessage('');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Reset ke Lokal
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Jika diisi, seluruh pemindaian video &amp; foto OCR akan otomatis dialihkan ke endpoint ini.
            </p>
          </div>

          {/* Optional API Key Override */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              API Key Gemini Override (Opsional)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                placeholder="Opsional - kosongkan jika API Key sudah tertanam di Deno Playground"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-mono text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Ping Status Banner */}
          {pingStatus !== 'idle' && (
            <div
              className={`p-3.5 rounded-xl border flex items-start space-x-2.5 transition-all ${
                pingStatus === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : pingStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-sky-50 border-sky-200 text-sky-900'
              }`}
            >
              {pingStatus === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : pingStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-sky-600 animate-spin shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-bold">
                  {pingStatus === 'success'
                    ? 'Endpoint Aktif & Terhubung'
                    : pingStatus === 'error'
                    ? 'Koneksi Gagal'
                    : 'Menguji Endpoint...'}
                </p>
                <p className="text-[11px] leading-relaxed opacity-90">{pingMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-base text-slate-800">Konfigurasi Umum Clan</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          {/* Clan Name */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Nama Clan / Guild
            </label>
            <input
              type="text"
              value={clanName}
              onChange={(e) => setClanName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-bold text-slate-800 text-xs"
              required
            />
          </div>

          {/* Report Title */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Judul Laporan Poster
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-semibold text-slate-800 text-xs"
              required
            />
          </div>

          {/* Creator Credit Label */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Creator / Credit Name
            </label>
            <input
              type="text"
              value={creatorCredit}
              onChange={(e) => setCreatorCredit(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-bold text-sky-700 text-xs"
              required
            />
          </div>

          {/* Target Donation */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Target Total Donasi ({currencySymbol})
            </label>
            <input
              type="number"
              value={targetDonation}
              onChange={(e) => setTargetDonation(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-mono font-bold text-slate-800 text-xs"
            />
          </div>

          {/* Currency Symbol */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Simbol Donasi (Gems / Kristal)
            </label>
            <input
              type="text"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 font-semibold text-slate-800 text-xs"
            />
          </div>

          {/* Default OCR Min Confidence */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-semibold text-slate-700">Ambang Batas OCR (Confidence)</label>
              <span className="font-mono font-bold text-sky-600">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="85"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          {saveSuccessMsg ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengaturan berhasil disimpan!</span>
            </span>
          ) : (
            <span className="text-xs text-slate-400">Perubahan akan langsung diterapkan ke seluruh sistem.</span>
          )}

          <button
            type="submit"
            id="save-settings-btn"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Manual Member Input Form */}
      <form onSubmit={handleAddManual} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Plus className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-base text-slate-800">Tambah Member Manual</h3>
        </div>

        <p className="text-xs text-slate-500">
          Tambahkan member secara manual jika ada donatur yang ingin dicatat di luar pemindaian video/foto.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nama Member</label>
            <input
              type="text"
              placeholder="Contoh: Kirito_Wibu"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs font-medium"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nominal Donasi Gems</label>
            <input
              type="text"
              placeholder="Contoh: 1.000"
              value={manualNominal}
              onChange={(e) => setManualNominal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Catatan (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Donasi manual transfer gems"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs font-medium"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambahkan ke Database</span>
          </button>
        </div>
      </form>

      {/* Database Management / Backup & Restore */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Database className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-base text-slate-800">Manajemen &amp; Cadangan Database</h3>
        </div>

        <p className="text-xs text-slate-500">
          Database saat ini berisi <strong className="text-slate-800">{members.length} member</strong> dan{' '}
          <strong className="text-slate-800">{scanSessions.length} sesi scan</strong>. Anda dapat mengunduh backup JSON atau memulihkan data kapan saja.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Export JSON */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-sky-600" />
            <span>Download Backup JSON</span>
          </button>

          {/* Import JSON */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Pulihkan / Impor JSON</span>
          </button>

          {/* Reset / Clear DB */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors ml-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Kosongkan Database</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-extrabold text-base text-slate-900">
                Konfirmasi Kosongkan Database
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan menghapus seluruh data <strong className="text-slate-800">{members.length} member</strong> dan riwayat pemindaian video/foto. Aplikasi akan kembali ke status bersih.
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 cursor-pointer"
              >
                Ya, Hapus Semua Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
