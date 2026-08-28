--[[
  FirstPersonCamera — locks the player's camera to first-person on spawn.

  Unlike the Unreal port (TakeOneWalkPawn, which hand-implements movement,
  mouse-look, and a first-/third-person toggle in C++), Roblox's default
  Humanoid + camera already provides WASD movement, jump (Space), and
  mouse-look out of the box — nothing to write for that part. This script
  only sets the one property needed to start the player locked into FPV
  instead of Roblox's usual third-person-over-the-shoulder default.
]]

local Players = game:GetService("Players")
local player = Players.LocalPlayer

local function lockFirstPerson()
	-- LockFirstPerson also disables the third-person camera entirely, which
	-- is what "playable FPV" means here — the player never sees their own
	-- character's back. Scroll-to-zoom (Roblox's default free camera) is
	-- deliberately not offered so the game stays first-person by default.
	player.CameraMode = Enum.CameraMode.LockFirstPerson
	player.CameraMinZoomDistance = 0.5
	player.CameraMaxZoomDistance = 0.5
end

lockFirstPerson()
player.CharacterAdded:Connect(lockFirstPerson)
