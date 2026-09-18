/**
 * Real HTML5 Canvas Report Generator for Clan Wibu Donation Tracker
 * Author/Credit: Shiro Anna
 */

import { Member } from '../types';
import { formatCurrency, formatIndonesianDate } from './fuzzyMatching';

export interface CanvasThemeConfig {
  id: string;
  name: string;
  bgColor: string;
  cardBg: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
  rowAltBg: string;
  badgeGold: string;
  badgeSilver: string;
  badgeBronze: string;
}

export const CANVAS_THEMES: Record<string, CanvasThemeConfig> = {
  'anime-sky': {
    id: 'anime-sky',
    name: 'Anime Sky Blue (Default)',
    bgColor: '#F0F7FF',
    cardBg: '#FFFFFF',
    headerGradientStart: '#0284C7', // sky-600
    headerGradientEnd: '#2563EB',   // blue-600
    accentPrimary: '#0284C7',
    accentSecondary: '#38BDF8',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    borderColor: '#BAE6FD',
    rowAltBg: '#F8FAFC',
    badgeGold: '#F59E0B',
    badgeSilver: '#94A3B8',
    badgeBronze: '#D97706',
  },
  'sakura': {
    id: 'sakura',
    name: 'Sakura Blossom',
    bgColor: '#FFF5F7',
    cardBg: '#FFFFFF',
    headerGradientStart: '#E11D48',
    headerGradientEnd: '#DB2777',
    accentPrimary: '#E11D48',
    accentSecondary: '#FB7185',
    textPrimary: '#1E1B4B',
    textSecondary: '#6B7280',
    borderColor: '#FECDD3',
    rowAltBg: '#FFF1F2',
    badgeGold: '#F59E0B',
    badgeSilver: '#94A3B8',
    badgeBronze: '#D97706',
  },
  'night-sky': {
    id: 'night-sky',
    name: 'Midnight Azure',
    bgColor: '#0B132B',
    cardBg: '#1C2541',
    headerGradientStart: '#1E3A8A',
    headerGradientEnd: '#3B82F6',
    accentPrimary: '#38BDF8',
    accentSecondary: '#60A5FA',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    borderColor: '#334155',
    rowAltBg: '#151E34',
    badgeGold: '#FBBF24',
    badgeSilver: '#CBD5E1',
    badgeBronze: '#F97316',
  },
  'clean-white': {
    id: 'clean-white',
    name: 'Clean Modern White',
    bgColor: '#F8FAFC',
    cardBg: '#FFFFFF',
    headerGradientStart: '#1E293B',
    headerGradientEnd: '#334155',
    accentPrimary: '#2563EB',
    accentSecondary: '#64748B',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    borderColor: '#E2E8F0',
    rowAltBg: '#F1F5F9',
    badgeGold: '#D97706',
    badgeSilver: '#64748B',
    badgeBronze: '#B45309',
  },
};

export interface ReportConfig {
  clanName: string;
  reportTitle: string;
  dateStr: string;
  totalMembersCount: number;
  donatedCount: number;
  totalNominal: number;
  currencySymbol: string;
  itemsPerPage?: number;
  themeId?: string;
  creatorCredit?: string;
  customNotes?: string;
}

export interface ReportPageData {
  pageIndex: number;
  totalPages: number;
  members: Member[];
  startRank: number;
}

/**
 * Split members list into paginated chunks for report generation
 */
export function paginateReportMembers(
  members: Member[],
  itemsPerPage = 40
): ReportPageData[] {
  if (members.length === 0) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        members: [],
        startRank: 1,
      },
    ];
  }

  const pages: ReportPageData[] = [];
  const totalPages = Math.ceil(members.length / itemsPerPage);

  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    pages.push({
      pageIndex: i,
      totalPages,
      members: members.slice(startIdx, endIdx),
      startRank: startIdx + 1,
    });
  }

  return pages;
}

/**
 * Render single high-resolution page onto HTML5 Canvas
 */
export function renderCanvasPage(
  canvas: HTMLCanvasElement,
  pageData: ReportPageData,
  config: ReportConfig
): void {
  // 1200 x 1650 for crisp high-resolution poster print & sharing (Retina 2x)
  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 1650;
  
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = CANVAS_THEMES[config.themeId || 'anime-sky'] || CANVAS_THEMES['anime-sky'];

  // 1. Background Fill
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Decorative subtle grid / anime lines
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let x = 40; x < CANVAS_WIDTH; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 40; y < CANVAS_HEIGHT; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 2. Header Container with Gradient
  const headerHeight = 220;
  const headerMargin = 40;
  const headerWidth = CANVAS_WIDTH - headerMargin * 2;

  const headerGrad = ctx.createLinearGradient(headerMargin, headerMargin, headerMargin + headerWidth, headerMargin + headerHeight);
  headerGrad.addColorStop(0, theme.headerGradientStart);
  headerGrad.addColorStop(1, theme.headerGradientEnd);

  // Rounded Header Box
  drawRoundedRect(ctx, headerMargin, headerMargin, headerWidth, headerHeight, 20);
  ctx.fillStyle = headerGrad;
  ctx.fill();

  // Subtle Header Accent Pattern (Anime Geometric Hex/Diamonds)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < 6; i++) {
    const cx = headerMargin + 80 + i * 180;
    const cy = headerMargin + 110;
    drawDiamond(ctx, cx, cy, 35);
  }

  // Header Text: Title & Clan Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const fullTitle = `${config.clanName.toUpperCase()} — ${config.reportTitle.toUpperCase()}`;
  ctx.fillText(fullTitle, CANVAS_WIDTH / 2, headerMargin + 62);

  // Date Ribbon Badge
  const dateText = `📅 ${config.dateStr || formatIndonesianDate()}`;
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  const dateBadgeWidth = ctx.measureText(dateText).width + 36;
  const dateBadgeX = (CANVAS_WIDTH - dateBadgeWidth) / 2;
  const dateBadgeY = headerMargin + 82;

  drawRoundedRect(ctx, dateBadgeX, dateBadgeY, dateBadgeWidth, 32, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(dateText, CANVAS_WIDTH / 2, dateBadgeY + 22);

  // Header Stats Cards (3 cards inside header)
  const statsCardY = headerMargin + 130;
  const statsCardWidth = (headerWidth - 60) / 3;
  const statsCardHeight = 65;

  const percentage = config.totalMembersCount > 0
    ? Math.round((config.donatedCount / config.totalMembersCount) * 100)
    : 0;

  const stats = [
    { label: 'SUDAH DONASI', value: `${config.donatedCount} / ${config.totalMembersCount} Member` },
    { label: 'TOTAL DONASI', value: formatCurrency(config.totalNominal, config.currencySymbol) },
    { label: 'PERSENTASE', value: `${percentage}% Partisipasi` },
  ];

  stats.forEach((s, idx) => {
    const cardX = headerMargin + 20 + idx * (statsCardWidth + 10);
    drawRoundedRect(ctx, cardX, statsCardY, statsCardWidth, statsCardHeight, 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, cardX + statsCardWidth / 2, statsCardY + 24);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 19px "Plus Jakarta Sans", monospace';
    ctx.fillText(s.value, cardX + statsCardWidth / 2, statsCardY + 50);
  });

  // 3. Main Donors Table Section (2 Columns layout)
  const contentTop = headerMargin + headerHeight + 30;
  const contentHeight = CANVAS_HEIGHT - contentTop - 90;
  const colGap = 30;
  const colWidth = (headerWidth - colGap) / 2;

  const membersThisPage = pageData.members;
  const halfLength = Math.ceil(membersThisPage.length / 2);
  const leftColMembers = membersThisPage.slice(0, halfLength);
  const rightColMembers = membersThisPage.slice(halfLength);

  const columns = [
    { x: headerMargin, members: leftColMembers, baseRank: pageData.startRank },
    { x: headerMargin + colWidth + colGap, members: rightColMembers, baseRank: pageData.startRank + halfLength },
  ];

  // Draw Column Tables
  columns.forEach((col) => {
    // Card Container
    drawRoundedRect(ctx, col.x, contentTop, colWidth, contentHeight, 16);
    ctx.fillStyle = theme.cardBg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();

    // Table Header
    const colHeaderH = 44;
    drawRoundedRectTop(ctx, col.x, contentTop, colWidth, colHeaderH, 16);
    ctx.fillStyle = theme.accentPrimary;
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NO', col.x + 18, contentTop + 27);
    ctx.fillText('NAMA MEMBER', col.x + 70, contentTop + 27);
    ctx.textAlign = 'right';
    ctx.fillText('NOMINAL', col.x + colWidth - 20, contentTop + 27);

    // Render Member Rows
    const rowHeight = Math.min(50, Math.floor((contentHeight - colHeaderH - 20) / Math.max(1, col.members.length || 1)));
    const actualRowH = Math.max(38, Math.min(48, rowHeight));

    if (col.members.length === 0) {
      ctx.fillStyle = theme.textSecondary;
      ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('(Belum ada data member)', col.x + colWidth / 2, contentTop + 120);
    } else {
      col.members.forEach((member, mIdx) => {
        const rowY = contentTop + colHeaderH + 8 + mIdx * actualRowH;
        const currentRank = col.baseRank + mIdx;

        // Alternate row background
        if (mIdx % 2 === 1) {
          ctx.fillStyle = theme.rowAltBg;
          ctx.fillRect(col.x + 6, rowY - 4, colWidth - 12, actualRowH - 4);
        }

        // Rank Badge
        let badgeColor = theme.borderColor;
        let badgeTextColor = theme.textSecondary;
        if (currentRank === 1) {
          badgeColor = theme.badgeGold;
          badgeTextColor = '#FFFFFF';
        } else if (currentRank === 2) {
          badgeColor = theme.badgeSilver;
          badgeTextColor = '#FFFFFF';
        } else if (currentRank === 3) {
          badgeColor = theme.badgeBronze;
          badgeTextColor = '#FFFFFF';
        }

        const badgeSize = 24;
        const badgeX = col.x + 16;
        const badgeY = rowY + (actualRowH - badgeSize) / 2 - 6;

        drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 6);
        ctx.fillStyle = badgeColor;
        ctx.fill();

        ctx.fillStyle = badgeTextColor;
        ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${currentRank}`, badgeX + badgeSize / 2, badgeY + 16);

        // Member Name
        ctx.fillStyle = theme.textPrimary;
        ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        
        // Truncate name if too long for column
        const maxNameWidth = colWidth - 210;
        let displayName = member.name;
        while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -2) + '…';
        }
        ctx.fillText(displayName, col.x + 54, rowY + actualRowH / 2 + 1);

        // Nominal
        ctx.textAlign = 'right';
        if (member.nominal > 0) {
          ctx.fillStyle = theme.accentPrimary;
          ctx.font = '700 15px "JetBrains Mono", monospace';
          ctx.fillText(formatCurrency(member.nominal, config.currencySymbol), col.x + colWidth - 20, rowY + actualRowH / 2 + 1);
        } else {
          ctx.fillStyle = theme.textSecondary;
          ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('Belum Donasi', col.x + colWidth - 20, rowY + actualRowH / 2 + 1);
        }
      });
    }
  });

  // 4. Footer & Watermark
  const footerY = CANVAS_HEIGHT - 45;

  ctx.fillStyle = theme.textSecondary;
  ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`✨ Clan Wibu Donation Tracker • Credit by ${config.creatorCredit || 'Shiro Anna'}`, headerMargin + 10, footerY);

  // Page Indicator
  ctx.textAlign = 'right';
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.accentPrimary;
  ctx.fillText(`Halaman ${pageData.pageIndex + 1} dari ${pageData.totalPages}`, CANVAS_WIDTH - headerMargin - 10, footerY);
}

/**
 * Helper to draw rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Helper to draw rounded rectangle only on top corners
 */
function drawRoundedRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Helper to draw decorative diamond shape
 */
function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size / 2);
  ctx.lineTo(cx + size / 2, cy);
  ctx.lineTo(cx, cy + size / 2);
  ctx.lineTo(cx - size / 2, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * Trigger download from HTML5 Canvas element
 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string, format: 'png' | 'jpeg' = 'png') {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, 0.95);
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
