import { BackgroundJob, ScanResultItem } from '../types';

export const BACKEND_STORAGE_KEY = 'CLAN_WIBU_CUSTOM_BACKEND_URL';
export const API_KEY_STORAGE_KEY = 'CLAN_WIBU_CUSTOM_GEMINI_KEY';

export function getEffectiveApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const custom = localStorage.getItem(BACKEND_STORAGE_KEY)?.trim();
  if (custom) {
    return custom.replace(/\/+$/, '');
  }
  return '';
}

export function getCustomApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';
}

function getRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = getCustomApiKey();
  if (key) {
    headers['x-gemini-key'] = key;
  }
  return headers;
}

function buildApiUrl(endpoint: string): string {
  const base = getEffectiveApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${cleanEndpoint}` : cleanEndpoint;
}

export interface CreateJobPayload {
  fileName: string;
  fileType: 'video' | 'image';
  frames: Array<{ image: string; mimeType?: string; timeSec?: number }>;
  minConfidence?: number;
  enableDualPass?: boolean;
  existingMemberNames?: string[];
  previewThumbnail?: string;
}

export async function createBackgroundJob(payload: CreateJobPayload): Promise<{ success: boolean; jobId?: string; job?: BackgroundJob; error?: string }> {
  try {
    const url = buildApiUrl('/api/jobs/create');
    const res = await fetch(url, {
      method: 'POST',
      headers: getRequestHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `Server error ${res.status}` };
    }

    const data = await res.json();
    return { success: data.success, jobId: data.jobId, job: data.job };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error creating background job.' };
  }
}

export async function fetchBackgroundJobs(): Promise<{ success: boolean; jobs: BackgroundJob[]; error?: string }> {
  try {
    const url = buildApiUrl('/api/jobs');
    const res = await fetch(url, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      return { success: false, jobs: [], error: `Server error ${res.status}` };
    }
    const data = await res.json();
    return { success: true, jobs: data.jobs || [] };
  } catch (err: any) {
    return { success: false, jobs: [], error: err?.message || 'Network error fetching jobs.' };
  }
}

export async function fetchBackgroundJob(id: string): Promise<{ success: boolean; job?: BackgroundJob; error?: string }> {
  try {
    const url = buildApiUrl(`/api/jobs/${encodeURIComponent(id)}`);
    const res = await fetch(url, {
      headers: getRequestHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `Job error ${res.status}` };
    }
    const data = await res.json();
    return { success: true, job: data.job };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error fetching job detail.' };
  }
}

export async function cancelBackgroundJob(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const url = buildApiUrl(`/api/jobs/${encodeURIComponent(id)}/cancel`);
    const res = await fetch(url, {
      method: 'POST',
      headers: getRequestHeaders(),
    });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function deleteBackgroundJob(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const url = buildApiUrl(`/api/jobs/${encodeURIComponent(id)}`);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getRequestHeaders(),
    });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function clearCompletedBackgroundJobs(): Promise<{ success: boolean; message?: string }> {
  try {
    const url = buildApiUrl('/api/jobs/clear-completed');
    const res = await fetch(url, {
      method: 'POST',
      headers: getRequestHeaders(),
    });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function testBackendConnection(customUrl?: string, customKey?: string): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    const base = customUrl ? customUrl.replace(/\/+$/, '') : getEffectiveApiBaseUrl();
    const url = base ? `${base}/api/health` : '/api/health';
    const headers: Record<string, string> = {};
    const key = customKey || getCustomApiKey();
    if (key) headers['x-gemini-key'] = key;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      return { ok: false, message: `Server HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { ok: true, message: 'Koneksi ke Backend API Berhasil!', details: data };
  } catch (err: any) {
    return { ok: false, message: `Koneksi gagal: ${err?.message || 'Tidak dapat terhubung'}` };
  }
}
