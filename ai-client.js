// Take One — browser-side AI client.
//
// Thin fetch wrapper around the ai-scene-service adapter. Every call degrades
// gracefully: if the adapter is unreachable (or running without an LLM key),
// deterministic local generators keep the game fully playable. Status is
// exposed so the UI can show whether generation is live-model or local.

const TakeOneAI = (() => {
  const URL_KEY = "take-one-ai-url";
  const DEFAULT_URL = "http://127.0.0.1:8788";

  let serviceUrl = DEFAULT_URL;
  try {
    serviceUrl = localStorage.getItem(URL_KEY) || DEFAULT_URL;
  } catch {
    /* private mode */
  }

  let status = "unknown"; // unknown | online | offline
  let healthInfo = null;
  const listeners = [];

  function setStatus(next, info = null) {
    status = next;
    healthInfo = info;
    listeners.forEach(listener => listener(status, info));
  }

  async function rawRequest(path, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${serviceUrl}${path}`, { signal: controller.signal, ...options });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function checkHealth() {
    try {
      const info = await rawRequest("/v1/health", {}, 3000);
      setStatus("online", info);
    } catch {
      setStatus("offline", null);
    }
    return { status, info: healthInfo };
  }

  async function post(path, payload, timeoutMs = 25000) {
    try {
      const result = await rawRequest(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }, timeoutMs);
      if (status !== "online") await checkHealth();
      return { ...result, _fallback: false };
    } catch {
      if (status !== "offline") setStatus("offline", null);
      return { ...localFor(path, payload), _fallback: true };
    }
  }

  // ------------------------------------------------------------------
  // Local fallbacks — mirror of the adapter's offline generators.
  // ------------------------------------------------------------------

  function hashOf(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  // Keyword-driven set kits so the offline generator reflects the prompt
  // (a harbor gets water, piers and boats; a forest gets trees) instead of
  // random masses. Output stays inside the scene schema: cube / sphere /
  // cylinder / cone primitives, Unreal units (cm), z-up, pivot at center.
  function themedSetKit(lower, seed, night) {
    const out = [];
    let n = 0;
    const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0; return seed / 4294967296; };
    const add = (label, primitive, x, y, w, d, h, color, extra = {}) => out.push({
      id: `kit_${n++}`, label, primitive,
      location: { x: Math.round(x), y: Math.round(y), z: Math.round(extra.z ?? h * 50) },
      rotation: { pitch: 0, yaw: Math.round(extra.yaw ?? 0), roll: 0 },
      scale: { x: +w.toFixed(2), y: +d.toFixed(2), z: +h.toFixed(2) },
      color, cast_shadow: true, asset_hint: label.toLowerCase()
    });
    const lamp = (x, y) => {
      add("Street lamp pole", "cylinder", x, y, 0.15, 0.15, 4.5, "#2A2E33");
      add("Lamp glow", "sphere", x, y, 0.6, 0.6, 0.6, night ? "#FFD27A" : "#E8E2C8", { z: 470 });
    };
    const tree = (x, y, s = 1) => {
      add("Tree trunk", "cylinder", x, y, 0.4 * s, 0.4 * s, 3 * s, "#4A3524");
      add("Tree canopy", rand() < 0.5 ? "cone" : "sphere", x, y, 2.6 * s, 2.6 * s, 3 * s, night ? "#1C3322" : "#2F6B3A", { z: 420 * s });
    };
    let matched = false;

    if (/harbor|harbour|dock|pier|port|sea|ocean|beach|lake|river|boat|ship/.test(lower)) {
      matched = true;
      out.heroLabel = "Moored boat";
      add("Open water", "cube", 0, 1300, 30, 16, 0.2, night ? "#0B1B2E" : "#24587A", { z: 5 });
      add("Wooden pier", "cube", -300, 700, 3, 16, 0.4, "#6B4E31", { z: 40 });
      for (let i = 0; i < 6; i++) add("Pier post", "cylinder", -420 + (i % 2) * 240, 100 + Math.floor(i / 2) * 500, 0.3, 0.3, 1.4, "#3E2C1C");
      add("Fishing boat hull", "cube", 400, 1100, 6, 2.4, 1.4, "#8C2F28", { yaw: 20 });
      add("Boat cabin", "cube", 380, 1090, 2, 1.8, 1.6, "#E8E2D0", { yaw: 20, z: 220 });
      add("Boat mast", "cylinder", 460, 1120, 0.15, 0.15, 7, "#D8D2C0", { z: 420 });
      for (let i = 0; i < 5; i++) add("Cargo crate", "cube", -900 + rand() * 500, -200 + rand() * 500, 1.2, 1.2, 1.2, ["#A0522D", "#546E7A", "#8D6E63"][i % 3], { yaw: rand() * 90 });
      add("Harbor warehouse", "cube", -1300, -700, 10, 7, 6, "#5C5F66");
      lamp(-150, 0); lamp(200, -300);
    }
    if (/city|street|avenue|alley|downtown|neon|urban|road|traffic/.test(lower)) {
      matched = true;
      out.heroLabel = out.heroLabel || "Parked car";
      add("Asphalt street", "cube", 0, 0, 40, 9, 0.1, "#22252A", { z: 2 });
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const h = 4 + rand() * 7;
        add("Building", "cube", -1500 + Math.floor(i / 2) * 900, side * 1100, 7, 6, h, ["#3B3F47", "#4A4038", "#2E3A45", "#50505A"][i % 4]);
        if (/neon/.test(lower) || night) add("Neon sign", "cube", -1500 + Math.floor(i / 2) * 900, side * 780, 2.4, 0.2, 0.8, ["#FF2E88", "#28E0FF", "#B8FF3C"][i % 3], { z: 420 });
      }
      add("Parked car body", "cube", 250, 250, 4.4, 1.9, 1.1, "#9A2323");
      add("Parked car roof", "cube", 230, 250, 2.4, 1.7, 0.7, "#7A1C1C", { z: 145 });
      lamp(-600, 480); lamp(600, 480); lamp(0, -480);
    }
    if (/\b(forest|woods?|woodland|jungle|park|garden|trees?|grove)\b/.test(lower)) {
      matched = true;
      out.heroLabel = out.heroLabel || "Fallen log";
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2, r = 700 + rand() * 1500;
        tree(Math.cos(a) * r, Math.sin(a) * r, 0.8 + rand() * 0.8);
      }
      add("Fallen log", "cylinder", 300, 200, 0.7, 0.7, 5, "#5A4030", { yaw: 30, z: 35 });
      for (let i = 0; i < 4; i++) add("Mossy rock", "sphere", -300 + rand() * 900, -400 + rand() * 800, 1 + rand(), 1 + rand(), 0.8, "#55605A");
    }
    if (/desert|dune|sand|canyon|mesa|wasteland/.test(lower)) {
      matched = true;
      out.heroLabel = out.heroLabel || "Abandoned truck";
      for (let i = 0; i < 7; i++) add("Sand dune", "sphere", -2000 + i * 650, 900 + rand() * 900, 10, 6, 2.5, "#C9A46A", { z: 60 });
      for (let i = 0; i < 4; i++) add("Rock mesa", "cylinder", -1500 + rand() * 3000, -1400 - rand() * 400, 5, 5, 6 + rand() * 6, "#9A5B3A");
      add("Cactus", "cylinder", -400, 300, 0.5, 0.5, 3, "#4F7A3A");
      add("Truck body", "cube", 300, -100, 5, 2.2, 2, "#8A6F4E", { yaw: -25 });
    }
    if (/room|office|apartment|kitchen|bar|diner|house|interior|lab|library|bedroom|cafe/.test(lower)) {
      matched = true;
      out.heroLabel = out.heroLabel || "Central table";
      add("Back wall", "cube", 0, 900, 20, 0.3, 4, "#6B6258");
      add("Side wall", "cube", -1000, 0, 0.3, 18, 4, "#5E574F");
      add("Side wall", "cube", 1000, 0, 0.3, 18, 4, "#5E574F");
      add("Central table", "cube", 0, 100, 3, 1.6, 0.8, "#6A4A30");
      for (let i = 0; i < 4; i++) add("Chair", "cube", (i % 2 ? 1 : -1) * 230, 100 + (i < 2 ? -90 : 90), 0.6, 0.6, 1, "#3A2E26");
      add("Pendant lamp", "sphere", 0, 100, 0.8, 0.8, 0.5, "#FFE2A0", { z: 330 });
      add(/library/.test(lower) ? "Bookshelf" : /kitchen|diner|bar|cafe/.test(lower) ? "Counter" : "Cabinet", "cube", -600, 780, 4, 0.8, 2.4, "#4E3B2C");
      add("Window", "cube", 500, 880, 3, 0.2, 2, night ? "#1B2C55" : "#BFD8E8", { z: 220 });
    }
    if (/space|orbit|station|ship|alien|moon|mars|planet|sci-?fi/.test(lower) && !/boat/.test(lower)) {
      matched = true;
      out.heroLabel = out.heroLabel || "Landing craft";
      add("Landing pad", "cylinder", 0, 0, 14, 14, 0.2, "#3C4048", { z: 10 });
      add("Landing craft hull", "cone", 0, 0, 4, 4, 6, "#C8CCD4", { z: 320 });
      for (let i = 0; i < 3; i++) add("Landing strut", "cylinder", Math.cos(i * 2.1) * 260, Math.sin(i * 2.1) * 260, 0.2, 0.2, 1.8, "#6A6E76");
      add("Habitat dome", "sphere", -1200, 600, 9, 9, 5, "#8FA3B8");
      add("Antenna mast", "cylinder", 1100, -500, 0.2, 0.2, 10, "#9AA0A8");
      add("Planet on horizon", "sphere", 1500, 3200, 20, 20, 20, "#B8643A", { z: 2600 });
      for (let i = 0; i < 5; i++) add("Crater rim", "cylinder", -2000 + rand() * 4000, -1800 + rand() * 1200, 5, 5, 0.4, "#5A5A60");
    }
    if (/snow|winter|ice|frozen|arctic/.test(lower)) {
      matched = true;
      add("Snow field", "cube", 0, 0, 60, 50, 0.1, "#E6EEF4", { z: 3 });
      for (let i = 0; i < 8; i++) {
        const a = rand() * Math.PI * 2, r = 900 + rand() * 1200;
        add("Pine", "cone", Math.cos(a) * r, Math.sin(a) * r, 2.4, 2.4, 5, "#2E4A3A");
      }
      add("Snowdrift", "sphere", -400, 500, 4, 3, 1, "#F2F6FA", { z: 20 });
    }
    if (/rain|storm|wet|flood/.test(lower)) {
      matched = true;
      for (let i = 0; i < 5; i++) add("Puddle", "cylinder", -800 + rand() * 1600, -800 + rand() * 1600, 2 + rand() * 2, 1.5 + rand() * 2, 0.02, "#1E3040", { z: 3 });
    }
    if (/fire|burn|campfire|explosion/.test(lower)) {
      matched = true;
      add("Fire core", "cone", -250, -250, 1.2, 1.2, 1.8, "#FF7A1A");
      add("Fire glow", "sphere", -250, -250, 2, 2, 1, "#FFB347", { z: 60 });
    }
    return matched ? out : [];
  }

  function localFor(path, payload) {
    if (path === "/v1/scenes/generate") {
      // Offline set generator: mirrors the adapter's local generator so
      // "Prompt the world" always produces a real spec, even with no server.
      const prompt = String(payload.prompt ?? "");
      const lower = prompt.toLowerCase();
      const seed = hashOf(prompt);
      const night = /night|dark|midnight|rain/.test(lower);
      const pick = array => array[seed ? Math.abs(seed) % array.length : 0];

      const objects = [
        {
          id: "hero_floor", label: "Hero performance area", primitive: "cube",
          location: { x: 150, y: 0, z: 25 }, rotation: { pitch: 0, yaw: 0, roll: 0 },
          scale: { x: 16, y: 10, z: 0.5 },
          color: night ? "#141B22" : "#3C464E",
          cast_shadow: true,
          asset_hint: `original hero set piece for: ${prompt}`.slice(0, 300)
        },
        {
          id: "hero_subject", label: "Prompt hero subject",
          primitive: ["cube", "sphere", "cylinder", "cone"][seed % 4],
          location: { x: 120, y: 0, z: 180 }, rotation: { pitch: 0, yaw: 45, roll: 0 },
          scale: { x: 2.6, y: 2.6, z: 3.4 },
          color: `#${((seed & 0xffffff) | 0x303030).toString(16).padStart(6, "0")}`,
          cast_shadow: true,
          asset_hint: `hero subject matching: ${prompt}`.slice(0, 300)
        }
      ];
      const kitObjects = themedSetKit(lower, seed, night);
      if (kitObjects.length) {
        objects[1].label = kitObjects.heroLabel || objects[1].label;
        objects.push(...kitObjects);
      }
      const count = kitObjects.length ? 0 : 8 + (seed % 8);
      for (let index = 0; index < count; index += 1) {
        const elementSeed = hashOf(`${prompt}:${index}`);
        const angle = (elementSeed % 628) / 100;
        const radius = 500 + (elementSeed % 1800);
        const height = 80 + ((elementSeed >> 3) % 900);
        objects.push({
          id: `element_${index}`,
          label: pick(["Set dressing", "Architecture mass", "Atmosphere prop", "Background structure"]),
          primitive: ["cube", "sphere", "cylinder", "cone"][elementSeed % 4],
          location: {
            x: Math.round(Math.cos(angle) * radius),
            y: Math.round(Math.sin(angle) * radius),
            z: Math.round(height * 0.5)
          },
          rotation: { pitch: 0, yaw: elementSeed % 180, roll: 0 },
          scale: {
            x: Number((0.7 + (elementSeed % 30) / 10).toFixed(2)),
            y: Number((0.7 + ((elementSeed >> 5) % 30) / 10).toFixed(2)),
            z: Number((height / 100).toFixed(2))
          },
          color: `#${(((elementSeed >> 6) & 0xffffff) | 0x202020).toString(16).padStart(6, "0")}`,
          cast_shadow: index % 3 !== 0,
          asset_hint: `${prompt} set dressing element ${index}`.slice(0, 300)
        });
      }
      return {
        schema_version: "1.0",
        title: `Director Set: ${prompt.slice(0, 40)}`,
        summary: `Offline browser layout for: ${prompt.slice(0, 160)}`,
        environment: {
          ground_color: night ? "#0A0F14" : "#12181C",
          sky_light_color: night ? "#16294A" : "#7391AE",
          sky_light_intensity: night ? 0.35 : 0.85,
          sun_color: /sunset|dusk/.test(lower) ? "#FF4710" : night ? "#4269B8" : "#FFD2A6",
          sun_intensity: night ? 1.8 : 7,
          sun_rotation: { pitch: night ? -18 : -32, yaw: -40, roll: 0 },
          fog_density: /fog|mist/.test(lower) ? 0.04 : 0.01
        },
        camera: { location: { x: -1650, y: -1250, z: 600 }, rotation: { pitch: -12, yaw: 36, roll: 0 }, fov: 52 },
        objects,
        source: "browser-offline"
      };
    }

    if (path === "/v1/director/beat") {
      const prompt = String(payload.prompt ?? "");
      const lower = prompt.toLowerCase();
      const mood = /tense|danger|fear|chase/.test(lower)
        ? "Taut, held breath"
        : /funny|joke|absurd/.test(lower)
          ? "Warm, comic timing"
          : /quiet|grief|tender|home/.test(lower)
            ? "Hushed, intimate"
            : "Curious, forward-leaning";
      const shot = /close|face|eye/.test(lower)
        ? "Tight close-up, shallow depth"
        : /wide|landscape|crowd/.test(lower)
          ? "Slow lateral wide, letting scale breathe"
          : "Medium push-in on the decision point";
      return {
        setting: String(payload.context?.title ?? "Untitled"),
        mood,
        shot,
        action: [`The scene opens on ${prompt.slice(0, 80)}.`, "A secondary figure crosses frame, resetting the geography.", /reveal|discover/.test(lower) ? "The turn lands silently." : "The beat settles on a small gesture instead of a line."],
        quality_hint: Math.min(10, 4 + prompt.trim().split(/\s+/).length / 10),
        source: "local-browser"
      };
    }

    if (path === "/v1/npc/line") {
      const character = payload.character ?? {};
      const direction = String(payload.direction ?? "");
      const openings = [
        "\"Understood — but my way of doing that won't look like effort.\"",
        "\"Give me a second to find it... alright. Again, and watch the pause.\"",
        "\"You want it bigger or truer? Those aren't the same take.\"",
        "\"Fine. But if it goes quiet, don't cut.\""
      ];
      return {
        line: openings[hashOf(direction + String(character.name)) % openings.length],
        reaction: `${character.name ?? "The performer"} takes the note through the filter of being ${character.archetype ?? "a professional"} — ${character.trait ?? "composed"} — then gives you one clean rehearsal.`,
        source: "local-browser"
      };
    }

    if (path === "/v1/cast/suggest") {
      const names = ["Mara Voss", "Ilya Renner", "Dee Okafor", "Sunder Pahl"];
      const archetypes = [
        { archetype: "guarded professional", trait: "never lets them see effort", quirk: "counts props under her breath before takes" },
        { archetype: "restless comedian", trait: "improvises to break tension", quirk: "collects one object from every set" },
        { archetype: "quiet obsessive", trait: "knows everyone's backstory but never shares his own", quirk: "rewrites his lines' punctuation in the margin" },
        { archetype: "warm veteran", trait: "protects younger cast from bad days", quirk: "brings tea in a chipped thermos to every shoot" }
      ];
      const count = Math.min(3, Math.max(1, Number(payload.context?.count) || 3));
      const seed = hashOf(String(payload.context?.title ?? "") + Date.now());
      return {
        cast: Array.from({ length: count }, (_, index) => ({
          name: names[(seed + index) % names.length],
          role: index === 0 ? "Lead" : "Supporting",
          archetype: archetypes[(seed >> index) % archetypes.length].archetype,
          trait: archetypes[(seed >> index) % archetypes.length].trait,
          quirk: archetypes[(seed >> index) % archetypes.length].quirk,
          source: "local-browser"
        })),
        source: "local-browser"
      };
    }

    return { error: "unsupported endpoint", source: "none" };
  }

  return {
    get status() { return status; },
    get healthInfo() { return healthInfo; },
    getServiceUrl: () => serviceUrl,
    setServiceUrl(next) {
      serviceUrl = String(next || DEFAULT_URL).replace(/\/+$/, "");
      try { localStorage.setItem(URL_KEY, serviceUrl); } catch { /* ignore */ }
      return checkHealth();
    },
    onStatusChange(listener) {
      listeners.push(listener);
      listener(status, healthInfo);
    },
    checkHealth,
    generateScene: prompt => post("/v1/scenes/generate", { prompt }),
    directBeat: (prompt, context) => post("/v1/director/beat", { prompt, context }),
    npcLine: (character, direction, history = []) => post("/v1/npc/line", { character, direction, history }),
    suggestCast: context => post("/v1/cast/suggest", { context }),
    // Queue a set build for the Unreal client: it polls /v1/jobs/next and
    // constructs whatever this returns a spec for.
    requestUnrealBuild: async (prompt, filmId = "", castCount = 2) => {
      try {
        const result = await rawRequest("/v1/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, film_id: filmId, cast_count: castCount })
        }, 45000);
        return { ...result, _fallback: false };
      } catch {
        return { queued: false, _fallback: true };
      }
    },
    // Rendered stills shot by the Unreal client for a released film.
    shotManifest: async filmId => {
      try {
        return await rawRequest(`/v1/films/${encodeURIComponent(filmId)}/manifest`, {}, 4000);
      } catch {
        return { count: 0, indexes: [] };
      }
    },
    shotUrl: (filmId, index) => `${serviceUrl}/v1/films/${encodeURIComponent(filmId)}/shots/${index}.png`,
    videoUrl: filmId => `${serviceUrl}/v1/films/${encodeURIComponent(filmId)}/video.mp4`,
    // Shared world (multiplayer-lite): publish releases, browse everyone's,
    // push ratings back to the source player's film.
    publishWorldFilm: async film => {
      try {
        await rawRequest("/v1/world/films", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(film)
        }, 8000);
        return { published: true };
      } catch {
        return { published: false };
      }
    },
    fetchWorldFilms: async () => {
      try {
        return await rawRequest("/v1/world/films", {}, 5000);
      } catch {
        return { films: [] };
      }
    },
    rateWorldFilm: async (filmId, rating) => {
      try {
        return await rawRequest("/v1/world/ratings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ film_id: filmId, rating })
        }, 5000);
      } catch {
        return { ok: false };
      }
    }
  };
})();

window.TakeOneAI = TakeOneAI;
