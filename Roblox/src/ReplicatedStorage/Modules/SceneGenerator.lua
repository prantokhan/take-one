--[[
  SceneGenerator — deterministic "prompt -> set layout" generator.

  Ported from ai-client.js's localFor()/hashOf() (the browser game's offline
  fallback for POST /v1/scenes/generate). Same idea, adapted for Roblox:
  instead of a JSON scene spec consumed by Unreal's TakeOneSceneBuilder, this
  returns a plain Lua table of part specs that BuildSceneHandler (server)
  turns into real Parts in the workspace. No network/AI backend involved —
  the whole point (matching the browser game's design) is that the same
  prompt always produces the same layout, fully offline.

  Coordinate convention: Roblox is Y-up (X/Z horizontal), unlike Unreal's
  Z-up, so positions here are authored fresh for that convention rather than
  reusing ai-client.js's raw numbers.
]]

local SceneGenerator = {}

-- Same FNV-1a-ish string hash as ai-client.js's hashOf(), reimplemented with
-- bit32 since Luau doesn't have JS's >>> 0 (unsigned coercion) built in.
local function hashOf(text)
	local hash = 2166136261
	for index = 1, #text do
		hash = bit32.bxor(hash, string.byte(text, index))
		-- 32-bit unsigned multiply-overflow, mirroring Math.imul in the JS version.
		hash = (hash * 16777619) % 4294967296
	end
	return hash
end

local PRIMITIVES = { "Block", "Ball", "Cylinder", "Wedge" } -- Roblox has no native cone; Wedge stands in.

local function pick(list, seed)
	return list[(seed % #list) + 1]
end

local function colorFromSeed(seed, floor)
	-- Same "seed | floor" trick as the JS version's hex color derivation,
	-- just emitted as a Color3 instead of a CSS hex string.
	local r = bit32.band(bit32.bor(bit32.rshift(seed, 16), floor), 0xFF)
	local g = bit32.band(bit32.bor(bit32.rshift(seed, 8), floor), 0xFF)
	local b = bit32.band(bit32.bor(seed, floor), 0xFF)
	return Color3.fromRGB(r, g, b)
end

-- Whole-word match via Lua frontier pattern (%f), not a plain substring
-- search — found by play-testing that "training" contains "rain" and was
-- silently triggering night lighting on unrelated daytime prompts.
local function hasWord(text, word)
	return text:find("%f[%a]" .. word .. "%f[%A]") ~= nil
end

-- Generates a set layout for `prompt`. Returns:
--   { title, summary, night, objects = { {id, label, primitive, cframe, size, color, castShadow}, ... } }
function SceneGenerator.Generate(prompt)
	prompt = tostring(prompt or "")
	local lower = string.lower(prompt)
	local seed = hashOf(prompt)
	local night = hasWord(lower, "night") or hasWord(lower, "dark")
		or hasWord(lower, "midnight") or hasWord(lower, "rain") or hasWord(lower, "dusk")

	local objects = {}

	-- Hero floor: a big flat slab the player spawns and walks on.
	table.insert(objects, {
		id = "hero_floor",
		label = "Hero performance area",
		primitive = "Block",
		cframe = CFrame.new(0, 0.5, 0),
		size = Vector3.new(80, 1, 80),
		color = night and Color3.fromRGB(20, 27, 34) or Color3.fromRGB(60, 70, 78),
		castShadow = true,
	})

	-- Hero subject: the one object the prompt is "about", placed front and
	-- center a few studs off the floor.
	table.insert(objects, {
		id = "hero_subject",
		label = "Prompt hero subject",
		primitive = pick(PRIMITIVES, seed),
		cframe = CFrame.new(0, 6, -18) * CFrame.Angles(0, math.rad(seed % 360), 0),
		size = Vector3.new(8, 12, 8),
		color = colorFromSeed(seed, 0x30),
		castShadow = true,
	})

	-- Ring of set-dressing elements around the hero subject, same idea as
	-- the JS generator's radial scatter (angle/radius/height all seeded per
	-- element so the layout is stable for a given prompt).
	local count = 8 + (seed % 8)
	for index = 0, count - 1 do
		local elementSeed = hashOf(prompt .. ":" .. index)
		local angle = (elementSeed % 628) / 100
		local radius = 20 + (elementSeed % 28)
		local height = 2 + ((bit32.rshift(elementSeed, 3)) % 14)

		table.insert(objects, {
			id = "element_" .. index,
			label = pick({ "Set dressing", "Architecture mass", "Atmosphere prop", "Background structure" }, elementSeed),
			primitive = pick(PRIMITIVES, elementSeed),
			cframe = CFrame.new(
				math.cos(angle) * radius,
				height / 2,
				math.sin(angle) * radius
			) * CFrame.Angles(0, math.rad(elementSeed % 180), 0),
			size = Vector3.new(
				2 + (elementSeed % 6),
				height,
				2 + (bit32.rshift(elementSeed, 5) % 6)
			),
			color = colorFromSeed(bit32.rshift(elementSeed, 6), 0x20),
			castShadow = index % 3 ~= 0,
		})
	end

	-- Backdrop ring: taller, farther-out masses so the horizon isn't just
	-- empty baseplate past the near dressing elements. Fewer, bigger, and
	-- pushed well beyond the walkable area (radius 70-170) so they read as
	-- distant skyline/terrain rather than things the player bumps into.
	local backdropCount = 10 + (seed % 6)
	for index = 0, backdropCount - 1 do
		local backdropSeed = hashOf(prompt .. ":backdrop:" .. index)
		local angle = (backdropSeed % 628) / 100
		local radius = 70 + (backdropSeed % 100)
		local height = 30 + (backdropSeed % 90)

		table.insert(objects, {
			id = "backdrop_" .. index,
			label = "Distant skyline mass",
			primitive = pick({ "Block", "Cylinder" }, backdropSeed), -- flatter silhouettes read better at distance than Ball/Wedge
			cframe = CFrame.new(
				math.cos(angle) * radius,
				height / 2,
				math.sin(angle) * radius
			) * CFrame.Angles(0, math.rad(backdropSeed % 90), 0),
			size = Vector3.new(
				6 + (backdropSeed % 14),
				height,
				6 + (bit32.rshift(backdropSeed, 4) % 14)
			),
			-- Desaturated and darkened toward the fog/sky color so distant
			-- masses read as atmospheric haze rather than competing with the
			-- near dressing elements' saturated colors.
			color = night
				and Color3.fromRGB(14 + (backdropSeed % 10), 18 + (backdropSeed % 10), 24 + (backdropSeed % 12))
				or Color3.fromRGB(90 + (backdropSeed % 40), 100 + (backdropSeed % 40), 112 + (backdropSeed % 40)),
			castShadow = false, -- distant masses shouldn't throw long shadows across the playable floor
		})
	end

	return {
		title = "Director Set: " .. string.sub(prompt, 1, 40),
		summary = "Offline layout for: " .. string.sub(prompt, 1, 160),
		night = night and true or false,
		objects = objects,
	}
end

return SceneGenerator
