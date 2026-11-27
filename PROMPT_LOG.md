# PROMPT_LOG.md — Vaulty Engineering Session

This document details the engineering prompts, iterative reasoning, and system modifications performed during the development of **Vaulty** (first called Andhaar) for the PromptWars × NIAT Pune 2026 hackathon.

---

## Prompt 1: Initial System Architecture & Engine Specification

### User Request Summary
Build a complete, production-quality, zero-trust client-side PII sanitisation and data redaction tool named **Andhaar** ("keeps your Aadhaar in the dark").
Key requirements:
- Pure JS detection engine running in both Node and browser without DOM/network dependencies.
- Luhn validation for credit cards (Visa, Mastercard, Amex, RuPay).
- Verhoeff checksum algorithm for Indian Aadhaar (12 digits, starting with 2–9).
- Indian PAN validation (5 letters + 4 digits + 1 letter, with 4th letter holder check).
- Indian mobile phone detection (including +91/0091/0 prefixes, spaced digits, and Devanagari numerals ०-९).
- Disguised email de-obfuscation (`name [at] domain [dot] in`, `name(at)domain.com`).
- IPv4 (0–255) and IPv6 full / compressed forms (excluding clock times).
- Decoy isolation ("Looked private, but isn't") for validation-failing candidates.
- Three redaction modes: Full Mask `[REDACTED]`, Partial Mask (`XXXX-1234`), and Consistent Pseudonymisation (`USER_01`).
- Interactive margin notes, CSV mode with column hiding, exposure risk scoring (0–100), and audit report JSON download.
- Password-locked restore using AES-256-GCM + PBKDF2 (250,000 iterations).
- Google services integration: on-device Gemini Nano with anti-hallucination checks, Chrome Language Detector API, and Gemini API for synthetic data generation.
- Strict Content Security Policy, Dockerfile, Nginx config on port 8080, Firebase Hosting config, and comprehensive test suite.

### Actions & Changes
1. **Engine (`js/engine.js`):** Built detection, mathematical validation (Luhn, Verhoeff), normalization (Devanagari, emails, phones), priority claiming, AES-256-GCM + PBKDF2 crypto, and CSV parser.
2. **Datasets (`js/samples.js`):** Created `SAMPLE_CSV` (`placement_shortlist.csv`) and `SAMPLE_TXT` (`support_ticket.txt`) with planted decoys.
3. **Google AI Integration (`js/gemini.js`):** Connected Chrome Prompt API, Translation Detector, and Gemini API synthetic prompts.
4. **Unit Tests (`tests/engine.test.js`):** Authored 33 unit tests for `node:test`. All passed.

---

## Prompt 2: UI Simplification & Exact "Andhaar" Branding

### User Request Summary
Fix and simplify the UI. Product name must be exactly "Andhaar" everywhere:
- Logo: "Andhaar" with only the letters "dh" covered by the black redaction bar.
- Title, header, footer, README, PROMPT_LOG, package.json, `.andhaar-key` key file extension, and audit report "tool" field.
- Do not touch `js/engine.js`.
- Strict CSP retained.
- Slim one-line header: logo + tagline left; privacy pill + theme toggle right. Real language name in sheet header if detected.
- Sticky 3-step action bar directly under header:
  (1) Add text with sample buttons, (2) Hide by mode with live preview example under active option, (3) Share safely (Download, Copy, Audit report).
- Slim row of "Look for" chips with live count badges.
- Side-by-side sheets filling viewport height (`calc(100vh - 170px)`) with synced scrolling, compact headers, 14px document font, `overflow-wrap: anywhere;` to prevent breaking lines.
- Right panel converted to 4 keyboard-accessible tabs: `Summary`, `Set aside (N)`, `Columns` (CSV only), and `Lock & restore`.
- Gemini API moved to "More" disclosure at bottom of Summary tab.
- Empty state drop zone in original sheet when no text.
- Dismissible first-run hint line in memory.
- Keyboard shortcuts popover and hotkeys (1/2/3, D, E, Esc, ?).
- Responsive verified at 1440px, 1280px, 1000px, 390px. Run `npm test`.

### Actions & Changes
1. **Branding & Logo (`index.html`, `css/styles.css`):**
   - Configured logo as `An<span class="logo-redaction-bar">dh</span>aar` so only the letters "dh" are swiped by the black redaction bar with saffron accent.
   - Updated `<title>` to `Andhaar – keeps your Aadhaar in the dark`.
   - Updated footer, README, PROMPT_LOG, and `package.json` (`"name": "andhaar"`).
2. **Slim Header:**
   - Reduced to a sleek 48px height containing logo + tagline on left, privacy pill + shortcut `?` + theme toggle on right.
   - Removed header language pill; language name is displayed directly inside the original sheet header when detected.
3. **Sticky 3-Step Bar:**
   - Implemented sticky CSS container at `top: 0; z-index: 50;` with numbered badges:
     * `(1) Add text`: sample buttons + Open file + "or drop a file anywhere".
     * `(2) Hide by`: segmented buttons with dynamic live subtitle (`[REDACTED]`, `XXXX-1234`, `USER_01`) under the active option.
     * `(3) Share safely`: primary Download safe copy + Copy + Audit report.
4. **"Look for" Chips:**
   - Single slim row with exact requested labels: Email, Phone, Card number, Aadhaar, PAN, IP address, and `+ Names & addresses (Gemini Nano)`.
   - Live entity count badges updated dynamically. Small CSS spinner during Nano scan.
5. **Full-Height Synced Sheets:**
   - Height set to `calc(100vh - 170px)` with synchronized scroll listeners.
   - Header shows file name and line counts. `[Clear manual marks]` button appears only when manual marks exist.
   - 14px monospace font with `overflow-wrap: anywhere;` preventing horizontal overflow on long separator lines.
   - Empty state drop zone shown when no text is loaded.
6. **Tabbed Right Panel:**
   - Rebuilt into 4 tabs with full keyboard navigation (arrow keys, role=tablist/tab/tabpanel).
   - Summary tab hosts exposure score (40px font), meter, "after redaction" line, breakdown counts, fingerprint, and "More" disclosure for Gemini API test data.
   - Set aside tab displays decoys with count badge.
   - Columns tab displays CSV column masking controls.
   - Lock & restore tab handles `.andhaar-key` encryption/decryption.
7. **Keyboard Shortcuts & First-Run Hint:**
   - Added dismissible first-run hint line.
   - Bound global hotkeys: `1`/`2`/`3` (modes), `D` (download), `E` (edit), `Esc` (close), `?` (help popover).
8. **Compliance & Verification:**
   - `js/engine.js` kept completely untouched.
   - Ran `npm test`: all 33 tests passed cleanly.

---

## Prompt 3: Professional Landing Page + 3D Hero + App Redesign

### User Request Summary
The UI felt weak. Build a professional landing page and restyle the app, following a 3D, editorial reference style (paper-white background, huge black type, orange accents, a 3D object in the hero, scroll-driven motion). Keep the wording simple and friendly.

### Actions & Changes
1. **Design system (`css/base.css`):** New tokens (paper/ink/saffron), Geist + Geist Mono, brand mark with a redaction bar over "dh", buttons, labels, toasts, and light/dark themes with a no-flash theme loader (`js/theme.js`).
2. **Landing page (`index.html`, `css/landing.css`, `js/landing.js`):** Hero "Hide it. Share it.", problem statement with scroll-lit words, sticky scroll-driven "How it works" document, 7-kind detection grid, real-vs-fake list, live engine playground, Google AI section, dark privacy band, FAQ, CTA.
3. **3D hero (`js/hero3d.js`):** three.js ID card on a lanyard with an animated scan-and-redact sequence drawn on a canvas texture, a soft contact shadow, drag to turn, replay and pause, a WebGL fallback, and reduced-motion support. three.js is bundled locally to keep the CSP strict.
4. **App (`app.html`, `css/app.css`):** Same look. Top bar, numbered step bar, chips, two panes and a tabbed inspector, an anchored note card, a drop overlay, and toasts instead of `alert()`. All element IDs were kept, so `js/app.js` logic is unchanged apart from UI wiring and plain-language messages.
5. **Deploy:** Dockerfile now ships `app.html` and `favicon.svg`. The old `css/styles.css` was removed.
6. **Verification:** `npm test` passes (`engine.js` untouched). Headless Chrome checks at 1440px and 390px in light and dark show no console errors and no sideways scroll. App flows tested: modes, filters, column hiding, let-through, samples, empty state.

---

## Prompt 4: Rename to Vaulty

### User Request Summary
Rename the product from "Andhaar" to "Vaulty".

### Actions & Changes
- Brand name, page titles, logo (now "va▇▇ty" with "ul" under the redaction bar), footer tagline ("Keeps your private data in the vault"), 3D card, lanyard and card back.
- Key file extension is now `.vaulty-key`. Restore still accepts old `.andhaar-key` files.
- Audit report file `vaulty_audit_report.json` with `tool: "Vaulty"`; `package.json` name and Cloud Run service name are now `vaulty`.
- Earlier entries in this log keep the old name, since they describe what happened at the time.

