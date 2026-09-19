/**
 * Real Database Context for Clan Wibu Donation Tracker
 * Persistent client-side storage with zero dummy/mock data.
 * Author/Credit: Shiro Anna
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings, Member, ScanResultItem, ScanSession } from '../types';
import { isSameClanMember, stringSimilarity } from '../utils/fuzzyMatching';

interface DatabaseContextType {
  members: Member[];
  scanSessions: ScanSession[];
  settings: AppSettings;
  stats: {
    totalMembers: number;
    donatedCount: number;
    pendingCount: number;
    totalNominal: number;
    donationPercentage: number;
  };
  saveScanResults: (
    sessionMetadata: Omit<ScanSession, 'items' | 'membersDetectedCount' | 'newMembersCount' | 'updatedMembersCount' | 'totalNominalScanned'>,
    items: ScanResultItem[],
    updateMode: 'update_latest' | 'accumulate'
  ) => { newCount: number; updatedCount: number; totalScannedNominal: number };
  addManualMember: (name: string, nominal: number, notes?: string) => boolean;
  updateMember: (id: string, updates: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  deleteScanSession: (id: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  clearDatabase: () => void;
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => { success: boolean; message: string };
}

const STORAGE_KEYS = {
  MEMBERS: 'clan_wibu_members_v1',
  SESSIONS: 'clan_wibu_sessions_v1',
  SETTINGS: 'clan_wibu_settings_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  clanName: 'CLAN WIBU',
  reportTitle: 'LAPORAN DONASI GEMS',
  creatorCredit: 'Shiro Anna',
  ocrFps: 2,
  minConfidence: 50,
  contrastEnhance: true,
  binarizeThreshold: 135,
  fuzzyMatchThreshold: 0.85,
  targetDonation: 50000,
  currencySymbol: '💎',
  canvasTheme: 'anime-sky',
  customApiUrl: '',
};

/**
 * Strips heavy Base64 image data URLs from scan session items before serializing to localStorage.
 * Prevents QuotaExceededError (5MB browser limit) while maintaining full donation records.
 */
function sanitizeSessionsForStorage(sessions: ScanSession[]): ScanSession[] {
  // Cap at 50 most recent sessions in localStorage
  const recent = sessions.slice(0, 50);
  return recent.map((session) => ({
    ...session,
    sessionPreviewUrl: undefined, // remove full-res preview base64
    items: (session.items || []).map((item) => {
      // Keep pure metadata, strip bulky base64 data URLs
      const cleanItem: ScanResultItem = {
        id: item.id,
        name: item.name,
        nominal: item.nominal,
        confidence: item.confidence,
        frameTimeSec: item.frameTimeSec,
        status: item.status,
        isNewMember: item.isNewMember,
        rawText: item.rawText,
        notes: item.notes,
        engine: item.engine,
        rowPosition: item.rowPosition,
        rankNumber: item.rankNumber,
        previousNominal: item.previousNominal,
        thumbnailUrl: undefined, // strip large base64 image
      };
      return cleanItem;
    }),
  }));
}

/**
 * Safe localStorage setter with auto-pruning fallback if quota is exceeded
 */
function safeSetLocalStorage(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    console.warn(`[Database] localStorage write failed for key "${key}":`, err?.message);
    if (
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'))
    ) {
      try {
        if (Array.isArray(value)) {
          // If it's an array (like sessions or members), aggressively prune to latest 10 items
          const pruned = value.slice(0, 10);
          localStorage.setItem(key, JSON.stringify(pruned));
          console.info(`[Database] Auto-pruned "${key}" to 10 entries to satisfy localStorage quota.`);
        }
      } catch (pruneErr) {
        console.error(`[Database] Pruning fallback also failed for "${key}":`, pruneErr);
      }
    }
  }
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Real database starts 100% EMPTY by default
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load members from localStorage', e);
      return [];
    }
  });

  const [scanSessions, setScanSessions] = useState<ScanSession[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return sanitizeSessionsForStorage(parsed);
        }
      }
      return [];
    } catch (e) {
      console.error('Failed to load sessions from localStorage', e);
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // Save to localStorage safely when state changes
  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEYS.MEMBERS, members);
  }, [members]);

  useEffect(() => {
    const sanitized = sanitizeSessionsForStorage(scanSessions);
    safeSetLocalStorage(STORAGE_KEYS.SESSIONS, sanitized);
  }, [scanSessions]);

  useEffect(() => {
    safeSetLocalStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Derived real-time statistics
  const totalMembers = members.length;
  const donatedCount = members.filter((m) => m.status === 'donated' || m.nominal > 0).length;
  const pendingCount = members.filter((m) => m.status === 'pending' && (!m.nominal || m.nominal === 0)).length;
  const totalNominal = members.reduce((sum, m) => sum + (m.nominal || 0), 0);
  const donationPercentage = totalMembers > 0 ? Math.round((donatedCount / totalMembers) * 100) : 0;

  /**
   * Save confirmed OCR results to database
   * Updates existing members, inserts new members, and records session history
   * MANDATE: Do NOT record donation numbers to database, only member names who HAVE DONATED (status: 'donated')
   */
  const saveScanResults = (
    sessionMeta: Omit<ScanSession, 'items' | 'membersDetectedCount' | 'newMembersCount' | 'updatedMembersCount' | 'totalNominalScanned'>,
    items: ScanResultItem[],
    updateMode: 'update_latest' | 'accumulate' = 'update_latest'
  ) => {
    const validItems = items.filter((item) => item.status !== 'rejected');
    const nowIso = new Date().toISOString();

    let newCount = 0;
    let updatedCount = 0;

    const updatedMembers = [...members];

    for (const item of validItems) {
      const itemRank = item.rankNumber || item.rowPosition;

      // Find existing member by rankNumber first if both have it, or fallback to name matching
      let existingIdx = -1;
      if (itemRank) {
        existingIdx = updatedMembers.findIndex((m) => m.rankNumber === itemRank);
      }
      if (existingIdx === -1) {
        existingIdx = updatedMembers.findIndex((m) => isSameClanMember(m.name, item.name));
      }

      const historyEntry = {
        scanId: sessionMeta.id,
        timestamp: nowIso,
        nominalDetected: 0, // Mandate: jangan catat angka donasi, cuma nama yang SUDAH DONASI
        confidence: item.confidence,
        frameTimeSec: item.frameTimeSec,
        fileName: sessionMeta.fileName,
        videoName: sessionMeta.fileName, // compatibility
        fileType: sessionMeta.fileType,
      };

      if (existingIdx >= 0) {
        // Update existing member status to donated
        const existing = updatedMembers[existingIdx];

        updatedMembers[existingIdx] = {
          ...existing,
          name: item.name.length >= existing.name.length ? item.name : existing.name,
          nominal: 0, // Mandate: tidak mencatat angka donasi ke database
          status: 'donated', // Cuma nama yang SUDAH DONASI
          lastDetectedAt: nowIso,
          donationCount: existing.donationCount + 1,
          rankNumber: itemRank || existing.rankNumber,
          history: [historyEntry, ...existing.history],
          notes: itemRank ? `No. ${itemRank} • Sudah Donasi` : 'Sudah Donasi',
        };
        updatedCount++;
      } else {
        // Insert new member with status 'donated'
        const newMember: Member = {
          id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: item.name,
          nominal: 0, // Mandate: jangan catat angka donasi ke database
          status: 'donated', // Cuma nama yang SUDAH DONASI
          firstDetectedAt: nowIso,
          lastDetectedAt: nowIso,
          donationCount: 1,
          rankNumber: itemRank,
          history: [historyEntry],
          notes: itemRank ? `No. ${itemRank} • Sudah Donasi` : 'Sudah Donasi',
        };
        updatedMembers.push(newMember);
        newCount++;
      }
    }

    // Keep members sorted by official rank number (1, 2, ..., 232)
    updatedMembers.sort((a, b) => {
      if (a.rankNumber && b.rankNumber) return a.rankNumber - b.rankNumber;
      if (a.rankNumber) return -1;
      if (b.rankNumber) return 1;
      return 0;
    });

    // Save full scan session record
    const fullSession: ScanSession = {
      ...sessionMeta,
      membersDetectedCount: validItems.length,
      newMembersCount: newCount,
      updatedMembersCount: updatedCount,
      totalNominalScanned: 0, // Angka donasi tidak dicatat
      items: validItems.map((item) => ({
        ...item,
        nominal: 0, // Angka donasi tidak dicatat ke database
        notes: 'Sudah Donasi',
      })),
    };

    setMembers(updatedMembers);
    setScanSessions((prev) => [fullSession, ...prev]);

    return {
      newCount,
      updatedCount,
      totalScannedNominal: 0,
    };
  };

  /**
   * Add manual member
   */
  const addManualMember = (name: string, nominal: number, notes?: string): boolean => {
    const cleanName = name.trim();
    if (!cleanName) return false;

    const existingIdx = members.findIndex(
      (m) => m.name.toLowerCase() === cleanName.toLowerCase()
    );

    const nowIso = new Date().toISOString();

    if (existingIdx >= 0) {
      // Update existing
      const updated = [...members];
      updated[existingIdx] = {
        ...updated[existingIdx],
        nominal: nominal > 0 ? nominal : updated[existingIdx].nominal,
        status: (nominal > 0 ? nominal : updated[existingIdx].nominal) > 0 ? 'donated' : 'pending',
        lastDetectedAt: nowIso,
        notes: notes || updated[existingIdx].notes,
      };
      setMembers(updated);
    } else {
      // Insert new
      const newMember: Member = {
        id: `member-manual-${Date.now()}`,
        name: cleanName,
        nominal: Math.max(0, nominal),
        status: nominal > 0 ? 'donated' : 'pending',
        firstDetectedAt: nowIso,
        lastDetectedAt: nowIso,
        donationCount: nominal > 0 ? 1 : 0,
        history: [
          {
            scanId: 'manual-entry',
            timestamp: nowIso,
            nominalDetected: nominal,
            confidence: 100,
          },
        ],
        notes,
      };
      setMembers((prev) => [...prev, newMember]);
    }
    return true;
  };

  /**
   * Update member details
   */
  const updateMember = (id: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        updated.status = updated.nominal > 0 ? 'donated' : 'pending';
        return updated;
      })
    );
  };

  /**
   * Delete member
   */
  const deleteMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  /**
   * Delete single scan session
   */
  const deleteScanSession = (id: string) => {
    setScanSessions((prev) => prev.filter((s) => s.id !== id));
  };

  /**
   * Update application settings
   */
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  /**
   * Clear all database data
   */
  const clearDatabase = () => {
    setMembers([]);
    setScanSessions([]);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
  };

  /**
   * Export database as JSON backup
   */
  const exportDatabaseJson = (): string => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      creatorCredit: settings.creatorCredit || 'Shiro Anna',
      clanName: settings.clanName,
      members,
      scanSessions,
      settings,
    };
    return JSON.stringify(backup, null, 2);
  };

  /**
   * Import database from JSON backup
   */
  const importDatabaseJson = (jsonStr: string): { success: boolean; message: string } => {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data.members)) {
        return { success: false, message: 'Format file JSON tidak valid (data members tidak ditemukan).' };
      }

      setMembers(data.members);
      if (Array.isArray(data.scanSessions)) {
        setScanSessions(data.scanSessions);
      }
      if (data.settings && typeof data.settings === 'object') {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
      return { success: true, message: `Berhasil mengimpor ${data.members.length} member dari backup.` };
    } catch (err: any) {
      return { success: false, message: `Gagal membaca file: ${err?.message || 'Error tidak diketahui'}` };
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        members,
        scanSessions,
        settings,
        stats: {
          totalMembers,
          donatedCount,
          pendingCount,
          totalNominal,
          donationPercentage,
        },
        saveScanResults,
        addManualMember,
        updateMember,
        deleteMember,
        deleteScanSession,
        updateSettings,
        clearDatabase,
        exportDatabaseJson,
        importDatabaseJson,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
