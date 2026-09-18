import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab, Member } from '../types';
import {
  CANVAS_THEMES,
  downloadCanvas,
  paginateReportMembers,
  renderCanvasPage,
  ReportConfig
} from '../utils/canvasReportGenerator';
import { formatCurrency, formatIndonesianDate } from '../utils/fuzzyMatching';
import {
  FileImage,
  Download,
  Palette,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Sparkles,
  Calendar,
  Layers,
  UploadCloud
} from 'lucide-react';

interface CanvasReportProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const CanvasReport: React.FC<CanvasReportProps> = ({ setActiveTab }) => {
  const { members, stats, settings } = useDatabase();

  // Canvas config controls
  const [clanName, setClanName] = useState(settings.clanName || 'CLAN WIBU');
  const [reportTitle, setReportTitle] = useState(settings.reportTitle || 'LAPORAN DONASI');
  const [reportDate, setReportDate] = useState(formatIndonesianDate());
  const [selectedTheme, setSelectedTheme] = useState<string>(settings.canvasTheme || 'anime-sky');
  const [itemsPerPage, setItemsPerPage] = useState<number>(40);
  const [includeUndonated, setIncludeUndonated] = useState<boolean>(false);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  // Hidden/Visible Canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter and sort members for report (Ranked by nominal descending)
  const reportMembers = useMemo(() => {
    let list = [...members];
    if (!includeUndonated) {
      list = list.filter((m) => m.nominal > 0);
    }
    return list.sort((a, b) => {
      if (b.nominal !== a.nominal) return b.nominal - a.nominal;
      return a.name.localeCompare(b.name);
    });
  }, [members, includeUndonated]);

  // Paginate members
  const pages = useMemo(() => {
    return paginateReportMembers(reportMembers, itemsPerPage);
  }, [reportMembers, itemsPerPage]);

  const safePageIndex = Math.min(activePageIndex, Math.max(0, pages.length - 1));
  const currentPageData = pages[safePageIndex] || {
    pageIndex: 0,
    totalPages: 1,
    members: [],
    startRank: 1,
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
  ]);

  // Download Current Page as PNG
  const handleDownloadCurrentPage = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const cleanClanName = clanName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanClanName}_Laporan_Donasi_Hal_${safePageIndex + 1}.${format === 'jpeg' ? 'jpg' : 'png'}`;
    downloadCanvas(canvasRef.current, filename, format);
  };

  // Download All Pages in sequence
  const handleDownloadAllPages = async (format: 'png' | 'jpeg') => {
    if (pages.length === 0) return;

    const tempCanvas = document.createElement('canvas');
    const cleanClanName = clanName.replace(/[^a-zA-Z0-9_-]/g, '_');

    for (let i = 0; i < pages.length; i++) {
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
      };

      renderCanvasPage(tempCanvas, pages[i], config);
      const filename = `${cleanClanName}_Laporan_Donasi_Hal_${i + 1}_dari_${pages.length}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      downloadCanvas(tempCanvas, filename, format);

      // Brief delay between downloads
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <FileImage className="w-6 h-6 text-sky-600" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Canvas Report Generator
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Menghasilkan poster laporan donasi beresolusi tinggi langsung dari database clan menggunakan HTML5 Canvas API asli.
          </p>
        </div>

        {members.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              id="download-png-btn"
              onClick={() => handleDownloadCurrentPage('png')}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PNG (Hal {safePageIndex + 1})</span>
            </button>
            <button
              id="download-jpg-btn"
              onClick={() => handleDownloadCurrentPage('jpeg')}
              className="inline-flex items-center space-x-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all"
            >
              <span>JPG</span>
            </button>
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-sky-200 p-12 text-center shadow-xs">
          <FileImage className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Belum ada riwayat donasi</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Poster Canvas akan mengambil data donatur dari database nyata. Unggah file video atau foto donasi terlebih dahulu untuk membuat laporan.
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
                <h3 className="font-bold text-sm text-slate-800">Pengaturan Desain Poster</h3>
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 font-bold"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 font-semibold"
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
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500"
                  />
                </div>
              </div>

              {/* Theme Presets */}
              <div>
                <label className="font-semibold text-xs text-slate-700 block mb-1.5 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5 text-sky-600" />
                  <span>Pilihan Tema Warna (2D Anime Inspired)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(CANVAS_THEMES).map((thm) => (
                    <button
                      key={thm.id}
                      type="button"
                      onClick={() => setSelectedTheme(thm.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all text-xs flex items-center space-x-2 ${
                        selectedTheme === thm.id
                          ? 'border-sky-500 bg-sky-50 font-bold shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50 font-medium text-slate-700'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: thm.headerGradientStart }}
                      />
                      <span className="truncate">{thm.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Per Page */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-xs text-slate-700">
                    Jumlah Donatur per Poster
                  </label>
                  <span className="font-bold text-xs font-mono text-sky-600">
                    {itemsPerPage} Member
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  step="10"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Otomatis membagi menjadi {pages.length} halaman poster.
                </p>
              </div>

              {/* Include undonated checkbox */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">Sertakan member belum donasi</span>
                <input
                  type="checkbox"
                  checked={includeUndonated}
                  onChange={(e) => setIncludeUndonated(e.target.checked)}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
              </div>

              {/* Multi-page Download All */}
              {pages.length > 1 && (
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleDownloadAllPages('png')}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors shadow-xs"
                  >
                    <Download className="w-4 h-4 text-sky-400" />
                    <span>Download Semua {pages.length} Halaman (Batch)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Live Canvas Preview Section */}
          <div className="lg:col-span-8 space-y-4">
            {/* Pagination Controls */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                <Layers className="w-4 h-4 text-sky-600" />
                <span>
                  Pratinjau Poster: Halaman {safePageIndex + 1} dari {pages.length}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  disabled={safePageIndex === 0}
                  onClick={() => setActivePageIndex((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 text-xs font-semibold"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <button
                  disabled={safePageIndex >= pages.length - 1}
                  onClick={() => setActivePageIndex((p) => Math.min(pages.length - 1, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 text-xs font-semibold"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Canvas Display Frame */}
            <div className="bg-slate-100 rounded-2xl p-4 sm:p-6 border border-slate-200 flex items-center justify-center overflow-hidden shadow-inner">
              <div className="max-w-full max-h-[850px] overflow-auto rounded-xl shadow-xl border border-slate-300/80 bg-white">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto block max-w-[650px]"
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
