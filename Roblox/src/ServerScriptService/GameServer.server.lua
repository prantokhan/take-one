--[[
  GameServer — the authoritative Take One career loop on Roblox.

  Port of the browser game's economy (app.js): gigs -> credits/reputation,
  Director at 60 rep + 420 cr, Greenlight -> four stage decisions ->
  release -> per-cycle residuals, flop stigma. The client only asks; every
  number is recomputed here from GameData so it can't be spoofed beyond
  the timing minigame (which is clamped and rate-limited).

  Remotes (created here if the Rojo project didn't already):
    Remotes.GameAction   RemoteFunction  (action, payload) -> { ok, message, result, state }
    Remotes.StateChanged RemoteEvent     server -> client push of the profile

  Saves: DataStore "TakeOneProfiles_v1", keyed by UserId. In Studio without
  API access (or if the DataStore errors) profiles still work in memory for
  the session — they just don't persist.

  Render backend (for the GPU Unreal render servers later): set the
  attribute RenderBackendUrl on this script, e.g. "https://render.example.com",
  and enable Game Settings > Security > Allow HTTP Requests. Every released
  film then POSTs a job to {url}/v1/jobs using the same contract as the
  Node adapter (prompt, film_id, cast_count). Empty = off.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")

local GameData = require(ReplicatedStorage.Modules.GameData)

local remotes = ReplicatedStorage:FindFirstChild("Remotes") or Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage

local function ensureRemote(className, name)
	local existing = remotes:FindFirstChild(name)
	if existing then return existing end
	local remote = Instance.new(className)
	remote.Name = name
	remote.Parent = remotes
	return remote
end

local GameAction = ensureRemote("RemoteFunction", "GameAction")
local StateChanged = ensureRemote("RemoteEvent", "StateChanged")

local store
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore("TakeOneProfiles_v1")
	end)
	store = ok and result or nil
end

local profiles = {} -- [Player] = profile
local gigStarts = {} -- [Player] = { gigId, time }

local function newProfile()
	return {
		credits = GameData.START.credits,
		reputation = GameData.START.reputation,
		cycle = GameData.START.cycle,
		completedGigs = {},
		bestTakes = {},
		production = nil,
		releases = {},
		lastReleaseScore = 0,
		promptCycle = -1,
		activity = { "You joined the Take One crew pool." },
	}
end

local function addActivity(profile, text)
	table.insert(profile.activity, 1, text)
	while #profile.activity > 8 do table.remove(profile.activity) end
end

local function loadProfile(player)
	local profile = newProfile()
	if store then
		local ok, data = pcall(function()
			return store:GetAsync(tostring(player.UserId))
		end)
		if ok and type(data) == "table" then
			for key, value in pairs(data) do profile[key] = value end
		end
	end
	return profile
end

local function saveProfile(player)
	local profile = profiles[player]
	if not (store and profile) then return end
	pcall(function()
		store:SetAsync(tostring(player.UserId), profile)
	end)
end

local function updateLeaderstats(player)
	local profile = profiles[player]
	local stats = player:FindFirstChild("leaderstats")
	if not (profile and stats) then return end
	stats.Credits.Value = profile.credits
	stats.Rep.Value = profile.reputation
	stats.Rank.Value = GameData.Rank(profile.reputation).name
end

local function push(player)
	updateLeaderstats(player)
	StateChanged:FireClient(player, profiles[player])
end

local function isCompleted(profile, gigId)
	return table.find(profile.completedGigs, gigId) ~= nil
end

-- ------------------------------------------------------------------
-- Render backend bridge (future GPU Unreal render servers)
-- ------------------------------------------------------------------

local function composeSetPrompt(production)
	local moods = {
		["Sci-Fi"] = "a rain-soaked futuristic city at night with neon signs and a landing pad",
		["Mystery"] = "a foggy harbor at dawn with an old warehouse and a lone signal lamp",
		["Comedy-Drama"] = "a warm diner interior at night with a central table and pendant lamps",
	}
	return string.format("Key set for %s: %s", production.title, moods[production.genre] or "an original film set")
end

local function requestRender(production)
	local base = script:GetAttribute("RenderBackendUrl")
	if type(base) ~= "string" or base == "" then return nil end
	local ok, response = pcall(function()
		return HttpService:PostAsync(
			base:gsub("/+$", "") .. "/v1/jobs",
			HttpService:JSONEncode({ prompt = composeSetPrompt(production), film_id = production.id, cast_count = 2, source = "roblox" }),
			Enum.HttpContentType.ApplicationJson
		)
	end)
	if not ok then
		warn("[TakeOne] render backend unreachable: " .. tostring(response))
		return nil
	end
	local decoded = HttpService:JSONDecode(response)
	return decoded and decoded.id
end

-- ------------------------------------------------------------------
-- Actions
-- ------------------------------------------------------------------

local Actions = {}

function Actions.GetState(player, profile)
	return true, nil
end

function Actions.StartGig(player, profile, payload)
	local gig = GameData.GigById[payload and payload.gigId]
	if not gig then return false, "Unknown gig." end
	if isCompleted(profile, gig.id) then return false, "You already wrapped this gig. Post new calls at the Crew Board." end
	if profile.reputation < gig.requirement then return false, string.format("Reach %d reputation to take this call.", gig.requirement) end
	gigStarts[player] = { gigId = gig.id, time = os.clock() }
	return true, nil
end

function Actions.CompleteGig(player, profile, payload)
	local started = gigStarts[player]
	local gig = GameData.GigById[payload and payload.gigId]
	if not (gig and started and started.gigId == gig.id) then return false, "Start the gig at the Crew Board first." end
	-- Anti-spam: a real brief + three timing cues takes a few seconds.
	if os.clock() - started.time < 4 then return false, "Too fast. Read the brief first." end
	gigStarts[player] = nil
	if isCompleted(profile, gig.id) then return false, "Already wrapped." end

	local answers, timing = {}, {}
	for i = 1, #gig.questions do
		answers[i] = tonumber(payload.answers and payload.answers[i]) or 0
	end
	for i = 1, 3 do
		timing[i] = math.clamp(tonumber(payload.timing and payload.timing[i]) or 0, 0, 100)
	end
	local result = GameData.ScoreGig(gig, answers, timing, GameData.HasFlopStigma(profile))
	profile.credits += result.credits
	profile.reputation = math.max(0, profile.reputation + result.rep)
	table.insert(profile.completedGigs, gig.id)
	profile.bestTakes[gig.id] = math.max(profile.bestTakes[gig.id] or 0, result.score)
	addActivity(profile, string.format("%s: %s take scored %d.", gig.project, gig.role, result.score))
	return true, nil, result
end

function Actions.RefreshBoard(player, profile)
	if #profile.completedGigs == 0 then return false, "The board is still full of open calls." end
	if profile.credits < 40 then return false, "Posting new calls costs 40 credits." end
	profile.credits -= 40
	profile.completedGigs = {}
	addActivity(profile, "A fresh public call sheet was posted.")
	return true, "New calls posted on the Crew Board."
end

function Actions.Greenlight(player, profile, payload)
	if profile.reputation < GameData.DIRECTOR_REP then return false, "Director unlocks at 60 reputation." end
	if profile.production and not profile.production.released then return false, "Finish your active production first." end
	payload = type(payload) == "table" and payload or {}
	local title = tostring(payload.title or ""):gsub("^%s+", ""):gsub("%s+$", ""):sub(1, 36)
	if #title == 0 then return false, "Give the film a working title." end
	local genre = table.find(GameData.Genres, payload.genre) and payload.genre or nil
	if not genre then return false, "Pick a genre." end
	local budget
	for _, option in ipairs(GameData.Budgets) do
		if option.cost == tonumber(payload.budget) then budget = option end
	end
	if not budget then return false, "Pick a budget." end

	local crew, crewCost = {}, 0
	for _, rate in ipairs(GameData.CrewRates) do
		if type(payload.crew) == "table" and table.find(payload.crew, rate.role) then
			table.insert(crew, { role = rate.role, cost = rate.cost, score = profile.bestTakes[rate.sourceGig] or 55 })
			crewCost += rate.cost
		end
	end
	if budget.cost + crewCost > profile.credits then
		return false, string.format("Budget plus crew (%d cr) is more than your %d cr.", budget.cost + crewCost, profile.credits)
	end

	-- Text players type is shown to others (catalog), so it must be filtered.
	local filtered = title
	local ok, result = pcall(function()
		local TextService = game:GetService("TextService")
		return TextService:FilterStringAsync(title, player.UserId):GetNonChatStringForBroadcastAsync()
	end)
	if ok and result then filtered = result end

	profile.credits -= budget.cost + crewCost
	profile.production = {
		id = string.format("rbx-%d-%d", player.UserId, os.time()),
		title = filtered, genre = genre, budget = budget.cost, crewCost = crewCost, crew = crew,
		quality = 42 + budget.bonus, stage = 0, decisions = {}, released = false,
	}
	addActivity(profile, string.format("%s was greenlit for %d credits.", filtered, budget.cost))
	return true, string.format("\"%s\" is greenlit. Head to Soundstage 1.", filtered)
end

function Actions.StageDecision(player, profile, payload)
	local production = profile.production
	if not production or production.released then return false, "No active production." end
	local stage = GameData.ProductionStages[production.stage + 1]
	local choice = stage and stage.options[tonumber(payload and payload.option) or 0]
	if not choice then return false, "Pick an option." end
	local fit = (choice.effect >= 7 and table.find(choice.fits, production.genre)) and 2 or 0
	production.quality += choice.effect + fit
	table.insert(production.decisions, { stage = stage.name, choice = choice.title, impact = choice.effect + fit })
	production.stage += 1
	addActivity(profile, string.format("%s: %s decision locked.", production.title, stage.short))

	if production.stage < #GameData.ProductionStages then
		return true, stage.short .. " locked. The next department is ready."
	end

	-- Release.
	local release = GameData.ScoreRelease(production)
	production.released = true
	production.score = release.score
	profile.credits += release.net
	profile.reputation = math.max(0, profile.reputation + release.repDelta)
	profile.lastReleaseScore = release.score
	table.insert(profile.releases, 1, {
		id = production.id, title = production.title, genre = production.genre, score = release.score,
		views = release.views, baseYield = release.baseYield, creator = player.DisplayName,
		renderJob = requestRender(production),
	})
	addActivity(profile, string.format("%s premiered at %d: gross %d cr, %d cr to you.", production.title, release.score, release.gross, release.net))
	return true, release.flop and "The film flopped. Crews will be cautious." or "Premiere! Your film is in the Cinema.", release
end

function Actions.NewProject(player, profile)
	if profile.production and not profile.production.released then return false, "Your film is still in production." end
	profile.production = nil
	return true, nil
end

function Actions.EndCycle(player, profile)
	profile.cycle += 1
	local residuals = 0
	for _, film in ipairs(profile.releases) do
		if film.score >= 65 then
			film.views = math.floor(film.views * (film.score >= 80 and 1.22 or 1.08))
			local amount = math.floor(film.baseYield * (film.score >= 80 and 1.2 or 1) + 0.5)
			profile.credits += amount
			residuals += amount
		else
			film.views = math.floor(film.views * 0.94)
		end
	end
	local message = residuals > 0 and string.format("Cycle %d: +%d cr residuals.", profile.cycle, residuals)
		or string.format("Cycle %d: no residuals yet. Release a film that scores 65+.", profile.cycle)
	addActivity(profile, message)
	return true, message, { residuals = residuals }
end

-- A small once-per-cycle creative fee for prompting the world (same as web).
function Actions.PromptFee(player, profile)
	if profile.promptCycle == profile.cycle then return true, nil end
	profile.promptCycle = profile.cycle
	profile.credits += 2
	return true, "+2 cr creative direction fee."
end

local lastCall = {}
GameAction.OnServerInvoke = function(player, action, payload)
	local profile = profiles[player]
	local handler = Actions[action]
	if not (profile and handler) then
		return { ok = false, message = "Not ready yet." }
	end
	local now = os.clock()
	if action ~= "GetState" and lastCall[player] and now - lastCall[player] < 0.25 then
		return { ok = false, message = "Slow down.", state = profile }
	end
	lastCall[player] = now
	local ok, okResult, message, result = pcall(handler, player, profile, payload)
	if not ok then
		warn("[TakeOne] action " .. tostring(action) .. " failed: " .. tostring(okResult))
		return { ok = false, message = "Something went wrong.", state = profile }
	end
	updateLeaderstats(player)
	return { ok = okResult, message = message, result = result, state = profile }
end

-- ------------------------------------------------------------------
-- Player lifecycle
-- ------------------------------------------------------------------

local function onPlayerAdded(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local credits = Instance.new("IntValue")
	credits.Name = "Credits"
	credits.Parent = stats
	local rep = Instance.new("IntValue")
	rep.Name = "Rep"
	rep.Parent = stats
	local rank = Instance.new("StringValue")
	rank.Name = "Rank"
	rank.Parent = stats
	stats.Parent = player

	profiles[player] = loadProfile(player)
	push(player)
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, player)
end

Players.PlayerRemoving:Connect(function(player)
	saveProfile(player)
	profiles[player] = nil
	gigStarts[player] = nil
	lastCall[player] = nil
end)

game:BindToClose(function()
	for _, player in ipairs(Players:GetPlayers()) do
		saveProfile(player)
	end
end)

task.spawn(function()
	while true do
		task.wait(60)
		for _, player in ipairs(Players:GetPlayers()) do
			saveProfile(player)
		end
	end
end)
