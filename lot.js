// ------------------------------------------------------------------
// The Lot — a walkable, top-down studio backlot that is the game's home
// screen. Every building is a doorway into an existing flow in app.js
// (gigs, greenlight, production stages, catalog, assets, end cycle), so
// the economy is unchanged; this file only adds the "being there" layer.
//
// Controls: WASD / arrows to walk, E / Enter / Space at a door to go in.
// On touch: tap anywhere to walk there, tap a building to walk in.
// Loaded after app.js as a plain script; uses its globals directly.
// ------------------------------------------------------------------

const LOT_W = 1400;
const LOT_H = 900;

const lotBuildings = [
  { id: "board", label: "CREW BOARD", sub: "Take gigs", x: 120, y: 120, w: 220, h: 150, wall: "#3b4a3f", roof: "#d7f65a", icon: "★" },
  { id: "stage", label: "SOUNDSTAGE 1", sub: "Your production", x: 540, y: 90, w: 320, h: 200, wall: "#40404a", roof: "#87a9ff", icon: "▶" },
  { id: "cinema", label: "CINEMA", sub: "Watch the catalog", x: 1050, y: 120, w: 230, h: 160, wall: "#4a3434", roof: "#ff7165", icon: "☆" },
  { id: "warehouse", label: "PROP HOUSE", sub: "Assets & rentals", x: 120, y: 560, w: 240, h: 150, wall: "#4a4234", roof: "#f3ad52", icon: "■" },
  { id: "office", label: "FRONT OFFICE", sub: "End cycle / career", x: 590, y: 580, w: 220, h: 140, wall: "#34444a", roof: "#48c5ad", icon: "☼" },
  { id: "tower", label: "WORLD TOWER", sub: "Prompt the world", x: 1090, y: 540, w: 140, h: 170, wall: "#3a3448", roof: "#b58cff", icon: "◉" },
  { id: "trailer", label: "LIVE SET", sub: "Watch live", x: 1080, y: 380, w: 150, h: 70, wall: "#484034", roof: "#e8e2d0", icon: "●" }
];

const lotTrees = [[60, 420], [420, 60], [960, 60], [1340, 60], [460, 760], [900, 780], [1340, 820], [60, 820], [420, 470], [960, 470]];

const npcLines = [
  "Quiet on set!", "Who took the boom mic?", "Rolling in five.", "Coffee's cold again.",
  "Heard the Soundstage is hiring.", "That last take was gold.", "Anyone seen the gaffer?",
  "Lunch is on the Office.", "Check the Crew Board!", "The Cinema's packed tonight."
];

const lot = {
  player: { x: 700, y: 440, dir: 1, step: 0 },
  keys: {},
  target: null,
  pendingEnter: null,
  npcs: [],
  pops: [],
  raf: 0,
  lastCredits: null,
  lastRep: null,
  hudTimer: 0,
  canvas: null,
  camera: { x: 0, y: 0, scale: 1 }
};

try { lot.mode3d = localStorage.getItem("take-one-lot-mode") !== "2d"; } catch (error) { lot.mode3d = true; }

(function seedNpcs() {
  const shirts = ["#ff7165", "#48c5ad", "#f3ad52", "#87a9ff", "#d7f65a", "#e8e2d0"];
  for (let i = 0; i < 6; i++) {
    lot.npcs.push({ x: 300 + i * 150, y: 430 + (i % 2) * 40, tx: 0, ty: 0, shirt: shirts[i], wait: i * 40, say: "", sayT: 0, step: 0 });
  }
})();

function renderLot() {
  if (lot.activeSet) {
    return `
    <section class="lot-wrap" aria-label="Generated set">
      <canvas id="lot-canvas" tabindex="0" aria-label="Walkable generated set. Click to look, WASD to move."></canvas>
      <div class="lot-hud">
        <div class="lot-quest"><span class="eyebrow">On set / ${escapeHTML(lot.activeSet.title || "Generated set")}</span><strong id="set-status">Takes 0/3: follow the arrow to the glowing marks</strong></div>
      </div>
      <nav class="lot-dock" aria-label="Set actions">
        <button class="lot-dock-button" id="set-back" style="--dock:#d7f65a"><span class="lot-dock-icon">&#8617;</span><span class="lot-dock-label">BACK TO LOT</span></button>
        <button class="lot-dock-button" id="set-roblox" style="--dock:#87a9ff"><span class="lot-dock-icon">&#8681;</span><span class="lot-dock-label">ROBLOX</span></button>
      </nav>
      <div class="lot-help">Click to look &middot; WASD walk &middot; <kbd>Shift</kbd> run &middot; <kbd>Space</kbd> jump &middot; <kbd>V</kbd> camera &middot; <kbd>Esc</kbd> mouse</div>
    </section>`;
  }
  return `
    <section class="lot-wrap" aria-label="Studio lot">
      <canvas id="lot-canvas" tabindex="0" aria-label="Studio lot. Walk with WASD or arrows, press E at a door."></canvas>
      <div class="lot-hud">
        <div class="lot-quest"><span class="eyebrow">Objective</span><strong id="lot-objective"></strong></div>
        <div class="lot-prompt" id="lot-prompt" hidden></div>
      </div>
      <nav class="lot-dock" aria-label="Quick actions">
        ${lotBuildings.filter(b => b.id !== "trailer").map((b, i) => `<button class="lot-dock-button" data-dock="${b.id}" style="--dock:${b.roof}" title="${b.sub} (${i + 1})"><span class="lot-dock-key">${i + 1}</span><span class="lot-dock-icon">${b.icon}</span><span class="lot-dock-label">${b.label.split(" ")[0]}</span>${lotBadge(b.id) ? `<span class="lot-dock-badge">${lotBadge(b.id)}</span>` : ""}</button>`).join("")}
      </nav>
      <button class="button compact lot-toggle" id="lot-toggle">${lot.mode3d ? "2D map" : "3D lot"}</button>
      <div class="lot-help">${lot.mode3d
        ? "Click to look &middot; WASD walk &middot; <kbd>Space</kbd> jump &middot; <kbd>V</kbd> camera &middot; <kbd>E</kbd> enter"
        : "WASD / arrows to walk &middot; <kbd>E</kbd> to enter &middot; tap to move"}</div>
    </section>`;
}

function lotObjective() {
  const p = state.production;
  if (p && !p.released) {
    const stage = productionStages[p.stage];
    return { text: `Soundstage 1: ${stage ? `run ${stage.short.toLowerCase()}` : "finish the film"}`, target: "stage" };
  }
  if (p && p.released) return { text: `"${p.title}" is out! End the cycle at the Office to collect residuals`, target: "office" };
  if (state.reputation >= 60 && state.credits >= 420) return { text: "Soundstage 1: greenlight your first film", target: "stage" };
  if (availableGigCount() > 0) {
    const need = state.reputation >= 60 ? `${420 - state.credits} more credits` : `${60 - state.reputation} more reputation`;
    return { text: `Crew Board: take a gig (${need} to direct)`, target: "board" };
  }
  return { text: "Front Office: end the cycle for a fresh board", target: "office" };
}

function mountLot() {
  const canvas = document.getElementById("lot-canvas");
  if (!canvas) return;
  lot.canvas = canvas;
  if (lot.lastCredits === null) { lot.lastCredits = state.credits; lot.lastRep = state.reputation; }
  cancelAnimationFrame(lot.raf);
  if (lot.cleanup3d) { lot.cleanup3d(); lot.cleanup3d = null; }
  if (lot.activeSet) { lot.cleanup3d = mountSetInWorld(canvas, lot.activeSet); return; }
  document.querySelectorAll("[data-dock]").forEach(button => button.addEventListener("click", () => {
    lotEnter(lotBuildings.find(b => b.id === button.dataset.dock));
  }));
  document.getElementById("lot-toggle").addEventListener("click", () => {
    lot.mode3d = !lot.mode3d;
    try { localStorage.setItem("take-one-lot-mode", lot.mode3d ? "3d" : "2d"); } catch (error) { /* per-viewer nicety only */ }
    renderApp();
  });
  if (lot.mode3d) return mountLot3d(canvas);

  canvas.addEventListener("pointerdown", event => {
    const rect = canvas.getBoundingClientRect();
    const wx = (event.clientX - rect.left) / lot.camera.scale + lot.camera.x;
    const wy = (event.clientY - rect.top) / lot.camera.scale + lot.camera.y;
    const hit = lotBuildings.find(b => wx >= b.x && wx <= b.x + b.w && wy >= b.y - 30 && wy <= b.y + b.h);
    if (hit) {
      lot.target = lotDoor(hit);
      lot.pendingEnter = hit;
    } else {
      lot.target = { x: wx, y: wy };
      lot.pendingEnter = null;
    }
    canvas.focus({ preventScroll: true });
  });
  canvas.focus({ preventScroll: true });

  let last = performance.now();
  const frame = now => {
    if (!document.body.contains(canvas)) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    lotUpdate(dt);
    lotDraw(canvas);
    lot.raf = requestAnimationFrame(frame);
  };
  lot.raf = requestAnimationFrame(frame);
  lotUpdateHud(true);
}

function lotDoor(b) {
  return { x: b.x + b.w / 2, y: b.y + b.h + 22 };
}

function lotNearest() {
  let best = null;
  let bestD = 70;
  lotBuildings.forEach(b => {
    const d = lotDoor(b);
    const dist = Math.hypot(d.x - lot.player.x, d.y - lot.player.y);
    if (dist < bestD) { bestD = dist; best = b; }
  });
  return best;
}

function lotBlocked(x, y) {
  if (x < 16 || y < 16 || x > LOT_W - 16 || y > LOT_H - 16) return true;
  return lotBuildings.some(b => x > b.x - 12 && x < b.x + b.w + 12 && y > b.y - 4 && y < b.y + b.h + 10);
}

function lotMove(entity, dx, dy) {
  if (!lotBlocked(entity.x + dx, entity.y)) entity.x += dx;
  if (!lotBlocked(entity.x, entity.y + dy)) entity.y += dy;
}

function lotUpdate(dt) {
  const p = lot.player;
  const k = lot.mode3d ? {} : lot.keys;
  if (lot.mode3d) { lot.target = null; lot.pendingEnter = null; }
  let dx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.a ? 1 : 0);
  let dy = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.w ? 1 : 0);
  if (dx || dy) { lot.target = null; lot.pendingEnter = null; }
  if (!dx && !dy && lot.target) {
    const tx = lot.target.x - p.x;
    const ty = lot.target.y - p.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 6) {
      lot.target = null;
      if (lot.pendingEnter) { const b = lot.pendingEnter; lot.pendingEnter = null; lotEnter(b); }
    } else { dx = tx / dist; dy = ty / dist; }
  }
  const len = Math.hypot(dx, dy);
  if (len) {
    const speed = 260 * dt;
    const bx = p.x, by = p.y;
    lotMove(p, (dx / len) * speed, (dy / len) * speed);
    if (Math.abs(dx) > 0.1) p.dir = dx > 0 ? 1 : -1;
    p.step += dt * 10;
    if (lot.target && Math.hypot(p.x - bx, p.y - by) < 0.5) { lot.target = null; lot.pendingEnter = null; }
  }

  lot.npcs.forEach(n => {
    if (n.wait > 0) { n.wait -= 1; return; }
    if (!n.tx || Math.hypot(n.tx - n.x, n.ty - n.y) < 8) {
      n.tx = 40 + Math.random() * (LOT_W - 80);
      n.ty = 40 + Math.random() * (LOT_H - 80);
      n.wait = 60 + Math.random() * 180;
      if (Math.random() < 0.35) { n.say = npcLines[Math.floor(Math.random() * npcLines.length)]; n.sayT = 3; }
      return;
    }
    const ddx = n.tx - n.x, ddy = n.ty - n.y, d = Math.hypot(ddx, ddy);
    const bx = n.x, by = n.y;
    lotMove(n, (ddx / d) * 90 * dt, (ddy / d) * 90 * dt);
    if (Math.hypot(n.x - bx, n.y - by) < 0.2) n.tx = 0;
    n.step += dt * 8;
    if (n.sayT > 0) n.sayT -= dt;
  });

  if (state.credits !== lot.lastCredits) {
    const diff = state.credits - lot.lastCredits;
    lot.pops.push({ text: `${diff > 0 ? "+" : ""}${diff} cr`, color: diff > 0 ? "#d7f65a" : "#ff7165", t: 1.8 });
    lot.lastCredits = state.credits;
  }
  if (state.reputation !== lot.lastRep) {
    const diff = state.reputation - lot.lastRep;
    lot.pops.push({ text: `${diff > 0 ? "+" : ""}${diff} rep`, color: diff > 0 ? "#48c5ad" : "#ff7165", t: 2.2 });
    lot.lastRep = state.reputation;
  }
  lot.pops.forEach(pop => { pop.t -= dt; });
  lot.pops = lot.pops.filter(pop => pop.t > 0);

  lot.hudTimer -= dt;
  if (lot.hudTimer <= 0) lotUpdateHud();
}

function lotUpdateHud() {
  lot.hudTimer = 0.25;
  const objective = document.getElementById("lot-objective");
  if (objective) objective.textContent = lotObjective().text;
  const prompt = document.getElementById("lot-prompt");
  if (!prompt) return;
  const near = lotNearest();
  prompt.hidden = !near;
  if (near) prompt.innerHTML = `<kbd>E</kbd> Enter <strong>${near.label}</strong> <span>${near.sub}</span>`;
}

function lotDraw(canvas) {
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const scale = Math.max(cw / (cw < 700 ? 620 : 1050), ch / LOT_H);
  const cam = lot.camera;
  cam.scale = scale;
  cam.x = clamp(lot.player.x - cw / scale / 2, 0, Math.max(0, LOT_W - cw / scale));
  cam.y = clamp(lot.player.y - ch / scale / 2, 0, Math.max(0, LOT_H - ch / scale));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
  const t = performance.now() / 1000;

  // Ground and roads
  ctx.fillStyle = "#1f2a20";
  ctx.fillRect(0, 0, LOT_W, LOT_H);
  ctx.fillStyle = "#2a2e2a";
  ctx.fillRect(0, 370, LOT_W, 150);
  ctx.fillRect(440, 0, 60, LOT_H);
  ctx.fillRect(930, 0, 60, LOT_H);
  ctx.strokeStyle = "#e8e2d0";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  ctx.moveTo(0, 445); ctx.lineTo(LOT_W, 445);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Studio gate sign
  ctx.fillStyle = "#101210";
  ctx.fillRect(560, 400, 280, 90);
  ctx.strokeStyle = "#d7f65a";
  ctx.lineWidth = 3;
  ctx.strokeRect(560, 400, 280, 90);
  ctx.fillStyle = "#d7f65a";
  ctx.font = "bold 38px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TAKE ONE", 700, 452);
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#9da39d";
  ctx.fillText(`STUDIOS  ·  CYCLE ${String(state.cycle).padStart(2, "0")}`, 700, 475);

  lotTrees.forEach(([x, y]) => {
    ctx.fillStyle = "#4a3a28"; ctx.fillRect(x - 5, y, 10, 18);
    ctx.fillStyle = "#2f5a36"; ctx.beginPath(); ctx.arc(x, y - 4, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3d7044"; ctx.beginPath(); ctx.arc(x - 6, y - 10, 12, 0, Math.PI * 2); ctx.fill();
  });

  const objective = lotObjective().target;
  const near = lotNearest();
  lotBuildings.forEach(b => {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - 6, b.y - 26, b.w + 12, 34);
    ctx.fillStyle = "#101210";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.fillText(b.label, b.x + b.w / 2, b.y - 3);
    // windows
    ctx.fillStyle = b.id === "stage" && state.production && !state.production.released ? "#ffe9a8" : "#56615a";
    for (let wx = b.x + 20; wx < b.x + b.w - 30; wx += 44) ctx.fillRect(wx, b.y + 26, 24, 18);
    // door
    const door = lotDoor(b);
    ctx.fillStyle = near === b ? b.roof : "#161816";
    ctx.fillRect(door.x - 18, b.y + b.h - 44, 36, 44);
    ctx.fillStyle = "#e8e2d0";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(b.icon, b.x + b.w / 2, b.y + b.h / 2 + 22);
    // badges
    const badge = lotBadge(b.id);
    if (badge) {
      ctx.fillStyle = "#ff7165";
      ctx.beginPath(); ctx.arc(b.x + b.w - 4, b.y - 26, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px system-ui, sans-serif";
      ctx.fillText(badge, b.x + b.w - 4, b.y - 21);
    }
    if (objective === b.id) {
      const bob = Math.sin(t * 4) * 6;
      ctx.fillStyle = "#d7f65a";
      ctx.beginPath();
      ctx.moveTo(door.x - 12, b.y - 62 + bob);
      ctx.lineTo(door.x + 12, b.y - 62 + bob);
      ctx.lineTo(door.x, b.y - 42 + bob);
      ctx.fill();
    }
  });

  // Tower antenna pulse
  const tower = lotBuildings.find(b => b.id === "tower");
  ctx.strokeStyle = "#b58cff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6 - ((t % 1.5) / 1.5) * 0.6;
  ctx.beginPath(); ctx.arc(tower.x + tower.w / 2, tower.y - 30, 10 + (t % 1.5) * 40, Math.PI, 0); ctx.stroke();
  ctx.globalAlpha = 1;

  if (lot.target) {
    ctx.strokeStyle = "#d7f65a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(lot.target.x, lot.target.y, 12, 6, 0, 0, Math.PI * 2); ctx.stroke();
  }

  const people = [...lot.npcs.map(n => ({ ...n, npc: true })), { ...lot.player, shirt: "#101210", player: true }]
    .sort((a, b) => a.y - b.y);
  people.forEach(person => lotDrawPerson(ctx, person));

  lot.npcs.forEach(n => {
    if (n.sayT <= 0) return;
    ctx.font = "13px system-ui, sans-serif";
    const w = ctx.measureText(n.say).width + 16;
    ctx.fillStyle = "rgba(242,240,233,0.95)";
    ctx.fillRect(n.x - w / 2, n.y - 62, w, 22);
    ctx.fillStyle = "#101210";
    ctx.fillText(n.say, n.x, n.y - 46);
  });

  lot.pops.forEach((pop, i) => {
    ctx.globalAlpha = Math.min(1, pop.t);
    ctx.fillStyle = pop.color;
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillText(pop.text, lot.player.x, lot.player.y - 60 - (2.2 - pop.t) * 30 - i * 22);
    ctx.globalAlpha = 1;
  });

  // Night falls as cycles pass within a "week"
  const night = (state.cycle % 4) / 16;
  if (night) {
    ctx.fillStyle = `rgba(10,14,40,${night})`;
    ctx.fillRect(0, 0, LOT_W, LOT_H);
  }
}

function lotDrawPerson(ctx, p) {
  const swing = Math.sin(p.step) * 4;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(p.x - 7, p.y - 12, 5, 12 + swing * 0.5);
  ctx.fillRect(p.x + 2, p.y - 12, 5, 12 - swing * 0.5);
  ctx.fillStyle = p.player ? "#d7f65a" : p.shirt;
  ctx.fillRect(p.x - 10, p.y - 32, 20, 22);
  ctx.fillStyle = "#e0b48c";
  ctx.beginPath(); ctx.arc(p.x, p.y - 40, 9, 0, Math.PI * 2); ctx.fill();
  if (p.player) {
    ctx.fillStyle = "#101210"; // director's beret
    ctx.beginPath(); ctx.ellipse(p.x + p.dir * 2, p.y - 48, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2f0e9";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.fillText("YOU", p.x, p.y + 16);
  }
}

function lotBadge(id) {
  if (id === "board") { const n = availableGigCount(); return n ? String(n) : ""; }
  if (id === "stage") return state.production && !state.production.released ? "!" : (state.reputation >= 60 && state.credits >= 420 && !state.production ? "!" : "");
  if (id === "warehouse") return (state.assetDrafts || []).length ? String(state.assetDrafts.length) : "";
  if (id === "tower") return state.promptCycle === state.cycle ? "" : "!";
  return "";
}

function lotEnter(b) {
  lot.keys = {};
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (b.id === "board") return openCrewBoard();
  if (b.id === "stage") return openSoundstage();
  if (b.id === "cinema") return openCinema();
  if (b.id === "warehouse") return (state.assetDrafts || []).length ? openPublishAsset() : setView("assets");
  if (b.id === "office") return openFrontOffice();
  if (b.id === "tower") return openWorldPrompt();
  if (b.id === "trailer") return openLiveSet();
}

function openCrewBoard() {
  const canRefresh = state.completedGigs.length > 0 && state.credits >= 40;
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">Crew Board / Cycle ${state.cycle}</p><h2 id="dialog-title">Pick a job, make it count.</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body"><div class="gig-list">${gigs.map(renderGigRow).join("")}</div></div>
    <div class="dialog-footer"><span class="text-small subdued">Read the director's brief and make the right calls.</span><button class="button" id="lot-refresh" ${canRefresh ? "" : "disabled"}>&#8635; New postings / 40 cr</button></div>`);
  dialog.classList.add("dialog-wide");
  dialog.addEventListener("close", () => dialog.classList.remove("dialog-wide"), { once: true });
  dialogContent.querySelectorAll("[data-gig-id]").forEach(button => button.addEventListener("click", () => { dialog.classList.remove("dialog-wide"); openGig(button.dataset.gigId); }));
  const refresh = document.getElementById("lot-refresh");
  if (refresh) refresh.addEventListener("click", () => { refreshBoard(); openCrewBoard(); });
}

function openSoundstage() {
  const p = state.production;
  if (!p) {
    if (state.reputation < 60) return toast(`The stage manager shrugs: "Come back at 60 reputation." (${state.reputation} now)`);
    if (state.credits < 420) return toast(`You need 420 credits to fund a film. You have ${state.credits}.`);
    return openGreenlight();
  }
  if (p.released) {
    state.production = null;
    saveState();
    return openGreenlight();
  }
  const stage = productionStages[p.stage];
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">Soundstage 1 / ${escapeHTML(p.genre)}</p><h2 id="dialog-title">${escapeHTML(p.title)}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body">
      ${p.sceneSpec ? `<canvas class="set-viewer" id="stage-set-viewer" aria-label="3D view of your key set. Drag to orbit."></canvas>` : ""}
      <div class="pipeline">${productionStages.map((s, i) => `<div class="pipeline-step ${i < p.stage ? "done" : i === p.stage ? "current" : ""}"><span>${i < p.stage ? "Done" : i === p.stage ? "Now" : `0${i + 1}`}</span><strong>${s.short}</strong></div>`).join("")}</div>
      <div class="quality-readout" style="margin-top:16px"><div><span>Creative signal</span><strong>${p.quality}</strong></div><div><span>Budget</span><strong>${p.budget} cr</strong></div></div>
    </div>
    <div class="dialog-footer">
      ${p.sceneSpec ? `<button class="button" id="lot-walk-set">&#9654; Walk the set</button>` : ""}
      <button class="button" id="lot-direct">&#9673; Direct the cast</button>
      <button class="button primary" id="lot-run">${stage ? `Run ${stage.short.toLowerCase()}` : "Finish film"} &#8594;</button>
    </div>`);
  if (p.sceneSpec) {
    mountSetViewer(document.getElementById("stage-set-viewer"), p.sceneSpec);
    document.getElementById("lot-walk-set").addEventListener("click", () => openSetWalk(p.sceneSpec));
  }
  document.getElementById("lot-direct").addEventListener("click", () => openDirectSet(0));
  document.getElementById("lot-run").addEventListener("click", openProductionStage);
}

function openCinema() {
  const films = allFilms().slice().sort((a, b) => b.score - a.score).slice(0, 6);
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">Cinema / Now showing</p><h2 id="dialog-title">Tonight's marquee</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body"><div class="catalog-grid">
      ${films.map(film => `
        <article class="film-card" data-film-id="${film.id}" tabindex="0" role="button">
          <div class="film-image"><img src="${filmImage(film)}" alt=""><div class="film-score">${film.score}</div></div>
          <div class="film-copy"><h3>${escapeHTML(film.title)}</h3><div class="film-meta"><span>${film.genre}</span><span>${formatViews(film.views)} views</span></div></div>
        </article>`).join("")}
    </div></div>
    <div class="dialog-footer"><button class="button" id="lot-full-catalog">Full catalog</button></div>`);
  dialogContent.querySelectorAll("[data-film-id]").forEach(card => card.addEventListener("click", () => openFilm(card.dataset.filmId)));
  document.getElementById("lot-full-catalog").addEventListener("click", () => setView("catalog"));
}

function openFrontOffice() {
  const rank = getRank();
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">Front Office / ${rank.tier}</p><h2 id="dialog-title">${rank.name}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body">
      <div class="brief-box"><strong>The assistant looks up.</strong><p>${rank.next ? `${Math.max(0, rank.next - state.reputation)} reputation until ${nextRankLabel(rank.next)}.` : "You run this lot now."} Ending the cycle pays out residuals, rentals and investments, and posts new work.</p></div>
      <div class="activity-list" style="margin-top:14px">${state.activities.slice(0, 4).map(item => `<div class="activity-item"><span class="activity-dot"></span><span>${escapeHTML(item.text)}</span><time>${item.time}</time></div>`).join("")}</div>
    </div>
    <div class="dialog-footer">
      <button class="button danger" id="lot-reset">Reset save</button>
      <button class="button" id="lot-dashboard">Career &amp; producer desk</button>
      <button class="button primary" id="lot-end-cycle">&#8635; End cycle ${state.cycle}</button>
    </div>`);
  document.getElementById("lot-dashboard").addEventListener("click", () => setView("studio"));
  document.getElementById("lot-reset").addEventListener("click", () => document.getElementById("reset-progress").click());
  document.getElementById("lot-end-cycle").addEventListener("click", () => { dialog.close(); advanceCycle(); });
}

// ------------------------------------------------------------------
// 3D lot. The same buildings, trees and crew as the 2D map, built as a
// scene spec and walked with set-viewer.js's mountSetWalk (third-person
// blocky avatar by default). The 3D position is mapped back onto the 2D
// lot coordinates every frame, so door detection, the objective HUD and
// the E-to-enter handler above all work unchanged.
// ------------------------------------------------------------------

const LOT_S = 5; // 1 lot unit = 5 cm... ~ so the lot is 70 m x 45 m
const lotTo3d = (x, y) => [(x - LOT_W / 2) * LOT_S, (LOT_H / 2 - y) * LOT_S];
const lotFrom3d = (x, y) => [x / LOT_S + LOT_W / 2, LOT_H / 2 - y / LOT_S];
const lotHeights = { board: 650, stage: 1300, cinema: 900, warehouse: 700, office: 800, tower: 1700, trailer: 380 };

function lotScene3d() {
  const objects = [];
  const add = (label, primitive, x, y, z, sx, sy, sz, color, yaw = 0) => objects.push({
    id: `lot_${objects.length}`, label, primitive,
    location: { x, y, z }, rotation: { pitch: 0, yaw, roll: 0 },
    scale: { x: sx / 100, y: sy / 100, z: sz / 100 }, color
  });
  const W = LOT_W * LOT_S, H = LOT_H * LOT_S;
  // Roads (flat, walkable) and the perimeter fence.
  const [, roadY] = lotTo3d(0, 445);
  add("Main road", "cube", 0, roadY, 2, W, 150 * LOT_S, 4, "#4A4D52");
  [470, 960].forEach(x => { const [rx] = lotTo3d(x, 0); add("Cross road", "cube", rx, 0, 2, 60 * LOT_S, H, 4, "#4A4D52"); });
  for (let i = 0; i < 14; i++) add("Road stripe", "cube", -W / 2 + 250 + i * 500, roadY, 5, 260, 30, 2, "#F2F0E9");
  add("Fence", "cube", 0, H / 2, 90, W, 30, 180, "#8A8F96");
  add("Fence", "cube", 0, -H / 2, 90, W, 30, 180, "#8A8F96");
  add("Fence", "cube", W / 2, 0, 90, 30, H, 180, "#8A8F96");
  add("Fence", "cube", -W / 2, 0, 90, 30, H, 180, "#8A8F96");

  lotBuildings.forEach(b => {
    const [cx, cy] = lotTo3d(b.x + b.w / 2, b.y + b.h / 2);
    const w = b.w * LOT_S, d = b.h * LOT_S, h = lotHeights[b.id] || 700;
    const frontY = cy - d / 2;
    const tower = b.id === "tower";
    if (tower) {
      add(`${b.label} base`, "cylinder", cx, cy, h / 2, w * 0.8, w * 0.8, h, b.wall);
      add(`${b.label} beacon light`, "sphere", cx, cy, h + 120, 240, 240, 240, b.roof);
    } else {
      add(b.label, "cube", cx, cy, h / 2, w, d, h, b.wall);
      add(`${b.label} roof`, "cube", cx, cy, h + 30, w + 80, d + 80, 60, b.roof);
    }
    add(`${b.label} door`, "cube", cx, frontY - 6, 150, 240, 12, 300, "#1A1C1E");
    add(`${b.label} sign light`, "cube", cx, frontY - 10, Math.min(h - 120, 520), Math.min(w * 0.8, 900), 12, 140, b.roof);
    if (!tower) {
      for (let wx = -w / 2 + 180; wx < w / 2 - 180; wx += 320) {
        if (Math.abs(wx) < 200) continue;
        add("Window light", "cube", cx + wx, frontY - 6, h * 0.45, 180, 10, 140, b.id === "stage" && state.production && !state.production.released ? "#FFE9A8" : "#9CC8E8");
      }
    }
  });

  // Studio gate: two posts and a sign board over the main road.
  const [gx, gy] = lotTo3d(700, 445);
  add("Gate post", "cube", gx - 700, gy, 300, 60, 60, 600, "#101210");
  add("Gate post", "cube", gx + 700, gy, 300, 60, 60, 600, "#101210");
  add("Gate sign", "cube", gx, gy, 560, 1460, 40, 160, "#101210");
  add("Gate sign light", "cube", gx, gy - 24, 560, 1300, 10, 110, "#D7F65A");

  lotTrees.forEach(([x, y]) => {
    const [tx, ty] = lotTo3d(x, y);
    add("Tree trunk", "cylinder", tx, ty, 130, 50, 50, 260, "#6B4A2E");
    add("Tree canopy", "sphere", tx, ty, 340, 300, 300, 260, "#3FA34D");
  });

  const night = (state.cycle % 4) / 4;
  const mix = (a, b) => `#${hexToRgb(a).map((c, i) => Math.round(c + (hexToRgb(b)[i] - c) * night).toString(16).padStart(2, "0")).join("")}`;
  return {
    title: "Take One Studios lot",
    environment: {
      ground_color: mix("#5FAE4E", "#2E5A30"),
      sky_light_color: mix("#8FCBFF", "#27406E"),
      sky_light_intensity: 1 - night * 0.5,
      sun_color: "#FFF1D6",
      sun_intensity: 7 - night * 4,
      sun_rotation: { pitch: -48, yaw: -30, roll: 0 },
      fog_density: 0.004
    },
    objects
  };
}

function mountLot3d(canvas) {
  const [sx, sy] = lotTo3d(lot.player.x, lot.player.y);
  const npcColors = [
    { skin: [245, 205, 48], shirt: [196, 40, 28], pants: [40, 40, 44] },
    { skin: [204, 142, 105], shirt: [72, 197, 173], pants: [13, 105, 172] },
    { skin: [245, 205, 48], shirt: [243, 173, 82], pants: [75, 151, 75] },
    { skin: [124, 92, 70], shirt: [135, 169, 255], pants: [40, 40, 44] },
    { skin: [245, 205, 48], shirt: [215, 246, 90], pants: [99, 95, 98] },
    { skin: [234, 184, 146], shirt: [232, 226, 208], pants: [13, 105, 172] }
  ].map(c => ({ ...c, face: [30, 30, 30], hat: null }));

  lot.cleanup3d = mountSetWalk(canvas, lotScene3d(), {
    marks: false,
    spawn: { x: sx, y: sy, yaw: lot.yaw3d ?? Math.PI / 2 },
    paused: () => dialog.open || currentView !== "lot",
    tick: (player, dt) => {
      [lot.player.x, lot.player.y] = lotFrom3d(player.x, player.y);
      lot.yaw3d = player.yaw;
      lotUpdate(dt);
    },
    extra: now => {
      const polys = [];
      lot.npcs.forEach((n, i) => {
        const [x, y] = lotTo3d(n.x, n.y);
        const moving = n.wait <= 0;
        const yaw = Math.atan2(-(n.ty - n.y), n.tx - n.x);
        blockyAvatar(x, y, 0, yaw, moving ? Math.sin(n.step) : 0, npcColors[i % npcColors.length])
          .forEach(face => polys.push({ face: face.pts, rgb: face.rgb }));
      });
      return polys;
    },
    hud: (ctx, w, h, project, player, now) => {
      const objective = lotObjective().target;
      const near = lotNearest();
      ctx.textAlign = "center";
      lotBuildings.forEach(b => {
        const [cx, cy] = lotTo3d(b.x + b.w / 2, b.y + b.h / 2);
        const top = (lotHeights[b.id] || 700) + 260;
        const p = project([cx, cy - (b.h * LOT_S) / 2, top]);
        if (!p || p[2] > 9000) return;
        const size = Math.max(11, Math.min(22, 9000 / p[2] * 2.2));
        ctx.font = `900 ${size}px system-ui, sans-serif`;
        const label = b.label;
        const tw = ctx.measureText(label).width + 16;
        ctx.fillStyle = near === b ? "rgba(215,246,90,0.95)" : "rgba(16,18,16,0.8)";
        ctx.fillRect(p[0] - tw / 2, p[1] - size - 6, tw, size + 12);
        ctx.fillStyle = near === b ? "#101210" : "#F2F0E9";
        ctx.fillText(label, p[0], p[1] + 1);
        const badge = lotBadge(b.id);
        if (badge) {
          ctx.fillStyle = "#ff4d4d";
          ctx.beginPath(); ctx.arc(p[0] + tw / 2, p[1] - size - 4, 11, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui, sans-serif";
          ctx.fillText(badge, p[0] + tw / 2, p[1] - size);
        }
        if (objective === b.id) {
          const bob = Math.sin(now / 200) * 6;
          ctx.fillStyle = "#d7f65a";
          ctx.beginPath();
          ctx.moveTo(p[0] - 12, p[1] - size - 34 + bob);
          ctx.lineTo(p[0] + 12, p[1] - size - 34 + bob);
          ctx.lineTo(p[0], p[1] - size - 14 + bob);
          ctx.fill();
        }
      });
      // Gate sign text
      const [gx, gy] = lotTo3d(700, 445);
      const g = project([gx, gy - 40, 560]);
      if (g && g[2] < 8000) {
        ctx.font = `900 ${Math.max(10, Math.min(46, 30000 / g[2]))}px system-ui, sans-serif`;
        ctx.fillStyle = "#101210";
        ctx.fillText("TAKE ONE", g[0], g[1] + 10);
      }
      // Crew chatter
      ctx.font = "13px system-ui, sans-serif";
      lot.npcs.forEach(n => {
        if (n.sayT <= 0) return;
        const [x, y] = lotTo3d(n.x, n.y);
        const p = project([x, y, 290]);
        if (!p || p[2] > 5000) return;
        const tw = ctx.measureText(n.say).width + 16;
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(p[0] - tw / 2, p[1] - 22, tw, 22);
        ctx.fillStyle = "#101210";
        ctx.fillText(n.say, p[0], p[1] - 6);
      });
      // Credit / rep pops
      lot.pops.forEach((pop, i) => {
        ctx.globalAlpha = Math.min(1, pop.t);
        ctx.fillStyle = pop.color;
        ctx.font = "900 26px system-ui, sans-serif";
        ctx.fillText(pop.text, w / 2, h / 2 - 60 - (2.2 - pop.t) * 30 - i * 28);
        ctx.globalAlpha = 1;
      });
    }
  });
  canvas.focus({ preventScroll: true });
  lotUpdateHud();
}

document.addEventListener("keydown", event => {
  if (currentView !== "lot" || dialog.open || lot.activeSet) return;
  if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(key)) {
    lot.keys[key] = true;
    event.preventDefault();
  } else if (/^[1-6]$/.test(key)) {
    const dockable = lotBuildings.filter(b => b.id !== "trailer");
    lotEnter(dockable[Number(key) - 1]);
  } else if (key === "e" || key === "Enter" || (key === " " && !lot.mode3d)) {
    const near = lotNearest();
    if (near) { event.preventDefault(); lotEnter(near); }
  }
});
document.addEventListener("keyup", event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  delete lot.keys[key];
});
window.addEventListener("blur", () => { lot.keys = {}; });

// app.js booted on the Studio dashboard before this script loaded; the lot
// is the real home screen, so switch to it now.
setView("lot");
