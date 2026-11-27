/**
 * @file app.js
 * @description Main application controller for Andhaar.
 * Streamlined 3-step UI, tabbed audit panel, keyboard shortcuts, and zero-trust client-side processing.
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
  isEditing: false,
  hintDismissed: false
};

// Language map for human readable names
const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
  es: 'Spanish',
  fr: 'French',
  de: 'German'
};

// DOM Elements
const originalDisplay = document.getElementById('original-display');
const originalEditWrapper = document.getElementById('original-edit-wrapper');
const originalTextarea = document.getElementById('original-textarea');
const originalEmptyZone = document.getElementById('original-empty-zone');
const originalMeta = document.getElementById('original-meta');
const originalLang = document.getElementById('original-lang');
const safeDisplay = document.getElementById('safe-display');
const safeMeta = document.getElementById('safe-meta');
const btnToggleEdit = document.getElementById('btn-toggle-edit');
const btnClearManual = document.getElementById('btn-clear-manual');
const btnCopySafe = document.getElementById('btn-copy-safe');
const sealOriginal = document.getElementById('seal-original');
const sealSafe = document.getElementById('seal-safe');
const scoreVal = document.getElementById('score-val');
const scoreMeterBar = document.getElementById('score-meter-bar');
const scoreAfterLine = document.getElementById('score-after-line');
const findingsBreakdownList = document.getElementById('findings-breakdown-list');
const ignoredList = document.getElementById('ignored-list');
const tabCountSetaside = document.getElementById('tab-count-setaside');
const tabBtnColumns = document.getElementById('tab-btn-columns');
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
const btnEmptyCSV = document.getElementById('btn-empty-csv');
const btnEmptyTXT = document.getElementById('btn-empty-txt');
const themeToggle = document.getElementById('theme-toggle');
const privacyPill = document.getElementById('privacy-pill');
const privacyStatusText = document.getElementById('privacy-status-text');
const btnRunNano = document.getElementById('btn-run-nano');
const nanoSpinner = document.getElementById('nano-spinner');
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
const firstRunHint = document.getElementById('first-run-hint');
const btnDismissHint = document.getElementById('btn-dismiss-hint');
const btnShortcuts = document.getElementById('btn-shortcuts');
const shortcutsPopover = document.getElementById('shortcuts-popover');
const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');

// Mode segmented buttons & previews
const modeFullBtn = document.getElementById('mode-full');
const modePartialBtn = document.getElementById('mode-partial');
const modePseudonymBtn = document.getElementById('mode-pseudonym');
const previewFull = document.getElementById('preview-full');
const previewPartial = document.getElementById('preview-partial');
const previewPseudonym = document.getElementById('preview-pseudonym');

// Chip count elements
const countEmail = document.getElementById('count-email');
const countPhone = document.getElementById('count-phone');
const countCard = document.getElementById('count-card');
const countAadhaar = document.getElementById('count-aadhaar');
const countPan = document.getElementById('count-pan');
const countIp = document.getElementById('count-ip');
const countNano = document.getElementById('count-nano');

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
 * Debounce helper (~120ms).
 */
function debounce(fn, ms = 120) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Processes document: PII detection, redaction, exposure scoring, and UI render.
 */
async function processDocument() {
  const text = state.rawText;
  const lineCount = text ? text.split('\n').length : 0;

  // Update sheet headers metadata
  if (text) {
    originalMeta.textContent = `${state.fileName} · ${lineCount} lines`;
    safeMeta.textContent = `Sanitised for sharing · ${lineCount} lines`;
    originalEmptyZone.classList.add('hidden');
    originalDisplay.classList.remove('hidden');
  } else {
    originalMeta.textContent = 'No document loaded';
    safeMeta.textContent = 'Waiting for input';
    originalEmptyZone.classList.remove('hidden');
    originalDisplay.classList.add('hidden');
    safeDisplay.textContent = 'Waiting for input...';
    sealOriginal.textContent = 'NO DATA';
    sealSafe.textContent = 'NO DATA';
    scoreVal.textContent = '0';
    scoreMeterBar.style.width = '0%';
    scoreAfterLine.textContent = 'Safe to share. Zero private items.';
    findingsBreakdownList.innerHTML = '<li class="stats-row"><span>No data loaded.</span></li>';
    ignoredList.innerHTML = '<li class="ignored-item">No decoy candidates detected.</li>';
    tabCountSetaside.textContent = '0';
    tabBtnColumns.classList.add('hidden');
    safeHashDisplay.textContent = 'n/a';
    updateChipCounts({});
    return;
  }

  // 1. Detect PII entities & decoys
  const detectionResult = detectPII(text, {
    manualEntries: state.manualEntries,
    nanoEntities: state.nanoEntities
  });

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

  // 4. Update CSV column tab if CSV
  const csvCheck = parseCSV(text);
  state.isCSV = csvCheck.isCSV;
  if (state.isCSV) {
    tabBtnColumns.classList.remove('hidden');
    renderCSVColumns(csvCheck.headers);
  } else {
    tabBtnColumns.classList.add('hidden');
  }

  // 5. Update "Clear manual marks" button visibility
  if (state.manualEntries.length > 0) {
    btnClearManual.classList.remove('hidden');
  } else {
    btnClearManual.classList.add('hidden');
  }

  // 6. Render UI
  renderOriginalHighlights();
  renderSafeDisplay();
  renderExposureMetrics(scoreBefore.score, scoreAfter.score, state.findings.length);
  renderFindingsBreakdown(scoreBefore.breakdown);
  renderIgnoredDecoys();
  updateChipCounts(scoreBefore.breakdown);

  // 7. Compute SHA-256 fingerprint
  const hash = await computeSHA256(state.safeText);
  safeHashDisplay.textContent = hash;

  // 8. Detect document language
  detectLanguageDebounced(text);
}

const debouncedProcess = debounce(processDocument, 120);

/**
 * Updates count badges on "Look for" chips.
 */
function updateChipCounts(breakdown) {
  countEmail.textContent = String(breakdown.email || 0);
  countPhone.textContent = String(breakdown.phone || 0);
  countCard.textContent = String(breakdown.card || 0);
  countAadhaar.textContent = String(breakdown.aadhaar || 0);
  countPan.textContent = String(breakdown.pan || 0);
  countIp.textContent = String(breakdown.ip || 0);

  const nanoCount = (breakdown.name || 0) + (breakdown.address || 0);
  countNano.textContent = String(nanoCount);
}

/**
 * Renders highlighted original document.
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
    if (f.start < lastIdx) continue;

    fragments.push(escapeHTML(text.substring(lastIdx, f.start)));

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

  // Attach highlight events
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
 * Renders safe copy.
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
    scoreVal.className = 'score-digits';
    scoreMeterBar.className = 'meter-fill';
  } else if (before > 0) {
    scoreVal.className = 'score-digits';
    scoreMeterBar.className = 'meter-fill';
  } else {
    scoreVal.className = 'score-digits safe';
    scoreMeterBar.className = 'meter-fill safe';
  }

  scoreAfterLine.textContent = `After redaction: ${after}. ${after === 0 ? 'Safe to share.' : 'Residual risk.'}`;

  // Seals
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
 * Renders breakdown list in Summary tab using exact requested labels.
 */
function renderFindingsBreakdown(breakdown) {
  findingsBreakdownList.innerHTML = '';

  const labelMapping = {
    email: 'Email',
    phone: 'Phone',
    card: 'Card number',
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    ip: 'IP address',
    name: 'Names & addresses',
    address: 'Names & addresses',
    manual: 'Manual marks'
  };

  const aggregated = {};
  for (const [type, count] of Object.entries(breakdown)) {
    const label = labelMapping[type] || type;
    aggregated[label] = (aggregated[label] || 0) + count;
  }

  const entries = Object.entries(aggregated);
  if (entries.length === 0) {
    findingsBreakdownList.innerHTML = '<li class="stats-row"><span>No sensitive entities detected.</span></li>';
    return;
  }

  for (const [label, count] of entries) {
    const li = document.createElement('li');
    li.className = 'stats-row';
    li.innerHTML = `
      <span>${escapeHTML(label)}</span>
      <strong>${count}</strong>
    `;
    findingsBreakdownList.appendChild(li);
  }
}

/**
 * Renders set-aside decoys in Set Aside tab.
 */
function renderIgnoredDecoys() {
  ignoredList.innerHTML = '';
  tabCountSetaside.textContent = String(state.ignored.length);

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
 * Renders CSV column hide buttons in Columns tab.
 */
function renderCSVColumns(headers) {
  csvColumnsList.innerHTML = '';
  headers.forEach((h, idx) => {
    const row = document.createElement('div');
    row.className = 'col-row';
    const isHidden = state.hiddenColumns.includes(h);

    row.innerHTML = `
      <span><strong>${escapeHTML(h)}</strong></span>
      <button class="btn-compact" data-col-idx="${idx}" type="button">
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
 * Opens margin note card near clicked highlight.
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
    if (f.flags.devanagari) flagContainer.innerHTML += '<div class="margin-card-flag">Written in Devanagari digits, caught anyway</div>';
    if (f.flags.spaced) flagContainer.innerHTML += '<div class="margin-card-flag">Spaced digits format, normalized</div>';
    if (f.flags.disguised) flagContainer.innerHTML += '<div class="margin-card-flag">Disguised syntax, de-obfuscated</div>';
    if (f.flags.brand) flagContainer.innerHTML += `<div class="margin-card-flag">Card Brand: ${f.flags.brand}</div>`;
  }

  const count = state.findings.filter(item => item.normalisedKey === f.normalisedKey).length;
  document.getElementById('margin-count').textContent = String(count);

  const key = f.normalisedKey || f.value;
  let rep = '[REDACTED]';
  if (state.mode === 'pseudonym') rep = state.pseudonymMap[key] || '[REDACTED]';
  document.getElementById('margin-replacement').textContent = rep;

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

  const rect = markElement.getBoundingClientRect();
  const parentRect = originalDisplay.getBoundingClientRect();

  marginNote.style.top = `${Math.max(10, rect.top - parentRect.top + originalDisplay.scrollTop - 20)}px`;
  marginNote.style.left = `${Math.min(parentRect.width - 300, Math.max(10, rect.left - parentRect.left))}px`;
  marginNote.classList.remove('hidden');
}

function closeMarginNote() {
  marginNote.classList.add('hidden');
  state.selectedFinding = null;
}

/**
 * Detects document language and shows real name in original sheet's header.
 */
const detectLanguageDebounced = debounce(async (text) => {
  try {
    const langCode = await detectDocumentLanguage(text);
    if (langCode) {
      const realName = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();
      originalLang.textContent = realName;
      originalLang.classList.remove('hidden');
    } else {
      originalLang.classList.add('hidden');
    }
  } catch (e) {
    originalLang.classList.add('hidden');
  }
}, 500);

/**
 * Downloads a file to disk.
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

  // Live preview subtitle under active option only
  previewFull.classList.toggle('hidden', newMode !== 'full');
  previewPartial.classList.toggle('hidden', newMode !== 'partial');
  previewPseudonym.classList.toggle('hidden', newMode !== 'pseudonym');

  processDocument();
}

/**
 * Loads text document into state.
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
 * Synced scrolling between sheets.
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
 * Tab switcher for right panel.
 */
function switchTab(targetTabId) {
  const tabButtons = document.querySelectorAll('.panel-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-content-pane');

  tabButtons.forEach(btn => {
    const isTarget = btn.id === `tab-btn-${targetTabId}`;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', String(isTarget));
  });

  tabPanes.forEach(pane => {
    const isTarget = pane.id === `tab-pane-${targetTabId}`;
    pane.classList.toggle('active', isTarget);
  });
}

/**
 * Initializes all event listeners.
 */
function initEventListeners() {
  // Step 2: Mode buttons
  modeFullBtn.addEventListener('click', () => setRedactionMode('full'));
  modePartialBtn.addEventListener('click', () => setRedactionMode('partial'));
  modePseudonymBtn.addEventListener('click', () => setRedactionMode('pseudonym'));

  // Step 1: Load sample buttons
  btnLoadCSV.addEventListener('click', () => loadDocument(SAMPLE_CSV, 'placement_shortlist.csv'));
  btnLoadTXT.addEventListener('click', () => loadDocument(SAMPLE_TXT, 'support_ticket.txt'));
  btnEmptyCSV.addEventListener('click', () => loadDocument(SAMPLE_CSV, 'placement_shortlist.csv'));
  btnEmptyTXT.addEventListener('click', () => loadDocument(SAMPLE_TXT, 'support_ticket.txt'));

  // Step 1: Open file
  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5 MB limit. Please select a smaller document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => loadDocument(evt.target.result, file.name);
    reader.readAsText(file);
  });

  // Step 3: Action buttons
  btnDownloadSafe.addEventListener('click', () => {
    const ext = state.isCSV ? 'csv' : 'txt';
    const base = state.fileName.replace(/\.[^/.]+$/, '');
    downloadFile(state.safeText, `${base}_sanitised.${ext}`, state.isCSV ? 'text/csv' : 'text/plain');
  });

  btnCopySafe.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.safeText);
      const prev = btnCopySafe.textContent;
      btnCopySafe.textContent = 'Copied!';
      setTimeout(() => { btnCopySafe.textContent = prev; }, 1500);
    } catch (err) {
      alert('Unable to copy to clipboard.');
    }
  });

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
    // Ensure product name is Andhaar
    report.tool = 'Andhaar';

    downloadFile(JSON.stringify(report, null, 2), 'andhaar_audit_report.json', 'application/json');
  });

  // Look for filter chips
  document.querySelectorAll('.chip-btn[data-filter]').forEach(btn => {
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

  // On-device Gemini Nano chip button
  btnRunNano.addEventListener('click', async () => {
    if (!state.rawText) {
      alert('Please load a document first.');
      return;
    }

    try {
      btnRunNano.disabled = true;
      nanoSpinner.classList.remove('hidden');
      const entities = await extractEntitiesWithNano(state.rawText, () => {});
      state.nanoEntities = entities;
      btnRunNano.classList.add('active');
      processDocument();
    } catch (err) {
      alert(`Gemini Nano: ${err.message}`);
    } finally {
      btnRunNano.disabled = false;
      nanoSpinner.classList.add('hidden');
    }
  });

  // Dismiss First-run Hint
  btnDismissHint.addEventListener('click', () => {
    firstRunHint.classList.add('hidden');
    state.hintDismissed = true;
  });

  // Toggle Edit Text on Original Sheet
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

  // Manual Selection ("Black this out too")
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
      selectionTooltip.style.top = `${rect.top - 32 + window.scrollY}px`;
      selectionTooltip.style.left = `${rect.left + (rect.width / 2) - 45 + window.scrollX}px`;
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

  // Right Panel Tabs
  document.querySelectorAll('.panel-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.id.replace('tab-btn-', '');
      switchTab(tabId);
    });
  });

  // Tab Keyboard Navigation (Arrow keys)
  const tablist = document.querySelector('.panel-tabs');
  tablist.addEventListener('keydown', (e) => {
    const tabs = Array.from(tablist.querySelectorAll('.panel-tab-btn:not(.hidden)'));
    const currentIdx = tabs.indexOf(document.activeElement);
    if (currentIdx === -1) return;

    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabs.length - 1;

    if (nextIdx !== -1) {
      e.preventDefault();
      tabs[nextIdx].focus();
      tabs[nextIdx].click();
    }
  });

  // Lock Key (AES-256-GCM Encrypt & Download .andhaar-key)
  btnLockKey.addEventListener('click', async () => {
    const pass = lockPasswordInput.value.trim();
    if (!pass) {
      lockStatus.textContent = 'Please enter a master password to encrypt your key map.';
      return;
    }

    try {
      lockStatus.textContent = 'Deriving PBKDF2 key (250,000 iterations)...';
      const bundle = await encryptKeyMap(state.reverseMap, pass);
      bundle.tool = 'Andhaar';
      const base = state.fileName.replace(/\.[^/.]+$/, '');
      downloadFile(JSON.stringify(bundle, null, 2), `${base}.andhaar-key`, 'application/json');
      lockStatus.textContent = 'Key file downloaded (.andhaar-key). Store it safely!';
      lockPasswordInput.value = '';
    } catch (err) {
      lockStatus.textContent = `Encryption error: ${err.message}`;
    }
  });

  // Restore Key (AES-256-GCM Decrypt & Restore)
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
      const restored = restoreText(state.safeText, restoredReverseMap);
      loadDocument(restored, 'restored_document.txt');
      restoreStatus.textContent = 'Original document values successfully restored!';
      restorePasswordInput.value = '';
      restoreKeyFileInput.value = '';
    } catch (err) {
      restoreStatus.textContent = `Restoration failed: ${err.message}`;
    }
  });

  // Gemini API Synthetic Data Generation
  async function handleSyntheticGen(type) {
    const key = geminiApiKeyInput.value.trim();
    if (!key) {
      geminiApiStatus.textContent = 'Please enter your Google AI Studio API key.';
      return;
    }

    try {
      geminiApiStatus.textContent = 'Generating test dataset via Gemini API...';
      const syntheticText = await generateSyntheticData(type, key);
      const fname = type === 'placementCSV' ? 'gemini_placement_shortlist.csv' : 'gemini_support_ticket.txt';
      loadDocument(syntheticText, fname);
      geminiApiStatus.textContent = 'Synthetic test data generated and loaded!';
    } catch (err) {
      geminiApiStatus.textContent = `Generation error: ${err.message}`;
    }
  }
  btnGenCSV.addEventListener('click', () => handleSyntheticGen('placementCSV'));
  btnGenTicket.addEventListener('click', () => handleSyntheticGen('supportTicket'));

  // Theme Toggle
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
  });

  // Keyboard Shortcuts Popover
  btnShortcuts.addEventListener('click', () => {
    shortcutsPopover.classList.toggle('hidden');
  });
  btnCloseShortcuts.addEventListener('click', () => {
    shortcutsPopover.classList.add('hidden');
  });

  // 9. Global Keyboard Shortcuts: 1/2/3, D, E, Esc, ?
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in an input or textarea
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    if (e.key === '1') {
      e.preventDefault();
      setRedactionMode('full');
    } else if (e.key === '2') {
      e.preventDefault();
      setRedactionMode('partial');
    } else if (e.key === '3') {
      e.preventDefault();
      setRedactionMode('pseudonym');
    } else if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      btnDownloadSafe.click();
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      btnToggleEdit.click();
    } else if (e.key === 'Escape') {
      closeMarginNote();
      selectionTooltip.classList.add('hidden');
      shortcutsPopover.classList.add('hidden');
    } else if (e.key === '?') {
      e.preventDefault();
      shortcutsPopover.classList.toggle('hidden');
    }
  });

  // Network Status
  function updateNetworkStatus() {
    if (navigator.onLine) {
      privacyPill.classList.remove('offline');
      privacyStatusText.textContent = 'Offline-safe · 0 bytes sent';
    } else {
      privacyPill.classList.add('offline');
      privacyStatusText.textContent = 'Offline, still working · 0 bytes sent';
    }
  }
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Drag and Drop
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
 * Bootstrap
 */
function initApp() {
  initEventListeners();
  loadDocument(SAMPLE_CSV, 'placement_shortlist.csv');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
