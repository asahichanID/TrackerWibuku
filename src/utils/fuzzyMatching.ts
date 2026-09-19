/**
 * Fuzzy matching and text normalization utilities for OCR
 * Author/Credit: Shiro Anna
 */

// Calculate Levenshtein Distance
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));

  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (b.charAt(j - 1).toLowerCase() === a.charAt(i - 1).toLowerCase()) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

// Calculate Similarity (0.0 to 1.0)
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').trim().toLowerCase();
  const s2 = (str2 || '').trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLength - distance) / maxLength);
}

/**
 * Extracts the core username by stripping common clan tags, brackets, and decoration
 * Examples:
 * "『緒』 - rzkyfhrzi." -> "rzkyfhrzi"
 * "『緒』Sleepy'" -> "sleepy"
 * "緒 liplip." -> "liplip"
 * "kesya Andrianiputri" -> "kesya andrianiputri"
 */
export function extractCorePlayerName(name: string): string {
  if (!name) return '';
  return name
    // Strip clan bracket tags like 『緒』, [緒], (緒), 【緒】, 緒, etc.
    .replace(/[『「【《\[(][^』」】》\])]*[』」】》\])]/g, '')
    // Strip leading clan prefix words like "緒", "CLAN", "WIBU" if followed by dash/space
    .replace(/^(?:緒|『緒』|clan|wibu)\s*[-_·•|:~]?\s*/i, '')
    // Strip trailing or leading punctuation and role badges
    .replace(/\b(OFFICER|VICE LEADER|ADMIRAL|LEADER|MEMBER|ELDER)\b/gi, '')
    .replace(/^[-_·•|:~.\s]+|[-_·•|:~.\s]+$/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Robustly checks if two names represent the EXACT SAME clan member across video frames
 * Strictly preserves distinct clan members (never merges different names like "Leo" and "Leon", or "Rizky" and "Rizka")
 */
export function isSameClanMember(nameA: string, nameB: string, timeGapSec?: number): boolean {
  if (!nameA || !nameB) return false;

  const cleanA = sanitizeName(nameA).toLowerCase().trim();
  const cleanB = sanitizeName(nameB).toLowerCase().trim();

  // 1. Exact or sanitized match
  if (cleanA === cleanB) return true;

  // 2. Core name match (stripping clan tags like 『緒』, 緒, etc.)
  const coreA = extractCorePlayerName(cleanA);
  const coreB = extractCorePlayerName(cleanB);

  if (coreA && coreB) {
    // Exact match of core nickname without clan brackets
    if (coreA === coreB) return true;

    // Boundary truncation during scroll (only if one ends with ellipsis or trailing dot)
    // and timeGap is within adjacent frames (< 3.0s)
    if (timeGapSec !== undefined && Math.abs(timeGapSec) <= 3.0) {
      if (coreA.endsWith('...') || coreA.endsWith('.') || coreB.endsWith('...') || coreB.endsWith('.')) {
        const pureA = coreA.replace(/\.+$/, '');
        const pureB = coreB.replace(/\.+$/, '');
        if (pureA.length >= 4 && pureB.length >= 4) {
          if (pureA.startsWith(pureB) || pureB.startsWith(pureA)) {
            return true;
          }
        }
      }
    }
  }

  // 3. Fallback: ultra-high similarity (>= 0.95) only for adjacent frames (<= 2.5s)
  if (timeGapSec !== undefined && Math.abs(timeGapSec) <= 2.5) {
    if (Math.abs(cleanA.length - cleanB.length) <= 1) {
      const sim = stringSimilarity(cleanA, cleanB);
      if (sim >= 0.95) return true;
    }
  }

  return false;
}

// Find closest existing member name in database
export function findBestMatchingMember(
  rawName: string,
  existingNames: string[],
  threshold = 0.8
): { matchedName: string | null; similarity: number } {
  let bestMatch: string | null = null;
  let highestSimilarity = 0;

  for (const name of existingNames) {
    const sim = stringSimilarity(rawName, name);
    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      bestMatch = name;
    }
  }

  if (highestSimilarity >= threshold) {
    return { matchedName: bestMatch, similarity: highestSimilarity };
  }
  return { matchedName: null, similarity: highestSimilarity };
}

/**
 * Parse nominal donation from string
 * Handles gems/crystals/diamond units and numbers:
 * 500 gems, 500 Gems, 1000 Kristal, 50k gems, 1.5k 💎, 💎 500, 250 dm, 1000, 50.000, etc.
 */
export function parseNominal(str: string): number | null {
  if (!str) return null;
  // Replace gem emoji with word
  const clean = str.trim().toLowerCase().replace(/💎/g, ' gems ');

  // Pattern with 'k' / 'rb' / 'ribu' with optional gems/kristal (e.g., 50k, 50.5k gems, 50rb kristal)
  const kMatch = clean.match(/([\d.,]+)\s*(?:k|rb|ribu)\s*(?:gems?|kristal|crystals?|dm|diamond)?\b/);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, '.'));
    if (!isNaN(num)) return Math.round(num * 1000);
  }

  // Pattern with 'jt' / 'juta' / 'm' (e.g. 1jt gems, 1.5m)
  const jtMatch = clean.match(/([\d.,]+)\s*(?:jt|juta|m|mil|million)\s*(?:gems?|kristal|crystals?|dm|diamond)?\b/);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(/,/g, '.'));
    if (!isNaN(num)) return Math.round(num * 1000000);
  }

  // Pattern with explicit gems / kristal / diamond / dm / crystal units (e.g. 500 gems, 1000 kristal, 250 dm)
  const gemMatch = clean.match(/(?:gems?|kristal|crystals?|diamond|dm)?\s*([\d]{1,3}(?:[.,]\d{3})+|\d+)\s*(?:gems?|kristal|crystals?|diamond|dm)?/);
  if (gemMatch && gemMatch[1]) {
    const rawDigits = gemMatch[1];
    let normalized = rawDigits;
    if (rawDigits.includes('.') && !rawDigits.includes(',')) {
      normalized = rawDigits.replace(/\./g, '');
    } else if (rawDigits.includes(',') && !rawDigits.includes('.')) {
      normalized = rawDigits.replace(/,/g, '');
    } else if (rawDigits.includes('.') && rawDigits.includes(',')) {
      normalized = rawDigits.split(',')[0].replace(/\./g, '');
    }

    const val = parseInt(normalized, 10);
    if (!isNaN(val) && val > 0 && val <= 1000000000) {
      return val;
    }
  }

  return null;
}

/**
 * Clean OCR raw line and extract Candidate Name + Nominal
 */
export function parseOcrLine(line: string): { name: string; nominal: number; confidenceBonus: number } | null {
  if (!line || line.trim().length < 3) return null;

  // Remove common UI noise artifacts like bullet points, icons, timestamps, rank prefixes like "1.", "No. 1", "#1"
  let cleanLine = line
    .replace(/^[\s\d#№]+[.)\-:|]\s*/, '') // Remove starting list numbering e.g. "1. ", "01 - "
    .replace(/[\[\]{}()]/g, ' ')
    .trim();

  // Try parsing nominal from right side or after separator
  // Separators: ":", "-", "|", "=", "💎", "Gems", "gems", "Kristal", "kristal", "donasi", tab, or multiple spaces
  const separators = [':', ' - ', ' | ', ' = ', ' 💎 ', ' gems ', ' Gems ', ' kristal ', ' Kristal ', ' donasi ', '\t'];
  
  let foundName = '';
  let foundNominal: number | null = null;

  for (const sep of separators) {
    if (cleanLine.includes(sep)) {
      const parts = cleanLine.split(sep);
      const left = parts[0].trim();
      const right = parts.slice(1).join(' ').trim();

      const nomRight = parseNominal(right);
      if (nomRight !== null && left.length >= 2) {
        foundName = left;
        foundNominal = nomRight;
        break;
      }

      // Check if nominal is on left side (e.g., "500 gems - Shiro")
      const nomLeft = parseNominal(left);
      if (nomLeft !== null && right.length >= 2) {
        foundName = right;
        foundNominal = nomLeft;
        break;
      }
    }
  }

  // If no explicit separator worked, try trailing nominal regex (e.g. "Shiro Anna 500 Gems" or "Kirito_99 1500 💎" or "WibuLegend 1000")
  if (!foundNominal) {
    const trailingMatch = cleanLine.match(/^(.*?)\s+((?:💎\s*)?[\d.,]+\s*(?:k|rb|ribu|gems?|kristal|crystals?|dm|diamond)?)$/i);
    if (trailingMatch) {
      const candidateName = trailingMatch[1].trim();
      const candidateNomStr = trailingMatch[2].trim();
      const nom = parseNominal(candidateNomStr);
      if (nom !== null && candidateName.length >= 2) {
        foundName = candidateName;
        foundNominal = nom;
      }
    }
  }

  // Extra check: If line has no donation nominal, return null (STRICT: only detect members who have actually donated)
  if (!foundNominal || foundNominal <= 0) {
    return null;
  }

  // Clean and sanitize the member name
  const finalName = sanitizeName(foundName);
  if (finalName.length < 2 || isCommonNoiseWord(finalName)) {
    return null;
  }

  return {
    name: finalName,
    nominal: foundNominal,
    confidenceBonus: 10,
  };
}

// Check for common UI noise words (Game headers, menus, timestamps, roles)
function isCommonNoiseWord(str: string): boolean {
  const noise = [
    'clan', 'guild', 'donation', 'donasi', 'leaderboard', 'rank', 'ranking',
    'total', 'member', 'anggota', 'daftar', 'history', 'riwayat', 'menu',
    'setting', 'pengaturan', 'level', 'status', 'online', 'offline', 'score',
    'point', 'waktu', 'time', 'search', 'cari', 'filter', 'semua', 'all',
    'claim', 'klaim', 'reward', 'hadiah', 'season', 'musim', 'event', 'battle',
    'war', 'guild war', 'clan war', 'officer', 'vice leader', 'admiral', 'leader', 'elder',
    'browse clan', 'gabung'
  ];
  const s = str.toLowerCase().trim();
  return noise.includes(s) || /^\d+$/.test(s);
}

// Sanitize member name while preserving brackets (『』), Japanese/Asian characters, and standard nick symbols
export function sanitizeName(name: string): string {
  return name
    // Strip accidental role tags contaminating name
    .replace(/\b(OFFICER|VICE LEADER|ADMIRAL|LEADER|MEMBER|ELDER)\b/gi, '')
    // Strip subtitle residue like "Total ... Gabung ..."
    .replace(/\bTotal\s+[\d.,]+[KkMm]?\s*[·•-]?\s*Gabung\s+[\w\s]+/gi, '')
    // Strip leading rank numbers like "1. ", "02 - ", "#3 "
    .replace(/^(?:#|\bno\.?|\b)\s*\d+[\s.:\-–—)\]]+\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format currency / Gems
export function formatCurrency(amount: number, symbol = '💎'): string {
  if (isNaN(amount) || amount === 0) return `0 ${symbol}`;
  const formatted = new Intl.NumberFormat('id-ID').format(amount);
  return `${formatted} ${symbol}`;
}

// Format date in Indonesian
export function formatIndonesianDate(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Format full datetime in Indonesian
export function formatIndonesianDateTime(isoString?: string): string {
  const date = isoString ? new Date(isoString) : new Date();
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
