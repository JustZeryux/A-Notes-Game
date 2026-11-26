-- PanelUI.luau
local Players = game:GetService("Players")
local CoreGui = game:GetService("CoreGui")

local PanelUI = {}

local function formatBytes(bytes: number): string
	if bytes < 1024 then
		return string.format("%d B", bytes)
	elseif bytes < 1024 * 1024 then
		return string.format("%.1f KB", bytes / 1024)
	else
		return string.format("%.2f MB", bytes / (1024 * 1024))
	end
end

function PanelUI.Create(onExportCallback, onCancelCallback)
	local targetParent = nil
	if Players.LocalPlayer then
		local okGui, pg = pcall(function()
			return Players.LocalPlayer:FindFirstChildOfClass("PlayerGui") or Players.LocalPlayer:WaitForChild("PlayerGui", 5)
		end)
		if okGui and pg then targetParent = pg end
	end
	if not targetParent then
		local okCore, cg = pcall(function()
			local _ = CoreGui.Name
			return CoreGui
		end)
		if okCore and cg then targetParent = cg end
	end
	if not targetParent then return end

	local old = targetParent:FindFirstChild("ZeryuxSaveInstanceUI")
	if old then old:Destroy() end

	local gui = Instance.new("ScreenGui")
	gui.Name = "ZeryuxSaveInstanceUI"
	gui.ResetOnSpawn = false
	pcall(function() gui.DisplayOrder = 950 end)
	gui.Parent = targetParent

	local main = Instance.new("Frame")
	main.Name = "MainPanel"
	main.Size = UDim2.fromOffset(316, 356)
	main.Position = UDim2.new(0.5, -158, 0.5, -178)
	main.BackgroundColor3 = Color3.fromRGB(15, 17, 24)
	main.BorderSizePixel = 0
	main.Active = true
	main.Draggable = true
	main.Parent = gui

	Instance.new("UICorner", main).CornerRadius = UDim.new(0, 10)
	local stroke = Instance.new("UIStroke")
	stroke.Color = Color3.fromRGB(0, 215, 245)
	stroke.Thickness = 1.2
	stroke.Parent = main

	local uiScale = Instance.new("UIScale")
	uiScale.Parent = main
	local function updateScale()
		local cam = workspace.CurrentCamera
		if cam then
			local vp = cam.ViewportSize
			local sx = (vp.X - 24) / 316
			local sy = (vp.Y - 24) / 356
			uiScale.Scale = math.clamp(math.min(sx, sy, 1), 0.72, 1.05)
		end
	end
	updateScale()
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
	end

	local header = Instance.new("Frame")
	header.Size = UDim2.new(1, 0, 0, 34)
	header.BackgroundColor3 = Color3.fromRGB(22, 25, 36)
	header.BorderSizePixel = 0
	header.Parent = main
	Instance.new("UICorner", header).CornerRadius = UDim.new(0, 10)

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, -70, 1, 0)
	title.Position = UDim2.fromOffset(10, 0)
	title.BackgroundTransparency = 1
	title.Text = "ZERYUX DUMP // PC"
	title.TextColor3 = Color3.fromRGB(0, 215, 245)
	title.Font = Enum.Font.GothamBold
	title.TextSize = 12
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Parent = header

	local minBtn = Instance.new("TextButton")
	minBtn.Size = UDim2.fromOffset(24, 22)
	minBtn.Position = UDim2.new(1, -56, 0.5, -11)
	minBtn.BackgroundColor3 = Color3.fromRGB(36, 42, 60)
	minBtn.Text = "-"
	minBtn.TextColor3 = Color3.new(1, 1, 1)
	minBtn.Font = Enum.Font.GothamBold
	minBtn.TextSize = 14
	minBtn.Parent = header
	Instance.new("UICorner", minBtn).CornerRadius = UDim.new(0, 5)

	local closeBtn = Instance.new("TextButton")
	closeBtn.Size = UDim2.fromOffset(24, 22)
	closeBtn.Position = UDim2.new(1, -28, 0.5, -11)
	closeBtn.BackgroundColor3 = Color3.fromRGB(210, 55, 70)
	closeBtn.Text = "X"
	closeBtn.TextColor3 = Color3.new(1, 1, 1)
	closeBtn.Font = Enum.Font.GothamBold
	closeBtn.TextSize = 11
	closeBtn.Parent = header
	Instance.new("UICorner", closeBtn).CornerRadius = UDim.new(0, 5)

	local body = Instance.new("Frame")
	body.Size = UDim2.new(1, 0, 1, -34)
	body.Position = UDim2.fromOffset(0, 34)
	body.BackgroundTransparency = 1
	body.Parent = main

	local minimized = false
	minBtn.MouseButton1Click:Connect(function()
		minimized = not minimized
		body.Visible = not minimized
		main.Size = minimized and UDim2.fromOffset(316, 34) or UDim2.fromOffset(316, 356)
		minBtn.Text = minimized and "+" or "-"
	end)

	closeBtn.MouseButton1Click:Connect(function()
		if onCancelCallback then onCancelCallback() end
		gui:Destroy()
	end)

	local tabBar = Instance.new("Frame")
	tabBar.Size = UDim2.new(1, -16, 0, 26)
	tabBar.Position = UDim2.fromOffset(8, 6)
	tabBar.BackgroundColor3 = Color3.fromRGB(22, 25, 36)
	tabBar.BorderSizePixel = 0
	tabBar.Parent = body
	Instance.new("UICorner", tabBar).CornerRadius = UDim.new(0, 6)

	local tabFiltersBtn = Instance.new("TextButton")
	tabFiltersBtn.Size = UDim2.new(0.5, -2, 1, -4)
	tabFiltersBtn.Position = UDim2.fromOffset(2, 2)
	tabFiltersBtn.BackgroundColor3 = Color3.fromRGB(0, 215, 245)
	tabFiltersBtn.Text = "FILTROS"
	tabFiltersBtn.TextColor3 = Color3.fromRGB(12, 15, 22)
	tabFiltersBtn.Font = Enum.Font.GothamBold
	tabFiltersBtn.TextSize = 11
	tabFiltersBtn.Parent = tabBar
	Instance.new("UICorner", tabFiltersBtn).CornerRadius = UDim.new(0, 5)

	local tabServicesBtn = Instance.new("TextButton")
	tabServicesBtn.Size = UDim2.new(0.5, -2, 1, -4)
	tabServicesBtn.Position = UDim2.new(0.5, 0, 0, 2)
	tabServicesBtn.BackgroundColor3 = Color3.fromRGB(22, 25, 36)
	tabServicesBtn.Text = "SERVICIOS"
	tabServicesBtn.TextColor3 = Color3.fromRGB(175, 185, 205)
	tabServicesBtn.Font = Enum.Font.GothamBold
	tabServicesBtn.TextSize = 11
	tabServicesBtn.Parent = tabBar
	Instance.new("UICorner", tabServicesBtn).CornerRadius = UDim.new(0, 5)

	local function makeListFrame()
		local sf = Instance.new("ScrollingFrame")
		sf.Size = UDim2.new(1, -16, 1, -136)
		sf.Position = UDim2.fromOffset(8, 38)
		sf.BackgroundTransparency = 1
		sf.ScrollBarThickness = 3
		sf.ScrollBarImageColor3 = Color3.fromRGB(0, 215, 245)
		sf.AutomaticCanvasSize = Enum.AutomaticSize.Y
		sf.CanvasSize = UDim2.fromOffset(0, 0)
		sf.Parent = body

		local layout = Instance.new("UIListLayout")
		layout.Padding = UDim.new(0, 5)
		layout.Parent = sf
		return sf
	end

	local filtersList = makeListFrame()
	local servicesList = makeListFrame()
	servicesList.Visible = false

	local function setTab(isFilters: boolean)
		filtersList.Visible = isFilters
		servicesList.Visible = not isFilters
		if isFilters then
			tabFiltersBtn.BackgroundColor3 = Color3.fromRGB(0, 215, 245)
			tabFiltersBtn.TextColor3 = Color3.fromRGB(12, 15, 22)
			tabServicesBtn.BackgroundColor3 = Color3.fromRGB(22, 25, 36)
			tabServicesBtn.TextColor3 = Color3.fromRGB(175, 185, 205)
		else
			tabServicesBtn.BackgroundColor3 = Color3.fromRGB(0, 215, 245)
			tabServicesBtn.TextColor3 = Color3.fromRGB(12, 15, 22)
			tabFiltersBtn.BackgroundColor3 = Color3.fromRGB(22, 25, 36)
			tabFiltersBtn.TextColor3 = Color3.fromRGB(175, 185, 205)
		end
	end

	tabFiltersBtn.MouseButton1Click:Connect(function() setTab(true) end)
	tabServicesBtn.MouseButton1Click:Connect(function() setTab(false) end)

	local modes = { "full", "scripts_only", "map_ui" }
	local modeIdx = 1

	local state = {
		Mode = "full",
		Services = {
			Workspace = true,
			ReplicatedStorage = true,
			ReplicatedFirst = true,
			Lighting = true,
			StarterGui = true,
			StarterPack = true,
			StarterPlayer = true,
			SoundService = true,
			MaterialService = true,
		},
		SaveScripts = false,
		UseDecompiler = false,
		DecompileTimeout = 0.2,
		IgnorePlayers = false,
		SafeUIMode = false,
		SaveTerrain = false,
		TerrainHalfExtent = 128,
		ConvertAnimationsToKeyframes = false,
		KeyframeDuration = 0,
		KeyframeFPS = 30,
		NilInstances = false,
		IncludeLocalPlayerData = true,
		SaveTagsAndAttributes = true,
		YieldInterval = 0.75,
	}

	local modeBtn = Instance.new("TextButton")
	modeBtn.Size = UDim2.new(1, -4, 0, 26)
	modeBtn.BackgroundColor3 = Color3.fromRGB(28, 34, 50)
	modeBtn.Text = "Modo: FULL (Todo lo replicado)"
	modeBtn.TextColor3 = Color3.fromRGB(0, 215, 245)
	modeBtn.Font = Enum.Font.GothamBold
	modeBtn.TextSize = 11
	modeBtn.Parent = filtersList
	Instance.new("UICorner", modeBtn).CornerRadius = UDim.new(0, 6)

	modeBtn.MouseButton1Click:Connect(function()
		modeIdx = (modeIdx % #modes) + 1
		state.Mode = modes[modeIdx]
		if state.Mode == "full" then
			modeBtn.Text = "Modo: FULL (Todo lo replicado)"
		elseif state.Mode == "scripts_only" then
			modeBtn.Text = "Modo: SCRIPTS (Solo scripts)"
		else
			modeBtn.Text = "Modo: MAP_UI (Sin scripts)"
		end
	end)

	local function addToggle(parentList, labelText, defaultVal, onChange)
		local row = Instance.new("TextButton")
		row.Size = UDim2.new(1, -4, 0, 25)
		row.BackgroundColor3 = Color3.fromRGB(24, 28, 40)
		row.Text = ""
		row.AutoButtonColor = false
		row.Parent = parentList
		Instance.new("UICorner", row).CornerRadius = UDim.new(0, 6)

		local lbl = Instance.new("TextLabel")
		lbl.Size = UDim2.new(1, -38, 1, 0)
		lbl.Position = UDim2.fromOffset(8, 0)
		lbl.BackgroundTransparency = 1
		lbl.Text = labelText
		lbl.TextColor3 = Color3.fromRGB(230, 235, 245)
		lbl.Font = Enum.Font.Gotham
		lbl.TextSize = 11
		lbl.TextXAlignment = Enum.TextXAlignment.Left
		lbl.Parent = row

		local box = Instance.new("Frame")
		box.Size = UDim2.fromOffset(16, 16)
		box.Position = UDim2.new(1, -24, 0.5, -8)
		box.BackgroundColor3 = defaultVal and Color3.fromRGB(0, 215, 245) or Color3.fromRGB(52, 58, 76)
		box.Parent = row
		Instance.new("UICorner", box).CornerRadius = UDim.new(0, 4)

		local active = defaultVal
		row.MouseButton1Click:Connect(function()
			active = not active
			box.BackgroundColor3 = active and Color3.fromRGB(0, 215, 245) or Color3.fromRGB(52, 58, 76)
			onChange(active)
		end)
	end

	addToggle(filtersList, "UI Ligera (anti-crash UI)", state.SafeUIMode, function(v) state.SafeUIMode = v end)
	addToggle(filtersList, "Guardar Scripts", state.SaveScripts, function(v) state.SaveScripts = v end)
	addToggle(filtersList, "Decompiler (puede ralentizar)", state.UseDecompiler, function(v) state.UseDecompiler = v end)
	addToggle(filtersList, "Ignorar Jugadores", state.IgnorePlayers, function(v) state.IgnorePlayers = v end)
	addToggle(filtersList, "Animaciones -> Keyframes", state.ConvertAnimationsToKeyframes, function(v) state.ConvertAnimationsToKeyframes = v end)
	addToggle(filtersList, "Muestrear 2s Anim (30 FPS)", false, function(v) state.KeyframeDuration = v and 2 or 0 end)
	addToggle(filtersList, "PlayerGui y PlayerScripts", state.IncludeLocalPlayerData, function(v) state.IncludeLocalPlayerData = v end)
	addToggle(filtersList, "Tags y Atributos", state.SaveTagsAndAttributes, function(v) state.SaveTagsAndAttributes = v end)
	addToggle(filtersList, "Terrain SmoothGrid (pesado)", state.SaveTerrain, function(v) state.SaveTerrain = v end)
	addToggle(filtersList, "NilInstances (pesado)", state.NilInstances, function(v) state.NilInstances = v end)

	for serviceName, defaultVal in pairs(state.Services) do
		addToggle(servicesList, serviceName, defaultVal, function(v)
			state.Services[serviceName] = v
		end)
	end

	local progressBg = Instance.new("Frame")
	progressBg.Size = UDim2.new(1, -16, 0, 10)
	progressBg.Position = UDim2.new(0, 8, 1, -92)
	progressBg.BackgroundColor3 = Color3.fromRGB(30, 35, 50)
	progressBg.BorderSizePixel = 0
	progressBg.Parent = body
	Instance.new("UICorner", progressBg).CornerRadius = UDim.new(1, 0)

	local progressFill = Instance.new("Frame")
	progressFill.Size = UDim2.new(0, 0, 1, 0)
	progressFill.BackgroundColor3 = Color3.fromRGB(0, 215, 245)
	progressFill.BorderSizePixel = 0
	progressFill.Parent = progressBg
	Instance.new("UICorner", progressFill).CornerRadius = UDim.new(1, 0)

	local statsLabel = Instance.new("TextLabel")
	statsLabel.Size = UDim2.new(1, -16, 0, 16)
	statsLabel.Position = UDim2.new(0, 8, 1, -78)
	statsLabel.BackgroundTransparency = 1
	statsLabel.Text = "0 / 0 inst  |  ~0 B  |  workspace/"
	statsLabel.TextColor3 = Color3.fromRGB(150, 175, 205)
	statsLabel.Font = Enum.Font.Code
	statsLabel.TextSize = 10
	statsLabel.TextXAlignment = Enum.TextXAlignment.Left
	statsLabel.Parent = body

	local statusLabel = Instance.new("TextLabel")
	statusLabel.Size = UDim2.new(1, -16, 0, 16)
	statusLabel.Position = UDim2.new(0, 8, 1, -62)
	statusLabel.BackgroundTransparency = 1
	statusLabel.Text = "Listo para exportar"
	statusLabel.TextColor3 = Color3.fromRGB(115, 230, 165)
	statusLabel.Font = Enum.Font.Gotham
	statusLabel.TextSize = 11
	statusLabel.TextXAlignment = Enum.TextXAlignment.Left
	statusLabel.TextTruncate = Enum.TextTruncate.AtEnd
	statusLabel.Parent = body

	local exportBtn = Instance.new("TextButton")
	exportBtn.Size = UDim2.new(0.66, -10, 0, 32)
	exportBtn.Position = UDim2.new(0, 8, 1, -40)
	exportBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 230)
	exportBtn.Text = "EXPORTAR"
	exportBtn.TextColor3 = Color3.fromRGB(10, 14, 20)
	exportBtn.Font = Enum.Font.GothamBold
	exportBtn.TextSize = 12
	exportBtn.Parent = body
	Instance.new("UICorner", exportBtn).CornerRadius = UDim.new(0, 7)

	local cancelBtn = Instance.new("TextButton")
	cancelBtn.Size = UDim2.new(0.34, -10, 0, 32)
	cancelBtn.Position = UDim2.new(0.66, 2, 1, -40)
	cancelBtn.BackgroundColor3 = Color3.fromRGB(65, 32, 42)
	cancelBtn.Text = "CANCELAR"
	cancelBtn.TextColor3 = Color3.fromRGB(255, 130, 145)
	cancelBtn.Font = Enum.Font.GothamBold
	cancelBtn.TextSize = 11
	cancelBtn.Parent = body
	Instance.new("UICorner", cancelBtn).CornerRadius = UDim.new(0, 7)

	local function setProgress(current: number, total: number, bytes: number, currentName: string?, fileHint: string?)
		local ratio = math.clamp(current / math.max(1, total), 0, 1)
		progressFill.Size = UDim2.new(ratio, 0, 1, 0)
		local folderHint = fileHint or "workspace/"
		statsLabel.Text = string.format("%d/%d (%.0f%%) | %s | %s", current, total, ratio * 100, formatBytes(bytes), folderHint)
		if currentName then
			statusLabel.Text = "Leyendo: " .. currentName
		end
	end

	local isRunning = false

	cancelBtn.MouseButton1Click:Connect(function()
		if isRunning and onCancelCallback then
			onCancelCallback()
			statusLabel.Text = "Cancelando..."
		end
	end)

	exportBtn.MouseButton1Click:Connect(function()
		if isRunning then return end
		isRunning = true
		exportBtn.Text = "EXPORTANDO..."
		exportBtn.BackgroundColor3 = Color3.fromRGB(85, 95, 115)
		setProgress(0, 1, 0, "Preparando...", "workspace/")

		task.spawn(function()
			onExportCallback(state, function(msg, current, total, bytes, fileHint)
				if current and total and bytes then
					setProgress(current, total, bytes, nil, fileHint)
				end
				if msg then
					statusLabel.Text = msg
				end
			end)
			isRunning = false
			exportBtn.Text = "EXPORTAR"
			exportBtn.BackgroundColor3 = Color3.fromRGB(0, 200, 230)
		end)
	end)
end

return PanelUI
