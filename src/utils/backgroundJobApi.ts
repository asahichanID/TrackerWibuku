import { BackgroundJob, ScanResultItem } from '../types';

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
    const res = await fetch('/api/jobs/create', {
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
    const res = await fetch('/api/jobs');
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
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`);
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
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function deleteBackgroundJob(id: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}

export async function clearCompletedBackgroundJobs(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/jobs/clear-completed', { method: 'POST' });
    const data = await res.json().catch(() => ({ success: false }));
    return data;
  } catch {
    return { success: false, message: 'Network error' };
  }
}
