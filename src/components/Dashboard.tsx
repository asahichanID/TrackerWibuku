import React from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab } from '../types';
import { formatCurrency, formatIndonesianDate, formatIndonesianDateTime } from '../utils/fuzzyMatching';
import {
  Users,
  HeartHandshake,
  Gem,
  Percent,
  UploadCloud,
  Trophy,
  FileImage,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Award,
  Clock,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setActiveTab }) => {
  const { members, scanSessions, stats, settings } = useDatabase();

  const isDatabaseEmpty = members.length === 0 && scanSessions.length === 0;

  // Sort members by nominal descending to get top donors
  const topDonors = [...members]
    .filter((m) => m.nominal > 0)
    .sort((a, b) => b.nominal - a.nominal)
    .slice(0, 5);

  const targetProgress = settings.targetDonation > 0
    ? Math.min(100, Math.round((stats.totalNominal / settings.targetDonation) * 100))
    : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white shadow-lg shadow-sky-100">
        {/* Anime background decoration elements */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-sky-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-sky-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Sistem OCR File Video &amp; Foto • {settings.clanName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Pelacak Donasi Gems Clan Wibu
            </h1>
            <p className="text-sky-100 text-sm sm:text-base leading-relaxed">
              Upload video daftar donasi atau foto screenshot donasi gems/kristal. OCR otomatis membaca nama dan nominal gems tanpa menebak, lalu simpan ke leaderboard dan buat poster Canvas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="cta-upload-file"
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-white text-sky-700 font-bold text-sm shadow-md hover:bg-sky-50 transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <UploadCloud className="w-4 h-4 text-sky-600" />
              <span>Upload File Donasi</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
            {stats.totalMembers > 0 && (
              <button
                id="cta-export-canvas"
                onClick={() => setActiveTab('export')}
                className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-sky-500/30 backdrop-blur-xs text-white border border-white/30 font-semibold text-sm hover:bg-sky-500/50 transition-all"
              >
                <FileImage className="w-4 h-4" />
                <span>Buat Poster Canvas</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 Real Metric Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Total Member Terdeteksi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Member Terdeteksi
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {stats.totalMembers}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {stats.totalMembers > 0 ? 'Member unik' : 'Belum ada data'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>Dari {scanSessions.length} sesi pemindaian file</span>
          </div>
        </div>

        {/* Card 2: Jumlah yang Sudah Donasi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sudah Donasi Gems
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-blue-600 font-mono">
              {stats.donatedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {stats.pendingCount > 0 ? `${stats.pendingCount} belum donasi` : '100% donasi'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
            <span>Donasi &gt; 0 {settings.currencySymbol}</span>
          </div>
        </div>

        {/* Card 3: Total Nominal Donasi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Donasi Gems
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Gem className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {formatCurrency(stats.totalNominal, settings.currencySymbol)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1 text-indigo-500" />
              <span>Target: {formatCurrency(settings.targetDonation, settings.currencySymbol)}</span>
            </span>
            <span className="font-bold text-indigo-600">{targetProgress}%</span>
          </div>
        </div>

        {/* Card 4: Persentase Donasi */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Partisipasi Member
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 font-mono">
              {stats.donationPercentage}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {stats.donatedCount}/{stats.totalMembers || 0} Member
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.donationPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* If Empty State */}
      {isDatabaseEmpty ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-sky-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-500 mb-4 shadow-inner">
            <FolderOpen className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Belum ada riwayat donasi</h3>
          <p className="mt-2 text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
            Database saat ini masih kosong karena belum ada file video atau foto donasi gems yang di-scan. Unggah file daftar donasi clan Anda untuk mulai membaca nama dan nominal gems secara otomatis.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              id="empty-state-upload-btn"
              onClick={() => setActiveTab('upload')}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-md shadow-sky-200 transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Mulai Upload File Sekarang</span>
            </button>
            <button
              id="empty-state-settings-btn"
              onClick={() => setActiveTab('settings')}
              className="inline-flex items-center space-x-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-all"
            >
              <span>Pengaturan &amp; Input Manual</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Content Grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Donors Ranking Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-base">Top 5 Donatur Gems Tertinggi</h3>
              </div>
              <button
                id="view-all-leaderboard-btn"
                onClick={() => setActiveTab('leaderboard')}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <span>Lihat Semua ({stats.totalMembers})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {topDonors.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Belum ada member dengan donasi &gt; 0.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topDonors.map((donor, idx) => {
                  const rank = idx + 1;
                  const isGold = rank === 1;
                  const isSilver = rank === 2;
                  const isBronze = rank === 3;

                  return (
                    <div
                      key={donor.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isGold
                          ? 'bg-amber-50/70 border-amber-200/80'
                          : isSilver
                          ? 'bg-slate-50 border-slate-200'
                          : isBronze
                          ? 'bg-orange-50/70 border-orange-200/80'
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs ${
                            isGold
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : isSilver
                              ? 'bg-slate-300 text-slate-800'
                              : isBronze
                              ? 'bg-orange-400 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                            <span>{donor.name}</span>
                            {isGold && <Award className="w-3.5 h-3.5 text-amber-500" />}
                          </p>
                          <p className="text-xs text-slate-400">
                            Terdeteksi {formatIndonesianDate(donor.lastDetectedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-sky-700">
                          {formatCurrency(donor.nominal, settings.currencySymbol)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Scans Session Summary */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-sky-600" />
                <h3 className="font-bold text-slate-900 text-base">Riwayat Scan Terakhir</h3>
              </div>
              <button
                id="view-all-history-btn"
                onClick={() => setActiveTab('history')}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
              >
                <span>Lihat Riwayat</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {scanSessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Belum ada sesi scan file.
              </div>
            ) : (
              <div className="space-y-3">
                {scanSessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2 hover:bg-sky-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate max-w-[170px]" title={session.fileName || session.videoName}>
                        {session.fileName || session.videoName}
                      </span>
                      <span className="text-slate-500">
                        {formatIndonesianDateTime(session.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{session.membersDetectedCount} Donatur Terbaca</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {formatCurrency(session.totalNominalScanned, settings.currencySymbol)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-[11px] font-semibold">
                        +{session.newMembersCount} Baru
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold">
                        {session.updatedMembersCount} Terupdate
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
