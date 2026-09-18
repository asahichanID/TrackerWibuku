import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { BackgroundJob, ScanResultItem } from '../types';
import {
  createBackgroundJob,
  fetchBackgroundJobs,
  fetchBackgroundJob,
  cancelBackgroundJob,
  deleteBackgroundJob,
  clearCompletedBackgroundJobs,
  CreateJobPayload
} from '../utils/backgroundJobApi';

interface BackgroundJobContextType {
  jobs: BackgroundJob[];
  activeJobs: BackgroundJob[];
  completedJobs: BackgroundJob[];
  latestActiveJob: BackgroundJob | null;
  isJobModalOpen: boolean;
  selectedJobForReview: BackgroundJob | null;
  notificationToast: { show: boolean; jobName: string; detectedCount: number; jobId: string } | null;
  setIsJobModalOpen: (open: boolean) => void;
  startJob: (payload: CreateJobPayload) => Promise<{ success: boolean; jobId?: string; error?: string }>;
  loadJobForReview: (job: BackgroundJob) => void;
  clearJobForReview: () => void;
  dismissToast: () => void;
  refreshJobs: () => Promise<void>;
  cancelJob: (id: string) => Promise<boolean>;
  deleteJob: (id: string) => Promise<boolean>;
  clearCompleted: () => Promise<boolean>;
}

const BackgroundJobContext = createContext<BackgroundJobContextType | undefined>(undefined);

export const BackgroundJobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [selectedJobForReview, setSelectedJobForReview] = useState<BackgroundJob | null>(null);
  const [notificationToast, setNotificationToast] = useState<{ show: boolean; jobName: string; detectedCount: number; jobId: string } | null>(null);

  const prevCompletedJobIdsRef = useRef<Set<string>>(new Set());
  const isInitialFetchRef = useRef(true);

  // Filter helpers
  const activeJobs = jobs.filter(
    (j) => j.status === 'processing' || j.status === 'queued' || j.status === 'verifying'
  );
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const latestActiveJob = activeJobs[0] || null;

  // Polling function
  const refreshJobs = useCallback(async () => {
    const res = await fetchBackgroundJobs();
    if (res.success && Array.isArray(res.jobs)) {
      setJobs(res.jobs);

      // Check if any job newly transitioned to completed to notify user!
      const currentCompleted = res.jobs.filter((j) => j.status === 'completed');
      if (!isInitialFetchRef.current) {
        currentCompleted.forEach((j) => {
          if (!prevCompletedJobIdsRef.current.has(j.id)) {
            // Newly finished job!
            setNotificationToast({
              show: true,
              jobName: j.fileName,
              detectedCount: j.resultItems?.length || j.progress.detectedCount || 0,
              jobId: j.id,
            });
          }
        });
      }

      // Update completed ID cache
      prevCompletedJobIdsRef.current = new Set(currentCompleted.map((j) => j.id));
      isInitialFetchRef.current = false;
    }
  }, []);

  // Adaptive polling interval: 1.5s when jobs active, 8s when idle
  useEffect(() => {
    refreshJobs();

    const intervalTime = activeJobs.length > 0 ? 1500 : 8000;
    const interval = setInterval(() => {
      refreshJobs();
    }, intervalTime);

    return () => clearInterval(interval);
  }, [activeJobs.length, refreshJobs]);

  // Start background job
  const startJob = async (payload: CreateJobPayload) => {
    const res = await createBackgroundJob(payload);
    if (res.success && res.job) {
      setJobs((prev) => [res.job!, ...prev.filter((j) => j.id !== res.job!.id)]);
      // Trigger instant refresh
      setTimeout(refreshJobs, 500);
      return { success: true, jobId: res.jobId };
    }
    return { success: false, error: res.error || 'Gagal memulai background task.' };
  };

  // Load a completed job directly into review screen
  const loadJobForReview = (job: BackgroundJob) => {
    setSelectedJobForReview(job);
    setIsJobModalOpen(false);
    setNotificationToast(null);
  };

  const clearJobForReview = () => {
    setSelectedJobForReview(null);
  };

  const dismissToast = () => {
    setNotificationToast(null);
  };

  const cancelJob = async (id: string) => {
    const res = await cancelBackgroundJob(id);
    await refreshJobs();
    return res.success;
  };

  const deleteJob = async (id: string) => {
    const res = await deleteBackgroundJob(id);
    if (selectedJobForReview?.id === id) {
      setSelectedJobForReview(null);
    }
    await refreshJobs();
    return res.success;
  };

  const clearCompleted = async () => {
    const res = await clearCompletedBackgroundJobs();
    await refreshJobs();
    return res.success;
  };

  return (
    <BackgroundJobContext.Provider
      value={{
        jobs,
        activeJobs,
        completedJobs,
        latestActiveJob,
        isJobModalOpen,
        selectedJobForReview,
        notificationToast,
        setIsJobModalOpen,
        startJob,
        loadJobForReview,
        clearJobForReview,
        dismissToast,
        refreshJobs,
        cancelJob,
        deleteJob,
        clearCompleted,
      }}
    >
      {children}
    </BackgroundJobContext.Provider>
  );
};

export const useBackgroundJobs = () => {
  const context = useContext(BackgroundJobContext);
  if (!context) {
    throw new Error('useBackgroundJobs must be used within a BackgroundJobProvider');
  }
  return context;
};
