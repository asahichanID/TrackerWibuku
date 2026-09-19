import { BackgroundJob, ScanResultItem } from '../types';

const PRIMARY_API_BASE = 'https://silver-mule-2906.shiroanna.deno.net';

function buildApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // For background jobs running on local node server or cloud:
  if (cleanEndpoint.startsWith('/api/jobs')) {
    return cleanEndpoint;
  }
  return `${PRIMARY_API_BASE}${cleanEndpoint}`;
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function testBackendConnection(): Promise<{ ok: boolean; message: string; details?: any }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) {
      return { ok: false, message: `Server HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { ok: true, message: 'Server Background Lokal Berjalan Normal!', details: data };
  } catch (err: any) {
    return { ok: false, message: `Koneksi lokal gagal: ${err?.message || 'Tidak dapat terhubung'}` };
  }
}
