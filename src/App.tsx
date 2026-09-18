/**
 * Clan Wibu Donation Tracker
 * Creator / Credit: Shiro Anna
 */

import React, { useState } from 'react';
import { DatabaseProvider } from './context/DatabaseContext';
import { ActiveTab } from './types';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { FileUploadOcr } from './components/FileUploadOcr';
import { Leaderboard } from './components/Leaderboard';
import { History } from './components/History';
import { CanvasReport } from './components/CanvasReport';
import { Settings } from './components/Settings';
import { Heart, Sparkles, ShieldCheck } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-200 selection:text-sky-900">
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
              <span>100% Real Database &amp; OCR Engine</span>
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
      <AppContent />
    </DatabaseProvider>
  );
}
