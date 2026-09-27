--[[
  Camera — classic Roblox third-person on the lot (zoom with the scroll
  wheel, right-drag to look), with V toggling a locked first-person view
  for walking generated sets like a camera operator.

  Replaces the old always-first-person lock: the lot is a social hub, so
  seeing your own avatar (and everyone else's) is the Roblox-native default.
  Works unchanged in VR, where Roblox drives the camera from the headset.
]]

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local firstPerson = false

local function apply()
	if firstPerson then
		player.CameraMode = Enum.CameraMode.LockFirstPerson
		player.CameraMinZoomDistance = 0.5
		player.CameraMaxZoomDistance = 0.5
	else
		player.CameraMode = Enum.CameraMode.Classic
		player.CameraMinZoomDistance = 6
		player.CameraMaxZoomDistance = 40
	end
end

apply()
player.CharacterAdded:Connect(apply)

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed or input.KeyCode ~= Enum.KeyCode.V then return end
	firstPerson = not firstPerson
	apply()
end)
