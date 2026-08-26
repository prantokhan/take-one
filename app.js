// Take One — the entire browser game.
//
// Plain script (no modules, no bundler): everything here is a top-level
// global function or const, loaded by index.html after ai-client.js. The
// whole game is one mutable `state` object (see createDefaultState()/
// loadState() below) rendered into #app-view / #dialog-content as HTML
// template strings. See CLAUDE.md for the full file map and CONTEXT.md for
// the game's design background.

const STORAGE_KEY = "take-one-production-house-v1";

// Genre → key-art image shown on film cards/dialogs.
const images = {
  "Sci-Fi": "assets/glass-river.png",
  Mystery: "assets/asterion-signal.png",
  "Comedy-Drama": "assets/sunday-in-orbit.png"
};

const gigs = [
  {
    id: "actor-glass",
    role: "Actor",
    symbol: "ACT",
    accent: "#ff7165",
    title: "Reaction pickup",
    project: "Glass River",
    description: "One scene, three emotional turns",
    fee: 140,
    rep: 8,
    requirement: 0,
    difficulty: "Entry",
    brief: "Mara has just realized the rescue beacon is coming from beneath the water. Play discovery, not fear. The camera is already moving toward you.",
    questions: [
      {
        prompt: "Where does the realization land?",
        options: [
          ["On the beacon", "Keep the eyeline low and let the thought arrive."],
          ["At the drone", "Ask the machine for silent confirmation."],
          ["Toward camera", "Share the discovery directly with the audience."]
        ],
        answer: 0
      },
      {
        prompt: "How large is the performance?",
        options: [
          ["Hold it in", "A breath catches; the body stays quiet."],
          ["Step backward", "Make the danger physically immediate."],
          ["Call for help", "Turn the beat into an urgent warning."]
        ],
        answer: 0
      },
      {
        prompt: "When do you speak?",
        options: [
          ["Over the move", "Let the line pull the camera forward."],
          ["After the camera settles", "Protect the words with stillness."],
          ["Do not speak", "Give the editor a silent alternative."]
        ],
        answer: 0
      }
    ]
  },
  {
    id: "crew-asterion",
    role: "Set Crew",
    symbol: "SET",
    accent: "#f3ad52",
    title: "Signal camp dressing",
    project: "Asterion Signal",
    description: "Dress the discovery site before dusk",
    fee: 165,
    rep: 10,
    requirement: 0,
    difficulty: "Skilled",
    brief: "The camp has been running for nine sleepless days. The director wants exhaustion and obsession, but the signal rig must remain the first read in frame.",
    questions: [
      {
        prompt: "What anchors the foreground?",
        options: [
          ["Signal rig", "Red lamp, patched cable, handwritten frequency dial."],
          ["Supply cases", "Build a practical wall of expedition gear."],
          ["Weather station", "Lead with the incoming storm data."]
        ],
        answer: 0
      },
      {
        prompt: "How do you show nine days of work?",
        options: [
          ["Layered traces", "Old cups, shifted stones, fresh tape over worn labels."],
          ["Heavy damage", "Break equipment and cover everything in dust."],
          ["Keep it clean", "Let the performance carry the history."]
        ],
        answer: 0
      },
      {
        prompt: "Which practical light survives dusk?",
        options: [
          ["Single red lamp", "Preserve night vision and isolate the rig."],
          ["White work floods", "Keep every prop clearly readable."],
          ["String lights", "Add a warm human counterpoint."]
        ],
        answer: 0
      }
    ]
  },
  {
    id: "writer-sunday",
    role: "Writer",
    symbol: "WRT",
    accent: "#87a9ff",
    title: "Dinner scene polish",
    project: "Sunday in Orbit",
    description: "Sharpen a two-page character scene",
    fee: 190,
    rep: 11,
    requirement: 0,
    difficulty: "Skilled",
    brief: "Two maintenance workers are eating the first salad grown on station. It should be funny because they refuse to admit how much the moment means.",
    questions: [
      {
        prompt: "What starts the scene?",
        options: [
          ["A bad first bite", "One leaf is far more bitter than expected."],
          ["A station alarm", "Interrupt the meal with immediate danger."],
          ["A long speech", "Explain the greenhouse program's history."]
        ],
        answer: 0
      },
      {
        prompt: "Where is the emotion hidden?",
        options: [
          ["In the recipe", "They argue about dressing instead of naming home."],
          ["In a confession", "One worker openly describes missing Earth."],
          ["In the window", "Both stare silently at the planet."]
        ],
        answer: 0
      },
      {
        prompt: "How does the scene turn?",
        options: [
          ["They save a leaf", "A tiny practical gesture admits the achievement."],
          ["The crop fails", "Convert the scene into a setback."],
          ["A visitor arrives", "Add a third voice to lift the pace."]
        ],
        answer: 0
      }
    ]
  },
  {
    id: "drone-glass",
    role: "Drone Op",
    symbol: "DRN",
    accent: "#48c5ad",
    title: "Floodway pursuit",
    project: "Glass River",
    description: "Design the chase establishing shot",
    fee: 230,
    rep: 12,
    requirement: 52,
    difficulty: "Specialist",
    brief: "Follow the skiff through a narrow flooded avenue. The shot must reveal the blocked bridge without losing the performer against the city scale.",
    questions: [
      {
        prompt: "Choose the flight line.",
        options: [
          ["Low parallel", "Track just above water and arc toward the bridge."],
          ["High overhead", "Map the whole route in one clean plan view."],
          ["Lead backward", "Face the performer while retreating at speed."]
        ],
        answer: 0
      },
      {
        prompt: "Where is the reveal?",
        options: [
          ["After the second lamp", "Use a building edge to wipe on the bridge."],
          ["At frame one", "Establish the obstacle immediately."],
          ["At the final cut", "Hide the geography until the last beat."]
        ],
        answer: 0
      },
      {
        prompt: "How do you hold the performer?",
        options: [
          ["Lower third", "Let the architecture dominate without losing scale."],
          ["Dead center", "Lock tracking and minimize visual drift."],
          ["Edge of frame", "Make the pursuit feel unstable and dangerous."]
        ],
        answer: 0
      }
    ]
  },
  {
    id: "camera-asterion",
    role: "Videographer",
    symbol: "CAM",
    accent: "#d7f65a",
    title: "Dish array master",
    project: "Asterion Signal",
    description: "Frame the signal discovery sequence",
    fee: 250,
    rep: 13,
    requirement: 58,
    difficulty: "Specialist",
    brief: "The landscape should dwarf the scientist, but the red receiver lamp needs to register before the storm swallows the sun.",
    questions: [
      {
        prompt: "Choose a lens strategy.",
        options: [
          ["Wide and close", "Hold the scientist low while dishes tower behind."],
          ["Long compression", "Stack the dishes and flatten the desert."],
          ["Portrait prime", "Isolate the scientist from the array."]
        ],
        answer: 0
      },
      {
        prompt: "How does the frame move?",
        options: [
          ["Slow lateral creep", "Let each dish reveal the next."],
          ["Locked tripod", "Use only performance and weather."],
          ["Fast push-in", "Announce the signal as a thriller beat."]
        ],
        answer: 0
      },
      {
        prompt: "Where do you cut?",
        options: [
          ["On the red pulse", "Give the editor a precise visual hinge."],
          ["Before the pulse", "Build anticipation into the next angle."],
          ["After the reaction", "Play the discovery entirely in the master."]
        ],
        answer: 0
      }
    ]
  },
  {
    id: "vfx-orbit",
    role: "VFX Artist",
    symbol: "VFX",
    accent: "#bf8bff",
    title: "Orbital window composite",
    project: "Sunday in Orbit",
    description: "Finish the Earth view and greenhouse glass",
    fee: 300,
    rep: 15,
    requirement: 72,
    difficulty: "Advanced",
    brief: "The window is emotional punctuation, not spectacle. Preserve the warm practical reflections and keep Earth slightly soft behind the performers.",
    questions: [
      {
        prompt: "How sharp is Earth?",
        options: [
          ["Just below focus", "Keep attention on the workers at the table."],
          ["Tack sharp", "Sell the orbital scale with maximum detail."],
          ["Abstract blur", "Reduce the planet to cool color and shape."]
        ],
        answer: 0
      },
      {
        prompt: "What happens to reflections?",
        options: [
          ["Preserve and shape", "Roto only what blocks faces and eyelines."],
          ["Remove all", "Create a perfectly clean view through glass."],
          ["Double them", "Make the greenhouse feel denser and warmer."]
        ],
        answer: 0
      },
      {
        prompt: "How visible is the station drift?",
        options: [
          ["Barely perceptible", "A slow horizon roll rewards close viewing."],
          ["Static plate", "Keep the final completely stable."],
          ["Fast orbit", "Use movement to lift the scene's energy."]
        ],
        answer: 0
      }
    ]
  }
];

const baseFilms = [
  {
    id: "glass-river",
    title: "Glass River",
    genre: "Sci-Fi",
    image: images["Sci-Fi"],
    score: 91,
    views: 184000,
    length: "18 min",
    creator: "Northlight Unit",
    logline: "A courier follows an impossible rescue beacon through a drowned city.",
    status: "Trending"
  },
  {
    id: "asterion-signal",
    title: "Asterion Signal",
    genre: "Mystery",
    image: images.Mystery,
    score: 87,
    views: 119000,
    length: "24 min",
    creator: "Far Field House",
    logline: "Nine days into a silent survey, a field scientist hears her own signal answer back.",
    status: "Staff pick"
  },
  {
    id: "sunday-orbit",
    title: "Sunday in Orbit",
    genre: "Comedy-Drama",
    image: images["Comedy-Drama"],
    score: 94,
    views: 263000,
    length: "16 min",
    creator: "Soft Landing Co.",
    logline: "Two maintenance workers disagree about the first home-grown salad in orbit.",
    status: "Top rated"
  }
];

const assets = [
  { name: "Flooded avenue kit", type: "Environment", owner: "Northlight Unit", uses: 14, royalty: 12 },
  { name: "Radio dish array", type: "Set", owner: "Far Field House", uses: 8, royalty: 18 },
  { name: "Orbital greenhouse ring", type: "Environment", owner: "Soft Landing Co.", uses: 21, royalty: 15 },
  { name: "Weathered signal rig", type: "Hero prop", owner: "M. Okafor", uses: 6, royalty: 9 },
  { name: "Rain-skiff flight rig", type: "Vehicle", owner: "Basin Works", uses: 11, royalty: 16 }
];

const assetWorkByGig = {
  "crew-asterion": { name: "Asterion signal camp", type: "Set package" },
  "vfx-orbit": { name: "Orbital window composite", type: "VFX plate" }
};

// Completed writer gigs at usable quality feed the director's script library.
const scriptWorkByGig = {
  "writer-sunday": { title: "What We Grew", pages: 16, genre: "Comedy-Drama" }
};

// Open productions a tier-4 Producer can fund. Odds/yields are fixed per project.
const openInvestments = [
  { id: "inv-relay", title: "The Last Relay", creator: "Northlight Unit", genre: "Sci-Fi", stake: 260, odds: 0.62, cycles: 3, yieldPerCycle: 120 },
  { id: "inv-receiver", title: "Receiver Nine", creator: "Far Field House", genre: "Mystery", stake: 340, odds: 0.5, cycles: 4, yieldPerCycle: 170 },
  { id: "inv-greens", title: "Greenhouse Rules", creator: "Soft Landing Co.", genre: "Comedy-Drama", stake: 180, odds: 0.74, cycles: 2, yieldPerCycle: 105 }
];

// Section 8, question 5: genres inherently demand certain specialists.
const genreCrewDemand = {
  "Sci-Fi": ["Drone Op", "VFX Artist"],
  Mystery: ["Drone Op"],
  "Comedy-Drama": ["Videographer"]
};

const crewRates = [
  { role: "Drone Op", cost: 130 },
  { role: "Videographer", cost: 110 },
  { role: "VFX Artist", cost: 160 }
];

const roleGigSource = {
  "Drone Op": "drone-glass",
  Videographer: "camera-asterion",
  "VFX Artist": "vfx-orbit"
};

// The 4-stage Greenlight creative pipeline (Pre-production → Principal
// photography → Post-production → Distribution). openProductionStage()
// walks the player through these in order; each choice's `effect` (a rough
// 3-8 quality contribution) accumulates into the production's final score,
// and `fits` lists which genres get a bonus for that choice — see
// openProductionStage() for how `effect`/`fits` are actually combined.
const productionStages = [
  {
    name: "Pre-production",
    short: "Prep",
    prompt: "Choose the idea the whole production will organize around.",
    brief: "A strong signature gives every department a shared target. A weak one creates expensive noise.",
    options: [
      { title: "One practical landmark", detail: "Build a tactile centerpiece and let the world extend around it.", effect: 8, fits: ["Sci-Fi", "Mystery"] },
      { title: "Performance first", detail: "Keep the footprint small and spend time on rehearsal.", effect: 7, fits: ["Comedy-Drama", "Mystery"] },
      { title: "Maximal world build", detail: "Fill every frame with new locations, props, and motion.", effect: 4, fits: ["Sci-Fi"] }
    ]
  },
  {
    name: "Principal photography",
    short: "Shoot",
    prompt: "Set the camera language for the production.",
    brief: "The cast and crew need a repeatable visual rule, not a different trick for every scene.",
    options: [
      { title: "Patient wides", detail: "Let blocking and production design carry the cut.", effect: 7, fits: ["Mystery", "Comedy-Drama"] },
      { title: "Motivated movement", detail: "Move only when a character makes a decision.", effect: 8, fits: ["Sci-Fi", "Comedy-Drama"] },
      { title: "Restless coverage", detail: "Gather aggressive angles and find the rhythm in edit.", effect: 4, fits: ["Sci-Fi"] }
    ]
  },
  {
    name: "Post-production",
    short: "Post",
    prompt: "Decide how visible the generated finish should feel.",
    brief: "The AI can add almost anything. Restraint protects the choices already made on set.",
    options: [
      { title: "Invisible finish", detail: "Polish continuity, atmosphere, and small physical detail.", effect: 8, fits: ["Mystery", "Comedy-Drama"] },
      { title: "One impossible shot", detail: "Concentrate the VFX budget on a single memorable beat.", effect: 8, fits: ["Sci-Fi", "Mystery"] },
      { title: "Transform every frame", detail: "Push color, effects, and environments to maximum intensity.", effect: 3, fits: ["Sci-Fi"] }
    ]
  },
  {
    name: "Distribution",
    short: "Release",
    prompt: "Choose how the audience first meets the film.",
    brief: "The release strategy shapes early ratings, watch completion, and the long tail of residuals.",
    options: [
      { title: "Live premiere", detail: "Bring cast and crew into one high-attention launch window.", effect: 8, fits: ["Sci-Fi", "Mystery"] },
      { title: "Quiet catalog drop", detail: "Let completion rate and word of mouth build steadily.", effect: 7, fits: ["Comedy-Drama"] },
      { title: "Wide push", detail: "Buy the largest opening audience before reviews settle.", effect: 4, fits: ["Sci-Fi"] }
    ]
  }
];

// ------------------------------------------------------------------
// State management
//
// The whole game lives in one mutable `state` object (see the module-level
// `let state = loadState()` below), persisted to localStorage after nearly
// every mutation via saveState(). There is no framework/store — callers
// just mutate `state` in place and call saveState() when done.
//
// If you add a new field to game state, add its default here so
// createDefaultState() stays the single source of truth for shape, and
// loadState()'s `{ ...createDefaultState(), ...stored }` merge will
// backfill it for existing players' saved state automatically. Only add
// bespoke migration logic (like syncPortfolioAssetDrafts() below) when a
// simple default merge isn't enough — e.g. deriving new fields from data
// the player already earned.
// ------------------------------------------------------------------

function createDefaultState() {
  return {
    credits: 460,
    reputation: 38,
    cycle: 7,
    completedGigs: [],
    production: null,
    releases: [],
    bestTakes: {},
    assetDrafts: [],
    ownedAssets: [],
    assetIncome: 0,
    watched: {},
    ratings: {},
    liveCycle: -1,
    scriptLibrary: [],
    usedScripts: [],
    investments: [],
    lastReleaseScore: 0,
    worldPrompts: [],
    promptCycle: -1,
    filmShots: {},
    filmVideos: {},
    playerName: "",
    worldFilms: [],
    activities: [
      { text: "You joined the World 01 crew pool.", time: "Now" },
      { text: "Glass River opened three public crew calls.", time: "08m" },
      { text: "Sunday in Orbit crossed 250K views.", time: "31m" }
    ]
  };
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Shallow-merge onto fresh defaults so any field added to
    // createDefaultState() since the player's last save is backfilled
    // automatically, without a dedicated migration step.
    return stored ? { ...createDefaultState(), ...stored } : createDefaultState();
  } catch (error) {
    // Corrupt/unparsable localStorage (or private-mode restrictions) —
    // fail safe into a fresh game rather than throwing on load.
    return createDefaultState();
  }
}

let state = loadState();
let currentView = "studio";
let catalogFilter = "All";
let activeShootCleanup = null;

const view = document.getElementById("app-view");
const dialog = document.getElementById("game-dialog");
const dialogContent = document.getElementById("dialog-content");

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Derives portfolio "asset drafts" (things the player can later publish/sell)
// from gigs they've already aced. A gig qualifies once its best recorded
// take (state.bestTakes[gigId]) scores 72+; this runs on every load so a
// past high score keeps producing a draft even though the qualifying score
// itself isn't re-earned. Idempotent — skips gigs that already produced an
// owned asset or a pending draft.
function syncPortfolioAssetDrafts() {
  Object.entries(assetWorkByGig).forEach(([gigId, assetWork]) => {
    const qualifies = (state.bestTakes[gigId] || 0) >= 72;
    const alreadyOwnsSource = state.ownedAssets.some(asset => asset.sourceGig === gigId);
    const alreadyHasDraft = state.assetDrafts.some(draft => draft.sourceGig === gigId);
    if (!qualifies || alreadyOwnsSource || alreadyHasDraft) return;
    const gig = gigs.find(item => item.id === gigId);
    state.assetDrafts.push({
      id: `draft-${gigId}`,
      sourceGig: gigId,
      name: assetWork.name,
      type: assetWork.type,
      role: gig.role,
      project: gig.project
    });
  });
}

syncPortfolioAssetDrafts();
saveState();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatViews(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRank() {
  if (state.reputation >= 90) return { name: "Producer", tier: "T4", next: null };
  if (state.reputation >= 60) return { name: "Director", tier: "T3", next: 90 };
  if (state.reputation >= 50) return { name: "Specialist", tier: "T2", next: 60 };
  return { name: "Crew Pool", tier: "T1", next: 50 };
}

function nextRankLabel(next) {
  return next === 90 ? "Producer" : next === 60 ? "Director" : "Specialist";
}

// Section 5 anti-spam: a recent flop makes crews hesitant, so gigs pay less
// until the director releases a film that scores 50 or better.
function hasFlopStigma() {
  return state.lastReleaseScore > 0 && state.lastReleaseScore < 50;
}

function availableGigCount() {
  return gigs.filter(gig => !state.completedGigs.includes(gig.id) && state.reputation >= gig.requirement).length;
}

function addActivity(text) {
  state.activities.unshift({ text, time: "Now" });
  state.activities = state.activities.slice(0, 8);
}

function toast(message) {
  const stack = document.getElementById("toast-stack");
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  stack.appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}

function setView(nextView) {
  currentView = nextView;
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
  view.focus({ preventScroll: true });
}

// ------------------------------------------------------------------
// View rendering.
//
// Each render* function below builds a full HTML string for one nav
// section and is called from the renderApp() dispatcher based on
// `currentView`. There is no diffing/virtual DOM — every call replaces the
// relevant container's innerHTML wholesale. Because listeners don't survive
// an innerHTML replacement, any new interactive element added to a
// template must also get a handler wired in bindViewEvents() (further
// below), which re-runs after every render.
// ------------------------------------------------------------------

function renderApp() {
  const rank = getRank();
  document.getElementById("credit-balance").textContent = formatNumber(state.credits);
  document.getElementById("rep-balance").textContent = state.reputation;
  document.getElementById("role-label").textContent = rank.name;
  document.getElementById("gig-count").textContent = availableGigCount();

  document.querySelectorAll("[data-view-target]").forEach(button => {
    button.classList.toggle("active", button.dataset.viewTarget === currentView);
  });

  const renderers = {
    studio: renderStudio,
    gigs: renderGigs,
    productions: renderProductions,
    catalog: renderCatalog,
    assets: renderAssets
  };
  view.innerHTML = renderers[currentView]();
  bindViewEvents();
}

function viewHeading(eyebrow, title, action = "") {
  return `
    <div class="view-heading">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
      </div>
      ${action}
    </div>`;
}

function renderStudio() {
  const rank = getRank();
  const repBase = rank.tier === "T4" ? 90 : rank.tier === "T3" ? 60 : rank.tier === "T2" ? 50 : 0;
  const repPercent = rank.next
    ? clamp(((state.reputation - repBase) / (rank.next - repBase)) * 100, 0, 100)
    : 100;
  const available = gigs.filter(gig => !state.completedGigs.includes(gig.id) && state.reputation >= gig.requirement).slice(0, 3);
  const liveFilm = baseFilms[state.cycle % baseFilms.length];
  const liveWatchers = 1800 + ((state.cycle * 731) % 1400);
  const productionButton = state.production
    ? `<button class="button primary" data-view-link="productions">Open your production <span aria-hidden="true">&#8594;</span></button>`
    : state.reputation >= 60
      ? `<button class="button primary" data-greenlight>Greenlight a film <span aria-hidden="true">+</span></button>`
      : `<button class="button" data-view-link="gigs">Build reputation <span aria-hidden="true">&#8594;</span></button>`;
  const greeting = rank.name === "Crew Pool" ? "Good evening, Rookie." : `Good evening, ${rank.name}.`;

  return `
    ${viewHeading(`Studio / Cycle ${String(state.cycle).padStart(2, "0")}`, greeting, `<button class="button primary" data-world-prompt><span aria-hidden="true">&#9673;</span> Prompt the world</button><button class="button" data-end-cycle title="Settle residuals, rentals, and investment returns">&#8635; End cycle</button>`)}
    <div class="studio-grid">
      <section class="live-stage" aria-label="Live production">
        <img src="${liveFilm.image}" alt="Live production still from ${escapeHTML(liveFilm.title)}">
        <div class="stage-overlay">
          <span class="live-flag">Live production</span>
          <div class="stage-copy">
            <p class="eyebrow">${escapeHTML(liveFilm.title)} / Unit A / Shot 44</p>
            <h2>${escapeHTML(liveFilm.logline)}</h2>
            <p>${escapeHTML(liveFilm.creator)} is blocking a moving master as the atmosphere rig reaches full output.</p>
            <div class="stage-meta"><span>${formatNumber(liveWatchers)} watching</span><span>Take 03</span><span>${liveFilm.genre} unit</span></div>
            <div class="stage-actions">
              <button class="button primary" data-live-watch><span aria-hidden="true">&#9654;</span> Watch live</button>
              <button class="button" data-gig-id="actor-glass">Join open call</button>
            </div>
          </div>
        </div>
      </section>

      <aside class="progress-panel">
        <div class="panel-topline"><p class="eyebrow">Your career</p><span class="status-tag ${state.reputation >= 60 ? "good" : "warn"}">${rank.name}</span></div>
        <div class="rank-emblem">${rank.tier}</div>
        <div class="rank-copy">
          <h2>${state.reputation >= 60 ? "Your slate is open." : "Earn the director's chair."}</h2>
          <p>${hasFlopStigma() ? "Your last release flopped. Crews are cautious: gig pay is reduced until you release a film that scores 50 or better." : state.reputation >= 60 ? "You have the reputation to lead a production. Your creative calls now carry financial risk." : "Strong takes build trust. Reach 60 reputation and hold 420 credits to fund your first production."}</p>
        </div>
        <div class="meter" aria-label="Next rank progress"><span style="width:${repPercent}%"></span></div>
        <div class="meter-labels"><span>${state.reputation} reputation</span><span>${rank.next ? `${nextRankLabel(rank.next)} ${rank.next}` : "Top tier reached"}</span></div>
        <div class="unlock-row">
          <div><span>Next move</span><strong>${state.production ? productionStageLabel() : state.reputation >= 60 ? "Fund your first film" : `${Math.max(0, 60 - state.reputation)} reputation to go`}</strong></div>
          ${productionButton}
        </div>
      </aside>
    </div>

    ${renderProducerDesk()}

    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Open calls</p><h2>Work waiting for a good decision</h2></div><button class="text-button" data-view-link="gigs">Full job board &#8594;</button></div>
      <div class="gig-list">
        ${available.length ? available.map(renderGigRow).join("") : `<div class="activity-item"><span class="activity-dot"></span><span>No open calls in your current tier. Refresh the board or move your production forward.</span><time>Clear</time></div>`}
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Activity</p><h2>The house keeps moving</h2></div></div>
      <div class="activity-list">${state.activities.slice(0, 4).map(item => `<div class="activity-item"><span class="activity-dot"></span><span>${escapeHTML(item.text)}</span><time>${item.time}</time></div>`).join("")}</div>
    </section>`;
}

function renderProducerDesk() {
  if (getRank().tier !== "T4") {
    return `
      <section class="section-block">
        <div class="section-heading"><div><p class="eyebrow">Producer desk / Locked</p><h2>Fund other people's films</h2></div><span class="status-tag locked">Rep 90 required</span></div>
        <div class="activity-item"><span class="activity-dot"></span><span>Producers bankroll outside productions and hold an ongoing revenue stake. Reach 90 reputation to unlock the desk.</span></div>
      </section>`;
  }

  const cards = openInvestments.map(opp => {
    const held = state.investments.find(inv => inv.id === opp.id);
    const affordable = state.credits >= opp.stake;
    const action = held
      ? `<button class="button compact" disabled>Stake held</button>`
      : `<button class="button compact primary" data-invest-id="${opp.id}" ${affordable ? "" : "disabled"}>Invest ${opp.stake} cr</button>`;
    return `
      <article class="gig-row">
        <div class="role-symbol" style="--accent:#f3ad52">INV</div>
        <div class="gig-main"><strong>${escapeHTML(opp.title)}</strong><span>${escapeHTML(opp.creator)} / ${opp.genre} / pays out over ${opp.cycles} cycles</span></div>
        <div class="gig-project">${Math.round(opp.odds * 100)}% hit odds</div>
        <div class="gig-detail"><strong>${opp.yieldPerCycle} cr<span>/cycle if it hits</span></strong></div>
        <span class="status-tag ${affordable || held ? "good" : "locked"}">${held ? "Active" : affordable ? "Open" : "Short"}</span>
        ${action}
      </article>`;
  }).join("");

  const active = state.investments.filter(inv => inv.cyclesLeft > 0);
  return `
    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Producer desk / Tier 4</p><h2>Bankroll the slate, own the upside</h2></div><span class="status-tag good">${active.length} active stake${active.length === 1 ? "" : "s"}</span></div>
      <div class="gig-list">${cards}</div>
      ${active.length ? `<div class="activity-item"><span class="activity-dot"></span><span>${active.map(inv => `${escapeHTML(inv.title)}: ${inv.cyclesLeft} cycle${inv.cyclesLeft === 1 ? "" : "s"} of payouts left`).join(" / ")}</span></div>` : ""}
    </section>`;
}

function investIn(opportunityId) {
  const opportunity = openInvestments.find(item => item.id === opportunityId);
  if (!opportunity) return;
  if (getRank().tier !== "T4") {
    toast("Producer tier unlocks at 90 reputation.");
    return;
  }
  if (state.investments.some(inv => inv.id === opportunityId)) {
    toast("You already hold a stake in this production.");
    return;
  }
  if (state.credits < opportunity.stake) {
    toast(`This stake needs ${opportunity.stake} credits.`);
    return;
  }

  state.credits -= opportunity.stake;
  state.investments.push({
    id: opportunity.id,
    title: opportunity.title,
    stake: opportunity.stake,
    yieldPerCycle: opportunity.yieldPerCycle,
    cyclesTotal: opportunity.cycles,
    cyclesLeft: opportunity.cycles,
    hit: Math.random() < opportunity.odds,
    earned: 0
  });
  addActivity(`You invested ${opportunity.stake} credits in ${opportunity.title}.`);
  saveState();
  renderApp();
  toast(`Stake placed in ${opportunity.title}. Returns settle at each end of cycle.`);
}

function renderGigRow(gig) {
  const complete = state.completedGigs.includes(gig.id);
  const locked = state.reputation < gig.requirement;
  let action = `<button class="button compact primary" data-gig-id="${gig.id}">Take gig</button>`;
  if (complete) action = `<button class="button compact" disabled>Wrapped</button>`;
  if (locked) action = `<button class="button compact" disabled>Rep ${gig.requirement}</button>`;

  return `
    <article class="gig-row">
      <div class="role-symbol" style="--accent:${gig.accent}">${gig.symbol}</div>
      <div class="gig-main"><strong>${gig.role} / ${gig.title}</strong><span>${gig.description}</span></div>
      <div class="gig-project">${gig.project}</div>
      <div class="gig-detail"><strong>${gig.fee} cr</strong><span>${complete ? `Best take ${state.bestTakes[gig.id] || "--"}` : `+${gig.rep} rep base`}</span></div>
      <span class="status-tag ${complete ? "good" : locked ? "locked" : "warn"}">${complete ? "Complete" : locked ? "Locked" : gig.difficulty}</span>
      ${action}
    </article>`;
}

function renderGigs() {
  const canRefresh = state.completedGigs.length > 0 && state.credits >= 40;
  return `
    ${viewHeading("Work / Public board", "Make your next call.", `<button class="button" data-refresh-board ${canRefresh ? "" : "disabled"}>&#8635; Refresh board / 40 cr</button>`)}
    <div class="gig-list">${gigs.map(renderGigRow).join("")}</div>

    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Career path</p><h2>Responsibility is the unlock</h2></div></div>
      <div class="role-path">
        <div class="role-tier ${state.reputation < 50 ? "current" : ""}"><span class="tier-num">TIER 00-01</span><h3>Actor / Writer / Set Crew</h3><p>Open entry. Build reliability through public gigs and reusable contributions.</p></div>
        <div class="role-tier ${state.reputation >= 50 && state.reputation < 60 ? "current" : ""}"><span class="tier-num">TIER 02 / REP 50</span><h3>Drone / Camera</h3><p>Specialist calls with higher pay, tighter briefs, and visible portfolio credit.</p></div>
        <div class="role-tier ${state.reputation >= 60 && state.reputation < 90 ? "current" : ""}"><span class="tier-num">TIER 03 / REP 60</span><h3>Director</h3><p>Fund a slate, make the creative calls, and own the audience result.</p></div>
        <div class="role-tier ${state.reputation >= 90 ? "current" : ""}"><span class="tier-num">TIER 04 / REP 90</span><h3>Producer</h3><p>Assemble deals, absorb financial risk, and hold the largest revenue stake.</p></div>
      </div>
    </section>`;
}

function productionStageLabel() {
  if (!state.production) return "No active production";
  if (state.production.released) return "Released to catalog";
  return productionStages[state.production.stage]?.name || "Production complete";
}

function renderProductions() {
  const canDirect = state.reputation >= 60 && state.credits >= 420;
  if (!state.production) {
    return `
      ${viewHeading("Slate / Your productions", "The next film starts with risk.")}
      <div class="production-layout">
        <section class="production-empty">
          <div>
            <div class="empty-symbol">+</div>
            <p class="eyebrow">Director tier</p>
            <h2>${state.reputation >= 60 ? "You have the room. Call the project." : "Your slate is still locked."}</h2>
            <p>${state.reputation >= 60 ? "Choose a script, commit a budget, and carry four creative decisions through release." : `Reach 60 reputation to direct. You are at ${state.reputation}.`}</p>
            <button class="button primary" data-greenlight ${canDirect ? "" : "disabled"}>Greenlight a film</button>
          </div>
        </section>
        ${renderSlatePanel()}
      </div>`;
  }

  const production = state.production;
  const image = images[production.genre];
  const currentStage = productionStages[production.stage];
  return `
    ${viewHeading("Slate / Active production", escapeHTML(production.title), production.released ? `<button class="button" data-new-project>Start next project</button>` : "")}
    <div class="production-layout">
      <section class="production-workspace">
        <div class="production-hero">
          <img src="${image}" alt="Concept still for ${escapeHTML(production.title)}">
          <div class="production-hero-copy"><span class="status-tag ${production.released ? "good" : "live"}">${production.released ? "Released" : productionStageLabel()}</span><h2>${escapeHTML(production.title)}</h2></div>
        </div>
        <div class="pipeline">
          ${productionStages.map((stage, index) => {
            const status = production.released || index < production.stage ? "done" : index === production.stage ? "current" : "";
            return `<div class="pipeline-step ${status}"><span>${status === "done" ? "Complete" : status === "current" ? "On deck" : `Stage 0${index + 1}`}</span><strong>${stage.short}</strong></div>`;
          }).join("")}
        </div>
        <div class="workspace-actions">
          <div class="quality-readout"><div><span>Creative signal</span><strong>${production.quality}</strong></div><div><span>Decisions locked</span><strong>${production.decisions.length}/4</strong></div></div>
          ${production.released
            ? `<button class="button primary" data-view-link="catalog"><span aria-hidden="true">&#9654;</span> View in catalog</button>`
            : `<button class="button" data-direct-set><span aria-hidden="true">&#9673;</span> Direct the set</button>
               <button class="button primary" data-production-stage>${currentStage ? `Run ${currentStage.short.toLowerCase()}` : "Finish film"} <span aria-hidden="true">&#8594;</span></button>`}
        </div>
        ${!production.released ? `
        <div class="unreal-bridge">
          <div>
            <strong>Unreal stage</strong>
            <span>${production.sceneSpec
              ? `Key set ready: "${escapeHTML(production.sceneSpec.title || "generated")}" (${Array.isArray(production.sceneSpec.objects) ? production.sceneSpec.objects.length : 0} objects)`
              : "Generating key set\u2026"}${production.unrealJobId ? ` / queued as ${escapeHTML(production.unrealJobId)}` : ""}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="button compact" data-send-unreal><span aria-hidden="true">&#9654;</span> Build in Unreal</button>
            ${production.sceneSpec ? `<button class="button compact" data-export-spec>Export .json</button>` : ""}
          </div>
        </div>` : ""}
      </section>
      ${renderSlatePanel()}
    </div>`;
}

function renderSlatePanel() {
  const production = state.production;
  const facts = production
    ? [
        ["Genre", production.genre],
        ["Committed budget", `${production.budget} cr`],
        ["Script", production.script || "House stock"],
        ["Specialist crew", production.hiredCrew && production.hiredCrew.length ? production.hiredCrew.map(member => member.role).join(", ") : "None hired"],
        ["Crew payroll", `${production.crewCost || 0} cr / 20% gross residuals`],
        ["Expected runtime", production.genre === "Mystery" ? "22 min" : "18 min"]
      ]
    : [
        ["Director gate", "60 reputation"],
        ["Minimum budget", "420 credits"],
        ["Production stages", "4 decisions"],
        ["Revenue", "Gross minus 20% crew residuals, per-cycle after"],
        ["Flops are real", "Below 50 score loses credits and reputation"],
        ["Catalog rights", "Original IP"]
      ];
  return `
    <aside class="slate-panel">
      <p class="eyebrow">${production ? "Production ledger" : "Greenlight terms"}</p>
      <h2>${production ? "The deal" : "What you are taking on"}</h2>
      <div style="margin-top:16px">${facts.map(fact => `<div class="slate-fact"><span>${fact[0]}</span><strong>${fact[1]}</strong></div>`).join("")}</div>
      ${!production ? `<button class="button" data-view-link="gigs">Earn through gigs</button>` : ""}
    </aside>`;
}

function allFilms() {
  const ownIds = new Set([...state.releases.map(film => film.id), ...baseFilms.map(film => film.id)]);
  const worldOnly = (state.worldFilms || [])
    .filter(film => !ownIds.has(film.id))
    .map(film => ({ ...film, external: true }));
  return [...state.releases, ...worldOnly, ...baseFilms];
}

async function loadWorldFilms() {
  if (TakeOneAI.status === "offline") return;
  const result = await TakeOneAI.fetchWorldFilms();
  if (Array.isArray(result.films)) {
    state.worldFilms = result.films;
    saveState();
    if (currentView === "catalog") renderApp();
  }
}

async function publishToWorld(production) {
  const result = await TakeOneAI.publishWorldFilm({
    id: production.id,
    title: production.title,
    genre: production.genre,
    score: production.score,
    views: production.views,
    length: production.genre === "Mystery" ? "22 min" : "18 min",
    creator: state.playerName || "Anonymous Director",
    released_cycle: state.cycle
  });
  if (result.published) addActivity(`${production.title} was published to the shared world catalog.`);
}

function renderCatalog() {
  const filters = ["All", "Sci-Fi", "Mystery", "Comedy-Drama"];
  const films = allFilms()
    .filter(film => catalogFilter === "All" || film.genre === catalogFilter)
    .sort((a, b) => b.score - a.score);
  state.releases.forEach(film => refreshFilmShots(film.id));
  const toolbar = `<div class="catalog-toolbar">${filters.map(filter => `<button class="filter-button ${filter === catalogFilter ? "active" : ""}" data-filter="${filter}">${filter}</button>`).join("")}</div>`;
  return `
    ${viewHeading("Watch / World catalog", "Films made by the house.", toolbar)}
    <div class="catalog-grid">
      ${films.map(film => `
        <article class="film-card" data-film-id="${film.id}" tabindex="0" role="button" aria-label="Watch ${escapeHTML(film.title)}">
          <div class="film-image"><img src="${filmImage(film)}" alt="Still from ${escapeHTML(film.title)}"><div class="film-score">${film.score}</div></div>
          <div class="film-copy"><h3>${escapeHTML(film.title)}</h3><div class="film-meta"><span>${film.genre} / ${film.length}${film.external ? ` / by ${escapeHTML(film.creator || "another director")}` : ""}</span><span>${formatViews(film.views)} views${film.external ? " / world" : ""}</span></div></div>
        </article>`).join("")}
    </div>

    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Revenue logic</p><h2>Attention flows back to the set</h2></div></div>
      <div class="role-path">
        <div class="role-tier"><span class="tier-num">01 / VIEW</span><h3>Audience watches</h3><p>Completion and ratings determine the production's revenue pool.</p></div>
        <div class="role-tier"><span class="tier-num">02 / OWNERSHIP</span><h3>Producer recoups</h3><p>The financial risk holder takes the largest initial share.</p></div>
        <div class="role-tier"><span class="tier-num">03 / RESIDUALS</span><h3>Cast and crew earn</h3><p>Every credited collaborator receives ongoing participation.</p></div>
        <div class="role-tier"><span class="tier-num">04 / LIBRARY</span><h3>Assets keep working</h3><p>Reusable sets and props pay their creators on future rentals.</p></div>
      </div>
    </section>`;
}

function renderAssets() {
  const drafts = state.assetDrafts || [];
  const owned = state.ownedAssets || [];
  const action = drafts.length
    ? `<button class="button primary" data-publish-asset>Publish asset / ${drafts.length} ready</button>`
    : `<button class="button" disabled>No drafts ready</button>`;
  return `
    ${viewHeading("Library / Reusable world", "Every good object has a second life.", action)}
    <div class="asset-list">
      ${assets.map(asset => `
        <div class="asset-row">
          <div><strong>${asset.name}</strong><span>${asset.type}</span></div>
          <div><strong>${asset.owner}</strong><span>Creator</span></div>
          <div class="asset-value">${asset.uses}<span>Uses</span></div>
          <div class="asset-value">${asset.royalty} cr<span>Rental</span></div>
          <span class="status-tag good">Available</span>
        </div>`).join("")}
    </div>

    <section class="section-block">
      <div class="section-heading"><div><p class="eyebrow">Your royalties</p><h2>Library income</h2></div></div>
      <div class="production-layout">
        ${owned.length ? `
          <div class="asset-list owned-assets">
            ${owned.map(asset => `<div class="asset-row"><div><strong>${escapeHTML(asset.name)}</strong><span>${asset.type}</span></div><div><strong>You</strong><span>Creator</span></div><div class="asset-value">${asset.uses}<span>Uses</span></div><div class="asset-value">${asset.royalty} cr<span>Royalty</span></div><span class="status-tag good">Published</span></div>`).join("")}
          </div>` : `
          <div class="production-empty" style="min-height:240px"><div><div class="empty-symbol">0</div><h3>No published assets yet</h3><p>Score 72 or higher on Set Crew or VFX work to create a publishable asset draft.</p><button class="button" data-view-link="gigs">Find asset work</button></div></div>`}
        <aside class="slate-panel" style="min-height:240px"><p class="eyebrow">Your library</p><h2>Residual ledger</h2><div class="slate-fact"><span>Published assets</span><strong>${owned.length}</strong></div><div class="slate-fact"><span>Drafts ready</span><strong>${drafts.length}</strong></div><div class="slate-fact"><span>Lifetime royalties</span><strong>${state.assetIncome || 0} cr</strong></div><div class="slate-fact"><span>Total rentals</span><strong>${owned.reduce((sum, asset) => sum + asset.uses, 0)}</strong></div></aside>
      </div>
    </section>`;
}

function openPublishAsset() {
  const drafts = state.assetDrafts || [];
  if (!drafts.length) return;
  const draft = drafts[0];
  openDialog(`
    <form id="publish-asset-form" autocomplete="off">
      <div class="dialog-header"><div><p class="eyebrow">Asset workshop / ${draft.project}</p><h2 id="dialog-title">Publish reusable work</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="brief-box"><strong>Portfolio draft</strong><p>Your ${draft.role} take isolated reusable ${draft.type.toLowerCase()} work. Publishing lets other productions rent it while ownership stays with you.</p></div>
        <div class="form-field"><label for="asset-name">Asset name</label><input id="asset-name" name="name" maxlength="38" value="${escapeHTML(draft.name)}" required></div>
        <div class="form-field"><span class="form-legend">License strategy</span>
          <div class="segmented">
            <label class="segment"><input type="radio" name="royalty" value="8"><strong>Open / 8 cr</strong><span>Frequent rentals</span></label>
            <label class="segment"><input type="radio" name="royalty" value="14" checked><strong>Studio / 14 cr</strong><span>Balanced demand</span></label>
            <label class="segment"><input type="radio" name="royalty" value="22"><strong>Premium / 22 cr</strong><span>Fewer, larger fees</span></label>
          </div>
        </div>
      </div>
      <div class="dialog-footer"><span class="text-small subdued">Original asset / creator ownership retained</span><button class="button primary" type="submit">Publish to library</button></div>
    </form>`);

  document.getElementById("publish-asset-form").addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    if (!name) return;
    state.ownedAssets.push({
      id: `asset-${Date.now()}`,
      name,
      type: draft.type,
      uses: 0,
      royalty: Number(data.get("royalty")),
      sourceGig: draft.sourceGig
    });
    state.assetDrafts = drafts.filter(item => item.id !== draft.id);
    addActivity(`${name} was published to the shared asset library.`);
    saveState();
    dialog.close();
    renderApp();
    toast(`${name} is now available for rental.`);
  });
}

function bindViewEvents() {
  view.querySelectorAll("[data-view-link]").forEach(button => button.addEventListener("click", () => setView(button.dataset.viewLink)));
  view.querySelectorAll("[data-gig-id]").forEach(button => button.addEventListener("click", () => openGig(button.dataset.gigId)));
  view.querySelectorAll("[data-greenlight]").forEach(button => button.addEventListener("click", openGreenlight));
  view.querySelectorAll("[data-live-watch]").forEach(button => button.addEventListener("click", openLiveSet));
  view.querySelectorAll("[data-production-stage]").forEach(button => button.addEventListener("click", openProductionStage));
  view.querySelectorAll("[data-direct-set]").forEach(button => button.addEventListener("click", () => openDirectSet(0)));
  view.querySelectorAll("[data-send-unreal]").forEach(button => button.addEventListener("click", () => sendProductionToUnreal(state.production)));
  view.querySelectorAll("[data-export-spec]").forEach(button => button.addEventListener("click", () => exportSceneSpec(state.production)));
  view.querySelectorAll("[data-publish-asset]").forEach(button => button.addEventListener("click", openPublishAsset));
  view.querySelectorAll("[data-end-cycle]").forEach(button => button.addEventListener("click", advanceCycle));
  view.querySelectorAll("[data-world-prompt]").forEach(button => button.addEventListener("click", openWorldPrompt));
  view.querySelectorAll("[data-invest-id]").forEach(button => button.addEventListener("click", () => investIn(button.dataset.investId)));
  view.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { catalogFilter = button.dataset.filter; renderApp(); }));
  view.querySelectorAll("[data-film-id]").forEach(card => {
    card.addEventListener("click", () => openFilm(card.dataset.filmId));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openFilm(card.dataset.filmId);
      }
    });
  });

  const refresh = view.querySelector("[data-refresh-board]");
  if (refresh) refresh.addEventListener("click", refreshBoard);

  const nextProject = view.querySelector("[data-new-project]");
  if (nextProject) nextProject.addEventListener("click", () => {
    state.production = null;
    saveState();
    renderApp();
    openGreenlight();
  });
}

function openDialog(markup) {
  stopMotionPlayback();
  if (activeShootCleanup) {
    activeShootCleanup();
    activeShootCleanup = null;
  }
  dialogContent.innerHTML = markup;
  dialogContent.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
  if (!dialog.open) dialog.showModal();
}

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("close", () => {
  stopMotionPlayback();
  if (activeShootCleanup) {
    activeShootCleanup();
    activeShootCleanup = null;
  }
});

// ------------------------------------------------------------------
// Gig flow: opening a gig, running the timing minigame, and scoring it.
//
// Three-step pipeline, each function handing off to the next:
//   openGig()             — brief + multiple-choice creative quiz (modal form)
//   startShootChallenge() — a timing minigame: hit a moving playhead inside a
//                           target zone, once per "cue", three cues per gig
//   completeGig()         — combines quiz correctness + timing accuracy into
//                           a single 0–100 score and applies rewards
// ------------------------------------------------------------------

function openGig(gigId) {
  const gig = gigs.find(item => item.id === gigId);
  if (!gig || state.completedGigs.includes(gigId)) return;
  if (state.reputation < gig.requirement) {
    toast(`Reach ${gig.requirement} reputation to take this call.`);
    return;
  }

  openDialog(`
    <form id="gig-form" autocomplete="off">
      <div class="dialog-header"><div><p class="eyebrow">${gig.project} / ${gig.role}</p><h2 id="dialog-title">${gig.title}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="brief-box"><strong>Director's brief</strong><p>${gig.brief}</p></div>
        ${gig.questions.map((question, questionIndex) => `
          <div class="question-block">
            <strong>${questionIndex + 1}. ${question.prompt}</strong>
            <div class="option-grid">
              ${question.options.map((option, optionIndex) => `
                <label class="option-card"><input type="radio" name="q${questionIndex}" value="${optionIndex}"><strong>${option[0]}</strong><span>${option[1]}</span></label>`).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="dialog-footer"><span class="text-small subdued">Base contract: ${gig.fee} cr / +${gig.rep} rep</span><button class="button primary" id="lock-take" type="submit" disabled>Lock the take</button></div>
    </form>`);

  const form = document.getElementById("gig-form");
  const submit = document.getElementById("lock-take");
  form.addEventListener("change", () => {
    submit.disabled = gig.questions.some((question, index) => !form.querySelector(`input[name="q${index}"]:checked`));
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const answers = gig.questions.map((question, index) => Number(new FormData(form).get(`q${index}`)));
    startShootChallenge(gig, answers);
  });
}

function shootCuesForRole(role) {
  const cueSets = {
    Actor: ["Find the eyeline", "Catch the turn", "Land the line"],
    "Set Crew": ["Practical on", "Clear the frame", "Trigger atmosphere"],
    Writer: ["Set the rhythm", "Hold the pause", "Turn the scene"],
    "Drone Op": ["Clear the wall", "Reveal the bridge", "Exit the move"],
    Videographer: ["Start the creep", "Cross the axis", "Cut on pulse"],
    "VFX Artist": ["Track the plate", "Hold the reflection", "Match the drift"]
  };
  return cueSets[role] || ["Mark one", "Mark two", "Mark three"];
}

function shootTargetsForRole(role) {
  const targets = {
    Actor: [24, 57, 84],
    "Set Crew": [31, 63, 88],
    Writer: [19, 52, 78],
    "Drone Op": [28, 68, 91],
    Videographer: [22, 61, 86],
    "VFX Artist": [34, 66, 89]
  };
  return targets[role] || [25, 60, 85];
}

function startShootChallenge(gig, answers) {
  const cues = shootCuesForRole(gig.role);
  const targets = shootTargetsForRole(gig.role);
  const film = baseFilms.find(item => item.title === gig.project) || baseFilms[0];
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">${gig.project} / Live take</p><h2 id="dialog-title">Execute the shot</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body shoot-body">
      <div class="shoot-monitor" style="--shoot-image:url('${film.image}')">
        <div class="shoot-hud"><span id="shoot-status">Standby</span><span>REC 01 / ${gig.symbol}</span></div>
        <div class="shoot-cue"><span>Cue <b id="shoot-cue-number">1</b> of 3</span><strong id="shoot-cue-label">${cues[0]}</strong></div>
        <div class="shoot-feedback" id="shoot-feedback" aria-live="polite">Roll when ready</div>
      </div>
      <div class="take-pips" aria-label="Take cue progress"><span></span><span></span><span></span></div>
      <div class="timing-track" aria-label="Timing track"><span class="timing-zone" id="timing-zone" style="left:${targets[0]}%"></span><span class="timing-playhead" id="timing-playhead"></span></div>
      <div class="timing-labels"><span>In</span><span>Director's mark</span><span>Out</span></div>
    </div>
    <div class="dialog-footer"><span class="text-small subdued">Your brief choices are locked. Hit the mark three times to protect the take.</span><button class="button primary shoot-action" id="shoot-action"><span aria-hidden="true">&#9654;</span> Roll camera</button></div>`);

  const playhead = document.getElementById("timing-playhead");
  const zone = document.getElementById("timing-zone");
  const status = document.getElementById("shoot-status");
  const cueNumber = document.getElementById("shoot-cue-number");
  const cueLabel = document.getElementById("shoot-cue-label");
  const feedback = document.getElementById("shoot-feedback");
  const action = document.getElementById("shoot-action");
  const pips = [...dialogContent.querySelectorAll(".take-pips span")];
  const timingScores = [];
  let running = false;
  let cueIndex = 0;
  let cursor = 0;
  let startedAt = 0;
  let frameId = 0;
  let finishTimer = 0;

  const animate = timestamp => {
    if (!running) return;
    cursor = (((timestamp - startedAt) % 2800) / 2800) * 100;
    playhead.style.left = `${cursor}%`;
    frameId = window.requestAnimationFrame(animate);
  };

  const timingWord = score => score >= 94 ? "Perfect mark" : score >= 78 ? "Clean" : score >= 58 ? "Usable" : "Missed the beat";

  const finishTake = () => {
    const scores = [...timingScores];
    if (activeShootCleanup) {
      activeShootCleanup();
      activeShootCleanup = null;
    }
    completeGig(gig, answers, scores);
  };

  const markBeat = () => {
    const distance = Math.abs(cursor - targets[cueIndex]);
    const timingScore = clamp(Math.round(100 - distance * 4.2), 20, 100);
    timingScores.push(timingScore);
    pips[cueIndex].classList.add(timingScore >= 78 ? "good" : timingScore >= 58 ? "okay" : "miss");
    pips[cueIndex].textContent = timingScore;
    feedback.textContent = `${timingWord(timingScore)} / ${timingScore}`;
    cueIndex += 1;

    if (cueIndex >= cues.length) {
      running = false;
      window.cancelAnimationFrame(frameId);
      status.textContent = "Cut";
      action.disabled = true;
      action.textContent = "Processing take";
      finishTimer = window.setTimeout(finishTake, 700);
      return;
    }

    cueNumber.textContent = cueIndex + 1;
    cueLabel.textContent = cues[cueIndex];
    zone.style.left = `${targets[cueIndex]}%`;
    startedAt = performance.now();
    cursor = 0;
  };

  const startRoll = () => {
    running = true;
    startedAt = performance.now();
    status.textContent = "Action";
    feedback.textContent = "Watch the playhead";
    action.innerHTML = `<span aria-hidden="true">&#9679;</span> Mark the beat`;
    frameId = window.requestAnimationFrame(animate);
  };

  const handleAction = () => {
    if (!running) startRoll();
    else markBeat();
  };

  const handleKey = event => {
    if (event.code === "Space" && dialog.open) {
      event.preventDefault();
      handleAction();
    }
  };

  action.addEventListener("click", handleAction);
  window.addEventListener("keydown", handleKey);
  activeShootCleanup = () => {
    running = false;
    window.cancelAnimationFrame(frameId);
    window.clearTimeout(finishTimer);
    window.removeEventListener("keydown", handleKey);
  };
}

// Scoring: 3 quiz questions → creativeScore (34 base + 22 per correct
// answer, so 0 correct = 34, 3/3 = 100), averaged timing minigame accuracy
// (0-100 per cue, see markBeat() above) → timingScore, blended 65/35
// creative-weighted into the final 0-100 `score`. That score then drives
// credit/reputation payout, whether an asset draft or script unlocks
// (>=72 / >=56 thresholds below), and feeds hasFlopStigma() via
// lastReleaseScore for productions specifically.
function completeGig(gig, answers, timingScores = [70, 70, 70]) {
  const correct = answers.filter((answer, index) => answer === gig.questions[index].answer).length;
  const creativeScore = 34 + correct * 22;
  const timingScore = Math.round(timingScores.reduce((sum, value) => sum + value, 0) / timingScores.length);
  const score = Math.round(creativeScore * 0.65 + timingScore * 0.35);
  // Section 5: a recent flop makes crews cautious — pay is reduced until the
  // director's next release scores 50 or better.
  const stigmaFactor = hasFlopStigma() ? 0.75 : 1;
  const creditReward = Math.max(35, Math.round(gig.fee * (0.6 + score / 125) * stigmaFactor));
  const repReward = score < 50 ? -4 : gig.rep + Math.round(score / 25);
  state.credits += creditReward;
  state.reputation = Math.max(0, state.reputation + repReward);
  state.completedGigs.push(gig.id);
  state.bestTakes[gig.id] = Math.max(state.bestTakes[gig.id] || 0, score);

  const assetWork = assetWorkByGig[gig.id];
  const alreadyOwnsSource = state.ownedAssets.some(asset => asset.sourceGig === gig.id);
  const alreadyHasDraft = state.assetDrafts.some(draft => draft.sourceGig === gig.id);
  const assetUnlocked = Boolean(assetWork && score >= 72 && !alreadyOwnsSource && !alreadyHasDraft);
  if (assetUnlocked) {
    state.assetDrafts.push({
      id: `draft-${gig.id}`,
      sourceGig: gig.id,
      name: assetWork.name,
      type: assetWork.type,
      role: gig.role,
      project: gig.project
    });
  }

  // Writer loop: a usable writing take delivers a real script to the library.
  const scriptWork = scriptWorkByGig[gig.id];
  let scriptUnlocked = null;
  if (scriptWork && score >= 56) {
    scriptUnlocked = { id: `script-${gig.id}`, title: scriptWork.title, pages: scriptWork.pages };
    if (!state.scriptLibrary.some(script => script.id === scriptUnlocked.id)) {
      state.scriptLibrary.push(scriptUnlocked);
    }
  }
  addActivity(`${gig.project}: ${gig.role} take scored ${score}.`);
  saveState();

  dialogContent.innerHTML = `
    <div class="dialog-header"><div><p class="eyebrow">Take report</p><h2 id="dialog-title">${score >= 78 ? "The director keeps the take." : score >= 56 ? "Usable, with notes." : "The brief slipped."}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body">
      <div class="result-score">${score}</div>
      <p class="subdued" style="text-align:center">${score >= 94 ? "Creative intent and execution landed together. This is portfolio work." : score >= 78 ? "The director keeps the take. The choices read and the timing cuts cleanly." : score >= 56 ? "The material can cut, but either the brief or execution lost precision." : "The take is technically complete, but it will cost the edit time."}</p>
      <div class="score-breakdown"><span>Brief <strong>${creativeScore}</strong></span><span>Execution <strong>${timingScore}</strong></span><span>Final <strong>${score}</strong></span></div>
      <div class="reward-grid"><div><span>Credits</span><strong>+${creditReward}</strong></div><div><span>Reputation</span><strong>${repReward >= 0 ? "+" : ""}${repReward}</strong></div><div><span>Best take</span><strong>${state.bestTakes[gig.id]}</strong></div></div>
      ${assetUnlocked ? `<div class="brief-box asset-unlock"><strong>Reusable asset unlocked</strong><p>${assetWork.name} is ready to publish from your Asset Library.</p></div>` : ""}
      ${scriptUnlocked ? `<div class="brief-box asset-unlock"><strong>Script delivered to your library</strong><p>"${scriptUnlocked.title}" (${scriptUnlocked.pages} pages) can now be selected when you greenlight a film, for a quality bonus.</p></div>` : ""}
      ${stigmaFactor < 1 ? `<p class="subdued" style="text-align:center">Paid at 75%: crews are still cautious after your last flop.</p>` : ""}
    </div>
    <div class="dialog-footer"><span class="text-small subdued">${state.reputation >= 60 ? "Director tier is now available." : `${Math.max(0, 60 - state.reputation)} reputation to Director.`}</span><button class="button primary" data-close>Return to board</button></div>`;
  dialogContent.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => { dialog.close(); renderApp(); }));
}

function settleAssetRental(context) {
  if (!state.ownedAssets.length) return 0;
  const asset = state.ownedAssets[state.cycle % state.ownedAssets.length];
  asset.uses += 1;
  // Section 8, question 4: rental royalties decay after heavy reuse so early
  // assets cannot dominate the passive-income economy forever.
  const decaySteps = Math.floor(Math.max(0, asset.uses - 12) / 4);
  const royalty = decaySteps > 0 ? Math.max(4, Math.round(asset.royalty * Math.pow(0.75, decaySteps))) : asset.royalty;
  state.credits += royalty;
  state.assetIncome += royalty;
  addActivity(`${asset.name} earned ${royalty} credits from ${context}.`);
  return royalty;
}

function settleInvestments() {
  let total = 0;
  state.investments.forEach(investment => {
    if (investment.cyclesLeft <= 0) return;
    investment.cyclesLeft -= 1;
    const payout = investment.hit
      ? Math.round(investment.yieldPerCycle * 1.15)
      : Math.max(15, Math.round(investment.yieldPerCycle * 0.25));
    state.credits += payout;
    investment.earned += payout;
    total += payout;
    addActivity(`${investment.title} paid a ${payout} cr producer distribution.`);
    if (investment.cyclesLeft === 0) {
      const profit = investment.earned - investment.stake;
      if (investment.hit) {
        state.reputation += 6;
        addActivity(`${investment.title} wrapped as a hit: ${profit >= 0 ? "+" : ""}${profit} cr on your stake, +6 reputation.`);
      } else {
        state.reputation = Math.max(0, state.reputation - 5);
        addActivity(`${investment.title} underperformed: ${profit >= 0 ? "+" : ""}${profit} cr on your stake, -5 reputation.`);
      }
    }
  });
  return total;
}

function advanceCycle() {
  state.cycle += 1;

  let residualIncome = 0;
  state.releases.forEach(film => {
    if (film.score >= 65) {
      const growth = film.score >= 80 ? 1.22 : 1.08;
      film.views = Math.round(film.views * growth);
      const yieldAmount = Math.round((film.baseYield || 0) * (film.score >= 80 ? 1.2 : 1));
      if (yieldAmount > 0) {
        state.credits += yieldAmount;
        residualIncome += yieldAmount;
        addActivity(`${film.title} paid ${yieldAmount} cr in streaming residuals (after crew and platform shares).`);
      }
    } else {
      // Flops decay instead of earning.
      film.views = Math.round(film.views * 0.94);
    }
  });

  const royalty = settleAssetRental(`Cycle ${state.cycle}`);
  const investReturns = settleInvestments();

  saveState();
  renderApp();
  const parts = [];
  if (residualIncome) parts.push(`+${residualIncome} residuals`);
  if (royalty) parts.push(`+${royalty} royalty`);
  if (investReturns) parts.push(`+${investReturns} distributions`);
  toast(parts.length ? `Cycle ${state.cycle}: ${parts.join(", ")}.` : `Cycle ${state.cycle}: no passive income settled this cycle.`);
}

function refreshBoard() {
  if (state.credits < 40 || state.completedGigs.length === 0) return;
  state.credits -= 40;
  state.completedGigs = [];
  addActivity("A fresh public call sheet was posted.");
  saveState();
  renderApp();
  toast("Job board refreshed. Previous takes remain in your portfolio. Use End cycle to settle residuals.");
}

function openGreenlight() {
  if (state.reputation < 60) {
    toast(`Director unlocks at 60 reputation. You are at ${state.reputation}.`);
    return;
  }
  if (state.production && !state.production.released) {
    toast("Finish the active production before opening another.");
    return;
  }
  if (state.credits < 420) {
    toast("A first production needs at least 420 credits.");
    return;
  }

  // Writer loop: completed writer gigs feed real scripts into this desk.
  const scriptOptions = [
    { title: "House stock script", bonus: 0 },
    ...state.scriptLibrary
      .filter(script => !state.usedScripts.includes(script.id))
      .map(script => ({ title: `${script.title} / ${script.pages} pages`, bonus: 6 }))
  ];

  const demand = genreCrewDemand[Object.keys(genreCrewDemand)[0]] || [];
  const crewFields = crewRates.map(rate => {
    const sourceGig = roleGigSource[rate.role];
    const trackScore = state.bestTakes[sourceGig] || 55;
    const required = demand.includes(rate.role);
    return `
      <label class="segment">
        <input type="checkbox" name="crew-${rate.role}" value="${rate.cost}">
        <strong>${rate.role} / ${rate.cost} cr</strong>
        <span>Track quality ${trackScore}${required ? " / key for Sci-Fi" : ""}</span>
      </label>`;
  }).join("");

  openDialog(`
    <form id="greenlight-form">
      <div class="dialog-header"><div><p class="eyebrow">Director desk / Greenlight</p><h2 id="dialog-title">Commit the project</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="form-field"><label for="film-title">Working title</label><input id="film-title" name="title" maxlength="36" placeholder="Last Light at Meridian" required></div>
        <div class="form-field"><label for="film-script">Script</label><select id="film-script" name="script">${scriptOptions.map((option, index) => `<option value="${index}">${escapeHTML(option.title)}${option.bonus ? ` / quality +${option.bonus}` : ""}</option>`).join("")}</select></div>
        <div class="form-field"><span class="form-legend">Genre and world package</span>
          <div class="segmented">
            <label class="segment"><input type="radio" name="genre" value="Sci-Fi" checked><strong>Sci-Fi</strong><span>Needs Drone Op + VFX</span></label>
            <label class="segment"><input type="radio" name="genre" value="Mystery"><strong>Mystery</strong><span>Needs Drone Op</span></label>
            <label class="segment"><input type="radio" name="genre" value="Comedy-Drama"><strong>Comedy-Drama</strong><span>Needs Videographer</span></label>
          </div>
        </div>
        <div class="form-field"><span class="form-legend">Specialist crew (optional, paid up front)</span>
          <div class="segmented">${crewFields}</div>
        </div>
        <div class="form-field"><span class="form-legend">Production budget</span>
          <div class="segmented">
            <label class="segment"><input type="radio" name="budget" value="420" checked><strong>Lean / 420 cr</strong><span>Quality base +6</span></label>
            <label class="segment"><input type="radio" name="budget" value="650" ${state.credits - crewRates.reduce((sum, rate) => sum + rate.cost, 0) >= 650 ? "" : "disabled"}><strong>Standard / 650 cr</strong><span>Quality base +10</span></label>
            <label class="segment"><input type="radio" name="budget" value="900" ${state.credits - crewRates.reduce((sum, rate) => sum + rate.cost, 0) >= 900 ? "" : "disabled"}><strong>Premium / 900 cr</strong><span>Quality base +14</span></label>
          </div>
        </div>
        <div class="brief-box"><strong>Deal memo</strong><p>You finance and direct this production. Hired specialists take 20% of gross as residuals; missing a genre's key specialist costs audience score at release.</p></div>
      </div>
      <div class="dialog-footer"><span class="text-small subdued">Available: ${state.credits} credits</span><button class="button primary" type="submit">Sign and greenlight</button></div>
    </form>`);

  document.getElementById("greenlight-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) {
      toast("Give the production a working title before signing.");
      return;
    }
    const genre = String(data.get("genre"));
    const budget = Number(data.get("budget"));
    if (!budget || Number.isNaN(budget)) {
      toast("Pick a production budget.");
      return;
    }
    if (budget > state.credits) {
      toast(`Not enough credits: the ${budget} budget exceeds your ${state.credits} credits.`);
      return;
    }
    const hiredCrew = crewRates
      .filter(rate => data.get(`crew-${rate.role}`))
      .map(rate => ({
        role: rate.role,
        cost: rate.cost,
        score: state.bestTakes[roleGigSource[rate.role]] || 55
      }));
    const crewCost = hiredCrew.reduce((sum, member) => sum + member.cost, 0);
    if (budget + crewCost > state.credits) {
      toast(`Budget plus crew payroll (${budget + crewCost} cr) exceeds your ${state.credits} credits.`);
      return;
    }

    const scriptChoice = scriptOptions[Number(data.get("script"))] || scriptOptions[0];
    if (scriptChoice.bonus > 0) {
      const chosen = state.scriptLibrary.find(script => `${script.title} / ${script.pages} pages` === scriptChoice.title);
      if (chosen && !state.usedScripts.includes(chosen.id)) state.usedScripts.push(chosen.id);
    }

    const budgetBonus = budget === 900 ? 14 : budget === 650 ? 10 : 6;

    // Generative cast (persistent personalities, Inworld-style): the adapter
    // returns original performers; offline it falls back to local drafts.
    const castResult = await TakeOneAI.suggestCast({ title, genre, count: 3 });
    const cast = (castResult.cast || []).map(member => ({
      name: member.name,
      role: member.role || "Supporting",
      archetype: member.archetype || "professional",
      trait: member.trait || "composed under pressure",
      quirk: member.quirk || ""
    }));

    state.credits -= budget + crewCost;
    state.production = {
      id: `production-${Date.now()}`,
      title,
      script: scriptChoice.title,
      scriptBonus: scriptChoice.bonus,
      genre,
      budget,
      crewCost,
      hiredCrew,
      cast,
      setLog: [],
      beatBonus: 0,
      quality: 42 + budgetBonus + scriptChoice.bonus,
      stage: 0,
      decisions: [],
      released: false
    };
    addActivity(`${title} was greenlit for ${budget} credits${crewCost ? ` plus ${crewCost} cr payroll` : ""} with a generated cast of ${cast.length}.`);
    saveState();
    dialog.close();
    setView("productions");
    toast(castResult._fallback
      ? "Production greenlit with a locally generated cast."
      : `Production greenlit — live model cast ${cast.map(member => member.name.split(" ")[0]).join(", ")}.`);

    // Auto-generate the key-set spec so it is ready for the Unreal stage.
    const greenlit = state.production;
    TakeOneAI.generateScene(composeSetPrompt(greenlit)).then(spec => {
      // Ignore if the player already moved on to another production.
      if (state.production !== greenlit) return;
      greenlit.sceneSpec = spec;
      saveState();
      if (currentView === "productions") renderApp();
      toast(`Key set "${spec.title || "generated"}" is ready (${Array.isArray(spec.objects) ? spec.objects.length : 0} objects).`);
    });
  });
}

// Walks the player through one productionStages[] entry per call, advancing
// production.stage each time. Each locked choice adds choice.effect (plus a
// +2 genre-fit bonus, see below) to production.quality, which is the running
// score releaseProduction() eventually turns into audience reception. Once
// production.stage passes the end of productionStages, this triggers
// releaseProduction() automatically. Players can bypass the fixed options
// via "improvise" (openStageImprovise) and get an AI-rated freeform score
// instead of a fixed `effect`.
function openProductionStage() {
  const production = state.production;
  if (!production || production.released) return;
  const stage = productionStages[production.stage];
  if (!stage) return;
  const missingSpecialists = (genreCrewDemand[production.genre] || [])
    .filter(role => !(production.hiredCrew || []).some(member => member.role === role));
  const demandWarning = missingSpecialists.length
    ? `<p><strong>Unstaffed for this genre:</strong> ${missingSpecialists.join(", ")}. Releasing without them costs audience score.</p>`
    : "";

  openDialog(`
    <form id="stage-form" autocomplete="off">
      <div class="dialog-header"><div><p class="eyebrow">${escapeHTML(production.title)} / Stage 0${production.stage + 1}</p><h2 id="dialog-title">${stage.name}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="brief-box"><strong>${stage.prompt}</strong><p>${stage.brief}</p>${demandWarning}</div>
        <div class="option-grid">
          ${stage.options.map((option, index) => `<label class="option-card"><input type="radio" name="decision" value="${index}"><strong>${option.title}</strong><span>${option.detail}</span></label>`).join("")}
        </div>
        <button type="button" class="button" id="stage-improvise" style="margin-top:12px"><span aria-hidden="true">&#9673;</span> Or improvise: write your own direction</button>
      </div>
      <div class="dialog-footer"><span class="text-small subdued">This call becomes part of the finished film.</span><button class="button primary" id="lock-decision" type="submit" disabled>Lock decision</button></div>
    </form>`);

  const form = document.getElementById("stage-form");
  const submit = document.getElementById("lock-decision");
  form.addEventListener("change", () => { submit.disabled = false; });
  document.getElementById("stage-improvise").addEventListener("click", () => openStageImprovise(stage.name));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const choiceIndex = Number(new FormData(form).get("decision"));
    const choice = stage.options[choiceIndex];
    // Genre fit only rewards committed strategies — a lazy pick that technically
    // matches the genre earns nothing extra.
    const fitBonus = choice.effect >= 7 && choice.fits.includes(production.genre) ? 2 : 0;
    production.quality += choice.effect + fitBonus;
    production.decisions.push({ stage: stage.name, choice: choice.title, impact: choice.effect + fitBonus });
    production.stage += 1;
    addActivity(`${production.title}: ${stage.short} decision locked.`);

    if (production.stage >= productionStages.length) releaseProduction();
    saveState();
    dialog.close();
    renderApp();
    toast(production.released ? `${production.title} is now live in the catalog.` : `${stage.short} complete. The next department is ready.`);
  });
}

function composeSetPrompt(production) {
  const moodByGenre = {
    "Sci-Fi": "rain-soaked neon metropolis, towering wet architecture",
    Mystery: "remote desert observatory at dusk, long shadows and red practicals",
    "Comedy-Drama": "warm cramped orbital greenhouse, soft diffused light, cluttered homey detail"
  };
  return `${production.title} key set — ${moodByGenre[production.genre] || production.genre}. ${production.script || ""}`.trim();
}

async function sendProductionToUnreal(production) {
  if (TakeOneAI.status === "offline") {
    toast("No adapter running. Start Tools/ai-scene-service.mjs first.");
    return;
  }
  toast("Queuing set build for Unreal\u2026");
  const result = await TakeOneAI.requestUnrealBuild(composeSetPrompt(production), production.id, (production.cast || []).length || 2);
  if (result._fallback || !result.queued) {
    toast("Unreal build queue unreachable. Is the adapter running?");
    return;
  }
  production.unrealJobId = result.id;
  addActivity(`${production.title} set queued for the Unreal stage (${result.id}). Press R in Unreal after it builds to shoot stills.`);
  saveState();
  renderApp();
  toast(`Set queued for Unreal. When it builds, press R in-engine to shoot your film's stills.`);
}

// Pull rendered footage (shot by the Unreal client) for a released film.
const shotsChecked = {};
async function refreshFilmShots(filmId) {
  if (!filmId || shotsChecked[filmId]) return;
  shotsChecked[filmId] = true;
  const manifest = await TakeOneAI.shotManifest(filmId);
  if (manifest.count > 0 && !state.filmShots[filmId]) {
    state.filmShots[filmId] = manifest.indexes.map(index => TakeOneAI.shotUrl(filmId, index));
    saveState();
    if (currentView === "catalog") renderApp();
  }
  await tryEncodeFilmVideo(filmId);
}

// Ask the adapter to FFmpeg-encode the moving master once; flips to a real
// <video> when it becomes available.
const encodeTried = {};
async function tryEncodeFilmVideo(filmId) {
  const shots = state.filmShots[filmId];
  if (!shots || !shots.length || state.filmVideos[filmId] || encodeTried[filmId]) return;
  encodeTried[filmId] = true;
  try {
    const response = await fetch(TakeOneAI.videoUrl(filmId));
    if (response.ok) {
      state.filmVideos[filmId] = true;
      saveState();
      if (currentView === "catalog" || dialog.open) renderApp();
    }
  } catch { /* adapter offline — flipbook remains */ }
}

function filmImage(film) {
  if (state.filmShots[film.id] && state.filmShots[film.id].length) {
    return state.filmShots[film.id][0];
  }
  return film.image;
}

function exportSceneSpec(production) {
  const spec = production.sceneSpec;
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${production.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-scene.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Scene spec exported.");
}

function openDirectSet(selectedIndex = 0) {
  const production = state.production;
  if (!production || production.released) return;
  production.setLog = production.setLog || [];
  production.beatBonus = production.beatBonus || 0;
  const cast = production.cast || [];

  const roster = cast.length
    ? `<div class="segmented">${cast.map((member, index) => `
        <label class="segment cast-card">
          <input type="radio" name="cast-select" value="${index}" ${index === selectedIndex ? "checked" : ""}>
          <strong>${escapeHTML(member.name)} / ${escapeHTML(member.role)}</strong>
          <span>${escapeHTML(member.archetype)} &mdash; ${escapeHTML(member.trait)}</span>
          <em>${escapeHTML(member.quirk)}</em>
        </label>`).join("")}</div>`
    : `<p class="subdued">No cast attached to this production.</p>`;

  const logHtml = production.setLog.slice(-12).reverse().map(entry => {
    if (entry.kind === "line") {
      return `<div class="log-entry"><strong>${escapeHTML(entry.who)}</strong> &mdash; <em>${escapeHTML(entry.direction)}</em><br>${escapeHTML(entry.line)}<span class="log-note">${escapeHTML(entry.reaction)}</span></div>`;
    }
    return `<div class="log-entry beat-entry"><strong>Story beat</strong> &mdash; <em>${escapeHTML(entry.shot)}</em><br>${entry.action.map(escapeHTML).join(" ")}</div>`;
  }).join("") || `<p class="subdued">Nothing directed yet. Pick a performer or write a story beat.</p>`;

  const liveLabel = TakeOneAI.status === "online"
    ? (TakeOneAI.healthInfo?.llm?.enabled ? "Live model generation active" : "Adapter connected, local generation")
    : "Offline generator — run Tools/ai-scene-service.mjs for live models";

  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">${escapeHTML(production.title)} / Live set console</p><h2 id="dialog-title">Direct the set</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body">
      <div class="form-field"><span class="form-legend">Cast / persistent personalities</span>${roster}</div>
      <div class="form-field">
        <label for="npc-direction">Give a performance note</label>
        <textarea id="npc-direction" rows="2" maxlength="280" placeholder="Play the discovery quieter &mdash; hold the line until the lamp passes."></textarea>
        <button class="button primary" id="send-direction" style="margin-top:8px">Give direction</button>
      </div>
      <div class="form-field">
        <label for="beat-prompt">Write a story beat (improvised coverage)</label>
        <textarea id="beat-prompt" rows="2" maxlength="280" placeholder="A rival survey crew's drone drifts over the ridge mid-scene&hellip;"></textarea>
        <button class="button primary" id="send-beat" style="margin-top:8px">Generate beat${production.beatBonus < 4 ? " (+1 creative signal)" : ""}</button>
        <span class="text-small subdued">Improvised coverage bonus: ${production.beatBonus}/4 applied.</span>
      </div>
      <div class="set-log" aria-live="polite">${logHtml}</div>
    </div>
    <div class="dialog-footer"><span class="text-small subdued">${liveLabel}</span><button class="button" data-close>Back to slate</button></div>`);

  document.getElementById("send-direction").addEventListener("click", async () => {
    const input = document.getElementById("npc-direction");
    const button = document.getElementById("send-direction");
    const direction = input.value.trim();
    const selected = Number(document.querySelector("input[name='cast-select']:checked")?.value ?? 0);
    const member = cast[selected];
    if (!direction) { toast("Write a performance note first."); return; }
    if (!member) { toast("This production has no cast to direct."); return; }
    button.disabled = true;
    button.textContent = "Performing\u2026";
    const result = await TakeOneAI.npcLine(member, direction);
    production.setLog.push({ kind: "line", who: member.name, direction, line: result.line, reaction: result.reaction });
    saveState();
    renderApp();
    openDirectSet(selected);
    toast(result._fallback ? `${member.name} responded (local generator).` : `${member.name} responded (live model).`);
  });

  document.getElementById("send-beat").addEventListener("click", async () => {
    const input = document.getElementById("beat-prompt");
    const button = document.getElementById("send-beat");
    const prompt = input.value.trim();
    if (!prompt) { toast("Describe the beat you want generated."); return; }
    button.disabled = true;
    button.textContent = "Generating\u2026";
    const result = await TakeOneAI.directBeat(prompt, {
      title: production.title,
      genre: production.genre,
      characters: cast.map(member => member.name)
    });
    production.setLog.push({ kind: "beat", shot: result.shot, mood: result.mood, action: Array.isArray(result.action) ? result.action : [String(result.action ?? "")] });
    let bonusNote = "";
    if (production.beatBonus < 4) {
      production.quality += 1;
      production.beatBonus += 1;
      bonusNote = " +1 creative signal.";
    }
    saveState();
    renderApp();
    openDirectSet(selectedIndex);
    toast(`Beat generated${result._fallback ? " locally" : " by the live model"}.${bonusNote}`);
  });
}

function openWorldPrompt() {
  state.worldPrompts = state.worldPrompts || [];
  const history = state.worldPrompts.slice(-6).reverse().map(entry => `
    <div class="log-entry beat-entry">
      <strong>${escapeHTML(entry.title)}</strong> &mdash; ${entry.objects} objects, fog ${Number(entry.fog).toFixed(3)}
      <span class="log-note">${escapeHTML(entry.summary)}</span>
    </div>`).join("") || `<p class="subdued">Nothing generated yet. Describe any set you can imagine.</p>`;
  const paid = state.promptCycle === state.cycle;

  openDialog(`
    <form id="world-prompt-form" autocomplete="off">
      <div class="dialog-header"><div><p class="eyebrow">World engine / Free direction</p><h2 id="dialog-title">Prompt the world</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="brief-box"><strong>You are the director</strong><p>Describe any film set &mdash; location, time of day, weather, mood. The world engine builds it. Original fiction only: no real people or franchises.</p></div>
        <div class="form-field">
          <label for="world-prompt-input">Your set description</label>
          <textarea id="world-prompt-input" name="prompt" rows="3" maxlength="400" required placeholder="A flooded city avenue at night, rain hammering a collapsed overpass, one flickering neon sign&hellip;"></textarea>
        </div>
        <div class="scene-preview" id="scene-preview"></div>
        <section class="section-block" style="margin-top:16px">
          <div class="section-heading"><div><p class="eyebrow">Recent generations</p></div></div>
          <div class="set-log">${history}</div>
        </section>
      </div>
      <div class="dialog-footer"><span class="text-small subdued">${TakeOneAI.status === "online" ? (TakeOneAI.healthInfo?.llm?.enabled ? "Live model connected" : "Adapter connected / local generator") : "Offline mode &mdash; browser generator active"}${paid ? " / +2 cr already earned this cycle" : " / +2 cr for your first prompt this cycle"}</span><button class="button primary" type="submit">Generate set</button></div>
    </form>`);

  document.getElementById("world-prompt-form").addEventListener("submit", async event => {
    event.preventDefault();
    const prompt = String(new FormData(event.currentTarget).get("prompt") || "").trim();
    if (!prompt) { toast("Describe the set first."); return; }
    const submitButton = event.currentTarget.querySelector("button[type=submit]");
    const preview = document.getElementById("scene-preview");
    submitButton.disabled = true;
    submitButton.textContent = "Generating\u2026";
    preview.innerHTML = `<div class="log-entry"><strong>Building the world\u2026</strong></div>`;

    const scene = await TakeOneAI.generateScene(prompt);
    state.worldPrompts.push({
      title: scene.title || "Generated Set",
      summary: scene.summary || "",
      objects: Array.isArray(scene.objects) ? scene.objects.length : 0,
      fog: scene.environment ? scene.environment.fog_density : 0
    });
    state.worldPrompts = state.worldPrompts.slice(-12);

    let rewardNote = "";
    if (state.promptCycle !== state.cycle) {
      state.promptCycle = state.cycle;
      state.credits += 2;
      rewardNote = " +2 cr creative direction fee.";
      addActivity(`You prompted the world engine: "${prompt.slice(0, 48)}\u2026"`);
    }
    saveState();
    document.getElementById("credit-balance").textContent = formatNumber(state.credits);
    renderApp();

    const sourceLabels = {
      llm: "live model",
      local: "adapter local generator",
      "local-browser": "browser generator",
      "browser-offline": "browser generator (offline mode)"
    };
    preview.innerHTML = `
      <div class="log-entry">
        <strong>${escapeHTML(scene.title || "Generated Set")}</strong> <span class="log-note">built by ${escapeHTML(sourceLabels[scene.source] || "the world engine")}</span>
        <span class="log-note">${escapeHTML(scene.summary || "")}</span>
        ${(Array.isArray(scene.objects) ? scene.objects : []).slice(0, 6).map(obj => `<span class="log-note">&bull; ${escapeHTML(obj.label)} (${obj.primitive}) &mdash; ${escapeHTML(obj.asset_hint || "")}</span>`).join("")}
        <span class="log-note">${(Array.isArray(scene.objects) ? scene.objects.length : 0)} objects total.${rewardNote}</span>
      </div>`;
    submitButton.disabled = false;
    submitButton.textContent = "Generate again";
    toast(scene._fallback ? `Set generated locally.${rewardNote}` : `Set generated by the live model.${rewardNote}`);
  });
}

async function openStageImprovise(stageName) {
  const production = state.production;
  if (!production || production.released) return;

  openDialog(`
    <form id="improvise-form" autocomplete="off">
      <div class="dialog-header"><div><p class="eyebrow">${escapeHTML(production.title)} / Improvised stage</p><h2 id="dialog-title">${stageName}: write your own call</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
      <div class="dialog-body">
        <div class="brief-box"><strong>Adaptive direction</strong><p>Describe what happens in this stage in your own words. The story engine turns it into shot notes and rates how dramatically strong your call is (2&ndash;9 creative signal).</p></div>
        <div class="form-field">
          <label for="stage-prompt">Your direction</label>
          <textarea id="stage-prompt" name="prompt" rows="4" maxlength="400" required placeholder="The rescue beacon cuts out mid-scene and Mara has to choose between the signal and the survivor&hellip;"></textarea>
        </div>
      </div>
      <div class="dialog-footer"><span class="text-small subdued">${TakeOneAI.status === "online" ? "Live model active" : "Offline generator active"}</span><button class="button primary" type="submit">Lock improvised decision</button></div>
    </form>`);

  document.getElementById("improvise-form").addEventListener("submit", async event => {
    event.preventDefault();
    const prompt = String(new FormData(event.currentTarget).get("prompt") || "").trim();
    const promptField = document.getElementById("stage-prompt");
    if (!prompt) { toast("Write a direction first."); return; }
    const submitButton = event.currentTarget.querySelector("button[type=submit]");
    submitButton.disabled = true;
    submitButton.textContent = "Generating\u2026";
    promptField.disabled = true;

    const result = await TakeOneAI.directBeat(prompt, {
      title: production.title,
      genre: production.genre,
      characters: (production.cast || []).map(member => member.name)
    });
    const impact = clamp(Math.round(Number(result.quality_hint) || 5), 2, 9);
    production.quality += impact;
    production.decisions.push({ stage: stageName, choice: `Improvised: ${prompt.slice(0, 60)}`, impact });
    production.stage += 1;
    addActivity(`${production.title}: improvised ${stageName.toLowerCase()} locked (+${impact} signal).`);

    if (production.stage >= productionStages.length) releaseProduction();
    saveState();
    dialog.close();
    renderApp();
    toast(production.released
      ? `${production.title} is now live in the catalog.`
      : `Improvised decision locked (+${impact} signal). The next department is ready.`);
  });
}

// Turns the accumulated production.quality (from openProductionStage() /
// openStageImprovise() choices) plus crew quality and staffing gaps into a
// final 30-97 `score`, then derives box-office gross, crew residuals (20%
// cut, floored at the gross itself), and the director's net take. Also
// pushes the finished film onto state.releases (which the Catalog view
// reads) and publishes it to the shared world catalog via publishToWorld().
function releaseProduction() {
  const production = state.production;
  const hiredCrew = production.hiredCrew || [];
  const missingSpecialists = (genreCrewDemand[production.genre] || [])
    .filter(role => !hiredCrew.some(member => member.role === role));
  const crewQuality = hiredCrew.length
    ? hiredCrew.reduce((sum, member) => sum + member.score, 0) / (hiredCrew.length * 12)
    : 0;
  // No artificial floor: bad decisions, missing specialists, or weak crew can
  // genuinely flop the film.
  const score = clamp(Math.round(production.quality + crewQuality + 5 - missingSpecialists.length * 10), 30, 97);
  const flop = score < 50;
  const gross = Math.round(production.budget * (flop ? 0.18 : 0.35 + (score / 100) * 0.75));
  const crewResiduals = Math.min(gross, Math.round(gross * 0.2));
  const netToProducerDirector = gross - crewResiduals;

  production.released = true;
  production.score = score;
  production.views = 2600 + score * (flop ? 40 : 175);
  production.gross = gross;
  production.crewResiduals = crewResiduals;
  state.credits += netToProducerDirector;
  state.reputation = Math.max(0, state.reputation + (flop ? -8 : score >= 85 ? 14 : score >= 72 ? 9 : 3));
  state.lastReleaseScore = score;
  settleAssetRental(`${production.title} production rental`);

  state.releases.unshift({
    id: production.id,
    title: production.title,
    genre: production.genre,
    image: images[production.genre],
    score,
    views: production.views,
    length: production.genre === "Mystery" ? "22 min" : "18 min",
    creator: getRank().name === "Crew Pool" ? "Rookie Director Unit" : `${getRank().name} Unit`,
    logline: `An original ${production.genre.toLowerCase()} production shaped by four player-directed creative calls.`,
    status: flop ? "Flop" : "New release",
    // Per-cycle streaming residual pool after crew (20%) and platform shares.
    baseYield: flop ? 0 : Math.max(15, Math.round(gross * 0.08)),
    cycleReleased: state.cycle
  });

  publishToWorld(production);

  if (flop) {
    addActivity(`${production.title} flopped at ${score}: gross ${gross} cr, ${crewResiduals} cr still went to crew residuals.`);
  } else {
    addActivity(`${production.title} premiered at ${score}: gross ${gross} cr, crew residuals ${crewResiduals} cr, ${netToProducerDirector} cr to you.`);
  }
}

function openLiveSet() {
  const liveFilm = baseFilms[state.cycle % baseFilms.length];
  const watchers = 1800 + ((state.cycle * 731) % 1400);
  const reacted = state.liveCycle === state.cycle;
  openDialog(`
    <div class="watch-frame"><img src="${liveFilm.image}" alt="Live shot from ${escapeHTML(liveFilm.title)}"><div class="watch-progress"><span></span></div></div>
    <div class="dialog-header"><div><p class="eyebrow"><span class="status-tag live">Live</span> / ${formatNumber(watchers)} watching</p><h2 id="dialog-title">${escapeHTML(liveFilm.title)}: Live shoot</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body"><div class="brief-box"><strong>Director comms</strong><p>"Hold atmosphere at 70. Drone clears frame on the second lamp. Keep the realization smaller than the weather."</p></div><p class="subdued">Take 03 is rolling. Audience reactions contribute a small participation reward, once per cycle, and signal live interest to the production.</p></div>
    <div class="dialog-footer"><span class="text-small subdued">Unit A / Cycle ${String(state.cycle).padStart(2, "0")} / Camera moving</span><button class="button primary" id="live-react" ${reacted ? "disabled" : ""}>${reacted ? "Applause sent this cycle" : "+ Send applause"}</button></div>`);

  const react = document.getElementById("live-react");
  if (react && !reacted) react.addEventListener("click", () => {
    state.liveCycle = state.cycle;
    state.credits += 2;
    addActivity(`You joined the live audience for ${liveFilm.title}.`);
    saveState();
    react.disabled = true;
    react.textContent = "Applause sent this cycle";
    document.getElementById("credit-balance").textContent = formatNumber(state.credits);
    toast("+2 credits for live participation.");
  });
}

let motionTimer = null;

function stopMotionPlayback() {
  if (motionTimer) {
    window.clearInterval(motionTimer);
    motionTimer = null;
  }
}

function openFilm(filmId) {
  const film = allFilms().find(item => item.id === filmId);
  if (!film) return;
  refreshFilmShots(filmId);
  const shots = state.filmShots[filmId] || [];
  const firstWatch = !state.watched[filmId];
  if (firstWatch) {
    state.watched[filmId] = true;
    addActivity(`You watched ${film.title}.`);
    saveState();
  }
  const currentRating = state.ratings[filmId] || 0;

  const videoReady = Boolean(state.filmVideos[filmId]) && shots.length > 0;
  const watchInner = videoReady
    ? `<video src="${TakeOneAI.videoUrl(filmId)}" autoplay loop muted playsinline></video><div class="watch-progress"><span></span></div><span class="motion-badge">encoded film &middot; ${shots.length} frames</span>`
    : `<img id="motion-frame" src="${filmImage(film)}" alt="Still from ${escapeHTML(film.title)}"><div class="watch-progress"><span></span></div>${shots.length ? `<span class="motion-badge">moving master &middot; ${shots.length} frames</span>` : ""}`;

  openDialog(`
    <div class="watch-frame">${watchInner}</div>
      ${!videoReady && shots.length > 1 ? `<div class="shot-strip">${shots.map((url, index) => `<img src="${url}" class="strip-frame ${index === 0 ? "active" : ""}" data-index="${index}" alt="Rendered shot from ${escapeHTML(film.title)}">`).join("")}</div>` : shots.length === 1 ? `<div class="shot-strip">${shots.map(url => `<img src="${url}" alt="Rendered shot from ${escapeHTML(film.title)}">`).join("")}</div>` : ""}
    <div class="dialog-header"><div><p class="eyebrow">${film.status} / ${film.genre}</p><h2 id="dialog-title">${escapeHTML(film.title)}</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body">
      <p>${escapeHTML(film.logline)}</p>
      <div class="reward-grid"><div><span>Audience score</span><strong>${film.score}</strong></div><div><span>Views</span><strong>${formatViews(film.views)}</strong></div><div><span>Runtime</span><strong>${film.length}</strong></div></div>
      <strong class="text-small">Your rating</strong>
      <div class="rating-control" aria-label="Rate this film from one to five">${[1, 2, 3, 4, 5].map(value => `<button type="button" data-rating="${value}" class="${currentRating === value ? "selected" : ""}" aria-label="${value} out of 5">${value}</button>`).join("")}</div>
    </div>
    <div class="dialog-footer"><span class="text-small subdued">Directed by ${escapeHTML(film.creator)}</span><button class="button" data-close>Back to catalog</button></div>`);

  dialogContent.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialogContent.querySelectorAll("[data-rating]").forEach(button => button.addEventListener("click", () => {
    const wasUnrated = !state.ratings[filmId];
    state.ratings[filmId] = Number(button.dataset.rating);
    dialogContent.querySelectorAll("[data-rating]").forEach(item => item.classList.toggle("selected", item === button));
    if (wasUnrated) {
      state.credits += 3;
      addActivity(`You rated ${film.title}.`);
      toast("+3 credits for a catalog rating.");
      document.getElementById("credit-balance").textContent = formatNumber(state.credits);
      // Ratings feed back into audience scores (section 6): strong ratings lift,
      // weak ratings drag, once per film.
      const baseFilm = baseFilms.find(item => item.id === filmId);
      const rating = Number(button.dataset.rating);
      if (baseFilm && !state.ratings[filmId]) {
        baseFilm.score = clamp(baseFilm.score + (rating >= 4 ? 1 : rating <= 2 ? -1 : 0), 1, 99);
      }
      if (film.external) {
        TakeOneAI.rateWorldFilm(filmId, rating);
      }
    }
    saveState();
  }));

  // Moving master: loop the UE-rendered orbit sequence as live footage.
  if (!videoReady && shots.length > 1) {
    let frameIndex = 0;
    stopMotionPlayback();
    motionTimer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % shots.length;
      const frame = document.getElementById("motion-frame");
      if (!frame) {
        stopMotionPlayback();
        return;
      }
      frame.src = shots[frameIndex];
      dialogContent.querySelectorAll(".strip-frame").forEach(img =>
        img.classList.toggle("active", Number(img.dataset.index) === frameIndex)
      );
    }, 300);
  }
}

document.querySelectorAll("[data-view-target]").forEach(button => button.addEventListener("click", () => setView(button.dataset.viewTarget)));

document.getElementById("reset-progress").addEventListener("click", () => {
  openDialog(`
    <div class="dialog-header"><div><p class="eyebrow">Local save</p><h2 id="dialog-title">Reset your production career?</h2></div><button type="button" class="close-button" data-close aria-label="Close">&times;</button></div>
    <div class="dialog-body"><p class="subdued">This clears completed gigs, productions, ratings, credits, and reputation on this device.</p></div>
    <div class="dialog-footer"><button class="button" data-close>Keep progress</button><button class="button danger" id="confirm-reset">Reset everything</button></div>`);
  document.getElementById("confirm-reset").addEventListener("click", () => {
    state = createDefaultState();
    saveState();
    dialog.close();
    currentView = "studio";
    renderApp();
    toast("Production career reset.");
  });
});

function renderAiChip(status, info) {
  const chip = document.getElementById("ai-status");
  if (!chip) return;
  chip.classList.remove("online", "offline");
  if (status === "online") {
    chip.classList.add("online");
    const llm = info && info.llm;
    chip.textContent = llm && llm.enabled ? `AI \u00B7 live (${llm.model})` : "AI \u00B7 adapter (local gen)";
  } else if (status === "offline") {
    chip.classList.add("offline");
    chip.textContent = "AI \u00B7 offline";
  } else {
    chip.textContent = "AI \u00B7 checking\u2026";
  }
}

// ------------------------------------------------------------------
// Bootstrap: runs once when the script loads. Wires the AI status chip,
// health-checks the adapter (ai-client.js falls back gracefully either
// way), assigns this browser a random director identity for the shared
// world catalog on first run, starts polling for other players' releases,
// then performs the first render.
// ------------------------------------------------------------------
if (window.TakeOneAI) {
  TakeOneAI.onStatusChange(renderAiChip);
  TakeOneAI.checkHealth().then(() => {
    // Shared world: give this browser a director identity, then keep the
    // whole player base's catalog fresh.
    if (!state.playerName) {
      state.playerName = `Director-${1000 + Math.floor(Math.random() * 9000)}`;
      saveState();
      renderApp();
    }
    loadWorldFilms();
    window.setInterval(loadWorldFilms, 20000);
  });
}

renderApp();
