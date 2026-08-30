import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const CATEGORIES = [
  { label: "AI tutor", meta: "learning" },
  { label: "Companion toy", meta: "play" },
  { label: "Story engine", meta: "creativity" },
  { label: "Homework helper", meta: "schoolwork" },
  { label: "Voice character", meta: "entertainment" },
  { label: "Parent console", meta: "oversight" },
];

const R = 1.6;
const TILE = 320; // square tile texture size (before supersampling)

type Orbit = {
  radius: number;
  tilt: number;
  yaw: number;
  speed: number;
  phase: number;
};

// Squared-up orbits: every card travels in the same flat horizontal
// plane (no tilt, no yaw), each on its own radius so they never overlap.
const ORBITS: Orbit[] = CATEGORIES.map((_, i) => ({
  radius: 2.3 + i * 0.22,
  tilt: 0,
  yaw: 0,
  speed: 0.16 + (i % 2) * 0.04,
  phase: (i / CATEGORIES.length) * Math.PI * 2,
}));

function circleGeometry(radius: number, segments = 128) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Typographic tile: no photo, just the category words set large and clear.
function tileTexture(label: string, meta: string, panel: string, ink: string, muted: string) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = TILE * scale;
  canvas.height = TILE * scale;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 16;
  tex.colorSpace = THREE.SRGBColorSpace;

  const s = TILE * scale;
  const r = s * 0.2;
  const pad = s * 0.12;

  // panel fill + hairline border
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.roundRect(0, 0, s, s, r);
  ctx.fill();
  ctx.lineWidth = s * 0.003;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.28;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // label: as large as possible while fitting inside the tile padding
  ctx.fillStyle = ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  let labelSize = s * 0.18;
  ctx.font = `500 ${labelSize}px "Inter Tight", Inter, system-ui, sans-serif`;
  let labelWidth = ctx.measureText(label).width;
  if (labelWidth > s - pad * 2) {
    labelSize *= (s - pad * 2) / labelWidth;
    ctx.font = `500 ${labelSize}px "Inter Tight", Inter, system-ui, sans-serif`;
  }
  ctx.fillText(label, s / 2, s * 0.42);

  // meta: mono, centered below label
  ctx.fillStyle = muted;
  const metaSize = Math.min(s * 0.085, labelSize * 0.55);
  ctx.font = `500 ${metaSize}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.fillText(meta.toUpperCase(), s / 2, s * 0.66);

  tex.needsUpdate = true;
  return tex;
}

// Soft radial halo behind the globe: a calm nightlight glow.
// Gaussian-ish falloff so there is no visible edge where it ends.
function haloTexture(rgb: string) {
  const s = 512;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = Math.exp(-4.6 * t * t) * (1 - t);
    g.addColorStop(t, `rgba(${rgb},${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Soft round sprite used for city lights and star dots — no hard rim.
function glowTexture() {
  const s = 128;
  const canvas = document.createElement("canvas");
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.5)");
  g.addColorStop(0.8, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Major world cities with their child-AI regulatory climate.
// mature   — enforceable child-specific rules (AADC, AI Act, COPPA-plus)
// emerging — rules drafted or partially in force
// unclear  — no child-specific AI rule set
type Climate = "mature" | "emerging" | "unclear";
type City = {
  lat: number;
  lon: number;
  name: string;
  climate: Climate;
  rule: string;
  ages: string;
};
const CLIMATE_COLOR: Record<Climate, string> = {
  mature: "#2ee6c8",
  emerging: "#ffb31f",
  unclear: "#ff5c42",
};
const CITIES: City[] = [
  { lat: 51.51, lon: -0.13, name: "London", climate: "mature", rule: "Age Appropriate Design Code; Online Safety Act", ages: "U18" },
  { lat: 48.86, lon: 2.35, name: "Paris", climate: "mature", rule: "EU AI Act; GDPR Art. 8", ages: "U15" },
  { lat: 52.52, lon: 13.41, name: "Berlin", climate: "mature", rule: "EU AI Act; JuSchG youth media rules", ages: "U16" },
  { lat: 41.9, lon: 12.5, name: "Rome", climate: "mature", rule: "EU AI Act; GDPR Art. 8", ages: "U14" },
  { lat: 40.42, lon: -3.7, name: "Madrid", climate: "mature", rule: "EU AI Act; GDPR Art. 8", ages: "U14" },
  { lat: 52.37, lon: 4.9, name: "Amsterdam", climate: "mature", rule: "EU AI Act; Code for Children's Rights", ages: "U16" },
  { lat: 55.68, lon: 12.57, name: "Copenhagen", climate: "mature", rule: "EU AI Act; GDPR Art. 8", ages: "U13" },
  { lat: 59.33, lon: 18.07, name: "Stockholm", climate: "mature", rule: "EU AI Act; GDPR Art. 8", ages: "U13" },
  { lat: 53.35, lon: -6.26, name: "Dublin", climate: "mature", rule: "Children's Fundamentals; EU AI Act", ages: "U18" },
  { lat: 37.57, lon: 126.98, name: "Seoul", climate: "mature", rule: "Youth Protection Act; PIPA child consent", ages: "U14" },
  { lat: 39.9, lon: 116.41, name: "Beijing", climate: "mature", rule: "Minors Online Protection Regulation", ages: "U18" },
  { lat: 31.23, lon: 121.47, name: "Shanghai", climate: "mature", rule: "Minors Online Protection Regulation", ages: "U18" },
  { lat: 34.05, lon: -118.24, name: "Los Angeles", climate: "emerging", rule: "CA Age-Appropriate Design Code (contested)", ages: "U18" },
  { lat: 37.77, lon: -122.42, name: "San Francisco", climate: "emerging", rule: "CA AADC; SB 243 companion-bot rules", ages: "U18" },
  { lat: 40.71, lon: -74.01, name: "New York", climate: "emerging", rule: "SAFE for Kids Act; COPPA", ages: "U18" },
  { lat: 38.9, lon: -77.04, name: "Washington", climate: "emerging", rule: "COPPA 2.0 rulemaking", ages: "U13" },
  { lat: 30.27, lon: -97.74, name: "Austin", climate: "emerging", rule: "TX SCOPE Act", ages: "U18" },
  { lat: 40.76, lon: -111.89, name: "Salt Lake City", climate: "emerging", rule: "UT Minor Protection in Social Media Act", ages: "U18" },
  { lat: 39.74, lon: -104.99, name: "Denver", climate: "emerging", rule: "CO Privacy Act minor amendments", ages: "U18" },
  { lat: 25.76, lon: -80.19, name: "Miami", climate: "emerging", rule: "FL HB 3 minor accounts law", ages: "U14" },
  { lat: 43.65, lon: -79.38, name: "Toronto", climate: "emerging", rule: "AIDA (pending); PIPEDA", ages: "U18" },
  { lat: -33.87, lon: 151.21, name: "Sydney", climate: "emerging", rule: "Online Safety Act codes; U16 social ban", ages: "U16" },
  { lat: -37.81, lon: 144.96, name: "Melbourne", climate: "emerging", rule: "Online Safety Act codes", ages: "U16" },
  { lat: 35.68, lon: 139.65, name: "Tokyo", climate: "emerging", rule: "AI Guidelines for Business; APPI", ages: "U15" },
  { lat: 1.35, lon: 103.82, name: "Singapore", climate: "emerging", rule: "Model AI Governance; Code of Practice", ages: "U18" },
  { lat: 28.61, lon: 77.21, name: "New Delhi", climate: "emerging", rule: "DPDP Act child consent", ages: "U18" },
  { lat: 19.08, lon: 72.88, name: "Mumbai", climate: "emerging", rule: "DPDP Act child consent", ages: "U18" },
  { lat: -23.55, lon: -46.63, name: "Sao Paulo", climate: "emerging", rule: "LGPD child provisions; ECA digital", ages: "U12" },
  { lat: 55.76, lon: 37.62, name: "Moscow", climate: "emerging", rule: "Information Protection of Children Act", ages: "U18" },
  { lat: 25.2, lon: 55.27, name: "Dubai", climate: "emerging", rule: "Child Digital Safety policy", ages: "U18" },
  { lat: 41.01, lon: 28.98, name: "Istanbul", climate: "emerging", rule: "KVKK child data guidance", ages: "U18" },
  { lat: -33.92, lon: 18.42, name: "Cape Town", climate: "emerging", rule: "POPIA child provisions", ages: "U18" },
  { lat: 19.43, lon: -99.13, name: "Mexico City", climate: "unclear", rule: "No child-specific AI rule", ages: "—" },
  { lat: -34.6, lon: -58.38, name: "Buenos Aires", climate: "unclear", rule: "No child-specific AI rule", ages: "—" },
  { lat: -12.05, lon: -77.04, name: "Lima", climate: "unclear", rule: "No child-specific AI rule", ages: "—" },
  { lat: 4.71, lon: -74.07, name: "Bogota", climate: "unclear", rule: "No child-specific AI rule", ages: "—" },
  { lat: 6.52, lon: 3.38, name: "Lagos", climate: "unclear", rule: "NDPA general only", ages: "—" },
  { lat: 30.04, lon: 31.24, name: "Cairo", climate: "unclear", rule: "Data protection law, no child AI rule", ages: "—" },
  { lat: -1.29, lon: 36.82, name: "Nairobi", climate: "unclear", rule: "DPA general only", ages: "—" },
  { lat: 24.71, lon: 46.68, name: "Riyadh", climate: "unclear", rule: "AI ethics principles, non-binding", ages: "—" },
  { lat: 13.76, lon: 100.5, name: "Bangkok", climate: "unclear", rule: "PDPA general only", ages: "—" },
  { lat: 3.14, lon: 101.69, name: "Kuala Lumpur", climate: "unclear", rule: "PDPA general only", ages: "—" },
  { lat: -6.21, lon: 106.85, name: "Jakarta", climate: "unclear", rule: "PDP Law child consent, unenforced", ages: "—" },
  { lat: 14.6, lon: 120.98, name: "Manila", climate: "unclear", rule: "No child-specific AI rule", ages: "—" },
  { lat: 13.08, lon: 80.27, name: "Chennai", climate: "unclear", rule: "DPDP Act pending rules", ages: "—" },
  { lat: 22.32, lon: 114.17, name: "Hong Kong", climate: "unclear", rule: "PDPO general only", ages: "—" },
  { lat: 50.45, lon: 30.52, name: "Kyiv", climate: "unclear", rule: "Alignment with EU pending", ages: "—" },
];

function cityPosition(c: City, out = new THREE.Vector3()) {
  const phi = ((90 - c.lat) * Math.PI) / 180;
  const theta = ((c.lon + 180) * Math.PI) / 180;
  const r = R * 1.008;
  return out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function cityLights(sprite: THREE.Texture) {
  const positions = new Float32Array(CITIES.length * 3);
  const colors = new Float32Array(CITIES.length * 3);
  const v = new THREE.Vector3();
  const col = new THREE.Color();
  CITIES.forEach((c, i) => {
    cityPosition(c, v);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    col.set(CLIMATE_COLOR[c.climate]);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    map: sprite,
    vertexColors: true,
    size: 0.42,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  });
  return new THREE.Points(geo, mat);
}


// Sparse field of small pastel dots around the globe — a calm night-sky
// backdrop. Friendly in colour, restrained in density.
const DOT_COLORS = ["#8ad6cb", "#2e9ab0", "#e0a94b", "#e28472"];
function starField(sprite: THREE.Texture, count = 110) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // random point in a spherical shell around the globe
    const r = 3.1 + Math.random() * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.75;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    c.set(DOT_COLORS[i % DOT_COLORS.length]!);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    map: sprite,
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -1;
  return pts;
}


type Built = {
  root: THREE.Group;
  globe: THREE.Group;
  pivots: { group: THREE.Group; speed: number }[];
  cards: THREE.Mesh[];
  lights: THREE.Points;
};


function buildScene(ink: string, panel: string, muted: string): Built {
  const root = new THREE.Group();
  // The dev tagger sets a pierced "data-*" prop on JSX elements; giving the
  // primitive object a `data` bag keeps that assignment harmless.
  (root as unknown as { data: Record<string, unknown> }).data = {};

  // Kid-friendly but safe backdrop: soft halo + pastel star dots.
  // Halo rgb: teal #2E9AB0. Kept whisper-soft in light mode so the
  // paper background stays editorial.
  const lightMode = panel === "#ffffff";
  const sprite = glowTexture();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture("46,154,176"),
      transparent: true,
      opacity: lightMode ? 0.16 : 0.3,
      depthWrite: false,
      depthTest: false,
    }),
  );
  halo.scale.setScalar(lightMode ? 9 : 12.5);
  halo.renderOrder = -2;
  root.add(halo);
  root.add(starField(sprite));

  const globe = new THREE.Group();
  globe.rotation.z = 0.35;
  globe.scale.setScalar(1.55);
  root.add(globe);

  // Satellite night-lights: major cities glowing on the surface.
  const lights = cityLights(sprite);
  if (lightMode) {
    // Additive glow vanishes on paper; use solid dots instead.
    lights.material.blending = THREE.NormalBlending;
    lights.material.size = 0.26;
  }

  globe.add(lights);


  const depthOnly = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.985, 64, 48),
    new THREE.MeshBasicMaterial({ colorWrite: false }),
  );
  depthOnly.renderOrder = -1;
  globe.add(depthOnly);

  const mat = new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.5 });
  const strong = new THREE.LineBasicMaterial({ color: ink });

  // Standard Earth graticule: parallels and meridians every 15 degrees.
  for (let d = -75; d <= 75; d += 15) {
    if (d === 0) continue;
    const rad = (d * Math.PI) / 180;
    const line = new THREE.Line(circleGeometry(Math.cos(rad) * R), mat);
    line.position.y = Math.sin(rad) * R;
    globe.add(line);
  }
  for (let i = 0; i < 12; i++) {
    const line = new THREE.Line(circleGeometry(R), mat);
    line.rotation.set(Math.PI / 2, 0, (i / 12) * Math.PI);
    globe.add(line);
  }
  globe.add(new THREE.Line(circleGeometry(R), strong));

  const pivots: Built["pivots"] = [];
  const cards: THREE.Mesh[] = [];
  // Typographic tiles, one per category, on flat ring orbits.
  const w = 1.65;

  CATEGORIES.forEach((c, i) => {
    const orbit = ORBITS[i]!;
    const plane = new THREE.Group();
    plane.rotation.set(orbit.tilt, orbit.yaw, 0);

    const pivot = new THREE.Group();
    pivot.rotation.y = orbit.phase;
    plane.add(pivot);

    const holder = new THREE.Group();
    holder.position.x = orbit.radius;
    pivot.add(holder);

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w),
      new THREE.MeshBasicMaterial({
        map: tileTexture(c.label, c.meta, panel, ink, muted),
        transparent: true,
        toneMapped: false,
      }),
    );
    holder.add(card);

    root.add(plane);
    pivots.push({ group: pivot, speed: orbit.speed });
    cards.push(card);
  });

  return { root, globe, pivots, cards, lights };
}

const TMP_Q = new THREE.Quaternion();
const TMP_V = new THREE.Vector3();
const TMP_C = new THREE.Vector3();

function GlobeScene({
  ink,
  panel,
  muted,
  onHover,
}: {
  ink: string;
  panel: string;
  muted: string;
  onHover: (index: number, x: number, y: number) => void;
}) {
  const { camera, pointer, raycaster, size, gl } = useThree();
  const built = useMemo(() => buildScene(ink, panel, muted), [ink, panel, muted]);
  const reduced = useRef(prefersReduced());

  // Drag-to-spin: horizontal drags rotate the globe, vertical drags tilt it.
  // While released, leftover velocity eases out with exponential damping and
  // the idle auto-spin fades back in.
  const drag = useRef({ down: false, x: 0, y: 0, vy: 0, vx: 0 });
  useEffect(() => {
    const el = gl.domElement;
    el.style.cursor = "grab";
    el.style.touchAction = "pan-y";
    const down = (e: PointerEvent) => {
      drag.current.down = true;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.vy = 0;
      drag.current.vx = 0;
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drag.current.down) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.vy = dx * 0.005;
      drag.current.vx = dy * 0.003;
      built.globe.rotation.y += drag.current.vy;
      built.globe.rotation.x = THREE.MathUtils.clamp(
        built.globe.rotation.x + drag.current.vx,
        -0.55,
        0.55,
      );
    };
    const up = (e: PointerEvent) => {
      drag.current.down = false;
      el.style.cursor = "grab";
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, built]);

  // Fit the whole scene (globe + widest card orbit) to the canvas width so
  // cards never clip at the edges, whatever the column size.
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dist = cam.position.length();
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * dist;
    const halfW = halfH * (size.width / size.height);
    const maxOrbit = ORBITS[ORBITS.length - 1]!.radius + 0.9;
    built.root.scale.setScalar(Math.min(1, halfW / maxOrbit));
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const d = drag.current;
    if (!d.down) {
      // coast on leftover flick velocity, then blend back to the idle spin
      d.vy *= Math.exp(-3 * dt);
      d.vx *= Math.exp(-3 * dt);
      built.globe.rotation.y += d.vy * dt * 60;
      built.globe.rotation.x = THREE.MathUtils.clamp(
        built.globe.rotation.x + d.vx * dt * 60,
        -0.55,
        0.55,
      );
      if (!reduced.current) built.globe.rotation.y += dt * 0.12;
    }
    if (!reduced.current) {
      for (const p of built.pivots) p.group.rotation.y += dt * p.speed;
    }
    // billboard the cards toward the camera, with ImageWheel depth cues:
    // front tiles larger and bright, back tiles smaller and dimmed, plus a
    // slight horizontal stretch while spinning to suggest motion blur.
    const maxR = (ORBITS[ORBITS.length - 1]!.radius + 0.2) * built.root.scale.x;
    for (const card of built.cards) {
      card.parent?.getWorldQuaternion(TMP_Q);
      card.quaternion.copy(camera.quaternion).premultiply(TMP_Q.invert());
      card.getWorldPosition(TMP_V);
      const depth = THREE.MathUtils.clamp(TMP_V.z / maxR / 2 + 0.5, 0, 1);
      const s = 0.8 + depth * 0.36;
      const stretch = reduced.current ? 1 : 1.07;
      card.scale.set(s * stretch, s, 1);
      (card.material as THREE.MeshBasicMaterial).opacity = 0.45 + depth * 0.55;
    }

    // City hover: nearest light under the pointer, front hemisphere only.
    raycaster.setFromCamera(pointer, camera);
    raycaster.params.Points = { threshold: 0.24 };
    const hits = raycaster.intersectObject(built.lights, false);
    let found = -1;
    for (const hit of hits) {
      const i = hit.index ?? -1;
      if (i < 0) continue;
      TMP_V.copy(hit.point);
      built.globe.getWorldPosition(TMP_C);
      // skip points on the far side of the globe
      if (TMP_V.clone().sub(TMP_C).normalize().dot(
        camera.position.clone().sub(TMP_C).normalize(),
      ) < 0.15) continue;
      found = i;
      break;
    }
    if (found < 0) {
      onHover(-1, 0, 0);
      return;
    }
    const city = CITIES[found]!;
    cityPosition(city, TMP_V).applyMatrix4(built.lights.matrixWorld).project(camera);
    onHover(found, ((TMP_V.x + 1) / 2) * size.width, ((1 - TMP_V.y) / 2) * size.height);
  });

  return <primitive object={built.root} />;
}

const LEGEND: { climate: Climate; label: string }[] = [
  { climate: "mature", label: "mature rules" },
  { climate: "emerging", label: "emerging rules" },
  { climate: "unclear", label: "no child-specific rule" },
];

export default function Globe3D() {
  // Dark is the site default; light only under prefers-color-scheme: light.
  const light =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  const ink = light ? "#171c1b" : "#e9eeec";
  const panel = light ? "#ffffff" : "#161d1b";
  const muted = light ? "#5a6663" : "#9aa8a4";

  const [hover, setHover] = useState(-1);
  const tip = useRef<HTMLDivElement>(null);
  const last = useRef(-1);

  const onHover = useCallback((index: number, x: number, y: number) => {
    if (index !== last.current) {
      last.current = index;
      setHover(index);
    }
    if (index >= 0 && tip.current) {
      tip.current.style.transform = `translate(${x + 14}px, ${y - 10}px)`;
    }
  }, []);

  const city = hover >= 0 ? CITIES[hover] : undefined;

  return (
    <div className="w-full">
      <div
        className="relative h-[540px] w-full max-w-full overflow-hidden md:h-[700px]"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 78% 78% at 50% 50%, #000 55%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 78% 78% at 50% 50%, #000 55%, transparent 100%)",
        }}
      >
        <Canvas camera={{ position: [0, 0.7, 10.2], fov: 40 }} dpr={[1, 2]}>
          <GlobeScene ink={ink} panel={panel} muted={muted} onHover={onHover} />
        </Canvas>
        <div
          ref={tip}
          className="pointer-events-none absolute left-0 top-0 max-w-[260px] border p-3"
          style={{
            background: "var(--panel)",
            borderColor: "var(--line)",
            opacity: city ? 1 : 0,
            transition: "opacity 150ms",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-[6px] w-[6px]"
              style={{ background: city ? CLIMATE_COLOR[city.climate] : "transparent" }}
            />
            <span className="text-[15px]" style={{ color: "var(--ink)" }}>
              {city?.name}
            </span>
          </div>
          <div
            className="mt-2 font-mono text-[11px] leading-[1.5]"
            style={{ color: "var(--muted)" }}
          >
            {city?.rule}
          </div>
          <div
            className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em]"
            style={{ color: "var(--faint)" }}
          >
            ages {city?.ages}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {LEGEND.map((l) => (
          <span key={l.climate} className="flex items-center gap-2">
            <span
              className="inline-block h-[6px] w-[6px]"
              style={{ background: CLIMATE_COLOR[l.climate] }}
            />
            <span
              className="font-mono text-[11px] uppercase tracking-[0.2em]"
              style={{ color: "var(--faint)" }}
            >
              {l.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

