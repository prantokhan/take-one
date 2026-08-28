--[[
  PromptGui — minimal "prompt the world" console, the Roblox counterpart to
  the browser game's openWorldPrompt() modal. Built entirely at runtime
  (no separate .rbxmx UI file to hand-author/sync) so this single script is
  the whole feature: press P to open, type a set description, hit Generate
  (or Enter) to fire ReplicatedStorage.Remotes.GenerateScene to the server.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local GenerateScene = ReplicatedStorage.Remotes.GenerateScene

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "PromptTheWorldGui"
screenGui.ResetOnSpawn = false
screenGui.Enabled = false
screenGui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 420, 0, 160)
panel.Position = UDim2.new(0.5, -210, 0.78, -80)
panel.BackgroundColor3 = Color3.fromRGB(16, 18, 16)
panel.BackgroundTransparency = 0.08
panel.BorderSizePixel = 0
panel.Parent = screenGui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 10)
corner.Parent = panel

local title = Instance.new("TextLabel")
title.Text = "Prompt the world  (P to toggle, Enter to generate)"
title.Font = Enum.Font.GothamBold
title.TextSize = 14
title.TextColor3 = Color3.fromRGB(200, 255, 77)
title.BackgroundTransparency = 1
title.Size = UDim2.new(1, -20, 0, 24)
title.Position = UDim2.new(0, 10, 0, 8)
title.TextXAlignment = Enum.TextXAlignment.Left
title.Parent = panel

local input = Instance.new("TextBox")
input.PlaceholderText = "A neon-lit rooftop garden at midnight, fog rolling between greenhouse panels..."
input.Text = ""
input.ClearTextOnFocus = false
input.Font = Enum.Font.Gotham
input.TextSize = 14
input.TextColor3 = Color3.fromRGB(233, 237, 231)
input.TextXAlignment = Enum.TextXAlignment.Left
input.TextYAlignment = Enum.TextYAlignment.Top
input.TextWrapped = true
input.MultiLine = true
input.BackgroundColor3 = Color3.fromRGB(10, 11, 10)
input.Size = UDim2.new(1, -20, 0, 70)
input.Position = UDim2.new(0, 10, 0, 36)
input.Parent = panel

local inputCorner = Instance.new("UICorner")
inputCorner.CornerRadius = UDim.new(0, 6)
inputCorner.Parent = input

local generateButton = Instance.new("TextButton")
generateButton.Text = "Generate set"
generateButton.Font = Enum.Font.GothamBold
generateButton.TextSize = 14
generateButton.TextColor3 = Color3.fromRGB(16, 18, 16)
generateButton.BackgroundColor3 = Color3.fromRGB(200, 255, 77)
generateButton.Size = UDim2.new(1, -20, 0, 32)
generateButton.Position = UDim2.new(0, 10, 1, -40)
generateButton.Parent = panel

local buttonCorner = Instance.new("UICorner")
buttonCorner.CornerRadius = UDim.new(0, 6)
buttonCorner.Parent = generateButton

local function submitPrompt()
	local text = input.Text
	if text and #text > 0 then
		GenerateScene:FireServer(text)
		screenGui.Enabled = false
	end
end

generateButton.MouseButton1Click:Connect(submitPrompt)

input.FocusLost:Connect(function(enterPressed)
	if enterPressed then
		submitPrompt()
	end
end)

UserInputService.InputBegan:Connect(function(inputObject, gameProcessed)
	if gameProcessed then
		return
	end
	if inputObject.KeyCode == Enum.KeyCode.P then
		screenGui.Enabled = not screenGui.Enabled
		if screenGui.Enabled then
			input:CaptureFocus()
		end
	end
end)
