-- Serializer.luau (Completo: bloqueo anti-crash en scripts conflictivos, filtros, presets, métricas, reporte y streaming rápido)
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local Serializer = {}

local function clearTable(t: {[any]: any})
	if table.clear then
		table.clear(t)
	else
		for k in pairs(t) do
			t[k] = nil
		end
	end
end

local B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function toBase64(data: string): string
	local len = #data
	if len == 0 then return "" end
	local out = table.create(math.ceil(len / 3) * 4)
	local idx = 0
	local sSub = string.sub
	local sByte = string.byte
	local bor = bit32.bor
	local lshift = bit32.lshift
	local extract = bit32.extract

	for i = 1, len, 3 do
		local b1 = sByte(data, i)
		local b2 = (i + 1 <= len) and sByte(data, i + 1) or 0
		local b3 = (i + 2 <= len) and sByte(data, i + 2) or 0

		local triple = bor(lshift(b1, 16), lshift(b2, 8), b3)

		local c1 = extract(triple, 18, 6) + 1
		local c2 = extract(triple, 12, 6) + 1
		local c3 = extract(triple, 6, 6) + 1
		local c4 = extract(triple, 0, 6) + 1

		idx += 1; out[idx] = sSub(B64_CHARS, c1, c1)
		idx += 1; out[idx] = sSub(B64_CHARS, c2, c2)
		idx += 1; out[idx] = (i + 1 <= len) and sSub(B64_CHARS, c3, c3) or "="
		idx += 1; out[idx] = (i + 2 <= len) and sSub(B64_CHARS, c4, c4) or "="
	end

	return table.concat(out)
end

local function escapeXml(str: string): string
	if not string.find(str, '[&<>"\']') then
		return str
	end
	return str:gsub("&", "&amp;")
		:gsub("<", "&lt;")
		:gsub(">", "&gt;")
		:gsub('"', "&quot;")
		:gsub("'", "&apos;")
end

local function formatProtectedString(name: string, src: string): string
	local safeCdata = string.find(src, "]]>", 1, true) and string.gsub(src, "]]>", "]]]]><![CDATA[>") or src
	return '<ProtectedString name="' .. name .. '"><![CDATA[' .. safeCdata .. ']]></ProtectedString>'
end

local DefaultValues = {
	Archivable = true,
	Anchored = false,
	CanCollide = true,
	CanTouch = true,
	CanQuery = true,
	Massless = false,
	Transparency = 0,
	Reflectance = 0,
	CastShadow = true,
	BackgroundTransparency = 0,
	BorderSizePixel = 1,
	Visible = true,
	Enabled = true,
	Disabled = false,
	LightEmission = 0,
	LightInfluence = 1,
	Volume = 0.5,
	PlaybackSpeed = 1,
	Looped = false,
}

local function isDefaultProp(propName: string, val: any): boolean
	local def = DefaultValues[propName]
	if def == nil then return false end
	if typeof(val) == "number" and type(def) == "number" then
		return math.abs(val - def) < 1e-5
	end
	return val == def
end

local function isInsideGui(inst: Instance): boolean
	local cur = inst.Parent
	while cur do
		if cur:IsA("LayerCollector") or cur:IsA("GuiObject") then
			return true
		end
		cur = cur.Parent
	end
	return false
end

local function readPropDirect(inst: Instance, propName: string): (boolean, any)
	return pcall(function(o, p)
		return o[p]
	end, inst, propName)
end

local function normalizeScriptKey(name: string): string
	return string.lower(name):gsub("[%s_%-]", "")
end

local BlockedDecompileKeys = {
	"customkitcreation",
	"abilitycustomization",
	"kitcreation",
}

local function isProblematicDecompileScript(inst: Instance): boolean
	local norm = normalizeScriptKey(inst.Name)
	for i = 1, #BlockedDecompileKeys do
		if string.find(norm, BlockedDecompileKeys[i], 1, true) then
			return true
		end
	end
	return false
end

local function readBytecodeB64(scriptInstance: Instance): string?
	if typeof(getscriptbytecode) ~= "function" then
		return nil
	end
	local ok, bc = pcall(getscriptbytecode, scriptInstance)
	if ok and type(bc) == "string" and #bc > 0 then
		return toBase64(bc)
	end
	return nil
end

local function tryDecompileQuick(scriptInstance: Instance, maxWaitSec: number): string?
	if typeof(decompile) ~= "function" then
		return nil
	end
	local done = false
	local resultStr: string? = nil

	local co = task.spawn(function()
		local ok, res = pcall(decompile, scriptInstance)
		if not done then
			done = true
			if ok and type(res) == "string" and #res > 0 then
				resultStr = res
			end
		end
	end)

	local deadline = os.clock() + maxWaitSec
	while not done and os.clock() < deadline do
		task.wait(0.015)
	end

	if not done then
		done = true
		pcall(task.cancel, co)
		return nil
	end

	return resultStr
end

local function buildSmoothGridBinaryChunked(
	terrain: Terrain,
	halfExtentStuds: number,
	onChunkStep: ((string) -> ())?,
	isCancelled: (() -> boolean)?,
	markStep: ((string) -> ())?
): string?
	local stepSize = 32
	local minY, maxY = -64, 64

	if markStep then markStep("Terrain probe") end

	local fullRegion = Region3.new(
		Vector3.new(-halfExtentStuds, minY, -halfExtentStuds),
		Vector3.new(halfExtentStuds, maxY, halfExtentStuds)
	):ExpandToGrid(4)

	local testOk, testMat, testOcc = pcall(function()
		local probeMin = fullRegion.CFrame.Position - fullRegion.Size * 0.5
		local probeMax = probeMin + Vector3.new(4, fullRegion.Size.Y, fullRegion.Size.Z)
		return terrain:ReadVoxels(Region3.new(probeMin, probeMax):ExpandToGrid(4), 4)
	end)

	if not testOk or not testMat or not testOcc then
		return nil
	end

	local sy = #testMat[1] or 0
	local sz = (testMat[1] and testMat[1][1]) and #testMat[1][1] or 0
	local sx = math.max(1, math.floor(fullRegion.Size.X / 4))
	if sy == 0 or sz == 0 then
		return nil
	end

	local bytes = {}
	local function pushU32(n: number)
		local v = math.max(0, math.floor(n))
		table.insert(bytes, string.char(
			bit32.band(v, 0xFF),
			bit32.band(bit32.rshift(v, 8), 0xFF),
			bit32.band(bit32.rshift(v, 16), 0xFF),
			bit32.band(bit32.rshift(v, 24), 0xFF)
		))
	end

	pushU32(sx)
	pushU32(sy)
	pushU32(sz)

	local originMin = fullRegion.CFrame.Position - (fullRegion.Size * 0.5)
	local slices = math.max(1, math.ceil(fullRegion.Size.X / stepSize))
	local lastYield = os.clock()

	for s = 0, slices - 1 do
		if isCancelled and isCancelled() then
			return nil
		end

		local x0 = originMin.X + (s * stepSize)
		local x1 = math.min(originMin.X + fullRegion.Size.X, x0 + stepSize)
		if x1 > x0 then
			local sliceRegion = Region3.new(
				Vector3.new(x0, originMin.Y, originMin.Z),
				Vector3.new(x1, originMin.Y + fullRegion.Size.Y, originMin.Z + fullRegion.Size.Z)
			):ExpandToGrid(4)

			local okSlice, matSlice, occSlice = pcall(function()
				return terrain:ReadVoxels(sliceRegion, 4)
			end)

			if okSlice and matSlice and occSlice then
				for x = 1, #matSlice do
					for y = 1, #matSlice[x] do
						for z = 1, #matSlice[x][y] do
							local mat = matSlice[x][y][z]
							local occ = occSlice[x][y][z] or 0
							local matId = (typeof(mat) == "EnumItem" and mat.Value) or 0
							local occByte = math.clamp(math.floor(occ * 255 + 0.5), 0, 255)
							table.insert(bytes, string.char(
								bit32.band(matId, 0xFF),
								occByte,
								0,
								0
							))
						end
					end
				end
			end
		end

		if (os.clock() - lastYield) >= 0.30 or s == slices - 1 then
			lastYield = os.clock()
			if onChunkStep then
				onChunkStep(string.format("Terrain %d/%d", s + 1, slices))
			end
			task.wait()
		end
	end

	return table.concat(bytes)
end

local function matchesNameFilter(name: string, includeSubstr: string?, excludeSubstr: string?): boolean
	local lower = string.lower(name)
	if excludeSubstr and excludeSubstr ~= "" then
		if string.find(lower, string.lower(excludeSubstr), 1, true) then
			return false
		end
	end
	if includeSubstr and includeSubstr ~= "" then
		if not string.find(lower, string.lower(includeSubstr), 1, true) then
			return false
		end
	end
	return true
end

function Serializer.New(ReflectionModule)
	local self = {
		Reflection = ReflectionModule,
		ReferentCount = 0,
		ReferentMap = {},
		ProcessedCount = 0,
		TotalEstimate = 1,
		EstimatedBytes = 0,
		DecompiledCount = 0,
		BytecodeFallbackCount = 0,
		DirectSourceCount = 0,
		NilCount = 0,
		KeyframeSequencesCount = 0,
		UnknownClassCount = 0,
		UnknownClasses = {},
		PropertyErrorCount = 0,
		ContentOpaqueCount = 0,
		ContentObjectUnsupportedCount = 0,
		UnreadableContentCount = 0,
		SharedStringCount = 0,
		UnreadableGeometryCount = 0,
		SharedStringEntries = {},
		SharedStringKeys = {},
		SolidModelCount = 0,
		WriteError = nil,
		Cancelled = false,
		ChunkBuffer = {},
		PendingChunkBytes = 0,
		FlushThresholdBytes = 1048576, -- 1 MB por bloque
		StreamFile = nil,
		CheckpointFile = "ZeryuxDump_LastStep.txt",
		ReportFile = "ZeryuxDump_Report.txt",
		CompiledPropListCache = {},
	}

	function self:GetCompiledPropList(className: string)
		local cached = self.CompiledPropListCache[className]
		if cached ~= nil then
			return cached or nil
		end
		local rawProps = self.Reflection.GetProperties(className)
		if not rawProps then
			self.CompiledPropListCache[className] = false
			return nil
		end
		local list = {}
		for propName, propType in pairs(rawProps) do
			table.insert(list, { name = propName, propType = propType })
		end
		table.sort(list, function(a, b) return a.name < b.name end)
		self.CompiledPropListCache[className] = list
		return list
	end

	function self:RecordStep(detail: string)
		if typeof(writefile) == "function" and self.CheckpointFile then
			pcall(writefile, self.CheckpointFile, string.format("Inst: %d | %s", self.ProcessedCount, detail))
		end
	end

	function self:WriteReport(statusText: string, elapsedSec: number, outPath: string)
		if typeof(writefile) ~= "function" or not self.ReportFile then return end
		local mb = self.EstimatedBytes / (1024 * 1024)
		local rate = (elapsedSec > 0) and ((self.EstimatedBytes / 1024) / elapsedSec) or 0
		local lines = {
			"=== ZERYUX DUMP REPORT ===",
			"Estado: " .. statusText,
			"Archivo: " .. tostring(outPath),
			string.format("Tiempo total: %.2f s (%.2f min)", elapsedSec, elapsedSec / 60),
			string.format("Instancias procesadas: %d / ~%d", self.ProcessedCount, self.TotalEstimate),
			string.format("Tamano aprox: %.2f MB (%d bytes)", mb, self.EstimatedBytes),
			string.format("Velocidad escritura: %.1f KB/s", rate),
			string.format("Scripts -> Source directo: %d | Decompilados: %d | Bytecode B64: %d", self.DirectSourceCount, self.DecompiledCount, self.BytecodeFallbackCount),
			"NilInstances: " .. tostring(self.NilCount),
			"Clases no soportadas: " .. tostring(self.UnknownClassCount),
			"Propiedades con error: " .. tostring(self.PropertyErrorCount),
			"Content opaco no exportable: " .. tostring(self.ContentOpaqueCount),
			"Content Object no compatible: " .. tostring(self.ContentObjectUnsupportedCount),
			"Referencias Content ilegibles: " .. tostring(self.UnreadableContentCount),
			"SharedStrings exportados: " .. tostring(self.SharedStringCount),
			"Datos internos de geometría ilegibles: " .. tostring(self.UnreadableGeometryCount),
			"Operaciones CSG detectadas: " .. tostring(self.SolidModelCount),
			"Error de escritura: " .. tostring(self.WriteError or "ninguno"),
		}
		for className, count in pairs(self.UnknownClasses) do
			table.insert(lines, "Clase omitida: " .. tostring(className) .. " x" .. tostring(count))
		end
		pcall(writefile, self.ReportFile, table.concat(lines, "\n"))
	end

	function self:GetReferent(instance: Instance): string
		local existing = self.ReferentMap[instance]
		if existing then
			return existing
		end
		self.ReferentCount += 1
		local ref = "RBX" .. tostring(self.ReferentCount)
		self.ReferentMap[instance] = ref
		return ref
	end

	function self:Flush(force: boolean?): (boolean, string?)
		local buf = self.ChunkBuffer
		if not self.StreamFile then return true, nil end
		if #buf == 0 then return true, nil end
		if not force and self.PendingChunkBytes < self.FlushThresholdBytes then return true, nil end

		local chunk = table.concat(buf, "\n") .. "\n"
		if self.StreamFile then
			if typeof(appendfile) ~= "function" then
				self.WriteError = "appendfile no está disponible"
				self.Cancelled = true
				return false, self.WriteError
			end
			local okAppend, appendResult = pcall(appendfile, self.StreamFile, chunk)
			if not okAppend or appendResult == false then
				self.WriteError = "appendfile falló: " .. tostring(appendResult)
				self.Cancelled = true
				return false, self.WriteError
			end
		end

		-- Clear only after the write succeeded. This prevents silent loss of chunks.
		clearTable(buf)
		self.PendingChunkBytes = 0
		return true, nil
	end

	function self:Emit(line: string)
		local buf = self.ChunkBuffer
		buf[#buf + 1] = line
		local lineBytes = #line + 1
		self.EstimatedBytes += lineBytes
		self.PendingChunkBytes += lineBytes
		if self.PendingChunkBytes >= self.FlushThresholdBytes then
			local flushOk = self:Flush(false)
			if not flushOk then
				self.Cancelled = true
			end
		end
	end

	local seqPartsBuf = {}
	local sFmt = string.format

	local TypeHandlers = {
		string = function(name, val)
			return '<string name="' .. name .. '">' .. escapeXml(tostring(val)) .. '</string>'
		end,
		BinaryString = function(name, val)
			return '<BinaryString name="' .. name .. '">' .. toBase64(tostring(val)) .. '</BinaryString>'
		end,
		Content = function(name, val)
			local function nullContent()
				return '<Content name="' .. name .. '"><null></null></Content>'
			end

			-- Legacy values may still arrive as strings through compatibility aliases.
			if type(val) == "string" then
				if val == "" then return nullContent() end
				return '<Content name="' .. name .. '"><uri>' .. escapeXml(val) .. '</uri></Content>'
			end

			-- Current Roblox Content values carry a source type. Preserve URI and
			-- Instance-backed references where the XML format can represent them.
			local typeOk, sourceType = pcall(function() return val.SourceType end)
			if typeOk and Enum and Enum.ContentSourceType then
				if sourceType == Enum.ContentSourceType.None then
					return nullContent()
				elseif sourceType == Enum.ContentSourceType.Uri then
					local uriOk, uri = pcall(function() return val.Uri end)
					if uriOk and type(uri) == "string" and uri ~= "" then
						return '<Content name="' .. name .. '"><uri>' .. escapeXml(uri) .. '</uri></Content>'
					end
					return nullContent()
				elseif sourceType == Enum.ContentSourceType.Object then
					-- RBXMX Content XML supports URI/null values; do not write an
					-- unverified <Ref> child that could make the whole file invalid.
					self.ContentObjectUnsupportedCount += 1
					return nullContent()
				else
					-- Opaque content has no URI or readable object to serialize.
					self.ContentOpaqueCount += 1
					return nullContent()
				end
			end

			local stringOk, stringValue = pcall(tostring, val)
			if not stringOk or type(stringValue) ~= "string" or stringValue == "" or stringValue == "Content.none" or stringValue == "None" then
				return nullContent()
			end
			return '<Content name="' .. name .. '"><uri>' .. escapeXml(stringValue) .. '</uri></Content>'
		end,
		SharedString = function(name, val)
			local data = tostring(val or "")
			if data == "" then
				-- Empty SharedStrings are the default value; omit the property.
				return ""
			end
			local existingKey = self.SharedStringKeys[data]
			if not existingKey then
				self.SharedStringCount += 1
				-- The RBXMX shared-string key is an opaque unique token. The
				-- reference and definition use the same Base64 key.
				existingKey = toBase64("ZeryuxSharedString" .. tostring(self.SharedStringCount))
				self.SharedStringKeys[data] = existingKey
				self.SharedStringEntries[#self.SharedStringEntries + 1] = {
					key = existingKey,
					value = toBase64(data),
				}
			end
			return '<SharedString name="' .. name .. '">' .. existingKey .. '</SharedString>'
		end,
		bool = function(name, val)
			return '<bool name="' .. name .. '">' .. (val and "true" or "false") .. '</bool>'
		end,
		int = function(name, val)
			return '<int name="' .. name .. '">' .. tostring(math.floor(tonumber(val) or 0)) .. '</int>'
		end,
		int64 = function(name, val)
			return '<int64 name="' .. name .. '">' .. tostring(val) .. '</int64>'
		end,
		float = function(name, val)
			return '<float name="' .. name .. '">' .. tostring(val) .. '</float>'
		end,
		double = function(name, val)
			return '<double name="' .. name .. '">' .. tostring(val) .. '</double>'
		end,
		token = function(name, val)
			local num = typeof(val) == "EnumItem" and val.Value or tonumber(val) or 0
			return '<token name="' .. name .. '">' .. tostring(num) .. '</token>'
		end,
		BrickColor = function(name, val)
			local bc = typeof(val) == "BrickColor" and val or BrickColor.new(tonumber(val) or 194)
			return '<int name="' .. name .. '">' .. tostring(bc.Number) .. '</int>'
		end,
		PhysicalProperties = function(name, val)
			if typeof(val) ~= "PhysicalProperties" then
				return '<PhysicalProperties name="' .. name .. '"><CustomPhysics>false</CustomPhysics></PhysicalProperties>'
			end
			return sFmt(
				'<PhysicalProperties name="%s"><CustomPhysics>true</CustomPhysics><Density>%s</Density><Friction>%s</Friction><Elasticity>%s</Elasticity><FrictionWeight>%s</FrictionWeight><ElasticityWeight>%s</ElasticityWeight></PhysicalProperties>',
				name, val.Density, val.Friction, val.Elasticity, val.FrictionWeight, val.ElasticityWeight
			)
		end,
		Rect = function(name, val)
			return sFmt(
				'<Rect name="%s"><min><X>%s</X><Y>%s</Y></min><max><X>%s</X><Y>%s</Y></max></Rect>',
				name, val.Min.X, val.Min.Y, val.Max.X, val.Max.Y
			)
		end,
		Color3 = function(name, val)
			return sFmt('<Color3 name="%s"><R>%s</R><G>%s</G><B>%s</B></Color3>', name, val.R, val.G, val.B)
		end,
		Color3uint8 = function(name, val)
			local r = math.floor(val.R * 255 + 0.5)
			local g = math.floor(val.G * 255 + 0.5)
			local b = math.floor(val.B * 255 + 0.5)
			local packed = bit32.bor(0xFF000000, bit32.lshift(r, 16), bit32.lshift(g, 8), b)
			return sFmt('<Color3uint8 name="%s">%u</Color3uint8>', name, packed)
		end,
		Vector2 = function(name, val)
			return sFmt('<Vector2 name="%s"><X>%s</X><Y>%s</Y></Vector2>', name, val.X, val.Y)
		end,
		Vector3 = function(name, val)
			return sFmt('<Vector3 name="%s"><X>%s</X><Y>%s</Y><Z>%s</Z></Vector3>', name, val.X, val.Y, val.Z)
		end,
		UDim = function(name, val)
			return sFmt('<UDim name="%s"><S>%s</S><O>%d</O></UDim>', name, val.Scale, val.Offset)
		end,
		UDim2 = function(name, val)
			return sFmt(
				'<UDim2 name="%s"><XS>%s</XS><XO>%d</XO><YS>%s</YS><YO>%d</YO></UDim2>',
				name, val.X.Scale, val.X.Offset, val.Y.Scale, val.Y.Offset
			)
		end,
		NumberRange = function(name, val)
			return sFmt('<NumberRange name="%s">%s %s </NumberRange>', name, val.Min, val.Max)
		end,
		ColorSequence = function(name, val)
			clearTable(seqPartsBuf)
			local kps = val.Keypoints
			local n = #kps
			for i = 1, n do
				local kp = kps[i]
				local c = kp.Value
				seqPartsBuf[i] = sFmt("%s %s %s %s 0", kp.Time, c.R, c.G, c.B)
			end
			return '<ColorSequence name="' .. name .. '">' .. table.concat(seqPartsBuf, " ", 1, n) .. ' </ColorSequence>'
		end,
		NumberSequence = function(name, val)
			clearTable(seqPartsBuf)
			local kps = val.Keypoints
			local n = #kps
			for i = 1, n do
				local kp = kps[i]
				seqPartsBuf[i] = sFmt("%s %s %s", kp.Time, kp.Value, kp.Envelope or 0)
			end
			return '<NumberSequence name="' .. name .. '">' .. table.concat(seqPartsBuf, " ", 1, n) .. ' </NumberSequence>'
		end,
		CoordinateFrame = function(name, val)
			local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = val:GetComponents()
			return sFmt(
				'<CoordinateFrame name="%s"><X>%s</X><Y>%s</Y><Z>%s</Z>' ..
				'<R00>%s</R00><R01>%s</R01><R02>%s</R02>' ..
				'<R10>%s</R10><R11>%s</R11><R12>%s</R12>' ..
				'<R20>%s</R20><R21>%s</R21><R22>%s</R22></CoordinateFrame>',
				name, x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22
			)
		end,
		Ref = function(name, val)
			local ref = val and self:GetReferent(val) or "null"
			return '<Ref name="' .. name .. '">' .. ref .. '</Ref>'
		end,
	}

	function self:EstimateTotal(options): number
		local total = 0
		for serviceName, enabled in pairs(options.Services) do
			if enabled then
				local ok, service = pcall(game.GetService, game, serviceName)
				if ok and service then
					total += 1 + #service:GetDescendants()
				end
			end
		end
		if options.IncludeLocalPlayerData and Players.LocalPlayer then
			local pGui = Players.LocalPlayer:FindFirstChildOfClass("PlayerGui")
			if pGui then total += #pGui:GetDescendants() end
			local pScripts = Players.LocalPlayer:FindFirstChild("PlayerScripts")
			if pScripts then total += #pScripts:GetDescendants() end
		end
		if options.NilInstances and typeof(getnilinstances) == "function" then
			local ok, list = pcall(getnilinstances)
			if ok and type(list) == "table" then
				total += #list
			end
		end
		return math.max(1, total)
	end

	function self:ResolveScriptSourceInline(scriptInstance: Instance, options): string
		local okSrc, srcVal = readPropDirect(scriptInstance, "Source")
		if okSrc and type(srcVal) == "string" and srcVal ~= "" then
			self.DirectSourceCount += 1
			return srcVal
		end

		local bcB64 = readBytecodeB64(scriptInstance)

		if options.UseDecompiler and not isProblematicDecompileScript(scriptInstance) then
			self:RecordStep("DECOMPILE_TRY -> " .. scriptInstance.ClassName .. ":" .. scriptInstance.Name)
			local dec = tryDecompileQuick(scriptInstance, options.DecompileTimeout or 0.25)
			if dec then
				self.DecompiledCount += 1
				return dec
			end
		end

		if type(bcB64) == "string" and #bcB64 > 0 then
			self.BytecodeFallbackCount += 1
			return "-- [Bytecode Luau Base64]\n-- " .. bcB64
		end

		return "-- [Sin Source ni bytecode accesible]"
	end

	function self:ShouldSkip(instance: Instance, options, depth: number?): boolean
		if options.MaxDepth and depth and depth > options.MaxDepth then
			return true
		end
		if options.IgnorePlayers and Players:GetPlayerFromCharacter(instance) then
			return true
		end
		if options.Mode == "map_ui" and instance:IsA("LuaSourceContainer") then
			return true
		end
		if options.Mode == "scripts_only" and not instance:IsA("LuaSourceContainer") and #instance:GetChildren() == 0 then
			return true
		end
		if not options.SaveScripts and instance:IsA("LuaSourceContainer") then
			return true
		end
		if options.SafeUIMode and instance:IsA("LuaSourceContainer") and isInsideGui(instance) then
			return true
		end
		if instance:IsA("Terrain") and not options.SaveTerrain then
			return true
		end
		if options.ExcludeClasses and options.ExcludeClasses[instance.ClassName] then
			return true
		end
		if options.IncludeClasses and next(options.IncludeClasses) ~= nil then
			if not options.IncludeClasses[instance.ClassName] and #instance:GetChildren() == 0 then
				return true
			end
		end
		if not matchesNameFilter(instance.Name, options.IncludeNameFilter, options.ExcludeNameFilter) then
			if #instance:GetChildren() == 0 then
				return true
			end
		end
		return false
	end

	function self:WriteNodeOpen(instance: Instance, options, onProgress)
		local className = instance.ClassName
		if instance:IsA("PartOperation") then
			self.SolidModelCount += 1
		end
		local propList = self:GetCompiledPropList(className)
		if not propList then
			self.UnknownClassCount += 1
			self.UnknownClasses[className] = (self.UnknownClasses[className] or 0) + 1
			return false
		end

		local ignoreDefaults = (options.IgnoreDefaultProps ~= false)
		local skipComplexGui = options.SafeUIMode and instance:IsA("GuiObject")
		local canHidden = (not skipComplexGui) and (typeof(gethiddenproperty) == "function")
		local ref = self:GetReferent(instance)

		self:Emit('<Item class="' .. className .. '" referent="' .. ref .. '">')
		self:Emit("<Properties>")

		for i = 1, #propList do
			if self.Cancelled then break end
			local pInfo = propList[i]
			local propName = pInfo.name
			local propType = pInfo.propType

			if skipComplexGui and (propType == "Rect" or propType == "ColorSequence" or propType == "NumberSequence") then
				continue
			end

			if propName == "Source" and instance:IsA("LuaSourceContainer") then
				local resolvedSrc = self:ResolveScriptSourceInline(instance, options)
				self:Emit(formatProtectedString("Source", resolvedSrc))
			elseif propName == "SmoothGrid" and instance:IsA("Terrain") then
				local gridBin = buildSmoothGridBinaryChunked(
					instance :: Terrain,
					options.TerrainHalfExtent or 128,
					function(stepLabel)
						self:Flush(true)
						if onProgress then
							onProgress(self.ProcessedCount, self.TotalEstimate, self.EstimatedBytes, stepLabel)
						end
					end,
					function() return self.Cancelled end,
					function(stepTag) self:RecordStep(stepTag) end
				)
				if gridBin then
					self:Emit(TypeHandlers.BinaryString("SmoothGrid", gridBin))
					self:Flush(true)
				end
			else
				local ok, val = readPropDirect(instance, propName)
				local aliases = self.Reflection.LegacyContentAliases
				local classAliases = aliases and aliases[instance.ClassName]
				local legacyName = classAliases and classAliases[propName]
				if (not ok or val == nil) and legacyName then
					ok, val = readPropDirect(instance, legacyName)
				end
				if (not ok or val == nil) and canHidden then
					ok, val = pcall(gethiddenproperty, instance, propName)
					if (not ok or val == nil) and legacyName then
						ok, val = pcall(gethiddenproperty, instance, legacyName)
					end
				end
				if not ok and propType == "Content" then
					self.UnreadableContentCount += 1
				elseif not ok and (propType == "BinaryString" or propType == "SharedString")
					and (propName == "ChildData" or propName == "MeshData" or propName == "PhysicsData"
						or propName == "ChildData2" or propName == "MeshData2" or propName == "PhysicalConfigData"
						or propName == "AeroMeshData") then
					self.UnreadableGeometryCount += 1
				end
				if ok and val ~= nil and TypeHandlers[propType] then
					if propName == "Name" or not ignoreDefaults or not isDefaultProp(propName, val) then
						local emitOk, xmlOrErr = pcall(TypeHandlers[propType], propName, val)
						if emitOk and type(xmlOrErr) == "string" then
							if xmlOrErr ~= "" then
								self:Emit(xmlOrErr)
							end
						else
							self.PropertyErrorCount += 1
							self:Emit('<!-- Property serialization failed: ' .. escapeXml(propName) .. ' -->')
						end
					end
				elseif ok and val ~= nil and not TypeHandlers[propType] then
					self.PropertyErrorCount += 1
				end
			end
		end

		if options.SaveTagsAndAttributes and not skipComplexGui then
			local tagsOk, tags = pcall(CollectionService.GetTags, CollectionService, instance)
			if tagsOk and type(tags) == "table" and #tags > 0 then
				self:Emit(TypeHandlers.BinaryString("Tags", table.concat(tags, "\0")))
			end

			if canHidden then
				local attrOk, attrBlob = pcall(gethiddenproperty, instance, "AttributesSerialize")
				if attrOk and type(attrBlob) == "string" and #attrBlob > 0 then
					self:Emit(TypeHandlers.BinaryString("AttributesSerialize", attrBlob))
				end
			end
		end

		self:Emit("</Properties>")
		return true
	end

	function self:TraverseIterative(root: Instance, options, onProgress)
		if self.Cancelled or self:ShouldSkip(root, options, 0) then
			return
		end

		local stackInst = { root }
		local stackState = { 0 }
		local stackDepth = { 0 }
		local top = 1
		local lastYield = os.clock()
		local sinceGc = 0
		local sinceCheckpoint = 0

		while top > 0 and not self.Cancelled do
			local inst = stackInst[top]
			local state = stackState[top]
			local depth = stackDepth[top]

			if state == 0 then
				local openedItem = self:WriteNodeOpen(inst, options, onProgress)
				stackState[top] = openedItem and 1 or 2

				self.ProcessedCount += 1
				sinceGc += 1
				sinceCheckpoint += 1

				if (os.clock() - lastYield) >= (tonumber(options.YieldInterval) or 0.75) then
					lastYield = os.clock()
					self:Flush(false)
					if self.WriteError then
						self.Cancelled = true
						break
					end
					if sinceGc >= 15000 then
						sinceGc = 0
						pcall(collectgarbage, "step", 64)
					end
					if sinceCheckpoint >= 25000 then
						sinceCheckpoint = 0
						self:RecordStep("NODE -> " .. inst.ClassName .. ":" .. inst.Name)
					end
					if onProgress then
						onProgress(self.ProcessedCount, self.TotalEstimate, self.EstimatedBytes, inst.Name)
					end
					task.wait()
				end

				local nextDepth = depth + 1
				if not options.MaxDepth or nextDepth <= options.MaxDepth then
					local children = inst:GetChildren()
					for i = #children, 1, -1 do
						local child = children[i]
						if not self:ShouldSkip(child, options, nextDepth) then
							top += 1
							stackInst[top] = child
							stackState[top] = 0
							stackDepth[top] = nextDepth
						end
					end
				end
			else
				if state == 1 then
					self:Emit("</Item>")
				end
				stackInst[top] = nil
				stackState[top] = nil
				stackDepth[top] = nil
				top -= 1
			end
		end
	end

	function self:EmitSharedStrings()
		if #self.SharedStringEntries == 0 then
			return
		end
		self:Emit("<SharedStrings>")
		for i = 1, #self.SharedStringEntries do
			local entry = self.SharedStringEntries[i]
			self:Emit('<SharedString md5="' .. entry.key .. '">' .. entry.value .. '</SharedString>')
		end
		self:Emit("</SharedStrings>")
	end

	function self:RunToFile(fileName: string?, options, onProgress): (boolean, string, number)
		local startClock = os.clock()
		self.ReferentCount = 0
		clearTable(self.ReferentMap)
		clearTable(self.ChunkBuffer)
		self.PendingChunkBytes = 0
		self.ProcessedCount = 0
		self.EstimatedBytes = 0
		self.DecompiledCount = 0
		self.BytecodeFallbackCount = 0
		self.DirectSourceCount = 0
		self.NilCount = 0
		self.KeyframeSequencesCount = 0
		self.UnknownClassCount = 0
		clearTable(self.UnknownClasses)
		self.PropertyErrorCount = 0
		self.ContentOpaqueCount = 0
		self.ContentObjectUnsupportedCount = 0
		self.UnreadableContentCount = 0
		self.SharedStringCount = 0
		self.UnreadableGeometryCount = 0
		clearTable(self.SharedStringEntries)
		clearTable(self.SharedStringKeys)
		self.SolidModelCount = 0
		self.WriteError = nil
		self.Cancelled = false

		self:RecordStep("START -> " .. tostring(fileName))

		local canStream = (fileName ~= nil) and (typeof(writefile) == "function") and (typeof(appendfile) == "function")
		self.StreamFile = canStream and fileName or nil

		local header = table.concat({
			'<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">',
			'<External>null</External>',
			'<External>nil</External>',
		}, "\n") .. "\n"

		if self.StreamFile then
			local okWrite, writeResult = pcall(writefile, self.StreamFile, header)
			if not okWrite or writeResult == false then
				local errWrite = writeResult
				self.StreamFile = nil
				canStream = false
				self:WriteReport("ERROR_WRITEFILE: " .. tostring(errWrite), os.clock() - startClock, tostring(fileName))
				return false, "Error writefile: " .. tostring(errWrite), 0
			end
			self.EstimatedBytes += #header
		else
			table.insert(self.ChunkBuffer, '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">')
			table.insert(self.ChunkBuffer, '<External>null</External>')
			table.insert(self.ChunkBuffer, '<External>nil</External>')
			self.EstimatedBytes += #header
		end

		self.TotalEstimate = self:EstimateTotal(options)

		for serviceName, enabled in pairs(options.Services) do
			if self.Cancelled then break end
			if enabled then
				self:RecordStep("SERVICE -> " .. serviceName)
				local ok, service = pcall(game.GetService, game, serviceName)
				if ok and service then
					self:TraverseIterative(service, options, onProgress)
				end
			end
		end

		if not self.Cancelled and options.IncludeLocalPlayerData and Players.LocalPlayer then
			self:RecordStep("LOCAL_PLAYER")
			local lp = Players.LocalPlayer
			local pGui = lp:FindFirstChildOfClass("PlayerGui")
			if pGui then
				for _, child in ipairs(pGui:GetChildren()) do
					if self.Cancelled then break end
					self:TraverseIterative(child, options, onProgress)
				end
			end
			local pScripts = lp:FindFirstChild("PlayerScripts")
			if pScripts then
				for _, child in ipairs(pScripts:GetChildren()) do
					if self.Cancelled then break end
					self:TraverseIterative(child, options, onProgress)
				end
			end
		end

		if not self.Cancelled and options.NilInstances and typeof(getnilinstances) == "function" then
			self:RecordStep("NIL_INSTANCES")
			local nilOk, nilList = pcall(getnilinstances)
			if nilOk and type(nilList) == "table" then
				local nilFolderOpen = false
				for _, inst in ipairs(nilList) do
					if self.Cancelled then break end
					if typeof(inst) == "Instance" and inst.Parent == nil and not self:ShouldSkip(inst, options, 1) then
						if not nilFolderOpen then
							self:Emit('<Item class="Folder" referent="RBX_NIL_ROOT"><Properties><string name="Name">NilInstances</string></Properties>')
							nilFolderOpen = true
						end
						self.NilCount += 1
						self:TraverseIterative(inst, options, onProgress)
					end
				end
				if nilFolderOpen then
					self:Emit("</Item>")
				end
			end
		end

		if self.WriteError then
			local elapsedWriteFail = os.clock() - startClock
			self:WriteReport("ERROR_APPENDFILE: " .. tostring(self.WriteError), elapsedWriteFail, tostring(fileName))
			return false, tostring(self.WriteError), self.EstimatedBytes
		end

		self:EmitSharedStrings()
		self:Emit("</roblox>")
		local finalFlushOk, finalFlushError = self:Flush(true)
		if not finalFlushOk then
			local elapsedFlushFail = os.clock() - startClock
			self:WriteReport("ERROR_FINAL_FLUSH: " .. tostring(finalFlushError), elapsedFlushFail, tostring(fileName))
			return false, tostring(finalFlushError), self.EstimatedBytes
		end
		self:RecordStep("DONE")

		local elapsed = os.clock() - startClock
		local statusLabel = self.Cancelled and "CANCELLED" or "COMPLETED"

		if canStream and self.StreamFile then
			self:WriteReport(statusLabel, elapsed, self.StreamFile)
			return not self.Cancelled, self.StreamFile, self.EstimatedBytes
		elseif typeof(writefile) == "function" and fileName then
			local fullXml = table.concat(self.ChunkBuffer, "\n")
			clearTable(self.ChunkBuffer)
			local okW, errW = pcall(writefile, fileName, fullXml)
			if not okW or errW == false then
				self:WriteReport("ERROR_WRITEFILE", elapsed, fileName)
				return false, "Error writefile: " .. tostring(errW), #fullXml
			end
			self:WriteReport(statusLabel, elapsed, fileName)
			return not self.Cancelled, fileName, #fullXml
		else
			local fullXml = table.concat(self.ChunkBuffer, "\n")
			clearTable(self.ChunkBuffer)
			self:WriteReport(statusLabel, elapsed, "MEMORIA")
			return not self.Cancelled, "MEMORIA", #fullXml
		end
	end

	return self
end

return Serializer
