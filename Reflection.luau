-- Reflection.luau
local Reflection = {}

local Classes = {
	Instance = {
		Properties = {
			Name = "string",
			Archivable = "bool",
		}
	},

	-- Servicios y entorno
	Workspace = {
		Inherits = "Model",
		Properties = {
			Gravity = "float",
			FallenPartsDestroyHeight = "float",
			CurrentCamera = "Ref",
		}
	},
	Camera = {
		Inherits = "Instance",
		Properties = {
			CFrame = "CoordinateFrame",
			Focus = "CoordinateFrame",
			FieldOfView = "float",
			CameraType = "token",
			HeadLocked = "bool",
			HeadScale = "float",
		}
	},
	Terrain = {
		Inherits = "BasePart",
		Properties = {
			WaterColor = "Color3",
			WaterReflectance = "float",
			WaterTransparency = "float",
			WaterWaveSize = "float",
			WaterWaveSpeed = "float",
			Decoration = "bool",
			SmoothGrid = "BinaryString",
			MaterialColors = "BinaryString",
		}
	},
	Lighting = {
		Inherits = "Instance",
		Properties = {
			Ambient = "Color3",
			OutdoorAmbient = "Color3",
			ColorShift_Bottom = "Color3",
			ColorShift_Top = "Color3",
			Brightness = "float",
			ClockTime = "float",
			GeographicLatitude = "float",
			ExposureCompensation = "float",
			GlobalShadows = "bool",
			EnvironmentDiffuseScale = "float",
			EnvironmentSpecularScale = "float",
			ShadowSoftness = "float",
			Technology = "token",
			FogColor = "Color3",
			FogEnd = "float",
			FogStart = "float",
		}
	},
	MaterialService = { Inherits = "Instance", Properties = {} },
	MaterialVariant = {
		Inherits = "Instance",
		Properties = {
			BaseMaterial = "token",
			ColorMapContent = "Content",
			MetalnessMapContent = "Content",
			NormalMapContent = "Content",
			RoughnessMapContent = "Content",
			TexturePackContent = "Content",
			StudsPerTile = "Vector2",
		}
	},
	ReplicatedStorage = { Inherits = "Instance", Properties = {} },
	ReplicatedFirst = { Inherits = "Instance", Properties = {} },
	StarterGui = { Inherits = "Instance", Properties = {} },
	StarterPack = { Inherits = "Instance", Properties = {} },
	StarterPlayer = {
		Inherits = "Instance",
		Properties = {
			CharacterWalkSpeed = "float",
			CharacterJumpPower = "float",
			CharacterJumpHeight = "float",
			CharacterUseJumpPower = "bool",
			DevCameraOcclusionMode = "token",
			DevComputerCameraMode = "token",
			DevComputerMovementMode = "token",
		}
	},
	StarterPlayerScripts = { Inherits = "Instance", Properties = {} },
	StarterCharacterScripts = { Inherits = "Instance", Properties = {} },
	SoundService = {
		Inherits = "Instance",
		Properties = {
			AmbientReverb = "token",
			RespectFilteringEnabled = "bool",
			VolumetricAudio = "token",
		}
	},

	-- Partes, geometría y contenedores
	BasePart = {
		Inherits = "Instance",
		Properties = {
			CFrame = "CoordinateFrame",
			Size = "Vector3",
			Color = "Color3uint8",
			BrickColor = "BrickColor",
			Material = "token",
			Anchored = "bool",
			CanCollide = "bool",
			CanTouch = "bool",
			CanQuery = "bool",
			Massless = "bool",
			Transparency = "float",
			Reflectance = "float",
			CastShadow = "bool",
			CustomPhysicalProperties = "PhysicalProperties",
			MaterialVariant = "string",
		}
	},
	Part = { Inherits = "BasePart", Properties = { Shape = "token" } },
	WedgePart = { Inherits = "BasePart", Properties = {} },
	CornerWedgePart = { Inherits = "BasePart", Properties = {} },
	TrussPart = { Inherits = "BasePart", Properties = { Style = "token" } },
	Seat = { Inherits = "Part", Properties = { Disabled = "bool" } },
	VehicleSeat = {
		Inherits = "Part",
		Properties = {
			Disabled = "bool",
			MaxSpeed = "float",
			Torque = "float",
			TurnSpeed = "float",
		}
	},
	SpawnLocation = {
		Inherits = "Part",
		Properties = {
			Duration = "int",
			Neutral = "bool",
			Enabled = "bool",
			AllowTeamChangeOnTouch = "bool",
		}
	},
	-- TriangleMeshPart is the common base for MeshPart and solid-model parts.
	TriangleMeshPart = {
		Inherits = "BasePart",
		Properties = {
			-- Hidden geometry metadata may be readable through an executor's
			-- property bridge, but Roblox does not expose it to normal scripts.
			PhysicalConfigData = "SharedString",
			AeroMeshData = "SharedString",
		}
	},
	MeshPart = {
		Inherits = "TriangleMeshPart",
		Properties = {
			MeshContent = "Content",
			TextureContent = "Content",
			DoubleSided = "bool",
			RenderFidelity = "token",
		}
	},
	PartOperation = {
		Inherits = "TriangleMeshPart",
		Properties = {
			RenderFidelity = "token",
			SmoothingAngle = "float",
			UsePartColor = "bool",
			-- CSG backing data. ChildData/MeshData are legacy BinaryStrings;
			-- ChildData2/MeshData2 use SharedString in newer serialization.
			AssetId = "Content",
			Content = "Content",
			ChildData = "BinaryString",
			MeshData = "BinaryString",
			PhysicsData = "BinaryString",
			ChildData2 = "SharedString",
			MeshData2 = "SharedString",
			ComponentIndex = "int",
			InitialSize = "Vector3",
			OffCentered = "bool",
		}
	},
	UnionOperation = { Inherits = "PartOperation", Properties = {} },
	NegateOperation = { Inherits = "PartOperation", Properties = {} },
	IntersectOperation = { Inherits = "PartOperation", Properties = {} },
	Model = {
		Inherits = "Instance",
		Properties = {
			PrimaryPart = "Ref",
			WorldPivot = "CoordinateFrame",
		}
	},
	Folder = { Inherits = "Instance", Properties = {} },
	Tool = {
		Inherits = "Instance",
		Properties = {
			Grip = "CoordinateFrame",
			CanBeDropped = "bool",
			RequiresHandle = "bool",
			ToolTip = "string",
			Enabled = "bool",
		}
	},
	Backpack = { Inherits = "Instance", Properties = {} },

	-- Scripts
	BaseScript = {
		Inherits = "Instance",
		Properties = {
			Enabled = "bool",
			Source = "ProtectedString",
		}
	},
	Script = { Inherits = "BaseScript", Properties = {} },
	LocalScript = { Inherits = "BaseScript", Properties = {} },
	ModuleScript = {
		Inherits = "Instance",
		Properties = {
			Source = "ProtectedString",
		}
	},

	-- Accesorios y ropa 3D de avatares.
	Accoutrement = {
		Inherits = "Instance",
		Properties = {
			AttachmentForward = "Vector3",
			AttachmentPoint = "CoordinateFrame",
			AttachmentPos = "Vector3",
			AttachmentRight = "Vector3",
			AttachmentUp = "Vector3",
		}
	},
	Accessory = { Inherits = "Accoutrement", Properties = { AccessoryType = "token" } },
	Hat = { Inherits = "Accoutrement", Properties = {} },
	BaseWrap = {
		Inherits = "Instance",
		Properties = {
			CageMeshContent = "Content",
			CageOrigin = "CoordinateFrame",
			HSRContent = "Content",
			ImportOrigin = "CoordinateFrame",
		}
	},
	WrapLayer = {
		Inherits = "BaseWrap",
		Properties = {
			AutoSkin = "token",
			BindOffset = "CoordinateFrame",
			Color = "Color3",
			DebugMode = "token",
			Enabled = "bool",
			Order = "int",
			Puffiness = "float",
			ReferenceMeshContent = "Content",
			ReferenceOrigin = "CoordinateFrame",
			ShrinkFactor = "float",
		}
	},
	WrapTarget = {
		Inherits = "BaseWrap",
		Properties = { Color = "Color3", DebugMode = "token", Stiffness = "float" }
	},
	WrapDeformer = { Inherits = "BaseWrap", Properties = {} },

	-- Apariencia clásica de personajes (propiedades Content actuales).
	CharacterMesh = {
		Inherits = "Instance",
		Properties = {
			BodyPart = "token",
			MeshContent = "Content",
			BaseTextureContent = "Content",
			OverlayTextureContent = "Content",
		}
	},
	Shirt = { Inherits = "Instance", Properties = { ShirtTemplateContent = "Content" } },
	Pants = { Inherits = "Instance", Properties = { PantsTemplateContent = "Content" } },
	ShirtGraphic = { Inherits = "Instance", Properties = { TextureContent = "Content" } },
	BodyColors = {
		Inherits = "Instance",
		Properties = {
			HeadColor3 = "Color3",
			LeftArmColor3 = "Color3",
			LeftLegColor3 = "Color3",
			RightArmColor3 = "Color3",
			RightLegColor3 = "Color3",
			TorsoColor3 = "Color3",
		}
	},

	-- Rigs y Animaciones
	Humanoid = {
		Inherits = "Instance",
		Properties = {
			WalkSpeed = "float",
			JumpPower = "float",
			JumpHeight = "float",
			HipHeight = "float",
			MaxHealth = "float",
			Health = "float",
			RigType = "token",
			DisplayName = "string",
			RequiresNeck = "bool",
			AutoRotate = "bool",
		}
	},
	AnimationController = { Inherits = "Instance", Properties = {} },
	Animator = { Inherits = "Instance", Properties = {} },
	Animation = {
		Inherits = "Instance",
		Properties = {
			AnimationContent = "Content",
		}
	},
	KeyframeSequence = {
		Inherits = "Instance",
		Properties = {
			Loop = "bool",
			Priority = "token",
		}
	},
	Keyframe = {
		Inherits = "Instance",
		Properties = {
			Time = "float",
		}
	},
	Pose = {
		Inherits = "Instance",
		Properties = {
			CFrame = "CoordinateFrame",
			Weight = "float",
			EasingStyle = "token",
			EasingDirection = "token",
		}
	},

	-- Apariencia, efectos visuales, iluminación y audio
	SurfaceAppearance = {
		Inherits = "Instance",
		Properties = {
			ColorMapContent = "Content",
			NormalMapContent = "Content",
			RoughnessMapContent = "Content",
			MetalnessMapContent = "Content",
			TexturePackContent = "Content",
			AlphaMode = "token",
		}
	},
	DataModelMesh = {
		Inherits = "Instance",
		Properties = {
			Scale = "Vector3",
			Offset = "Vector3",
			VertexColor = "Vector3",
		}
	},
	FileMesh = {
		Inherits = "DataModelMesh",
		Properties = {
			MeshContent = "Content",
			TextureContent = "Content",
		}
	},
	SpecialMesh = {
		Inherits = "FileMesh",
		Properties = { MeshType = "token" },
	},
	Decal = {
		Inherits = "Instance",
		Properties = {
			TextureContent = "Content",
			Face = "token",
			Transparency = "float",
			Color3 = "Color3",
			ZIndex = "int",
		}
	},
	Texture = {
		Inherits = "Decal",
		Properties = {
			StudsPerTileU = "float",
			StudsPerTileV = "float",
		}
	},
	ParticleEmitter = {
		Inherits = "Instance",
		Properties = {
			TextureContent = "Content",
			Color = "ColorSequence",
			Size = "NumberSequence",
			Squash = "NumberSequence",
			Transparency = "NumberSequence",
			Lifetime = "NumberRange",
			Rate = "float",
			Speed = "NumberRange",
			SpreadAngle = "Vector2",
			Rotation = "NumberRange",
			RotSpeed = "NumberRange",
			LightEmission = "float",
			LightInfluence = "float",
			Drag = "float",
			Acceleration = "Vector3",
			Enabled = "bool",
			LockedToPart = "bool",
			ZOffset = "float",
		}
	},
	Beam = {
		Inherits = "Instance",
		Properties = {
			TextureContent = "Content",
			TextureSpeed = "float",
			TextureLength = "float",
			Color = "ColorSequence",
			Width0 = "float",
			Width1 = "float",
			CurveSize0 = "float",
			CurveSize1 = "float",
			Segments = "int",
			FaceCamera = "bool",
			LightEmission = "float",
			Transparency = "NumberSequence",
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
		}
	},
	Trail = {
		Inherits = "Instance",
		Properties = {
			TextureContent = "Content",
			Color = "ColorSequence",
			Lifetime = "float",
			MinLength = "float",
			MaxLength = "float",
			WidthScale = "float",
			Transparency = "NumberSequence",
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
			FaceCamera = "bool",
		}
	},
	PointLight = {
		Inherits = "Instance",
		Properties = {
			Color = "Color3",
			Brightness = "float",
			Range = "float",
			Enabled = "bool",
			Shadows = "bool",
		}
	},
	SpotLight = {
		Inherits = "Instance",
		Properties = {
			Color = "Color3",
			Brightness = "float",
			Range = "float",
			Angle = "float",
			Face = "token",
			Enabled = "bool",
			Shadows = "bool",
		}
	},
	SurfaceLight = {
		Inherits = "Instance",
		Properties = {
			Color = "Color3",
			Brightness = "float",
			Range = "float",
			Angle = "float",
			Face = "token",
			Enabled = "bool",
			Shadows = "bool",
		}
	},
	Atmosphere = {
		Inherits = "Instance",
		Properties = {
			Density = "float",
			Offset = "float",
			Color = "Color3",
			Decay = "Color3",
			Glare = "float",
			Haze = "float",
		}
	},
	Sky = {
		Inherits = "Instance",
		Properties = {
			SkyboxBackContent = "Content",
			SkyboxDownContent = "Content",
			SkyboxFrontContent = "Content",
			SkyboxLeftContent = "Content",
			SkyboxRightContent = "Content",
			SkyboxUpContent = "Content",
			SunTextureContent = "Content",
			MoonTextureContent = "Content",
			SunAngularSize = "float",
			MoonAngularSize = "float",
			CelestialBodiesShown = "bool",
			StarCount = "int",
		}
	},
	Clouds = {
		Inherits = "Instance",
		Properties = {
			Cover = "float",
			Density = "float",
			Color = "Color3",
			Enabled = "bool",
		}
	},
	BloomEffect = { Inherits = "Instance", Properties = { Enabled = "bool", Intensity = "float", Size = "float", Threshold = "float" } },
	ColorCorrectionEffect = { Inherits = "Instance", Properties = { Enabled = "bool", TintColor = "Color3", Brightness = "float", Contrast = "float", Saturation = "float" } },
	SunRaysEffect = { Inherits = "Instance", Properties = { Enabled = "bool", Intensity = "float", Spread = "float" } },
	BlurEffect = { Inherits = "Instance", Properties = { Enabled = "bool", Size = "float" } },
	DepthOfFieldEffect = { Inherits = "Instance", Properties = { Enabled = "bool", FarIntensity = "float", FocusDistance = "float", InFocusRadius = "float", NearIntensity = "float" } },
	Sound = {
		Inherits = "Instance",
		Properties = {
			AudioContent = "Content",
			Volume = "float",
			PlaybackSpeed = "float",
			Looped = "bool",
			PlayOnRemove = "bool",
			RollOffMinDistance = "float",
			RollOffMaxDistance = "float",
			RollOffMode = "token",
		}
	},
	SoundGroup = { Inherits = "Instance", Properties = { Volume = "float" } },
	EqualizerSoundEffect = { Inherits = "Instance", Properties = { HighGain = "float", LowGain = "float", MidGain = "float", Enabled = "bool" } },
	ReverbSoundEffect = { Inherits = "Instance", Properties = { DecayTime = "float", Density = "float", Diffusion = "float", DryLevel = "float", WetLevel = "float", Enabled = "bool" } },

	-- Física, attachments y conexiones
	Attachment = { Inherits = "Instance", Properties = { CFrame = "CoordinateFrame", Visible = "bool" } },
	Weld = { Inherits = "Instance", Properties = { Part0 = "Ref", Part1 = "Ref", C0 = "CoordinateFrame", C1 = "CoordinateFrame", Enabled = "bool" } },
	WeldConstraint = { Inherits = "Instance", Properties = { Part0 = "Ref", Part1 = "Ref", Enabled = "bool" } },
	Motor6D = { Inherits = "Instance", Properties = { Part0 = "Ref", Part1 = "Ref", C0 = "CoordinateFrame", C1 = "CoordinateFrame", Enabled = "bool" } },
	HingeConstraint = {
		Inherits = "Instance",
		Properties = {
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
			ActuatorType = "token",
			AngularSpeed = "float",
			MotorMaxTorque = "float",
			TargetAngle = "float",
		}
	},
	SpringConstraint = {
		Inherits = "Instance",
		Properties = {
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
			Coils = "float",
			Damping = "float",
			FreeLength = "float",
			LimitsEnabled = "bool",
			MaxLength = "float",
			MinLength = "float",
			Stiffness = "float",
		}
	},
	RopeConstraint = {
		Inherits = "Instance",
		Properties = {
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
			Length = "float",
			Restitution = "float",
		}
	},
	RodConstraint = {
		Inherits = "Instance",
		Properties = {
			Attachment0 = "Ref",
			Attachment1 = "Ref",
			Enabled = "bool",
			Length = "float",
			Thickness = "float",
		}
	},
	ProximityPrompt = {
		Inherits = "Instance",
		Properties = {
			ActionText = "string",
			ObjectText = "string",
			KeyboardKeyCode = "token",
			GamepadKeyCode = "token",
			HoldDuration = "float",
			MaxActivationDistance = "float",
			RequiresLineOfSight = "bool",
			ClickablePrompt = "bool",
			Enabled = "bool",
			Style = "token",
		}
	},
	ClickDetector = { Inherits = "Instance", Properties = { MaxActivationDistance = "float", CursorIconContent = "Content" } },
	RemoteEvent = { Inherits = "Instance", Properties = {} },
	RemoteFunction = { Inherits = "Instance", Properties = {} },
	BindableEvent = { Inherits = "Instance", Properties = {} },
	BindableFunction = { Inherits = "Instance", Properties = {} },

	-- ValueObjects
	StringValue = { Inherits = "Instance", Properties = { Value = "string" } },
	IntValue = { Inherits = "Instance", Properties = { Value = "int64" } },
	NumberValue = { Inherits = "Instance", Properties = { Value = "double" } },
	BoolValue = { Inherits = "Instance", Properties = { Value = "bool" } },
	ObjectValue = { Inherits = "Instance", Properties = { Value = "Ref" } },
	Color3Value = { Inherits = "Instance", Properties = { Value = "Color3" } },
	Vector3Value = { Inherits = "Instance", Properties = { Value = "Vector3" } },
	CFrameValue = { Inherits = "Instance", Properties = { Value = "CoordinateFrame" } },

	-- UI
	ScreenGui = {
		Inherits = "Instance",
		Properties = {
			Enabled = "bool",
			ResetOnSpawn = "bool",
			DisplayOrder = "int",
			IgnoreGuiInset = "bool",
			ZIndexBehavior = "token",
		}
	},
	BillboardGui = {
		Inherits = "Instance",
		Properties = {
			Enabled = "bool",
			Size = "UDim2",
			StudsOffset = "Vector3",
			StudsOffsetWorldSpace = "Vector3",
			AlwaysOnTop = "bool",
			MaxDistance = "float",
			Active = "bool",
		}
	},
	SurfaceGui = {
		Inherits = "Instance",
		Properties = {
			Enabled = "bool",
			Face = "token",
			AlwaysOnTop = "bool",
			SizingMode = "token",
			PixelsPerStud = "float",
		}
	},
	GuiObject = {
		Inherits = "Instance",
		Properties = {
			Position = "UDim2",
			Size = "UDim2",
			AnchorPoint = "Vector2",
			Rotation = "float",
			BackgroundColor3 = "Color3",
			BackgroundTransparency = "float",
			BorderColor3 = "Color3",
			BorderSizePixel = "int",
			Visible = "bool",
			ZIndex = "int",
			LayoutOrder = "int",
			ClipsDescendants = "bool",
		}
	},
	Frame = { Inherits = "GuiObject", Properties = {} },
	ViewportFrame = {
		Inherits = "GuiObject",
		Properties = {
			ImageColor3 = "Color3",
			ImageTransparency = "float",
			Ambient = "Color3",
			LightColor = "Color3",
			LightDirection = "Vector3",
			CurrentCamera = "Ref",
		}
	},
	ScrollingFrame = {
		Inherits = "GuiObject",
		Properties = {
			BottomImageContent = "Content",
			MidImageContent = "Content",
			TopImageContent = "Content",
			CanvasSize = "UDim2",
			CanvasPosition = "Vector2",
			ScrollBarThickness = "int",
			ScrollBarImageColor3 = "Color3",
			ScrollBarImageTransparency = "float",
			ScrollingDirection = "token",
			AutomaticCanvasSize = "token",
		}
	},
	TextLabel = {
		Inherits = "GuiObject",
		Properties = {
			Text = "string",
			TextColor3 = "Color3",
			TextTransparency = "float",
			TextSize = "float",
			TextScaled = "bool",
			TextWrapped = "bool",
			RichText = "bool",
			Font = "token",
			TextXAlignment = "token",
			TextYAlignment = "token",
		}
	},
	TextButton = {
		Inherits = "TextLabel",
		Properties = {
			AutoButtonColor = "bool",
			Modal = "bool",
		}
	},
	TextBox = {
		Inherits = "TextLabel",
		Properties = {
			PlaceholderText = "string",
			PlaceholderColor3 = "Color3",
			ClearTextOnFocus = "bool",
			MultiLine = "bool",
		}
	},
	ImageLabel = {
		Inherits = "GuiObject",
		Properties = {
			ImageContent = "Content",
			ImageColor3 = "Color3",
			ImageTransparency = "float",
			ImageRectOffset = "Vector2",
			ImageRectSize = "Vector2",
			ScaleType = "token",
			SliceCenter = "Rect",
			SliceScale = "float",
		}
	},
	ImageButton = {
		Inherits = "ImageLabel",
		Properties = {
			AutoButtonColor = "bool",
			HoverImageContent = "Content",
			PressedImageContent = "Content",
		}
	},
	UICorner = { Inherits = "Instance", Properties = { CornerRadius = "UDim" } },
	UIStroke = {
		Inherits = "Instance",
		Properties = {
			Color = "Color3",
			Thickness = "float",
			Transparency = "float",
			ApplyStrokeMode = "token",
			LineJoinMode = "token",
			Enabled = "bool",
		}
	},
	UIGradient = {
		Inherits = "Instance",
		Properties = {
			Color = "ColorSequence",
			Transparency = "NumberSequence",
			Rotation = "float",
			Offset = "Vector2",
			Enabled = "bool",
		}
	},
	UIPadding = {
		Inherits = "Instance",
		Properties = {
			PaddingTop = "UDim",
			PaddingBottom = "UDim",
			PaddingLeft = "UDim",
			PaddingRight = "UDim",
		}
	},
	UIAspectRatioConstraint = {
		Inherits = "Instance",
		Properties = {
			AspectRatio = "float",
			AspectType = "token",
			DominantAxis = "token",
		}
	},
	UISizeConstraint = {
		Inherits = "Instance",
		Properties = {
			MinSize = "Vector2",
			MaxSize = "Vector2",
		}
	},
	UITextSizeConstraint = {
		Inherits = "Instance",
		Properties = {
			MinTextSize = "int",
			MaxTextSize = "int",
		}
	},
	UIListLayout = {
		Inherits = "Instance",
		Properties = {
			Padding = "UDim",
			FillDirection = "token",
			HorizontalAlignment = "token",
			VerticalAlignment = "token",
			SortOrder = "token",
		}
	},
	UIGridLayout = {
		Inherits = "Instance",
		Properties = {
			CellSize = "UDim2",
			CellPadding = "UDim2",
			FillDirection = "token",
			FillDirectionMaxCells = "int",
			HorizontalAlignment = "token",
			VerticalAlignment = "token",
			SortOrder = "token",
		}
	},
}

-- Compatibility aliases: read legacy property names only when the new Content
-- property cannot be read. The output always uses the modern Content property name.
Reflection.LegacyContentAliases = {
	MeshPart = { MeshContent = "MeshId", TextureContent = "TextureID" },
	SpecialMesh = { MeshContent = "MeshId", TextureContent = "TextureId" },
	FileMesh = { MeshContent = "MeshId", TextureContent = "TextureId" },
	SurfaceAppearance = {
		ColorMapContent = "ColorMap", NormalMapContent = "NormalMap",
		RoughnessMapContent = "RoughnessMap", MetalnessMapContent = "MetalnessMap",
	},
	MaterialVariant = {
		ColorMapContent = "ColorMap", NormalMapContent = "NormalMap",
		RoughnessMapContent = "RoughnessMap", MetalnessMapContent = "MetalnessMap",
		TexturePackContent = "TexturePack",
	},
	Decal = { TextureContent = "Texture" },
	ParticleEmitter = { TextureContent = "Texture" },
	Beam = { TextureContent = "Texture" },
	Trail = { TextureContent = "Texture" },
	Sky = {
		SkyboxBackContent = "SkyboxBk", SkyboxDownContent = "SkyboxDn",
		SkyboxFrontContent = "SkyboxFt", SkyboxLeftContent = "SkyboxLf",
		SkyboxRightContent = "SkyboxRt", SkyboxUpContent = "SkyboxUp",
		SunTextureContent = "SunTextureId", MoonTextureContent = "MoonTextureId",
	},
	Sound = { AudioContent = "SoundId" },
	Animation = { AnimationContent = "AnimationId" },
	ClickDetector = { CursorIconContent = "CursorIcon" },
	ImageLabel = { ImageContent = "Image" },
	ScrollingFrame = {
		BottomImageContent = "BottomImage", MidImageContent = "MidImage", TopImageContent = "TopImage",
	},
	Texture = { TextureContent = "Texture" },
	ImageButton = {
		ImageContent = "Image", HoverImageContent = "HoverImage", PressedImageContent = "PressedImage",
	},
	Shirt = { ShirtTemplateContent = "ShirtTemplate" },
	Pants = { PantsTemplateContent = "PantsTemplate" },
	ShirtGraphic = { TextureContent = "Graphic" },
	CharacterMesh = {
		MeshContent = "MeshId", BaseTextureContent = "BaseTextureId",
		OverlayTextureContent = "OverlayTextureId",
	},
	BaseWrap = { CageMeshContent = "CageMeshId", HSRContent = "HSRAssetId" },
	WrapLayer = {
		CageMeshContent = "CageMeshId", HSRContent = "HSRAssetId",
		ReferenceMeshContent = "ReferenceMeshId",
	},
	WrapTarget = { CageMeshContent = "CageMeshId", HSRContent = "HSRAssetId" },
	WrapDeformer = { CageMeshContent = "CageMeshId", HSRContent = "HSRAssetId" },
}

local ResolvedCache = {}

function Reflection.GetProperties(className: string)
	if ResolvedCache[className] then
		return ResolvedCache[className]
	end

	local props = {}
	local current = className
	while current and Classes[current] do
		for k, v in pairs(Classes[current].Properties) do
			if props[k] == nil then
				props[k] = v
			end
		end
		current = Classes[current].Inherits
	end

	if next(props) == nil then
		return nil
	end

	ResolvedCache[className] = props
	return props
end

return Reflection
