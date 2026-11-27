# Vaulty – your private data, kept in the vault

> **PromptWars × NIAT Pune 2026** (Google for Developers + Hack2Skill)  
> **Theme:** Cybersecurity & Data Privacy  
> **Author:** Vedant Sachin Malode (Solo Hackathon Submission)

---

## 1. Problem Statement & Mission

Organizations regularly share student spreadsheets, clinical notes, customer support logs, and resumes containing highly sensitive Personally Identifiable Information (PII). A single misdirected or forwarded email leaks hundreds of Aadhaar IDs, PAN cards, credit cards, and mobile numbers.

**Vaulty** is a zero-trust, browser-based data sanitisation platform where users paste text or upload `.csv` / `.txt` files. It automatically detects, classifies, and redacts sensitive PII **100% on the client side**, with cryptographic assurance that user data never touches any server.

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
| **Manual Selection** | Highlight any custom text to instantly trigger "Black this out too". | Completed |
| **CSV Engine** | RFC-compliant CSV parser handling quoted cells, embedded commas, and `\r\n`. 1-click "Hide column" masking. | Completed |
| **Exposure Scoring** | Weighted risk score (Cards/Aadhaar: 30, PAN: 20, Phones: 10, Emails: 8, IPs: 5) with repeat decay and 100 cap. | Completed |
| **Audit Report Download** | Downloadable JSON report with counts, hidden columns, SHA-256 fingerprint, and decoy log (`tool: "Vaulty"`). | Completed |
| **Encrypted Key Restoration** | Nickname map encrypted via **AES-256-GCM** with PBKDF2 (250,000 iterations). Restores original values with password. | Completed |

---

## 3. Google Services & Zero-Cloud-Leakage Architecture

| Google Service | Usage & Implementation | Privacy Guarantee |
| :--- | :--- | :--- |
| **Gemini Nano (Chrome Built-in AI)** | Prompt API (`LanguageModel.create()`) extracts complex Indian names and addresses. Chunks long text. | **100% on-device.** No network packets sent. Strict anti-hallucination verification only accepts items present verbatim in text. |
| **Chrome Language Detector API** | `translation.createDetector()` displays real language name in sheet header. | Runs locally within browser runtime. |
| **Gemini API (Google AI Studio)** | Generates fresh synthetic test datasets (`gemini-1.5-flash`) located in More disclosure. | Fixed prompt only. **User text is NEVER transmitted.** API key kept in JS memory only. |
| **Google Fonts** | Fraunces, Hind, IBM Plex Mono, and Kalam. | Archival, high-trust records room feel. |
| **Google Cloud Run** | Hardened container deployment using Alpine Nginx on port 8080. | Includes strict CSP and security headers. |
| **Firebase Hosting** | Serverless hosting configuration in `firebase.json`. | Includes matching zero-trust CSP headers. |

---

## 4. Security & Content Security Policy

Vaulty enforces a zero-trust Content Security Policy (CSP):
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
```
- **Zero Inline Scripts or Handlers:** 100% event listeners bound dynamically via ES modules.
- **Zero Server Transmission:** User documents, CSV files, and cryptographic keys stay entirely inside browser memory.
- **Web Crypto Standards:** Key derivation uses PBKDF2 with SHA-256 (250,000 rounds) and AES-256-GCM encryption with random 16-byte salt and 12-byte IV.
- **File Guard:** 5 MB upload limit to prevent client memory exhaustion.

---

## 5. UI/UX: Landing page + App

Two pages, one design system (`css/base.css`): paper-white and ink-black with one saffron accent, big type with square full stops, and small uppercase labels. Light and dark themes follow the system setting, and the toggle remembers your choice.

**Landing page (`index.html`)**
- **3D hero (three.js):** a sample ID card hangs on an Vaulty lanyard. A scan line sweeps down and blacks out the Aadhaar, PAN and phone, then a "Safe to share" stamp lands. Drag to turn it; replay and pause buttons included. Falls back to a flat card if WebGL is off, and respects reduced-motion settings.
- **Scroll-driven "How it works":** a sticky document goes from *added* → *private items marked* → *blacked out* as you scroll the three steps.
- **Live playground:** runs the real engine on the page, so it updates as you type, with all three hiding styles.
- Sections: the problem, what it finds (7 kinds), real vs. fake numbers, Google AI, privacy promise, FAQ.

**App (`app.html`)**
- Top bar with file name and a live "0 bytes sent" badge.
- Numbered step bar: **01 Add** (samples, open file, drag and drop anywhere) → **02 Hide by** (Black out / Hint / Nicknames with a live preview) → **03 Share** (Copy, Report, Download).
- "Look for" chips with live counts, plus on-device Gemini Nano for names and addresses.
- Side-by-side original and safe copy. Swapped values are shown as ink tokens in the safe copy.
- Inspector tabs: Summary (risk score, breakdown, SHA-256 fingerprint, Gemini test data), Set aside, Columns (CSV), Lock.
- Click any mark for a note card (why it was caught, how often it shows up, what it becomes, let it through). Select text to hide it yourself.
- Keyboard: `1/2/3` styles, `D` download, `E` edit, `Esc` close, `?` help.

three.js r160 (MIT) is bundled at `js/vendor/three.module.min.js` so the strict `script-src 'self'` policy stays in place.

## 6. Testing & Quality Assurance

Vaulty includes 33 comprehensive unit tests executing via Node.js built-in test runner (`node:test`):

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
gcloud run deploy vaulty \
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

- **Google:** Gemini Nano (Chrome built-in AI), Chrome Language Detector, Gemini API (Google AI Studio), Google Cloud Run, Firebase Hosting, Google Fonts.
- **Libraries:** three.js r160 (MIT) for the 3D hero.
- **AI assistance:** the landing page and app UI redesign were made with help from Claude (Anthropic).

