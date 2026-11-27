/**
 * @file engine.test.js
 * @description Comprehensive unit tests for NEWNAME PII sanitisation engine.
 * Run with: node --test tests/engine.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLuhn,
  validateVerhoeff,
  generateVerhoeff,
  detectCardBrand,
  normalizeDevanagariDigits,
  normalizeEmail,
  normalizePhone,
  normalizePAN,
  validateIPv4,
  validateIPv6,
  detectPII,
  calculateExposureScore,
  createPartialMask,
  redactText,
  restoreText,
  parseCSV,
  formatCSV,
  hideCSVColumn,
  validateNanoEntities,
  encryptKeyMap,
  decryptKeyMap,
  generateAuditReport,
  computeSHA256
} from '../js/engine.js';
import { SAMPLE_CSV, SAMPLE_TXT } from '../js/samples.js';
import { SYNTHETIC_PROMPTS } from '../js/gemini.js';

test('1. Luhn validation: accepts valid cards, rejects invalid cards', () => {
  // Public test card numbers
  assert.equal(validateLuhn('4532 0151 1283 0366'), true); // Visa
  assert.equal(validateLuhn('3782 822463 10005'), true);   // Amex
  assert.equal(validateLuhn('5500 0000 0000 0004'), true); // Mastercard
  assert.equal(validateLuhn('6071 0000 0000 0001'), true); // RuPay

  // Invalid card / order number
  assert.equal(validateLuhn('1234 5678 9012 3456'), false);
  assert.equal(validateLuhn('9876543210987654'), false);
});

test('2. Card brand detection identifies Visa, Mastercard, Amex, RuPay', () => {
  assert.equal(detectCardBrand('4532 0151 1283 0366'), 'Visa');
  assert.equal(detectCardBrand('5500 0000 0000 0004'), 'Mastercard');
  assert.equal(detectCardBrand('3782 822463 10005'), 'Amex');
  assert.equal(detectCardBrand('6071 0000 0000 0001'), 'RuPay');
});

test('3. Verhoeff validation: accepts valid Aadhaar checksum, rejects corrupted digit', () => {
  const base = '23456789012';
  const checkDigit = generateVerhoeff(base);
  const validAadhaar = base + checkDigit;
  assert.equal(validateVerhoeff(validAadhaar), true);

  // Alter last digit
  const invalidAadhaar = base + ((checkDigit + 1) % 10);
  assert.equal(validateVerhoeff(invalidAadhaar), false);
});

test('4. Disguised emails map to standard form and share exact same normalised key', () => {
  const e1 = 'siddharth.narayan@example.com';
  const e2 = 'siddharth.narayan [at] example [dot] com';
  const e3 = 'siddharth.narayan(at)example.com';
  const e4 = 'siddharth.narayan at example dot com';

  assert.equal(normalizeEmail(e1), 'siddharth.narayan@example.com');
  assert.equal(normalizeEmail(e2), 'siddharth.narayan@example.com');
  assert.equal(normalizeEmail(e3), 'siddharth.narayan@example.com');
  assert.equal(normalizeEmail(e4), 'siddharth.narayan@example.com');
});

test('5. Natural conversational text "meet at office.Tomorrow" is NOT detected as an email', () => {
  const text = 'We should meet at office.Tomorrow morning at 10 AM.';
  const { findings } = detectPII(text);
  const emailFindings = findings.filter(f => f.type === 'email');
  assert.equal(emailFindings.length, 0);
});

test('6. Indian phone formats detected: +91, 0091, 91, 0, spaces, and dashes', () => {
  const text = 'Contact +91 98765 43210 or 0091-98765-43210 or 919876543210 or 09876543210.';
  const { findings } = detectPII(text);
  const phones = findings.filter(f => f.type === 'phone');
  assert.equal(phones.length, 4);
  for (const p of phones) {
    assert.equal(p.normalisedKey, '9876543210');
  }
});

test('7. Fully spaced phone digits "9 8 7 6 5 4 3 2 1 0" are detected', () => {
  const text = 'Candidate WhatsApp: 9 8 7 6 5 4 3 2 1 0';
  const { findings } = detectPII(text);
  const phones = findings.filter(f => f.type === 'phone');
  assert.equal(phones.length, 1);
  assert.equal(phones[0].normalisedKey, '9876543210');
  assert.equal(phones[0].flags.spaced, true);
});

test('8. Devanagari digits (०-९) normalised to ASCII while maintaining identical string length and offsets', () => {
  const devanagariPhone = '९८७६५४३२१०';
  const normalized = normalizeDevanagariDigits(devanagariPhone);
  assert.equal(normalized, '9876543210');
  assert.equal(normalized.length, devanagariPhone.length);

  const text = 'Student helpline: ९८७६५ ४३२१०';
  const { findings } = detectPII(text);
  const phones = findings.filter(f => f.type === 'phone');
  assert.equal(phones.length, 1);
  assert.equal(phones[0].normalisedKey, '9876543210');
  assert.equal(phones[0].flags.devanagari, true);
  // Ensure substring at [start, end] matches original text
  assert.equal(text.substring(phones[0].start, phones[0].end), '९८७६५ ४३२१०');
});

test('9. Non-phone numbers ignored: pincode, year, and currency amounts', () => {
  const text = 'In 2026, the pin code is 411001 and total fee is ₹50000 or $12000.';
  const { findings } = detectPII(text);
  const phones = findings.filter(f => f.type === 'phone');
  assert.equal(phones.length, 0);
});

test('10. Luhn-failing card candidates are set aside to ignored list with human reason', () => {
  const text = 'Order reference token: 1234 5678 9012 3456 was generated.';
  const { findings, ignored } = detectPII(text);
  const cardFindings = findings.filter(f => f.type === 'card');
  assert.equal(cardFindings.length, 0);

  const cardIgnored = ignored.filter(i => i.type === 'card');
  assert.equal(cardIgnored.length, 1);
  assert.match(cardIgnored[0].reason, /fails the Luhn check/i);
});

test('11. Aadhaar: must have valid Verhoeff, first digit 2-9, and never double-counted as phone', () => {
  // Valid Aadhaar
  const textValid = 'Aadhaar: 2345 6789 0124';
  const resValid = detectPII(textValid);
  assert.equal(resValid.findings.filter(f => f.type === 'aadhaar').length, 1);
  // Ensure NOT double-counted as phone
  assert.equal(resValid.findings.filter(f => f.type === 'phone').length, 0);

  // Aadhaar with Verhoeff failing -> set aside to ignored
  const textInvalidChecksum = 'Roll: 2345 6789 0123';
  const resInvalid = detectPII(textInvalidChecksum);
  assert.equal(resInvalid.findings.filter(f => f.type === 'aadhaar').length, 0);
  assert.equal(resInvalid.ignored.filter(i => i.type === 'aadhaar').length, 1);
  assert.equal(resInvalid.ignored[0].reason, 'Verhoeff checksum fails');

  // Aadhaar starting with 0 or 1 -> set aside
  const textStartsWithOne = 'Code: 1234 5678 9012';
  const resOne = detectPII(textStartsWithOne);
  assert.equal(resOne.findings.filter(f => f.type === 'aadhaar').length, 0);
  assert.equal(resOne.ignored.filter(i => i.type === 'aadhaar').length, 1);
  assert.match(resOne.ignored[0].reason, /must start with 2–9/);
});

test('12. PAN: 4th letter holder validation (P, C, H, F, A, T, B, L, J, G)', () => {
  const validPANs = ['ABCPE1234F', 'XYZCE9876K', 'AAAFE5555L', 'PQRHE4321M'];
  for (const pan of validPANs) {
    const { findings } = detectPII(`Tax ID: ${pan}`);
    assert.equal(findings.filter(f => f.type === 'pan').length, 1);
  }
});

test('13. PAN: lowercase normalization', () => {
  const text = 'Tax identifier: abcpe1234f on file.';
  const { findings } = detectPII(text);
  const pans = findings.filter(f => f.type === 'pan');
  assert.equal(pans.length, 1);
  assert.equal(pans[0].normalisedKey, 'ABCPE1234F');
});

test('14. PAN: invalid 4th letter candidate set aside to ignored list with human reason', () => {
  const text = 'Student PAN: ABCXE1234F is invalid.';
  const { findings, ignored } = detectPII(text);
  assert.equal(findings.filter(f => f.type === 'pan').length, 0);
  const panIgnored = ignored.filter(i => i.type === 'pan');
  assert.equal(panIgnored.length, 1);
  assert.equal(panIgnored[0].reason, "PAN-shaped but 'X' can't be the 4th letter");
});

test('15. IPv4: valid 0-255 octets accepted', () => {
  const text = 'Connected to server at 192.168.1.105 and 10.0.0.1';
  const { findings } = detectPII(text);
  const ips = findings.filter(f => f.type === 'ip');
  assert.equal(ips.length, 2);
});

test('16. IPv4: octet > 255 set aside to ignored list with human reason', () => {
  const text = 'Gateway proxy: 300.1.2.3 was misconfigured.';
  const { findings, ignored } = detectPII(text);
  assert.equal(findings.filter(f => f.type === 'ip').length, 0);
  const ipIgnored = ignored.filter(i => i.type === 'ip');
  assert.equal(ipIgnored.length, 1);
  assert.equal(ipIgnored[0].reason, 'IP-shaped but 300 is above 255');
});

test('17. IPv6: full and compressed (::) forms recognized', () => {
  const text = 'Primary: 2001:0db8:85a3:0000:0000:8a2e:0370:7334, secondary: fe80::1';
  const { findings } = detectPII(text);
  const ips = findings.filter(f => f.type === 'ip');
  assert.equal(ips.length, 2);
});

test('18. Clock times like 10:30:00 are NOT detected as IPs', () => {
  const text = 'Exam begins at 10:30:00 sharp.';
  const { findings } = detectPII(text);
  const ips = findings.filter(f => f.type === 'ip');
  assert.equal(ips.length, 0);
});

test('19. All three redaction modes produce exact outputs', () => {
  const text = 'Amit: amit@college.ac.in, card: 4532 0151 1283 0366, pan: ABCPE1234F';
  const { findings } = detectPII(text);

  // Full mask
  const full = redactText(text, findings, 'full');
  assert.equal(full.safeText, 'Amit: [REDACTED], card: [REDACTED], pan: [REDACTED]');

  // Partial mask
  const partial = redactText(text, findings, 'partial');
  assert.match(partial.safeText, /Amit: a\*+@college\.ac\.in, card: XXXX 0151 1283 0366|Amit: a\*+@college\.ac\.in, card: XXXX XXXX XXXX 0366/);
  assert.match(partial.safeText, /pan: XXXXXX234F/);

  // Pseudonym
  const pseudo = redactText(text, findings, 'pseudonym');
  assert.equal(pseudo.safeText, 'Amit: USER_01, card: CARD_01, pan: PAN_01');
});

test('20. Consistent pseudonymisation: disguised and plain email map to identical nickname', () => {
  const text = 'Contact john@test.com or disguised john [at] test [dot] com.';
  const { findings } = detectPII(text);
  const { safeText, pseudonymMap } = redactText(text, findings, 'pseudonym');

  // Both should be replaced by USER_01
  assert.equal(safeText, 'Contact USER_01 or disguised USER_01.');
  assert.equal(pseudonymMap['john@test.com'], 'USER_01');
});

test('21. "Let this through" retains chosen values in safe copy', () => {
  const text = 'User john@test.com with card 4532 0151 1283 0366';
  const { findings } = detectPII(text);

  // Let email through
  const letThroughKeys = new Set(['john@test.com']);
  const { safeText } = redactText(text, findings, 'pseudonym', { letThroughKeys });

  assert.equal(safeText, 'User john@test.com with card CARD_01');
});

test('22. Text restoration exactly reverses pseudonymisation', () => {
  const original = 'Priya Patel (priya@test.com) - PAN: ABCPE1234F - Phone: 9876543210';
  const { findings } = detectPII(original);
  const { safeText, reverseMap } = redactText(original, findings, 'pseudonym');

  assert.notEqual(safeText, original);
  const restored = restoreText(safeText, reverseMap);
  assert.equal(restored, original);
});

test('23. Password-locked restore with AES-256-GCM + PBKDF2: succeeds on correct password, fails on wrong', async () => {
  const keyMap = {
    USER_01: 'secret@domain.com',
    CARD_01: '4532 0151 1283 0366',
    AADHAAR_01: '2345 6789 0124'
  };

  const password = 'SuperSecurePlacementPassword2026!';
  const bundle = await encryptKeyMap(keyMap, password);

  assert.equal(bundle.tool, 'NEWNAME');
  assert.equal(bundle.iterations, 250000);
  assert.ok(bundle.salt);
  assert.ok(bundle.iv);
  assert.ok(bundle.ciphertext);

  // Successful decryption
  const decrypted = await decryptKeyMap(bundle, password);
  assert.deepEqual(decrypted, keyMap);

  // Failed decryption with wrong password
  await assert.rejects(
    async () => {
      await decryptKeyMap(bundle, 'WrongPassword123');
    },
    /Incorrect password or corrupted key file/
  );
});

test('24. CSV parser handles quotes, embedded commas, escaped quotes (""), and \\r\\n', () => {
  const csvText = 'Name,Role,Notes\r\n"Sharma, Amit",Dev,"Experienced with ""cloud"" systems"\r\nPriya,QA,"Ready, set, go"';
  const parsed = parseCSV(csvText);

  assert.equal(parsed.isCSV, true);
  assert.equal(parsed.headers.length, 3);
  assert.equal(parsed.headers[0], 'Name');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0][0], 'Sharma, Amit');
  assert.equal(parsed.rows[0][2], 'Experienced with "cloud" systems');
  assert.equal(parsed.rows[1][2], 'Ready, set, go');
});

test('25. Hide column redacts entire column and maintains valid CSV structure', () => {
  const csvText = 'Name,Email,Score\r\nAmit,amit@test.com,95\r\nPriya,priya@test.com,98';
  const modified = hideCSVColumn(csvText, 0, 'pseudonym');
  const parsed = parseCSV(modified);

  assert.equal(parsed.headers[0], 'Name');
  assert.equal(parsed.rows[0][0], 'NAME_01');
  assert.equal(parsed.rows[1][0], 'NAME_02');
  assert.equal(parsed.rows[0][1], 'amit@test.com');
});

test('26. Built-in SAMPLE_CSV finds every planted item and flags decoys', () => {
  const { findings, ignored } = detectPII(SAMPLE_CSV);

  // We should have valid emails, phones, aadhaars, pans, cards
  const emails = findings.filter(f => f.type === 'email');
  const phones = findings.filter(f => f.type === 'phone');
  const aadhaars = findings.filter(f => f.type === 'aadhaar');
  const pans = findings.filter(f => f.type === 'pan');
  const cards = findings.filter(f => f.type === 'card');
  const ips = findings.filter(f => f.type === 'ip');

  assert.ok(emails.length >= 6, `Expected at least 6 emails, got ${emails.length}`);
  assert.ok(phones.length >= 5, `Expected at least 5 phones, got ${phones.length}`);
  assert.ok(aadhaars.length >= 5, `Expected at least 5 aadhaars, got ${aadhaars.length}`);
  assert.ok(pans.length >= 5, `Expected at least 5 pans, got ${pans.length}`);
  assert.ok(cards.length >= 5, `Expected at least 5 cards, got ${cards.length}`);
  assert.ok(ips.length >= 1, `Expected at least 1 IPv6, got ${ips.length}`);

  // Decoys set aside in ignored
  const luhnFails = ignored.filter(i => /fails the Luhn check/i.test(i.reason));
  const verhoeffFails = ignored.filter(i => /Verhoeff/i.test(i.reason));
  const panFails = ignored.filter(i => /can't be the 4th letter/i.test(i.reason));
  const ipFails = ignored.filter(i => /300 is above 255/i.test(i.reason));

  assert.ok(luhnFails.length >= 1, 'Expected Luhn fail decoy in ignored');
  assert.ok(verhoeffFails.length >= 1, 'Expected Verhoeff fail decoy in ignored');
  assert.ok(panFails.length >= 1, 'Expected PAN holder fail decoy in ignored');
  assert.ok(ipFails.length >= 1, 'Expected IP > 255 decoy in ignored');
});

test('27. Built-in SAMPLE_TXT finds all planted items and flags decoys', () => {
  const { findings, ignored } = detectPII(SAMPLE_TXT);

  assert.ok(findings.some(f => f.type === 'email' && f.flags.disguised));
  assert.ok(findings.some(f => f.type === 'phone' && f.flags.devanagari));
  assert.ok(findings.some(f => f.type === 'aadhaar'));
  assert.ok(findings.some(f => f.type === 'pan'));
  assert.ok(findings.some(f => f.type === 'card'));
  assert.ok(findings.some(f => f.type === 'ip'));

  // Decoys
  assert.ok(ignored.some(i => /fails the Luhn check/i.test(i.reason)));
  assert.ok(ignored.some(i => /Verhoeff/i.test(i.reason)));
  assert.ok(ignored.some(i => /4th letter/i.test(i.reason)));
  assert.ok(ignored.some(i => /300 is above 255/i.test(i.reason)));
});

test('28. Gemini Nano output validation drops hallucinated entities (anti-hallucination)', () => {
  const sourceText = 'Contact Professor Rajesh Sharma at Department of Computer Science.';
  const rawNanoOutput = [
    { text: 'Rajesh Sharma', kind: 'name' },
    { text: 'John Doe', kind: 'name' }, // Hallucinated! Not in text
    { text: 'Department of Computer Science', kind: 'address' },
    { text: '1600 Amphitheatre Pkwy', kind: 'address' } // Hallucinated!
  ];

  const validated = validateNanoEntities(rawNanoOutput, sourceText);
  assert.equal(validated.length, 2);
  assert.equal(validated[0].text, 'Rajesh Sharma');
  assert.equal(validated[1].text, 'Department of Computer Science');
});

test('29. Synthetic test data prompts NEVER contain user text', () => {
  for (const key of Object.keys(SYNTHETIC_PROMPTS)) {
    const prompt = SYNTHETIC_PROMPTS[key];
    assert.equal(typeof prompt, 'string');
    assert.ok(prompt.includes('completely fictional') || prompt.includes('fictional CSV'));
    // Prompt must not contain dynamic user placeholders or interpolation
    assert.equal(prompt.includes('${'), false);
  }
});

test('30. Exposure risk score: weighted types, repeat half-weight, capped at 100', () => {
  // Empty
  assert.equal(calculateExposureScore([]).score, 0);

  // Single card = 30
  const cardOnly = [{ type: 'card', value: '4532 0151 1283 0366', normalisedKey: '4532015112830366' }];
  assert.equal(calculateExposureScore(cardOnly).score, 30);

  // Two different cards: 30 + 30 = 60
  const twoCards = [
    { type: 'card', value: '4532 0151 1283 0366', normalisedKey: '4532015112830366' },
    { type: 'card', value: '5500 0000 0000 0004', normalisedKey: '5500000000000004' }
  ];
  assert.equal(calculateExposureScore(twoCards).score, 60);

  // Repeated same card: 30 + 15 = 45
  const repeatedCard = [
    { type: 'card', value: '4532 0151 1283 0366', normalisedKey: '4532015112830366' },
    { type: 'card', value: '4532 0151 1283 0366', normalisedKey: '4532015112830366' }
  ];
  assert.equal(calculateExposureScore(repeatedCard).score, 45);

  // Capped at 100
  const manyItems = [
    { type: 'card', value: '1', normalisedKey: '1' },
    { type: 'card', value: '2', normalisedKey: '2' },
    { type: 'aadhaar', value: '3', normalisedKey: '3' },
    { type: 'aadhaar', value: '4', normalisedKey: '4' },
    { type: 'pan', value: '5', normalisedKey: '5' }
  ];
  assert.equal(calculateExposureScore(manyItems).score, 100);
});

test('31. Empty and whitespace-only inputs handle gracefully', () => {
  assert.deepEqual(detectPII(''), { findings: [], ignored: [] });
  assert.deepEqual(detectPII('   \n\t  '), { findings: [], ignored: [] });
  assert.equal(redactText('', []).safeText, '');
});

test('32. Performance: processes 200x sample text in under 3 seconds', () => {
  // Multiply SAMPLE_TXT 200 times
  let bigText = '';
  for (let i = 0; i < 200; i++) {
    bigText += `\n--- RECORD #${i} ---\n` + SAMPLE_TXT;
  }

  const startTime = Date.now();
  const { findings, ignored } = detectPII(bigText);
  const elapsed = Date.now() - startTime;

  assert.ok(findings.length > 1000, `Expected > 1000 findings, got ${findings.length}`);
  assert.ok(elapsed < 3000, `Execution took ${elapsed}ms, which is >= 3000ms`);
});

test('33. Audit report structure and tool field validation', async () => {
  const report = generateAuditReport({
    originalLength: 100,
    safeTextLength: 85,
    findings: [{ type: 'card' }, { type: 'pan' }],
    ignored: [{ type: 'card', reason: 'fails Luhn' }],
    mode: 'pseudonym',
    hiddenColumns: ['Name'],
    exposureBefore: 50,
    exposureAfter: 0,
    safeHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  });

  assert.equal(report.tool, 'NEWNAME');
  assert.equal(report.sanitisationMode, 'pseudonym');
  assert.equal(report.metrics.totalEntitiesDetected, 2);
  assert.equal(report.metrics.exposureScoreBefore, 50);
  assert.equal(report.metrics.exposureScoreAfter, 0);
  assert.equal(report.setAsideDecoys.length, 1);
  // Ensure no raw private values in report
  assert.equal(JSON.stringify(report).includes('4532'), false);
});
