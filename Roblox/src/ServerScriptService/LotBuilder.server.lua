--[[
  LotBuilder — builds the Take One studio backlot (the game's hub) at
  server start. Same layout as the browser game's lot.js, converted to
  studs: each building has a door with a ProximityPrompt (press E). The
  client HUD (TakeOneHud.client.lua) listens for those prompts and opens
  the matching panel, so the whole game is played in-world, no menus.

  Coordinates: lot units from lot.js * LOT_SCALE -> studs, centered on the
  origin, lot "down" (+y in 2D) maps to +Z here, doors face +Z.
]]

local Workspace = game:GetService("Workspace")
local Lighting = game:GetService("Lighting")

local LOT_SCALE = 0.18 -- 1 lot unit ~= 5 cm ~= 0.18 studs
local LOT_W, LOT_H = 1400, 900

local BUILDINGS = {
	{ id = "board", label = "CREW BOARD", sub = "Take gigs", x = 120, y = 120, w = 220, h = 150, height = 24, wall = Color3.fromRGB(59, 74, 63), roof = Color3.fromRGB(215, 246, 90) },
	{ id = "stage", label = "SOUNDSTAGE 1", sub = "Your production", x = 540, y = 90, w = 320, h = 200, height = 46, wall = Color3.fromRGB(64, 64, 74), roof = Color3.fromRGB(135, 169, 255) },
	{ id = "cinema", label = "CINEMA", sub = "Watch the catalog", x = 1050, y = 120, w = 230, h = 160, height = 32, wall = Color3.fromRGB(74, 52, 52), roof = Color3.fromRGB(255, 113, 101) },
	{ id = "warehouse", label = "PROP HOUSE", sub = "Assets", x = 120, y = 560, w = 240, h = 150, height = 25, wall = Color3.fromRGB(74, 66, 52), roof = Color3.fromRGB(243, 173, 82) },
	{ id = "office", label = "FRONT OFFICE", sub = "End cycle / career", x = 590, y = 580, w = 220, h = 140, height = 28, wall = Color3.fromRGB(52, 68, 74), roof = Color3.fromRGB(72, 197, 173) },
	{ id = "tower", label = "WORLD TOWER", sub = "Prompt the world", x = 1090, y = 540, w = 140, h = 170, height = 60, wall = Color3.fromRGB(58, 52, 72), roof = Color3.fromRGB(181, 140, 255) },
}

local TREES = { { 60, 420 }, { 420, 60 }, { 960, 60 }, { 1340, 60 }, { 460, 760 }, { 900, 780 }, { 1340, 820 }, { 60, 820 }, { 420, 470 }, { 960, 470 } }

local function toStuds(x, y)
	return (x - LOT_W / 2) * LOT_SCALE, (y - LOT_H / 2) * LOT_SCALE
end

local lot = Workspace:FindFirstChild("StudioLot")
if lot then lot:Destroy() end
lot = Instance.new("Model")
lot.Name = "StudioLot"

local function part(props)
	local p = Instance.new(props.class or "Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = props.material or Enum.Material.SmoothPlastic
	for key, value in pairs(props) do
		if key ~= "class" and key ~= "material" and key ~= "parent" then p[key] = value end
	end
	p.Parent = props.parent or lot
	return p
end

local function sign(parentPart, face, text, color, textColor)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.Parent = parentPart
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = color
	label.TextColor3 = textColor or Color3.fromRGB(16, 18, 16)
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.Text = text
	label.Parent = gui
	return label
end

-- World floor: a Rojo-built place has no Baseplate, and generated sets are
-- built ~420 studs south of the lot, so give everything something to stand on.
if not Workspace:FindFirstChild("Baseplate") then
	part({ Name = "WorldFloor", Size = Vector3.new(2048, 1, 2048), Position = Vector3.new(0, -1.5, 0), Color = Color3.fromRGB(70, 110, 62), material = Enum.Material.Grass, parent = Workspace })
end

-- Ground, roads, fence
local W, H = LOT_W * LOT_SCALE, LOT_H * LOT_SCALE
part({ Name = "LotGround", Size = Vector3.new(W, 1, H), Position = Vector3.new(0, -0.5, 0), Color = Color3.fromRGB(95, 174, 78), material = Enum.Material.Grass })
local _, roadZ = toStuds(0, 445)
part({ Name = "MainRoad", Size = Vector3.new(W, 0.2, 150 * LOT_SCALE), Position = Vector3.new(0, 0.1, roadZ), Color = Color3.fromRGB(74, 77, 82), material = Enum.Material.Asphalt })
for _, x in ipairs({ 470, 960 }) do
	local rx = toStuds(x, 0)
	part({ Name = "CrossRoad", Size = Vector3.new(60 * LOT_SCALE, 0.2, H), Position = Vector3.new(rx, 0.1, 0), Color = Color3.fromRGB(74, 77, 82), material = Enum.Material.Asphalt })
end
for i = 0, 13 do
	part({ Name = "Stripe", Size = Vector3.new(9, 0.22, 1), Position = Vector3.new(-W / 2 + 9 + i * 18, 0.12, roadZ), Color = Color3.fromRGB(242, 240, 233), CanCollide = false })
end
for _, f in ipairs({ { 0, H / 2, W, 1 }, { 0, -H / 2, W, 1 }, { W / 2, 0, 1, H }, { -W / 2, 0, 1, H } }) do
	part({ Name = "Fence", Size = Vector3.new(f[3], 6, f[4]), Position = Vector3.new(f[1], 3, f[2]), Color = Color3.fromRGB(138, 143, 150), material = Enum.Material.Metal })
end

-- Buildings with doors + ProximityPrompts
for _, b in ipairs(BUILDINGS) do
	local cx, cz = toStuds(b.x + b.w / 2, b.y + b.h / 2)
	local w, d = b.w * LOT_SCALE, b.h * LOT_SCALE
	local model = Instance.new("Model")
	model.Name = b.label
	model:SetAttribute("Building", b.id)
	model.Parent = lot

	if b.id == "tower" then
		part({ Name = "Body", class = "Part", Shape = Enum.PartType.Cylinder, Size = Vector3.new(b.height, w * 0.8, w * 0.8), CFrame = CFrame.new(cx, b.height / 2, cz) * CFrame.Angles(0, 0, math.rad(90)), Color = b.wall, parent = model })
		part({ Name = "Beacon", Shape = Enum.PartType.Ball, Size = Vector3.new(8, 8, 8), Position = Vector3.new(cx, b.height + 4, cz), Color = b.roof, material = Enum.Material.Neon, parent = model })
	else
		part({ Name = "Body", Size = Vector3.new(w, b.height, d), Position = Vector3.new(cx, b.height / 2, cz), Color = b.wall, material = Enum.Material.Concrete, parent = model })
		part({ Name = "Roof", Size = Vector3.new(w + 3, 2, d + 3), Position = Vector3.new(cx, b.height + 1, cz), Color = b.roof, parent = model })
		for wx = -w / 2 + 6, w / 2 - 6, 10 do
			if math.abs(wx) > 6 then
				part({ Name = "Window", Size = Vector3.new(6, 5, 0.3), Position = Vector3.new(cx + wx, b.height * 0.5, cz + d / 2 + 0.1), Color = Color3.fromRGB(156, 200, 232), material = Enum.Material.Glass, parent = model })
			end
		end
	end

	local frontZ = cz + (b.id == "tower" and w * 0.4 or d / 2)
	local signPart = part({ Name = "Sign", Size = Vector3.new(math.min(w * 0.85, 34), 5, 0.5), Position = Vector3.new(cx, math.min(b.height - 4, 18), frontZ + 0.3), Color = b.roof, parent = model })
	sign(signPart, Enum.NormalId.Back, b.label, b.roof)
	-- SurfaceGui faces: the sign's Back face points +Z (out of the door side).
	local door = part({ Name = "Door", Size = Vector3.new(8, 11, 0.6), Position = Vector3.new(cx, 5.5, frontZ + 0.3), Color = Color3.fromRGB(26, 28, 30), parent = model })
	local pad = part({ Name = "DoorPad", Size = Vector3.new(10, 0.25, 6), Position = Vector3.new(cx, 0.15, frontZ + 3.5), Color = b.roof, material = Enum.Material.Neon, CanCollide = false, parent = model })
	pad.Transparency = 0.35

	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "EnterPrompt"
	prompt.ActionText = "Enter"
	prompt.ObjectText = b.label .. " — " .. b.sub
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("Building", b.id)
	prompt.Parent = door
end

-- Studio gate over the main road
local gx, gz = toStuds(700, 445)
part({ Name = "GatePost", Size = Vector3.new(2, 22, 2), Position = Vector3.new(gx - 24, 11, gz), Color = Color3.fromRGB(16, 18, 16) })
part({ Name = "GatePost", Size = Vector3.new(2, 22, 2), Position = Vector3.new(gx + 24, 11, gz), Color = Color3.fromRGB(16, 18, 16) })
local gateSign = part({ Name = "GateSign", Size = Vector3.new(50, 6, 1), Position = Vector3.new(gx, 20, gz), Color = Color3.fromRGB(16, 18, 16) })
sign(gateSign, Enum.NormalId.Back, "TAKE ONE STUDIOS", Color3.fromRGB(16, 18, 16), Color3.fromRGB(215, 246, 90))
sign(gateSign, Enum.NormalId.Front, "TAKE ONE STUDIOS", Color3.fromRGB(16, 18, 16), Color3.fromRGB(215, 246, 90))

for _, t in ipairs(TREES) do
	local x, z = toStuds(t[1], t[2])
	part({ Name = "Trunk", Shape = Enum.PartType.Cylinder, Size = Vector3.new(9, 2, 2), CFrame = CFrame.new(x, 4.5, z) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(107, 74, 46), material = Enum.Material.Wood })
	part({ Name = "Canopy", Shape = Enum.PartType.Ball, Size = Vector3.new(11, 11, 11), Position = Vector3.new(x, 12, z), Color = Color3.fromRGB(63, 163, 77), material = Enum.Material.Grass })
end

-- Spawn in front of the gate, facing the Soundstage.
for _, existing in ipairs(Workspace:GetDescendants()) do
	if existing:IsA("SpawnLocation") and existing.Name ~= "LotSpawn" then existing.Enabled = false end
end
local spawn = part({ Name = "LotSpawn", class = "SpawnLocation", Size = Vector3.new(8, 1, 8), Position = Vector3.new(gx, 0.5, gz + 12), Color = Color3.fromRGB(215, 246, 90) })
spawn.Neutral = true
spawn.Duration = 0

lot.Parent = Workspace

Lighting.ClockTime = 14.5
Lighting.Brightness = 2.5
