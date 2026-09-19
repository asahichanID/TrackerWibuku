export interface MemberScanHistoryItem {
  scanId: string;
  timestamp: string;
  nominalDetected: number;
  confidence: number;
  frameTimeSec?: number;
  fileName?: string;
  videoName?: string; // backwards compatibility
  fileType?: 'video' | 'image';
}

export interface Member {
  id: string;
  name: string;
  nominal: number; // total donation gems/crystals
  status: 'donated' | 'pending';
  lastDetectedAt: string;
  firstDetectedAt: string;
  donationCount: number;
  history: MemberScanHistoryItem[];
  notes?: string;
  rankNumber?: number; // Leaderboard row/rank number (1, 2, ..., 232)
}

export interface ScanResultItem {
  id: string;
  rawText: string;
  name: string;
  nominal: number;
  confidence: number;
  frameTimeSec: number;
  status: 'accepted' | 'rejected' | 'modified' | 'review';
  isNewMember: boolean;
  previousNominal?: number;
  thumbnailUrl?: string;
  notes?: string;
  engine?: 'gemini_vision' | 'ocr';
  rowPosition?: number;
  rankNumber?: number; // Leaderboard row/rank number (1, 2, ..., 232)
}

export interface ScanSession {
  id: string;
  timestamp: string;
  fileName: string;
  videoName?: string; // backwards compatibility
  fileType: 'video' | 'image';
  videoDurationSec?: number;
  totalFramesProcessed: number;
  rawDetectionsCount: number;
  membersDetectedCount: number;
  newMembersCount: number;
  updatedMembersCount: number;
  totalNominalScanned: number;
  items: ScanResultItem[];
  sessionPreviewUrl?: string;
  engineUsed?: 'gemini_vision' | 'ocr';
}

export interface AppSettings {
  clanName: string;
  reportTitle: string;
  creatorCredit: string;
  ocrFps: number; // frames per second sample rate (e.g. 1 - 4)
  minConfidence: number; // threshold 0-100
  contrastEnhance: boolean;
  binarizeThreshold: number; // 0-255
  fuzzyMatchThreshold: number; // 0.0 - 1.0 (e.g. 0.82)
  targetDonation: number; // e.g. 5000000
  currencySymbol: string; // e.g. "Rp"
  canvasTheme: 'anime-sky' | 'sakura' | 'night-sky' | 'clean-white';
  customApiUrl?: string; // e.g. https://your-deno-app.deno.dev or Deno Playground URL
}

export type JobStatus = 'queued' | 'processing' | 'verifying' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJobProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
  detectedCount: number;
  passNumber?: 1 | 2;
  timeElapsedSec: number;
}

export interface BackgroundJob {
  id: string;
  fileName: string;
  fileType: 'video' | 'image';
  status: JobStatus;
  progress: BackgroundJobProgress;
  totalFrames: number;
  options: {
    minConfidence?: number;
    enableDualPass?: boolean;
    existingMemberNames?: string[];
  };
  resultItems: ScanResultItem[];
  previewThumbnail?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type ActiveTab = 'dashboard' | 'upload' | 'leaderboard' | 'history' | 'export' | 'settings';
