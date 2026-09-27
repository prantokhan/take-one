--[[
  BuildSceneHandler — server-side listener for ReplicatedStorage.Remotes.GenerateScene.

  Mirrors the browser game's openWorldPrompt() -> TakeOneAI.generateScene()
  flow: a player fires the prompt string, this calls SceneGenerator (the
  Luau port of ai-client.js's offline generator) and builds the result as
  real, collidable Parts under workspace.GeneratedSet. Runs on the server
  (not a LocalScript) so the set is the same for every player in the place,
  same as the shared "world catalog" idea in the browser game.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local SceneGenerator = require(ReplicatedStorage.Modules.SceneGenerator)
local GenerateScene = ReplicatedStorage.Remotes.GenerateScene

-- Well clear of the studio lot (LotBuilder, ~250 x 160 studs around the origin).
local SET_ORIGIN = Vector3.new(0, 0, 420)

-- "Back to the lot" button on the HUD fires this.
local ReturnToLot = ReplicatedStorage.Remotes:FindFirstChild("ReturnToLot") or Instance.new("RemoteEvent")
ReturnToLot.Name = "ReturnToLot"
ReturnToLot.Parent = ReplicatedStorage.Remotes
ReturnToLot.OnServerEvent:Connect(function(player)
	local spawn = Workspace:FindFirstChild("LotSpawn", true)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if spawn and root then
		root.CFrame = spawn.CFrame + Vector3.new(0, 4, 0)
	end
end)

-- A real Atmosphere gives actual sky depth (haze/scattering that responds
-- to sun angle and density) instead of the flat default blue-to-white
-- gradient with nothing in it. Created once and left in place; only its
-- Color/Density/Glare are retuned per mood below, same as the existing
-- Lighting properties.
local function ensureAtmosphere()
	local lighting = game:GetService("Lighting")
	local atmosphere = lighting:FindFirstChildOfClass("Atmosphere")
	if not atmosphere then
		atmosphere = Instance.new("Atmosphere")
		atmosphere.Parent = lighting
	end
	return atmosphere
end

-- How far out (in each horizontal direction, in studs) the water region
-- extends when a water-themed prompt fills it in. Deliberately larger than
-- the 80x80 hero_floor so it reads as an ocean/lake the set sits beside,
-- not a swimming pool sized to the floor.
local WATER_HALF_EXTENT = 260
local WATER_TOP_Y = -1 -- just below the hero_floor's top surface (floor top is at y=1)
local WATER_DEPTH = 40

local function clearPreviousSet()
	local existing = Workspace:FindFirstChild("GeneratedSet")
	if existing then
		existing:Destroy()
	end
	-- Clear any water this handler filled in on a previous prompt too —
	-- otherwise a later non-water prompt would leave a stale ocean behind.
	local terrain = Workspace.Terrain
	terrain:FillRegion(
		Region3.new(
			SET_ORIGIN - Vector3.new(WATER_HALF_EXTENT, WATER_DEPTH + 20, WATER_HALF_EXTENT),
			SET_ORIGIN + Vector3.new(WATER_HALF_EXTENT, 20, WATER_HALF_EXTENT)
		):ExpandToGrid(4),
		4,
		Enum.Material.Air
	)
end

-- Real Terrain water (wave animation + transparency baked into the engine)
-- rather than a colored Part, which can't read as water at all. Filled as a
-- half-open square around the set with the hero_floor's footprint left dry
-- in the middle, so the player has solid ground to stand on and water
-- surrounds/borders it like a coastline.
local function fillWater()
	local terrain = Workspace.Terrain
	terrain:FillRegion(
		Region3.new(
			SET_ORIGIN - Vector3.new(WATER_HALF_EXTENT, WATER_DEPTH, WATER_HALF_EXTENT),
			SET_ORIGIN + Vector3.new(WATER_HALF_EXTENT, WATER_TOP_Y, WATER_HALF_EXTENT)
		):ExpandToGrid(4),
		4,
		Enum.Material.Water
	)
	-- Carve the hero_floor's footprint (and a little margin) back out to Air
	-- so the water doesn't clip through/under the set's solid floor.
	terrain:FillRegion(
		Region3.new(
			SET_ORIGIN - Vector3.new(48, WATER_DEPTH, 48),
			SET_ORIGIN + Vector3.new(48, WATER_TOP_Y, 48)
		):ExpandToGrid(4),
		4,
		Enum.Material.Air
	)
end

local function buildPart(spec, folder)
	local part = Instance.new("Part")
	part.Name = spec.id
	part.Anchored = true
	part.CanCollide = true -- the player's Humanoid needs to actually collide with the set
	part.CastShadow = spec.castShadow
	part.Color = spec.color
	part.Size = spec.size
	part.CFrame = spec.cframe + SET_ORIGIN
	part.Material = Enum.Material.SmoothPlastic

	if spec.primitive == "Ball" then
		part.Shape = Enum.PartType.Ball
	elseif spec.primitive == "Cylinder" then
		part.Shape = Enum.PartType.Cylinder
		-- Roblox cylinders lie on their local X axis by default; rotate so
		-- they stand upright like the JS/Unreal version's cylinders do.
		part.CFrame = part.CFrame * CFrame.Angles(0, 0, math.rad(90))
	elseif spec.primitive == "Wedge" then
		part.Shape = Enum.PartType.Block
		local wedge = Instance.new("WedgePart")
		wedge.Name = spec.id
		wedge.Anchored = true
		wedge.CanCollide = true
		wedge.CastShadow = spec.castShadow
		wedge.Color = spec.color
		wedge.Size = spec.size
		wedge.CFrame = spec.cframe + SET_ORIGIN
		wedge.Material = Enum.Material.SmoothPlastic
		wedge:SetAttribute("Label", spec.label)
		wedge.Parent = folder
		part:Destroy()
		return
	else
		part.Shape = Enum.PartType.Block
	end

	part:SetAttribute("Label", spec.label)
	part.Parent = folder
end

local function handleGenerate(player, prompt)
	if typeof(prompt) ~= "string" or #prompt == 0 or #prompt > 400 then
		return
	end

	clearPreviousSet()

	local scene = SceneGenerator.Generate(prompt)

	local folder = Instance.new("Folder")
	folder:SetAttribute("Title", scene.title)
	folder:SetAttribute("Summary", scene.summary)
	folder:SetAttribute("RequestedBy", player.Name)
	folder.Name = "GeneratedSet"
	folder.Parent = Workspace

	for _, spec in ipairs(scene.objects) do
		buildPart(spec, folder)
	end

	if scene.water then
		fillWater()
	end

	-- Three-way lighting mood (night/dusk/day) so "sunset"/"evening"/etc.
	-- prompts get real golden-hour lighting instead of collapsing into
	-- flat daytime (found via play-testing: a "sunset" prompt rendered at
	-- full noon brightness under the old night/day-only binary).
	-- FogStart/FogEnd are also what makes SceneGenerator's backdrop ring
	-- (radius 70-170) actually read as a hazy distant skyline instead of
	-- either popping sharply against the sky (fog too far) or vanishing
	-- entirely (fog too close, previously 100000 = effectively off).
	local lighting = game:GetService("Lighting")
	local atmosphere = ensureAtmosphere()
	if scene.mood == "night" then
		lighting.Brightness = 1
		lighting.ClockTime = 0
		lighting.FogColor = Color3.fromRGB(10, 15, 20)
		lighting.FogStart = 40
		lighting.FogEnd = 260
		atmosphere.Density = 0.4
		atmosphere.Color = Color3.fromRGB(20, 25, 40)
		atmosphere.Decay = Color3.fromRGB(10, 12, 20)
		atmosphere.Glare = 0
		atmosphere.Haze = 1.2
	elseif scene.mood == "dusk" then
		lighting.Brightness = 1.6
		lighting.ClockTime = 18.2 -- just past sundown: low warm sun, not yet full dark
		lighting.FogColor = Color3.fromRGB(196, 122, 84)
		lighting.FogStart = 60
		lighting.FogEnd = 320
		atmosphere.Density = 0.5
		atmosphere.Color = Color3.fromRGB(255, 150, 90)
		atmosphere.Decay = Color3.fromRGB(150, 70, 60)
		atmosphere.Glare = 0.8 -- warm sun-glare halo, the main thing that sells "golden hour"
		atmosphere.Haze = 1.6
	else
		lighting.Brightness = 2.5
		lighting.ClockTime = 14
		lighting.FogColor = Color3.fromRGB(180, 195, 210)
		lighting.FogStart = 120
		lighting.FogEnd = 420
		atmosphere.Density = 0.3
		atmosphere.Color = Color3.fromRGB(199, 199, 199)
		atmosphere.Decay = Color3.fromRGB(92, 60, 13)
		atmosphere.Glare = 0.15
		atmosphere.Haze = 0.6
	end

	-- Move the requesting player's character to the new set so they don't
	-- have to walk 60 studs to see what they just prompted.
	local character = player.Character
	if character then
		local rootPart = character:FindFirstChild("HumanoidRootPart")
		if rootPart then
			rootPart.CFrame = CFrame.new(SET_ORIGIN + Vector3.new(0, 5, 25), SET_ORIGIN)
		end
	end
end

GenerateScene.OnServerEvent:Connect(handleGenerate)
