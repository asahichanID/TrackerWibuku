import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab, ScanSession } from '../types';
import { formatCurrency, formatIndonesianDateTime } from '../utils/fuzzyMatching';
import {
  History as HistoryIcon,
  Video,
  FileImage,
  UploadCloud,
  Clock,
  Gem,
  Users,
  Eye,
  Trash2,
  Calendar,
  X,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface HistoryProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const History: React.FC<HistoryProps> = ({ setActiveTab }) => {
  const { scanSessions, settings, deleteScanSession } = useDatabase();
  const [selectedSession, setSelectedSession] = useState<ScanSession | null>(null);

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Yakin ingin menghapus riwayat sesi scan ini? (Data member di database tetap tersimpan)')) {
      deleteScanSession(id);
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <HistoryIcon className="w-6 h-6 text-sky-600" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Riwayat Sesi Pemindaian File
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Daftar seluruh sesi pemindaian file video dan foto OCR yang telah dilakukan, beserta tanggal, jumlah donatur yang terdeteksi, dan total nominal donasi gems.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('upload')}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Scan File Baru</span>
        </button>
      </div>

      {/* Sessions List */}
      {scanSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-sky-200 p-12 text-center shadow-xs">
          <HistoryIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Belum ada riwayat donasi</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Riwayat sesi pemindaian akan tercatat di sini setelah Anda mengunggah file video atau foto donasi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scanSessions.map((session) => {
            const displayName = session.fileName || session.videoName || 'File Donasi';
            const isVideo = session.fileType === 'video' || (!session.fileType && session.videoDurationSec && session.videoDurationSec > 0);

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-sky-300 hover:shadow-md cursor-pointer transition-all space-y-4 relative group"
              >
                {/* Session Top Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isVideo ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {isVideo ? <Video className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 truncate max-w-[170px]" title={displayName}>
                        {displayName}
                      </h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="font-semibold uppercase text-slate-500">{isVideo ? 'Video' : 'Foto'}</span>
                        <span>•</span>
                        <span>{formatIndonesianDateTime(session.timestamp)}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Hapus Catatan Sesi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[11px]">Donatur Terbaca</span>
                    <span className="font-bold font-mono text-slate-800 text-sm mt-0.5 block">
                      {session.membersDetectedCount} Member
                    </span>
                  </div>
                  <div className="p-2.5 bg-sky-50/70 rounded-xl border border-sky-100">
                    <span className="text-sky-700 block text-[11px]">Total Donasi Gems</span>
                    <span className="font-extrabold font-mono text-sky-700 text-sm mt-0.5 block">
                      {formatCurrency(session.totalNominalScanned, settings.currencySymbol)}
                    </span>
                  </div>
                </div>

                {/* Tags Breakdown */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      +{session.newMembersCount} Baru
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                      {session.updatedMembersCount} Update
                    </span>
                  </div>

                  <span className="text-sky-600 font-semibold text-[11px] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Rincian</span>
                    <Eye className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedSession.fileType === 'image' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                }`}>
                  {selectedSession.fileType === 'image' ? <FileImage className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    {selectedSession.fileName || selectedSession.videoName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tipe: {selectedSession.fileType === 'image' ? 'Foto / Screenshot' : 'Video Rekaman'} • Dipindai pada {formatIndonesianDateTime(selectedSession.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block">Total Donatur</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedSession.membersDetectedCount} Member
                </span>
              </div>
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                <span className="text-sky-700 block">Total Donasi Gems</span>
                <span className="font-extrabold font-mono text-sky-800 text-sm block mt-0.5">
                  {formatCurrency(selectedSession.totalNominalScanned, settings.currencySymbol)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-500 block">Frame / Gambar</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {selectedSession.totalFramesProcessed} Diperiksa
                </span>
              </div>
            </div>

            {/* Items List */}
            <div>
              <h4 className="font-bold text-xs text-slate-700 mb-2">
                Daftar Hasil Pembacaan Sesi ({selectedSession.items?.length || 0} Item):
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Nama</th>
                      <th className="p-2.5 text-right">Donasi Gems</th>
                      <th className="p-2.5 text-center">Confidence</th>
                      <th className="p-2.5">Teks OCR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSession.items?.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{item.name}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-sky-700">
                          {formatCurrency(item.nominal, settings.currencySymbol)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {item.confidence}%
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500 truncate max-w-[160px]">
                          {item.rawText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
