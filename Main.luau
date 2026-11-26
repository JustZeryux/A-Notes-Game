-- Main.luau (Orquestador seguro con presets rápidos y captura de errores)
local Players = game:GetService("Players")

local Main = {}

function Main.BuildOptions(presetName: string?, overrides: {[string]: any}?)
	local preset = presetName or "full_dump"
	local opts = {
		Mode = "full",
		SaveScripts = false,
		UseDecompiler = false,
		DecompileTimeout = 0.2,
		SaveTerrain = true,
		TerrainHalfExtent = 128,
		NilInstances = false,
		IncludeLocalPlayerData = true,
		IgnorePlayers = false,
		IgnoreDefaultProps = true,
		SafeUIMode = false,
		SaveTagsAndAttributes = true,
		YieldInterval = 0.75,
		MaxDepth = nil,
		IncludeNameFilter = nil,
		ExcludeNameFilter = nil,
		ExcludeClasses = {
			ParticleEmitter = false,
			Trail = false,
		},
		IncludeClasses = nil,
		Services = {
			Workspace = true,
			ReplicatedStorage = true,
			ReplicatedFirst = true,
			StarterGui = true,
			StarterPack = true,
			StarterPlayer = true,
			Lighting = true,
			SoundService = true,
			MaterialService = true,
		},
	}

	if preset == "fast_map_ui" then
		opts.Mode = "map_ui"
		opts.UseDecompiler = false
		opts.SaveTagsAndAttributes = false
	elseif preset == "lite_safe" then
		opts.UseDecompiler = false
		opts.SafeUIMode = true
		opts.TerrainHalfExtent = 64
	elseif preset == "scripts_only" then
		opts.Mode = "scripts_only"
		opts.SaveTerrain = false
		opts.NilInstances = false
	end

	if overrides then
		for k, v in pairs(overrides) do
			opts[k] = v
		end
	end

	return opts
end

function Main.RunExport(serializerInstance, fileName: string, options, onProgress, onFinished)
	task.spawn(function()
		local callOk, exportOk, outPathOrErr, bytes = pcall(function()
			return serializerInstance:RunToFile(fileName, options, onProgress)
		end)

		if not callOk then
			pcall(function()
				serializerInstance:RecordStep("CRASH_GUARD -> " .. tostring(exportOk))
			end)
			if onFinished then
				onFinished(false, tostring(exportOk), 0)
			end
			return
		end

		if onFinished then
			onFinished(exportOk == true, tostring(outPathOrErr), bytes or 0)
		end
	end)
end

return Main
