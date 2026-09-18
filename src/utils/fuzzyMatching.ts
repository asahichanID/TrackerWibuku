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
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLength - distance) / maxLength);
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

  // Extra check: if line is just a name without nominal (e.g. member who hasn't donated yet, or nominal is 0)
  if (!foundNominal) {
    // Check if line looks like a valid username without garbage
    const isValidNameOnly = /^[a-zA-Z0-9_\-.\s~@#$]{3,24}$/.test(cleanLine) && !/\d{5,}/.test(cleanLine);
    if (isValidNameOnly && !isCommonNoiseWord(cleanLine)) {
      return {
        name: sanitizeName(cleanLine),
        nominal: 0,
        confidenceBonus: -10,
      };
    }
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

// Check for common UI noise words (Game headers, menus, timestamps)
function isCommonNoiseWord(str: string): boolean {
  const noise = [
    'clan', 'guild', 'donation', 'donasi', 'leaderboard', 'rank', 'ranking',
    'total', 'member', 'anggota', 'daftar', 'history', 'riwayat', 'menu',
    'setting', 'pengaturan', 'level', 'status', 'online', 'offline', 'score',
    'point', 'waktu', 'time', 'search', 'cari', 'filter', 'semua', 'all',
    'claim', 'klaim', 'reward', 'hadiah', 'season', 'musim', 'event', 'battle',
    'war', 'guild war', 'clan war'
  ];
  const s = str.toLowerCase().trim();
  return noise.includes(s) || /^\d+$/.test(s);
}

// Sanitize member name
export function sanitizeName(name: string): string {
  return name
    .replace(/^[^a-zA-Z0-9_]+/, '') // remove leading symbols
    .replace(/[^a-zA-Z0-9_\-.\s~@#$]+$/g, '') // remove trailing garbage
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
