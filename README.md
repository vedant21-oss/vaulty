# NEWNAME – Keeps your Aadhaar in the dark

> **PromptWars × NIAT Pune 2026** (Google for Developers + Hack2Skill)  
> **Theme:** Cybersecurity & Data Privacy  
> **Author:** Vedant Sachin Malode (Solo Hackathon Submission)

---

## 1. Problem Statement & Mission

Organizations regularly share student spreadsheets, clinical notes, customer support logs, and resumes containing highly sensitive Personally Identifiable Information (PII). A single misdirected or forwarded email leaks hundreds of Aadhaar IDs, PAN cards, credit cards, and mobile numbers.

**NEWNAME** is a zero-trust, browser-based data sanitisation platform where users paste text or upload `.csv` / `.txt` files. It automatically detects, classifies, and redacts sensitive PII **100% on the client side**, with cryptographic assurance that user data never touches any server.

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
| **Interactive Margin Notes** | Clicking or focusing on any highlight reveals rule explanations, occurrence counts, and let-through toggles. | Completed |
| **Manual Selection** | Highlight any custom text to instantly trigger "Black this out too". | Completed |
| **CSV Engine** | RFC-compliant CSV parser handling quoted cells, embedded commas, and `\r\n`. 1-click "Hide column" masking. | Completed |
| **Exposure Scoring** | Weighted risk score (Cards/Aadhaar: 30, PAN: 20, Phones: 10, Emails: 8, IPs: 5) with repeat decay and 100 cap. | Completed |
| **Audit Report Download** | Downloadable JSON report with counts, hidden columns, SHA-256 fingerprint, and decoy log (zero raw values). | Completed |
| **Encrypted Key Restoration** | Nickname map encrypted via **AES-256-GCM** with PBKDF2 (250,000 iterations). Restores original values with password. | Completed |

---

## 3. Google Services & Zero-Cloud-Leakage Architecture

| Google Service | Usage & Implementation | Privacy Guarantee |
| :--- | :--- | :--- |
| **Gemini Nano (Chrome Built-in AI)** | Prompt API (`LanguageModel.create()`) extracts complex Indian names and addresses. Chunks long text. | **100% on-device.** No network packets sent. Strict anti-hallucination verification only accepts items present verbatim in text. |
| **Chrome Language Detector API** | `translation.createDetector()` displays document language code. | Runs locally within the browser runtime. |
| **Gemini API (Google AI Studio)** | Generates fresh synthetic test datasets (`gemini-1.5-flash`). | Fixed prompt only. **User text is NEVER transmitted.** API key kept in JS memory only. |
| **Google Fonts** | Fraunces, Hind, IBM Plex Mono, and Kalam. | Visual hierarchy and high-trust archival feel. |
| **Google Cloud Run** | Hardened container deployment using Alpine Nginx on port 8080. | Includes strict CSP and security headers. |
| **Firebase Hosting** | Serverless hosting configuration in `firebase.json`. | Includes matching zero-trust CSP headers. |

---

## 4. Security & Content Security Policy

NEWNAME enforces a zero-trust Content Security Policy (CSP):
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
```
- **Zero Inline Scripts or Handlers:** 100% event listeners bound dynamically via ES modules.
- **Zero Server Transmission:** User documents, CSV files, and cryptographic keys stay entirely inside the browser's memory.
- **Web Crypto Standards:** Key derivation uses PBKDF2 with SHA-256 (250,000 rounds) and AES-256-GCM encryption with random 16-byte salt and 12-byte IV.
- **File Guard:** 5 MB upload limit to prevent client memory exhaustion.

---

## 5. UI/UX: "The Secure Records Room"

Designed as a high-trust digital records desk tailored for Indian academic and institutional workflows:
- **Color Palette:** Deep pine-ink teal (`--brand`), parchment ground (`--ground`), crisp paper sheets (`--surface`), and ink stamps (`--seal` / `--clear`).
- **Entity Highlighters:** Soft pastel yellow (email), green (phone), pink (card), orange (Aadhaar), violet (PAN), cyan (IP), coral (Gemini Nano names).
- **Ink Verdict Seals:** Authentic stamps certifying document safety.
- **Typography:** Fraunces headings, Hind interface, IBM Plex Mono documents, and Kalam margin notes.
- **Accessibility:** WCAG AA compliant contrast, 44px touch targets, visible saffron focus rings, keyboard navigable highlights, and skip link.

---

## 6. Testing & Quality Assurance

NEWNAME includes 33 comprehensive unit tests executing via Node.js built-in test runner (`node:test`):

```bash
npm test
```

### Test Coverage Highlights:
- Luhn algorithm validation & credit card brand detection (Visa, Mastercard, Amex, RuPay).
- Verhoeff checksum algorithm for 12-digit Indian Aadhaar.
- PAN holder letter validation (`P, C, H, F, A, T, B, L, J, G`).
- Disguised email de-obfuscation and canonical mapping.
- Rejection of natural language false positives (e.g. `meet at office.Tomorrow`).
- Indian mobile phone formats, spaced digits (`9 8 7 6 5 4 3 2 1 0`), and Devanagari numerals (`०-९`).
- Pincode, year, and currency amount exclusion.
- Decoy set-aside logic for candidates failing validation.
- All three redaction modes: Full, Partial, and Consistent Pseudonymisation.
- Reversible pseudonymisation and password-locked restoration via AES-256-GCM.
- RFC-compliant CSV parser handling embedded quotes, commas, and newlines.
- Built-in test samples (`SAMPLE_CSV` and `SAMPLE_TXT`) validation.
- Gemini Nano anti-hallucination validation filter.
- Performance benchmark: processing 200× sample text in under 3 seconds.

---

## 7. Project Layout

```
.
├── index.html              # Main web application entry point
├── package.json            # Scripts, metadata, and dependencies
├── Dockerfile              # Production container for Google Cloud Run
├── nginx.conf              # Nginx server configuration with CSP headers
├── firebase.json           # Firebase Hosting configuration
├── .gitignore              # Git ignore rules
├── .dockerignore           # Docker build ignore rules
├── .gcloudignore           # Google Cloud build ignore rules
├── LICENSE                 # Open-source license
├── README.md               # Architecture, specification, and deployment guide
├── PROMPT_LOG.md           # Engineering prompt log
├── css/
│   └── styles.css          # Design system & paper room styling
├── js/
│   ├── engine.js           # Pure JS detection, validation, and crypto engine
│   ├── samples.js          # Built-in noisy datasets and planted decoys
│   ├── gemini.js           # Gemini Nano and Gemini API integrations
│   └── app.js              # Application controller & DOM coordinator
└── tests/
    └── engine.test.js      # 33 unit tests for node:test
```

---

## 8. Run & Deploy Commands

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
gcloud run deploy newname \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated
```

### Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```
