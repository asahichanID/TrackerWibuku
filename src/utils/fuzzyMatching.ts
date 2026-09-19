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
 * 27,0K, 15.1K, 500 gems, 500 Gems, 1000 Kristal, 50k gems, 1.5k 💎, 💎 27,0K, 250 dm, 1.000, 50.000, etc.
 * Avoids misidentifying standalone rank/level numbers like '1', '2', '21' as nominal.
 */
export function parseNominal(str: string): number | null {
  if (!str) return null;
  const clean = str.trim();

  // Pattern with 'k' / 'rb' / 'ribu' / 'm' / 'jt' (e.g. 27,0K, 15,1K, 50k, 50rb, 1.5M, 💎 27,0K)
  const suffixMatch = clean.match(/(?:💎\s*)?([\d.,]+)\s*(k|rb|ribu|m|mil|million|jt|juta)\s*(?:gems?|kristal|crystals?|dm|diamond)?\b/i);
  if (suffixMatch) {
    const rawVal = parseFloat(suffixMatch[1].replace(/,/g, '.'));
    const unit = suffixMatch[2].toLowerCase();
    if (!isNaN(rawVal)) {
      if (['m', 'mil', 'million', 'jt', 'juta'].includes(unit)) {
        return Math.round(rawVal * 1000000);
      }
      return Math.round(rawVal * 1000);
    }
  }

  // Pattern with explicit currency keywords (gems, kristal, crystals, diamond, dm, 💎)
  const explicitMatch = clean.match(/(?:💎\s*|gems?|kristal|crystals?|diamond|dm)\s*([\d.,]+)|([\d.,]+)\s*(?:💎|gems?|kristal|crystals?|diamond|dm)/i);
  if (explicitMatch) {
    const rawDigits = explicitMatch[1] || explicitMatch[2];
    const normalized = rawDigits.replace(/\./g, '').replace(/,/g, '.');
    const val = parseFloat(normalized);
    if (!isNaN(val) && val > 0 && val <= 1000000000) {
      return Math.round(val);
    }
  }

  // Standalone formatted thousands number e.g. '27.000', '1.000', '1,000' OR isolated 3+ digit number (>= 50)
  const standaloneMatch = clean.match(/^[\s💎]*([\d]{1,3}(?:[.,]\d{3})+|\d{3,7})[\s💎]*$/);
  if (standaloneMatch) {
    const rawDigits = standaloneMatch[1];
    const cleaned = rawDigits.includes('.') && !rawDigits.includes(',')
      ? rawDigits.replace(/\./g, '')
      : rawDigits.includes(',') && !rawDigits.includes('.')
      ? rawDigits.replace(/,/g, '')
      : rawDigits.replace(/[.,]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val >= 50 && val <= 1000000000) {
      return val;
    }
  }

  return null;
}

/**
 * Clean OCR raw line and extract Candidate Name + Nominal
 * Preserves clan brackets 『』, hyphens in nick (e.g. 『緒』 - rzkyfhrzi.), and special characters.
 */
export function parseOcrLine(line: string): { name: string; nominal: number; confidenceBonus: number } | null {
  if (!line || line.trim().length < 3) return null;

  let cleanLine = line
    .replace(/^[\s\d#№]+[.)\-:|]\s*/, '') // Remove starting list numbering e.g. "1. ", "01 - "
    .trim();

  // Try extracting trailing currency / nominal e.g. "『緒』 - rzkyfhrzi. 27,0K" or "Shiro Anna 500 Gems"
  const trailingMatch = cleanLine.match(/^(.*?)(?:[\s|:–—]+)((?:💎\s*)?[\d.,]+[kKmM]\b|(?:💎\s*)?[\d.,]+\s*(?:gems?|kristal|crystals?|dm|diamond)|\b[\d]{1,3}(?:\.\d{3})+\b|\b\d{3,6}\b)\s*$/i);
  if (trailingMatch) {
    const candidateName = trailingMatch[1].trim();
    const candidateNomStr = trailingMatch[2].trim();
    const nom = parseNominal(candidateNomStr);
    if (nom !== null && nom > 0) {
      const finalName = sanitizeName(candidateName);
      if (finalName.length >= 2 && !isCommonNoiseWord(finalName)) {
        return { name: finalName, nominal: nom, confidenceBonus: 25 };
      }
    }
  }

  // Try explicit separators like '💎', ':', '\t', '|'
  const separators = [' 💎 ', '💎', ':', '\t', ' | '];
  for (const sep of separators) {
    if (cleanLine.includes(sep)) {
      const idx = cleanLine.lastIndexOf(sep);
      const left = cleanLine.substring(0, idx).trim();
      const right = cleanLine.substring(idx + sep.length).trim();
      const nomRight = parseNominal(right);
      if (nomRight !== null && nomRight > 0) {
        const finalName = sanitizeName(left);
        if (finalName.length >= 2 && !isCommonNoiseWord(finalName)) {
          return { name: finalName, nominal: nomRight, confidenceBonus: 25 };
        }
      }
    }
  }

  return null;
}

// Check for common UI noise words (Game headers, menus, timestamps, roles)
export function isCommonNoiseWord(str: string): boolean {
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

/**
 * Parses sequential multi-line OCR text blocks from mobile game clan leaderboard screens
 * Handles cases where rank number + player name, role badge, lifetime total, and donation pill appear on separate lines.
 */
export function parseClanBlockLines(lines: Array<{ text: string; confidence: number }>): Array<{
  name: string;
  nominal: number;
  confidence: number;
  rankNumber?: number;
  rawText: string;
}> {
  const results: Array<{
    name: string;
    nominal: number;
    confidence: number;
    rankNumber?: number;
    rawText: string;
  }> = [];

  let currentRank: number | undefined = undefined;
  let candidateName: string = '';
  let candidateConf = 75;
  let candidateRaw = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].text.trim();
    const conf = lines[i].confidence;
    if (!rawLine || rawLine.length < 2) continue;

    // Check if line is purely noise or role badge
    if (isCommonNoiseWord(rawLine) || /^(OFFICER|VICE LEADER|ADMIRAL|LEADER|MEMBER|ELDER)$/i.test(rawLine)) {
      continue;
    }

    // Check if line is lifetime activity e.g. "Total 361,3K · Gabung 21 hr"
    if (/^Total\s+[\d.,]+[KkMm]?\s*[·•-]?\s*Gabung/i.test(rawLine)) {
      continue;
    }

    // Check if line contains a complete single-line entry
    const singleParsed = parseOcrLine(rawLine);
    if (singleParsed && singleParsed.nominal > 0) {
      // Extract starting rank if present e.g. "1 『緒』..."
      const rankMatch = rawLine.match(/^(\d+)[\s.:\-–—)]/);
      const parsedRank = rankMatch ? parseInt(rankMatch[1], 10) : undefined;
      results.push({
        name: singleParsed.name,
        nominal: singleParsed.nominal,
        confidence: Math.min(100, Math.round(conf + singleParsed.confidenceBonus)),
        rankNumber: parsedRank,
        rawText: rawLine,
      });
      candidateName = '';
      currentRank = undefined;
      continue;
    }

    // Check if line is a donation crystal nominal alone (e.g. "27,0K", "15,1K", "5,0K", "1.000", "500 gems", "💎 27,0K")
    const nominalOnly = parseNominal(rawLine);
    if (nominalOnly !== null && nominalOnly > 0) {
      if (candidateName && candidateName.length >= 2) {
        results.push({
          name: candidateName,
          nominal: nominalOnly,
          confidence: Math.min(100, Math.round((candidateConf + conf) / 2) + 20),
          rankNumber: currentRank,
          rawText: `${candidateRaw} | ${rawLine}`,
        });
        candidateName = '';
        currentRank = undefined;
        continue;
      }
    }

    // Check if line looks like a player name (often starts with rank e.g. "1 『緒』 - rzkyfhrzi." or has clan brackets)
    const rankMatch = rawLine.match(/^(\d+)[\s.:\-–—)]\s*(.+)/);
    if (rankMatch) {
      currentRank = parseInt(rankMatch[1], 10);
      const cleaned = sanitizeName(rankMatch[2]);
      if (cleaned.length >= 2 && !isCommonNoiseWord(cleaned)) {
        candidateName = cleaned;
        candidateConf = conf;
        candidateRaw = rawLine;
      }
    } else {
      const cleaned = sanitizeName(rawLine);
      if (cleaned.length >= 2 && !isCommonNoiseWord(cleaned)) {
        candidateName = cleaned;
        candidateConf = conf;
        candidateRaw = rawLine;
      }
    }
  }

  return results;
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
