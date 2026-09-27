@echo off
rem Leave open while you play: every new recording in your Videos\Captures
rem folder (Xbox Game Bar / Roblox / OBS default) is auto-edited into a Reel.
rem Change the folder below if your recorder saves elsewhere.
node "%~dp0reel-maker.mjs" --watch "%USERPROFILE%\Videos\Captures" --reels 1
