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
      const count = 8 + (seed % 8);
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
