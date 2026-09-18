import React from 'react';
import { useBackgroundJobs } from '../context/BackgroundJobContext';
import { ActiveTab, BackgroundJob } from '../types';
import { formatIndonesianDateTime } from '../utils/fuzzyMatching';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  X,
  Play,
  FileImage,
  Video,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Layers,
  Flame,
  Check
} from 'lucide-react';

interface BackgroundJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const BackgroundJobModal: React.FC<BackgroundJobModalProps> = ({
  isOpen,
  onClose,
  setActiveTab,
}) => {
  const {
    jobs,
    activeJobs,
    completedJobs,
    loadJobForReview,
    cancelJob,
    deleteJob,
    clearCompleted,
    refreshJobs,
  } = useBackgroundJobs();

  if (!isOpen) return null;

  const handleOpenResult = (job: BackgroundJob) => {
    loadJobForReview(job);
    setActiveTab('upload');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-200">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-lg text-slate-900 tracking-tight">
                  Riwayat &amp; Antrean Proses Server
                </h3>
                {activeJobs.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold animate-pulse">
                    {activeJobs.length} Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pemrosesan AI berjalan di server. Browser boleh ditutup atau dibersihkan sewaktu-waktu.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => refreshJobs()}
              className="p-2 rounded-xl text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              title="Segarkan data status"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Notice Banner */}
        <div className="p-3.5 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200/80 rounded-2xl flex items-start space-x-3 text-xs text-sky-900">
          <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Aman Ditinggal Main Game &amp; Tutup Browser</p>
            <p className="text-sky-700/90 text-[11px] leading-relaxed">
              Tiap kali proses dimulai, server backend otomatis mengekstrak frame, menjalankan AI Dual-Pass 2x scan, dan menyimpan hasilnya. Saat Anda kembali membuka web, hasil sudah siap dibuka!
            </p>
          </div>
        </div>

        {/* Modal Body / Jobs List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
          {jobs.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Clock className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-700 text-sm">Belum ada antrean proses</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Unggah video atau foto di tab Upload File untuk memulai pemindaian AI di server.
              </p>
            </div>
          ) : (
            <>
              {/* Active Jobs */}
              {activeJobs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Sedang Berjalan di Server ({activeJobs.length})</span>
                  </h4>

                  {activeJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-white rounded-2xl p-4 border-2 border-sky-300 shadow-sm space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                            {job.fileType === 'video' ? <Video className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                          </div>
                          <div>
                            <h5 className="font-extrabold text-sm text-slate-900 truncate max-w-[280px]">
                              {job.fileName}
                            </h5>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>{job.fileType === 'video' ? 'Video Rekaman' : 'Foto Donasi'}</span>
                              <span>•</span>
                              <span>{job.totalFrames} Frame</span>
                              <span>•</span>
                              <span className="text-sky-600 font-semibold">{job.progress.timeElapsedSec}s berjalan</span>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => cancelJob(job.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors"
                        >
                          Batalkan
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                            <span className="truncate max-w-[280px]">{job.progress.message}</span>
                          </span>
                          <span className="font-mono text-sky-700 font-bold">{job.progress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${Math.max(5, job.progress.percent)}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Frame: {job.progress.currentFrame}/{job.totalFrames}</span>
                        <span className="font-bold text-sky-700">{job.progress.detectedCount} Donatur Terbaca</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed Jobs */}
              {completedJobs.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Selesai &amp; Siap Ditinjau ({completedJobs.length})</span>
                    </h4>

                    <button
                      onClick={() => clearCompleted()}
                      className="text-[11px] font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Bersihkan Selesai
                    </button>
                  </div>

                  {completedJobs.map((job) => (
                    <div
                      key={job.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <Check className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h5 className="font-extrabold text-sm text-slate-900 truncate max-w-[220px]">
                              {job.fileName}
                            </h5>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>99% Akurat</span>
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <strong className="text-slate-800 font-bold">{job.resultItems?.length || 0} Member</strong>
                            <span>•</span>
                            <span>{job.completedAt ? formatIndonesianDateTime(job.completedAt) : 'Selesai'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 self-end sm:self-center">
                        <button
                          onClick={() => deleteJob(job.id)}
                          className="p-2 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus riwayat tugas"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenResult(job)}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-200 transition-all hover:scale-[1.02]"
                        >
                          <span>Buka &amp; Simpan</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Failed/Cancelled Jobs */}
              {jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                    Dibatalkan / Terkendala
                  </h4>
                  {jobs.filter((j) => j.status === 'failed' || j.status === 'cancelled').map((job) => (
                    <div key={job.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-700">{job.fileName}</p>
                        <p className="text-[11px] text-slate-400">{job.progress.message || job.error || 'Dibatalkan'}</p>
                      </div>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Total {jobs.length} sesi tugas background di server.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
