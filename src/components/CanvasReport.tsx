import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab } from '../types';
import {
  CANVAS_THEMES,
  downloadCanvas,
  paginateReportMembers,
  renderCanvasPage,
  ReportConfig
} from '../utils/canvasReportGenerator';
import { formatIndonesianDate } from '../utils/fuzzyMatching';
import {
  FileImage,
  Download,
  Palette,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Layers,
  UploadCloud,
  Columns,
  CheckCircle2,
  Sparkles,
  Calendar,
  Eye,
  Copy,
  Check
} from 'lucide-react';

interface CanvasReportProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const CanvasReport: React.FC<CanvasReportProps> = ({ setActiveTab }) => {
  const { members, stats, settings } = useDatabase();

  // Canvas config controls
  const [clanName, setClanName] = useState(settings.clanName || 'CLAN WIBU');
  const [reportTitle, setReportTitle] = useState(settings.reportTitle || 'LAPORAN DONASI GEMS');
  const [reportDate, setReportDate] = useState(formatIndonesianDate());
  const [selectedTheme, setSelectedTheme] = useState<string>(settings.canvasTheme || 'anime-sky');
  
  // Default: 200 members per sheet (100 in Bab Kiri, 100 in Bab Kanan)
  const [itemsPerPage, setItemsPerPage] = useState<number>(200);
  const [includeUndonated, setIncludeUndonated] = useState<boolean>(true);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);

  // Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter and sort members for report (Donors first, then alphabetically by name)
  const reportMembers = useMemo(() => {
    let list = [...members];
    if (!includeUndonated) {
      list = list.filter((m) => m.status === 'donated' || m.nominal > 0);
    }
    return list.sort((a, b) => {
      const aDonated = a.status === 'donated' || a.nominal > 0;
      const bDonated = b.status === 'donated' || b.nominal > 0;
      if (aDonated !== bDonated) return aDonated ? -1 : 1;
      if (b.nominal !== a.nominal) return b.nominal - a.nominal;
      return a.name.localeCompare(b.name);
    });
  }, [members, includeUndonated]);

  // Paginate members: 100 in Left Column, 100 in Right Column (Total 200 per sheet)
  const itemsPerColumn = Math.ceil(itemsPerPage / 2);
  const pages = useMemo(() => {
    return paginateReportMembers(reportMembers, itemsPerPage, itemsPerColumn);
  }, [reportMembers, itemsPerPage, itemsPerColumn]);

  const safePageIndex = Math.min(activePageIndex, Math.max(0, pages.length - 1));
  const currentPageData = pages[safePageIndex] || {
    pageIndex: 0,
    totalPages: 1,
    members: [],
    startRank: 1,
    leftMembers: [],
    rightMembers: [],
    leftStartRank: 1,
    leftEndRank: 0,
    rightStartRank: 1,
    rightEndRank: 0,
  };

  // Re-render canvas when inputs change
  useEffect(() => {
    if (!canvasRef.current) return;

    const config: ReportConfig = {
      clanName,
      reportTitle,
      dateStr: reportDate,
      totalMembersCount: stats.totalMembers,
      donatedCount: stats.donatedCount,
      totalNominal: stats.totalNominal,
      currencySymbol: settings.currencySymbol,
      themeId: selectedTheme,
      creatorCredit: settings.creatorCredit || 'Shiro Anna',
      itemsPerPage,
      itemsPerColumn,
    };

    renderCanvasPage(canvasRef.current, currentPageData, config);
  }, [
    clanName,
    reportTitle,
    reportDate,
    selectedTheme,
    currentPageData,
    stats,
    settings,
    itemsPerPage,
    itemsPerColumn,
  ]);

  // Download Current Page as PNG or JPEG
  const handleDownloadCurrentPage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const cleanClanName = (clanName || 'Clan_Wibu').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanClanName}_Laporan_Donasi_Lembar_${safePageIndex + 1}_Bab_${currentPageData.leftStartRank}-${currentPageData.rightEndRank || currentPageData.leftEndRank}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    downloadCanvas(canvasRef.current, filename, format);
  };

  // Copy Canvas Image to Clipboard
  const handleCopyCanvasToClipboard = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = new (window as any).ClipboardItem({ 'image/png': blob });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator.clipboard as any).write([item]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }, 'image/png');
    } catch (err) {
      console.warn('Clipboard write image not supported in this browser:', err);
    }
  };

  // Download All Pages in sequence (Batch)
  const handleDownloadAllPages = async (format: 'png' | 'jpeg') => {
    if (pages.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);

    try {
      const tempCanvas = document.createElement('canvas');
      const cleanClanName = (clanName || 'Clan_Wibu').replace(/[^a-zA-Z0-9_-]/g, '_');

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const config: ReportConfig = {
          clanName,
          reportTitle,
          dateStr: reportDate,
          totalMembersCount: stats.totalMembers,
          donatedCount: stats.donatedCount,
          totalNominal: stats.totalNominal,
          currencySymbol: settings.currencySymbol,
          themeId: selectedTheme,
          creatorCredit: settings.creatorCredit || 'Shiro Anna',
          itemsPerPage,
          itemsPerColumn,
        };

        renderCanvasPage(tempCanvas, page, config);
        const filename = `${cleanClanName}_Laporan_Lembar_${i + 1}_dari_${pages.length}_(Peringkat_${page.leftStartRank}-${page.rightEndRank || page.leftEndRank}).${format === 'jpeg' ? 'jpg' : 'png'}`;
        downloadCanvas(tempCanvas, filename, format);

        // Brief delay between downloads for browser stability
        await new Promise((r) => setTimeout(r, 450));
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <FileImage className="w-6 h-6 text-sky-600" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Canvas Report Generator (200 Member / Lembar)
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Mendukung kapasitas <strong className="text-slate-700">100 orang di Bab Kiri</strong> dan{' '}
            <strong className="text-slate-700">100 orang di Bab Kanan</strong> (Total 200 per lembar). Sisa member berlanjut otomatis di lembar berikutnya.
          </p>
        </div>

        {reportMembers.length > 0 && (
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="copy-canvas-btn"
              type="button"
              onClick={handleCopyCanvasToClipboard}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all border border-slate-200"
              title="Salin Gambar ke Clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy Image</span>
                </>
              )}
            </button>
            <button
              id="download-png-btn"
              type="button"
              onClick={() => handleDownloadCurrentPage('png')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG (Lembar {safePageIndex + 1})</span>
            </button>
            <button
              id="download-jpg-btn"
              type="button"
              onClick={() => handleDownloadCurrentPage('jpeg')}
              className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-all"
            >
              <span>JPG</span>
            </button>
          </div>
        )}
      </div>

      {reportMembers.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-sky-200 p-12 text-center shadow-xs">
          <FileImage className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Belum ada riwayat donasi</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Poster Canvas akan mengambil data donatur dari database clan. Unggah file video atau foto donasi terlebih dahulu untuk membuat laporan.
          </p>
          <button
            onClick={() => setActiveTab('upload')}
            className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-200 hover:bg-sky-700 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File Donasi</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Controls Panel */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                <Sliders className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-slate-800">Pengaturan Desain Poster Canvas</h3>
              </div>

              {/* Clan Name */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1">
                  Nama Clan
                </label>
                <input
                  type="text"
                  value={clanName}
                  onChange={(e) => setClanName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 font-bold text-slate-900"
                />
              </div>

              {/* Report Title */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1">
                  Judul Laporan
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 font-semibold text-slate-900"
                />
              </div>

              {/* Date */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1">
                  Tanggal Laporan
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Theme Presets */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-sky-600" />
                  <span>Pilihan Tema Warna Poster</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(CANVAS_THEMES).map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setSelectedTheme(thm.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all text-xs flex items-center space-x-2 ${
                        selectedTheme === thm.id
                          ? 'border-sky-500 bg-sky-50 font-bold shadow-xs ring-2 ring-sky-200'
                          : 'border-slate-200 hover:bg-slate-50 font-medium text-slate-700'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-xs"
                        style={{ backgroundColor: thm.headerGradientStart }}
                      />
                      <span className="truncate">{thm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Structure Preset Buttons */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Columns className="w-3.5 h-3.5 text-sky-600" />
                    <span>Format Kapasitas Poster</span>
                  </span>
                  <span className="text-[11px] font-mono font-bold text-sky-600">
                    {itemsPerPage} Member / Lembar
                  </span>
                </label>

                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setItemsPerPage(200)}
                    className={`py-2 px-1 text-center rounded-lg border text-[11px] font-bold transition-all ${
                      itemsPerPage === 200
                        ? 'border-sky-600 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    200 Member
                    <span className="block text-[9px] font-normal text-slate-400">100 Kiri + 100 Kanan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemsPerPage(100)}
                    className={`py-2 px-1 text-center rounded-lg border text-[11px] font-bold transition-all ${
                      itemsPerPage === 100
                        ? 'border-sky-600 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    100 Member
                    <span className="block text-[9px] font-normal text-slate-400">50 Kiri + 50 Kanan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemsPerPage(50)}
                    className={`py-2 px-1 text-center rounded-lg border text-[11px] font-bold transition-all ${
                      itemsPerPage === 50
                        ? 'border-sky-600 bg-sky-50 text-sky-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    50 Member
                    <span className="block text-[9px] font-normal text-slate-400">25 Kiri + 25 Kanan</span>
                  </button>
                </div>

                <input
                  type="range"
                  min="20"
                  max="200"
                  step="10"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                  <span>Bab Kiri: {itemsPerColumn} orang</span>
                  <span>Bab Kanan: {itemsPerColumn} orang</span>
                </div>
              </div>

              {/* Include undonated checkbox */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-800 font-semibold block">Sertakan Member Belum Donasi</span>
                  <span className="text-[11px] text-slate-400">Tampilkan seluruh member klan di poster</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeUndonated}
                  onChange={(e) => setIncludeUndonated(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
              </div>

              {/* Multi-sheet summary and Download All */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="bg-sky-50/60 rounded-xl p-3 border border-sky-100 text-xs text-sky-900 flex items-start space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Total {reportMembers.length} Member Terdaftar</p>
                    <p className="text-[11px] text-sky-700">
                      Otomatis dibagi menjadi <strong>{pages.length} Lembar Poster</strong>.
                      {pages.length > 1 && ' Sisa member berlanjut secara teratur pada lembar berikutnya.'}
                    </p>
                  </div>
                </div>

                {pages.length > 1 && (
                  <button
                    type="button"
                    disabled={isDownloadingAll}
                    onClick={() => handleDownloadAllPages('png')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>
                      {isDownloadingAll ? 'Mengekspor...' : `Download Semua ${pages.length} Lembar (Batch PNG)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Live Canvas Preview Section */}
          <div className="lg:col-span-8 space-y-4">
            {/* Sheet Tabs & Pagination Navigation */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  Pratinjau Lembar {safePageIndex + 1} dari {pages.length}:
                </span>
                <span className="font-semibold text-slate-500">
                  (Peringkat #{currentPageData.leftStartRank} s/d #{currentPageData.rightEndRank || currentPageData.leftEndRank})
                </span>
              </div>

              {/* Sheet Switcher Buttons */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  disabled={safePageIndex === 0}
                  onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 text-xs font-semibold shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pages.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePageIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      safePageIndex === idx
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    Lembar {idx + 1}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safePageIndex >= pages.length - 1}
                  onClick={() => setActivePageIndex((p) => Math.min(pages.length - 1, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 text-xs font-semibold shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chapter Breakdown Pills */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="font-bold text-sky-900">Bab Kiri (Kolom 1)</span>
                </div>
                <span className="font-bold text-sky-700">
                  {currentPageData.leftMembers.length} Orang (Rank #{currentPageData.leftStartRank} - #{currentPageData.leftEndRank})
                </span>
              </div>

              <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="font-bold text-blue-900">Bab Kanan (Kolom 2)</span>
                </div>
                <span className="font-bold text-blue-700">
                  {currentPageData.rightMembers.length} Orang (Rank #{currentPageData.rightStartRank} - #{currentPageData.rightEndRank || currentPageData.rightStartRank})
                </span>
              </div>
            </div>

            {/* Canvas Display Frame with crisp rendering container */}
            <div className="bg-slate-100 rounded-2xl p-3 sm:p-5 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
              <div className="w-full max-h-[880px] overflow-y-auto rounded-xl shadow-xl border border-slate-300/80 bg-white">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto block"
                  style={{ imageRendering: 'auto' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
