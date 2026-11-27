/**
 * @file app.js
 * @description Main frontend application controller for NEWNAME.
 * Handles DOM events, UI state, rendering, Web Crypto key locking, and Google AI services.
 * Pure ES module, strict security compliance (no inline scripts, no eval, no telemetry).
 */

'use strict';

import {
  detectPII,
  calculateExposureScore,
  redactText,
  restoreText,
  parseCSV,
  hideCSVColumn,
  encryptKeyMap,
  decryptKeyMap,
  generateAuditReport,
  computeSHA256
} from './engine.js';
import { SAMPLE_CSV, SAMPLE_TXT } from './samples.js';
import {
  checkGeminiNanoAvailability,
  extractEntitiesWithNano,
  detectDocumentLanguage,
  generateSyntheticData
} from './gemini.js';

/**
 * Application State
 */
const state = {
  rawText: '',
  fileName: 'placement_shortlist.csv',
  isCSV: true,
  mode: 'pseudonym', // 'full' | 'partial' | 'pseudonym'
  activeFilters: new Set(['email', 'phone', 'card', 'aadhaar', 'pan', 'ip', 'name', 'address', 'manual']),
  manualEntries: [],
  letThroughKeys: new Set(),
  nanoEntities: [],
  hiddenColumns: [],
  findings: [],
  ignored: [],
  safeText: '',
  pseudonymMap: {},
  reverseMap: {},
  selectedFinding: null,
  isEditing: false
};

// DOM References
const originalDisplay = document.getElementById('original-display');
const originalEditWrapper = document.getElementById('original-edit-wrapper');
const originalTextarea = document.getElementById('original-textarea');
const safeDisplay = document.getElementById('safe-display');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const btnClearManual = document.getElementById('btn-clear-manual');
const btnCopySafe = document.getElementById('btn-copy-safe');
const sealOriginal = document.getElementById('seal-original');
const sealSafe = document.getElementById('seal-safe');
const scoreVal = document.getElementById('score-val');
const scoreMeterBar = document.getElementById('score-meter-bar');
const scoreSummary = document.getElementById('score-summary');
const findingsList = document.getElementById('findings-list');
const ignoredList = document.getElementById('ignored-list');
const csvColumnsPanel = document.getElementById('csv-columns-panel');
const csvColumnsList = document.getElementById('csv-columns-list');
const safeHashDisplay = document.getElementById('safe-hash-display');
const btnDownloadSafe = document.getElementById('btn-download-safe');
const btnDownloadAudit = document.getElementById('btn-download-audit');
const marginNote = document.getElementById('margin-note');
const btnCloseMargin = document.getElementById('btn-close-margin');
const btnLetThrough = document.getElementById('btn-let-through');
const btnReRedact = document.getElementById('btn-re-redact');
const btnRemoveManual = document.getElementById('btn-remove-manual');
const selectionTooltip = document.getElementById('selection-tooltip');
const fileUpload = document.getElementById('file-upload');
const btnLoadCSV = document.getElementById('btn-load-csv');
const btnLoadTXT = document.getElementById('btn-load-txt');
const themeToggle = document.getElementById('theme-toggle');
const privacyPill = document.getElementById('privacy-pill');
const privacyStatusText = document.getElementById('privacy-status-text');
const languagePill = document.getElementById('language-pill');
const languageText = document.getElementById('language-text');
const nanoStatus = document.getElementById('nano-status');
const btnRunNano = document.getElementById('btn-run-nano');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const btnGenCSV = document.getElementById('btn-gen-csv');
const btnGenTicket = document.getElementById('btn-gen-ticket');
const geminiApiStatus = document.getElementById('gemini-api-status');
const lockPasswordInput = document.getElementById('lock-password');
const btnLockKey = document.getElementById('btn-lock-key');
const lockStatus = document.getElementById('lock-status');
const restoreKeyFileInput = document.getElementById('restore-key-file');
const restorePasswordInput = document.getElementById('restore-password');
const btnRestoreAction = document.getElementById('btn-restore-action');
const restoreStatus = document.getElementById('restore-status');

// Mode segmented buttons
const modeFullBtn = document.getElementById('mode-full');
const modePartialBtn = document.getElementById('mode-partial');
const modePseudonymBtn = document.getElementById('mode-pseudonym');

/**
 * Escapes HTML characters for safe rendering.
 * @param {string} str 
 * @returns {string}
 */
function escapeHTML(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Debounce helper (~120ms for live input typing).
 */
function debounce(fn, ms = 120) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Runs complete PII detection, redaction, exposure scoring, and updates all views.
 */
async function processDocument() {
  const text = state.rawText;
  if (!text) {
    originalDisplay.textContent = 'No document loaded. Paste or load text above.';
    safeDisplay.textContent = 'Waiting for input...';
    sealOriginal.textContent = 'NO DATA';
    sealSafe.textContent = 'NO DATA';
    scoreVal.textContent = '0';
    scoreMeterBar.style.width = '0%';
    findingsList.innerHTML = '';
    ignoredList.innerHTML = '';
    csvColumnsPanel.classList.add('hidden');
    safeHashDisplay.textContent = 'n/a';
    return;
  }

  // 1. Detect PII entities and ignored candidates
  const detectionResult = detectPII(text, {
    manualEntries: state.manualEntries,
    nanoEntities: state.nanoEntities
  });

  // Filter findings according to active filter chips
  state.findings = detectionResult.findings.filter(f => state.activeFilters.has(f.type));
  state.ignored = detectionResult.ignored;

  // 2. Perform Redaction
  const redactionResult = redactText(text, state.findings, state.mode, {
    letThroughKeys: state.letThroughKeys
  });

  state.safeText = redactionResult.safeText;
  state.pseudonymMap = redactionResult.pseudonymMap;
  state.reverseMap = redactionResult.reverseMap;

  // 3. Compute Exposure Scores
  const scoreBefore = calculateExposureScore(state.findings);
  const activeUnmaskedFindings = state.findings.filter(f => state.letThroughKeys.has(f.normalisedKey) || state.letThroughKeys.has(f.value));
  const scoreAfter = calculateExposureScore(activeUnmaskedFindings);

  // 4. Update CSV column hide panel if CSV
  const csvCheck = parseCSV(text);
  state.isCSV = csvCheck.isCSV;
  if (state.isCSV) {
    csvColumnsPanel.classList.remove('hidden');
    renderCSVColumns(csvCheck.headers);
  } else {
    csvColumnsPanel.classList.add('hidden');
  }

  // 5. Render UI Views
  renderOriginalHighlights();
  renderSafeDisplay();
  renderExposureMetrics(scoreBefore.score, scoreAfter.score, state.findings.length);
  renderFindingsBreakdown(scoreBefore.breakdown);
  renderIgnoredDecoys();

  // 6. Compute SHA-256 hash of safe text
  const hash = await computeSHA256(state.safeText);
  safeHashDisplay.textContent = hash;

  // 7. Detect document language asynchronously
  detectLanguageDebounced(text);
}

const debouncedProcess = debounce(processDocument, 120);

/**
 * Renders the highlighted original document view.
 */
function renderOriginalHighlights() {
  const text = state.rawText;
  if (!text) {
    originalDisplay.innerHTML = '';
    return;
  }

  const fragments = [];
  let lastIdx = 0;

  for (let idx = 0; idx < state.findings.length; idx++) {
    const f = state.findings[idx];
    if (f.start < lastIdx) continue; // Skip overlaps

    // Un-highlighted text before finding
    fragments.push(escapeHTML(text.substring(lastIdx, f.start)));

    // Highlight mark
    const isLetThrough = state.letThroughKeys.has(f.normalisedKey) || state.letThroughKeys.has(f.value);
    const hlClass = isLetThrough ? 'hl-mark hl-let-through' : `hl-mark hl-${f.type}`;
    const escapedVal = escapeHTML(text.substring(f.start, f.end));

    fragments.push(
      `<span class="${hlClass}" data-finding-idx="${idx}" role="button" tabindex="0" aria-label="${f.type}: ${escapedVal}">${escapedVal}</span>`
    );

    lastIdx = f.end;
  }

  fragments.push(escapeHTML(text.substring(lastIdx)));
  originalDisplay.innerHTML = fragments.join('');

  // Attach click & keyboard listeners to highlight spans
  const marks = originalDisplay.querySelectorAll('.hl-mark');
  marks.forEach(mark => {
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      const fIdx = parseInt(mark.getAttribute('data-finding-idx'), 10);
      openMarginNote(fIdx, mark);
    });

    mark.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const fIdx = parseInt(mark.getAttribute('data-finding-idx'), 10);
        openMarginNote(fIdx, mark);
      }
    });
  });
}

/**
 * Renders the safe copy display.
 */
function renderSafeDisplay() {
  safeDisplay.textContent = state.safeText;
}

/**
 * Renders exposure score meter and verdict seals.
 */
function renderExposureMetrics(before, after, totalEntities) {
  scoreVal.textContent = String(before);
  scoreMeterBar.style.width = `${before}%`;

  if (before > 50) {
    scoreVal.className = 'score-number';
    scoreMeterBar.className = 'score-meter-fill';
    scoreSummary.textContent = `High privacy risk (${before}/100). ${totalEntities} sensitive entities detected.`;
  } else if (before > 0) {
    scoreVal.className = 'score-number';
    scoreMeterBar.className = 'score-meter-fill';
    scoreSummary.textContent = `Moderate risk (${before}/100). Sanitisation recommended.`;
  } else {
    scoreVal.className = 'score-number safe';
    scoreMeterBar.className = 'score-meter-fill safe';
    scoreSummary.textContent = 'Safe to share. Zero private entities remaining.';
  }

  // Update Seals
  if (totalEntities > 0) {
    sealOriginal.textContent = `NOT SAFE TO SHARE · ${totalEntities} private items`;
    sealOriginal.className = 'ink-seal ink-seal-danger';
  } else {
    sealOriginal.textContent = 'CLEARED · 0 private items';
    sealOriginal.className = 'ink-seal ink-seal-clear';
  }

  if (after === 0) {
    const today = new Date().toISOString().split('T')[0];
    sealSafe.textContent = `CLEARED FOR SHARING · ${today}`;
    sealSafe.className = 'ink-seal ink-seal-clear';
  } else {
    sealSafe.textContent = `PARTIAL MASK · ${after} RISK REMAINING`;
    sealSafe.className = 'ink-seal ink-seal-danger';
  }
}

/**
 * Renders breakdown list of detected entity counts.
 */
function renderFindingsBreakdown(breakdown) {
  findingsList.innerHTML = '';
  const entries = Object.entries(breakdown);
  if (entries.length === 0) {
    findingsList.innerHTML = '<li class="findings-row"><span>No sensitive entities detected.</span></li>';
    return;
  }

  for (const [type, count] of entries) {
    const li = document.createElement('li');
    li.className = 'findings-row';
    li.innerHTML = `
      <span class="findings-label">
        <span class="swatch swatch-${type}"></span>
        ${type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
      <span class="findings-count">${count}</span>
    `;
    findingsList.appendChild(li);
  }
}

/**
 * Renders decoys / candidate traps set aside with human reasons.
 */
function renderIgnoredDecoys() {
  ignoredList.innerHTML = '';
  if (state.ignored.length === 0) {
    ignoredList.innerHTML = '<li class="ignored-item">No decoy candidates detected.</li>';
    return;
  }

  for (const item of state.ignored) {
    const li = document.createElement('li');
    li.className = 'ignored-item';
    li.innerHTML = `
      <div><span class="strikethrough-val">${escapeHTML(item.value)}</span></div>
      <div>${escapeHTML(item.reason)}</div>
    `;
    ignoredList.appendChild(li);
  }
}

/**
 * Renders CSV column hide buttons.
 */
function renderCSVColumns(headers) {
  csvColumnsList.innerHTML = '';
  headers.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'col-hide-row';
    const isHidden = state.hiddenColumns.includes(h);

    row.innerHTML = `
      <span><strong>${escapeHTML(h)}</strong></span>
      <button class="btn-small-hide" data-col-idx="${idx}" type="button">
        ${isHidden ? 'Redacted' : 'Hide column'}
      </button>
    `;

    const btn = row.querySelector('button');
    btn.addEventListener('click', () => {
      const updatedCSV = hideCSVColumn(state.rawText, idx, state.mode);
      if (!state.hiddenColumns.includes(h)) {
        state.hiddenColumns.push(h);
      }
      state.rawText = updatedCSV;
      originalTextarea.value = updatedCSV;
      processDocument();
    });

    csvColumnsList.appendChild(row);
  });
}

/**
 * Opens margin note card next to clicked highlight.
 */
function openMarginNote(findingIdx, markElement) {
  const f = state.findings[findingIdx];
  if (!f) return;

  state.selectedFinding = f;
  document.getElementById('margin-type').textContent = f.type.toUpperCase();
  document.getElementById('margin-val').textContent = f.value;
  document.getElementById('margin-reason').textContent = f.reason;

  const flagContainer = document.getElementById('margin-flag-container');
  flagContainer.innerHTML = '';
  if (f.flags) {
    if (f.flags.devanagari) {
      flagContainer.innerHTML += '<div class="margin-card-flag">Written in Devanagari digits, caught anyway</div>';
    }
    if (f.flags.spaced) {
      flagContainer.innerHTML += '<div class="margin-card-flag">Spaced digits format, normalized</div>';
    }
    if (f.flags.disguised) {
      flagContainer.innerHTML += '<div class="margin-card-flag">Disguised syntax, de-obfuscated</div>';
    }
    if (f.flags.brand) {
      flagContainer.innerHTML += `<div class="margin-card-flag">Card Brand: ${f.flags.brand}</div>`;
    }
  }

  // Count appearances of this entity
  const count = state.findings.filter(item => item.normalisedKey === f.normalisedKey).length;
  document.getElementById('margin-count').textContent = String(count);

  // Replacement preview
  const key = f.normalisedKey || f.value;
  let rep = '[REDACTED]';
  if (state.mode === 'pseudonym') {
    rep = state.pseudonymMap[key] || '[REDACTED]';
  }
  document.getElementById('margin-replacement').textContent = rep;

  // Let through state
  const isLetThrough = state.letThroughKeys.has(f.normalisedKey) || state.letThroughKeys.has(f.value);
  if (isLetThrough) {
    btnLetThrough.classList.add('hidden');
    btnReRedact.classList.remove('hidden');
  } else {
    btnLetThrough.classList.remove('hidden');
    btnReRedact.classList.add('hidden');
  }

  if (f.type === 'manual') {
    btnRemoveManual.classList.remove('hidden');
  } else {
    btnRemoveManual.classList.add('hidden');
  }

  // Position card near mark element
  const rect = markElement.getBoundingClientRect();
  const parentRect = originalDisplay.getBoundingClientRect();

  marginNote.style.top = `${Math.max(10, rect.top - parentRect.top + originalDisplay.scrollTop - 20)}px`;
  marginNote.style.left = `${Math.min(parentRect.width - 310, Math.max(10, rect.left - parentRect.left))}px`;
  marginNote.classList.remove('hidden');
}

function closeMarginNote() {
  marginNote.classList.add('hidden');
  state.selectedFinding = null;
}

/**
 * Detects document language via Chrome Translation API.
 */
const detectLanguageDebounced = debounce(async (text) => {
  try {
    const lang = await detectDocumentLanguage(text);
    if (lang) {
      languageText.textContent = `Lang: ${lang.toUpperCase()}`;
      languagePill.classList.remove('hidden');
    } else {
      languagePill.classList.add('hidden');
    }
  } catch (e) {
    languagePill.classList.add('hidden');
  }
}, 500);

/**
 * Downloads a text or JSON file to the user's local disk.
 */
function downloadFile(content, fileName, contentType = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Sets active redaction mode ('full' | 'partial' | 'pseudonym').
 */
function setRedactionMode(newMode) {
  state.mode = newMode;
  modeFullBtn.classList.toggle('active', newMode === 'full');
  modePartialBtn.classList.toggle('active', newMode === 'partial');
  modePseudonymBtn.classList.toggle('active', newMode === 'pseudonym');

  modeFullBtn.setAttribute('aria-checked', String(newMode === 'full'));
  modePartialBtn.setAttribute('aria-checked', String(newMode === 'partial'));
  modePseudonymBtn.setAttribute('aria-checked', String(newMode === 'pseudonym'));

  processDocument();
}

/**
 * Loads text document into application state.
 */
function loadDocument(text, fileName) {
  state.rawText = text;
  state.fileName = fileName;
  state.letThroughKeys.clear();
  state.manualEntries = [];
  state.nanoEntities = [];
  state.hiddenColumns = [];
  originalTextarea.value = text;
  processDocument();
}

/**
 * Synchronizes scrolling between original and safe copy sheets.
 */
let isSyncingScroll = false;
function syncScroll(source, target) {
  if (isSyncingScroll) return;
  isSyncingScroll = true;
  target.scrollTop = source.scrollTop;
  target.scrollLeft = source.scrollLeft;
  requestAnimationFrame(() => {
    isSyncingScroll = false;
  });
}

/**
 * Initializes all event listeners and UI bindings.
 */
function initEventListeners() {
  // Mode selection buttons
  modeFullBtn.addEventListener('click', () => setRedactionMode('full'));
  modePartialBtn.addEventListener('click', () => setRedactionMode('partial'));
  modePseudonymBtn.addEventListener('click', () => setRedactionMode('pseudonym'));

  // Load Built-in Samples
  btnLoadCSV.addEventListener('click', () => {
    loadDocument(SAMPLE_CSV, 'placement_shortlist.csv');
  });

  btnLoadTXT.addEventListener('click', () => {
    loadDocument(SAMPLE_TXT, 'support_ticket.txt');
  });

  // Open Local File (.txt / .csv)
  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5 MB limit. Please select a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      loadDocument(evt.target.result, file.name);
    };
    reader.readAsText(file);
  });

  // Filter Chips Toggle
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      if (state.activeFilters.has(filter)) {
        state.activeFilters.delete(filter);
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        state.activeFilters.add(filter);
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      }
      processDocument();
    });
  });

  // Toggle Edit Raw Text
  btnToggleEdit.addEventListener('click', () => {
    state.isEditing = !state.isEditing;
    if (state.isEditing) {
      btnToggleEdit.textContent = 'View highlights';
      originalDisplay.classList.add('hidden');
      originalEditWrapper.classList.remove('hidden');
      originalTextarea.focus();
    } else {
      btnToggleEdit.textContent = 'Edit text';
      originalEditWrapper.classList.add('hidden');
      originalDisplay.classList.remove('hidden');
    }
  });

  // Live Typing in Textarea
  originalTextarea.addEventListener('input', (e) => {
    state.rawText = e.target.value;
    debouncedProcess();
  });

  // Clear Manual Redactions
  btnClearManual.addEventListener('click', () => {
    state.manualEntries = [];
    processDocument();
  });

  // Copy Safe Text
  btnCopySafe.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.safeText);
      const prev = btnCopySafe.textContent;
      btnCopySafe.textContent = 'Copied!';
      setTimeout(() => {
        btnCopySafe.textContent = prev;
      }, 1500);
    } catch (err) {
      alert('Unable to copy to clipboard.');
    }
  });

  // Synced Scrolling
  originalDisplay.addEventListener('scroll', () => syncScroll(originalDisplay, safeDisplay));
  safeDisplay.addEventListener('scroll', () => syncScroll(safeDisplay, originalDisplay));

  // Margin Note Actions
  btnCloseMargin.addEventListener('click', closeMarginNote);

  btnLetThrough.addEventListener('click', () => {
    if (!state.selectedFinding) return;
    const key = state.selectedFinding.normalisedKey || state.selectedFinding.value;
    state.letThroughKeys.add(key);
    closeMarginNote();
    processDocument();
  });

  btnReRedact.addEventListener('click', () => {
    if (!state.selectedFinding) return;
    const key = state.selectedFinding.normalisedKey || state.selectedFinding.value;
    state.letThroughKeys.delete(key);
    closeMarginNote();
    processDocument();
  });

  btnRemoveManual.addEventListener('click', () => {
    if (!state.selectedFinding) return;
    state.manualEntries = state.manualEntries.filter(m => m !== state.selectedFinding.value);
    closeMarginNote();
    processDocument();
  });

  // Close margin note on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMarginNote();
      selectionTooltip.classList.add('hidden');
    }
  });

  // Manual Selection Redaction ("Black this out too")
  originalDisplay.addEventListener('mouseup', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      selectionTooltip.classList.add('hidden');
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length > 1) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      selectionTooltip.style.top = `${rect.top - 36 + window.scrollY}px`;
      selectionTooltip.style.left = `${rect.left + (rect.width / 2) - 50 + window.scrollX}px`;
      selectionTooltip.classList.remove('hidden');

      selectionTooltip.onclick = () => {
        if (!state.manualEntries.includes(selectedText)) {
          state.manualEntries.push(selectedText);
          selectionTooltip.classList.add('hidden');
          sel.removeAllRanges();
          processDocument();
        }
      };
    } else {
      selectionTooltip.classList.add('hidden');
    }
  });

  // Download Safe Copy
  btnDownloadSafe.addEventListener('click', () => {
    const ext = state.isCSV ? 'csv' : 'txt';
    const base = state.fileName.replace(/\.[^/.]+$/, '');
    downloadFile(state.safeText, `${base}_sanitised.${ext}`, state.isCSV ? 'text/csv' : 'text/plain');
  });

  // Download Audit Report
  btnDownloadAudit.addEventListener('click', async () => {
    const hash = await computeSHA256(state.safeText);
    const scoreBefore = calculateExposureScore(state.findings);
    const activeUnmasked = state.findings.filter(f => state.letThroughKeys.has(f.normalisedKey) || state.letThroughKeys.has(f.value));
    const scoreAfter = calculateExposureScore(activeUnmasked);

    const report = generateAuditReport({
      originalLength: state.rawText.length,
      safeTextLength: state.safeText.length,
      findings: state.findings,
      ignored: state.ignored,
      mode: state.mode,
      hiddenColumns: state.hiddenColumns,
      exposureBefore: scoreBefore.score,
      exposureAfter: scoreAfter.score,
      safeHash: hash
    });

    downloadFile(JSON.stringify(report, null, 2), 'NEWNAME_audit_report.json', 'application/json');
  });

  // Lock Key (AES-256-GCM Encrypt & Download .newname-key)
  btnLockKey.addEventListener('click', async () => {
    const pass = lockPasswordInput.value.trim();
    if (!pass) {
      lockStatus.textContent = 'Please enter a master password to encrypt your key map.';
      return;
    }

    try {
      lockStatus.textContent = 'Deriving PBKDF2 key (250,000 iterations)...';
      const bundle = await encryptKeyMap(state.reverseMap, pass);
      const base = state.fileName.replace(/\.[^/.]+$/, '');
      downloadFile(JSON.stringify(bundle, null, 2), `${base}.newname-key`, 'application/json');
      lockStatus.textContent = 'Key file downloaded successfully (.newname-key). Store it safely!';
      lockPasswordInput.value = '';
    } catch (err) {
      lockStatus.textContent = `Encryption error: ${err.message}`;
    }
  });

  // Restore Key (AES-256-GCM Decrypt & Re-populate Originals)
  btnRestoreAction.addEventListener('click', async () => {
    const file = restoreKeyFileInput.files?.[0];
    const pass = restorePasswordInput.value.trim();
    if (!file || !pass) {
      restoreStatus.textContent = 'Please select a key file and enter the password.';
      return;
    }

    try {
      restoreStatus.textContent = 'Decrypting key file...';
      const fileText = await file.text();
      const bundle = JSON.parse(fileText);
      const restoredReverseMap = await decryptKeyMap(bundle, pass);

      // Restore original text from current safeText
      const restored = restoreText(state.safeText, restoredReverseMap);
      loadDocument(restored, 'restored_document.txt');
      restoreStatus.textContent = 'Original document values successfully restored!';
      restorePasswordInput.value = '';
      restoreKeyFileInput.value = '';
    } catch (err) {
      restoreStatus.textContent = `Restoration failed: ${err.message}`;
    }
  });

  // Theme Toggle
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
  });

  // Offline / Online Status
  function updateNetworkStatus() {
    if (navigator.onLine) {
      privacyPill.classList.remove('offline');
      privacyStatusText.textContent = 'Offline-safe · 0 bytes of your text sent';
    } else {
      privacyPill.classList.add('offline');
      privacyStatusText.textContent = 'Offline, still working · zero network access';
    }
  }
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Gemini Nano Scan
  btnRunNano.addEventListener('click', async () => {
    if (!state.rawText) {
      alert('Please load a document first.');
      return;
    }

    try {
      btnRunNano.disabled = true;
      nanoStatus.textContent = 'Scanning on-device with Gemini Nano...';
      const entities = await extractEntitiesWithNano(state.rawText, (progress) => {
        nanoStatus.textContent = `Gemini Nano progress: ${Math.round(progress.progress * 100)}% (${progress.status})`;
      });

      state.nanoEntities = entities;
      nanoStatus.textContent = `Gemini Nano extracted ${entities.length} verified on-device entities.`;
      processDocument();
    } catch (err) {
      nanoStatus.textContent = `Gemini Nano error: ${err.message}`;
    } finally {
      btnRunNano.disabled = false;
    }
  });

  // Gemini API Synthetic Data Generation
  async function handleSyntheticGen(type) {
    const key = geminiApiKeyInput.value.trim();
    if (!key) {
      geminiApiStatus.textContent = 'Please enter your Google AI Studio API key (kept in memory only).';
      return;
    }

    try {
      geminiApiStatus.textContent = 'Generating fictional test dataset via Gemini API...';
      const syntheticText = await generateSyntheticData(type, key);
      const fname = type === 'placementCSV' ? 'gemini_placement_shortlist.csv' : 'gemini_support_ticket.txt';
      loadDocument(syntheticText, fname);
      geminiApiStatus.textContent = 'Fresh synthetic test data generated and loaded!';
    } catch (err) {
      geminiApiStatus.textContent = `Generation error: ${err.message}`;
    }
  }

  btnGenCSV.addEventListener('click', () => handleSyntheticGen('placementCSV'));
  btnGenTicket.addEventListener('click', () => handleSyntheticGen('supportTicket'));

  // Drag and drop document anywhere
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds the 5 MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => loadDocument(evt.target.result, file.name);
      reader.readAsText(file);
    }
  });
}

/**
 * Checks Gemini Nano on startup.
 */
async function initNanoStatus() {
  const check = await checkGeminiNanoAvailability();
  if (check.available) {
    nanoStatus.textContent = 'Gemini Nano (Prompt API) is available on this device!';
  } else {
    nanoStatus.textContent = check.error || 'Gemini Nano built-in AI not detected (available in Chrome 128+ with flags).';
  }
}

/**
 * Bootstrap Application
 */
function initApp() {
  initEventListeners();
  initNanoStatus();

  // Load placement_shortlist.csv automatically on first open as required by problem statement
  loadDocument(SAMPLE_CSV, 'placement_shortlist.csv');
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
