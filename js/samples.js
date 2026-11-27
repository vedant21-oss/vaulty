/**
 * @file samples.js
 * @description Built-in noisy test datasets for Andhaar.
 * Contains both valid sensitive PII and carefully planted decoys/traps to test validation algorithms.
 */

'use strict';

/**
 * Built-in Sample 1: placement_shortlist.csv
 * Contains 6 students, mixed formats, Devanagari digits, spaced digits, disguised emails,
 * and deliberate decoy traps (order ID failing Luhn, roll number failing Verhoeff, invalid PAN, invalid IP).
 */
export const SAMPLE_CSV = `Name,Email,Phone,Aadhaar,PAN,Fee refund card,Notes
Amit Sharma,amit.sharma@college.ac.in,+91 98765 43210,2345 6789 0124,ABCPE1234F,4532 0151 1283 0366,Shortlisted for Cloud Native role
Priya Patel,priya.patel [at] techcorp [dot] in,9 8 7 6 5 4 3 2 1 0,3456-7890-1238,XYZCE9876K,5500-0000-0000-0004,Interview scheduled. Disguised email used.
Rahul Verma,rahul(at)startup.co,९८७६५४३२१०,4567 8901 2341,AAAFE5555L,6071000000000001,Devanagari phone digits provided in hostel register
Sneha Kulkarni,amit.sharma@college.ac.in,9123456780,5678 9012 3458,PQRHE4321M,3782-822463-10005,Referred by Amit (same email should map to same nickname)
Vikash Kumar,vikash at company dot in,9876543211,234567890123,ABCXE1234F,1234 5678 9012 3456,"Traps: Order 1234567890123456 (Luhn fail), Roll 234567890123 (Verhoeff fail), Gateway 300.1.2.3"
Ananya Deshmukh,ananya@institute.edu,09876543212,6789 0123 4560,KLMTE7890N,4532 0151 1283 0366,Meeting at 10:30:00 on IPv6 2001:0db8:85a3:0000:0000:8a2e:0370:7334`;

/**
 * Built-in Sample 2: support_ticket.txt
 * Customer support escalation log with multi-line unstructured notes, disguised PII, and traps.
 */
export const SAMPLE_TXT = `================================================================================
TICKET #78491 - SECURE ESCALATION LOG - PENDING RESOLUTION
================================================================================
Timestamp: 2026-11-27 10:30:00 IST
Department: Placement & Accounts Cell
Priority: High

Customer Details:
- Student Name: Siddharth Narayan
- Primary Email: siddharth.narayan@example.com
- Alt Email (Disguised): siddharth.narayan [at] example [dot] com
- Primary Mobile: +91 98765 12340
- Secondary Mobile (Hostel WhatsApp): ९८७६५ ४३२१०
- Identity Document (Aadhaar): 7890 1234 5674
- Tax Identifier (PAN): BDFPE9012K

Transaction Issue:
Student requested fee refund for campus certification exam.
Initial refund attempt to Visa card 4532 0151 1283 0366 failed at gateway 192.168.1.105.
Student provided backup Amex card 3782 822463 10005.

Verification Audit & Trap Log:
1. Student submitted internal requisition token: 9876543210987654 (16 digits, but fails Luhn check - order reference only).
2. Internal student roll number 345678901239 recorded (12 digits, but Verhoeff checksum fails - not an Aadhaar).
3. Partner institution PAN submitted: MNPXE4567Q (rejected: 4th letter 'X' is invalid holder type).
4. System proxy gateway reported as 300.10.20.1 (rejected: 300 is above 255).
5. Backup server IPv6 address fe80::1ff:fe23:4567:890a verified.
6. Note: Reminder to meet at office.Tomorrow at 10:30:00 is conversational text, not an email or IP.

Status: Ready for sanitisation before sharing with external verification auditors.`;
