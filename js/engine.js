/**
 * @file engine.js
 * @description Pure JavaScript PII detection, redaction, and sanitisation engine for NEWNAME.
 * Runs in both Node.js (for unit tests) and browser environments. No DOM, no network.
 * 'use strict' enforced throughout.
 */

'use strict';

/**
 * Verhoeff algorithm multiplication table d[10][10]
 */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

/**
 * Verhoeff permutation table p[8][10]
 */
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

/**
 * Verhoeff inverse table
 */
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Devanagari digit code points (\u0966 to \u096F) to ASCII '0'-'9'
 */
const DEVANAGARI_MAP = {
  '\u0966': '0', '\u0967': '1', '\u0968': '2', '\u0969': '3', '\u096A': '4',
  '\u096B': '5', '\u096C': '6', '\u096D': '7', '\u096E': '8', '\u096F': '9'
};

/**
 * Valid PAN 4th letter holder types
 */
const PAN_HOLDER_TYPES = {
  'P': 'Individual',
  'C': 'Company',
  'H': 'Hindu Undivided Family (HUF)',
  'F': 'Firm / Partnership',
  'A': 'Association of Persons (AOP)',
  'T': 'Trust',
  'B': 'Body of Individuals (BOI)',
  'L': 'Local Authority',
  'J': 'Artificial Juridical Person',
  'G': 'Government Agency'
};

/**
 * Validates a number string using the Luhn algorithm (mod 10).
 * @param {string} numStr 
 * @returns {boolean}
 */
export function validateLuhn(numStr) {
  if (!numStr || typeof numStr !== 'string') return false;
  const digits = numStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isNaN(digit)) return false;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Validates a number string using the Verhoeff checksum algorithm.
 * @param {string} numStr 
 * @returns {boolean}
 */
export function validateVerhoeff(numStr) {
  if (!numStr || typeof numStr !== 'string') return false;
  const clean = numStr.replace(/\D/g, '');
  if (!clean || clean.length < 2) return false;

  let c = 0;
  const reversed = clean.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    const digit = reversed[i];
    if (isNaN(digit)) return false;
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]];
  }
  return c === 0;
}

/**
 * Generates a Verhoeff checksum digit for a number string.
 * @param {string} baseStr 
 * @returns {number}
 */
export function generateVerhoeff(baseStr) {
  const clean = baseStr.replace(/\D/g, '');
  let c = 0;
  const reversed = clean.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][reversed[i]]];
  }
  return VERHOEFF_INV[c];
}

/**
 * Detects credit card brand based on digits.
 * @param {string} digits 
 * @returns {string} 'Visa' | 'Mastercard' | 'Amex' | 'RuPay' | 'Card'
 */
export function detectCardBrand(digits) {
  const clean = digits.replace(/\D/g, '');
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(clean)) return 'Visa';
  if (/^(?:5[1-5]\d{14}|2(?:2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(clean)) return 'Mastercard';
  if (/^3[47]\d{13}$/.test(clean)) return 'Amex';
  if (/^(?:60|65|81|82|508)\d{11,14}$/.test(clean)) return 'RuPay';
  return 'Card';
}

/**
 * Normalises Devanagari digits (०-९) to ASCII '0'-'9' without changing string length or offsets.
 * @param {string} str 
 * @returns {string}
 */
export function normalizeDevanagariDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0966-\u096F]/g, match => DEVANAGARI_MAP[match] || match);
}

/**
 * Normalises an email address (standard or disguised) to standard lowercase user@domain.tld.
 * @param {string} emailStr 
 * @returns {string}
 */
export function normalizeEmail(emailStr) {
  if (!emailStr) return '';
  let s = emailStr.trim().toLowerCase();
  // Disguised variations
  s = s.replace(/\s*\[at\]\s*/gi, '@')
       .replace(/\s*\(at\)\s*/gi, '@')
       .replace(/\s+at\s+/gi, '@');
  s = s.replace(/\s*\[dot\]\s*/gi, '.')
       .replace(/\s*\(dot\)\s*/gi, '.')
       .replace(/\s+dot\s+/gi, '.');
  s = s.replace(/\s+/g, '');
  return s;
}

/**
 * Normalises an Indian mobile phone number to 10 ASCII digits.
 * @param {string} phoneStr 
 * @returns {string}
 */
export function normalizePhone(phoneStr) {
  if (!phoneStr) return '';
  const ascii = normalizeDevanagariDigits(phoneStr);
  const digits = ascii.replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalises a PAN to uppercase 10-char alphanumeric string.
 * @param {string} panStr 
 * @returns {string}
 */
export function normalizePAN(panStr) {
  return (panStr || '').trim().toUpperCase();
}

/**
 * Validates IPv4 address string (each octet 0-255).
 * @param {string} ipStr 
 * @returns {{ valid: boolean, badOctet?: number }}
 */
export function validateIPv4(ipStr) {
  const parts = ipStr.split('.');
  if (parts.length !== 4) return { valid: false };
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return { valid: false };
    const num = parseInt(part, 10);
    if (num < 0 || num > 255) {
      return { valid: false, badOctet: num };
    }
  }
  return { valid: true };
}

/**
 * Validates IPv6 address string. Rejects clock times like '10:30:00'.
 * @param {string} ipStr 
 * @returns {boolean}
 */
export function validateIPv6(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return false;
  // Clock time or invalid reject
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(ipStr)) return false;
  if (ipStr.includes(':::')) return false;

  const parts = ipStr.split('::');
  if (parts.length > 2) return false;

  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    if (left.length + right.length > 7) return false;
    for (const seg of [...left, ...right]) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(seg)) return false;
    }
    return true;
  }

  // Full IPv6 must have exactly 8 groups
  const segments = ipStr.split(':');
  if (segments.length !== 8) return false;
  for (const seg of segments) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(seg)) return false;
  }
  return true;
}

/**
 * Scans text and detects sensitive PII entities according to priority rules.
 * Candidates that fail validation are captured in the `ignored` list with human reasons.
 * 
 * @param {string} text Raw input text
 * @param {object} options Optional custom manual entries or Gemini Nano findings
 * @returns {{ findings: Array<object>, ignored: Array<object> }}
 */
export function detectPII(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { findings: [], ignored: [] };
  }

  const findings = [];
  const ignored = [];
  const len = text.length;
  // Boolean map of claimed character indices to avoid double counting
  const claimed = new Uint8Array(len);

  function isRangeClaimed(start, end) {
    for (let i = start; i < end; i++) {
      if (claimed[i]) return true;
    }
    return false;
  }

  function claimRange(start, end) {
    for (let i = start; i < end; i++) {
      claimed[i] = 1;
    }
  }

  // Normalise text for Devanagari detection while keeping index alignment
  const asciiText = normalizeDevanagariDigits(text);

  // ==========================================
  // 1. CREDIT CARDS (13-19 digits, Luhn check)
  // ==========================================
  // Matches grouped numbers like 4-4-4-4, 4-6-5 (Amex), or contiguous 13-19 digits
  const cardRegex = /(?<![0-9])(?:\d[ -]*?){13,19}(?![0-9])/g;
  let match;
  while ((match = cardRegex.exec(asciiText)) !== null) {
    const rawVal = text.substring(match.index, match.index + match[0].length);
    const digitsOnly = match[0].replace(/\D/g, '');
    const start = match.index;
    const end = start + match[0].length;

    if (isRangeClaimed(start, end)) continue;

    // Check if it's 13 to 19 digits
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      if (validateLuhn(digitsOnly)) {
        const brand = detectCardBrand(digitsOnly);
        claimRange(start, end);
        findings.push({
          type: 'card',
          start,
          end,
          value: rawVal,
          normalisedKey: digitsOnly,
          reason: `Valid ${brand} (${digitsOnly.length} digits, Luhn checksum verified)`,
          flags: { brand }
        });
      } else {
        // Candidate looks card-shaped / order ID but fails Luhn check
        ignored.push({
          type: 'card',
          start,
          end,
          value: rawVal,
          reason: `${digitsOnly.length} digits, but fails the Luhn check — probably an order number`
        });
      }
    }
  }

  // ==========================================
  // 2. AADHAAR (12 digits, first 2-9, Verhoeff)
  // ==========================================
  // Format: 4-4-4 separated by optional spaces or dashes, or contiguous 12 digits
  const aadhaarRegex = /(?<![0-9])([0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4})(?![0-9])/g;
  while ((match = aadhaarRegex.exec(asciiText)) !== null) {
    const rawVal = text.substring(match.index, match.index + match[0].length);
    const digitsOnly = match[1].replace(/\D/g, '');
    const start = match.index;
    const end = start + match[0].length;

    if (isRangeClaimed(start, end)) continue;

    if (digitsOnly.length === 12) {
      const firstDigit = parseInt(digitsOnly.charAt(0), 10);
      if (firstDigit >= 2 && firstDigit <= 9) {
        if (validateVerhoeff(digitsOnly)) {
          claimRange(start, end);
          findings.push({
            type: 'aadhaar',
            start,
            end,
            value: rawVal,
            normalisedKey: digitsOnly,
            reason: 'Valid Indian Aadhaar (12 digits, starts with 2–9, Verhoeff checksum verified)',
            flags: {}
          });
        } else {
          ignored.push({
            type: 'aadhaar',
            start,
            end,
            value: rawVal,
            reason: 'Verhoeff checksum fails'
          });
        }
      } else {
        // First digit is 0 or 1
        ignored.push({
          type: 'aadhaar',
          start,
          end,
          value: rawVal,
          reason: `12-digit number starts with ${firstDigit}, but valid Aadhaar must start with 2–9`
        });
      }
    }
  }

  // ==========================================
  // 3. PAN (5 letters + 4 digits + 1 letter)
  // ==========================================
  const panRegex = /(?<![A-Za-z0-9])([A-Za-z]{5}[0-9]{4}[A-Za-z])(?![A-Za-z0-9])/g;
  while ((match = panRegex.exec(asciiText)) !== null) {
    const rawVal = text.substring(match.index, match.index + match[0].length);
    const upper = match[1].toUpperCase();
    const fourthLetter = upper.charAt(3);
    const start = match.index;
    const end = start + match[0].length;

    if (isRangeClaimed(start, end)) continue;

    if (PAN_HOLDER_TYPES[fourthLetter]) {
      claimRange(start, end);
      findings.push({
        type: 'pan',
        start,
        end,
        value: rawVal,
        normalisedKey: upper,
        reason: `Valid Indian PAN (${PAN_HOLDER_TYPES[fourthLetter]}, 4th letter '${fourthLetter}')`,
        flags: {}
      });
    } else {
      ignored.push({
        type: 'pan',
        start,
        end,
        value: rawVal,
        reason: `PAN-shaped but '${fourthLetter}' can't be the 4th letter`
      });
    }
  }

  // ==========================================
  // 4. IP ADDRESSES (IPv4 & IPv6)
  // ==========================================
  // IPv6 check first
  const ipv6Regex = /(?<![0-9a-zA-Z:])((?:[0-9a-fA-F]{1,4}:){2,7}(?:[0-9a-fA-F]{1,4}|:)|(?:[0-9a-fA-F]{1,4}:)*:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*|::1|::)(?![0-9a-zA-Z:])/g;
  while ((match = ipv6Regex.exec(asciiText)) !== null) {
    const rawVal = text.substring(match.index, match.index + match[0].length);
    const start = match.index;
    const end = start + match[0].length;

    if (isRangeClaimed(start, end)) continue;

    if (validateIPv6(rawVal)) {
      claimRange(start, end);
      findings.push({
        type: 'ip',
        start,
        end,
        value: rawVal,
        normalisedKey: rawVal.toLowerCase(),
        reason: 'Valid IPv6 address',
        flags: { ipv6: true }
      });
    }
  }

  // IPv4 candidate
  const ipv4Regex = /(?<![0-9.])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![0-9.])/g;
  while ((match = ipv4Regex.exec(asciiText)) !== null) {
    const rawVal = text.substring(match.index, match.index + match[0].length);
    const start = match.index;
    const end = start + match[0].length;

    if (isRangeClaimed(start, end)) continue;

    const res = validateIPv4(match[1]);
    if (res.valid) {
      claimRange(start, end);
      findings.push({
        type: 'ip',
        start,
        end,
        value: rawVal,
        normalisedKey: match[1],
        reason: 'Valid IPv4 address',
        flags: { ipv4: true }
      });
    } else if (res.badOctet !== undefined) {
      ignored.push({
        type: 'ip',
        start,
        end,
        value: rawVal,
        reason: `IP-shaped but ${res.badOctet} is above 255`
      });
    }
  }

  // ==========================================
  // 5. EMAILS (Standard & Disguised)
  // ==========================================
  // A. Disguised Email:
  // e.g. "name [at] domain [dot] in", "name(at)domain.com", "name at domain dot com"
  const disguisedEmailRegex = /\b([a-zA-Z0-9._%+-]+)\s*(\[at\]|\(at\)|\bat\b)\s*([a-zA-Z0-9-]+)\s*(\[dot\]|\(dot\)|\bdot\b|\.)\s*([a-zA-Z]{2,}(?:\s*(?:\[dot\]|\(dot\)|\bdot\b|\.)\s*[a-zA-Z]{2,})*)\b/gi;
  while ((match = disguisedEmailRegex.exec(text)) !== null) {
    const rawVal = match[0];
    const atSymbol = match[2].toLowerCase();
    const dotSymbol = match[4].toLowerCase();
    const start = match.index;
    const end = start + rawVal.length;

    if (isRangeClaimed(start, end)) continue;

    // Reject false positives: natural English sentences like "meet at office.Tomorrow"
    if (atSymbol === 'at' && dotSymbol === '.') {
      continue;
    }

    const norm = normalizeEmail(rawVal);
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(norm)) {
      claimRange(start, end);
      findings.push({
        type: 'email',
        start,
        end,
        value: rawVal,
        normalisedKey: norm,
        reason: 'Disguised email address (de-obfuscated and mapped to standard form)',
        flags: { disguised: true }
      });
    }
  }

  // B. Standard Email
  const standardEmailRegex = /(?<![a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![a-zA-Z0-9._%+-])/g;
  while ((match = standardEmailRegex.exec(text)) !== null) {
    const rawVal = match[0];
    const start = match.index;
    const end = start + rawVal.length;

    if (isRangeClaimed(start, end)) continue;

    const norm = normalizeEmail(rawVal);
    claimRange(start, end);
    findings.push({
      type: 'email',
      start,
      end,
      value: rawVal,
      normalisedKey: norm,
      reason: 'Standard email address',
      flags: {}
    });
  }

  // ==========================================
  // 6. INDIAN MOBILE PHONE NUMBERS
  // ==========================================
  // 10 digits starting with 6-9, optional +91, 0091, 91, or 0 prefix
  // Can be grouped: e.g. "98765 43210", "98765-43210", "+91 98765 43210", or fully spaced "9 8 7 6 5 4 3 2 1 0"
  // Can be in Devanagari digits (९८७६५४३२१०)
  // Must avoid matching 4-digit years (2024), 6-digit pincodes (411001), currency amounts (₹5000), or dates.
  
  // Regex on asciiText to match prefix and 10 digits
  const phonePattern = /(?<![0-9a-zA-Z+])((?:\+91|0091|91|0)[ -]?)?([6-9](?:[ -]?[0-9]){9})(?![0-9a-zA-Z])/g;
  while ((match = phonePattern.exec(asciiText)) !== null) {
    const fullMatch = match[0];
    const prefix = match[1] || '';
    const body = match[2];
    const start = match.index;
    const end = start + fullMatch.length;
    const rawVal = text.substring(start, end);

    if (isRangeClaimed(start, end)) continue;

    // Check if body has exactly 10 digits
    const digitsOnly = body.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      // Check currency symbol or decimal right before
      const prevChar = start > 0 ? text.charAt(start - 1) : '';
      if (prevChar === '₹' || prevChar === '$' || prevChar === '€' || prevChar === '£') {
        continue;
      }

      const hasDevanagari = /[\u0966-\u096F]/.test(rawVal);
      const isSpaced = /\d\s+\d\s+\d/.test(rawVal) || /[\u0966-\u096F]\s+[\u0966-\u096F]/.test(rawVal);
      const norm = normalizePhone(rawVal);

      claimRange(start, end);
      findings.push({
        type: 'phone',
        start,
        end,
        value: rawVal,
        normalisedKey: norm,
        reason: hasDevanagari
          ? 'Indian mobile number (Devanagari digits normalized to ASCII)'
          : isSpaced
          ? 'Indian mobile number (spaced digits format)'
          : 'Valid Indian mobile phone number (10 digits starting with 6–9)',
        flags: {
          devanagari: hasDevanagari,
          spaced: isSpaced
        }
      });
    }
  }

  // ==========================================
  // 7. MANUAL / CUSTOM REDACTIONS (if provided)
  // ==========================================
  if (Array.isArray(options.manualEntries) && options.manualEntries.length > 0) {
    for (const entry of options.manualEntries) {
      if (!entry || typeof entry !== 'string' || entry.trim().length === 0) continue;
      const term = entry.trim();
      let searchIdx = 0;
      while ((searchIdx = text.toLowerCase().indexOf(term.toLowerCase(), searchIdx)) !== -1) {
        const start = searchIdx;
        const end = start + term.length;
        searchIdx = end;

        if (isRangeClaimed(start, end)) continue;

        claimRange(start, end);
        findings.push({
          type: 'manual',
          start,
          end,
          value: text.substring(start, end),
          normalisedKey: term.toLowerCase(),
          reason: 'Manually marked for redaction by user',
          flags: { manual: true }
        });
      }
    }
  }

  // ==========================================
  // 8. GEMINI NANO ENTITIES (names/addresses)
  // ==========================================
  if (Array.isArray(options.nanoEntities) && options.nanoEntities.length > 0) {
    // Only accept items that literally exist in the text (anti-hallucination)
    for (const ent of options.nanoEntities) {
      if (!ent.text || typeof ent.text !== 'string' || ent.text.trim().length < 2) continue;
      const target = ent.text.trim();
      let searchIdx = 0;
      while ((searchIdx = text.indexOf(target, searchIdx)) !== -1) {
        const start = searchIdx;
        const end = start + target.length;
        searchIdx = end;

        if (isRangeClaimed(start, end)) continue;

        const kind = ent.kind === 'address' ? 'address' : 'name';
        claimRange(start, end);
        findings.push({
          type: kind,
          start,
          end,
          value: text.substring(start, end),
          normalisedKey: target.toLowerCase(),
          reason: `On-device Gemini Nano detected ${kind}`,
          flags: { nano: true }
        });
      }
    }
  }

  // Sort findings in chronological order of appearance in source text
  findings.sort((a, b) => a.start - b.start);
  ignored.sort((a, b) => a.start - b.start);

  return { findings, ignored };
}

/**
 * Calculates exposure score (0-100) before and after redaction.
 * Weights: Card: 30, Aadhaar: 30, PAN: 20, Phone: 10, Email: 8, IP: 5, Name/Address/Manual: 5.
 * Repeated entities add half weight. Score capped at 100.
 * 
 * @param {Array<object>} findings 
 * @returns {{ score: number, breakdown: object }}
 */
export function calculateExposureScore(findings) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return { score: 0, breakdown: {} };
  }

  const baseWeights = {
    card: 30,
    aadhaar: 30,
    pan: 20,
    phone: 10,
    email: 8,
    ip: 5,
    name: 5,
    address: 5,
    manual: 5
  };

  const seenKeys = new Map();
  const breakdown = {};
  let totalScore = 0;

  for (const f of findings) {
    const type = f.type || 'other';
    const base = baseWeights[type] || 5;
    const key = f.normalisedKey || f.value || '';
    const occurrences = seenKeys.get(key) || 0;

    // First occurrence gets full weight, repeats get half weight
    const weight = occurrences === 0 ? base : Math.round(base * 0.5);
    seenKeys.set(key, occurrences + 1);

    totalScore += weight;
    breakdown[type] = (breakdown[type] || 0) + 1;
  }

  return {
    score: Math.min(100, Math.round(totalScore)),
    breakdown
  };
}

/**
 * Creates partial mask representation of sensitive value.
 * @param {object} finding 
 * @returns {string}
 */
export function createPartialMask(finding) {
  const { type, value } = finding;
  if (!value) return '[REDACTED]';

  switch (type) {
    case 'card': {
      // Keep last 4 digits, preserve separators if present
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      if (value.includes('-')) {
        const parts = value.split('-');
        return parts.map((p, idx) => idx === parts.length - 1 ? last4 : 'X'.repeat(p.length)).join('-');
      } else if (value.includes(' ')) {
        const parts = value.split(' ');
        return parts.map((p, idx) => idx === parts.length - 1 ? last4 : 'X'.repeat(p.length)).join(' ');
      }
      return 'X'.repeat(Math.max(0, value.length - 4)) + last4;
    }

    case 'aadhaar': {
      // Keep last 4 digits: XXXX-XXXX-1234
      const digits = value.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      if (value.includes('-')) {
        return `XXXX-XXXX-${last4}`;
      } else if (value.includes(' ')) {
        return `XXXX XXXX ${last4}`;
      }
      return `XXXXXXXX${last4}`;
    }

    case 'pan': {
      // Format: XXXXXX234F (keep last 4 chars)
      const clean = value.trim();
      if (clean.length === 10) {
        return 'XXXXXX' + clean.slice(-4);
      }
      return 'XXXXXX' + clean.slice(-4);
    }

    case 'phone': {
      // Keep last 4 digits, keep +91 prefix if present
      const norm = normalizePhone(value);
      const last4 = norm.slice(-4);
      if (value.startsWith('+91')) {
        return `+91 XXXXX ${last4}`;
      }
      return `XXXXXX${last4}`;
    }

    case 'email': {
      // Format: a*****@domain.com
      const norm = normalizeEmail(value);
      const atIdx = norm.indexOf('@');
      if (atIdx > 1) {
        const user = norm.substring(0, atIdx);
        const domain = norm.substring(atIdx);
        return user.charAt(0) + '*'.repeat(Math.max(3, user.length - 1)) + domain;
      } else if (atIdx === 1) {
        return norm.charAt(0) + '***' + norm.substring(atIdx);
      }
      return '***@domain.com';
    }

    case 'ip': {
      // IPv4: 10.0.x.x (mask last two octets)
      if (value.includes('.')) {
        const parts = value.split('.');
        if (parts.length === 4) {
          return `${parts[0]}.${parts[1]}.x.x`;
        }
      }
      // IPv6: mask host bits
      return value.slice(0, Math.min(9, value.length)) + ':xxxx:xxxx';
    }

    default:
      return value.length > 4 ? value.substring(0, 1) + '***' + value.slice(-1) : '[REDACTED]';
  }
}

/**
 * Redacts text based on chosen mode: 'full' | 'partial' | 'pseudonym'.
 * Supports let-through keys (values that the user explicitly chose not to redact).
 * 
 * @param {string} text 
 * @param {Array<object>} findings 
 * @param {'full'|'partial'|'pseudonym'} mode 
 * @param {object} options { letThroughKeys: Set<string>, columnPrefixMap: object }
 * @returns {{ safeText: string, pseudonymMap: object, reverseMap: object }}
 */
export function redactText(text, findings, mode = 'pseudonym', options = {}) {
  if (!text || typeof text !== 'string') {
    return { safeText: '', pseudonymMap: {}, reverseMap: {} };
  }

  const letThroughKeys = options.letThroughKeys || new Set();
  const pseudonymMap = {}; // normalisedKey -> nickname
  const reverseMap = {};   // nickname -> originalValue
  const typeCounters = {
    user: 0,
    phone: 0,
    card: 0,
    aadhaar: 0,
    pan: 0,
    ip: 0,
    name: 0,
    address: 0,
    manual: 0
  };

  const typePrefixes = {
    email: 'USER',
    phone: 'PHONE',
    card: 'CARD',
    aadhaar: 'AADHAAR',
    pan: 'PAN',
    ip: 'IP',
    name: 'NAME',
    address: 'ADDRESS',
    manual: 'MANUAL'
  };

  // Filter out any finding whose normalisedKey is let through
  const activeFindings = findings.filter(f => !letThroughKeys.has(f.normalisedKey) && !letThroughKeys.has(f.value));

  // Build consistent pseudonym mapping in order of first appearance
  for (const f of activeFindings) {
    const key = f.normalisedKey || f.value;
    if (!pseudonymMap[key]) {
      const typeKey = f.type.toLowerCase();
      const prefix = typePrefixes[typeKey] || 'ENTITY';
      typeCounters[typeKey] = (typeCounters[typeKey] || 0) + 1;
      const countStr = String(typeCounters[typeKey]).padStart(2, '0');
      const nickname = `${prefix}_${countStr}`;
      pseudonymMap[key] = nickname;
      reverseMap[nickname] = f.value;
    }
  }

  // Build the safe text by replacing characters from left to right
  let result = '';
  let lastIndex = 0;

  for (const f of activeFindings) {
    if (f.start < lastIndex) {
      // Overlapping finding (already handled), skip
      continue;
    }

    result += text.substring(lastIndex, f.start);

    let replacement = '';
    if (mode === 'full') {
      replacement = '[REDACTED]';
    } else if (mode === 'partial') {
      replacement = createPartialMask(f);
    } else {
      // pseudonym
      const key = f.normalisedKey || f.value;
      replacement = pseudonymMap[key] || '[REDACTED]';
    }

    result += replacement;
    lastIndex = f.end;
  }

  result += text.substring(lastIndex);

  return {
    safeText: result,
    pseudonymMap,
    reverseMap
  };
}

/**
 * Restores original values into safeText using the reverseMap.
 * @param {string} safeText 
 * @param {object} reverseMap { NICKNAME: originalValue }
 * @returns {string}
 */
export function restoreText(safeText, reverseMap) {
  if (!safeText || !reverseMap) return safeText || '';
  let restored = safeText;
  // Sort nicknames by length descending so longer tokens match first
  const keys = Object.keys(reverseMap).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const orig = reverseMap[key];
    if (orig !== undefined) {
      restored = restored.split(key).join(orig);
    }
  }
  return restored;
}

/**
 * Parses CSV text taking into account quotes, escaped quotes (""), commas, and \r\n.
 * Returns table structure and character offsets.
 * 
 * @param {string} csvText 
 * @returns {{ headers: Array<string>, rows: Array<Array<string>>, isCSV: boolean }}
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], isCSV: false };
  }

  const lines = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;
  const n = csvText.length;

  while (i < n) {
    const c = csvText.charAt(i);

    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && csvText.charAt(i + 1) === '"') {
          // Escaped quote
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // End quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (c === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (c === '\r') {
        if (i + 1 < n && csvText.charAt(i + 1) === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        currentCell = '';
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else if (c === '\n') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentCell += c;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    lines.push(currentRow);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], isCSV: false };
  }

  const headers = lines[0];
  const rows = lines.slice(1).filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));

  return {
    headers,
    rows,
    isCSV: headers.length > 1 && rows.length > 0
  };
}

/**
 * Re-serializes a 2D array of cells back into compliant CSV.
 * @param {Array<string>} headers 
 * @param {Array<Array<string>>} rows 
 * @returns {string}
 */
export function formatCSV(headers, rows) {
  function escapeCell(val) {
    const str = String(val === undefined || val === null ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const out = [];
  out.push(headers.map(escapeCell).join(','));
  for (const row of rows) {
    out.push(row.map(escapeCell).join(','));
  }
  return out.join('\r\n');
}

/**
 * Hides an entire column in a CSV dataset by masking each cell with header-based pseudonym or [REDACTED].
 * Keeps CSV structure strictly valid.
 * 
 * @param {string} csvText 
 * @param {number} colIndex 
 * @param {'full'|'partial'|'pseudonym'} mode 
 * @returns {string}
 */
export function hideCSVColumn(csvText, colIndex, mode = 'pseudonym') {
  const parsed = parseCSV(csvText);
  if (!parsed.isCSV || colIndex < 0 || colIndex >= parsed.headers.length) {
    return csvText;
  }

  const colHeader = parsed.headers[colIndex].trim().toUpperCase().replace(/[^A-Z0-9]/g, '_') || 'COL';
  const newRows = parsed.rows.map((row, rIdx) => {
    const copy = [...row];
    if (colIndex < copy.length) {
      if (mode === 'full') {
        copy[colIndex] = '[REDACTED]';
      } else if (mode === 'partial') {
        const val = copy[colIndex];
        copy[colIndex] = val.length > 2 ? val.charAt(0) + '***' : '***';
      } else {
        const num = String(rIdx + 1).padStart(2, '0');
        copy[colIndex] = `${colHeader}_${num}`;
      }
    }
    return copy;
  });

  return formatCSV(parsed.headers, newRows);
}

/**
 * Validates on-device Gemini Nano entity extraction output against source text (Anti-hallucination).
 * Only returns entities that literally exist within sourceText.
 * 
 * @param {Array<object>} rawEntities 
 * @param {string} sourceText 
 * @returns {Array<object>}
 */
export function validateNanoEntities(rawEntities, sourceText) {
  if (!Array.isArray(rawEntities) || !sourceText) return [];
  const valid = [];
  for (const item of rawEntities) {
    if (item && typeof item.text === 'string' && item.text.trim().length > 1) {
      const trimmed = item.text.trim();
      if (sourceText.includes(trimmed)) {
        valid.push({
          text: trimmed,
          kind: item.kind === 'address' ? 'address' : 'name'
        });
      }
    }
  }
  return valid;
}

/**
 * Computes SHA-256 fingerprint of string using Web Crypto or Node crypto.
 * @param {string} text 
 * @param {object} [subtle] Optional crypto.subtle instance
 * @returns {Promise<string>}
 */
export async function computeSHA256(text, subtle) {
  const enc = new TextEncoder().encode(text || '');
  const cryptoAPI = subtle || (typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto.subtle : null);

  if (cryptoAPI && typeof cryptoAPI.digest === 'function') {
    const hashBuffer = await cryptoAPI.digest('SHA-256', enc);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for Node.js if subtle not directly passed
  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(text || '').digest('hex');
  } catch (e) {
    return 'unavailable';
  }
}

/**
 * Encrypts nickname-to-original map using AES-256-GCM derived via PBKDF2 (250,000 iterations).
 * 
 * @param {object} map 
 * @param {string} password 
 * @param {object} [subtle] 
 * @returns {Promise<object>} JSON-serializable encrypted bundle
 */
export async function encryptKeyMap(map, password, subtle) {
  const cryptoAPI = subtle || (typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto.subtle : null);
  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : (await import('node:crypto')).webcrypto;
  const activeSubtle = cryptoAPI || cryptoObj.subtle;

  const enc = new TextEncoder();
  const salt = new Uint8Array(16);
  cryptoObj.getRandomValues(salt);

  const iv = new Uint8Array(12);
  cryptoObj.getRandomValues(iv);

  const passwordKey = await activeSubtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await activeSubtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const payload = JSON.stringify(map);
  const ciphertextBuffer = await activeSubtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    aesKey,
    enc.encode(payload)
  );

  function toBase64(u8) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(u8).toString('base64');
    }
    let binary = '';
    for (let i = 0; i < u8.length; i++) {
      binary += String.fromCharCode(u8[i]);
    }
    return btoa(binary);
  }

  return {
    tool: 'NEWNAME',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    iterations: 250000,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer))
  };
}

/**
 * Decrypts encrypted key map bundle using AES-256-GCM.
 * 
 * @param {object} bundle 
 * @param {string} password 
 * @param {object} [subtle] 
 * @returns {Promise<object>} Restored map
 */
export async function decryptKeyMap(bundle, password, subtle) {
  if (!bundle || !bundle.salt || !bundle.iv || !bundle.ciphertext) {
    throw new Error('Invalid key file format.');
  }

  const cryptoObj = (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto : (await import('node:crypto')).webcrypto;
  const activeSubtle = subtle || cryptoObj.subtle;

  function fromBase64(str) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(str, 'base64'));
    }
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const salt = fromBase64(bundle.salt);
  const iv = fromBase64(bundle.iv);
  const ciphertext = fromBase64(bundle.ciphertext);

  const enc = new TextEncoder();
  const passwordKey = await activeSubtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await activeSubtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: bundle.iterations || 250000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const decryptedBuffer = await activeSubtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      aesKey,
      ciphertext
    );
    const dec = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(dec);
  } catch (err) {
    throw new Error('Incorrect password or corrupted key file.');
  }
}

/**
 * Generates audit report without containing any raw sensitive values.
 * 
 * @param {object} params 
 * @returns {object} Audit report JSON
 */
export function generateAuditReport(params) {
  const {
    originalLength = 0,
    safeTextLength = 0,
    findings = [],
    ignored = [],
    mode = 'pseudonym',
    hiddenColumns = [],
    exposureBefore = 0,
    exposureAfter = 0,
    safeHash = ''
  } = params;

  const countsByType = {};
  for (const f of findings) {
    countsByType[f.type] = (countsByType[f.type] || 0) + 1;
  }

  const ignoredReasons = ignored.map(i => ({
    type: i.type,
    reason: i.reason
  }));

  return {
    tool: 'NEWNAME',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sanitisationMode: mode,
    metrics: {
      originalCharacters: originalLength,
      safeCharacters: safeTextLength,
      totalEntitiesDetected: findings.length,
      entityCountsByType: countsByType,
      exposureScoreBefore: exposureBefore,
      exposureScoreAfter: exposureAfter
    },
    hiddenColumns,
    setAsideDecoys: ignoredReasons,
    integrityFingerprintSHA256: safeHash,
    complianceNotice: '100% Client-side execution. Zero user data transmitted to any external server.'
  };
}
