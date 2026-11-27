# Andhaar – keeps your Aadhaar in the dark

> **PromptWars × NIAT Pune 2026** (Google for Developers + Hack2Skill)  
> **Theme:** Cybersecurity & Data Privacy  
> **Author:** Vedant Sachin Malode (Solo Hackathon Submission)

---

## 1. Problem Statement & Mission

Organizations regularly share student spreadsheets, clinical notes, customer support logs, and resumes containing highly sensitive Personally Identifiable Information (PII). A single misdirected or forwarded email leaks hundreds of Aadhaar IDs, PAN cards, credit cards, and mobile numbers.

**Andhaar** is a zero-trust, browser-based data sanitisation platform where users paste text or upload `.csv` / `.txt` files. It automatically detects, classifies, and redacts sensitive PII **100% on the client side**, with cryptographic assurance that user data never touches any server.

---

## 2. Core Features & Compliance Matrix

| Requirement | Implementation Detail | Status |
| :--- | :--- | :--- |
| **Pure Engine** | `js/engine.js` has zero DOM or network dependencies. Runs identically in the browser and in Node.js for tests. | Completed |
| **Credit Card & Luhn** | Detects 13–19 digits (Visa, Mastercard, Amex, RuPay). Strict Luhn mod 10 validation. | Completed |
| **Aadhaar & Verhoeff** | 12-digit Indian Aadhaar with dihedral group $D_5$ Verhoeff checksum algorithm. First digit 2–9 required. | Completed |
| **Indian PAN** | 5 letters + 4 digits + 1 letter. Strict 4th letter holder validation (`P, C, H, F, A, T, B, L, J, G`). | Completed |
| **Indian Mobile Phones** | 10 digits starting 6–9 with `+91`, `0091`, `91`, or `0` prefix. Handles spaced formats and Devanagari numerals (`०-९`). | Completed |
| **Disguised Emails** | Detects standard and obfuscated emails (e.g., `user [at] domain [dot] in`, `user(at)domain.com`). Normalises to shared key. | Completed |
| **IP Addresses** | Strict IPv4 octet checks (0–255) and IPv6 full / compressed forms. Clock times (e.g., `10:30:00`) excluded. | Completed |
| **Decoy Set-Aside** | Candidates failing validation (e.g., Luhn fail, invalid PAN holder, IP > 255) are isolated in "Looked private, but isn't" with human explanations. | Completed |
| **Three Redaction Modes** | 1. **Full Mask:** `[REDACTED]`<br>2. **Partial Mask:** `XXXX-XXXX-1234`, `a*****@domain`<br>3. **Pseudonym:** `USER_01`, `CARD_01`, `PAN_01` (consistent across whole document). | Completed |
| **3-Step Sticky Action Bar** | Top-anchored numbered workflow: (1) Add text, (2) Hide by mode, (3) Share safely (Download, Copy, Audit report). | Completed |
| **Tabbed Right Case File** | Organised into `[Summary]`, `[Set aside]`, `[Columns]` (CSV only), and `[Lock & restore]`. | Completed |
| **Interactive Margin Notes** | Clicking or focusing on any highlight reveals rule explanations, occurrence counts, and let-through toggles. | Completed |
| **Manual Selection** | Highlight any custom text to instantly trigger "Hide this too". | Completed |
| **CSV Engine** | RFC-compliant CSV parser handling quoted cells, embedded commas, and `\r\n`. 1-click "Hide column" masking. | Completed |
| **Exposure Scoring** | Weighted risk score (Cards/Aadhaar: 30, PAN: 20, Phones: 10, Emails: 8, IPs: 5) with repeat decay and 100 cap. | Completed |
| **Audit Report Download** | Downloadable JSON report with counts, hidden columns, SHA-256 fingerprint, and decoy log (`tool: "Andhaar"`). | Completed |
| **Encrypted Key Restoration** | Nickname map encrypted via **AES-256-GCM** with PBKDF2 (250,000 iterations). Restores original values with password (`.andhaar-key`). | Completed |

---

## 3. Google Services & Zero-Cloud-Leakage Architecture

| Google Service | Usage & Implementation | Privacy Guarantee |
| :--- | :--- | :--- |
| **Gemini Nano (Chrome Built-in AI)** | Prompt API (`LanguageModel.create()`) extracts complex Indian names and addresses. Chunks long text. | **100% on-device.** No network packets sent. Strict anti-hallucination verification only accepts items present verbatim in text. |
| **Chrome Language Detector API** | `translation.createDetector()` displays real language name in sheet header. | Runs locally within browser runtime. |
| **Gemini API (Google AI Studio)** | Generates fresh synthetic test datasets (`gemini-1.5-flash`) located in More disclosure. | Fixed prompt only. **User text is NEVER transmitted.** API key kept in JS memory only. |
| **Google Fonts** | Geist (300–600) and Geist Mono (400–500). | Clean editorial modern typography. |
| **Google Cloud Run** | Hardened container deployment using Alpine Nginx on port 8080. | Includes strict CSP and security headers. |
| **Firebase Hosting** | Serverless hosting configuration in `firebase.json`. | Includes matching zero-trust CSP headers. |

---

## 4. Security & Content Security Policy

Andhaar enforces a zero-trust Content Security Policy (CSP):
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
```
- **Zero Inline Scripts or Handlers:** 100% event listeners bound dynamically via ES modules.
- **Zero Server Transmission:** User documents, CSV files, and cryptographic keys stay entirely inside browser memory.
- **Web Crypto Standards:** Key derivation uses PBKDF2 with SHA-256 (250,000 rounds) and AES-256-GCM encryption with random 16-byte salt and 12-byte IV.
- **File Guard:** 5 MB upload limit to prevent client memory exhaustion.

---

## 5. UI/UX: Landing Page + App

Two pages sharing a cohesive, premium design system (`css/base.css`): paper off-white (`#F3F2EE`) and ink-black (`#161614`) with saffron accent (`#F2672E`), giant editorial headlines with square periods, and small uppercase monospace labels. Light and dark themes follow system preferences and remember user selections.

**Landing page (`index.html`)**
- **3D Hero (three.js r160):** A 3D sample ID card suspended from a branded orange lanyard ribbons in a V. An animated orange scan line sweeps down, blacking out the Aadhaar, PAN, and phone, followed by a green "SAFE TO SHARE" stamp landing on the card. Includes pendulum swing, mouse tracking, drag-to-turn with inertia, replay/pause controls, soft blob contact shadow, and a graceful flat fallback for non-WebGL/reduced-motion environments.
- **Scroll-driven "How it works":** Sticky document window on the left with live detection (`detectPII()`) that progresses from *Added* → *Private items found* (red pill) → *Safe to share* (blacked-out bars + stamp) as each numbered step reaches center screen.
- **Problem Statement:** Large paragraph where words shift from muted grey to ink black upon scrolling, with animated orange highlighter sweeps on private data types.
- **What It Finds (7 Kinds):** Indian PII breakdown grid with live redacted code tokens, Verhoeff and Luhn verification explanations, and a Gemini Nano badge.
- **Real or Fake:** Comparison showcase contrasting genuine PII candidates against decoy values (e.g. invalid Verhoeff checksums, order numbers, invalid PAN 4th characters).
- **Live In-Browser Playground:** Interactive text editor and real-time safe copy display powered by `js/engine.js`.
- **Google AI & Privacy Band:** Showcase of on-device Gemini Nano, Language Detector, optional Gemini API, and a giant "0 bytes leave this tab" privacy promise.
- **Accessible FAQ & Final CTA:** Animated `<details>` accordions with rotating `+` glyphs and responsive navigation.

**App (`app.html`)**
- Full-height 100dvh responsive workspace.
- 60px top bar with brand mark, file chip, live "On this device · 0 bytes sent" badge, shortcuts trigger, and theme toggle.
- 3-step action bar: **01 Add** (Placement sheet, Support ticket, Open file) → **02 Hide by** (Black out, Hint, Nicknames with dynamic preview badge) → **03 Share** (Copy, Report, Download safe copy).
- Filter chips with live entity counts and a dashed Gemini Nano action chip.
- Side-by-side original and safe copy panes with line metrics, status dots, and footer ink seals (`seal-danger` / `seal-clear`).
- Safe copy displays replaced items as black tokens (`.safe-token`).
- Inspector tabs: **Summary** (64px tabular risk score, meter bar, breakdown, SHA-256 fingerprint, synthetic test data generation), **Set aside** (struck-through decoys with plain reasons), **Columns** (CSV masking), and **Lock** (AES-256-GCM `.andhaar-key` export and restore).
- Floating margin note card for clicked marks, selection tooltip ("Hide this too"), drag-and-drop overlay, and non-blocking toast notifications.

---

## 6. Testing & Quality Assurance

Andhaar includes 33 comprehensive unit tests executing via Node.js built-in test runner (`node:test`):

```bash
npm test
```

---

## 7. Run & Deploy Commands

### Local Development
```bash
# Run unit tests
npm test

# Start local server (port 8080)
npm start
# Then open http://localhost:8080 in your browser
```

### Deploy to Google Cloud Run
```bash
gcloud run deploy andhaar \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

### Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

---

## 8. Built With

- **Google:** Gemini Nano (Chrome built-in AI), Chrome Language Detector, Gemini API (Google AI Studio), Google Cloud Run, Firebase Hosting, Google Fonts (Geist, Geist Mono).
- **Libraries:** three.js r160 (MIT, bundled locally).


