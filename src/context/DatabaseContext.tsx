/**
 * Real Database Context for Clan Wibu Donation Tracker
 * Persistent client-side storage with zero dummy/mock data.
 * Author/Credit: Shiro Anna
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings, Member, ScanResultItem, ScanSession } from '../types';
import { stringSimilarity } from '../utils/fuzzyMatching';

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
};

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
      return stored ? JSON.parse(stored) : [];
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

  // Save to localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.error('Failed to save members to localStorage', e);
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(scanSessions));
    } catch (e) {
      console.error('Failed to save sessions to localStorage', e);
    }
  }, [scanSessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }, [settings]);

  // Derived real-time statistics
  const totalMembers = members.length;
  const donatedCount = members.filter((m) => m.nominal > 0).length;
  const pendingCount = totalMembers - donatedCount;
  const totalNominal = members.reduce((sum, m) => sum + (m.nominal || 0), 0);
  const donationPercentage = totalMembers > 0 ? Math.round((donatedCount / totalMembers) * 100) : 0;

  /**
   * Save confirmed OCR results to database
   * Updates existing members, inserts new members, and records session history
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
    let totalScannedNominal = 0;

    const updatedMembers = [...members];

    for (const item of validItems) {
      totalScannedNominal += item.nominal;

      // Find existing member by fuzzy match or exact match
      const existingIdx = updatedMembers.findIndex((m) => {
        if (m.name.toLowerCase() === item.name.toLowerCase()) return true;
        return stringSimilarity(m.name, item.name) >= settings.fuzzyMatchThreshold;
      });

      const historyEntry = {
        scanId: sessionMeta.id,
        timestamp: nowIso,
        nominalDetected: item.nominal,
        confidence: item.confidence,
        frameTimeSec: item.frameTimeSec,
        fileName: sessionMeta.fileName,
        videoName: sessionMeta.fileName, // compatibility
        fileType: sessionMeta.fileType,
      };

      if (existingIdx >= 0) {
        // Update existing member
        const existing = updatedMembers[existingIdx];
        const newNominal =
          updateMode === 'accumulate'
            ? existing.nominal + item.nominal
            : item.nominal > 0
            ? item.nominal
            : existing.nominal;

        updatedMembers[existingIdx] = {
          ...existing,
          nominal: newNominal,
          status: newNominal > 0 ? 'donated' : 'pending',
          lastDetectedAt: nowIso,
          donationCount: existing.donationCount + (item.nominal > 0 ? 1 : 0),
          history: [historyEntry, ...existing.history],
        };
        updatedCount++;
      } else {
        // Insert new member
        const newMember: Member = {
          id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: item.name,
          nominal: item.nominal,
          status: item.nominal > 0 ? 'donated' : 'pending',
          firstDetectedAt: nowIso,
          lastDetectedAt: nowIso,
          donationCount: item.nominal > 0 ? 1 : 0,
          history: [historyEntry],
        };
        updatedMembers.push(newMember);
        newCount++;
      }
    }

    // Save full scan session record
    const fullSession: ScanSession = {
      ...sessionMeta,
      membersDetectedCount: validItems.length,
      newMembersCount: newCount,
      updatedMembersCount: updatedCount,
      totalNominalScanned: totalScannedNominal,
      items: validItems,
    };

    setMembers(updatedMembers);
    setScanSessions((prev) => [fullSession, ...prev]);

    return {
      newCount,
      updatedCount,
      totalScannedNominal,
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
