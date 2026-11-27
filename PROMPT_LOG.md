# PROMPT_LOG.md — NEWNAME Engineering Session

This document details the engineering prompts, iterative reasoning, and system modifications performed during the development of **NEWNAME** for the PromptWars × NIAT Pune 2026 hackathon.

---

## Prompt 1: Initial System Architecture & Engine Specification

### User Request Summary
Build a complete, production-quality, zero-trust client-side PII sanitisation and data redaction tool named **NEWNAME** ("keeps your Aadhaar in the dark").
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
- Password-locked restore using AES-256-GCM + PBKDF2 (250,000 iterations) downloading `.newname-key`.
- Google services integration: on-device Gemini Nano with anti-hallucination checks, Chrome Language Detector API, and Gemini API for synthetic data generation.
- Strict Content Security Policy, Dockerfile, Nginx config on port 8080, Firebase Hosting config, and comprehensive test suite.

### Actions & Changes
1. **Architecture & Engine (`js/engine.js`):**
   - Implemented mathematical tables for Verhoeff dihedral group calculation.
   - Built Luhn algorithm validation mod 10 and card brand heuristics.
   - Implemented Indian PAN holder validation (`P, C, H, F, A, T, B, L, J, G`).
   - Built Devanagari numeral normalization to ASCII while preserving 1:1 character index offsets.
   - Built multi-format email de-obfuscation and canonical key mapping.
   - Engineered priority claiming logic to prevent double-counting (e.g. Aadhaar claimed before phone).
   - Designed Web Crypto PBKDF2 + AES-256-GCM encryption/decryption routines.
   - Built RFC-compliant CSV parser with cell coordinate tracking and column masking.

2. **Datasets & Decoys (`js/samples.js`):**
   - Created `SAMPLE_CSV` (`placement_shortlist.csv`) containing 6 realistic student records with mixed formats and planted traps.
   - Created `SAMPLE_TXT` (`support_ticket.txt`) containing unstructured support logs and decoy candidates.

3. **Google AI Integration (`js/gemini.js`):**
   - Implemented on-device Chrome Prompt API (`LanguageModel`) chunking and anti-hallucination verification.
   - Added Chrome Language Detector API binding.
   - Added Gemini API caller using Google AI Studio with hardcoded synthetic prompts (zero user data transmission).

4. **Test Suite (`tests/engine.test.js`):**
   - Authored 33 comprehensive test cases using Node.js built-in test runner (`node:test`).
   - Verified edge cases including disguised emails, spaced numerals, Devanagari numerals, decoy set-asides, CSV formatting, encryption/decryption, and performance benchmarking.

5. **User Interface & Visual Design (`css/styles.css` & `index.html`):**
   - Implemented "The Secure Records Room" design theme using custom properties with `light-dark()`.
   - Built dual side-by-side paper sheets with ruled lines, red margin, paperclip, and synchronized scrolling.
   - Crafted ink seals with animated stamp-down effect.
   - Added interactive margin note cards, floating manual selection tooltips, exposure meter, and key restoration disclosure panels.
   - Enforced WCAG AA contrast standards, keyboard navigation, and visible saffron focus rings.

6. **Controller (`js/app.js`):**
   - Wired up reactive state management, debounced re-analysis (~120ms), DOM highlight mapping, file downloads, key generation, and AI hooks.

7. **Deployment & Infrastructure:**
   - Created `Dockerfile` and `nginx.conf` listening on port 8080 with strict CSP headers.
   - Configured `firebase.json` for Firebase Hosting deployment.
   - Configured `.gitignore`, `.dockerignore`, `.gcloudignore`, and `LICENSE`.

---

## Prompt 2: Product Renaming & Validation

### User Instruction
"Rename the product from 'Andhaar' to 'NEWNAME' everywhere (title, logo, header, footer, README, PROMPT_LOG, package.json, file names like .andhaar-key → .newname-key, audit report 'tool' field). Keep the logo style with a redaction bar over part of the name. Don't change any logic. Run npm test after."

### Actions & Changes
- Updated branding across `index.html`, `css/styles.css`, `js/app.js`, `js/engine.js`, `package.json`, `README.md`, and `PROMPT_LOG.md`.
- Styled logo as `NEW<span class="logo-redaction-bar">█</span>AME` with animated redaction swipe and saffron accent.
- Configured key export file name as `.newname-key` (while maintaining backward compatibility with `.andhaar-key` on restore).
- Set audit report `tool` property to `"NEWNAME"`.
- Executed `npm test`: all 33 unit tests passed with zero failures.
