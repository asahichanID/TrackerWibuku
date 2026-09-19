/**
 * High-Resolution HTML5 Canvas Report Generator for Clan Wibu Donation Tracker
 * Supports 100 members in Left Chapter (Bab Kiri) + 100 members in Right Chapter (Bab Kanan)
 * Total 200 members per sheet with automatic multi-sheet continuation for remainder.
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
  badgeTop10: string;
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
    badgeTop10: '#0EA5E9',
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
    badgeTop10: '#F43F5E',
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
    badgeTop10: '#38BDF8',
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
    badgeTop10: '#2563EB',
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
  itemsPerColumn?: number;
  themeId?: string;
  creatorCredit?: string;
  customNotes?: string;
}

export interface ReportPageData {
  pageIndex: number;
  totalPages: number;
  members: Member[];
  startRank: number;
  leftMembers: Member[];
  rightMembers: Member[];
  leftStartRank: number;
  leftEndRank: number;
  rightStartRank: number;
  rightEndRank: number;
}

/**
 * Split members list into paginated chunks for report generation.
 * Default: 200 items per page (100 in Left Chapter / Bab Kiri, 100 in Right Chapter / Bab Kanan).
 * Any remainder flows cleanly to the next page(s).
 */
export function paginateReportMembers(
  members: Member[],
  itemsPerPage = 200,
  itemsPerColumn = 100
): ReportPageData[] {
  if (members.length === 0) {
    return [
      {
        pageIndex: 0,
        totalPages: 1,
        members: [],
        startRank: 1,
        leftMembers: [],
        rightMembers: [],
        leftStartRank: 1,
        leftEndRank: 0,
        rightStartRank: 1,
        rightEndRank: 0,
      },
    ];
  }

  const effectivePerPage = Math.max(10, Math.min(200, itemsPerPage));
  const effectivePerCol = Math.max(5, Math.min(100, itemsPerColumn || Math.ceil(effectivePerPage / 2)));
  
  const pages: ReportPageData[] = [];
  const totalPages = Math.ceil(members.length / effectivePerPage);

  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * effectivePerPage;
    const endIdx = Math.min(members.length, startIdx + effectivePerPage);
    const pageMembers = members.slice(startIdx, endIdx);
    
    // Split into Left column (up to effectivePerCol, max 100) and Right column (up to effectivePerCol, max 100)
    const leftMembers = pageMembers.slice(0, effectivePerCol);
    const rightMembers = pageMembers.slice(effectivePerCol, effectivePerPage);

    const startRank = startIdx + 1;
    const leftStartRank = startRank;
    const leftEndRank = leftMembers.length > 0 ? leftStartRank + leftMembers.length - 1 : leftStartRank;
    const rightStartRank = leftStartRank + leftMembers.length;
    const rightEndRank = rightMembers.length > 0 ? rightStartRank + rightMembers.length - 1 : rightStartRank;

    pages.push({
      pageIndex: i,
      totalPages,
      members: pageMembers,
      startRank,
      leftMembers,
      rightMembers,
      leftStartRank,
      leftEndRank,
      rightStartRank,
      rightEndRank,
    });
  }

  return pages;
}

/**
 * Render single high-resolution page onto HTML5 Canvas with 100 people in Left Chapter + 100 in Right Chapter
 */
export function renderCanvasPage(
  canvas: HTMLCanvasElement,
  pageData: ReportPageData,
  config: ReportConfig
): void {
  // Canvas Resolution: 1600px width provides generous horizontal space for 2 detailed columns
  const CANVAS_WIDTH = 1600;
  
  // Calculate dynamic height based on the number of rows in the columns to maintain crisp typography
  const maxRowsInColumn = Math.max(pageData.leftMembers.length, pageData.rightMembers.length, 1);
  const rowHeight = maxRowsInColumn > 50 ? 32 : maxRowsInColumn > 25 ? 38 : 46;
  const colHeaderTotalHeight = 86; // 48px main header + 38px column subheaders
  const tableContentHeight = colHeaderTotalHeight + maxRowsInColumn * rowHeight + 24;
  
  const headerMargin = 40;
  const headerHeight = 260;
  const footerHeight = 70;
  const spacingGap = 30;

  const CANVAS_HEIGHT = Math.max(
    1800,
    headerMargin * 2 + headerHeight + spacingGap * 2 + tableContentHeight + footerHeight
  );

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = CANVAS_THEMES[config.themeId || 'anime-sky'] || CANVAS_THEMES['anime-sky'];

  // 1. Background Fill
  ctx.fillStyle = theme.bgColor;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Decorative subtle grid / anime line pattern
  ctx.strokeStyle = theme.borderColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  for (let x = 40; x < CANVAS_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 40; y < CANVAS_HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 2. Header Container with Gradient
  const headerWidth = CANVAS_WIDTH - headerMargin * 2;
  const headerGrad = ctx.createLinearGradient(
    headerMargin,
    headerMargin,
    headerMargin + headerWidth,
    headerMargin + headerHeight
  );
  headerGrad.addColorStop(0, theme.headerGradientStart);
  headerGrad.addColorStop(1, theme.headerGradientEnd);

  // Rounded Header Box
  drawRoundedRect(ctx, headerMargin, headerMargin, headerWidth, headerHeight, 22);
  ctx.fillStyle = headerGrad;
  ctx.fill();

  // Decorative Header Hex/Diamond Pattern
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < 8; i++) {
    const cx = headerMargin + 95 + i * 190;
    const cy = headerMargin + 130;
    drawDiamond(ctx, cx, cy, 40);
  }

  // Header Title & Clan Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 38px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  const fullTitle = `${(config.clanName || 'CLAN WIBU').toUpperCase()} — ${(config.reportTitle || 'LAPORAN DONASI GEMS').toUpperCase()}`;
  ctx.fillText(fullTitle, CANVAS_WIDTH / 2, headerMargin + 58);

  // Date Ribbon & Multi-Sheet Chapter Indicator
  const dateText = `📅 ${config.dateStr || formatIndonesianDate()}`;
  const sheetInfoText = `📑 LEMBAR ${pageData.pageIndex + 1} DARI ${pageData.totalPages} (BAB PERINGKAT ${pageData.startRank} - ${pageData.startRank + pageData.members.length - 1})`;
  
  ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
  const ribbonText = `${dateText}   •   ${sheetInfoText}`;
  const ribbonWidth = ctx.measureText(ribbonText).width + 40;
  const ribbonX = (CANVAS_WIDTH - ribbonWidth) / 2;
  const ribbonY = headerMargin + 78;

  drawRoundedRect(ctx, ribbonX, ribbonY, ribbonWidth, 34, 17);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(ribbonText, CANVAS_WIDTH / 2, ribbonY + 23);

  // Header Stats Cards (3 cards inside header)
  const statsCardY = headerMargin + 135;
  const statsCardWidth = (headerWidth - 60) / 3;
  const statsCardHeight = 90;

  const percentage = config.totalMembersCount > 0
    ? Math.round((config.donatedCount / config.totalMembersCount) * 100)
    : 0;

  const stats = [
    { label: 'STATUS DONASI CLAN', value: `${config.donatedCount} / ${config.totalMembersCount} Member` },
    { label: 'TOTAL DONASI TERKUMPUL', value: formatCurrency(config.totalNominal, config.currencySymbol) },
    { label: 'TINGKAT PARTISIPASI', value: `${percentage}% Selesai` },
  ];

  stats.forEach((s, idx) => {
    const cardX = headerMargin + 20 + idx * (statsCardWidth + 10);
    drawRoundedRect(ctx, cardX, statsCardY, statsCardWidth, statsCardHeight, 14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, cardX + statsCardWidth / 2, statsCardY + 28);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 23px "Plus Jakarta Sans", monospace';
    ctx.fillText(s.value, cardX + statsCardWidth / 2, statsCardY + 64);
  });

  // 3. Main Donors Table Section (2 Chapters: Bab Kiri & Bab Kanan)
  const contentTop = headerMargin + headerHeight + spacingGap;
  const colGap = 34;
  const colWidth = (headerWidth - colGap) / 2;

  const columns = [
    {
      title: 'BAB KIRI (KOLOM 1)',
      subTitle: pageData.leftMembers.length > 0
        ? `Peringkat #${pageData.leftStartRank} s/d #${pageData.leftEndRank} (${pageData.leftMembers.length} Orang)`
        : 'Peringkat Kosong',
      x: headerMargin,
      members: pageData.leftMembers,
      baseRank: pageData.leftStartRank,
      accentHeaderColor: theme.headerGradientStart,
    },
    {
      title: 'BAB KANAN (KOLOM 2)',
      subTitle: pageData.rightMembers.length > 0
        ? `Peringkat #${pageData.rightStartRank} s/d #${pageData.rightEndRank} (${pageData.rightMembers.length} Orang)`
        : 'Peringkat Kosong / Lanjutan Selesai',
      x: headerMargin + colWidth + colGap,
      members: pageData.rightMembers,
      baseRank: pageData.rightStartRank,
      accentHeaderColor: theme.headerGradientEnd,
    },
  ];

  // Draw 2 Columns: Bab Kiri (up to 100) & Bab Kanan (up to 100)
  columns.forEach((col) => {
    // Column Card Container
    drawRoundedRect(ctx, col.x, contentTop, colWidth, tableContentHeight, 18);
    ctx.fillStyle = theme.cardBg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = theme.borderColor;
    ctx.stroke();

    // Chapter Header (Top rounded)
    const mainHeaderH = 46;
    drawRoundedRectTop(ctx, col.x, contentTop, colWidth, mainHeaderH, 18);
    ctx.fillStyle = col.accentHeaderColor;
    ctx.fill();

    // Chapter Title Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(col.title, col.x + 20, contentTop + 29);

    // Chapter Range Tag on Right
    ctx.textAlign = 'right';
    ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(col.subTitle, col.x + colWidth - 20, contentTop + 29);

    // Column Sub-headers (NO, NAMA MEMBER, NOMINAL)
    const subHeaderY = contentTop + mainHeaderH;
    const subHeaderH = 36;
    ctx.fillStyle = theme.rowAltBg;
    ctx.fillRect(col.x, subHeaderY, colWidth, subHeaderH);

    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(col.x, subHeaderY + subHeaderH);
    ctx.lineTo(col.x + colWidth, subHeaderY + subHeaderH);
    ctx.stroke();

    ctx.fillStyle = theme.textSecondary;
    ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NO', col.x + 20, subHeaderY + 23);
    ctx.fillText('NAMA MEMBER DONATUR', col.x + 72, subHeaderY + 23);
    ctx.textAlign = 'right';
    ctx.fillText('NOMINAL GEMS', col.x + colWidth - 20, subHeaderY + 23);

    // Render Member Rows (up to 100 members in this chapter)
    const rowsStartY = subHeaderY + subHeaderH + 6;

    if (col.members.length === 0) {
      ctx.fillStyle = theme.textSecondary;
      ctx.font = '600 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        col.title.includes('KANAN') && pageData.leftMembers.length > 0
          ? '(Seluruh member pada bab ini telah selesai di kolom kiri)'
          : '(Belum ada data member)',
        col.x + colWidth / 2,
        rowsStartY + 80
      );
    } else {
      col.members.forEach((member, mIdx) => {
        const rowY = rowsStartY + mIdx * rowHeight;
        const currentRank = member.rankNumber || (col.baseRank + mIdx);

        // Alternate row background for clean scannability
        if (mIdx % 2 === 1) {
          ctx.fillStyle = theme.rowAltBg;
          ctx.fillRect(col.x + 4, rowY - 2, colWidth - 8, rowHeight - 2);
        }

        // Rank Badge Styling
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
        } else if (currentRank <= 10) {
          badgeColor = theme.badgeTop10;
          badgeTextColor = '#FFFFFF';
        }

        const badgeSize = rowHeight > 36 ? 24 : 20;
        const badgeX = col.x + 16;
        const badgeY = rowY + (rowHeight - badgeSize) / 2 - 2;

        drawRoundedRect(ctx, badgeX, badgeY, badgeSize + (currentRank >= 100 ? 8 : 0), badgeSize, 6);
        ctx.fillStyle = badgeColor;
        ctx.fill();

        ctx.fillStyle = badgeTextColor;
        ctx.font = rowHeight > 36 ? '800 11px "Plus Jakarta Sans", sans-serif' : '800 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        const badgeCenterX = badgeX + (badgeSize + (currentRank >= 100 ? 8 : 0)) / 2;
        ctx.fillText(`${currentRank}`, badgeCenterX, badgeY + badgeSize / 2 + 3.5);

        // Member Name
        ctx.fillStyle = theme.textPrimary;
        ctx.font = rowHeight > 36 ? '700 14px "Plus Jakarta Sans", sans-serif' : '700 13px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        
        // Truncate name if too long
        const nameStartX = col.x + 58 + (currentRank >= 100 ? 8 : 0);
        const maxNameWidth = colWidth - 230;
        let displayName = member.name;
        while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -2) + '…';
        }
        ctx.fillText(displayName, nameStartX, rowY + rowHeight / 2 + 3);

        // Nominal or Status
        ctx.textAlign = 'right';
        if (member.nominal > 0) {
          ctx.fillStyle = theme.accentPrimary;
          ctx.font = rowHeight > 36 ? '800 14px "JetBrains Mono", monospace' : '800 13px "JetBrains Mono", monospace';
          ctx.fillText(formatCurrency(member.nominal, config.currencySymbol), col.x + colWidth - 20, rowY + rowHeight / 2 + 3);
        } else if (member.status === 'donated') {
          // Donated status pill badge (green)
          const pillText = 'Sudah Donasi';
          ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
          const pillW = ctx.measureText(pillText).width + 16;
          const pillH = 20;
          const pillX = col.x + colWidth - 20 - pillW;
          const pillY = rowY + (rowHeight - pillH) / 2 - 2;

          drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
          ctx.fill();

          ctx.fillStyle = '#059669';
          ctx.textAlign = 'center';
          ctx.fillText(pillText, pillX + pillW / 2, pillY + 14);
        } else {
          // Undonated pill badge
          const pillText = 'Belum Donasi';
          ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
          const pillW = ctx.measureText(pillText).width + 16;
          const pillH = 20;
          const pillX = col.x + colWidth - 20 - pillW;
          const pillY = rowY + (rowHeight - pillH) / 2 - 2;

          drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.fill();

          ctx.fillStyle = '#EF4444';
          ctx.textAlign = 'center';
          ctx.fillText(pillText, pillX + pillW / 2, pillY + 14);
        }
      });
    }
  });

  // 4. Footer & Watermark
  const footerY = CANVAS_HEIGHT - 38;

  ctx.fillStyle = theme.textSecondary;
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`✨ Clan Wibu Donation Tracker • Laporan Canvas by ${config.creatorCredit || 'Shiro Anna'}`, headerMargin + 10, footerY);

  // Multi-sheet continuation status in footer
  ctx.textAlign = 'right';
  ctx.font = '800 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.accentPrimary;
  
  if (pageData.totalPages > 1) {
    if (pageData.pageIndex < pageData.totalPages - 1) {
      ctx.fillText(
        `Lembar ${pageData.pageIndex + 1} dari ${pageData.totalPages} • Berlanjut ke Lembar #${pageData.pageIndex + 2} (Peringkat #${pageData.rightEndRank + 1} dst.) ➔`,
        CANVAS_WIDTH - headerMargin - 10,
        footerY
      );
    } else {
      ctx.fillText(
        `Lembar ${pageData.pageIndex + 1} dari ${pageData.totalPages} • Lembar Terakhir (Total ${config.totalMembersCount} Member)`,
        CANVAS_WIDTH - headerMargin - 10,
        footerY
      );
    }
  } else {
    ctx.fillText(
      `Lembar Lengkap (Total ${pageData.members.length} Member Terdaftar)`,
      CANVAS_WIDTH - headerMargin - 10,
      footerY
    );
  }
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
