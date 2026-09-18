import React from 'react';
import { ActiveTab } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import {
  LayoutDashboard,
  UploadCloud,
  Trophy,
  History as HistoryIcon,
  FileImage,
  Settings as SettingsIcon,
  Sparkles,
  Users
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isScanning?: boolean;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  count?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isScanning = false,
}) => {
  const { stats, settings } = useDatabase();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload File', icon: UploadCloud, badge: isScanning ? 'OCR Aktif' : undefined },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, count: stats.totalMembers },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'export', label: 'Canvas Report', icon: FileImage },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-sky-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo & Clan Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 p-0.5 shadow-md shadow-sky-200">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <span className="text-xl font-extrabold bg-gradient-to-tr from-sky-600 to-blue-700 bg-clip-text text-transparent">
                  W
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                  {settings.clanName}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200">
                  Tracker
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <span>Credit by</span>
                <span className="text-sky-600 font-semibold">{settings.creatorCredit || 'Shiro Anna'}</span>
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id as ActiveTab)}
                  className={`relative flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-200'
                      : 'text-slate-600 hover:text-sky-600 hover:bg-sky-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="animate-pulse flex h-2 w-2 rounded-full bg-amber-400" />
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.2 rounded-md font-mono ${
                        isActive ? 'bg-sky-600 text-sky-100' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Status Badge */}
          <div className="flex items-center space-x-2">
            <div className="hidden lg:flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs text-slate-600">
              <Users className="w-3.5 h-3.5 text-sky-600" />
              <span>
                <strong className="font-bold text-slate-900">{stats.donatedCount}</strong>/{stats.totalMembers} Donatur
              </span>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-sky-50 border border-sky-100 rounded-lg text-xs font-semibold text-sky-700">
              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
              <span className="hidden sm:inline">2D Anime Engine</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center justify-between overflow-x-auto py-2.5 border-t border-slate-100 scrollbar-none gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isActive ? 'bg-sky-600' : 'bg-slate-200'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
