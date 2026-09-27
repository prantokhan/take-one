--[[
  GameData — static game-balance data shared by server and client.

  A direct port of the browser game's app.js tables (gigs, productionStages,
  genreCrewDemand, crewRates, roleGigSource, baseFilms) plus the pure rule
  helpers (rank, gig scoring, release scoring). The SERVER is authoritative:
  clients use this module only to draw UI; every reward is recomputed on
  the server from the same functions, so numbers match the web game.

  Answer indexes are always the ORIGINAL option index. The client shuffles
  options for display (the web version always lists the right answer
  first) and sends back the original index.
]]

local GameData = {}

GameData.START = { credits = 460, reputation = 38, cycle = 7 }

local function q(prompt, a, b, c)
	return { prompt = prompt, options = { a, b, c }, answer = 1 }
end

GameData.Gigs = {
	{
		id = "actor-glass", role = "Actor", symbol = "ACT", color = Color3.fromRGB(255, 113, 101),
		title = "Reaction pickup", project = "Glass River", fee = 140, rep = 8, requirement = 0,
		brief = "Mara has just realized the rescue beacon is coming from beneath the water. Play discovery, not fear. The camera is already moving toward you.",
		questions = {
			q("Where does the realization land?", { "On the beacon", "Keep the eyeline low and let the thought arrive." }, { "At the drone", "Ask the machine for silent confirmation." }, { "Toward camera", "Share the discovery directly with the audience." }),
			q("How large is the performance?", { "Hold it in", "A breath catches; the body stays quiet." }, { "Step backward", "Make the danger physically immediate." }, { "Call for help", "Turn the beat into an urgent warning." }),
			q("When do you speak?", { "Over the move", "Let the line pull the camera forward." }, { "After the camera settles", "Protect the words with stillness." }, { "Do not speak", "Give the editor a silent alternative." }),
		},
	},
	{
		id = "crew-asterion", role = "Set Crew", symbol = "SET", color = Color3.fromRGB(243, 173, 82),
		title = "Signal camp dressing", project = "Asterion Signal", fee = 165, rep = 10, requirement = 0,
		brief = "The camp has been running for nine sleepless days. The director wants exhaustion and obsession, but the signal rig must remain the first read in frame.",
		questions = {
			q("What anchors the foreground?", { "Signal rig", "Red lamp, patched cable, handwritten frequency dial." }, { "Supply cases", "Build a practical wall of expedition gear." }, { "Weather station", "Lead with the incoming storm data." }),
			q("How do you show nine days of work?", { "Layered traces", "Old cups, shifted stones, fresh tape over worn labels." }, { "Heavy damage", "Break equipment and cover everything in dust." }, { "Keep it clean", "Let the performance carry the history." }),
			q("Which practical light survives dusk?", { "Single red lamp", "Preserve night vision and isolate the rig." }, { "White work floods", "Keep every prop clearly readable." }, { "String lights", "Add a warm human counterpoint." }),
		},
	},
	{
		id = "writer-sunday", role = "Writer", symbol = "WRT", color = Color3.fromRGB(135, 169, 255),
		title = "Dinner scene polish", project = "Sunday in Orbit", fee = 190, rep = 11, requirement = 0,
		brief = "Two maintenance workers are eating the first salad grown on station. It should be funny because they refuse to admit how much the moment means.",
		questions = {
			q("What starts the scene?", { "A bad first bite", "One leaf is far more bitter than expected." }, { "A station alarm", "Interrupt the meal with immediate danger." }, { "A long speech", "Explain the greenhouse program's history." }),
			q("Where is the emotion hidden?", { "In the recipe", "They argue about dressing instead of naming home." }, { "In a confession", "One worker openly describes missing Earth." }, { "In the window", "Both stare silently at the planet." }),
			q("How does the scene turn?", { "They save a leaf", "A tiny practical gesture admits the achievement." }, { "The crop fails", "Convert the scene into a setback." }, { "A visitor arrives", "Add a third voice to lift the pace." }),
		},
	},
	{
		id = "drone-glass", role = "Drone Op", symbol = "DRN", color = Color3.fromRGB(72, 197, 173),
		title = "Floodway pursuit", project = "Glass River", fee = 230, rep = 12, requirement = 52,
		brief = "Follow the skiff through a narrow flooded avenue. The shot must reveal the blocked bridge without losing the performer against the city scale.",
		questions = {
			q("Choose the flight line.", { "Low parallel", "Track just above water and arc toward the bridge." }, { "High overhead", "Map the whole route in one clean plan view." }, { "Lead backward", "Face the performer while retreating at speed." }),
			q("Where is the reveal?", { "After the second lamp", "Use a building edge to wipe on the bridge." }, { "At frame one", "Establish the obstacle immediately." }, { "At the final cut", "Hide the geography until the last beat." }),
			q("How do you hold the performer?", { "Lower third", "Let the architecture dominate without losing scale." }, { "Dead center", "Lock tracking and minimize visual drift." }, { "Edge of frame", "Make the pursuit feel unstable and dangerous." }),
		},
	},
	{
		id = "camera-asterion", role = "Videographer", symbol = "CAM", color = Color3.fromRGB(215, 246, 90),
		title = "Dish array master", project = "Asterion Signal", fee = 250, rep = 13, requirement = 58,
		brief = "The landscape should dwarf the scientist, but the red receiver lamp needs to register before the storm swallows the sun.",
		questions = {
			q("Choose a lens strategy.", { "Wide and close", "Hold the scientist low while dishes tower behind." }, { "Long compression", "Stack the dishes and flatten the desert." }, { "Portrait prime", "Isolate the scientist from the array." }),
			q("How does the frame move?", { "Slow lateral creep", "Let each dish reveal the next." }, { "Locked tripod", "Use only performance and weather." }, { "Fast push-in", "Announce the signal as a thriller beat." }),
			q("Where do you cut?", { "On the red pulse", "Give the editor a precise visual hinge." }, { "Before the pulse", "Build anticipation into the next angle." }, { "After the reaction", "Play the discovery entirely in the master." }),
		},
	},
	{
		id = "vfx-orbit", role = "VFX Artist", symbol = "VFX", color = Color3.fromRGB(191, 139, 255),
		title = "Orbital window composite", project = "Sunday in Orbit", fee = 300, rep = 15, requirement = 72,
		brief = "The window is emotional punctuation, not spectacle. Preserve the warm practical reflections and keep Earth slightly soft behind the performers.",
		questions = {
			q("How sharp is Earth?", { "Just below focus", "Keep attention on the workers at the table." }, { "Tack sharp", "Sell the orbital scale with maximum detail." }, { "Abstract blur", "Reduce the planet to cool color and shape." }),
			q("What happens to reflections?", { "Preserve and shape", "Roto only what blocks faces and eyelines." }, { "Remove all", "Create a perfectly clean view through glass." }, { "Double them", "Make the greenhouse feel denser and warmer." }),
			q("How visible is the station drift?", { "Barely perceptible", "A slow horizon roll rewards close viewing." }, { "Static plate", "Keep the final completely stable." }, { "Fast orbit", "Use movement to lift the scene's energy." }),
		},
	},
}

GameData.GigById = {}
for _, gig in ipairs(GameData.Gigs) do
	GameData.GigById[gig.id] = gig
end

GameData.Genres = { "Sci-Fi", "Mystery", "Comedy-Drama" }
GameData.GenreCrewDemand = {
	["Sci-Fi"] = { "Drone Op", "VFX Artist" },
	["Mystery"] = { "Drone Op" },
	["Comedy-Drama"] = { "Videographer" },
}
GameData.CrewRates = {
	{ role = "Drone Op", cost = 130, sourceGig = "drone-glass" },
	{ role = "Videographer", cost = 110, sourceGig = "camera-asterion" },
	{ role = "VFX Artist", cost = 160, sourceGig = "vfx-orbit" },
}
GameData.Budgets = { { cost = 420, bonus = 6, label = "Lean" }, { cost = 650, bonus = 10, label = "Standard" }, { cost = 900, bonus = 14, label = "Premium" } }
GameData.DIRECTOR_REP = 60
GameData.MIN_BUDGET = 420

local function stage(name, short, prompt, options)
	return { name = name, short = short, prompt = prompt, options = options }
end
local function opt(title, detail, effect, fits)
	return { title = title, detail = detail, effect = effect, fits = fits }
end

GameData.ProductionStages = {
	stage("Pre-production", "Prep", "Choose the idea the whole production will organize around.", {
		opt("One practical landmark", "Build a tactile centerpiece and let the world extend around it.", 8, { "Sci-Fi", "Mystery" }),
		opt("Performance first", "Keep the footprint small and spend time on rehearsal.", 7, { "Comedy-Drama", "Mystery" }),
		opt("Maximal world build", "Fill every frame with new locations, props, and motion.", 4, { "Sci-Fi" }),
	}),
	stage("Principal photography", "Shoot", "Set the camera language for the production.", {
		opt("Patient wides", "Let blocking and production design carry the cut.", 7, { "Mystery", "Comedy-Drama" }),
		opt("Motivated movement", "Move only when a character makes a decision.", 8, { "Sci-Fi", "Comedy-Drama" }),
		opt("Restless coverage", "Gather aggressive angles and find the rhythm in edit.", 4, { "Sci-Fi" }),
	}),
	stage("Post-production", "Post", "Decide how visible the generated finish should feel.", {
		opt("Invisible finish", "Polish continuity, atmosphere, and small physical detail.", 8, { "Mystery", "Comedy-Drama" }),
		opt("One impossible shot", "Concentrate the VFX budget on a single memorable beat.", 8, { "Sci-Fi", "Mystery" }),
		opt("Transform every frame", "Push color, effects, and environments to maximum intensity.", 3, { "Sci-Fi" }),
	}),
	stage("Distribution", "Release", "Choose how the audience first meets the film.", {
		opt("Live premiere", "Bring cast and crew into one high-attention launch window.", 8, { "Sci-Fi", "Mystery" }),
		opt("Quiet catalog drop", "Let completion rate and word of mouth build steadily.", 7, { "Comedy-Drama" }),
		opt("Wide push", "Buy the largest opening audience before reviews settle.", 4, { "Sci-Fi" }),
	}),
}

GameData.BaseFilms = {
	{ id = "glass-river", title = "Glass River", genre = "Sci-Fi", score = 91, views = 184000, creator = "Northlight Unit" },
	{ id = "asterion-signal", title = "Asterion Signal", genre = "Mystery", score = 87, views = 119000, creator = "Far Field House" },
	{ id = "sunday-orbit", title = "Sunday in Orbit", genre = "Comedy-Drama", score = 94, views = 263000, creator = "Soft Landing Co." },
}

-- Timing minigame cues per role (3 cues per gig, like the web version).
GameData.ShootCues = {
	["Actor"] = { "Find the eyeline", "Catch the turn", "Land the line" },
	["Set Crew"] = { "Place the hero prop", "Dress the edges", "Kill the spill" },
	["Writer"] = { "Cut the setup", "Hide the feeling", "Button the scene" },
	["Drone Op"] = { "Launch clean", "Hit the reveal", "Hold the lower third" },
	["Videographer"] = { "Set the frame", "Creep the lateral", "Cut on the pulse" },
	["VFX Artist"] = { "Soften the plate", "Shape reflections", "Lock the drift" },
}

function GameData.Rank(rep)
	if rep >= 90 then return { name = "Producer", tier = "T4", nextRep = nil } end
	if rep >= 60 then return { name = "Director", tier = "T3", nextRep = 90 } end
	if rep >= 50 then return { name = "Specialist", tier = "T2", nextRep = 60 } end
	return { name = "Crew Pool", tier = "T1", nextRep = 50 }
end

function GameData.HasFlopStigma(profile)
	return profile.lastReleaseScore > 0 and profile.lastReleaseScore < 50
end

-- Same formula as app.js completeGig().
function GameData.ScoreGig(gig, answers, timing, stigma)
	local correct = 0
	for i, question in ipairs(gig.questions) do
		if answers[i] == question.answer then correct += 1 end
	end
	local creative = 34 + correct * 22
	local sum = 0
	for _, t in ipairs(timing) do sum += t end
	local timingScore = math.floor(sum / math.max(1, #timing) + 0.5)
	local score = math.floor(creative * 0.65 + timingScore * 0.35 + 0.5)
	local credits = math.max(35, math.floor(gig.fee * (0.6 + score / 125) * (stigma and 0.75 or 1) + 0.5))
	local rep = score < 50 and -4 or gig.rep + math.floor(score / 25 + 0.5)
	return { score = score, creative = creative, timing = timingScore, credits = credits, rep = rep }
end

function GameData.MissingSpecialists(production)
	local missing = {}
	for _, role in ipairs(GameData.GenreCrewDemand[production.genre] or {}) do
		local hired = false
		for _, member in ipairs(production.crew) do
			if member.role == role then hired = true end
		end
		if not hired then table.insert(missing, role) end
	end
	return missing
end

-- Same formula as app.js releaseProduction().
function GameData.ScoreRelease(production)
	local crewQuality = 0
	if #production.crew > 0 then
		local total = 0
		for _, member in ipairs(production.crew) do total += member.score end
		crewQuality = total / (#production.crew * 12)
	end
	local missing = #GameData.MissingSpecialists(production)
	local score = math.clamp(math.floor(production.quality + crewQuality + 5 - missing * 10 + 0.5), 30, 97)
	local flop = score < 50
	local gross = math.floor(production.budget * (flop and 0.18 or (0.35 + (score / 100) * 0.75)) + 0.5)
	local crewResiduals = math.min(gross, math.floor(gross * 0.2 + 0.5))
	local repDelta = flop and -8 or (score >= 85 and 14 or (score >= 72 and 9 or 3))
	return {
		score = score, flop = flop, gross = gross, crewResiduals = crewResiduals,
		net = gross - crewResiduals, repDelta = repDelta,
		baseYield = flop and 0 or math.max(15, math.floor(gross * 0.08 + 0.5)),
		views = 2600 + score * (flop and 40 or 175),
	}
end

return GameData
