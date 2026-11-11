// OriginPoint: The Living Ecosystem. One fictional client's business as a miniature architectural model.
// A single platform, five connected zones, one set of materials. Everything here is real geometry,
// so every scene shares identical buildings, scale and lighting logic.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Exact OriginPoint palette (AGENTS.md)
export const C = { cassis: 0x351E28, ink: 0x211218, orange: 0xFF5C34, wasabi: 0xE9F056, blue: 0xD7EFFF, sage: 0xAEB8A0, ivory: 0xF7F3EC, paper: 0xEFE8DC };

function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function stoneTexture(hex, seed = 3) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'); const r = rng(seed);
  g.fillStyle = hex; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90000; i++) { const x = r() * 1024, y = r() * 1024, a = r() * 0.07; g.fillStyle = r() > 0.5 ? `rgba(60,45,30,${a})` : `rgba(255,252,245,${a})`; g.fillRect(x, y, 1 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(90,70,50,${0.02 + r() * 0.04})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * 1024, y = r() * 1024; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 220; y += (r() - 0.2) * 120; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function screenTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 600; const g = c.getContext('2d');
  g.fillStyle = '#F7F3EC'; g.fillRect(0, 0, 1024, 600);
  g.fillStyle = '#351E28'; g.fillRect(0, 0, 1024, 62);
  g.fillStyle = '#F7F3EC'; g.fillRect(36, 22, 120, 18); g.fillStyle = '#E9F056'; g.fillRect(860, 16, 128, 30);
  g.fillStyle = '#D7EFFF'; g.fillRect(0, 62, 1024, 330);
  g.fillStyle = '#351E28'; g.fillRect(56, 120, 420, 40); g.fillRect(56, 178, 330, 40); g.fillRect(56, 236, 20, 0);
  g.fillStyle = '#211218'; g.fillRect(56, 262, 300, 12); g.fillRect(56, 286, 260, 12);
  g.fillStyle = '#351E28'; g.fillRect(56, 330, 190, 46);
  g.fillStyle = '#FF5C34'; g.beginPath(); g.arc(790, 220, 104, 0, 7); g.fill();
  g.fillStyle = '#AEB8A0'; g.beginPath(); g.moveTo(560, 392); g.bezierCurveTo(680, 330, 820, 360, 1024, 300); g.lineTo(1024, 392); g.closePath(); g.fill();
  const cols = ['#E9F056', '#FF5C34', '#AEB8A0'];
  for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.fillRect(40 + i * 322, 420, 300, 150); g.fillStyle = '#211218'; g.fillRect(60 + i * 322, 444, 150, 14); g.fillRect(60 + i * 322, 470, 200, 9); g.fillRect(60 + i * 322, 488, 170, 9); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function interiorTexture(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#F1DDBE'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(120,80,50,.16)'; g.fillRect(0, 200, 512, 56);
  g.fillStyle = 'rgba(53,30,40,.55)';
  if (kind === 'studio') { for (let i = 0; i < 4; i++) g.fillRect(30 + i * 118, 40, 86, 110); g.fillStyle = '#FF5C34'; g.fillRect(60, 60, 26, 70); g.fillStyle = '#E9F056'; g.fillRect(180, 70, 40, 60); g.fillStyle = '#AEB8A0'; g.fillRect(300, 55, 34, 85); }
  if (kind === 'ops') { for (let i = 0; i < 7; i++) { g.fillRect(24 + i * 70, 70, 46, 86); g.fillStyle = '#AEB8A0'; g.fillRect(30 + i * 70, 78, 34, 8); g.fillStyle = 'rgba(53,30,40,.55)'; } }
  if (kind === 'auto') { g.fillRect(120, 90, 270, 60); g.fillStyle = '#FF5C34'; g.beginPath(); g.arc(256, 70, 22, 0, 7); g.fill(); }
  if (kind === 'growth') { g.fillRect(40, 120, 130, 40); g.fillRect(190, 90, 130, 70); g.fillRect(340, 60, 130, 100); g.fillStyle = '#E9F056'; g.fillRect(350, 70, 40, 12); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function build({ width = 1920, height = 1080, canvas, shadowSize = 4096 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, width / height, 0.5, 400);

  // ----- materials -----
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture('#DCD2BE'), roughness: 0.86, metalness: 0 });
  const stoneLight = new THREE.MeshStandardMaterial({ map: stoneTexture('#E8E0D0', 7), roughness: 0.8 });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0xB9AE98, roughness: 0.9 });
  const plinthM = new THREE.MeshStandardMaterial({ color: C.cassis, roughness: 0.55, metalness: 0.15 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xBFC4CA, roughness: 0.28, metalness: 1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xE6F4FF, roughness: 0.06, transmission: 0.92, thickness: 0.25, ior: 1.45, transparent: true, opacity: 1, envMapIntensity: 1.4 });
  const frosted = new THREE.MeshPhysicalMaterial({ color: C.blue, roughness: 0.55, transmission: 0.55, thickness: 0.3, ior: 1.4 });
  const resin = (hex) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0 });
  const mOrange = resin(C.orange), mWasabi = resin(C.wasabi), mSage = new THREE.MeshStandardMaterial({ color: C.sage, roughness: 0.6 });
  const mBlue = new THREE.MeshStandardMaterial({ color: C.blue, roughness: 0.5 }), mCassis = resin(C.cassis), mIvory = new THREE.MeshStandardMaterial({ color: C.ivory, roughness: 0.7 });

  // things that light up as the story advances: [material, intensity at each act 1..4]
  const glows = [];
  const glow = (mat, acts) => { glows.push({ mat, acts }); return mat; };
  const pathMat = glow(new THREE.MeshStandardMaterial({ color: C.wasabi, emissive: C.wasabi, emissiveIntensity: 0, roughness: 0.4 }), [0, 0, 1.1, 1.0]);
  const pathMat2 = glow(new THREE.MeshStandardMaterial({ color: C.orange, emissive: C.orange, emissiveIntensity: 0, roughness: 0.4 }), [0, 0, 1.0, 0.9]);
  const originGlow = glow(new THREE.MeshStandardMaterial({ color: C.wasabi, emissive: C.wasabi, emissiveIntensity: 0.0 }), [3.0, 2.2, 2.6, 1.6]);
  const screenMat = glow(new THREE.MeshStandardMaterial({ map: screenTexture(), emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 }), [0, 0.0, 0.9, 0.6]);
  screenMat.emissiveMap = screenMat.map;
  const interior = (kind) => glow(new THREE.MeshStandardMaterial({ map: interiorTexture(kind), emissiveMap: null, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: 0.9 }), [0, 0.06, 1.7, 0.7]);
  const ringGlow = glow(new THREE.MeshStandardMaterial({ color: C.orange, emissive: C.orange, emissiveIntensity: 0 }), [0, 0, 1.6, 1.0]);

  const root = new THREE.Group(); scene.add(root);
  const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, r = 0.07) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002))), mat);
  const cyl = (rt, rb, h, mat, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  // small architectural details shared by all zones
  const pad = (g, w, d) => add(g, box(w, 0.14, d, stoneLight, 0.05), 0, 0.0, 0.1);
  const mullions = (g, cx, y, z, w, h, n, mat = metal) => { for (let i = 0; i <= n; i++) add(g, box(0.045, h, 0.07, mat, 0.01), cx - w / 2 + (w / n) * i, y, z); add(g, box(w, 0.045, 0.07, mat, 0.01), cx, y + h / 2, z); add(g, box(w, 0.045, 0.07, mat, 0.01), cx, y - h / 2, z); };
  const steps = (g, w, z) => { add(g, box(w, 0.1, 0.5, stoneLight, 0.03), 0, 0.12, z); add(g, box(w - 0.3, 0.1, 0.35, stoneLight, 0.03), 0, 0.2, z - 0.06); };

  // ----- platform -----
  const slab = add(root, box(21.5, 0.9, 14.8, stone, 0.14), 0, -0.45, 0);
  add(root, box(20.4, 1.0, 13.7, plinthM, 0.1), 0, -1.35, 0);
  add(root, box(21.0, 0.06, 14.3, stoneLight, 0.02), 0, 0.03, 0).receiveShadow = true;           // thin lighter top inlay
  const sc = document.createElement('canvas'); sc.width = sc.height = 512; { const g = sc.getContext('2d'); const gr = g.createRadialGradient(256, 256, 40, 256, 256, 256); gr.addColorStop(0, 'rgba(30,18,24,0.55)'); gr.addColorStop(0.55, 'rgba(30,18,24,0.22)'); gr.addColorStop(1, 'rgba(30,18,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512); }
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(34, 26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity: 0.8 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = -1.88; scene.add(shadowCatcher);

  // ----- the origin point: the ring and dot, engraved into the stone -----
  const origin = new THREE.Group(); origin.position.set(0, 0.07, 0.2); root.add(origin);
  [[2.05, 1.95], [1.5, 1.42], [0.95, 0.89]].forEach(([ro, ri]) => { const m = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 96), stoneDark); m.rotation.x = -Math.PI / 2; m.position.y = 0.002; m.receiveShadow = true; origin.add(m); });
  const dot = cyl(0.42, 0.42, 0.1, plinthM, 48); dot.position.y = 0.0; origin.add(dot);
  const dotGlow = cyl(0.26, 0.26, 0.12, originGlow, 48); dotGlow.position.y = 0.02; origin.add(dotGlow);

  // ----- the five zones -----
  const ER = { x: 7.7, z: 4.7 }, ZS = 0.74;
  const zoneDefs = [
    { id: 'brand', ang: 158, color: C.orange },
    { id: 'digital', ang: 214, color: C.wasabi },
    { id: 'auto', ang: 270, color: C.orange },
    { id: 'ops', ang: 326, color: C.sage },
    { id: 'growth', ang: 100, color: C.wasabi }
  ];
  const zones = {};

  function place(def, depth) {
    const a = def.ang * Math.PI / 180; const px = ER.x * Math.cos(a), pz = ER.z * Math.sin(a) + 0.4;
    const g = new THREE.Group(); g.position.set(px, 0.06, pz); g.scale.setScalar(ZS);
    const dir = new THREE.Vector3(-px, 0, -pz + 0.2).normalize(); g.rotation.y = Math.atan2(dir.x, dir.z);
    root.add(g); zones[def.id] = { group: g, front: new THREE.Vector3(px, 0, pz).addScaledVector(dir, (depth / 2 + 1.1) * ZS), pos: g.position.clone(), dir };
    return g;
  }

  // 1. Brand identity: a creative studio
  { const g = place(zoneDefs[0], 3.6);
    pad(g, 6.0, 5.2);
    add(g, box(4.9, 2.5, 3.5, stone, 0.1), 0, 1.25, 0);
    add(g, box(3.9, 1.35, 0.1, frosted, 0.03), 0, 0.95, 1.86); mullions(g, 0, 0.95, 1.93, 3.9, 1.35, 5);
    add(g, box(3.55, 1.0, 0.04, interior('studio'), 0.01), 0, 0.95, 1.78);
    add(g, box(1.7, 0.42, 0.14, mWasabi, 0.05), -1.4, 2.08, 1.8);
    add(g, box(5.4, 0.14, 4.1, mOrange, 0.05), 0, 2.58, 0.25);
    add(g, box(3.3, 1.0, 2.8, stoneLight, 0.1), -0.2, 3.12, -0.2);
    add(g, box(2.6, 0.55, 0.08, glass, 0.03), -0.2, 3.1, 1.22);
    // palette table
    add(g, box(2.7, 0.14, 0.8, plinthM, 0.04), 0.4, 0.5, 2.9);
    [C.cassis, C.wasabi, C.orange, C.blue, C.sage].forEach((hx, i) => add(g, box(0.38, 0.38, 0.38, resin(hx), 0.05), -0.78 + i * 0.5, 0.78, 2.9));
    add(g, box(0.1, 0.5, 0.1, metal, 0.02), 1.6, 0.25, 2.9); }

  // 2. Digital presence: the storefront
  { const g = place(zoneDefs[1], 3.4);
    pad(g, 6.4, 5.4);
    add(g, box(5.4, 1.95, 3.3, stone, 0.1), 0, 0.97, 0);
    add(g, box(4.0, 1.25, 0.1, glass, 0.03), -0.5, 0.82, 1.76); mullions(g, -0.5, 0.82, 1.83, 4.0, 1.25, 4);
    add(g, box(3.5, 1.0, 0.04, interior('auto'), 0.01), -0.5, 0.82, 1.68);
    add(g, box(1.0, 1.4, 0.12, glass, 0.03), 2.0, 0.75, 1.76);
    const awn = add(g, box(5.8, 0.1, 1.5, mWasabi, 0.04), 0, 2.02, 2.2); awn.rotation.x = 0.03; add(g, box(0.06, 0.6, 0.06, metal, 0.01), -2.7, 1.7, 2.85); add(g, box(0.06, 0.6, 0.06, metal, 0.01), 2.7, 1.7, 2.85); steps(g, 3.2, 2.2);
    // the big display, on a frame
    const frame = add(g, box(4.6, 2.75, 0.2, darkMetal, 0.06), 0, 3.5, 0.2); frame.rotation.x = -0.1;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.45), screenMat); scr.position.set(0, 3.5, 0.32); scr.rotation.x = -0.1; scr.castShadow = false; g.add(scr);
    add(g, box(0.18, 1.6, 0.2, metal, 0.04), -1.8, 2.7, 0.0); add(g, box(0.18, 1.6, 0.2, metal, 0.04), 1.8, 2.7, 0.0); }

  // 3. AI & automation: a customer-interaction pavilion
  { const g = place(zoneDefs[2], 3.4);
    add(g, cyl(2.7, 2.7, 0.14, stoneLight, 64), 0, 0.0, 0.1);
    add(g, cyl(1.9, 1.95, 1.5, stone, 64), 0, 0.75, 0);
    const drum = cyl(1.7, 1.7, 1.15, frosted, 64); add(g, drum, 0, 2.08, 0);
    add(g, cyl(2.05, 2.05, 0.16, mOrange, 64), 0, 2.74, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.05, 12, 96), ringGlow); ring.rotation.x = Math.PI / 2; ring.position.y = 1.55; g.add(ring);
    add(g, box(1.4, 0.55, 0.9, mIvory, 0.05), 0, 1.0, 1.35);                                   // reception desk
    add(g, box(0.7, 0.05, 0.5, mWasabi, 0.02), 0.15, 1.3, 1.34);
    add(g, box(3.0, 1.0, 0.06, interior('auto'), 0.01), 0, 0.85, 1.6).visible = false;
    // the inquiry: three physical cards riding a rail between storefront and pavilion
    zones._cards = []; }

  // 4. Connected operations: customer records and workflows
  { const g = place(zoneDefs[3], 3.0);
    pad(g, 6.6, 4.4);
    add(g, box(5.6, 1.7, 2.9, mSage, 0.1), 0, 0.85, 0);
    add(g, box(5.0, 0.9, 0.08, frosted, 0.03), 0, 0.95, 1.56); mullions(g, 0, 0.95, 1.62, 5.0, 0.9, 7);
    add(g, box(4.7, 0.7, 0.04, interior('ops'), 0.01), 0, 0.95, 1.48);
    add(g, box(5.8, 0.12, 3.1, stoneLight, 0.04), 0, 1.78, 0);
    for (let i = 0; i < 5; i++) add(g, box(0.7, 0.52, 0.7, i % 2 ? mIvory : stoneLight, 0.06), -2.0 + i * 1.0, 2.1, -0.4);
    add(g, box(1.0, 1.4, 0.6, darkMetal, 0.05), 3.35, 0.7, 0.9);                               // filing cabinet
    [0.25, 0.65, 1.05].forEach(y => add(g, box(0.86, 0.3, 0.04, metal, 0.02), 3.35, y, 1.22)); }

  // 5. Growth and support: an expanding workspace
  { const g = place(zoneDefs[4], 3.4);
    pad(g, 7.2, 5.2);
    add(g, box(4.6, 1.3, 3.3, stone, 0.1), 0, 0.65, 0);
    add(g, box(3.8, 1.3, 2.7, stoneLight, 0.1), -0.3, 1.95, -0.1);
    add(g, box(3.0, 1.3, 2.2, stone, 0.1), -0.7, 3.25, -0.3);
    add(g, box(3.8, 0.9, 0.08, glass, 0.03), 0, 0.7, 1.74); mullions(g, 0, 0.7, 1.8, 3.8, 0.9, 4); steps(g, 2.4, 2.1);
    add(g, box(3.1, 0.9, 0.04, interior('growth'), 0.01), 0, 0.7, 1.68);
    add(g, box(3.0, 0.9, 0.08, frosted, 0.03), -0.3, 1.95, 1.33);
    // scaffold: the next floor being added
    for (const [x, z] of [[1.1, 0.2], [2.3, 0.2], [1.1, 1.1], [2.3, 1.1]]) add(g, box(0.08, 2.0, 0.08, mOrange, 0.02), x + 0.2, 1.0 + 0.4, z - 0.3);
    add(g, box(1.3, 0.08, 1.0, mOrange, 0.02), 1.7 + 0.2, 2.35, 0.25); add(g, box(1.3, 0.06, 0.06, mOrange, 0.02), 1.9, 1.5, 0.8);
    add(g, box(0.1, 1.2, 0.1, metal, 0.02), 2.9, 1.55, -0.4); add(g, box(1.7, 0.08, 0.08, metal, 0.02), 2.2, 2.2, -0.4); }

  const dressing = [];
  // miniature trees, the way a model-maker would dress the base
  const crown = new THREE.MeshStandardMaterial({ color: C.sage, roughness: 0.8 }); const trunk = new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.8 });
  [[6.2, 4.6, 1], [7.4, 3.2, 0.8], [5.2, 5.6, 0.9], [8.4, 5.2, 1.1], [-9.0, 5.4, 1], [-7.6, 6.0, 0.8], [9.0, -5.6, 0.9], [-9.2, -5.8, 1]].forEach(([x, z, k]) => {
    dressing.push(add(root, cyl(0.06 * k, 0.08 * k, 0.5 * k, trunk, 10), x, 0.3 * k + 0.06, z), add(root, new THREE.Mesh(new THREE.SphereGeometry(0.38 * k, 24, 16), crown), x, 0.78 * k + 0.1, z)); });

  // ----- pathways: inlaid channels from the origin to every zone, and a ring joining them -----
  function ribbon(pts, w, y, mat, receive = true) {
    const pos = [], idx = []; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a).setY(0).normalize(); const nx = -t.z, nz = t.x;
      pos.push(p.x + nx * w / 2, y, p.z + nz * w / 2, p.x - nx * w / 2, y, p.z - nz * w / 2);
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = receive; root.add(m); return m;
  }
  const O = new THREE.Vector3(0, 0, 0.2);
  const paths = [];
  zoneDefs.forEach((d, i) => {
    const f = zones[d.id].front.clone(); const mid = f.clone().lerp(O, 0.5); mid.x += (i % 2 ? 0.7 : -0.7);
    const curve = new THREE.QuadraticBezierCurve3(O.clone().add(zones[d.id].dir.clone().multiplyScalar(-0)).setY(0), mid, f);
    const pts = curve.getPoints(40);
    ribbon(pts, 0.62, 0.075, stoneLight);                                             // stone channel
    paths.push(ribbon(pts, 0.2, 0.09, i % 2 ? pathMat2 : pathMat, false));          // light
  });
  // the ring: a loop connecting every entrance, echoing the logo's rings
  const loop = new THREE.EllipseCurve(0, 0.3, 3.3, 2.0, 0, Math.PI * 2, false); const lp = loop.getPoints(180).map(p => new THREE.Vector3(p.x, 0, p.y));
  ribbon(lp, 0.5, 0.07, stoneLight); paths.push(ribbon(lp, 0.14, 0.088, pathMat, false));

  // ----- lighting: four acts -----
  const key = new THREE.DirectionalLight(0xfff0dc, 3); key.castShadow = true; key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 1, far: 80 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 5;
  key.position.set(-13, 20, 9); scene.add(key); scene.add(key.target);
  const hemi = new THREE.HemisphereLight(0xE6EEFF, 0xC9B79A, 0.5); scene.add(hemi);
  const point = new THREE.PointLight(0xFFF1D6, 0, 40, 1.6); point.position.set(0, 3.2, 0.2); point.castShadow = true; point.shadow.mapSize.set(2048, 2048); point.shadow.bias = -0.003; point.shadow.normalBias = 0.06; point.shadow.radius = 4; scene.add(point);
  const fill = new THREE.DirectionalLight(0xCFE0FF, 0.0); fill.position.set(16, 8, 12); scene.add(fill);

  function gradientBg(top, bottom) { const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const ACTS = {
    1: { bg: ['#120A0E', '#050304'], env: 0.0, key: 0.0, hemi: 0.02, point: 38, fill: 0, exposure: 1.0 },       // uncertainty
    2: { bg: ['#2A1D24', '#0F090C'], env: 0.1, key: 3.8, hemi: 0.1, point: 0, fill: 0.15, exposure: 1.0, keyColor: 0xFFD7A8 },  // creation
    3: { bg: ['#3A2E3E', '#1B1219'], env: 0.22, key: 1.3, hemi: 0.25, point: 0, fill: 0.4, exposure: 1.05, keyColor: 0xFFC890 },  // activation
    4: { bg: ['#F0EBE1', '#D3CABB'], env: 0.32, key: 2.5, hemi: 0.24, point: 0, fill: 0.5, exposure: 0.92, keyColor: 0xFFF1DF }    // clarity
  };
  function setAct(n) {
    const A = ACTS[n]; scene.background = gradientBg(A.bg[0], A.bg[1]); scene.environmentIntensity = A.env;
    key.intensity = A.key; key.color.set(A.keyColor || 0xffffff); hemi.intensity = A.hemi; point.intensity = A.point; fill.intensity = A.fill; renderer.toneMappingExposure = A.exposure;
    glows.forEach(({ mat, acts }) => { mat.emissiveIntensity = acts[n - 1]; });
    shadowCatcher.material.opacity = n === 1 ? 0.0 : n === 4 ? 0.55 : 0.9;
  }

  function frame(cfg) {
    const { pos, look, fov = 28, offsetX = 0, offsetY = 0 } = cfg;
    camera.fov = fov; camera.position.set(...pos); camera.lookAt(...look); camera.updateProjectionMatrix();
    if (offsetX || offsetY) camera.setViewOffset(width, height, offsetX * width, offsetY * height, width, height); else camera.clearViewOffset();
  }

  // before the buildings rise, only the foundation is there
  function showBuildings(v) { zoneDefs.forEach(d => { zones[d.id].group.visible = v; }); dressing.forEach(m => { m.visible = v; }); paths.forEach(m => { m.visible = v; }); }

  return { renderer, scene, camera, setAct, frame, zones, root, showBuildings, render: () => renderer.render(scene, camera) };
}
