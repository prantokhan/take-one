--[[
  TakeOneHud — the whole Take One game UI on Roblox. There are no menus or
  dashboards: a stats bar + objective live on screen, and every building's
  door ProximityPrompt (built by LotBuilder) opens a panel for that place.

    CREW BOARD    gigs: brief quiz -> 3-cue timing minigame -> take report
    SOUNDSTAGE 1  greenlight a film, then lock its 4 stage decisions -> release
    CINEMA        your releases + the house catalog
    PROP HOUSE    your portfolio of best takes
    FRONT OFFICE  career progress, activity, End cycle (residuals)
    WORLD TOWER   opens the Prompt-the-world console (PromptGui)

  All actions go through Remotes.GameAction; the server (GameServer) owns
  the numbers, this script only draws them.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ProximityPromptService = game:GetService("ProximityPromptService")
local TweenService = game:GetService("TweenService")

local GameData = require(ReplicatedStorage:WaitForChild("Modules"):WaitForChild("GameData"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local GameAction = Remotes:WaitForChild("GameAction")
local StateChanged = Remotes:WaitForChild("StateChanged")

local player = Players.LocalPlayer
local state = nil

local C = {
	ink = Color3.fromRGB(16, 18, 16), ink2 = Color3.fromRGB(28, 32, 29), ink3 = Color3.fromRGB(40, 45, 41),
	paper = Color3.fromRGB(242, 240, 233), muted = Color3.fromRGB(157, 163, 157),
	acid = Color3.fromRGB(215, 246, 90), coral = Color3.fromRGB(255, 113, 101), teal = Color3.fromRGB(72, 197, 173),
}

-- ------------------------------------------------------------------
-- UI helpers
-- ------------------------------------------------------------------

local function make(className, props, children)
	local inst = Instance.new(className)
	for key, value in pairs(props or {}) do
		if key ~= "Parent" then inst[key] = value end
	end
	for _, child in ipairs(children or {}) do child.Parent = inst end
	if props and props.Parent then inst.Parent = props.Parent end
	return inst
end

local function corner(radius) return make("UICorner", { CornerRadius = UDim.new(0, radius or 8) }) end
local function pad(px) return make("UIPadding", { PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px), PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px) }) end

local function label(text, size, color, props)
	local p = {
		Text = text, TextSize = size or 16, TextColor3 = color or C.paper, Font = Enum.Font.GothamMedium,
		BackgroundTransparency = 1, TextWrapped = true, TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
	}
	for k, v in pairs(props or {}) do p[k] = v end
	return make("TextLabel", p)
end

local function button(text, primary, onClick, props)
	local p = {
		Text = text, TextSize = 16, Font = Enum.Font.GothamBold, AutoButtonColor = true,
		TextColor3 = primary and C.ink or C.paper, BackgroundColor3 = primary and C.acid or C.ink3,
		Size = UDim2.new(1, 0, 0, 42), TextWrapped = true,
	}
	for k, v in pairs(props or {}) do p[k] = v end
	local b = make("TextButton", p, { corner(8) })
	if onClick then b.MouseButton1Click:Connect(onClick) end
	return b
end

local gui = make("ScreenGui", { Name = "TakeOneHud", ResetOnSpawn = false, IgnoreGuiInset = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Parent = player:WaitForChild("PlayerGui") })

-- Stats bar (top right)
local statsBar = make("Frame", { Size = UDim2.new(0, 360, 0, 54), Position = UDim2.new(1, -372, 0, 10), BackgroundColor3 = C.ink, BackgroundTransparency = 0.15, Parent = gui }, {
	corner(12), pad(8),
	make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 12), VerticalAlignment = Enum.VerticalAlignment.Center }),
})
local function stat(name)
	local frame = make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0, 80, 1, 0), Parent = statsBar })
	label(name:upper(), 11, C.muted, { Parent = frame, Font = Enum.Font.GothamBold })
	return label("-", 20, C.paper, { Parent = frame, Position = UDim2.new(0, 0, 0, 14), Font = Enum.Font.GothamBlack })
end
local creditsText, repText, rankText, cycleText = stat("Credits"), stat("Reputation"), stat("Rank"), stat("Cycle")

-- Objective (top left)
local objective = make("Frame", { Size = UDim2.new(0, 380, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Position = UDim2.new(0, 12, 0, 10), BackgroundColor3 = C.ink, BackgroundTransparency = 0.15, Parent = gui }, {
	corner(12), pad(10), make("UIStroke", { Color = C.acid, Thickness = 1.5 }),
	make("UIListLayout", { Padding = UDim.new(0, 2) }),
})
label("OBJECTIVE", 11, C.acid, { Parent = objective, Font = Enum.Font.GothamBlack })
local objectiveText = label("Loading your career...", 16, C.paper, { Parent = objective, Font = Enum.Font.GothamBold })

-- Toasts (bottom center)
local toastHolder = make("Frame", { Size = UDim2.new(0, 460, 0, 200), Position = UDim2.new(0.5, -230, 1, -290), BackgroundTransparency = 1, Parent = gui }, {
	make("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, HorizontalAlignment = Enum.HorizontalAlignment.Center, Padding = UDim.new(0, 6) }),
})
local function toast(text)
	if not text or text == "" then return end
	local t = label(text, 16, C.ink, { Parent = toastHolder, BackgroundTransparency = 0, BackgroundColor3 = C.paper, TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold })
	corner(10).Parent = t
	pad(10).Parent = t
	task.delay(3.6, function() t:Destroy() end)
end

-- Back to lot (bottom right, only shown while on a generated set)
local backButton = button("Back to the lot", true, function()
	Remotes:WaitForChild("ReturnToLot"):FireServer()
end, { Parent = gui, Size = UDim2.new(0, 180, 0, 44), Position = UDim2.new(1, -192, 1, -120), Visible = false })

-- Panel (center)
local overlay = make("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, Visible = false, ZIndex = 5, Parent = gui })
local panel = make("Frame", { Size = UDim2.new(0.9, 0, 0.82, 0), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = C.ink, ZIndex = 6, Parent = overlay }, {
	corner(14), make("UISizeConstraint", { MaxSize = Vector2.new(720, 640) }), make("UIStroke", { Color = C.ink3, Thickness = 1 }),
})
local panelEyebrow = label("", 12, C.acid, { Parent = panel, Position = UDim2.new(0, 20, 0, 16), Size = UDim2.new(1, -80, 0, 16), AutomaticSize = Enum.AutomaticSize.None, Font = Enum.Font.GothamBlack, ZIndex = 7 })
local panelTitle = label("", 24, C.paper, { Parent = panel, Position = UDim2.new(0, 20, 0, 34), Size = UDim2.new(1, -80, 0, 30), AutomaticSize = Enum.AutomaticSize.None, Font = Enum.Font.GothamBlack, ZIndex = 7 })
local closeButton = button("X", false, nil, { Parent = panel, Size = UDim2.new(0, 40, 0, 40), Position = UDim2.new(1, -56, 0, 16), ZIndex = 7 })
local body = make("ScrollingFrame", {
	Parent = panel, Position = UDim2.new(0, 16, 0, 78), Size = UDim2.new(1, -32, 1, -94), BackgroundTransparency = 1,
	CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 6, BorderSizePixel = 0, ZIndex = 7,
})
make("UIListLayout", { Parent = body, Padding = UDim.new(0, 10), SortOrder = Enum.SortOrder.LayoutOrder })
make("UIPadding", { Parent = body, PaddingRight = UDim.new(0, 10) })

local panelOpen = false
local panelCleanup = nil

local function clearBody()
	if panelCleanup then panelCleanup(); panelCleanup = nil end
	for _, child in ipairs(body:GetChildren()) do
		if not child:IsA("UIListLayout") and not child:IsA("UIPadding") then child:Destroy() end
	end
end

local function openPanel(eyebrow, title)
	clearBody()
	panelEyebrow.Text = eyebrow:upper()
	panelTitle.Text = title
	overlay.Visible = true
	panelOpen = true
	body.CanvasPosition = Vector2.zero
end

local function closePanel()
	clearBody()
	overlay.Visible = false
	panelOpen = false
end
closeButton.MouseButton1Click:Connect(closePanel)

-- Keep the cursor free while a panel is open (first-person mode locks it).
RunService:BindToRenderStep("TakeOnePanelMouse", Enum.RenderPriority.Camera.Value + 1, function()
	if panelOpen then
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default
		UserInputService.MouseIconEnabled = true
	end
end)

local function add(inst, order)
	inst.LayoutOrder = order or #body:GetChildren()
	inst.Parent = body
	return inst
end

local function card(children)
	return make("Frame", { BackgroundColor3 = C.ink2, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y }, {
		corner(10), pad(12), make("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }), table.unpack(children),
	})
end

-- ------------------------------------------------------------------
-- State + objective
-- ------------------------------------------------------------------

local function isCompleted(gigId)
	return state and table.find(state.completedGigs, gigId) ~= nil
end

local function availableGigs()
	local list = {}
	if not state then return list end
	for _, gig in ipairs(GameData.Gigs) do
		if not isCompleted(gig.id) and state.reputation >= gig.requirement then table.insert(list, gig) end
	end
	return list
end

local function objectiveFor()
	if not state then return "Loading..." end
	local p = state.production
	if p and not p.released then
		local stage = GameData.ProductionStages[p.stage + 1]
		return "Soundstage 1: " .. (stage and ("lock the " .. stage.short:lower() .. " decision") or "finish the film")
	end
	if p and p.released then return "\"" .. p.title .. "\" is out! End the cycle at the Front Office for residuals" end
	if state.reputation >= 60 and state.credits >= 420 then return "Soundstage 1: greenlight your first film" end
	if #availableGigs() > 0 then
		local need = state.reputation >= 60 and string.format("%d more credits", 420 - state.credits) or string.format("%d more reputation", 60 - state.reputation)
		return "Crew Board: take a gig (" .. need .. " to direct)"
	end
	return "Front Office: end the cycle, or post new calls at the Crew Board"
end

local function render()
	if not state then return end
	local rank = GameData.Rank(state.reputation)
	creditsText.Text = tostring(state.credits)
	repText.Text = tostring(state.reputation)
	rankText.Text = rank.tier
	cycleText.Text = tostring(state.cycle)
	objectiveText.Text = objectiveFor()
end

local function act(action, payload)
	local response = GameAction:InvokeServer(action, payload)
	if response and response.state then state = response.state; render() end
	if response and response.message then toast(response.message) end
	return response or { ok = false }
end

StateChanged.OnClientEvent:Connect(function(newState) state = newState; render() end)
task.spawn(function() act("GetState") end)
-- PromptGui pays the prompt fee directly; refresh when leaderstats move.
task.spawn(function()
	local stats = player:WaitForChild("leaderstats")
	stats:WaitForChild("Credits").Changed:Connect(function()
		if not panelOpen then act("GetState") end
	end)
end)

-- ------------------------------------------------------------------
-- Crew Board: gigs
-- ------------------------------------------------------------------

local openBoard -- forward

local function shuffledOrder(n, seed)
	local order = {}
	for i = 1, n do order[i] = i end
	local rng = Random.new(seed)
	for i = n, 2, -1 do
		local j = rng:NextInteger(1, i)
		order[i], order[j] = order[j], order[i]
	end
	return order
end

local function runTiming(gig, answers)
	openPanel(gig.project .. " / " .. gig.role, "Hit your marks")
	local cues = GameData.ShootCues[gig.role] or { "Mark one", "Mark two", "Mark three" }
	local scores = {}
	local cueIndex = 1
	local cueLabel = add(label("", 20, C.paper, { Font = Enum.Font.GothamBlack, TextXAlignment = Enum.TextXAlignment.Center }))
	add(label("Press SPACE (or tap HIT) when the marker is inside the green zone.", 14, C.muted, { TextXAlignment = Enum.TextXAlignment.Center }))
	local bar = add(make("Frame", { Size = UDim2.new(1, 0, 0, 46), BackgroundColor3 = C.ink3 }, { corner(8) }))
	local zone = make("Frame", { Size = UDim2.new(0.14, 0, 1, 0), BackgroundColor3 = C.teal, BackgroundTransparency = 0.2, Parent = bar }, { corner(6) })
	local marker = make("Frame", { Size = UDim2.new(0, 6, 1, 12), Position = UDim2.new(0, 0, 0, -6), BackgroundColor3 = C.paper, Parent = bar })
	local resultLabel = add(label("", 16, C.acid, { TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold }))
	local rng = Random.new()
	local zoneCenter, t, speed = 0.5, 0, 1.6
	local busy = false

	local function nextCue()
		cueLabel.Text = string.format("Cue %d/3: %s", cueIndex, cues[cueIndex])
		zoneCenter = rng:NextNumber(0.2, 0.8)
		speed = 1.4 + cueIndex * 0.45
		zone.Position = UDim2.new(zoneCenter - 0.07, 0, 0, 0)
	end
	nextCue()

	local finished = false
	local function finish()
		if finished then return end
		finished = true
		local response = act("CompleteGig", { gigId = gig.id, answers = answers, timing = scores })
		if not response.ok then return openBoard() end
		local r = response.result
		openPanel("Take report / " .. gig.project, r.score >= 78 and "The director keeps the take." or r.score >= 56 and "Usable, with notes." or "The brief slipped.")
		add(label(tostring(r.score), 64, C.acid, { TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBlack }))
		add(label(string.format("Brief %d   /   Execution %d", r.creative, r.timing), 16, C.muted, { TextXAlignment = Enum.TextXAlignment.Center }))
		add(label(string.format("+%d credits    %s%d reputation", r.credits, r.rep >= 0 and "+" or "", r.rep), 20, C.paper, { TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold }))
		add(button("Back to the board", true, function() openBoard() end))
	end

	local function hit()
		if busy or finished then return end
		local pos = (math.sin(t * speed) + 1) / 2
		local d = math.abs(pos - zoneCenter)
		local score = d <= 0.07 and math.floor(100 - (d / 0.07) * 15) or math.max(20, math.floor(85 - (d - 0.07) * 260))
		table.insert(scores, score)
		resultLabel.Text = score >= 90 and ("Perfect! " .. score) or score >= 70 and ("Good. " .. score) or ("Off the mark. " .. score)
		busy = true
		task.delay(0.6, function()
			busy = false
			cueIndex += 1
			if cueIndex > 3 then finish() else nextCue() end
		end)
	end
	add(button("HIT", true, hit, { Size = UDim2.new(1, 0, 0, 56), TextSize = 22 }))

	local conn = RunService.RenderStepped:Connect(function(dt)
		if not busy then t += dt end
		marker.Position = UDim2.new((math.sin(t * speed) + 1) / 2, -3, 0, -6)
	end)
	local keyConn = UserInputService.InputBegan:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.Space or input.KeyCode == Enum.KeyCode.ButtonA then hit() end
	end)
	-- Stop Space from also making the character jump during the minigame.
	local ContextActionService = game:GetService("ContextActionService")
	ContextActionService:BindActionAtPriority("TakeOneTiming", function() return Enum.ContextActionResult.Sink end, false, 3000, Enum.KeyCode.Space)
	panelCleanup = function()
		conn:Disconnect()
		keyConn:Disconnect()
		ContextActionService:UnbindAction("TakeOneTiming")
	end
end

local function runBrief(gig)
	local response = act("StartGig", { gigId = gig.id })
	if not response.ok then return end
	local answers = {}
	local function showQuestion(index)
		local question = gig.questions[index]
		openPanel(gig.project .. " / " .. gig.role, gig.title)
		if index == 1 then
			add(card({ label("DIRECTOR'S BRIEF", 12, C.acid, { Font = Enum.Font.GothamBlack }), label(gig.brief, 16, C.paper) }))
		end
		add(label(string.format("%d/%d  %s", index, #gig.questions, question.prompt), 20, C.paper, { Font = Enum.Font.GothamBold }))
		for _, original in ipairs(shuffledOrder(#question.options, player.UserId + index * 97 + #gig.id)) do
			local option = question.options[original]
			local b = add(button(option[1] .. "\n" .. option[2], false, function()
				answers[index] = original
				if index < #gig.questions then showQuestion(index + 1) else runTiming(gig, answers) end
			end, { Size = UDim2.new(1, 0, 0, 64), TextSize = 15 }))
			b.TextXAlignment = Enum.TextXAlignment.Left
			pad(12).Parent = b
		end
	end
	showQuestion(1)
end

openBoard = function()
	openPanel("Crew Board / Cycle " .. (state and state.cycle or "?"), "Pick a job, make it count.")
	for _, gig in ipairs(GameData.Gigs) do
		local done = isCompleted(gig.id)
		local locked = state and state.reputation < gig.requirement
		local row = add(card({
			label(string.format("%s  /  %s", gig.role:upper(), gig.title), 17, gig.color, { Font = Enum.Font.GothamBlack }),
			label(string.format("%s  -  %d cr  -  +%d rep base%s", gig.project, gig.fee, gig.rep,
				done and string.format("  -  best take %d", state.bestTakes[gig.id] or 0) or ""), 14, C.muted),
		}))
		local action = button(done and "Wrapped" or locked and ("Needs " .. gig.requirement .. " rep") or "Take gig", not (done or locked), function()
			if not (done or locked) then runBrief(gig) end
		end, { Size = UDim2.new(1, 0, 0, 36) })
		action.LayoutOrder = 99
		action.Parent = row
	end
	add(button("Post new calls (40 cr)", false, function()
		act("RefreshBoard")
		openBoard()
	end))
end

-- ------------------------------------------------------------------
-- Soundstage: greenlight + stage decisions
-- ------------------------------------------------------------------

local openStage

local function openGreenlight()
	openPanel("Soundstage 1 / Greenlight", "Commit the project")
	local choice = { genre = "Sci-Fi", budget = 420, crew = {} }
	local titleBox = add(make("TextBox", {
		PlaceholderText = "Working title (e.g. Last Light at Meridian)", Text = "", ClearTextOnFocus = false,
		Font = Enum.Font.GothamBold, TextSize = 18, TextColor3 = C.paper, PlaceholderColor3 = C.muted,
		BackgroundColor3 = C.ink3, Size = UDim2.new(1, 0, 0, 46),
	}, { corner(8), pad(10) }))

	local function toggleRow(title, items, isOn, onPick)
		add(label(title, 13, C.acid, { Font = Enum.Font.GothamBlack }))
		local row = add(make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 58) }, {
			make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 8) }),
		}))
		local buttons = {}
		local function refresh()
			for i, b in ipairs(buttons) do
				local on = isOn(items[i])
				b.BackgroundColor3 = on and C.acid or C.ink3
				b.TextColor3 = on and C.ink or C.paper
			end
		end
		for i, item in ipairs(items) do
			buttons[i] = button(item.text, false, function() onPick(item); refresh() end, { Parent = row, Size = UDim2.new(1 / #items, -8, 1, 0), TextSize = 14 })
		end
		refresh()
	end

	local genreItems = {}
	for _, genre in ipairs(GameData.Genres) do
		local needs = table.concat(GameData.GenreCrewDemand[genre], " + ")
		table.insert(genreItems, { value = genre, text = genre .. "\nneeds " .. needs })
	end
	toggleRow("GENRE", genreItems, function(item) return choice.genre == item.value end, function(item) choice.genre = item.value end)

	local budgetItems = {}
	for _, b in ipairs(GameData.Budgets) do
		table.insert(budgetItems, { value = b.cost, text = string.format("%s\n%d cr / +%d", b.label, b.cost, b.bonus) })
	end
	toggleRow("BUDGET", budgetItems, function(item) return choice.budget == item.value end, function(item) choice.budget = item.value end)

	local crewItems = {}
	for _, rate in ipairs(GameData.CrewRates) do
		table.insert(crewItems, { value = rate.role, text = string.format("%s\n%d cr / skill %d", rate.role, rate.cost, state.bestTakes[rate.sourceGig] or 55) })
	end
	toggleRow("SPECIALIST CREW (optional, tap to hire)", crewItems, function(item) return table.find(choice.crew, item.value) ~= nil end, function(item)
		local index = table.find(choice.crew, item.value)
		if index then table.remove(choice.crew, index) else table.insert(choice.crew, item.value) end
	end)

	add(label("Missing a genre's key specialist costs 10 audience score at release. Crew take 20% of gross.", 13, C.muted))
	add(button("Sign and greenlight", true, function()
		local response = act("Greenlight", { title = titleBox.Text, genre = choice.genre, budget = choice.budget, crew = choice.crew })
		if response.ok then openStage() end
	end))
end

openStage = function()
	local p = state and state.production
	if not p then
		if state.reputation < 60 then
			return toast(string.format("The stage manager shrugs: come back at 60 reputation (%d now).", state.reputation))
		end
		if state.credits < 420 then
			return toast(string.format("You need 420 credits to fund a film. You have %d.", state.credits))
		end
		return openGreenlight()
	end
	if p.released then
		openPanel("Soundstage 1 / Wrapped", p.title)
		add(label(string.format("Released at %d. Collect residuals by ending the cycle at the Front Office.", p.score or 0), 16, C.paper))
		add(button("Start the next project", true, function()
			local response = act("NewProject")
			if response.ok then openStage() end
		end))
		return
	end
	local stage = GameData.ProductionStages[p.stage + 1]
	openPanel(string.format("Soundstage 1 / %s / Stage %d of 4", p.genre, p.stage + 1), p.title)
	add(card({
		label(stage.name:upper(), 12, C.acid, { Font = Enum.Font.GothamBlack }),
		label(stage.prompt, 17, C.paper, { Font = Enum.Font.GothamBold }),
		label(string.format("Creative signal so far: %d", p.quality), 14, C.muted),
	}))
	for index, option in ipairs(stage.options) do
		local b = add(button(option.title .. "\n" .. option.detail, false, function()
			local response = act("StageDecision", { option = index })
			if not response.ok then return end
			if response.result then
				local r = response.result
				openPanel("Premiere", r.flop and "It flopped." or "Your film is out!")
				add(label(tostring(r.score), 64, r.flop and C.coral or C.acid, { TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBlack }))
				add(label(string.format("Gross %d cr  -  crew residuals %d cr  -  %d cr to you", r.gross, r.crewResiduals, r.net), 16, C.paper, { TextXAlignment = Enum.TextXAlignment.Center }))
				add(label(string.format("Reputation %s%d", r.repDelta >= 0 and "+" or "", r.repDelta), 18, C.paper, { TextXAlignment = Enum.TextXAlignment.Center, Font = Enum.Font.GothamBold }))
				add(button("Great", true, closePanel))
			else
				openStage()
			end
		end, { Size = UDim2.new(1, 0, 0, 64), TextSize = 15 }))
		b.TextXAlignment = Enum.TextXAlignment.Left
		pad(12).Parent = b
	end
end

-- ------------------------------------------------------------------
-- Cinema, Prop House, Front Office
-- ------------------------------------------------------------------

local function openCinema()
	openPanel("Cinema / Now showing", "Tonight's marquee")
	local films = {}
	for _, f in ipairs(state.releases) do table.insert(films, { title = f.title, genre = f.genre, score = f.score, views = f.views, creator = "You" }) end
	for _, f in ipairs(GameData.BaseFilms) do table.insert(films, f) end
	table.sort(films, function(a, b) return a.score > b.score end)
	for _, f in ipairs(films) do
		add(card({
			label(string.format("%d   %s", f.score, f.title), 18, f.creator == "You" and C.acid or C.paper, { Font = Enum.Font.GothamBlack }),
			label(string.format("%s  -  %s views  -  by %s", f.genre, f.views >= 1000 and (math.floor(f.views / 1000) .. "K") or tostring(f.views), f.creator), 14, C.muted),
		}))
	end
end

local function openProps()
	openPanel("Prop House", "Your portfolio")
	local any = false
	for _, gig in ipairs(GameData.Gigs) do
		local best = state.bestTakes[gig.id]
		if best then
			any = true
			add(card({ label(string.format("%s / %s", gig.role, gig.title), 16, gig.color, { Font = Enum.Font.GothamBold }), label("Best take " .. best .. (best >= 72 and "  -  portfolio quality" or ""), 14, C.muted) }))
		end
	end
	if not any then add(label("No takes yet. Your best work from the Crew Board shows up here.", 16, C.muted)) end
end

local function openOffice()
	local rank = GameData.Rank(state.reputation)
	openPanel("Front Office / " .. rank.tier, rank.name)
	add(card({
		label(rank.nextRep and string.format("%d reputation until the next rank.", rank.nextRep - state.reputation) or "You run this lot now.", 16, C.paper, { Font = Enum.Font.GothamBold }),
		label("Ending the cycle pays residuals on released films that scored 65+.", 14, C.muted),
	}))
	for _, line in ipairs(state.activity or {}) do add(label("-  " .. line, 14, C.muted)) end
	add(button("End cycle " .. state.cycle, true, function()
		act("EndCycle")
		openOffice()
	end))
end

local function openTower()
	local promptGui = player.PlayerGui:FindFirstChild("PromptTheWorldGui")
	local openEvent = promptGui and promptGui:FindFirstChild("OpenPromptTheWorld")
	if openEvent then openEvent:Fire() else toast("Press P to prompt the world.") end
end

local handlers = { board = openBoard, stage = function() openStage() end, cinema = openCinema, warehouse = openProps, office = openOffice, tower = openTower }

ProximityPromptService.PromptTriggered:Connect(function(prompt, who)
	if who ~= player or not state then return end
	local handler = handlers[prompt:GetAttribute("Building")]
	if handler then handler() end
end)

-- Show "Back to the lot" whenever the player is out on a generated set.
RunService.Heartbeat:Connect(function()
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	backButton.Visible = root ~= nil and root.Position.Z > 200
end)

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if input.KeyCode == Enum.KeyCode.Escape and panelOpen then closePanel() end
end)
