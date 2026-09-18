import React, { useMemo, useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { ActiveTab, Member } from '../types';
import { formatCurrency, formatIndonesianDate, formatIndonesianDateTime } from '../utils/fuzzyMatching';
import {
  Trophy,
  Search,
  Filter,
  ArrowUpDown,
  FileImage,
  UploadCloud,
  Award,
  Crown,
  Medal,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Columns,
  List,
  Edit2,
  Trash2,
  X,
  Check,
  Calendar,
  Layers
} from 'lucide-react';

interface LeaderboardProps {
  setActiveTab: (tab: ActiveTab) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ setActiveTab }) => {
  const { members, stats, settings, updateMember, deleteMember } = useDatabase();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'donated' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'nominal_desc' | 'nominal_asc' | 'name_asc' | 'name_desc' | 'latest'>('nominal_desc');

  // Layout presentation mode
  const [viewMode, setViewMode] = useState<'columns_paged' | 'columns_scroll'>('columns_paged');
  const [activeColumnPage, setActiveColumnPage] = useState<number>(0);

  // Selected Member Details Modal
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberNominal, setEditMemberNominal] = useState(0);

  // Maximum items per column (strict requirement: max 100 names vertical per column)
  const ITEMS_PER_COLUMN = 100;

  // Filter and sort members
  const processedMembers = useMemo(() => {
    let result = [...members];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter === 'donated') {
      result = result.filter((m) => m.nominal > 0);
    } else if (statusFilter === 'pending') {
      result = result.filter((m) => m.nominal === 0);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'nominal_desc') {
        if (b.nominal !== a.nominal) return b.nominal - a.nominal;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'nominal_asc') {
        if (a.nominal !== b.nominal) return a.nominal - b.nominal;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'latest') {
        return new Date(b.lastDetectedAt).getTime() - new Date(a.lastDetectedAt).getTime();
      }
      return 0;
    });

    return result;
  }, [members, searchQuery, statusFilter, sortBy]);

  // Split processed members into columns of max 100 members each
  const columns = useMemo(() => {
    const cols: Array<{
      columnIndex: number;
      startRank: number;
      endRank: number;
      members: Member[];
    }> = [];

    const total = processedMembers.length;
    if (total === 0) return cols;

    for (let i = 0; i < total; i += ITEMS_PER_COLUMN) {
      const chunk = processedMembers.slice(i, i + ITEMS_PER_COLUMN);
      cols.push({
        columnIndex: Math.floor(i / ITEMS_PER_COLUMN),
        startRank: i + 1,
        endRank: Math.min(total, i + ITEMS_PER_COLUMN),
        members: chunk,
      });
    }

    return cols;
  }, [processedMembers]);

  // Active page clamp
  const safeActiveColumnPage = Math.min(activeColumnPage, Math.max(0, columns.length - 1));

  // Top 3 Podium Donors
  const top3 = useMemo(() => {
    return [...members]
      .filter((m) => m.nominal > 0)
      .sort((a, b) => b.nominal - a.nominal)
      .slice(0, 3);
  }, [members]);

  // Open Edit Modal
  const handleOpenEdit = (m: Member) => {
    setSelectedMember(m);
    setEditMemberName(m.name);
    setEditMemberNominal(m.nominal);
    setIsEditingMember(true);
  };

  const handleSaveMemberEdit = () => {
    if (!selectedMember) return;
    updateMember(selectedMember.id, {
      name: editMemberName.trim() || selectedMember.name,
      nominal: Math.max(0, editMemberNominal),
    });
    setSelectedMember((prev) =>
      prev
        ? {
            ...prev,
            name: editMemberName.trim() || prev.name,
            nominal: Math.max(0, editMemberNominal),
          }
        : null
    );
    setIsEditingMember(false);
  };

  const handleDeleteCurrentMember = () => {
    if (!selectedMember) return;
    if (confirm(`Yakin ingin menghapus member "${selectedMember.name}" dari database?`)) {
      deleteMember(selectedMember.id);
      setSelectedMember(null);
      setIsEditingMember(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Leaderboard Donasi {settings.clanName}
            </h2>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Peringkat donatur nyata berdasarkan data yang terbaca dari video scan. Menampung hingga 1000+ member dengan pembagian 100 baris per kolom.
          </p>
        </div>

        {members.length > 0 && (
          <button
            id="export-canvas-from-leaderboard-btn"
            onClick={() => setActiveTab('export')}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-200 transition-all"
          >
            <FileImage className="w-4 h-4" />
            <span>Generate Canvas Poster</span>
          </button>
        )}
      </div>

      {/* Top 3 Champion Podium (if at least 1 donor has donated) */}
      {top3.length > 0 && searchQuery === '' && statusFilter !== 'pending' && (
        <div className="bg-gradient-to-b from-sky-50/80 to-white rounded-2xl p-6 border border-sky-100 shadow-xs">
          <div className="text-center mb-6">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold border border-amber-200">
              <Crown className="w-3.5 h-3.5 text-amber-600" />
              <span>TOP DONATUR TERBESAR</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto items-end">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <div
                onClick={() => setSelectedMember(top3[1])}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-center order-2 md:order-1 hover:border-slate-400 cursor-pointer transition-all transform hover:-translate-y-1"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-700 font-extrabold text-base mb-2">
                  <Medal className="w-6 h-6 text-slate-400" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                  JUARA 2
                </span>
                <h4 className="font-bold text-base text-slate-900 mt-2 truncate">{top3[1].name}</h4>
                <p className="font-mono font-extrabold text-sm text-sky-700 mt-1">
                  {formatCurrency(top3[1].nominal, settings.currencySymbol)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatIndonesianDate(top3[1].lastDetectedAt)}
                </p>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top3[0] && (
              <div
                onClick={() => setSelectedMember(top3[0])}
                className="bg-gradient-to-b from-amber-50 to-white rounded-2xl p-6 border-2 border-amber-300 shadow-md text-center order-1 md:order-2 hover:border-amber-400 cursor-pointer transition-all transform hover:-translate-y-1 relative"
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white p-1 rounded-full shadow-sm">
                  <Crown className="w-4 h-4" />
                </div>
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-amber-700 font-extrabold text-xl mb-2 mt-2">
                  <Award className="w-8 h-8 text-amber-500" />
                </div>
                <span className="px-3 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black tracking-wider">
                  ★ JUARA 1 ★
                </span>
                <h4 className="font-extrabold text-lg text-slate-900 mt-2 truncate">{top3[0].name}</h4>
                <p className="font-mono font-black text-lg text-amber-600 mt-1">
                  {formatCurrency(top3[0].nominal, settings.currencySymbol)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatIndonesianDate(top3[0].lastDetectedAt)}
                </p>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <div
                onClick={() => setSelectedMember(top3[2])}
                className="bg-white rounded-2xl p-5 border border-orange-200 shadow-xs text-center order-3 hover:border-orange-300 cursor-pointer transition-all transform hover:-translate-y-1"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-orange-50 border-2 border-orange-300 flex items-center justify-center text-orange-700 font-extrabold text-base mb-2">
                  <Medal className="w-6 h-6 text-orange-400" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold">
                  JUARA 3
                </span>
                <h4 className="font-bold text-base text-slate-900 mt-2 truncate">{top3[2].name}</h4>
                <p className="font-mono font-extrabold text-sm text-sky-700 mt-1">
                  {formatCurrency(top3[2].nominal, settings.currencySymbol)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatIndonesianDate(top3[2].lastDetectedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter, Search & Layout Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:outline-sky-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Semua ({members.length})
              </button>
              <button
                onClick={() => setStatusFilter('donated')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'donated' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Donasi ({stats.donatedCount})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  statusFilter === 'pending' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-600'
                }`}
              >
                Belum ({stats.pendingCount})
              </button>
            </div>

            {/* Sort Select */}
            <div className="flex items-center space-x-1.5 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none focus:outline-none text-xs cursor-pointer font-semibold text-slate-800"
              >
                <option value="nominal_desc">Nominal Tertinggi</option>
                <option value="nominal_asc">Nominal Terendah</option>
                <option value="name_asc">Nama A → Z</option>
                <option value="name_desc">Nama Z → A</option>
                <option value="latest">Terbaru Terdeteksi</option>
              </select>
            </div>

            {/* Layout Toggle */}
            <div className="hidden sm:flex items-center p-1 bg-slate-100 rounded-xl text-xs">
              <button
                title="Paginasi Kolom (100 per halaman)"
                onClick={() => setViewMode('columns_paged')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'columns_paged' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                title="Kolom Berjajar Multi-Section"
                onClick={() => setViewMode('columns_scroll')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'columns_scroll' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Column Navigation Tabs (when more than 100 members exist) */}
        {columns.length > 1 && viewMode === 'columns_paged' && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none py-1">
              {columns.map((col, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveColumnPage(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    safeActiveColumnPage === idx
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Kolom #{idx + 1} (Peringkat {col.startRank}–{col.endRank})
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1 shrink-0 ml-2">
              <button
                disabled={safeActiveColumnPage === 0}
                onClick={() => setActiveColumnPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-700 px-1">
                {safeActiveColumnPage + 1} / {columns.length}
              </span>
              <button
                disabled={safeActiveColumnPage >= columns.length - 1}
                onClick={() => setActiveColumnPage((p) => Math.min(columns.length - 1, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Leaderboard List / Columns Display */}
      {members.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-sky-200 p-12 text-center shadow-xs">
          <Trophy className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Belum ada riwayat donasi</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Data leaderboard akan terisi secara otomatis setelah Anda mengunggah file video atau foto daftar donasi di menu Upload File.
          </p>
          <button
            onClick={() => setActiveTab('upload')}
            className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-200 hover:bg-sky-700 transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File Sekarang</span>
          </button>
        </div>
      ) : processedMembers.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-500 border border-slate-200 text-sm">
          Tidak ada member yang cocok dengan filter atau pencarian &quot;{searchQuery}&quot;.
        </div>
      ) : viewMode === 'columns_paged' ? (
        /* Paged Column View (Max 100 rows per page) */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-sky-50/70 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-sky-900">
            <span>
              Menampilkan Kolom #{safeActiveColumnPage + 1} (Peringkat {columns[safeActiveColumnPage]?.startRank} sampai {columns[safeActiveColumnPage]?.endRank} dari {processedMembers.length} total)
            </span>
            <span className="font-mono text-sky-700">Maksimal 100 baris/kolom</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-3.5 w-16 text-center">RANK</th>
                  <th className="p-3.5">NAMA MEMBER</th>
                  <th className="p-3.5 text-right">TOTAL NOMINAL</th>
                  <th className="p-3.5 text-center">STATUS</th>
                  <th className="p-3.5">TERAKHIR DETEKSI</th>
                  <th className="p-3.5 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {columns[safeActiveColumnPage]?.members.map((member, idx) => {
                  const rank = (columns[safeActiveColumnPage]?.startRank || 1) + idx;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`cursor-pointer transition-colors ${
                        isTop1
                          ? 'bg-amber-50/40 hover:bg-amber-50'
                          : isTop2
                          ? 'bg-slate-50/70 hover:bg-slate-100/70'
                          : isTop3
                          ? 'bg-orange-50/30 hover:bg-orange-50/60'
                          : 'hover:bg-sky-50/40'
                      }`}
                    >
                      {/* Rank */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-extrabold text-xs ${
                            isTop1
                              ? 'bg-amber-400 text-amber-950 shadow-xs'
                              : isTop2
                              ? 'bg-slate-300 text-slate-800'
                              : isTop3
                              ? 'bg-orange-400 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rank}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{member.name}</span>
                          {isTop1 && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                      </td>

                      {/* Nominal */}
                      <td className="p-3.5 text-right font-mono font-extrabold">
                        {member.nominal > 0 ? (
                          <span className="text-sky-700 text-sm">
                            {formatCurrency(member.nominal, settings.currencySymbol)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">Belum Donasi</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        {member.nominal > 0 ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Sudah Donasi
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold text-[10px]">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Last detected */}
                      <td className="p-3.5 text-slate-500 text-xs">
                        {formatIndonesianDateTime(member.lastDetectedAt)}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEdit(member)}
                          className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                          title="Edit Member"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Multi-Column Horizontal Section View (For 1000+ members side-by-side columns) */
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin">
          {columns.map((col, cIdx) => (
            <div
              key={cIdx}
              className="min-w-[340px] max-w-[380px] bg-white rounded-2xl border border-slate-200 shadow-xs flex-1 flex flex-col"
            >
              {/* Column Header */}
              <div className="p-3 bg-sky-600 text-white rounded-t-2xl flex items-center justify-between font-bold text-xs">
                <span>Kolom #{cIdx + 1}</span>
                <span className="bg-sky-700 px-2 py-0.5 rounded font-mono">
                  Rank {col.startRank}–{col.endRank}
                </span>
              </div>

              {/* Column List (Max 100 items vertical) */}
              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[700px]">
                {col.members.map((member, mIdx) => {
                  const rank = col.startRank + mIdx;
                  return (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className="p-2.5 hover:bg-sky-50/50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-600 shrink-0">
                          {rank}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{member.name}</span>
                      </div>
                      <span className="font-mono font-bold text-sky-700 shrink-0 ml-2">
                        {member.nominal > 0 ? formatCurrency(member.nominal, settings.currencySymbol) : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Member Detail / History Drawer Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-scale-in space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  {selectedMember.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{selectedMember.name}</h3>
                  <p className="text-xs text-slate-400">ID: {selectedMember.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setIsEditingMember(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Mode vs View Mode */}
            {isEditingMember ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Member</label>
                  <input
                    type="text"
                    value={editMemberName}
                    onChange={(e) => setEditMemberName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:outline-sky-500 text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Total Nominal Donasi</label>
                  <input
                    type="number"
                    value={editMemberNominal}
                    onChange={(e) => setEditMemberNominal(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 focus:outline-sky-500 text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={handleDeleteCurrentMember}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Member</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditingMember(false)}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveMemberEdit}
                      className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl">
                    <span className="text-slate-500 block">Total Donasi</span>
                    <span className="font-mono font-extrabold text-base text-sky-700 mt-0.5 block">
                      {formatCurrency(selectedMember.nominal, settings.currencySymbol)}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-slate-500 block">Frekuensi Donasi</span>
                    <span className="font-mono font-bold text-base text-slate-800 mt-0.5 block">
                      {selectedMember.history?.length || 1}x Scan
                    </span>
                  </div>
                </div>

                {/* Scan History Log */}
                <div>
                  <h4 className="font-bold text-xs text-slate-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-600" />
                    <span>Riwayat Pemindaian Member</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedMember.history && selectedMember.history.length > 0 ? (
                      selectedMember.history.map((h, hIdx) => (
                        <div
                          key={hIdx}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium text-slate-800">
                              {h.fileName || h.videoName || 'Sesi Pemindaian File'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatIndonesianDateTime(h.timestamp)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-sky-700">
                              {formatCurrency(h.nominalDetected, settings.currencySymbol)}
                            </span>
                            <span className="block text-[10px] text-emerald-600">
                              Conf: {h.confidence}%
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Tidak ada log pemindaian.</p>
                    )}
                  </div>
                </div>

                {/* Footer Modal Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenEdit(selectedMember)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Data</span>
                  </button>

                  <button
                    onClick={() => setSelectedMember(null)}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
