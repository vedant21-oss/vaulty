/**
 * @file gemini.js
 * @description Client-side integration for Google AI services in NEWNAME.
 * Features:
 * 1. Gemini Nano (Chrome Built-in Prompt API) - 100% on-device local inference for entity recognition.
 * 2. Chrome Language Detector API - 100% on-device language identification.
 * 3. Gemini API (Google AI Studio) - Synthetic test data generation with zero user data transmission.
 */

'use strict';

import { validateNanoEntities } from './engine.js';

/**
 * Checks availability status of Chrome built-in Gemini Nano (LanguageModel API).
 * @returns {Promise<{ available: boolean, status: string, error?: string }>}
 */
export async function checkGeminiNanoAvailability() {
  try {
    if (typeof window === 'undefined') {
      return { available: false, status: 'unavailable', error: 'Not in browser environment' };
    }

    // Check modern window.ai.languageModel or window.LanguageModel
    const lm = window.ai?.languageModel || window.LanguageModel;
    if (!lm) {
      return {
        available: false,
        status: 'unsupported',
        error: 'Chrome Built-in AI (Gemini Nano) not detected. Requires Chrome 128+ with Prompt API enabled.'
      };
    }

    if (typeof lm.capabilities === 'function') {
      const caps = await lm.capabilities();
      const available = caps.available === 'readily' || caps.available === 'after-download';
      return {
        available,
        status: caps.available || 'unknown'
      };
    }

    if (typeof lm.availability === 'function') {
      const avail = await lm.availability();
      return {
        available: avail === 'readily' || avail === 'after-download',
        status: avail
      };
    }

    return { available: false, status: 'unknown' };
  } catch (err) {
    return { available: false, status: 'error', error: err.message };
  }
}

/**
 * Extracts names and addresses using local Gemini Nano running 100% on-device.
 * Chunks long text and applies anti-hallucination validation against source text.
 * 
 * @param {string} sourceText 
 * @param {function} [onProgress] Progress callback
 * @returns {Promise<Array<{ text: string, kind: 'name'|'address' }>>}
 */
export async function extractEntitiesWithNano(sourceText, onProgress) {
  if (!sourceText || typeof sourceText !== 'string') return [];

  const lm = window.ai?.languageModel || window.LanguageModel;
  if (!lm) {
    throw new Error('Gemini Nano is not supported on this browser.');
  }

  // Chunk long text (~1500 chars) to prevent context limit errors
  const chunkSize = 1500;
  const chunks = [];
  for (let i = 0; i < sourceText.length; i += chunkSize) {
    chunks.push(sourceText.substring(i, i + chunkSize));
  }

  let session = null;
  try {
    if (typeof onProgress === 'function') {
      onProgress({ status: 'initializing', progress: 0.1 });
    }

    // Create session with English language hints
    const sessionOptions = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };

    if (typeof lm.create === 'function') {
      session = await lm.create(sessionOptions);
    } else {
      throw new Error('Unable to create Gemini Nano session.');
    }

    const allExtracted = [];

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const promptText = `Analyze the following text snippet. Extract any person names and physical postal addresses that appear verbatim in the text.
Return ONLY a valid JSON array of objects with schema: [{"text": "exact substring from text", "kind": "name" or "address"}].
If none are found, return []. Do not include explanations or markdown fences.

Text snippet:
"""
${chunk}
"""`;

      if (typeof onProgress === 'function') {
        onProgress({
          status: 'extracting',
          progress: 0.2 + (0.7 * (cIdx / chunks.length)),
          chunk: cIdx + 1,
          totalChunks: chunks.length
        });
      }

      const response = await session.prompt(promptText);
      try {
        const cleaned = response.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          allExtracted.push(...parsed);
        }
      } catch (parseErr) {
        // Fallback simple regex extraction if model didn't return strict JSON
        const matches = response.match(/"text"\s*:\s*"([^"]+)"\s*,\s*"kind"\s*:\s*"(name|address)"/g);
        if (matches) {
          for (const m of matches) {
            const t = m.match(/"text"\s*:\s*"([^"]+)"/);
            const k = m.match(/"kind"\s*:\s*"(name|address)"/);
            if (t && k) {
              allExtracted.push({ text: t[1], kind: k[1] });
            }
          }
        }
      }
    }

    if (typeof onProgress === 'function') {
      onProgress({ status: 'validating', progress: 0.95 });
    }

    // STRICT ANTI-HALLUCINATION FILTER: Only retain items that literally appear in sourceText
    const validated = validateNanoEntities(allExtracted, sourceText);

    if (typeof onProgress === 'function') {
      onProgress({ status: 'done', progress: 1.0 });
    }

    return validated;
  } finally {
    if (session && typeof session.destroy === 'function') {
      session.destroy();
    }
  }
}

/**
 * Detects the document language using Chrome's built-in on-device Translation/LanguageDetector API.
 * @param {string} text 
 * @returns {Promise<string|null>} Language code (e.g. 'en', 'hi') or null if unavailable
 */
export async function detectDocumentLanguage(text) {
  if (!text || typeof window === 'undefined') return null;

  try {
    const detectorFactory = window.translation?.canDetect ? window.translation : window.ai?.languageDetector;
    if (!detectorFactory) return null;

    let canDetect = null;
    if (typeof detectorFactory.canDetect === 'function') {
      canDetect = await detectorFactory.canDetect();
    } else if (typeof detectorFactory.capabilities === 'function') {
      const caps = await detectorFactory.capabilities();
      canDetect = caps.available;
    }

    if (canDetect === 'no' || canDetect === 'none') return null;

    let detector = null;
    if (typeof detectorFactory.createDetector === 'function') {
      detector = await detectorFactory.createDetector();
    } else if (typeof detectorFactory.create === 'function') {
      detector = await detectorFactory.create();
    }

    if (!detector || typeof detector.detect !== 'function') return null;

    const sample = text.substring(0, 1000);
    const results = await detector.detect(sample);
    if (Array.isArray(results) && results.length > 0) {
      return results[0].detectedLanguage || results[0].language || null;
    }
    return null;
  } catch (e) {
    // Silent degradation
    return null;
  }
}

/**
 * Fixed synthetic prompts for Gemini API test data generation.
 * NEVER contains user text. Kept strictly privacy-safe.
 */
export const SYNTHETIC_PROMPTS = {
  placementCSV: `Generate a realistic fictional CSV table representing an Indian college placement shortlist with 6 students.
The columns MUST be exactly: Name,Email,Phone,Aadhaar,PAN,Fee refund card,Notes.
Requirements:
1. All data must be completely fictional.
2. Include realistic Indian names (e.g., Rajesh Iyer, Pooja Nair, etc.).
3. Mix standard emails and disguised emails (e.g. user [at] domain [dot] in).
4. Include valid 10-digit Indian phone numbers with prefixes like +91 or spaced digits.
5. Include valid 12-digit Aadhaar numbers and valid 10-character PANs.
6. Include test credit card numbers and 1 trap card that fails Luhn.
7. Return ONLY raw CSV text with headers. Do NOT include markdown fences, preambles, or explanations.`,

  supportTicket: `Generate a realistic fictional customer support escalation ticket from an Indian university or service portal.
Requirements:
1. Format as an unstructured support ticket log.
2. Include student/customer name, problem description, email, mobile number, masked transaction details.
3. Include an Aadhaar reference and a PAN reference.
4. Include at least one disguised email (e.g., name(at)domain.com).
5. All data must be completely fictional.
6. Return ONLY the raw ticket text without markdown code blocks or explanations.`
};

/**
 * Calls Gemini API (Google AI Studio) to generate fresh fictional test datasets.
 * Privacy Guarantee: The prompt sent is 100% hardcoded and contains ZERO user text.
 * API key is passed in memory only and never stored or logged.
 * 
 * @param {'placementCSV'|'supportTicket'} type 
 * @param {string} apiKey User-provided Google AI Studio API key
 * @returns {Promise<string>} Generated synthetic dataset
 */
export async function generateSyntheticData(type, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error('Google AI Studio API key is required to generate fresh test data.');
  }

  const prompt = SYNTHETIC_PROMPTS[type] || SYNTHETIC_PROMPTS.placementCSV;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `Gemini API error: HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  // Clean markdown fences if any returned
  return text.replace(/^```[a-zA-Z]*\n/i, '').replace(/\n```$/i, '').trim();
}
