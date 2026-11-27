/**
 * @file hero3d.js
 * @description The 3D hero: a sample ID card hanging from a lanyard. A scan line
 * sweeps down the card and blacks out each private number, then a "Safe to share"
 * stamp lands. Drag to turn the card. Built with three.js (bundled locally so the
 * page's strict security policy can stay "scripts from this site only").
 */

'use strict';

import * as THREE from './vendor/three.module.min.js';

const stage = document.getElementById('hero-stage');
const canvas = document.getElementById('hero-canvas');
const replayBtn = document.getElementById('hero-replay');
const pauseBtn = document.getElementById('hero-pause');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- card face drawn on a 2D canvas, used as a texture ---------- */
const TEX_W = 1024;
const TEX_H = 650;
const INK = '#161614';
const MUTED = '#8A8A82';
const ACCENT = '#F2672E';
const SAFE = '#1E8E5A';

const FIELDS = [
  { label: 'NAME', value: 'Priya Patel', font: '600 40px Geist, sans-serif', redact: false },
  { label: 'AADHAAR', value: '2345 6789 0124', font: '500 38px "Geist Mono", monospace', redact: true },
  { label: 'PAN', value: 'ABCPE1234F', font: '500 38px "Geist Mono", monospace', redact: true },
  { label: 'PHONE', value: '+91 98765 43210', font: '500 38px "Geist Mono", monospace', redact: true }
];
const ROW_TOP = 150;
const ROW_GAP = 104;
const SCAN_FROM = 112;
const SCAN_TO = 586;

const faceCanvas = document.createElement('canvas');
faceCanvas.width = TEX_W;
faceCanvas.height = TEX_H;
const fctx = faceCanvas.getContext('2d');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function drawFace(s) {
  const c = fctx;
  c.save();
  c.clearRect(0, 0, TEX_W, TEX_H);
  c.fillStyle = '#FAFAF7';
  c.fillRect(0, 0, TEX_W, TEX_H);

  // faint security pattern
  c.strokeStyle = 'rgba(242, 103, 46, 0.09)';
  c.lineWidth = 1.5;
  for (let r = 40; r < 520; r += 18) {
    c.beginPath();
    c.arc(TEX_W + 40, TEX_H * 0.35, r, 0, Math.PI * 2);
    c.stroke();
  }

  // header
  c.textBaseline = 'alphabetic';
  c.font = '500 19px "Geist Mono", monospace';
  spaced(c, 3);
  c.fillStyle = MUTED;
  c.textAlign = 'left';
  c.fillText('SAMPLE ID CARD', 56, 70);
  c.fillStyle = ACCENT;
  c.textAlign = 'right';
  c.fillText('NOT A REAL ID', TEX_W - 56, 70);
  c.textAlign = 'left';
  c.fillStyle = '#E2E1DA';
  c.fillRect(56, 108, TEX_W - 112, 2);

  // photo
  roundRect(c, 56, 150, 200, 250, 16);
  c.fillStyle = '#ECEBE5';
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = '#CFCEC6';
  c.beginPath();
  c.arc(156, 245, 50, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(156, 410, 98, 92, 0, Math.PI, 0);
  c.fill();
  c.restore();

  // fields
  FIELDS.forEach((f, i) => {
    const ly = ROW_TOP + i * ROW_GAP;
    const vy = ly + 52;
    c.font = '500 17px "Geist Mono", monospace';
    spaced(c, 2.5);
    c.fillStyle = MUTED;
    c.fillText(f.label, 300, ly + 6);

    c.font = f.font;
    spaced(c, 0);
    const w = c.measureText(f.value).width;
    const p = s.bars[i] || 0;

    if (f.redact && p > 0 && p < 1) {
      c.fillStyle = 'rgba(242, 103, 46, 0.22)';
      roundRect(c, 292, vy - 36, w + 16, 48, 6);
      c.fill();
    }
    c.fillStyle = INK;
    c.fillText(f.value, 300, vy);

    if (f.redact && p > 0) {
      c.fillStyle = INK;
      roundRect(c, 293, vy - 35, Math.max(8, (w + 14) * easeOut(p)), 46, 5);
      c.fill();
    }
  });

  // bottom band
  c.fillStyle = INK;
  c.fillRect(0, TEX_H - 64, TEX_W, 64);
  c.font = '600 30px Geist, sans-serif';
  spaced(c, -1);
  c.fillStyle = '#FAFAF7';
  const by = TEX_H - 22;
  c.fillText('va', 56, by);
  const anW = c.measureText('va').width;
  const dhW = c.measureText('ul').width;
  c.fillRect(56 + anW + 2, by - 22, dhW, 24);
  c.fillText('ty', 56 + anW + dhW + 4, by);
  const aarW = c.measureText('ty').width;
  c.fillStyle = ACCENT;
  c.fillRect(56 + anW + dhW + aarW + 7, by - 6, 7, 7);
  c.font = '500 15px "Geist Mono", monospace';
  spaced(c, 2.5);
  c.fillStyle = '#9C9B93';
  c.textAlign = 'right';
  c.fillText('PRIVACY · ON DEVICE', TEX_W - 56, by - 3);
  c.textAlign = 'left';

  // scan line
  if (s.scanY !== null) {
    const g = c.createLinearGradient(0, s.scanY - 70, 0, s.scanY);
    g.addColorStop(0, 'rgba(242, 103, 46, 0)');
    g.addColorStop(1, 'rgba(242, 103, 46, 0.28)');
    c.fillStyle = g;
    c.fillRect(0, s.scanY - 70, TEX_W, 70);
    c.fillStyle = ACCENT;
    c.fillRect(0, s.scanY - 2, TEX_W, 4);
  }

  // stamp
  if (s.stamp > 0) {
    c.save();
    c.globalAlpha = s.stamp;
    c.translate(156, 478);
    c.rotate(-0.14);
    const sc = 1 + (1 - s.stamp) * 0.35;
    c.scale(sc, sc);
    c.strokeStyle = SAFE;
    c.lineWidth = 4;
    roundRect(c, -112, -32, 224, 64, 10);
    c.stroke();
    c.font = '600 22px "Geist Mono", monospace';
    spaced(c, 3);
    c.fillStyle = SAFE;
    c.textAlign = 'center';
    c.fillText('SAFE TO SHARE', 0, 8);
    c.restore();
  }
  c.restore();
}

function drawBack(ctx) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = '#2A2A27';
  ctx.fillRect(0, 150, TEX_W, 90);
  ctx.font = '600 64px Geist, sans-serif';
  spaced(ctx, -2);
  ctx.fillStyle = '#FAFAF7';
  ctx.textAlign = 'center';
  ctx.fillText('vaulty', TEX_W / 2, 400);
  ctx.fillStyle = ACCENT;
  const w = ctx.measureText('vaulty').width;
  ctx.fillRect(TEX_W / 2 + w / 2 + 6, 386, 14, 14);
  ctx.font = '500 18px "Geist Mono", monospace';
  spaced(ctx, 3);
  ctx.fillStyle = '#8A8A82';
  ctx.fillText('YOUR SECRETS, KEPT IN THE VAULT', TEX_W / 2, 460);
}

function makeRibbonTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = ACCENT;
  x.fillRect(0, 0, 64, 1024);
  x.save();
  x.translate(32, 0);
  x.rotate(Math.PI / 2);
  x.font = '600 30px Geist, sans-serif';
  spaced(x, 1);
  x.fillStyle = 'rgba(255,255,255,0.92)';
  for (let y = 40; y < 1024; y += 210) {
    x.fillText('vaulty', y, 10);
    x.fillRect(y + 128, -2, 10, 10);
  }
  x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- animation timeline (seconds, loops) ---------- */
const CYCLE = 10;
function stateAt(T) {
  const scanDur = 2.0;
  const scanStart = 1.0;
  const scanT = (T - scanStart) / scanDur;
  const scanY = scanT >= 0 && scanT <= 1 ? SCAN_FROM + (SCAN_TO - SCAN_FROM) * scanT : null;
  const bars = FIELDS.map((f, i) => {
    if (!f.redact) return 0;
    const vy = ROW_TOP + i * ROW_GAP + 52;
    const trigger = scanStart + scanDur * ((vy - 36 - SCAN_FROM) / (SCAN_TO - SCAN_FROM));
    if (T < 7.6) return clamp01((T - trigger) / 0.35);
    return 1 - clamp01((T - 7.6 - i * 0.08) / 0.45);
  });
  let stamp = clamp01((T - 3.3) / 0.35);
  if (T > 7.0) stamp = 1 - clamp01((T - 7.0) / 0.4);
  return { scanY, bars, stamp };
}
const FINAL_STATE = { scanY: null, bars: [0, 1, 1, 1], stamp: 1 };

/* ---------- three.js scene ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  stage.classList.add('no-webgl');
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d6cc, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3.5, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffe2d1, 0.8);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  // soft contact shadow under the card (cheaper and calmer than a shadow map)
  const blobCanvas = document.createElement('canvas');
  blobCanvas.width = 256;
  blobCanvas.height = 256;
  const bctx = blobCanvas.getContext('2d');
  const grad = bctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = grad;
  bctx.fillRect(0, 0, 256, 256);
  const floorMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false, opacity: 0.45 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.3), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.85;
  scene.add(floor);

  // swing pivot sits high above, card hangs below it
  const PIVOT_Y = 9;
  const pivot = new THREE.Group();
  pivot.position.y = PIVOT_Y;
  scene.add(pivot);
  const hang = new THREE.Group();
  hang.position.y = -PIVOT_Y;
  pivot.add(hang);

  // card body
  const CW = 3.4;
  const CH = 2.16;
  const CR = 0.16;
  const DEPTH = 0.05;
  const shape = new THREE.Shape();
  shape.moveTo(-CW / 2 + CR, -CH / 2);
  shape.lineTo(CW / 2 - CR, -CH / 2);
  shape.quadraticCurveTo(CW / 2, -CH / 2, CW / 2, -CH / 2 + CR);
  shape.lineTo(CW / 2, CH / 2 - CR);
  shape.quadraticCurveTo(CW / 2, CH / 2, CW / 2 - CR, CH / 2);
  shape.lineTo(-CW / 2 + CR, CH / 2);
  shape.quadraticCurveTo(-CW / 2, CH / 2, -CW / 2, CH / 2 - CR);
  shape.lineTo(-CW / 2, -CH / 2 + CR);
  shape.quadraticCurveTo(-CW / 2, -CH / 2, -CW / 2 + CR, -CH / 2);
  // lanyard slot
  const SLOT_Y = CH / 2 - 0.18;
  const slot = new THREE.Path();
  const sw = 0.25;
  const sh = 0.05;
  slot.moveTo(-sw + sh, SLOT_Y - sh);
  slot.lineTo(sw - sh, SLOT_Y - sh);
  slot.absarc(sw - sh, SLOT_Y, sh, -Math.PI / 2, Math.PI / 2, false);
  slot.lineTo(-sw + sh, SLOT_Y + sh);
  slot.absarc(-sw + sh, SLOT_Y, sh, Math.PI / 2, Math.PI * 1.5, false);
  shape.holes.push(slot);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24
  });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xe9e8e1, roughness: 0.55 }));

  // faces: rounded shape with UVs mapped to the card rectangle
  function faceGeometry() {
    const g = new THREE.ShapeGeometry(shape, 24);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + CW / 2) / CW, (pos.getY(i) + CH / 2) / CH);
    }
    uv.needsUpdate = true;
    return g;
  }

  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const front = new THREE.Mesh(faceGeometry(), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.42 }));
  front.position.z = DEPTH / 2 + 0.0135;

  const backCanvas = document.createElement('canvas');
  backCanvas.width = TEX_W;
  backCanvas.height = TEX_H;
  const backTex = new THREE.CanvasTexture(backCanvas);
  backTex.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.Mesh(faceGeometry(), new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5 }));
  back.rotation.y = Math.PI;
  back.position.z = -DEPTH / 2 - 0.0135;

  const card = new THREE.Group();
  card.add(body, front, back);

  // clip + ring
  const metal = new THREE.MeshStandardMaterial({ color: 0xcfcec8, metalness: 0.55, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 12, 40), metal);
  ring.position.set(0, SLOT_Y + 0.08, 0);
  ring.rotation.y = Math.PI / 2;
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.07), metal);
  clip.position.set(0, SLOT_Y + 0.3, 0);

  // the twist group turns the card around the lanyard
  const twist = new THREE.Group();
  twist.add(card, ring, clip);
  hang.add(twist);

  // lanyard ribbons in a V up to the pivot
  const ribbonTex = makeRibbonTexture();
  const ribbonMat = new THREE.MeshStandardMaterial({ map: ribbonTex, roughness: 0.75, side: THREE.DoubleSide });
  const clipTop = SLOT_Y + 0.4;
  [-1, 1].forEach((side) => {
    const x0 = side * 0.08;
    const x1 = side * 0.95;
    const y0 = clipTop;
    const y1 = PIVOT_Y + 0.5;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const tex = ribbonTex.clone();
    tex.repeat.set(1, len / 4);
    tex.needsUpdate = true;
    const mat = ribbonMat.clone();
    mat.map = tex;
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.2, len), mat);
    r.position.set((x0 + x1) / 2, (y0 + y1) / 2, side * 0.01);
    r.rotation.z = -Math.atan2(x1 - x0, y1 - y0);
    r.rotation.y = side * 0.35;
    hang.add(r);
  });

  /* ---------- sizing ---------- */
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    // keep the card about 40% of the width on desktop, ~80% on phones
    const narrow = w < 760;
    const targetWidth = narrow ? CW / 0.74 : CW / 0.4;
    const distForWidth = targetWidth / (2 * Math.tan(vFov / 2) * camera.aspect);
    const distForHeight = (CH * 2.6) / (2 * Math.tan(vFov / 2));
    const dist = narrow ? distForWidth : Math.max(distForWidth, distForHeight);
    camera.position.set(0, 0.25, dist);
    camera.lookAt(0, -0.05, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  /* ---------- drag to turn ---------- */
  let dragging = false;
  let lastX = 0;
  let spin = 0;          // user-added rotation
  let spinVel = 0;
  let pointerX = 0;
  let pointerY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    spinVel = dx * 0.012;
    spin += spinVel;
  });
  const endDrag = () => {
    dragging = false;
    canvas.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ---------- controls ---------- */
  let paused = reduceMotion;
  let T = reduceMotion ? 4 : 0;
  let lastKey = '';

  function setPaused(p) {
    paused = p;
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.setAttribute('aria-label', p ? 'Play the animation' : 'Pause the animation');
    pauseBtn.querySelector('.i-pause').classList.toggle('hidden', p);
    pauseBtn.querySelector('.i-play').classList.toggle('hidden', !p);
  }
  setPaused(paused);
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  replayBtn.addEventListener('click', () => {
    T = 0;
    spin = 0;
    spinVel = 0;
    if (paused && !reduceMotion) setPaused(false);
  });

  function paint(s) {
    const k = `${s.scanY === null ? '-' : Math.round(s.scanY)}|${s.bars.map((b) => b.toFixed(2)).join(',')}|${s.stamp.toFixed(2)}`;
    if (k === lastKey) return;
    lastKey = k;
    drawFace(s);
    faceTex.needsUpdate = true;
  }

  function paintAll() {
    lastKey = '';
    drawBack(backCanvas.getContext('2d'));
    backTex.needsUpdate = true;
    ribbonTex.needsUpdate = true;
    paint(reduceMotion ? FINAL_STATE : stateAt(T));
  }
  paintAll();
  if (document.fonts && document.fonts.ready) {
    Promise.all([
      document.fonts.load('600 40px Geist'),
      document.fonts.load('500 38px "Geist Mono"')
    ]).catch(() => {}).finally(() => {
      const fresh = makeRibbonTexture();
      ribbonTex.image = fresh.image;
      hang.children.forEach((m) => {
        if (m.material && m.material.map && m.material.map !== faceTex) {
          m.material.map.image = fresh.image;
          m.material.map.needsUpdate = true;
        }
      });
      paintAll();
    });
  }

  document.addEventListener('vaulty:theme', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    floorMat.opacity = dark ? 0.9 : 0.45;
  });
  if (document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    floorMat.opacity = 0.9;
  }

  /* ---------- loop (only while the hero is on screen) ---------- */
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) requestAnimationFrame(frame);
  }).observe(stage);

  const clock = new THREE.Clock();
  let elapsed = 0;

  function frame() {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    if (!paused) {
      T = (T + dt) % CYCLE;
      paint(stateAt(T));
    }

    const t = reduceMotion ? 0 : elapsed;
    pivot.rotation.z = Math.sin(t * 0.8) * 0.03;
    pivot.rotation.x = Math.sin(t * 0.6) * 0.015;

    if (!dragging) {
      spinVel *= 0.94;
      spin += spinVel;
      spin *= 0.985; // ease back toward the front
    }
    const idle = reduceMotion ? 0 : Math.sin(t * 0.5) * 0.22;
    const targetY = -0.32 + idle + spin + pointerX * 0.12;
    twist.rotation.y += (targetY - twist.rotation.y) * 0.08;
    twist.rotation.x += ((-0.06 + pointerY * 0.06) - twist.rotation.x) * 0.06;
    twist.rotation.z = -0.05;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
