/**
 * @file landing.js
 * @description Landing page behaviour: nav, scroll reveals, the scroll-driven
 * "How it works" document, and the live playground. The playground runs the
 * real Vaulty engine in this tab — nothing is sent anywhere.
 */

'use strict';

import { detectPII, redactText, createPartialMask } from './engine.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- nav ---------- */
const nav = document.getElementById('nav');
const onScrollNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

const menuBtn = document.getElementById('nav-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
menuBtn.addEventListener('click', () => {
  const open = mobileMenu.hasAttribute('hidden');
  mobileMenu.toggleAttribute('hidden', !open);
  menuBtn.setAttribute('aria-expanded', String(open));
});
mobileMenu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    mobileMenu.setAttribute('hidden', '');
    menuBtn.setAttribute('aria-expanded', 'false');
  }
});

/* ---------- generic reveal ---------- */
const revealIO = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-in');
      revealIO.unobserve(entry.target);
    }
  }
}, { rootMargin: '0px 0px -10% 0px' });

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 70}ms`;
  revealIO.observe(el);
});

/* ---------- statement: words light up as you scroll, private bits get blacked out ---------- */
const statement = document.getElementById('statement-text');
(function splitWords() {
  const walk = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          frag.appendChild(span);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    }
  };
  walk(statement);
})();
const words = Array.from(statement.querySelectorAll('.w'));
const marks = Array.from(statement.querySelectorAll('mark'));

function updateStatement() {
  const rect = statement.getBoundingClientRect();
  const vh = window.innerHeight;
  const progress = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / (rect.height + vh * 0.35)));
  const lit = reduceMotion ? words.length : Math.round(progress * words.length * 1.15);
  words.forEach((w, i) => w.classList.toggle('on', i < lit));
  marks.forEach((m) => {
    const lastWord = m.querySelector('.w:last-child');
    const idx = words.indexOf(lastWord);
    m.classList.toggle('on', reduceMotion || (idx > -1 && lit > idx + 3));
  });
}

/* ---------- How it works: document changes as you scroll the steps ---------- */
const HOW_TEXT = `From: accounts@college.ac.in
Subject: Refund for a student

Hi team, please process this refund today.

Aadhaar   2345 6789 0124
PAN       ABCPE1234F
Card      4532 0151 1283 0366
Phone     +91 98765 43210

Order ref 1234567890123456 (not a card)`;

const howDoc = document.getElementById('how-doc');
const howBody = document.getElementById('how-doc-body');
const howStatus = document.getElementById('how-status');
const howProgress = document.getElementById('how-progress');
const howSteps = Array.from(document.querySelectorAll('.how-step'));
const howList = document.querySelector('.how-steps');

(function renderHowDoc() {
  const { findings } = detectPII(HOW_TEXT);
  let html = '';
  let last = 0;
  for (const f of findings) {
    if (f.start < last) continue;
    html += escapeHTML(HOW_TEXT.slice(last, f.start));
    html += `<span class="pii" data-t="${f.type}">${escapeHTML(HOW_TEXT.slice(f.start, f.end))}</span>`;
    last = f.end;
  }
  html += escapeHTML(HOW_TEXT.slice(last));
  howBody.innerHTML = html;
})();

const STATUS = { 1: 'Added', 2: 'Private items found', 3: 'Safe to share' };
let currentStep = 1;

function updateHow() {
  const vh = window.innerHeight;
  const center = vh * 0.55;
  let active = 1;
  const narrow = window.innerWidth <= 760;
  howSteps.forEach((step) => {
    // On phones the document sits on top, so switch when the heading shows up below it
    const probe = narrow ? step.querySelector('h3') : step;
    const line = narrow ? vh * 0.8 : center;
    if (probe.getBoundingClientRect().top < line) active = Number(step.dataset.step);
  });
  if (active !== currentStep) {
    currentStep = active;
    howDoc.dataset.step = String(active);
    howStatus.textContent = STATUS[active];
    howSteps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === active));
  }
  const lr = howList.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (center - lr.top) / lr.height));
  howProgress.style.width = `${(p * 100).toFixed(1)}%`;
}

/* ---------- one rAF-throttled scroll loop ---------- */
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    updateStatement();
    updateHow();
    ticking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ---------- playground ---------- */
const PG_SAMPLE = `Hi, I'm Rahul. My Aadhaar is 4567 8901 2341 and PAN is AAAFE5555L.
Call me on ९८७६५४३२१० or 9 8 7 6 5 4 3 2 1 0.
Mail me at rahul(at)startup.co
Refund card: 5500-0000-0000-0004
Order no. 1234567890123456 is just an order, not a card.`;

const pgInput = document.getElementById('pg-input');
const pgOutput = document.getElementById('pg-output');
const pgCount = document.getElementById('pg-count');
const pgModeBtns = Array.from(document.querySelectorAll('[data-pg-mode]'));
let pgMode = 'pseudonym';

function renderPlayground() {
  const text = pgInput.value;
  const { findings, ignored } = detectPII(text);
  const { pseudonymMap } = redactText(text, findings, pgMode);

  let html = '';
  let last = 0;
  for (const f of findings) {
    if (f.start < last) continue;
    html += escapeHTML(text.slice(last, f.start));
    let rep;
    if (pgMode === 'full') rep = '[REDACTED]';
    else if (pgMode === 'partial') rep = createPartialMask(f);
    else rep = pseudonymMap[f.normalisedKey || f.value] || '[REDACTED]';
    html += `<span class="r">${escapeHTML(rep)}</span>`;
    last = f.end;
  }
  html += escapeHTML(text.slice(last));
  pgOutput.innerHTML = html || '<span class="muted">Your safe copy shows up here.</span>';

  const n = findings.length;
  const s = ignored.length;
  pgCount.textContent = `${n} private ${n === 1 ? 'item' : 'items'} hidden` + (s ? ` · ${s} set aside` : '');
}

let pgTimer;
pgInput.value = PG_SAMPLE;
pgInput.addEventListener('input', () => {
  clearTimeout(pgTimer);
  pgTimer = setTimeout(renderPlayground, 90);
});
pgModeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    pgMode = btn.dataset.pgMode;
    pgModeBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
    });
    renderPlayground();
  });
});
renderPlayground();
