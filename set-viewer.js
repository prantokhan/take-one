// ------------------------------------------------------------------
// Set viewer — draws a generated scene spec (the same JSON Unreal builds)
// as a small flat-shaded 3D set in a <canvas>, so "Prompt the world" and
// production key sets are visible without Unreal running.
//
// No dependencies: a tiny painter's-algorithm renderer over the four
// schema primitives (cube, cylinder, cone, sphere). Units are Unreal cm,
// z-up; each primitive is 100 units per scale step with its pivot at the
// center. The camera slowly orbits; drag to spin it yourself.
//
//   mountSetViewer(canvas, sceneSpec) -> cleanup()
// ------------------------------------------------------------------

function hexToRgb(hex, fallback = [120, 120, 120]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function setViewerMesh(obj) {
  const s = obj.scale || {};
  const hx = 50 * (Number(s.x) || 1), hy = 50 * (Number(s.y) || 1), hz = 50 * (Number(s.z) || 1);
  const faces = [];
  const ring = (count, radiusX, radiusY, z) => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return [Math.cos(a) * radiusX, Math.sin(a) * radiusY, z];
  });
  switch (obj.primitive) {
    case "sphere": {
      const rows = 6, cols = 10;
      for (let r = 0; r < rows; r++) {
        const p0 = -Math.PI / 2 + (r / rows) * Math.PI, p1 = -Math.PI / 2 + ((r + 1) / rows) * Math.PI;
        for (let c = 0; c < cols; c++) {
          const t0 = (c / cols) * Math.PI * 2, t1 = ((c + 1) / cols) * Math.PI * 2;
          const pt = (p, t) => [Math.cos(p) * Math.cos(t) * hx, Math.cos(p) * Math.sin(t) * hy, Math.sin(p) * hz];
          faces.push([pt(p0, t0), pt(p0, t1), pt(p1, t1), pt(p1, t0)]);
        }
      }
      break;
    }
    case "cylinder": {
      const bottom = ring(12, hx, hy, -hz), top = ring(12, hx, hy, hz);
      for (let i = 0; i < 12; i++) { const j = (i + 1) % 12; faces.push([bottom[i], bottom[j], top[j], top[i]]); }
      faces.push(top);
      faces.push(bottom.slice().reverse());
      break;
    }
    case "cone": {
      const bottom = ring(12, hx, hy, -hz), apex = [0, 0, hz];
      for (let i = 0; i < 12; i++) faces.push([bottom[i], bottom[(i + 1) % 12], apex]);
      faces.push(bottom.slice().reverse());
      break;
    }
    default: {
      const v = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]];
      [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]].forEach(f => faces.push(f.map(i => v[i])));
    }
  }
  const yaw = ((obj.rotation && Number(obj.rotation.yaw)) || 0) * Math.PI / 180;
  const loc = obj.location || {};
  const ox = Number(loc.x) || 0, oy = Number(loc.y) || 0, oz = Number(loc.z) || 0;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  return faces.map(f => f.map(([x, y, z]) => [x * cy - y * sy + ox, x * sy + y * cy + oy, z + oz]));
}

// Classic blocky avatar (Roblox-style R6 proportions), built from cubes so
// it goes through the same renderer as the set. Colors: skin, shirt, pants,
// hat (null for none). swing is -1..1 for the walk cycle.
const AVATAR = { skin: [245, 205, 48], shirt: [13, 105, 172], pants: [75, 151, 75], hat: [20, 20, 22], face: [30, 30, 30] };

function blockyAvatar(px, py, pz, yaw, swing, colors) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), deg = yaw * 180 / Math.PI;
  const part = (fwd, side, z, sx, sd, sz, rgb) => setViewerMesh({
    primitive: "cube",
    location: { x: px + cy * fwd + sy * side, y: py + sy * fwd - cy * side, z: pz + z },
    rotation: { yaw: deg }, scale: { x: sx, y: sd, z: sz }
  }).map(pts => ({ pts, rgb: colors[rgb] }));
  const leg = swing * 16, arm = -swing * 18;
  const parts = [
    ...part(leg, -22, 45, 0.44, 0.44, 0.9, "pants"),
    ...part(-leg, 22, 45, 0.44, 0.44, 0.9, "pants"),
    ...part(0, 0, 135, 0.46, 0.9, 0.9, "shirt"),
    ...part(arm, -68, 135, 0.44, 0.44, 0.9, "skin"),
    ...part(-arm, 68, 135, 0.44, 0.44, 0.9, "skin"),
    ...part(0, 0, 208, 0.52, 0.52, 0.52, "skin"),
    ...part(14, 0, 212, 0.26, 0.3, 0.1, "face")
  ];
  if (colors.hat) parts.push(...part(0, 0, 242, 0.62, 0.62, 0.14, "hat"));
  return parts;
}

// Roblox export: turns a scene spec into a Luau script you paste into the
// Studio command bar (or a Script) to build the set as anchored Parts under
// a Model in Workspace. Unreal cm -> studs (1 stud = 28 cm), z-up -> y-up.
function sceneToRobloxLua(scene) {
  const S = 1 / 28;
  const q = v => String(v).replace(/[\\"\n\r]/g, " ");
  const shape = { sphere: "Ball", cylinder: "Cylinder", cone: "Cylinder", cube: "Block" };
  const lines = [
    `-- Take One set export: ${q(scene.title || "Generated set")}`,
    "-- Paste into the Roblox Studio command bar, or run it from a Script.",
    "local model = Instance.new(\"Model\")",
    `model.Name = "${q(scene.title || "TakeOneSet").slice(0, 60)}"`,
    "local function part(name, shape, size, pos, yaw, color, neon)",
    "  local p = Instance.new(\"Part\")",
    "  p.Name = name",
    "  p.Anchored = true",
    "  p.TopSurface = Enum.SurfaceType.Smooth",
    "  p.BottomSurface = Enum.SurfaceType.Smooth",
    "  p.Shape = Enum.PartType[shape]",
    "  p.Size = size",
    "  local cf = CFrame.new(pos) * CFrame.Angles(0, math.rad(yaw), 0)",
    "  -- Roblox cylinders run along X; stand them up.",
    "  if shape == \"Cylinder\" then cf = cf * CFrame.Angles(0, 0, math.rad(90)) end",
    "  p.CFrame = cf",
    "  p.Color = color",
    "  p.Material = neon and Enum.Material.Neon or Enum.Material.SmoothPlastic",
    "  p.Parent = model",
    "  return p",
    "end"
  ];
  (scene.objects || []).forEach(o => {
    const s = o.scale || {}, l = o.location || {};
    const sx = Math.max(0.2, 100 * (Number(s.x) || 1) * S), sy = Math.max(0.2, 100 * (Number(s.y) || 1) * S), sz = Math.max(0.2, 100 * (Number(s.z) || 1) * S);
    const kind = shape[o.primitive] || "Block";
    // Ball needs a uniform size; Cylinder's length is X, diameter Y/Z.
    const sizeLua = kind === "Ball"
      ? `Vector3.new(${[0, 0, 0].map(() => Math.max(sx, sy, sz).toFixed(2)).join(", ")})`
      : kind === "Cylinder"
        ? `Vector3.new(${sz.toFixed(2)}, ${Math.max(sx, sy).toFixed(2)}, ${Math.max(sx, sy).toFixed(2)})`
        : `Vector3.new(${sx.toFixed(2)}, ${sz.toFixed(2)}, ${sy.toFixed(2)})`;
    const [r, g, b] = hexToRgb(o.color);
    const yaw = -((o.rotation && Number(o.rotation.yaw)) || 0);
    const neon = /glow|neon|lamp|fire|light/i.test(o.label || "");
    lines.push(`part("${q(o.label || o.id || "Part").slice(0, 50)}", "${kind}", ${sizeLua}, Vector3.new(${((Number(l.x) || 0) * S).toFixed(2)}, ${((Number(l.z) || 0) * S).toFixed(2)}, ${(-(Number(l.y) || 0) * S).toFixed(2)}), ${yaw}, Color3.fromRGB(${r}, ${g}, ${b}), ${neon})`);
  });
  const ground = hexToRgb(scene.environment?.ground_color, [60, 70, 60]);
  lines.push(
    `part("Ground", "Block", Vector3.new(260, 1, 260), Vector3.new(0, -0.5, 0), 0, Color3.fromRGB(${ground.join(", ")}), false)`,
    "local spawn = Instance.new(\"SpawnLocation\")",
    "spawn.Anchored = true",
    "spawn.Size = Vector3.new(6, 1, 6)",
    "spawn.Position = Vector3.new(-40, 0.5, 40)",
    "spawn.Parent = model",
    "model.Parent = workspace",
    `print("Take One set built: " .. model.Name)`
  );
  return lines.join("\n");
}

function downloadRobloxSet(scene) {
  const blob = new Blob([sceneToRobloxLua(scene)], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${String(scene.title || "take-one-set").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "take-one-set"}.lua`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Everything a scene needs for drawing, built once per scene: flat-lit
// polygons (lighting is static, only fog depends on the camera), a tiled
// ground, and footprint boxes for walk-mode collision.
function buildSetWorld(scene) {
  const env = scene.environment || {};
  const ground = hexToRgb(env.ground_color, [24, 30, 34]);
  const sky = hexToRgb(env.sky_light_color, [90, 120, 150]);
  const sunColor = hexToRgb(env.sun_color, [255, 220, 180]);
  const fog = Math.min(0.08, Number(env.fog_density) || 0.01);
  const pitch = ((env.sun_rotation && env.sun_rotation.pitch) || -35) * Math.PI / 180;
  const sunYaw = ((env.sun_rotation && env.sun_rotation.yaw) || -40) * Math.PI / 180;
  const sunDir = [Math.cos(pitch) * Math.cos(sunYaw), Math.cos(pitch) * Math.sin(sunYaw), Math.sin(pitch)];
  const sunStrength = Math.min(1, (Number(env.sun_intensity) || 5) / 7);
  const ambient = 0.5 + 0.3 * Math.min(1, Number(env.sky_light_intensity) || 0.6);

  const shade = (face, color, glow) => {
    const [a, b, c] = face;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(...n) || 1;
    const lambert = Math.max(0, -(n[0] * sunDir[0] + n[1] * sunDir[1] + n[2] * sunDir[2]) / nl);
    const light = glow ? 1.15 : ambient + lambert * sunStrength * 0.8;
    return { face, normal: n, rgb: color.map((ch, i) => Math.min(255, ch * light * (glow ? 1 : 0.75 + 0.25 * sunColor[i] / 255))) };
  };

  const polys = [];
  const colliders = [];
  scene.objects.forEach(obj => {
    const color = hexToRgb(obj.color);
    const glow = /glow|neon|lamp|fire|light/i.test(obj.label || "");
    setViewerMesh(obj).forEach(face => polys.push(shade(face, color, glow)));
    const s = obj.scale || {}, l = obj.location || {};
    const hx = 50 * (Number(s.x) || 1), hy = 50 * (Number(s.y) || 1), hz = 50 * (Number(s.z) || 1);
    const z = Number(l.z) || 0;
    // Only things at body height block you: floors, puddles and the
    // planet on the horizon are walked over / under.
    if (z + hz < 45 || z - hz > 190) return;
    const yaw = ((obj.rotation && Number(obj.rotation.yaw)) || 0) * Math.PI / 180;
    const ex = Math.abs(Math.cos(yaw)) * hx + Math.abs(Math.sin(yaw)) * hy;
    const ey = Math.abs(Math.sin(yaw)) * hx + Math.abs(Math.cos(yaw)) * hy;
    colliders.push({ x: Number(l.x) || 0, y: Number(l.y) || 0, ex, ey });
  });

  // Frame the bulk of the set, not the farthest outlier.
  const radii = scene.objects
    .map(o => Math.hypot(Number(o.location?.x) || 0, Number(o.location?.y) || 0))
    .sort((a, b) => a - b);
  const extent = Math.max(700, Math.min(2600, radii[Math.floor(radii.length * 0.75)] || 700));

  const tiles = [];
  const g = extent * 1.8, step = g / 6;
  for (let x = -g; x < g; x += step) {
    for (let y = -g; y < g; y += step) {
      const k = ((Math.round(x / step) + Math.round(y / step)) & 1) ? 1 : 0.9;
      tiles.push({ face: [[x, y, 0], [x + step, y, 0], [x + step, y + step, 0], [x, y + step, 0]], rgb: ground.map(c => c * k + 6) });
    }
  }
  return { polys, tiles, colliders, sky, fog, extent, bound: g - 60, shade };
}

// Draws one frame from cam = { pos:[x,y,z], yaw, pitch } (radians, yaw 0
// looks down +x). Polygons are clipped against the near plane so the
// camera can stand inside the set without faces vanishing.
function renderSetFrame(ctx, w, h, world, cam, extra = []) {
  const { sky, fog } = world;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgb(${sky.map(c => Math.round(c * 0.55)).join(",")})`);
  grad.addColorStop(1, `rgb(${sky.join(",")})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const fwd = [cp * cy, cp * sy, sp], right = [sy, -cy, 0], up = [-cy * sp, -sy * sp, cp];
  const [px, py, pz] = cam.pos;
  const focal = Math.min(w, h) * 1.1;
  const near = 8;
  const toCam = p => {
    const dx = p[0] - px, dy = p[1] - py, dz = p[2] - pz;
    return [dx * right[0] + dy * right[1], dx * up[0] + dy * up[1] + dz * up[2], dx * fwd[0] + dy * fwd[1] + dz * fwd[2]];
  };
  const fogMix = (rgb, depth) => {
    const f = Math.min(0.75, 1 - Math.exp(-fog * depth / 300));
    return rgb.map((c, i) => Math.round(c * (1 - f) + sky[i] * f));
  };
  const list = [];
  const push = (poly, layer) => {
    if (poly.normal) {
      const a = poly.face[0];
      if (poly.normal[0] * (px - a[0]) + poly.normal[1] * (py - a[1]) + poly.normal[2] * (pz - a[2]) < 0) return;
    }
    let pts = poly.face.map(toCam);
    if (pts.every(p => p[2] < near)) return;
    if (pts.some(p => p[2] < near)) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[2] >= near) out.push(a);
        if ((a[2] >= near) !== (b[2] >= near)) {
          const t = (near - a[2]) / (b[2] - a[2]);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
        }
      }
      pts = out;
      if (pts.length < 3) return;
    }
    const depth = pts.reduce((s, p) => s + p[2], 0) / pts.length;
    if (depth > 12000) return;
    list.push({ layer, depth, rgb: fogMix(poly.rgb, depth), pts: pts.map(p => [w / 2 + p[0] * focal / p[2], h / 2 - p[1] * focal / p[2]]) });
  };
  world.tiles.forEach(t => push(t, 0));
  world.polys.forEach(p => push(p, 1));
  extra.forEach(p => push(p, 1));
  list.sort((a, b) => a.layer - b.layer || b.depth - a.depth);
  list.forEach(({ pts, rgb }) => {
    ctx.fillStyle = `rgb(${rgb.join(",")})`;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  // World point -> screen point (or null if behind the camera), for HUD labels.
  return p => {
    const c = toCam(p);
    return c[2] < near ? null : [w / 2 + c[0] * focal / c[2], h / 2 - c[1] * focal / c[2], c[2]];
  };
}

function sizeCanvas(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// Orbiting preview used in dialogs. Drag to spin.
function mountSetViewer(canvas, scene) {
  if (!canvas || !scene || !Array.isArray(scene.objects)) return () => {};
  const world = buildSetWorld(scene);
  let angle = 0.6, elev = 0.6, dragging = null, raf = 0, auto = true;
  canvas.addEventListener("pointerdown", e => { dragging = { x: e.clientX, y: e.clientY, a: angle, e: elev }; auto = false; });
  canvas.addEventListener("pointermove", e => {
    if (!dragging) return;
    angle = dragging.a - (e.clientX - dragging.x) * 0.01;
    elev = Math.max(0.08, Math.min(1.2, dragging.e + (e.clientY - dragging.y) * 0.006));
  });
  const stop = () => { dragging = null; };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  const draw = () => {
    if (!document.body.contains(canvas) || canvas.closest("dialog")?.open === false) return;
    if (auto) angle += 0.003;
    const { ctx, w, h } = sizeCanvas(canvas);
    const d = world.extent * 2.4;
    const pos = [Math.cos(angle) * Math.cos(elev) * d, Math.sin(angle) * Math.cos(elev) * d, Math.sin(elev) * d + 150];
    renderSetFrame(ctx, w, h, world, { pos, yaw: angle + Math.PI, pitch: -Math.atan2(pos[2] - 150, Math.hypot(pos[0], pos[1])) });
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}

// ------------------------------------------------------------------
// Walk mode: first-person on the generated set. WASD / arrows to move,
// mouse (click to lock) or drag to look, Shift to run. Three glowing
// camera marks are placed around the set; reach each one to shoot a take.
//
//   mountSetWalk(canvas, scene, { onTake(n, total), onWrap(seconds) }) -> cleanup()
// ------------------------------------------------------------------

function mountSetWalk(canvas, scene, hooks = {}) {
  if (!canvas || !scene || !Array.isArray(scene.objects)) return () => {};
  const world = buildSetWorld(scene);
  const R = 32, EYE = 165;
  const blocked = (x, y) => Math.abs(x) > world.bound || Math.abs(y) > world.bound ||
    world.colliders.some(c => Math.abs(x - c.x) < c.ex + R && Math.abs(y - c.y) < c.ey + R);

  let seed = 1;
  for (const ch of String(scene.title || "")) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const freeSpot = (cx, cy, spread) => {
    for (let i = 0; i < 80; i++) {
      const x = cx + (rand() - 0.5) * spread, y = cy + (rand() - 0.5) * spread;
      if (!blocked(x, y)) return [x, y];
    }
    return [cx, cy];
  };

  const e = world.extent;
  const [sx, sy] = freeSpot(-e * 0.9, -e * 0.9, e * 0.5);
  const player = hooks.spawn
    ? { x: hooks.spawn.x, y: hooks.spawn.y, yaw: hooks.spawn.yaw ?? 0, pitch: -0.25, bob: 0, z: 0, vz: 0 }
    : { x: sx, y: sy, yaw: Math.atan2(-sy, -sx), pitch: -0.25, bob: 0, z: 0, vz: 0 };

  // Marks sit next to real set pieces so the walk actually tours the set.
  const anchors = world.colliders.filter(c => Math.hypot(c.x, c.y) < e * 1.3);
  const marks = [];
  for (let i = 0; i < (hooks.marks === false ? 0 : 3); i++) {
    const a = anchors.length ? anchors[Math.floor(rand() * anchors.length)] : { x: 0, y: 0, ex: 0, ey: 0 };
    let spot = freeSpot(a.x, a.y, Math.max(a.ex, a.ey) * 2 + 400);
    if (marks.some(m => Math.hypot(m.x - spot[0], m.y - spot[1]) < 400)) spot = freeSpot(0, 0, e * 1.6);
    marks.push({ x: spot[0], y: spot[1], hit: false });
  }
  const markMesh = m => {
    const o = { primitive: "cylinder", location: { x: m.x, y: m.y, z: 180 }, scale: { x: 0.9, y: 0.9, z: 3.6 }, rotation: { yaw: 0 } };
    const ring = { primitive: "cylinder", location: { x: m.x, y: m.y, z: 4 }, scale: { x: 2.4, y: 2.4, z: 0.06 }, rotation: { yaw: 0 } };
    return { beam: setViewerMesh(o), ring: setViewerMesh(ring) };
  };
  marks.forEach(m => { m.mesh = markMesh(m); });

  const keys = {};
  const kd = ev => {
    if (hooks.paused?.()) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift"].includes(k)) { keys[k] = true; ev.preventDefault(); }
    if (k === " " && player.z === 0) { player.vz = 520; ev.preventDefault(); ev.stopImmediatePropagation?.(); }
  };
  let thirdPerson = hooks.thirdPerson !== false;
  const vk = ev => { if (!hooks.paused?.() && ev.key.toLowerCase() === "v") thirdPerson = !thirdPerson; };
  window.addEventListener("keydown", vk);
  const ku = ev => { delete keys[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key]; };
  const look = (dx, dy) => {
    player.yaw -= dx * 0.0035;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - dy * 0.0035));
  };
  const mm = ev => { if (document.pointerLockElement === canvas) look(ev.movementX, ev.movementY); };
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  document.addEventListener("mousemove", mm);

  // Touch / non-locked mouse: drag on the left half to move, right half to look.
  const touches = {};
  let stick = null;
  canvas.addEventListener("pointerdown", ev => {
    if (ev.pointerType === "mouse") { canvas.requestPointerLock?.(); return; }
    touches[ev.pointerId] = { x: ev.clientX, y: ev.clientY, move: ev.clientX - canvas.getBoundingClientRect().left < canvas.clientWidth / 2 };
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener("pointermove", ev => {
    const t = touches[ev.pointerId];
    if (!t) return;
    if (t.move) stick = { x: (ev.clientX - t.x) / 60, y: (ev.clientY - t.y) / 60 };
    else { look((ev.clientX - t.x) * 1.6, (ev.clientY - t.y) * 1.6); t.x = ev.clientX; t.y = ev.clientY; }
  });
  const up = ev => { if (touches[ev.pointerId]?.move) stick = null; delete touches[ev.pointerId]; };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);

  const started = performance.now();
  let taken = 0, flash = 0, wrapped = false, raf = 0, last = performance.now();
  const frame = now => {
    if (!document.body.contains(canvas) || canvas.closest("dialog")?.open === false) return cleanup();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (hooks.paused?.()) { Object.keys(keys).forEach(k => delete keys[k]); stick = null; }
    let f = (keys.w || keys.ArrowUp ? 1 : 0) - (keys.s || keys.ArrowDown ? 1 : 0);
    let s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    if (keys.ArrowLeft) player.yaw += 2.2 * dt;
    if (keys.ArrowRight) player.yaw -= 2.2 * dt;
    if (stick) { f -= Math.max(-1, Math.min(1, stick.y)); s += Math.max(-1, Math.min(1, stick.x)); }
    const len = Math.hypot(f, s);
    if (len > 0.05) {
      const speed = (keys.Shift ? 720 : 380) * dt / Math.max(1, len);
      const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
      const dx = (cy * f + sy * s) * speed, dy = (sy * f - cy * s) * speed;
      if (!blocked(player.x + dx, player.y)) player.x += dx;
      if (!blocked(player.x, player.y + dy)) player.y += dy;
      player.bob += dt * (keys.Shift ? 14 : 9);
      player.moving = true;
    } else player.moving = false;
    // Jump (Space): simple gravity arc, no landing on top of parts.
    if (player.z > 0 || player.vz > 0) {
      player.vz -= 1500 * dt;
      player.z = Math.max(0, player.z + player.vz * dt);
      if (player.z === 0) player.vz = 0;
    }

    marks.forEach(m => {
      if (m.hit || Math.hypot(m.x - player.x, m.y - player.y) > 130) return;
      m.hit = true;
      taken += 1;
      flash = 1;
      hooks.onTake?.(taken, marks.length);
      if (taken === marks.length && !wrapped) {
        wrapped = true;
        hooks.onWrap?.(Math.round((now - started) / 1000));
      }
    });

    const pulse = 0.5 + 0.5 * Math.sin(now / 180);
    const extra = [];
    marks.forEach(m => {
      if (m.hit) return;
      const rgb = [215 + 40 * pulse, 246, 90 + 60 * pulse];
      m.mesh.beam.forEach(face => extra.push({ ...world.shade(face, rgb, true) }));
      m.mesh.ring.forEach(face => extra.push({ ...world.shade(face, rgb, true) }));
    });

    hooks.tick?.(player, dt);
    if (hooks.extra) extra.push(...hooks.extra(now));
    let camera;
    if (thirdPerson) {
      blockyAvatar(player.x, player.y, player.z, player.yaw, player.moving ? Math.sin(player.bob) : 0, AVATAR).forEach(face => extra.push(world.shade(face.pts, face.rgb, false)));
      // Orbit camera behind the avatar, pulled in if a part is in the way.
      const cp = Math.cos(player.pitch), sp = Math.sin(player.pitch);
      let back = 720;
      for (let d = 60; d <= 720; d += 30) {
        if (blocked(player.x - Math.cos(player.yaw) * cp * d, player.y - Math.sin(player.yaw) * cp * d)) { back = Math.max(80, d - 40); break; }
      }
      camera = { pos: [player.x - Math.cos(player.yaw) * cp * back, player.y - Math.sin(player.yaw) * cp * back, Math.max(40, 260 + player.z - sp * back)], yaw: player.yaw, pitch: player.pitch };
    } else {
      camera = { pos: [player.x, player.y, EYE + player.z + Math.sin(player.bob) * 4], yaw: player.yaw, pitch: player.pitch };
    }
    const { ctx, w, h } = sizeCanvas(canvas);
    const project = renderSetFrame(ctx, w, h, world, camera, extra);
    if (!marks.length) {
      hooks.hud?.(ctx, w, h, project, player, now);
      raf = requestAnimationFrame(frame);
      return;
    }

    // Viewfinder HUD
    ctx.strokeStyle = "rgba(242,240,233,0.55)";
    ctx.lineWidth = 2;
    // insetTop / insetBottom keep this clear of page HUD drawn over the canvas.
    const m = 18, c = 26, mt = m + (hooks.insetTop || 0), mb = h - m - (hooks.insetBottom || 0);
    [[m, mt, 1, 1], [w - m, mt, -1, 1], [m, mb, 1, -1], [w - m, mb, -1, -1]].forEach(([x, y, dx, dy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + dy * c); ctx.lineTo(x, y); ctx.lineTo(x + dx * c, y); ctx.stroke();
    });
    ctx.fillStyle = "rgba(242,240,233,0.7)";
    ctx.fillRect(w / 2 - 1, h / 2 - 6, 2, 12);
    ctx.fillRect(w / 2 - 6, h / 2 - 1, 12, 2);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff4d4d";
    if (Math.floor(now / 500) % 2) { ctx.beginPath(); ctx.arc(m + 14, mt + 40, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#f2f0e9";
    ctx.fillText(wrapped ? "WRAPPED \u2014 explore freely" : `REC  TAKES ${taken}/${marks.length}`, m + 28, mt + 45);
    const secs = Math.round((now - started) / 1000);
    ctx.textAlign = "right";
    ctx.fillText(`${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`, w - m - 10, mt + 45);

    // Compass arrow to the nearest remaining mark
    const next = marks.filter(mk => !mk.hit).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    if (next) {
      const rel = Math.atan2(next.y - player.y, next.x - player.x) - player.yaw;
      const ax = w / 2, ay = mb - 28;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(-rel);
      ctx.fillStyle = "#d7f65a";
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(10, 10); ctx.lineTo(0, 4); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign = "center";
      ctx.fillStyle = "#f2f0e9";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText(`${Math.round(Math.hypot(next.x - player.x, next.y - player.y) / 100)} m to mark`, ax, ay + 28);
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
      ctx.fillRect(0, 0, w, h);
      flash -= dt * 2.5;
    }
    raf = requestAnimationFrame(frame);
  };
  function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keydown", vk);
    window.removeEventListener("keyup", ku);
    document.removeEventListener("mousemove", mm);
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }
  raf = requestAnimationFrame(frame);
  return cleanup;
}

// Travels to a generated set: the game's main view swaps from the lot to
// the set (same window, same HUD) until "Back to the lot". Wrapping all
// takes pays a small location-scout fee once per cycle.
function openSetWalk(scene) {
  if (!scene || !Array.isArray(scene.objects)) return toast("No set to walk yet.");
  if (dialog.open) dialog.close();
  lot.activeSet = scene;
  currentView = "lot";
  renderApp();
}

function leaveSet() {
  if (document.pointerLockElement) document.exitPointerLock?.();
  lot.activeSet = null;
  renderApp();
}

function mountSetInWorld(canvas, scene) {
  document.getElementById("set-back").addEventListener("click", leaveSet);
  document.getElementById("set-roblox").addEventListener("click", () => {
    downloadRobloxSet(scene);
    toast("Roblox script saved. Paste it into the Studio command bar to build the set.");
  });
  const status = document.getElementById("set-status");
  canvas.focus({ preventScroll: true });
  return mountSetWalk(canvas, scene, {
    paused: () => dialog.open,
    insetTop: 130,
    insetBottom: 96,
    onTake: (n, total) => {
      if (status) status.textContent = n < total ? `Takes ${n}/${total}: find the next glowing mark` : "Wrapped! Explore, or head back to the lot";
      toast(n < total ? `Take ${n} in the can. ${total - n} to go.` : "That's a wrap on this set!");
    },
    onWrap: seconds => {
      if (state.walkCycle === state.cycle) return toast(`Wrapped in ${seconds}s. Scout fee already paid this cycle.`);
      const fee = seconds < 60 ? 12 : seconds < 120 ? 8 : 5;
      state.walkCycle = state.cycle;
      state.credits += fee;
      addActivity(`You shot a location scout on "${scene.title || "a generated set"}" in ${seconds}s.`);
      saveState();
      document.getElementById("credit-balance").textContent = formatNumber(state.credits);
      toast(`Wrapped in ${seconds}s! +${fee} cr scout fee.`);
    }
  });
}
