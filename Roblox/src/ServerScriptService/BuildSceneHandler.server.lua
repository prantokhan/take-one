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

local SET_ORIGIN = Vector3.new(0, 0, 60) -- keep the generated set away from the default spawn

local function clearPreviousSet()
	local existing = Workspace:FindFirstChild("GeneratedSet")
	if existing then
		existing:Destroy()
	end
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

	-- Simple ambient mood swing so "night"/"rain"/etc. prompts read
	-- differently, echoing the JS generator's night-aware sky/sun values.
	-- FogStart/FogEnd are also what makes SceneGenerator's backdrop ring
	-- (radius 70-170) actually read as a hazy distant skyline instead of
	-- either popping sharply against the sky (fog too far) or vanishing
	-- entirely (fog too close, previously 100000 = effectively off).
	local lighting = game:GetService("Lighting")
	if scene.night then
		lighting.Brightness = 1
		lighting.ClockTime = 0
		lighting.FogColor = Color3.fromRGB(10, 15, 20)
		lighting.FogStart = 40
		lighting.FogEnd = 260
	else
		lighting.Brightness = 2.5
		lighting.ClockTime = 14
		lighting.FogColor = Color3.fromRGB(180, 195, 210)
		lighting.FogStart = 120
		lighting.FogEnd = 420
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
