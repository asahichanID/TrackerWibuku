/**
 * Clan Wibu Donation Tracker
 * Creator / Credit: Shiro Anna
 */

import React, { useState } from 'react';
import { DatabaseProvider } from './context/DatabaseContext';
import { BackgroundJobProvider, useBackgroundJobs } from './context/BackgroundJobContext';
import { ActiveTab } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { FileUploadOcr } from './components/FileUploadOcr';
import { Leaderboard } from './components/Leaderboard';
import { History } from './components/History';
import { CanvasReport } from './components/CanvasReport';
import { Settings } from './components/Settings';
import { BackgroundJobModal } from './components/BackgroundJobModal';
import { Heart, Sparkles, ShieldCheck, CheckCircle2, ArrowRight, X } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const {
    isJobModalOpen,
    setIsJobModalOpen,
    notificationToast,
    dismissToast,
    loadJobForReview,
    jobs
  } = useBackgroundJobs();

  const handleOpenToastJob = () => {
    if (!notificationToast) return;
    const targetJob = jobs.find((j) => j.id === notificationToast.jobId);
    if (targetJob) {
      loadJobForReview(targetJob);
      setActiveTab('upload');
    }
    dismissToast();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-200 selection:text-sky-900 relative">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'upload' && <FileUploadOcr setActiveTab={setActiveTab} />}
        {activeTab === 'leaderboard' && <Leaderboard setActiveTab={setActiveTab} />}
        {activeTab === 'history' && <History setActiveTab={setActiveTab} />}
        {activeTab === 'export' && <CanvasReport setActiveTab={setActiveTab} />}
        {activeTab === 'settings' && <Settings setActiveTab={setActiveTab} />}
      </main>

      {/* Background Task / Process Modal */}
      <BackgroundJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        setActiveTab={setActiveTab}
      />

      {/* Floating Notification Toast when background job finishes */}
      {notificationToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-emerald-500/50 flex items-center space-x-3 max-w-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-xs text-emerald-400">Proses Background Selesai!</p>
              <p className="text-xs text-slate-200 truncate font-semibold">
                {notificationToast.jobName}
              </p>
              <p className="text-[11px] text-slate-400">
                {notificationToast.detectedCount} donatur terdeteksi &amp; terverifikasi 99%.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={handleOpenToastJob}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1 transition-colors shadow-md shadow-emerald-900"
              >
                <span>Buka Hasil</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={dismissToast}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-900">Clan Wibu Donation Tracker</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-600">
              <span>Crafted with</span>
              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
              <span>Credit by</span>
              <strong className="text-sky-600 font-bold">Shiro Anna</strong>
            </span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>100% Real Database &amp; Background Server Engine</span>
            </span>
            <span>•</span>
            <span>2D Anime Clean UI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <DatabaseProvider>
      <BackgroundJobProvider>
        <AppContent />
      </BackgroundJobProvider>
    </DatabaseProvider>
  );
}

