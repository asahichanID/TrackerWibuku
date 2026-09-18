import React, { useRef, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab } from '../types';
import { formatCurrency } from '../utils/fuzzyMatching';
import { DENO_SERVER_CODE } from '../data/denoCode';
import {
  BACKEND_STORAGE_KEY,
  API_KEY_STORAGE_KEY,
  testBackendConnection
} from '../utils/backgroundJobApi';
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
  Code2,
  Copy,
  ExternalLink,
  Zap,
  Activity,
  AlertTriangle
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

  // Form State
  const [clanName, setClanName] = useState(settings.clanName);
  const [reportTitle, setReportTitle] = useState(settings.reportTitle);
  const [creatorCredit, setCreatorCredit] = useState(settings.creatorCredit || 'Shiro Anna');
  const [targetDonation, setTargetDonation] = useState(settings.targetDonation);
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol || '💎');
  const [minConfidence, setMinConfidence] = useState(settings.minConfidence || 50);

  // Custom Deno Backend State
  const [customBackendUrl, setCustomBackendUrl] = useState(() => {
    return localStorage.getItem(BACKEND_STORAGE_KEY) || settings.customBackendUrl || '';
  });
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || settings.geminiApiKey || '';
  });
  const [testStatus, setTestStatus] = useState<{ testing: boolean; result?: { ok: boolean; message: string; details?: any } }>({ testing: false });
  const [copiedDenoCode, setCopiedDenoCode] = useState(false);
  const [showDenoCodeModal, setShowDenoCodeModal] = useState(false);

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

    const cleanBackendUrl = customBackendUrl.trim().replace(/\/+$/, '');
    const cleanApiKey = geminiApiKey.trim();

    if (cleanBackendUrl) {
      localStorage.setItem(BACKEND_STORAGE_KEY, cleanBackendUrl);
    } else {
      localStorage.removeItem(BACKEND_STORAGE_KEY);
    }

    if (cleanApiKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanApiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }

    updateSettings({
      clanName: clanName.trim() || 'CLAN WIBU',
      reportTitle: reportTitle.trim() || 'LAPORAN DONASI',
      creatorCredit: creatorCredit.trim() || 'Shiro Anna',
      targetDonation: Math.max(0, targetDonation),
      currencySymbol: currencySymbol.trim() || 'Rp',
      minConfidence,
      customBackendUrl: cleanBackendUrl,
      geminiApiKey: cleanApiKey,
    });

    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const handleTestBackend = async () => {
    setTestStatus({ testing: true });
    const res = await testBackendConnection(customBackendUrl.trim(), geminiApiKey.trim());
    setTestStatus({ testing: false, result: res });
  };

  const handleCopyDenoCode = () => {
    navigator.clipboard.writeText(DENO_SERVER_CODE);
    setCopiedDenoCode(true);
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
          Kelola konfigurasi Clan Wibu, parameter pemrosesan OCR, input data manual, dan manajemen pencadangan data nyata.
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
          <p className="font-semibold text-slate-700">Versi 1.0 (2D Anime Clean Engine)</p>
          <p>Tesseract Web Worker • HTML5 Canvas API</p>
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
              Simbol Mata Uang
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

        {/* Custom Deno / Backend API Section */}
        <div className="pt-5 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-indigo-600" />
              <h4 className="font-bold text-sm text-slate-800">
                Koneksi Backend Realtime (Deno Deploy / Deno Playground)
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowDenoCodeModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Lihat &amp; Salin Kode Deno</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Jika ingin memproses video donasi di server terpisah (Deno Deploy / Deno Playground), masukkan URL endpoint server Deno Anda di bawah ini:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 text-xs">
                Custom Deno Backend URL (Opsional)
              </label>
              <input
                type="url"
                placeholder="https://contoh-clan-wibu.deno.dev"
                value={customBackendUrl}
                onChange={(e) => setCustomBackendUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-indigo-500 font-mono text-slate-800 text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Biarkan kosong jika menggunakan server internal bawaan aplikasi.
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 text-xs">
                Gemini API Key (Opsional untuk Deno)
              </label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-indigo-500 font-mono text-slate-800 text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Dikirim via header <code>x-gemini-key</code> ke server Deno.
              </span>
            </div>
          </div>

          {/* Test Connection Button & Result */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleTestBackend}
              disabled={testStatus.testing}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${testStatus.testing ? 'animate-spin' : ''}`} />
              <span>{testStatus.testing ? 'Menguji Koneksi...' : 'Tes Koneksi Backend'}</span>
            </button>

            {testStatus.result && (
              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 ${
                  testStatus.result.ok
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {testStatus.result.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span>{testStatus.result.message}</span>
              </div>
            )}
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
            <span className="text-xs text-slate-400">Perubahan akan langsung diterapkan.</span>
          )}

          <button
            type="submit"
            id="save-settings-btn"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>

      {/* Deno Deploy / Playground Code Modal */}
      {showDenoCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  Kode Backend Standalone Deno Playground &amp; Deploy
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDenoCodeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Quick Steps */}
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 space-y-1.5">
              <span className="font-bold block text-indigo-900">🚀 4 Langkah Menjalankan di Deno:</span>
              <ol className="list-decimal list-inside space-y-1 text-indigo-900 font-medium">
                <li>
                  Buka{' '}
                  <a
                    href="https://play.deno.land"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-indigo-700 inline-flex items-center gap-0.5"
                  >
                    play.deno.land <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  atau{' '}
                  <a
                    href="https://dash.deno.com"
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold underline text-indigo-700 inline-flex items-center gap-0.5"
                  >
                    dash.deno.com <ExternalLink className="w-3 h-3" />
                  </a>.
                </li>
                <li>Klik tombol <strong>"Salin Kode Deno (main.ts)"</strong> di bawah, lalu paste ke editor Deno.</li>
                <li>Deploy / Run project Deno Anda untuk mendapatkan URL publik (misal <code>https://clan-api.deno.dev</code>).</li>
                <li>Salin link tersebut dan tempelkan ke kolom <strong>"Custom Deno Backend URL"</strong> di atas.</li>
              </ol>
            </div>

            {/* Code Block Container */}
            <div className="relative flex-1 min-h-0 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700 text-xs text-slate-300">
                <span className="font-mono">main.ts (Deno Server)</span>
                <button
                  type="button"
                  onClick={handleCopyDenoCode}
                  className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
                >
                  {copiedDenoCode ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Semua Kode</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 overflow-y-auto text-[11px] font-mono text-slate-200 leading-relaxed whitespace-pre select-all">
                {DENO_SERVER_CODE}
              </pre>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">0 Dependensi eksternal, langsung jalan natively di Deno.</span>
              <button
                type="button"
                onClick={() => setShowDenoCodeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Member Input Form */}
      <form onSubmit={handleAddManual} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
          <Plus className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-base text-slate-800">Tambah Member Manual</h3>
        </div>

        <p className="text-xs text-slate-500">
          Tambahkan member secara manual jika ada donatur yang ingin dicatat di luar pemindaian video.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nama Member</label>
            <input
              type="text"
              placeholder="Contoh: Kirito_Wibu"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs"
              required
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Nominal Donasi</label>
            <input
              type="text"
              placeholder="Contoh: 100.000"
              value={manualNominal}
              onChange={(e) => setManualNominal(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs font-mono"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Catatan (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Donasi transfer manual"
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-sky-500 text-xs"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 transition-all"
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
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
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
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Pulihkan / Impor JSON</span>
          </button>

          {/* Reset / Clear DB */}
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-colors ml-auto"
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
              Tindakan ini akan menghapus seluruh data <strong className="text-slate-800">{members.length} member</strong> dan riwayat pemindaian video. Aplikasi akan kembali ke status bersih (&quot;Belum ada riwayat donasi&quot;).
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200"
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
