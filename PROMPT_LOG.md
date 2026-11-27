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

---

## Prompt 5: Editorial 3D Redesign to "Andhaar" (Milemark Template Aesthetic)

### User Request Summary
Redesign the hackathon project "Andhaar" in this repository:
1. Premium editorial landing page at `index.html` with a 3D interactive hero object based on the Milemark 3D freight/logistics template reference (paper off-white `#F3F2EE`, huge black type with small orange square full stops, tiny uppercase monospace labels with pulsing orange status lights, black buttons with ↗ hover nudges, scroll-driven typography and document animations).
2. Move tool to `app.html` and restyle it to match the landing page design system (`css/base.css` and `css/app.css`).
3. Strict adherence to Hard Rules:
   - Plain HTML, CSS and JS ES modules with zero frameworks or build steps.
   - Strict Content Security Policy (`script-src 'self'`). Zero inline scripts, `style=""`, or `onclick`.
   - `js/engine.js`, `js/samples.js`, `js/gemini.js`, and `tests/` left completely untouched. `npm test` passes all 33 tests.
   - three.js r160 bundled locally in `js/vendor/three.module.min.js`.
   - Google Fonts: Geist (300–600) and Geist Mono (400–500).
   - Fully accessible, responsive at 390px (zero horizontal scroll) and 1440px, light & dark theme support, and prefers-reduced-motion.
   - All 82 element IDs and class bindings in `app.html` strictly preserved.
   - Replace all `alert()` with accessible toasts.

### Actions & Changes
1. **Design System (`css/base.css`):**
   - Implemented exact palette: light bg `#F3F2EE`, elevated `#FBFBF9`, sunken `#EAE9E3`, ink `#161614`, accent `#F2672E`, safe `#1E8E5A`, danger `#D9412F`; dark bg `#0E0E0D`, elevated `#171715`, ink `#EDECE6`, line `#262623`, accent `#FF7A3D`.
   - Distinct highlight tints for all 7 Indian PII types (email, phone, card, aadhaar, pan, ip, nano names/addresses, manual).
   - Editorial typography: Geist & Geist Mono, square orange full stops (`.sq`) wrapped in `.nw` to prevent lonely wrap, uppercase labels (`.eyebrow`) with pulsing saffron dots (`.eyebrow-dot`).
   - Andhaar logo: 26px rounded square mark with orange and light accent bars, plus `an<span class="brand-redact">dh</span>aar<span class="brand-dot"></span>` where letters "dh" are swiped under an ink bar.
   - Dark pill toasts with green/red status dots replacing all alert dialogs.
   - `js/theme.js` no-flash theme script with system auto-detection and persistence.

2. **Landing Page (`index.html`, `css/landing.css`, `js/landing.js`, `js/hero3d.js`):**
   - **Hero:** Giant typographic composition "Hide it." top-left and "Share it." bottom-right (15vw) with orange square full stops. Monospace status badges "● Privacy, on your device", "01 / Hide", "WHAT IT CATCHES" side card with "+", spinning asterisk (✲), drag-to-turn controls with replay/pause, and scroll prompt.
   - **3D Suspended ID Card (`js/hero3d.js`):** Built with locally bundled three.js r160. Suspended 3.4 × 2.16 card with lanyard slot hanging on an orange branded lanyard ribbons in a V. 2D canvas texture with photo silhouette, sample Indian PII (Priya Patel, Aadhaar, PAN, phone), 10-second scan-line redaction cycle with Verhoeff/Luhn validation, black redaction bar growth, and green "SAFE TO SHARE" stamp. Pendulum swing, mouse parallax, drag-to-turn with inertia, and soft contact shadow.
   - **Problem Section:** Dynamic scroll-linked text where words transition from muted grey to ink black, with animated orange highlighter sweeps on Aadhaar, PAN, and phone keywords.
   - **Scroll-Driven "How it works":** Sticky document window on the left with live detection (`detectPII()`) that transitions through Step 1 (Added), Step 2 (Private items found with red pill), and Step 3 (Safe to share with black bars and stamp).
   - **What It Catches & Real vs. Fake:** 7-cell bordered grid with masked code tokens and verification rules; comparative decoy section contrasting genuine items vs. decoy numbers with human-friendly reasons.
   - **In-Browser Playground:** Interactive input with instant live preview in Black out, Hint, or Nicknames mode.
   - **Google AI, Privacy Promise ("0 bytes leave this tab"), and FAQ Accordion.**

3. **Restyled App Workspace (`app.html`, `css/app.css`, `js/app.js`):**
   - 100dvh full-height workspace with top bar (logo, file chip, "0 bytes sent" privacy pill, shortcuts trigger, theme toggle).
   - Sticky 3-step action bar (`01 Add`, `02 Hide by` with live preview token, `03 Share`).
   - PII filter chips with live counts and Gemini Nano trigger.
   - Two panes: "Your original" and "Safe copy" with line metrics and footer seals (`seal-danger` / `seal-clear`). Replaced values rendered as black tokens (`.safe-token`).
   - Inspector with 4 tabs: Summary (64px tabular risk score, meter bar, SHA-256 fingerprint, synthetic test data generator), Set aside (struck-through decoys), Columns (CSV masking), and Lock (`.andhaar-key` AES-256-GCM encryption/restoration).
   - Floating note card on highlight click, selection tooltip for manual redaction, blurred drop overlay, and non-blocking toast notifications.

4. **Quality & Verification:**
   - Ran `npm test`: all 33 unit tests pass.
   - Automated headless Chrome checks at 1440px and 390px in both light and dark themes confirmed zero console errors and zero horizontal overflow.
   - Updated `Dockerfile` to deploy both `index.html` and `app.html`.

