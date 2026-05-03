import { Input, Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../../camera/follow_camera';
import type { PfPlayer } from '../../player/PfPlayer';
import type {
    TestWorldBackgroundConfig,
    TestWorldBackgroundImageConfig,
    TestWorldConfig,
    TestWorldParallaxLayerConfig,
    TestWorldVisualLayer,
    TestWorldVisualOrderConfig
} from './test_world_config';
import { createDefaultTestWorldConfig, parseTestWorldConfigJson } from './test_world_config_validation';
import {
    TEST_WORLD_EDITOR_ADAPTERS,
    TEST_WORLD_EDITOR_PALETTE,
    type TestWorldEditorBounds,
    type TestWorldEditorObjectType,
    type TestWorldEditorSelectionPart
} from './test_world_editor_adapters';
import {
    TestWorldEditorSidebar,
    type TestWorldEditorLogicTabId,
    type TestWorldEditorSidebarSection,
    type TestWorldEditorSidebarState,
    type TestWorldEditorTabId
} from './test_world_editor_sidebar';
import {
    applyTriggerEventEditorAction,
    applyTriggerEventEditorFieldChange,
    buildTriggerEventEditorSections
} from './test_world_event_authoring_editor';
import {
    applyWorldLogicRuleEditorAction,
    applyWorldLogicRuleEditorFieldChange,
    buildWorldLogicRuleEditorSections
} from './test_world_logic_rules_editor';
import {
    clearTestWorldEditorDraft,
    getTestWorldEditorDraftStorageAuditSnapshot,
    saveTestWorldEditorDraft
} from './test_world_editor_storage';
import {
    createCampaignLevel,
    deleteCampaignLevel,
    getCampaignLevelSummaries,
    syncCampaignLevelHeader,
    type CampaignLevelConfigSource
} from './test_campaign_registry';
import type { TestWorldEditorHandle, TestWorldRuntime } from './test_world_runtime';
import { TestScene } from '../../../scenes/TestScene';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../../shared/dom_input_focus';
import { createAuthoringEditorV2Entrypoint } from '../../authoring/editor_v2/AuthoringEditorV2Entrypoint';
import { createAuthoringEditorPhaserOverlay } from '../../../tools/authoring_editor/authoring_editor_phaser_overlay';
import type {
    AuthoringEditorObjectSummary,
    AuthoringEditorRuntimeBridge
} from '../../../tools/authoring_editor/authoring_editor_runtime_bridge';
import {
    resolveTestHudAnchorPosition,
    TEST_EDITOR_BACKGROUND_BADGE_LAYOUT,
    TEST_EDITOR_HELP_OVERLAY_LAYOUT
} from '../../../ui/runtime/test_hud_layout';
import { buildReferenceIndexFromTestAuthoringContent } from '../../authoring/registry/reference_index';
import { validateLevelAsset } from '../../level_authoring/level_asset_validation';
import { adaptTestWorldConfigToLevelAsset } from '../../level_authoring/test_world_to_level_asset_adapter';
import {
    getTestNpcProfiles,
    resolveTestNpcConfig
} from '../../npc/npc_profiles';
import {
    TEST_NPC_MANPU_EMOTION_OPTIONS,
    resolveTestNpcManpuEmotion
} from '../../npc/npc_manpu';
import {
    TEST_NPC_SCRIPTED_SEQUENCE_ACTION_KINDS,
    cloneTestNpcScriptedSequenceAction,
    cloneTestNpcScriptedSequenceDefinition,
    getDefaultTestNpcScriptedSequenceDefinitions,
    getTestNpcScriptedSequenceRegistryAuditSnapshot,
    getTestNpcScriptedSequenceDefinitions,
    getTestNpcScriptedSequenceRefs,
    parseTestNpcScriptedSequenceDefinitionsJson,
    setTestNpcScriptedSequenceDefinitions,
    type TestNpcScriptedSequenceDefinition,
    type TestNpcScriptedSequenceActionKind,
    validateTestNpcScriptedSequenceId
} from '../../npc/npc_scripted_sequences';
import {
    TEST_CUTSCENE_STEP_KINDS,
    getDefaultTestCutsceneDefinitions,
    getTestCutsceneDefinitions,
    getTestCutsceneRefs,
    getTestCutsceneRegistryAuditSnapshot,
    parseTestCutsceneDefinitionsJson,
    setTestCutsceneDefinitions,
    validateTestCutsceneId
} from '../../cutscene/test_cutscene_registry';
import {
    clearTestNpcScriptedSequenceDraft,
    getTestNpcScriptedSequenceDraftStorageAuditSnapshot,
    markTestNpcScriptedSequenceDraftRestoredDefault,
    saveTestNpcScriptedSequenceDraft
} from '../../npc/npc_scripted_sequence_storage';
import {
    clearTestCutsceneDraft,
    getTestCutsceneDraftStorageAuditSnapshot,
    markTestCutsceneDraftRestoredDefault,
    saveTestCutsceneDraft
} from '../../cutscene/cutscene_storage';
import type { ActorAction } from '../../actor_actions/actor_action_types';
import type { TestWorldLogicRule } from '../../events/test_world_logic_rules';
import type {
    TestCutsceneDefinition,
    TestCutsceneActorSequenceRefStep,
    TestCutsceneCameraFocusActorStep,
    TestCutsceneCameraPanToStep,
    TestCutscenePlaySfxStep,
    TestCutsceneSetEmotionStep,
    TestCutsceneSpawnVfxStep,
    TestCutsceneStep,
    TestCutsceneSubtitleStep,
    TestCutsceneWaitStep
} from '../../cutscene/cutscene_types';
import { getWorldFlagsDebugSnapshot } from '../../events/test_world_flags';
import { createEventDebugRecorder } from '../../debug/event_debug_recorder';
import type { EventDebugRecordInput } from '../../debug/event_debug_types';
import {
    TEST_WORLD_VISUAL_LAYER_OPTIONS,
    resolveTestWorldRenderOrder,
    resolveTestWorldVisualLayer
} from './test_world_visual_order';
import { createEventTimelinePanel } from '../../../tools/authoring_editor/panels/event_timeline_panel';

export interface TestWorldEditorRuntime {
    update: (deltaMs: number) => void;
    isActive: () => boolean;
    open: () => void;
    close: () => void;
    destroy: () => void;
}

export interface TestWorldLevelSourceContext {
    bundledDefaultConfig: TestWorldConfig;
    campaignDefaultConfig: TestWorldConfig;
    campaignConfigSource: CampaignLevelConfigSource;
    initialWorldLoadSource: 'draft' | 'default';
    initialDraftPresent: boolean;
    initialWorldLoadError: string | null;
}

type DragMode = 'move' | 'resize' | 'pan';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface PointerDragState {
    mode: DragMode;
    handle?: ResizeHandle;
    startWorldX: number;
    startWorldY: number;
    startScrollX: number;
    startScrollY: number;
    initialBounds?: TestWorldEditorBounds;
}

interface EditorCameraSnapshot {
    scrollX: number;
    scrollY: number;
    zoom: number;
}

type BackgroundSelectionId = 'static' | 'layer_1' | 'layer_2';

interface BackgroundEditorHandle {
    id: BackgroundSelectionId;
    label: string;
    bounds: TestWorldEditorBounds;
}

const GRID_SIZES = [1, 8, 16, 32] as const;
const RESIZE_HANDLE_SIZE = 10;
const CAMERA_PAN_SPEED = 480;
const ZOOM_STEP = 0.08;
const DRAFT_AUTOSAVE_DELAY_MS = 500;
const PLACEMENT_PREVIEW_SIZE = 18;
const MIN_EDITOR_RECT_SIZE = 8;
const EDITOR_FALLBACK_BACKGROUND_COLOR = 0x263238;
const RULER_THICKNESS_PX = 20;
const DEFAULT_SEQUENCE_ID_PREFIX = 'scripted_sequence';
const DEFAULT_CUTSCENE_ID_PREFIX = 'cutscene';
const NPC_INITIAL_MANPU_OPTIONS = TEST_NPC_MANPU_EMOTION_OPTIONS.filter((option) => option.value !== 'calm');
const NPC_SET_EMOTION_OPTIONS = TEST_NPC_MANPU_EMOTION_OPTIONS.filter((option) => option.value !== 'none');

const createDefaultScriptedSequenceAction = (
    kind: TestNpcScriptedSequenceActionKind
): ActorAction => {
    if (kind === 'wait') {
        return {
            kind,
            ref: 'wait_step',
            durationMs: 500
        };
    }
    if (kind === 'face') {
        return {
            kind,
            ref: 'face_right',
            facing: 1
        };
    }
    if (kind === 'walk_to_x') {
        return {
            kind,
            ref: 'walk_target',
            targetX: 0,
            moveSpeed: 32,
            tolerancePx: 2
        };
    }
    if (kind === 'play_animation') {
        return {
            kind,
            ref: 'anim_step',
            animationId: 'wave'
        };
    }
    if (kind === 'set_emotion') {
        return {
            kind,
            ref: 'emotion_step',
            emotionId: 'calm'
        };
    }
    return {
        kind,
        ref: 'event_step',
        eventId: 'npc_event',
        payload: undefined
    };
};

const cloneScriptedSequenceDefinitions = (
    definitions: readonly TestNpcScriptedSequenceDefinition[]
): TestNpcScriptedSequenceDefinition[] => {
    return definitions.map(cloneTestNpcScriptedSequenceDefinition);
};

const describeSequenceAction = (action: ActorAction, index: number): string => {
    if (action.kind === 'wait') {
        return `${index + 1}. wait ${Math.round(action.durationMs)}ms`;
    }
    if (action.kind === 'face') {
        return `${index + 1}. face ${action.facing < 0 ? 'left' : 'right'}`;
    }
    if (action.kind === 'walk_to_x') {
        return `${index + 1}. walk_to_x x=${action.targetX}`;
    }
    if (action.kind === 'play_animation') {
        return `${index + 1}. play_animation ${action.animationId}`;
    }
    if (action.kind === 'set_emotion') {
        return `${index + 1}. set_emotion ${action.emotionId}`;
    }
    return `${index + 1}. trigger_event ${action.eventId}`;
};

const createNextScriptedSequenceId = (
    definitions: readonly TestNpcScriptedSequenceDefinition[]
): string => {
    const usedIds = new Set(definitions.map((entry) => entry.id));
    const defaultIds = new Set(getDefaultTestNpcScriptedSequenceDefinitions().map((entry) => entry.id));
    let nextIndex = 1;
    let candidate = `${DEFAULT_SEQUENCE_ID_PREFIX}_${nextIndex}`;
    while (usedIds.has(candidate) || defaultIds.has(candidate)) {
        nextIndex += 1;
        candidate = `${DEFAULT_SEQUENCE_ID_PREFIX}_${nextIndex}`;
    }
    return candidate;
};

const createDefaultCutsceneStep = (
    kind: typeof TEST_CUTSCENE_STEP_KINDS[number]
): TestCutsceneStep => {
    if (kind === 'lock_input' || kind === 'unlock_input') {
        return { kind, ref: `${kind}_step` };
    }
    if (kind === 'camera_focus_actor') {
        return {
            kind,
            ref: 'focus_actor_step',
            actorId: 'player',
            durationMs: 280
        };
    }
    if (kind === 'camera_pan_to') {
        return {
            kind,
            ref: 'camera_pan_step',
            x: 0,
            y: 0,
            durationMs: 500,
            ease: 'Sine.easeInOut'
        };
    }
    if (kind === 'wait') {
        return {
            kind,
            ref: 'wait_step',
            durationMs: 500
        };
    }
    if (kind === 'play_sfx') {
        return {
            kind,
            ref: 'play_sfx_step',
            sfxId: 'sfx_id'
        };
    }
    if (kind === 'spawn_vfx') {
        return {
            kind,
            ref: 'spawn_vfx_step',
            vfxId: 'vfx_id'
        };
    }
    if (kind === 'subtitle') {
        return {
            kind,
            ref: 'subtitle_step',
            text: 'Subtitle',
            durationMs: 900
        };
    }
    if (kind === 'set_emotion') {
        return {
            kind,
            ref: 'set_emotion_step',
            actorId: 'npc_actor',
            emotionId: 'sparkles'
        };
    }
    return {
        kind,
        ref: 'actor_sequence_step',
        actorId: 'npc_actor',
        sequenceRef: 'sequence_ref'
    };
};

const cloneCutsceneStep = (step: TestCutsceneStep): TestCutsceneStep => ({ ...step });

const cloneCutsceneDefinition = (definition: TestCutsceneDefinition): TestCutsceneDefinition => ({
    id: definition.id,
    mode: definition.mode,
    steps: definition.steps.map(cloneCutsceneStep)
});

const cloneCutsceneDefinitions = (
    definitions: readonly TestCutsceneDefinition[]
): TestCutsceneDefinition[] => {
    return definitions.map(cloneCutsceneDefinition);
};

const describeCutsceneStep = (step: TestCutsceneStep, index: number): string => {
    if (step.kind === 'lock_input' || step.kind === 'unlock_input') {
        return `${index + 1}. ${step.kind}`;
    }
    if (step.kind === 'camera_focus_actor') {
        return `${index + 1}. camera_focus_actor actor=${step.actorId}`;
    }
    if (step.kind === 'camera_pan_to') {
        return `${index + 1}. camera_pan_to x=${Math.round(step.x)} y=${Math.round(step.y)}`;
    }
    if (step.kind === 'wait') {
        return `${index + 1}. wait ${Math.round(step.durationMs)}ms`;
    }
    if (step.kind === 'play_sfx') {
        return `${index + 1}. play_sfx ${step.sfxId}`;
    }
    if (step.kind === 'spawn_vfx') {
        return `${index + 1}. spawn_vfx ${step.vfxId}`;
    }
    if (step.kind === 'subtitle') {
        return `${index + 1}. subtitle "${step.text}"`;
    }
    if (step.kind === 'set_emotion') {
        return `${index + 1}. set_emotion ${step.actorId}:${step.emotionId}`;
    }
    return `${index + 1}. actor_sequence_ref ${step.actorId}:${step.sequenceRef}`;
};

const createNextCutsceneId = (
    definitions: readonly TestCutsceneDefinition[]
): string => {
    const usedIds = new Set(definitions.map((entry) => entry.id));
    const defaultIds = new Set(getDefaultTestCutsceneDefinitions().map((entry) => entry.id));
    let nextIndex = 1;
    let candidate = `${DEFAULT_CUTSCENE_ID_PREFIX}_${nextIndex}`;
    while (usedIds.has(candidate) || defaultIds.has(candidate)) {
        nextIndex += 1;
        candidate = `${DEFAULT_CUTSCENE_ID_PREFIX}_${nextIndex}`;
    }
    return candidate;
};

interface TestWorldEditorEdges {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface TestWorldPlacementPreviewRect {
    bounds: TestWorldEditorBounds;
    part: TestWorldEditorSelectionPart;
}

interface TestWorldPlacementPreview {
    anchorX: number;
    anchorY: number;
    rects: TestWorldPlacementPreviewRect[];
}

type BackgroundLevelFieldKey =
    | 'backgroundColor'
    | 'backgroundStaticTextureKey'
    | 'backgroundStaticTextureAsset'
    | 'backgroundStaticFillColor'
    | 'backgroundStaticTintColor'
    | 'backgroundStaticAlpha'
    | 'backgroundStaticScale'
    | 'backgroundStaticWidth'
    | 'backgroundStaticHeight'
    | 'backgroundStaticRepeat'
    | 'backgroundStaticX'
    | 'backgroundStaticY'
    | `backgroundLayer${1 | 2}TextureKey`
    | `backgroundLayer${1 | 2}TextureAsset`
    | `backgroundLayer${1 | 2}FillColor`
    | `backgroundLayer${1 | 2}TintColor`
    | `backgroundLayer${1 | 2}Alpha`
    | `backgroundLayer${1 | 2}Scale`
    | `backgroundLayer${1 | 2}Width`
    | `backgroundLayer${1 | 2}Repeat`
    | `backgroundLayer${1 | 2}X`
    | `backgroundLayer${1 | 2}Y`
    | `backgroundLayer${1 | 2}Height`
    | `backgroundLayer${1 | 2}ScrollFactorX`
    | `backgroundLayer${1 | 2}ScrollFactorY`;

const EDITOR_BACKGROUND_LAYER_COUNT = 2;

const sanitizeOptionalText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const clampUnitInterval = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(1, value));
};

const clampPositiveScale = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0.1, Math.min(8, value));
};

const clampScrollFactor = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(2, value));
};

const clampBackgroundColor = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const createDefaultBackgroundLayer = (index: number): TestWorldParallaxLayerConfig => ({
    id: `layer_${index + 1}`,
    textureKey: '',
    x: 0,
    y: 220 + (index * 180),
    width: 1920,
    height: 256,
    repeat: true,
    scrollFactorX: 0.25 + (index * 0.2),
    scrollFactorY: 0.25 + (index * 0.2),
    alpha: 1,
    scale: 1
});

const cloneBackgroundLayer = (layer: TestWorldParallaxLayerConfig | undefined, index: number): TestWorldParallaxLayerConfig => ({
    ...createDefaultBackgroundLayer(index),
    ...layer
});

const cloneStaticBackgroundImage = (image: TestWorldBackgroundImageConfig | undefined): TestWorldBackgroundImageConfig => ({
    textureKey: image?.textureKey ?? '',
    textureAsset: image?.textureAsset,
    tintColor: image?.tintColor,
    alpha: image?.alpha ?? 1,
    scale: image?.scale ?? 1,
    width: image?.width ?? 1600,
    height: image?.height ?? 900,
    repeat: image?.repeat ?? false,
    fillColor: image?.fillColor,
    x: image?.x ?? 0,
    y: image?.y ?? 0
});

const getEditableBackground = (config: TestWorldConfig): TestWorldBackgroundConfig => {
    const background = config.background;
    if (!background) {
        return {
            color: EDITOR_FALLBACK_BACKGROUND_COLOR,
            staticImage: cloneStaticBackgroundImage(undefined),
            layers: Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => createDefaultBackgroundLayer(index))
        };
    }

    const layers = Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => {
        return cloneBackgroundLayer(background.layers?.[index], index);
    });

    return {
        color: background.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR,
        staticImage: cloneStaticBackgroundImage(background.staticImage),
        layers
    };
};

const compactBackgroundImage = (image: TestWorldBackgroundImageConfig): TestWorldBackgroundImageConfig | undefined => {
    const textureKey = sanitizeOptionalText(image.textureKey) ?? '';
    const textureAsset = sanitizeOptionalText(image.textureAsset);
    const fillColor = image.fillColor;
    const hasContent = textureKey.length > 0 || textureAsset !== undefined || fillColor !== undefined;
    if (!hasContent) {
        return undefined;
    }

    return {
        textureKey,
        textureAsset,
        tintColor: image.tintColor,
        alpha: clampUnitInterval(image.alpha ?? 1, 1),
        scale: clampPositiveScale(image.scale ?? 1, 1),
        width: Math.max(MIN_EDITOR_RECT_SIZE, Math.round(Number.isFinite(image.width) ? image.width : 256)),
        height: Math.max(MIN_EDITOR_RECT_SIZE, Math.round(Number.isFinite(image.height) ? image.height : 256)),
        repeat: image.repeat ?? false,
        fillColor,
        x: Number.isFinite(image.x) ? image.x : 0,
        y: Number.isFinite(image.y) ? image.y : 0
    };
};

const compactBackgroundLayer = (layer: TestWorldParallaxLayerConfig, index: number): TestWorldParallaxLayerConfig | null => {
    const image = compactBackgroundImage(layer);
    if (!image) {
        return null;
    }

    return {
        id: sanitizeOptionalText(layer.id) ?? `layer_${index + 1}`,
        y: Number.isFinite(layer.y) ? layer.y : createDefaultBackgroundLayer(index).y,
        height: Math.max(8, Math.round(Number.isFinite(layer.height) ? layer.height : createDefaultBackgroundLayer(index).height)),
        scrollFactorX: clampScrollFactor(layer.scrollFactorX, createDefaultBackgroundLayer(index).scrollFactorX),
        scrollFactorY: clampScrollFactor(layer.scrollFactorY ?? layer.scrollFactorX, createDefaultBackgroundLayer(index).scrollFactorY ?? createDefaultBackgroundLayer(index).scrollFactorX),
        ...image
    };
};

const applyBackgroundLevelField = (
    config: TestWorldConfig,
    key: BackgroundLevelFieldKey,
    value: string | number | boolean
): boolean => {
    const editable = getEditableBackground(config);
    if (key === 'backgroundColor') {
        editable.color = clampBackgroundColor(value, editable.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR);
    } else if (key === 'backgroundStaticTextureKey') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.textureKey = typeof value === 'string' ? value : editable.staticImage.textureKey;
    } else if (key === 'backgroundStaticTextureAsset') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.textureAsset = typeof value === 'string' ? value : editable.staticImage.textureAsset;
    } else if (key === 'backgroundStaticFillColor') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.fillColor = typeof value === 'number' ? clampBackgroundColor(value, 0) : editable.staticImage.fillColor;
    } else if (key === 'backgroundStaticTintColor') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.tintColor = typeof value === 'number' ? clampBackgroundColor(value, 0xffffff) : editable.staticImage.tintColor;
    } else if (key === 'backgroundStaticAlpha') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.alpha = typeof value === 'number' ? clampUnitInterval(value, 1) : editable.staticImage.alpha;
    } else if (key === 'backgroundStaticScale') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.scale = typeof value === 'number' ? clampPositiveScale(value, 1) : editable.staticImage.scale;
    } else if (key === 'backgroundStaticWidth') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.width = typeof value === 'number' && Number.isFinite(value)
            ? Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value))
            : editable.staticImage.width;
    } else if (key === 'backgroundStaticHeight') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.height = typeof value === 'number' && Number.isFinite(value)
            ? Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value))
            : editable.staticImage.height;
    } else if (key === 'backgroundStaticRepeat') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.repeat = typeof value === 'boolean' ? value : editable.staticImage.repeat;
    } else if (key === 'backgroundStaticX') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.x = typeof value === 'number' && Number.isFinite(value) ? value : editable.staticImage.x;
    } else if (key === 'backgroundStaticY') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.y = typeof value === 'number' && Number.isFinite(value) ? value : editable.staticImage.y;
    } else {
        const layerMatch = /^backgroundLayer(\d+)(TextureKey|TextureAsset|FillColor|TintColor|Alpha|Scale|Width|Repeat|X|Y|Height|ScrollFactorX|ScrollFactorY)$/.exec(key);
        if (!layerMatch) {
            return false;
        }
        const layerIndex = Math.max(0, Number.parseInt(layerMatch[1] ?? '1', 10) - 1);
        const layerField = layerMatch[2];
        const layers = editable.layers ?? [];
        while (layers.length <= layerIndex) {
            layers.push(createDefaultBackgroundLayer(layers.length));
        }
        const layer = layers[layerIndex] ?? createDefaultBackgroundLayer(layerIndex);
        if (layerField === 'TextureKey' && typeof value === 'string') {
            layer.textureKey = value;
        } else if (layerField === 'TextureAsset' && typeof value === 'string') {
            layer.textureAsset = value;
        } else if (layerField === 'FillColor' && typeof value === 'number') {
            layer.fillColor = clampBackgroundColor(value, 0);
        } else if (layerField === 'TintColor' && typeof value === 'number') {
            layer.tintColor = clampBackgroundColor(value, 0xffffff);
        } else if (layerField === 'Alpha' && typeof value === 'number') {
            layer.alpha = clampUnitInterval(value, 1);
        } else if (layerField === 'Scale' && typeof value === 'number') {
            layer.scale = clampPositiveScale(value, 1);
        } else if (layerField === 'Width' && typeof value === 'number' && Number.isFinite(value)) {
            layer.width = Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value));
        } else if (layerField === 'Repeat' && typeof value === 'boolean') {
            layer.repeat = value;
        } else if (layerField === 'X' && typeof value === 'number' && Number.isFinite(value)) {
            layer.x = value;
        } else if (layerField === 'Y' && typeof value === 'number' && Number.isFinite(value)) {
            layer.y = value;
        } else if (layerField === 'Height' && typeof value === 'number' && Number.isFinite(value)) {
            layer.height = Math.max(8, Math.round(value));
        } else if (layerField === 'ScrollFactorX' && typeof value === 'number') {
            layer.scrollFactorX = clampScrollFactor(value, 0.4);
        } else if (layerField === 'ScrollFactorY' && typeof value === 'number') {
            layer.scrollFactorY = clampScrollFactor(value, layer.scrollFactorX);
        } else {
            return false;
        }
        editable.layers = layers;
    }

    const compactStaticImage = compactBackgroundImage(editable.staticImage ?? cloneStaticBackgroundImage(undefined));
    const compactLayers = (editable.layers ?? [])
        .map((layer, index) => compactBackgroundLayer(layer, index))
        .filter((layer): layer is TestWorldParallaxLayerConfig => layer !== null);
    const hasBackground = compactStaticImage !== undefined || compactLayers.length > 0;

    if (!hasBackground) {
        config.background = null;
        return true;
    }

    config.background = {
        color: clampBackgroundColor(editable.color, EDITOR_FALLBACK_BACKGROUND_COLOR),
        staticImage: compactStaticImage,
        layers: compactLayers
    };
    return true;
};

export const createTestWorldEditorRuntime = (
    scene: Scene,
    worldRuntime: TestWorldRuntime,
    player: PfPlayer,
    levelId: string,
    defaultConfig: TestWorldConfig,
    initialOpen: boolean = false,
    initialStatus: string | null = null,
    sourceContext?: TestWorldLevelSourceContext,
    onLevelConfigChanged?: (config: TestWorldConfig) => void,
    onEditorPreviewCameraBasisChanged?: (basis: { scrollX: number; scrollY: number; zoom: number } | null) => void,
    requestNormalCameraOwnership?: (source: string) => boolean
): TestWorldEditorRuntime => {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.F2);
    const deleteKey = keyboard.addKey(Input.Keyboard.KeyCodes.DELETE);
    const backspaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.BACKSPACE);
    const duplicateKey = keyboard.addKey(Input.Keyboard.KeyCodes.D);
    const undoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Z);
    const redoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Y);
    const gridKey = keyboard.addKey(Input.Keyboard.KeyCodes.G);
    const focusKey = keyboard.addKey(Input.Keyboard.KeyCodes.F);
    const focusSpawnKey = keyboard.addKey(Input.Keyboard.KeyCodes.P);
    const spaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
    const ctrlKey = keyboard.addKey(Input.Keyboard.KeyCodes.CTRL);
    const shiftKey = keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT);
    const leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
    const rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
    const upKey = keyboard.addKey(Input.Keyboard.KeyCodes.UP);
    const downKey = keyboard.addKey(Input.Keyboard.KeyCodes.DOWN);
    const digitKeys = [
        keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Input.Keyboard.KeyCodes.FOUR)
    ];
    const cancelPlacementKey = keyboard.addKey(Input.Keyboard.KeyCodes.ESC);

    relaxKeyboardCapture(keyboard, [
        Input.Keyboard.KeyCodes.DELETE,
        Input.Keyboard.KeyCodes.BACKSPACE,
        Input.Keyboard.KeyCodes.D,
        Input.Keyboard.KeyCodes.Z,
        Input.Keyboard.KeyCodes.Y,
        Input.Keyboard.KeyCodes.G,
        Input.Keyboard.KeyCodes.F,
        Input.Keyboard.KeyCodes.P,
        Input.Keyboard.KeyCodes.SPACE,
        Input.Keyboard.KeyCodes.LEFT,
        Input.Keyboard.KeyCodes.RIGHT,
        Input.Keyboard.KeyCodes.UP,
        Input.Keyboard.KeyCodes.DOWN,
        Input.Keyboard.KeyCodes.ONE,
        Input.Keyboard.KeyCodes.TWO,
        Input.Keyboard.KeyCodes.THREE,
        Input.Keyboard.KeyCodes.FOUR,
        Input.Keyboard.KeyCodes.ESC
    ]);

    scene.input.mouse?.disableContextMenu();
    const selectionGraphics = scene.add.graphics().setDepth(4990);
    const placementGraphics = scene.add.graphics().setDepth(4992);
    const gridGraphics = scene.add.graphics().setDepth(4985);
    const rulerGraphics = scene.add.graphics().setDepth(4988).setScrollFactor(0);
    const boundsGraphics = scene.add.graphics().setDepth(4980);
    const initialHelpOverlayPosition = resolveTestHudAnchorPosition(scene, TEST_EDITOR_HELP_OVERLAY_LAYOUT);
    const overlayText = scene.add.text(initialHelpOverlayPosition.x, initialHelpOverlayPosition.y, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.45)'
    })
        .setDepth(4995)
        .setScrollFactor(0)
        .setVisible(false);
    const backgroundSelectionText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#081018',
        backgroundColor: 'rgba(140, 255, 209, 0.92)',
        padding: {
            left: 6,
            right: 6,
            top: 3,
            bottom: 3
        }
    })
        .setDepth(4994)
        .setScrollFactor(0)
        .setVisible(false);

    const appRoot = document.getElementById('app');
    if (!appRoot) {
        throw new Error('#app was not found.');
    }
    const eventDebugRecorder = createEventDebugRecorder({
        capacity: 500,
        defaultSource: 'test_world'
    });
    const eventDebugSink = (entry: EventDebugRecordInput): void => {
        try {
            eventDebugRecorder.record(entry);
        } catch {
            // Keep debug recording errors isolated from gameplay/editor logic.
        }
    };
    worldRuntime.setEventDebugSink?.(eventDebugSink);
    const eventTimelinePanel = createEventTimelinePanel();
    let eventDebugPanelRoot: HTMLDivElement | null = document.createElement('div');
    eventDebugPanelRoot.style.position = 'absolute';
    eventDebugPanelRoot.style.right = '12px';
    eventDebugPanelRoot.style.bottom = '12px';
    eventDebugPanelRoot.style.width = '420px';
    eventDebugPanelRoot.style.maxHeight = '260px';
    eventDebugPanelRoot.style.display = 'none';
    eventDebugPanelRoot.style.zIndex = '35';
    eventDebugPanelRoot.style.background = 'rgba(8, 16, 24, 0.92)';
    eventDebugPanelRoot.style.border = '1px solid rgba(140, 255, 209, 0.55)';
    eventDebugPanelRoot.style.borderRadius = '6px';
    eventDebugPanelRoot.style.color = '#d7fdf2';
    eventDebugPanelRoot.style.fontFamily = 'monospace';
    eventDebugPanelRoot.style.fontSize = '12px';
    eventDebugPanelRoot.style.pointerEvents = 'auto';
    let eventDebugPanelToolbar: HTMLDivElement | null = document.createElement('div');
    eventDebugPanelToolbar.style.display = 'flex';
    eventDebugPanelToolbar.style.alignItems = 'center';
    eventDebugPanelToolbar.style.justifyContent = 'space-between';
    eventDebugPanelToolbar.style.padding = '6px 8px';
    eventDebugPanelToolbar.style.borderBottom = '1px solid rgba(140, 255, 209, 0.4)';
    const eventDebugPanelTitle = document.createElement('div');
    eventDebugPanelTitle.textContent = 'Event Debug Timeline';
    eventDebugPanelTitle.style.fontWeight = '600';
    let eventDebugPanelButtons: HTMLDivElement | null = document.createElement('div');
    eventDebugPanelButtons.style.display = 'flex';
    eventDebugPanelButtons.style.gap = '6px';
    let refreshDebugEventsButton: HTMLButtonElement | null = document.createElement('button');
    refreshDebugEventsButton.type = 'button';
    refreshDebugEventsButton.textContent = 'Refresh debug events';
    refreshDebugEventsButton.style.fontFamily = 'monospace';
    refreshDebugEventsButton.style.fontSize = '11px';
    let clearDebugEventsButton: HTMLButtonElement | null = document.createElement('button');
    clearDebugEventsButton.type = 'button';
    clearDebugEventsButton.textContent = 'Clear debug events';
    clearDebugEventsButton.style.fontFamily = 'monospace';
    clearDebugEventsButton.style.fontSize = '11px';
    eventDebugPanelButtons.appendChild(refreshDebugEventsButton);
    eventDebugPanelButtons.appendChild(clearDebugEventsButton);
    eventDebugPanelToolbar.appendChild(eventDebugPanelTitle);
    eventDebugPanelToolbar.appendChild(eventDebugPanelButtons);
    let eventDebugPanelTimelineContainer: HTMLDivElement | null = document.createElement('div');
    eventDebugPanelTimelineContainer.style.maxHeight = '212px';
    eventDebugPanelTimelineContainer.style.overflowY = 'auto';
    eventDebugPanelTimelineContainer.style.background = 'rgba(255, 255, 255, 0.9)';
    eventDebugPanelTimelineContainer.style.color = '#1d1d1d';
    eventDebugPanelRoot.appendChild(eventDebugPanelToolbar);
    eventDebugPanelRoot.appendChild(eventDebugPanelTimelineContainer);
    appRoot.appendChild(eventDebugPanelRoot);
    const buildAuthoringReferenceIndex = () => {
        return buildReferenceIndexFromTestAuthoringContent({
            levels: [worldRuntime.getConfig()],
            npcProfiles: getTestNpcProfiles(),
            npcScriptedSequences: getTestNpcScriptedSequenceDefinitions(),
            cutscenes: getTestCutsceneDefinitions()
        });
    };
    const authoringEditorV2Overlay = createAuthoringEditorPhaserOverlay({
        scene,
        gridSize: GRID_SIZES[2] ?? 16,
        rulerThicknessPx: RULER_THICKNESS_PX
    });

    const enterAuthoringEditorCameraMode = (): void => {
        scene.cameras.main.stopFollow();
    };

    const tryRestoreGameplayCameraFollow = (source: string): boolean => {
        const restoreCameraSource = source.trim().length > 0 ? source.trim() : 'authoring_editor_v2:close';
        const canRestoreNormalCamera = requestNormalCameraOwnership
            ? requestNormalCameraOwnership(restoreCameraSource)
            : true;
        if (!canRestoreNormalCamera) {
            return false;
        }
        const worldBounds = worldRuntime.getWorldBounds();
        setupBaselineFollowCamera(scene, player.arcadeBodyObject, {
            width: worldBounds.width,
            height: worldBounds.height
        });
        return true;
    };

    const authoringEditorRuntimeBridge: AuthoringEditorRuntimeBridge = {
        enterAuthoringEditorCameraMode: (): void => {
            enterAuthoringEditorCameraMode();
        },
        exitAuthoringEditorCameraMode: (): void => {
            tryRestoreGameplayCameraFollow('authoring_editor_v2:close');
        },
        enterAuthoringEditorOverlayMode: (): void => {
            authoringEditorV2Overlay.setEnabled(true);
        },
        exitAuthoringEditorOverlayMode: (): void => {
            authoringEditorV2Overlay.setEnabled(false);
        },
        getCurrentWorldConfig: (): unknown => worldRuntime.getConfig(),
        getEditorObjects: (): readonly AuthoringEditorObjectSummary[] => {
            return worldRuntime.getEditorObjects().map((entry) => ({
                id: entry.id,
                type: entry.type,
                label: entry.label,
                raw: entry
            }));
        },
        getLevelId: (): string => worldRuntime.getLevelId(),
        getWorldBounds: () => {
            const bounds = worldRuntime.getWorldBounds();
            return {
                x: 0,
                y: 0,
                width: bounds.width,
                height: bounds.height
            };
        },
        focusObject: (id: string): boolean => {
            const point = worldRuntime.focusObjectPoint(id);
            if (!point) {
                return false;
            }
            scene.cameras.main.centerOn(point.x, point.y);
            return true;
        },
        buildLevelAsset: () => {
            const result = adaptTestWorldConfigToLevelAsset(worldRuntime.getConfig());
            return {
                levelAsset: result.asset,
                adapterIssues: result.issues
            };
        },
        buildReferenceIndex: () => {
            return buildAuthoringReferenceIndex();
        },
        validateCurrentLevel: () => {
            const levelAssetResult = adaptTestWorldConfigToLevelAsset(worldRuntime.getConfig());
            const referenceIndex = buildAuthoringReferenceIndex();
            const issues = validateLevelAsset(levelAssetResult.asset, {
                authoringContext: {
                    referenceIndex,
                    source: `level:${worldRuntime.getLevelId()}`
                }
            });
            return { issues };
        }
    };
    const authoringEditorDevLauncher = createAuthoringEditorV2Entrypoint({
        runtimeBridge: authoringEditorRuntimeBridge
    });
    const rulerCanvas = document.createElement('canvas');
    rulerCanvas.width = Math.max(1, scene.scale.width);
    rulerCanvas.height = Math.max(1, scene.scale.height);
    rulerCanvas.style.position = 'absolute';
    rulerCanvas.style.left = '0';
    rulerCanvas.style.top = '0';
    rulerCanvas.style.width = '100%';
    rulerCanvas.style.height = '100%';
    rulerCanvas.style.pointerEvents = 'none';
    rulerCanvas.style.zIndex = '24';
    rulerCanvas.style.display = 'none';
    appRoot.appendChild(rulerCanvas);
    const rulerCanvasContext = rulerCanvas.getContext('2d');
    if (!rulerCanvasContext) {
        throw new Error('2D canvas context is not available for editor ruler.');
    }

    let active = false;
    let destroyed = false;
    let selectedHandleId: string | null = null;
    let searchTerm = '';
    let gridEnabled = true;
    let gridSize = 16;
    let status = initialStatus ?? '';
    let autosaveTimer: number | null = null;
    let suppressSequenceDraftPersistUntilNextTick = false;
    let pointerDragState: PointerDragState | null = null;
    let pendingPlacementType: TestWorldEditorObjectType | null = null;
    let gameplayCameraSnapshot: EditorCameraSnapshot | null = null;
    let activeTab: TestWorldEditorTabId = 'level';
    let logicActiveTab: TestWorldEditorLogicTabId = 'triggers';
    let selectedBackgroundId: BackgroundSelectionId | null = null;
    let selectedLogicTriggerId: string | null = null;
    let selectedLogicRuleId: string | null = null;
    let selectedSequenceId: string | null = getTestNpcScriptedSequenceDefinitions()[0]?.id ?? null;
    let selectedSequenceActionIndex = 0;
    let suppressCutsceneDraftPersistUntilNextTick = false;
    let selectedCutsceneId: string | null = getTestCutsceneDefinitions()[0]?.id ?? null;
    let selectedCutsceneStepIndex = 0;
    const syncEventDebugPanelVisibility = (): void => {
        if (!eventDebugPanelRoot) {
            return;
        }
        eventDebugPanelRoot.style.display = active ? 'block' : 'none';
    };
    const renderEventDebugEntries = (): void => {
        if (!eventDebugPanelTimelineContainer) {
            return;
        }
        eventTimelinePanel.render(
            eventDebugPanelTimelineContainer,
            eventDebugRecorder.getEntries()
        );
    };
    const handleRefreshDebugEvents = (): void => {
        if (!active) {
            return;
        }
        renderEventDebugEntries();
    };
    const handleClearDebugEvents = (): void => {
        eventDebugRecorder.clear();
        if (active) {
            renderEventDebugEntries();
        }
    };
    refreshDebugEventsButton?.addEventListener('click', handleRefreshDebugEvents);
    clearDebugEventsButton?.addEventListener('click', handleClearDebugEvents);
    const bundledDefaultConfig = createDefaultTestWorldConfig(sourceContext?.bundledDefaultConfig ?? defaultConfig);
    const campaignDefaultConfig = createDefaultTestWorldConfig(sourceContext?.campaignDefaultConfig ?? defaultConfig);
    const undoStack: TestWorldConfig[] = [];
    const redoStack: TestWorldConfig[] = [];
    const inspectorColorKeys = new Set<string>([
        'fillColor',
        'strokeColor',
        'triggerFillColor',
        'triggerStrokeColor',
        'deactivateTriggerFillColor',
        'deactivateTriggerStrokeColor',
        'platformFillColor',
        'platformStrokeColor'
    ]);
    const getHandles = (): readonly TestWorldEditorHandle[] => worldRuntime.getEditorHandles();
    const getSelectedHandle = (): TestWorldEditorHandle | null => {
        if (!selectedHandleId) {
            return null;
        }
        return worldRuntime.getEditorHandle(selectedHandleId);
    };
    const getSelectedRootId = (): string | null => getSelectedHandle()?.rootId ?? null;
    const isObjectsTabActive = (): boolean => activeTab === 'objects';
    const isNpcTabActive = (): boolean => activeTab === 'npc';
    const isSequencesTabActive = (): boolean => activeTab === 'sequences';
    const isCutscenesTabActive = (): boolean => activeTab === 'cutscenes';
    const isInspectorTabActive = (): boolean => activeTab === 'inspector';
    const isLogicTabActive = (): boolean => activeTab === 'logic';
    const isLogicTriggersTabActive = (): boolean => isLogicTabActive() && logicActiveTab === 'triggers';
    const isLogicRulesTabActive = (): boolean => isLogicTabActive() && logicActiveTab === 'rules';
    const isObjectInteractionTabActive = (): boolean => isObjectsTabActive() || isNpcTabActive() || isInspectorTabActive();
    const isBackgroundTabActive = (): boolean => activeTab === 'background';
    const getSelectableHandles = (): readonly TestWorldEditorHandle[] => {
        const handles = getHandles();
        if (isNpcTabActive()) {
            return handles.filter((entry) => entry.type === 'npc');
        }
        if (isObjectsTabActive()) {
            return handles.filter((entry) => entry.type !== 'npc');
        }
        return handles;
    };

    const getBackgroundHandles = (): BackgroundEditorHandle[] => {
        const background = worldRuntime.getConfig().background;
        if (!background) {
            return [];
        }

        const handles: BackgroundEditorHandle[] = [];
        if (background.staticImage) {
            const staticImage = cloneStaticBackgroundImage(background.staticImage);
            handles.push({
                id: 'static',
                label: 'Static',
                bounds: {
                    x: staticImage.x ?? 0,
                    y: staticImage.y ?? 0,
                    width: staticImage.width ?? 1600,
                    height: staticImage.height ?? 900
                }
            });
        }

        background.layers?.slice(0, EDITOR_BACKGROUND_LAYER_COUNT).forEach((layer, index) => {
            const clonedLayer = cloneBackgroundLayer(layer, index);
            handles.push({
                id: `layer_${index + 1}` as BackgroundSelectionId,
                label: `Parallax ${index + 1}`,
                bounds: {
                    x: clonedLayer.x ?? 0,
                    y: clonedLayer.y,
                    width: clonedLayer.width ?? 1920,
                    height: clonedLayer.height
                }
            });
        });

        return handles;
    };

    const getTriggerVolumes = (): readonly TestWorldTriggerVolumeConfig[] => {
        return worldRuntime.getConfig().triggerVolumes;
    };
    const getWorldLogicRules = (): readonly TestWorldLogicRule[] => {
        return worldRuntime.getConfig().worldLogicRules ?? [];
    };

    const normalizeSelectedLogicTriggerState = (): void => {
        const triggerVolumes = getTriggerVolumes();
        if (triggerVolumes.length <= 0) {
            selectedLogicTriggerId = null;
            return;
        }
        const hasSelected = selectedLogicTriggerId
            ? triggerVolumes.some((entry) => entry.id === selectedLogicTriggerId)
            : false;
        if (!hasSelected) {
            selectedLogicTriggerId = triggerVolumes[0]?.id ?? null;
        }
    };

    const normalizeSelectedLogicRuleState = (): void => {
        const rules = getWorldLogicRules();
        if (rules.length <= 0) {
            selectedLogicRuleId = null;
            return;
        }
        const hasSelected = selectedLogicRuleId
            ? rules.some((entry) => entry.id === selectedLogicRuleId)
            : false;
        if (!hasSelected) {
            selectedLogicRuleId = rules[0]?.id ?? null;
        }
    };

    const getSelectedBackgroundHandle = (): BackgroundEditorHandle | null => {
        if (!selectedBackgroundId) {
            return null;
        }
        return getBackgroundHandles().find((entry) => entry.id === selectedBackgroundId) ?? null;
    };

    const getScriptedSequenceDefinitions = (): readonly TestNpcScriptedSequenceDefinition[] => {
        return getTestNpcScriptedSequenceDefinitions();
    };

    const getSelectedScriptedSequence = (): TestNpcScriptedSequenceDefinition | null => {
        if (!selectedSequenceId) {
            return null;
        }
        return getScriptedSequenceDefinitions().find((entry) => entry.id === selectedSequenceId) ?? null;
    };

    const normalizeSelectedScriptedSequenceState = (): void => {
        const definitions = getScriptedSequenceDefinitions();
        if (definitions.length === 0) {
            selectedSequenceId = null;
            selectedSequenceActionIndex = -1;
            return;
        }

        if (!selectedSequenceId || !definitions.some((entry) => entry.id === selectedSequenceId)) {
            selectedSequenceId = definitions[0]?.id ?? null;
        }

        const selectedSequence = definitions.find((entry) => entry.id === selectedSequenceId) ?? null;
        if (!selectedSequence || selectedSequence.actions.length === 0) {
            selectedSequenceActionIndex = -1;
            return;
        }

        selectedSequenceActionIndex = Math.max(0, Math.min(selectedSequenceActionIndex, selectedSequence.actions.length - 1));
    };

    const getProfileSequenceConsumers = (sequenceId: string): string[] => {
        return getTestNpcProfiles()
            .filter((profile) => profile.scriptedLoopRef === sequenceId)
            .map((profile) => profile.id);
    };

    const getWorldSequenceConsumers = (sequenceId: string): string[] => {
        return worldRuntime.getConfig().npcs
            .filter((npc) => npc.scriptedLoopRef === sequenceId)
            .map((npc) => npc.id);
    };

    const getCutsceneDefinitions = (): readonly TestCutsceneDefinition[] => {
        return getTestCutsceneDefinitions();
    };

    const getSelectedCutscene = (): TestCutsceneDefinition | null => {
        if (!selectedCutsceneId) {
            return null;
        }
        return getCutsceneDefinitions().find((entry) => entry.id === selectedCutsceneId) ?? null;
    };

    const normalizeSelectedCutsceneState = (): void => {
        const definitions = getCutsceneDefinitions();
        if (definitions.length === 0) {
            selectedCutsceneId = null;
            selectedCutsceneStepIndex = -1;
            return;
        }

        if (!selectedCutsceneId || !definitions.some((entry) => entry.id === selectedCutsceneId)) {
            selectedCutsceneId = definitions[0]?.id ?? null;
        }

        const selectedCutscene = definitions.find((entry) => entry.id === selectedCutsceneId) ?? null;
        if (!selectedCutscene || selectedCutscene.steps.length === 0) {
            selectedCutsceneStepIndex = -1;
            return;
        }

        selectedCutsceneStepIndex = Math.max(0, Math.min(selectedCutsceneStepIndex, selectedCutscene.steps.length - 1));
    };

    const getCutsceneConsumers = (cutsceneId: string): string[] => {
        return worldRuntime.getConfig().npcs
            .filter((npc) => npc.interactionOverride?.outcome?.kind === 'request_cutscene_ref'
                && npc.interactionOverride.outcome.cutsceneRef === cutsceneId)
            .map((npc) => npc.id);
    };

    const getProfileCutsceneConsumers = (cutsceneId: string): string[] => {
        return getTestNpcProfiles()
            .filter((profile) => profile.interaction?.outcome.kind === 'request_cutscene_ref'
                && profile.interaction.outcome.cutsceneRef === cutsceneId)
            .map((profile) => profile.id);
    };

    const saveSequenceDraftNow = (): void => {
        const saved = saveTestNpcScriptedSequenceDraft(getScriptedSequenceDefinitions());
        if (saved.error) {
            setStatus(`sequence draft save failed: ${saved.error}`);
        }
    };

    const withSequenceDraftPersistSuppressed = (run: () => void): void => {
        suppressSequenceDraftPersistUntilNextTick = true;
        try {
            run();
        } finally {
            window.setTimeout(() => {
                suppressSequenceDraftPersistUntilNextTick = false;
            }, 0);
        }
    };

    const saveCutsceneDraftNow = (): void => {
        const saved = saveTestCutsceneDraft(getCutsceneDefinitions());
        if (saved.error) {
            setStatus(`cutscene draft save failed: ${saved.error}`);
        }
    };

    const withCutsceneDraftPersistSuppressed = (run: () => void): void => {
        suppressCutsceneDraftPersistUntilNextTick = true;
        try {
            run();
        } finally {
            window.setTimeout(() => {
                suppressCutsceneDraftPersistUntilNextTick = false;
            }, 0);
        }
    };

    const commitScriptedSequenceRegistry = (
        definitions: readonly TestNpcScriptedSequenceDefinition[],
        successStatus: string,
        options?: {
            persistDraft?: boolean;
            source?: string;
        }
    ): boolean => {
        const result = setTestNpcScriptedSequenceDefinitions(
            definitions,
            options?.source ?? 'editor_commit'
        );
        if (result.definitions === null) {
            const firstIssue = result.issues[0];
            setStatus(firstIssue ? `sequence invalid: ${firstIssue.message}` : 'sequence invalid');
            return false;
        }

        normalizeSelectedScriptedSequenceState();
        if ((options?.persistDraft ?? true) && !suppressSequenceDraftPersistUntilNextTick) {
            saveSequenceDraftNow();
        }
        setStatus(successStatus);
        return true;
    };

    const restoreDefaultScriptedSequenceRegistry = (
        successStatus: string,
        options?: {
            persistDraft?: boolean;
            source?: string;
        }
    ): void => {
        const defaultDefinitions = getDefaultTestNpcScriptedSequenceDefinitions();
        if (commitScriptedSequenceRegistry(defaultDefinitions, successStatus, {
            persistDraft: options?.persistDraft ?? true,
            source: options?.source ?? 'editor_restore_default'
        })) {
            markTestNpcScriptedSequenceDraftRestoredDefault();
            syncSidebar();
        }
    };

    const commitCutsceneRegistry = (
        definitions: readonly TestCutsceneDefinition[],
        successStatus: string,
        options?: {
            persistDraft?: boolean;
            source?: string;
        }
    ): boolean => {
        const result = setTestCutsceneDefinitions(
            definitions,
            options?.source ?? 'editor_commit'
        );
        if (result.definitions === null) {
            const firstIssue = result.issues[0];
            setStatus(firstIssue ? `cutscene invalid: ${firstIssue.message}` : 'cutscene invalid');
            return false;
        }

        normalizeSelectedCutsceneState();
        if ((options?.persistDraft ?? true) && !suppressCutsceneDraftPersistUntilNextTick) {
            saveCutsceneDraftNow();
        }
        setStatus(successStatus);
        return true;
    };

    const restoreDefaultCutsceneRegistry = (
        successStatus: string,
        options?: {
            persistDraft?: boolean;
            source?: string;
        }
    ): void => {
        const defaultDefinitions = getDefaultTestCutsceneDefinitions();
        if (commitCutsceneRegistry(defaultDefinitions, successStatus, {
            persistDraft: options?.persistDraft ?? true,
            source: options?.source ?? 'editor_restore_default'
        })) {
            markTestCutsceneDraftRestoredDefault();
            syncSidebar();
        }
    };

    const mapCampaignSourceToLabel = (source: CampaignLevelConfigSource): string => {
        if (source === 'campaign_registry_override') {
            return 'campaign_registry_override';
        }
        if (source === 'campaign_registry_custom') {
            return 'campaign_registry_custom';
        }
        return 'bundled_file_json';
    };

    const mapBootstrapWorldSourceToLabel = (source: 'draft' | 'default'): string => {
        return source === 'draft' ? 'local_storage_draft' : 'campaign_default';
    };

    const getSourceAuditView = (config: TestWorldConfig): TestWorldLevelSourceAuditView => {
        const configSignature = JSON.stringify(config);
        const draftAudit = getTestWorldEditorDraftStorageAuditSnapshot(levelId, campaignDefaultConfig);
        const bundledSignature = JSON.stringify(bundledDefaultConfig);
        const campaignSignature = JSON.stringify(campaignDefaultConfig);
        const currentSourceLabel = (
            draftAudit.draftValid
            && draftAudit.draftConfigSignature === configSignature
        )
            ? 'local_storage_draft'
            : (
                configSignature === bundledSignature
                    ? 'bundled_file_json'
                    : (configSignature === campaignSignature
                        ? mapCampaignSourceToLabel(sourceContext?.campaignConfigSource ?? 'bundled')
                        : 'live_runtime_unsaved')
            );

        return {
            currentSourceLabel,
            campaignSourceLabel: mapCampaignSourceToLabel(sourceContext?.campaignConfigSource ?? 'bundled'),
            bootstrapWorldSourceLabel: mapBootstrapWorldSourceToLabel(sourceContext?.initialWorldLoadSource ?? 'default'),
            bootstrapWorldError: sourceContext?.initialWorldLoadError ?? null,
            initialDraftPresent: sourceContext?.initialDraftPresent ?? false,
            draftPresent: draftAudit.draftPresent,
            draftValid: draftAudit.draftValid,
            draftStorageKey: draftAudit.storageKey,
            draftNpcCount: draftAudit.draftNpcCount,
            draftNpcIds: draftAudit.draftNpcIds,
            draftParseError: draftAudit.parseError,
            fileNpcCount: bundledDefaultConfig.npcs.length,
            fileNpcIds: bundledDefaultConfig.npcs.map((npc) => npc.id),
            campaignNpcCount: campaignDefaultConfig.npcs.length,
            campaignNpcIds: campaignDefaultConfig.npcs.map((npc) => npc.id),
            loadedNpcCount: config.npcs.length,
            loadedNpcIds: config.npcs.map((npc) => npc.id)
        };
    };

    const buildSidebarState = (): TestWorldEditorSidebarState => {
        const config = worldRuntime.getConfig();
        const sourceAudit = getSourceAuditView(config);
        normalizeSelectedScriptedSequenceState();
        normalizeSelectedLogicTriggerState();
        normalizeSelectedLogicRuleState();
        const selectedRootId = getSelectedRootId();
        const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === selectedRootId)?.type ?? null;
        const selectedLogicTrigger = selectedLogicTriggerId
            ? config.triggerVolumes.find((entry) => entry.id === selectedLogicTriggerId) ?? null
            : null;
        const selectedLogicRule = selectedLogicRuleId
            ? (config.worldLogicRules ?? []).find((entry) => entry.id === selectedLogicRuleId) ?? null
            : null;
        const selectedSequence = getSelectedScriptedSequence();
        const selectedSequenceAction = selectedSequence?.actions[selectedSequenceActionIndex] ?? null;
        const selectedCutscene = getSelectedCutscene();
        const selectedCutsceneStep = selectedCutscene?.steps[selectedCutsceneStepIndex] ?? null;
        const npcItems = worldRuntime.getEditorObjects()
            .filter((entry) => entry.type === 'npc')
            .map((entry) => ({
                id: entry.id,
                label: entry.label,
                type: entry.type,
                locked: entry.locked,
                selected: entry.id === selectedRootId
            }));
        return {
            visible: active,
            search: searchTerm,
            status,
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            levelId,
            pendingPlacementType,
            levelSections: buildLevelSections(config, getCampaignLevelSummaries(), sourceAudit),
            backgroundSections: buildBackgroundSections(config),
            palette: TEST_WORLD_EDITOR_PALETTE,
            objectItems: worldRuntime.getEditorObjects()
                .filter((entry) => entry.type !== 'npc')
                .filter((entry) => {
                    const haystack = `${entry.label} ${entry.type}`.toLowerCase();
                    return searchTerm.trim().length === 0 || haystack.includes(searchTerm.trim().toLowerCase());
                })
                .map((entry) => ({
                    id: entry.id,
                    label: entry.label,
                    type: entry.type,
                    locked: entry.locked,
                    selected: entry.id === selectedRootId
                })),
            npcItems,
            inspectorId: selectedRootId,
            inspectorType: selectedType,
            inspectorSections: buildInspectorSections(config, selectedRootId, selectedType),
            npcInspectorId: selectedType === 'npc' ? selectedRootId : null,
            npcInspectorSections: buildNpcInspectorSections(config, selectedType === 'npc' ? selectedRootId : null),
            sequenceItems: getScriptedSequenceDefinitions().map((entry) => ({
                id: entry.id,
                actionCount: entry.actions.length,
                selected: entry.id === selectedSequenceId
            })),
            sequenceInspectorId: selectedSequence?.id ?? null,
            sequenceSections: [
                ...buildScriptedSequenceSections(selectedSequence),
                ...buildScriptedSequenceAuditSections()
            ],
            sequenceActionItems: selectedSequence
                ? selectedSequence.actions.map((action, index) => ({
                    index,
                    label: describeSequenceAction(action, index),
                    selected: index === selectedSequenceActionIndex
                }))
                : [],
            sequenceActionIndex: selectedSequenceAction ? selectedSequenceActionIndex : -1,
            sequenceActionSections: buildScriptedSequenceActionSections(selectedSequenceAction),
            cutsceneItems: getCutsceneDefinitions().map((entry) => ({
                id: entry.id,
                mode: entry.mode,
                stepCount: entry.steps.length,
                selected: entry.id === selectedCutsceneId
            })),
            cutsceneInspectorId: selectedCutscene?.id ?? null,
            cutsceneSections: [
                ...buildCutsceneSections(selectedCutscene),
                ...buildCutsceneAuditSections()
            ],
            cutsceneStepItems: selectedCutscene
                ? selectedCutscene.steps.map((step, index) => ({
                    index,
                    label: describeCutsceneStep(step, index),
                    selected: index === selectedCutsceneStepIndex
                }))
                : [],
            cutsceneStepIndex: selectedCutsceneStep ? selectedCutsceneStepIndex : -1,
            cutsceneStepSections: buildCutsceneStepSections(config, selectedCutsceneStep),
            logicTab: logicActiveTab,
            logicTriggerItems: config.triggerVolumes.map((entry) => ({
                id: entry.id,
                label: entry.id,
                selected: entry.id === selectedLogicTriggerId
            })),
            logicTriggerId: selectedLogicTriggerId,
            logicTriggerSections: buildLogicTriggerSections(config, selectedLogicTrigger),
            logicRuleItems: (config.worldLogicRules ?? []).map((entry) => ({
                id: entry.id,
                label: summarizeWorldLogicRule(entry),
                selected: entry.id === selectedLogicRuleId
            })),
            logicRuleId: selectedLogicRuleId,
            logicRuleSections: buildLogicRuleSections(config, selectedLogicRule),
            logicFlagsSections: buildLogicFlagsSections(),
            selectedLocked: getSelectedHandle()?.isLocked() ?? false
        };
    };

    const sidebar = new TestWorldEditorSidebar(appRoot, {
        onSaveDraft: () => {
            saveDraftNow();
            setStatus('draft saved');
        },
        onCreateLevel: () => {
            saveDraftNow();
            const createdLevel = createCampaignLevel();
            saveTestWorldEditorDraft(createdLevel.meta.id, createdLevel);
            scene.scene.restart({
                levelId: createdLevel.meta.id,
                editorOpen: active
            });
        },
        onDeleteLevel: () => {
            const levelSummaries = getCampaignLevelSummaries();
            if (levelSummaries.length <= 1) {
                setStatus('cannot delete the last remaining level');
                return;
            }
            const confirmed = window.confirm(`Delete level '${levelId}'? This cannot be undone.`);
            if (!confirmed) {
                return;
            }

            const deleted = deleteCampaignLevel(levelId);
            if (!deleted) {
                setStatus('failed to delete level');
                return;
            }

            scene.scene.restart({
                levelId: deleted.switchedToLevelId,
                editorOpen: active
            });
        },
        onExportJson: () => {
            const blob = new Blob([JSON.stringify(worldRuntime.getConfig(), null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${levelId}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('exported json');
        },
        onImportJson: (jsonText) => {
            const parsed = parseTestWorldConfigJson(jsonText, { fallbackConfig: defaultConfig });
            if (parsed.config === null) {
                setStatus(`import failed: ${parsed.error ?? 'invalid json'}`);
                return;
            }
            pushUndoSnapshot();
            worldRuntime.setConfig(parsed.config);
            syncCampaignLevelHeader(parsed.config);
            syncCameraBoundsToWorld();
            redoStack.length = 0;
            selectRoot(parsed.config.finish?.id ?? 'player_spawn');
            onLevelConfigChanged?.(worldRuntime.getConfig());
            markConfigDirty();
            setStatus('imported json');
        },
        onResetDefault: () => {
            const resetConfig = createDefaultTestWorldConfig(bundledDefaultConfig);
            pushUndoSnapshot();
            worldRuntime.setConfig(resetConfig);
            syncCampaignLevelHeader(resetConfig);
            syncCameraBoundsToWorld();
            redoStack.length = 0;
            selectRoot('player_spawn');
            onLevelConfigChanged?.(worldRuntime.getConfig());
            markConfigDirty();
            setStatus('reset to bundled file default');
        },
        onClearSavedDraft: () => {
            clearTestWorldEditorDraft(levelId);
            const resetConfig = createDefaultTestWorldConfig(bundledDefaultConfig);
            pushUndoSnapshot();
            worldRuntime.setConfig(resetConfig);
            syncCampaignLevelHeader(resetConfig);
            syncCameraBoundsToWorld();
            redoStack.length = 0;
            selectRoot('player_spawn');
            onLevelConfigChanged?.(worldRuntime.getConfig());
            syncSidebar();
            setStatus('saved draft cleared, live world reset to bundled file default');
        },
        onSaveSequenceDraft: () => {
            saveSequenceDraftNow();
            setStatus('sequence draft saved');
        },
        onExportSequencesJson: () => {
            const blob = new Blob([JSON.stringify(getScriptedSequenceDefinitions(), null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'npc_scripted_sequences.json';
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('exported sequence json');
        },
        onImportSequencesJson: (jsonText) => {
            const parsed = parseTestNpcScriptedSequenceDefinitionsJson(jsonText);
            if (parsed.definitions === null) {
                setStatus(parsed.error ? `sequence import failed: ${parsed.error}` : 'sequence import failed');
                return;
            }
            if (commitScriptedSequenceRegistry(parsed.definitions, 'imported sequence json', {
                source: 'editor_import_json'
            })) {
                syncSidebar();
            }
        },
        onResetSequencesDefault: () => {
            restoreDefaultScriptedSequenceRegistry('reset sequences to default', {
                persistDraft: true,
                source: 'editor_reset_default'
            });
        },
        onClearSavedSequenceDraft: () => {
            withSequenceDraftPersistSuppressed(() => {
                clearTestNpcScriptedSequenceDraft();
                restoreDefaultScriptedSequenceRegistry('saved sequence draft cleared, using default registry', {
                    persistDraft: false,
                    source: 'editor_clear_draft_restore_default'
                });
            });
        },
        onSaveCutsceneDraft: () => {
            saveCutsceneDraftNow();
            setStatus('cutscene draft saved');
        },
        onExportCutscenesJson: () => {
            const blob = new Blob([JSON.stringify(getCutsceneDefinitions(), null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'test_cutscenes.json';
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('exported cutscene json');
        },
        onImportCutscenesJson: (jsonText) => {
            const parsed = parseTestCutsceneDefinitionsJson(jsonText);
            if (parsed.definitions === null) {
                setStatus(parsed.error ? `cutscene import failed: ${parsed.error}` : 'cutscene import failed');
                return;
            }
            if (commitCutsceneRegistry(parsed.definitions, 'imported cutscene json', {
                source: 'editor_import_json'
            })) {
                syncSidebar();
            }
        },
        onResetCutscenesDefault: () => {
            restoreDefaultCutsceneRegistry('reset cutscenes to default', {
                persistDraft: true,
                source: 'editor_reset_default'
            });
        },
        onClearSavedCutsceneDraft: () => {
            withCutsceneDraftPersistSuppressed(() => {
                clearTestCutsceneDraft();
                restoreDefaultCutsceneRegistry('saved cutscene draft cleared, using default registry', {
                    persistDraft: false,
                    source: 'editor_clear_draft_restore_default'
                });
            });
        },
        onCreateObject: (type) => {
            if (type === 'finish' && worldRuntime.getConfig().finish) {
                selectRoot(worldRuntime.getConfig().finish?.id ?? null);
                setStatus('finish already exists');
                return;
            }
            pendingPlacementType = type;
            pointerDragState = null;
            syncSidebar();
            setStatus(`placing ${type}: click scene to place, Esc or RMB to cancel`);
        },
        onSearchChange: (search) => {
            searchTerm = search;
            syncSidebar();
        },
        onSelectObject: (id) => {
            pendingPlacementType = null;
            selectRoot(id);
            const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === id)?.type ?? null;
            if (isNpcTabActive()) {
                activeTab = 'npc';
            } else {
                activeTab = selectedType === 'npc' ? 'npc' : 'inspector';
            }
            focusTarget(id);
        },
        onTabChanged: (tabId) => {
            activeTab = tabId;
            pointerDragState = null;
            if (tabId === 'background') {
                pendingPlacementType = null;
                selectedHandleId = null;
            } else if (tabId !== 'background') {
                selectedBackgroundId = null;
            }
            if (tabId === 'logic') {
                normalizeSelectedLogicTriggerState();
                normalizeSelectedLogicRuleState();
            }
            syncSidebar();
        },
        onLogicTabChanged: (tabId) => {
            const didChange = logicActiveTab !== tabId;
            logicActiveTab = tabId;
            if (didChange) {
                console.info(`[editor] Logic active subtab: ${logicActiveTab}`);
            }
            if (tabId === 'triggers') {
                normalizeSelectedLogicTriggerState();
            } else if (tabId === 'rules') {
                normalizeSelectedLogicRuleState();
            }
            syncSidebar();
        },
        onSelectLogicTrigger: (id) => {
            selectedLogicTriggerId = id;
            selectRoot(id);
            focusTarget(id);
            activeTab = 'logic';
            logicActiveTab = 'triggers';
            syncSidebar();
        },
        onSelectLogicRule: (id) => {
            selectedLogicRuleId = id;
            activeTab = 'logic';
            logicActiveTab = 'rules';
            syncSidebar();
        },
        onDuplicateSelected: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            pushUndoSnapshot();
            const duplicatedId = worldRuntime.duplicateObject(rootId);
            redoStack.length = 0;
            selectRoot(duplicatedId);
            markConfigDirty();
        },
        onDeleteSelected: () => {
            deleteSelected();
        },
        onCreateSequence: () => {
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const nextId = createNextScriptedSequenceId(definitions);
            definitions.push({
                id: nextId,
                actions: [createDefaultScriptedSequenceAction('wait')]
            });
            selectedSequenceId = nextId;
            selectedSequenceActionIndex = 0;
            commitScriptedSequenceRegistry(definitions, `created sequence ${nextId}`);
        },
        onSelectSequence: (id) => {
            selectedSequenceId = id;
            selectedSequenceActionIndex = 0;
            activeTab = 'sequences';
            syncSidebar();
        },
        onDeleteSelectedSequence: () => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence) {
                return;
            }
            const profileConsumers = getProfileSequenceConsumers(selectedSequence.id);
            const worldConsumers = getWorldSequenceConsumers(selectedSequence.id);
            if (profileConsumers.length > 0 || worldConsumers.length > 0) {
                setStatus(
                    `cannot delete "${selectedSequence.id}": referenced by `
                    + [...profileConsumers, ...worldConsumers].join(', ')
                );
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions())
                .filter((entry) => entry.id !== selectedSequence.id);
            selectedSequenceId = definitions[0]?.id ?? null;
            selectedSequenceActionIndex = 0;
            commitScriptedSequenceRegistry(definitions, `deleted sequence ${selectedSequence.id}`);
        },
        onCreateSequenceAction: () => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence) {
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const target = definitions.find((entry) => entry.id === selectedSequence.id);
            if (!target) {
                return;
            }
            target.actions = [
                ...target.actions,
                createDefaultScriptedSequenceAction('wait')
            ];
            selectedSequenceActionIndex = target.actions.length - 1;
            commitScriptedSequenceRegistry(definitions, `added action to ${selectedSequence.id}`);
        },
        onSelectSequenceAction: (index) => {
            selectedSequenceActionIndex = Number.isFinite(index) ? index : 0;
            activeTab = 'sequences';
            syncSidebar();
        },
        onDeleteSelectedSequenceAction: () => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence || selectedSequenceActionIndex < 0) {
                return;
            }
            if (selectedSequence.actions.length <= 1) {
                setStatus('sequence must keep at least one action');
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const target = definitions.find((entry) => entry.id === selectedSequence.id);
            if (!target) {
                return;
            }
            target.actions = target.actions.filter((_, index) => index !== selectedSequenceActionIndex);
            selectedSequenceActionIndex = Math.max(0, Math.min(selectedSequenceActionIndex, target.actions.length - 1));
            commitScriptedSequenceRegistry(definitions, `removed action from ${selectedSequence.id}`);
        },
        onMoveSelectedSequenceAction: (direction) => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence || selectedSequenceActionIndex < 0) {
                return;
            }
            const nextIndex = selectedSequenceActionIndex + direction;
            if (nextIndex < 0 || nextIndex >= selectedSequence.actions.length) {
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const target = definitions.find((entry) => entry.id === selectedSequence.id);
            if (!target) {
                return;
            }
            const actions = target.actions.map(cloneTestNpcScriptedSequenceAction);
            const [moved] = actions.splice(selectedSequenceActionIndex, 1);
            actions.splice(nextIndex, 0, moved);
            target.actions = actions;
            selectedSequenceActionIndex = nextIndex;
            commitScriptedSequenceRegistry(definitions, `reordered action in ${selectedSequence.id}`);
        },
        onCreateCutscene: () => {
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
            const nextId = createNextCutsceneId(definitions);
            definitions.push({
                id: nextId,
                mode: 'in_level',
                steps: [createDefaultCutsceneStep('lock_input')]
            });
            selectedCutsceneId = nextId;
            selectedCutsceneStepIndex = 0;
            commitCutsceneRegistry(definitions, `created cutscene ${nextId}`);
        },
        onSelectCutscene: (id) => {
            selectedCutsceneId = id;
            selectedCutsceneStepIndex = 0;
            activeTab = 'cutscenes';
            syncSidebar();
        },
        onDeleteSelectedCutscene: () => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene) {
                return;
            }
            const profileConsumers = getProfileCutsceneConsumers(selectedCutscene.id);
            const worldConsumers = getCutsceneConsumers(selectedCutscene.id);
            if (profileConsumers.length > 0 || worldConsumers.length > 0) {
                setStatus(
                    `cannot delete "${selectedCutscene.id}": referenced by `
                    + [...profileConsumers, ...worldConsumers].join(', ')
                );
                return;
            }
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions())
                .filter((entry) => entry.id !== selectedCutscene.id);
            selectedCutsceneId = definitions[0]?.id ?? null;
            selectedCutsceneStepIndex = 0;
            commitCutsceneRegistry(definitions, `deleted cutscene ${selectedCutscene.id}`);
        },
        onCreateCutsceneStep: () => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene) {
                return;
            }
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
            const target = definitions.find((entry) => entry.id === selectedCutscene.id);
            if (!target) {
                return;
            }
            target.steps = [
                ...target.steps,
                createDefaultCutsceneStep('wait')
            ];
            selectedCutsceneStepIndex = target.steps.length - 1;
            commitCutsceneRegistry(definitions, `added step to ${selectedCutscene.id}`);
        },
        onSelectCutsceneStep: (index) => {
            selectedCutsceneStepIndex = Number.isFinite(index) ? index : 0;
            activeTab = 'cutscenes';
            syncSidebar();
        },
        onDeleteSelectedCutsceneStep: () => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene || selectedCutsceneStepIndex < 0) {
                return;
            }
            if (selectedCutscene.steps.length <= 1) {
                setStatus('cutscene must keep at least one step');
                return;
            }
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
            const target = definitions.find((entry) => entry.id === selectedCutscene.id);
            if (!target) {
                return;
            }
            target.steps = target.steps.filter((_, index) => index !== selectedCutsceneStepIndex);
            selectedCutsceneStepIndex = Math.max(0, Math.min(selectedCutsceneStepIndex, target.steps.length - 1));
            commitCutsceneRegistry(definitions, `removed step from ${selectedCutscene.id}`);
        },
        onMoveSelectedCutsceneStep: (direction) => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene || selectedCutsceneStepIndex < 0) {
                return;
            }
            const nextIndex = selectedCutsceneStepIndex + direction;
            if (nextIndex < 0 || nextIndex >= selectedCutscene.steps.length) {
                return;
            }
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
            const target = definitions.find((entry) => entry.id === selectedCutscene.id);
            if (!target) {
                return;
            }
            const steps = target.steps.map(cloneCutsceneStep);
            const [moved] = steps.splice(selectedCutsceneStepIndex, 1);
            steps.splice(nextIndex, 0, moved);
            target.steps = steps;
            selectedCutsceneStepIndex = nextIndex;
            commitCutsceneRegistry(definitions, `reordered step in ${selectedCutscene.id}`);
        },
        onToggleSelectedLock: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            const nextLocked = !(getSelectedHandle()?.isLocked() ?? false);
            worldRuntime.setObjectLocked(rootId, nextLocked);
            markConfigDirty();
            setStatus(nextLocked ? 'locked' : 'unlocked');
        },
        onLevelFieldChange: (key, value) => {
            if (key.startsWith('audit')) {
                return;
            }
            if (key === 'switchLevelId') {
                const nextLevelId = String(value).trim();
                if (!nextLevelId || nextLevelId === levelId) {
                    return;
                }
                saveDraftNow();
                scene.scene.restart({
                    levelId: nextLevelId,
                    editorOpen: true
                });
                return;
            }

            const config = worldRuntime.getConfig();
            if (key === 'displayName' && typeof value === 'string') {
                pushUndoSnapshot();
                config.meta.displayName = value.trim() || config.meta.displayName;
                worldRuntime.setConfig(config);
                player.refreshWorldGeometryState();
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                return;
            }
            if ((key === 'worldWidth' || key === 'worldHeight') && typeof value === 'number') {
                pushUndoSnapshot();
                if (key === 'worldWidth') {
                    config.worldBounds.width = value;
                } else {
                    config.worldBounds.height = value;
                }
                worldRuntime.setConfig(config);
                player.refreshWorldGeometryState();
                syncCameraBoundsToWorld();
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                setStatus('world bounds updated');
                return;
            }
            if (key === 'nextLevelId') {
                pushUndoSnapshot();
                config.nextLevelId = typeof value === 'string' && value.length > 0 ? value : null;
                worldRuntime.setConfig(config);
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                return;
            }
            pushUndoSnapshot();
            if (applyBackgroundLevelField(config, key as BackgroundLevelFieldKey, value)) {
                worldRuntime.setConfig(config);
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({
                    refreshGeometry: false,
                    syncSidebar: false
                });
                return;
            }
        },
        onInspectorFieldChange: (key, value) => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                const isLogicRuleField = key.startsWith('logic_rule:') && isLogicRulesTabActive() && !!selectedLogicRuleId;
                if (
                    !isLogicRuleField
                    && (!key.startsWith('event:') || !isLogicTriggersTabActive() || !selectedLogicTriggerId)
                ) {
                    return;
                }
            }
            const selectedType = getSelectedHandle()?.type ?? null;
            if (key.startsWith('logic_rule:') && isLogicRulesTabActive()) {
                const config = worldRuntime.getConfig();
                config.worldLogicRules = config.worldLogicRules ?? [];
                const rule = selectedLogicRuleId
                    ? config.worldLogicRules.find((entry) => entry.id === selectedLogicRuleId) ?? null
                    : null;
                if (!rule) {
                    return;
                }
                const result = applyWorldLogicRuleEditorFieldChange(rule, key, value, {
                    npcIds: config.npcs.map((npc) => npc.id),
                    cutsceneRefs: getTestCutsceneRefs(),
                    objectIds: collectWorldLogicObjectIds(config)
                });
                if (!result.handled) {
                    return;
                }
                if (!result.changed) {
                    if (result.warning) {
                        setStatus(result.warning);
                    }
                    return;
                }
                if (typeof result.selectedRuleId !== 'undefined') {
                    selectedLogicRuleId = result.selectedRuleId;
                }
                worldRuntime.setConfig(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({
                    refreshGeometry: false,
                    syncSidebar: true
                });
                if (result.warning) {
                    setStatus(result.warning);
                }
                return;
            }
            if (key.startsWith('logic:')) {
                return;
            }
            if (key.startsWith('event:')) {
                const config = worldRuntime.getConfig();
                const triggerId = isLogicTriggersTabActive()
                    ? selectedLogicTriggerId
                    : (selectedType === 'triggerVolume' ? rootId : null);
                const trigger = triggerId
                    ? config.triggerVolumes.find((entry) => entry.id === triggerId)
                    : null;
                if (!trigger) {
                    return;
                }
                const result = applyTriggerEventEditorFieldChange(trigger, key, value, {
                    npcIds: config.npcs.map((npc) => npc.id),
                    cutsceneRefs: getTestCutsceneRefs()
                });
                if (!result.handled) {
                    return;
                }
                if (!result.changed) {
                    if (result.warning) {
                        setStatus(result.warning);
                    }
                    return;
                }
                worldRuntime.setConfig(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({
                    refreshGeometry: false,
                    syncSidebar: true
                });
                if (result.warning) {
                    setStatus(result.warning);
                }
                return;
            }
            if (key === 'directionX') {
                value = Number(value);
            }
            if (inspectorColorKeys.has(key)) {
                worldRuntime.patchObjectColors(rootId, { [key]: value });
            } else {
                worldRuntime.patchObjectFields(rootId, { [key]: value });
            }
            markConfigDirty();
        },
        onInspectorAction: (actionId) => {
            if (actionId === 'open_logic_trigger') {
                const rootId = getSelectedRootId();
                const selectedType = getSelectedHandle()?.type ?? null;
                if (!rootId || selectedType !== 'triggerVolume') {
                    return;
                }
                selectedLogicTriggerId = rootId;
                activeTab = 'logic';
                const didChange = logicActiveTab !== 'triggers';
                logicActiveTab = 'triggers';
                if (didChange) {
                    console.info(`[editor] Logic active subtab: ${logicActiveTab}`);
                }
                setStatus(`opened Logic > Triggers for ${rootId}`);
                syncSidebar();
                return;
            }
            if (actionId === 'open_logic_npc_behavior') {
                const rootId = getSelectedRootId();
                const selectedType = getSelectedHandle()?.type ?? null;
                if (!rootId || selectedType !== 'npc') {
                    return;
                }
                activeTab = 'logic';
                const didChange = logicActiveTab !== 'npc_behavior';
                logicActiveTab = 'npc_behavior';
                if (didChange) {
                    console.info(`[editor] Logic active subtab: ${logicActiveTab}`);
                }
                setStatus(`opened Logic > NPC Behavior for ${rootId}`);
                syncSidebar();
                return;
            }

            if (actionId.startsWith('logic_rule:') && isLogicRulesTabActive()) {
                const config = worldRuntime.getConfig();
                config.worldLogicRules = [...(config.worldLogicRules ?? [])];
                const result = applyWorldLogicRuleEditorAction(
                    config.worldLogicRules,
                    selectedLogicRuleId,
                    actionId,
                    {
                        npcIds: config.npcs.map((npc) => npc.id),
                        cutsceneRefs: getTestCutsceneRefs(),
                        objectIds: collectWorldLogicObjectIds(config)
                    }
                );
                if (!result.handled) {
                    return;
                }
                if (!result.changed) {
                    if (result.warning) {
                        setStatus(result.warning);
                    }
                    return;
                }
                if (typeof result.selectedRuleId !== 'undefined') {
                    selectedLogicRuleId = result.selectedRuleId;
                }
                worldRuntime.setConfig(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({
                    refreshGeometry: false,
                    syncSidebar: true
                });
                if (result.warning) {
                    setStatus(result.warning);
                }
                return;
            }

            const rootId = getSelectedRootId();
            if (!rootId && (!isLogicTriggersTabActive() || !selectedLogicTriggerId)) {
                return;
            }
            const selectedType = getSelectedHandle()?.type ?? null;
            const config = worldRuntime.getConfig();
            const triggerId = isLogicTriggersTabActive()
                ? selectedLogicTriggerId
                : (selectedType === 'triggerVolume' ? rootId : null);
            const trigger = triggerId
                ? config.triggerVolumes.find((entry) => entry.id === triggerId)
                : null;
            if (!trigger) {
                return;
            }
            const result = applyTriggerEventEditorAction(trigger, actionId, {
                npcIds: config.npcs.map((npc) => npc.id),
                cutsceneRefs: getTestCutsceneRefs()
            });
            if (!result.handled) {
                return;
            }
            if (!result.changed) {
                if (result.warning) {
                    setStatus(result.warning);
                }
                return;
            }
            worldRuntime.setConfig(config);
            redoStack.length = 0;
            onLevelConfigChanged?.(worldRuntime.getConfig());
            markConfigDirty({
                refreshGeometry: false,
                syncSidebar: true
            });
            if (result.warning) {
                setStatus(result.warning);
            }
        },
        onSequenceFieldChange: (key, value) => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence || key !== 'id' || typeof value !== 'string') {
                return;
            }
            const nextId = value.trim();
            if (nextId === selectedSequence.id) {
                return;
            }
            const idIssue = validateTestNpcScriptedSequenceId(nextId);
            if (idIssue) {
                setStatus(idIssue);
                return;
            }
            const profileConsumers = getProfileSequenceConsumers(selectedSequence.id);
            const worldConsumers = getWorldSequenceConsumers(selectedSequence.id);
            if (profileConsumers.length > 0 || worldConsumers.length > 0) {
                setStatus(
                    `cannot rename "${selectedSequence.id}": referenced by `
                    + [...profileConsumers, ...worldConsumers].join(', ')
                );
                return;
            }
            if (getScriptedSequenceDefinitions().some((entry) => entry.id === nextId)) {
                setStatus(`sequence id "${nextId}" already exists`);
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const target = definitions.find((entry) => entry.id === selectedSequence.id);
            if (!target) {
                return;
            }
            target.id = nextId;
            selectedSequenceId = nextId;
            commitScriptedSequenceRegistry(definitions, `renamed sequence to ${nextId}`);
        },
        onSequenceActionFieldChange: (key, value) => {
            const selectedSequence = getSelectedScriptedSequence();
            if (!selectedSequence || selectedSequenceActionIndex < 0) {
                return;
            }
            const definitions = cloneScriptedSequenceDefinitions(getScriptedSequenceDefinitions());
            const target = definitions.find((entry) => entry.id === selectedSequence.id);
            if (!target) {
                return;
            }
            const currentAction = target.actions[selectedSequenceActionIndex];
            if (!currentAction) {
                return;
            }

            let nextAction: ActorAction = cloneTestNpcScriptedSequenceAction(currentAction);
            if (key === 'kind' && typeof value === 'string') {
                if (!TEST_NPC_SCRIPTED_SEQUENCE_ACTION_KINDS.includes(value as TestNpcScriptedSequenceActionKind)) {
                    return;
                }
                nextAction = createDefaultScriptedSequenceAction(value as TestNpcScriptedSequenceActionKind);
            } else if (key === 'ref') {
                nextAction = {
                    ...nextAction,
                    ref: typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
                };
            } else if (nextAction.kind === 'wait' && key === 'durationMs' && typeof value === 'number' && Number.isFinite(value)) {
                nextAction = { ...nextAction, durationMs: value };
            } else if (nextAction.kind === 'face' && key === 'facing') {
                const facing = Number(value);
                if (facing === -1 || facing === 1) {
                    nextAction = { ...nextAction, facing };
                }
            } else if (nextAction.kind === 'walk_to_x' && key === 'targetX' && typeof value === 'number' && Number.isFinite(value)) {
                nextAction = { ...nextAction, targetX: value };
            } else if (nextAction.kind === 'walk_to_x' && key === 'moveSpeed' && typeof value === 'number' && Number.isFinite(value)) {
                nextAction = { ...nextAction, moveSpeed: value };
            } else if (nextAction.kind === 'walk_to_x' && key === 'tolerancePx' && typeof value === 'number' && Number.isFinite(value)) {
                nextAction = { ...nextAction, tolerancePx: value };
            } else if (nextAction.kind === 'play_animation' && key === 'animationId' && typeof value === 'string') {
                nextAction = { ...nextAction, animationId: value };
            } else if (nextAction.kind === 'set_emotion' && key === 'emotionId' && typeof value === 'string') {
                const emotionId = value.trim();
                const supportedEmotion = NPC_SET_EMOTION_OPTIONS.some((option) => option.value === emotionId);
                if (!supportedEmotion) {
                    return;
                }
                nextAction = { ...nextAction, emotionId };
            } else if (nextAction.kind === 'trigger_event' && key === 'eventId' && typeof value === 'string') {
                nextAction = { ...nextAction, eventId: value };
            } else if (nextAction.kind === 'trigger_event' && key === 'payloadJson' && typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed.length === 0) {
                    nextAction = { ...nextAction, payload: undefined };
                } else {
                    try {
                        const parsed = JSON.parse(trimmed) as unknown;
                        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                            setStatus('trigger_event payload must be a JSON object');
                            return;
                        }
                        nextAction = { ...nextAction, payload: parsed as Record<string, unknown> };
                    } catch (error) {
                        setStatus(error instanceof Error ? `payload json invalid: ${error.message}` : 'payload json invalid');
                        return;
                    }
                }
            } else {
                return;
            }

            target.actions = target.actions.map((action, index) => (
                index === selectedSequenceActionIndex ? nextAction : cloneTestNpcScriptedSequenceAction(action)
            ));
            commitScriptedSequenceRegistry(definitions, `updated action in ${selectedSequence.id}`);
        },
        onCutsceneFieldChange: (key, value) => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene) {
                return;
            }
            if (key === 'id' && typeof value === 'string') {
                const nextId = value.trim();
                if (nextId === selectedCutscene.id) {
                    return;
                }
                const idIssue = validateTestCutsceneId(nextId);
                if (idIssue) {
                    setStatus(idIssue);
                    return;
                }
                const profileConsumers = getProfileCutsceneConsumers(selectedCutscene.id);
                const worldConsumers = getCutsceneConsumers(selectedCutscene.id);
                if (profileConsumers.length > 0 || worldConsumers.length > 0) {
                    setStatus(
                        `cannot rename "${selectedCutscene.id}": referenced by `
                        + [...profileConsumers, ...worldConsumers].join(', ')
                    );
                    return;
                }
                if (getCutsceneDefinitions().some((entry) => entry.id === nextId)) {
                    setStatus(`cutscene id "${nextId}" already exists`);
                    return;
                }
                const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
                const target = definitions.find((entry) => entry.id === selectedCutscene.id);
                if (!target) {
                    return;
                }
                target.id = nextId;
                selectedCutsceneId = nextId;
                commitCutsceneRegistry(definitions, `renamed cutscene to ${nextId}`);
                return;
            }
            if (key === 'mode' && (value === 'in_level' || value === 'overlay')) {
                const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
                const target = definitions.find((entry) => entry.id === selectedCutscene.id);
                if (!target) {
                    return;
                }
                target.mode = value;
                commitCutsceneRegistry(definitions, `updated mode for ${selectedCutscene.id}`);
            }
        },
        onCutsceneStepFieldChange: (key, value) => {
            const selectedCutscene = getSelectedCutscene();
            if (!selectedCutscene || selectedCutsceneStepIndex < 0) {
                return;
            }
            const definitions = cloneCutsceneDefinitions(getCutsceneDefinitions());
            const target = definitions.find((entry) => entry.id === selectedCutscene.id);
            if (!target) {
                return;
            }
            const currentStep = target.steps[selectedCutsceneStepIndex];
            if (!currentStep) {
                return;
            }

            let nextStep: TestCutsceneStep = cloneCutsceneStep(currentStep);
            if (key === 'kind' && typeof value === 'string') {
                if (!TEST_CUTSCENE_STEP_KINDS.includes(value as typeof TEST_CUTSCENE_STEP_KINDS[number])) {
                    return;
                }
                nextStep = createDefaultCutsceneStep(value as typeof TEST_CUTSCENE_STEP_KINDS[number]);
            } else if (key === 'ref') {
                nextStep = {
                    ...nextStep,
                    ref: typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
                };
            } else if (nextStep.kind === 'camera_focus_actor' && key === 'actorId' && typeof value === 'string') {
                nextStep = { ...nextStep, actorId: value.trim() };
            } else if (nextStep.kind === 'camera_focus_actor' && key === 'durationMs') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric < 0) {
                    setStatus('camera_focus_actor.durationMs must be >= 0');
                    return;
                }
                nextStep = { ...nextStep, durationMs: numeric };
            } else if (nextStep.kind === 'camera_focus_actor' && key === 'ease' && typeof value === 'string') {
                const trimmed = value.trim();
                nextStep = { ...nextStep, ease: trimmed.length > 0 ? trimmed : undefined };
            } else if (nextStep.kind === 'camera_focus_actor' && key === 'tolerancePx') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric <= 0) {
                    setStatus('camera_focus_actor.tolerancePx must be > 0');
                    return;
                }
                nextStep = { ...nextStep, tolerancePx: numeric };
            } else if (nextStep.kind === 'camera_pan_to' && key === 'x') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                    return;
                }
                nextStep = { ...nextStep, x: numeric };
            } else if (nextStep.kind === 'camera_pan_to' && key === 'y') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                    return;
                }
                nextStep = { ...nextStep, y: numeric };
            } else if (nextStep.kind === 'camera_pan_to' && key === 'durationMs') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric < 0) {
                    setStatus('camera_pan_to.durationMs must be >= 0');
                    return;
                }
                nextStep = { ...nextStep, durationMs: numeric };
            } else if (nextStep.kind === 'camera_pan_to' && key === 'ease' && typeof value === 'string') {
                const trimmed = value.trim();
                nextStep = { ...nextStep, ease: trimmed.length > 0 ? trimmed : undefined };
            } else if (nextStep.kind === 'wait' && key === 'durationMs') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric < 0) {
                    setStatus('wait.durationMs must be >= 0');
                    return;
                }
                nextStep = { ...nextStep, durationMs: numeric };
            } else if (nextStep.kind === 'play_sfx' && key === 'sfxId' && typeof value === 'string') {
                nextStep = { ...nextStep, sfxId: value.trim() };
            } else if (nextStep.kind === 'spawn_vfx' && key === 'vfxId' && typeof value === 'string') {
                nextStep = { ...nextStep, vfxId: value.trim() };
            } else if (nextStep.kind === 'spawn_vfx' && key === 'actorId' && typeof value === 'string') {
                const trimmed = value.trim();
                nextStep = { ...nextStep, actorId: trimmed.length > 0 ? trimmed : undefined };
            } else if (nextStep.kind === 'spawn_vfx' && key === 'x') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                    return;
                }
                nextStep = { ...nextStep, x: numeric };
            } else if (nextStep.kind === 'spawn_vfx' && key === 'y') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) {
                    return;
                }
                nextStep = { ...nextStep, y: numeric };
            } else if (nextStep.kind === 'subtitle' && key === 'text' && typeof value === 'string') {
                nextStep = { ...nextStep, text: value };
            } else if (nextStep.kind === 'subtitle' && key === 'durationMs') {
                const numeric = Number(value);
                if (!Number.isFinite(numeric) || numeric < 0) {
                    setStatus('subtitle.durationMs must be >= 0');
                    return;
                }
                nextStep = { ...nextStep, durationMs: numeric };
            } else if (nextStep.kind === 'actor_sequence_ref' && key === 'actorId' && typeof value === 'string') {
                nextStep = { ...nextStep, actorId: value.trim() };
            } else if (nextStep.kind === 'actor_sequence_ref' && key === 'sequenceRef' && typeof value === 'string') {
                nextStep = { ...nextStep, sequenceRef: value.trim() };
            } else if (nextStep.kind === 'set_emotion' && key === 'actorId' && typeof value === 'string') {
                nextStep = { ...nextStep, actorId: value.trim() };
            } else if (nextStep.kind === 'set_emotion' && key === 'emotionId' && typeof value === 'string') {
                const emotionId = value.trim();
                const supportedEmotion = NPC_SET_EMOTION_OPTIONS.some((option) => option.value === emotionId);
                if (!supportedEmotion) {
                    return;
                }
                nextStep = { ...nextStep, emotionId };
            } else {
                return;
            }

            target.steps = target.steps.map((step, index) => (
                index === selectedCutsceneStepIndex ? nextStep : cloneCutsceneStep(step)
            ));
            commitCutsceneRegistry(definitions, `updated step in ${selectedCutscene.id}`);
        }
    });

    const syncSidebar = (): void => {
        if (destroyed) {
            return;
        }
        sidebar.setState(buildSidebarState());
    };

    const syncCameraBoundsToWorld = (): void => {
        const worldBounds = worldRuntime.getWorldBounds();
        const camera = scene.cameras.main;
        camera.setBounds(0, 0, worldBounds.width, worldBounds.height);
        const maxScrollX = Math.max(0, worldBounds.width - (camera.width / camera.zoom));
        const maxScrollY = Math.max(0, worldBounds.height - (camera.height / camera.zoom));
        camera.setScroll(
            Math.max(0, Math.min(camera.scrollX, maxScrollX)),
            Math.max(0, Math.min(camera.scrollY, maxScrollY))
        );
    };

    const cancelPlacementMode = (): void => {
        if (!pendingPlacementType) {
            return;
        }
        pendingPlacementType = null;
        syncSidebar();
        setStatus('placement cancelled');
    };

    const placePendingObject = (pointer: Input.Pointer): void => {
        if (!pendingPlacementType) {
            return;
        }
        const placementType = pendingPlacementType;
        const preview = buildPlacementPreview(placementType, pointer.worldX, pointer.worldY);
        const worldX = preview?.anchorX ?? pointer.worldX;
        const worldY = preview?.anchorY ?? pointer.worldY;
        pushUndoSnapshot();
        const createdId = worldRuntime.createObject(placementType, worldX, worldY);
        redoStack.length = 0;
        pendingPlacementType = null;
        selectRoot(createdId);
        markConfigDirty();
        if (createdId) {
            setStatus(`placed ${createdId}`);
        } else {
            setStatus(`failed to place ${placementType}`);
        }
    };

    const pushUndoSnapshot = (): void => {
        undoStack.push(worldRuntime.getConfig());
        if (undoStack.length > 100) {
            undoStack.shift();
        }
    };

    const scheduleAutosave = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
        }
        autosaveTimer = window.setTimeout(() => {
            saveDraftNow();
        }, DRAFT_AUTOSAVE_DELAY_MS);
    };

    const saveDraftNow = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        saveTestWorldEditorDraft(levelId, worldRuntime.getConfig());
    };

    const markConfigDirty = (
        options: {
            refreshGeometry?: boolean;
            syncSidebar?: boolean;
        } = {}
    ): void => {
        if (options.refreshGeometry ?? true) {
            player.refreshWorldGeometryState();
        }
        scheduleAutosave();
        if (options.syncSidebar ?? true) {
            syncSidebar();
        }
    };

    const setStatus = (message: string): void => {
        if (destroyed) {
            return;
        }
        status = message;
        syncSidebar();
    };

    const selectRoot = (rootId: string | null): void => {
        if (!rootId) {
            selectedHandleId = null;
        } else {
            const nextHandle = getHandles().find((entry) => entry.rootId === rootId && entry.part === 'main')
                ?? getHandles().find((entry) => entry.rootId === rootId)
                ?? null;
            selectedHandleId = nextHandle?.id ?? null;
            const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === rootId)?.type ?? null;
            if (selectedType === 'npc' && activeTab !== 'background' && activeTab !== 'level' && activeTab !== 'objects') {
                activeTab = 'npc';
            }
            if (activeTab === 'npc' && selectedType !== 'npc') {
                selectedHandleId = null;
            }
        }
        syncSidebar();
    };

    const snapValue = (value: number): number => {
        if (!gridEnabled || gridSize <= 1) {
            return value;
        }
        return Math.round(value / gridSize) * gridSize;
    };

    const boundsToEdges = (bounds: TestWorldEditorBounds): TestWorldEditorEdges => ({
        left: bounds.x - (bounds.width * 0.5),
        right: bounds.x + (bounds.width * 0.5),
        top: bounds.y - (bounds.height * 0.5),
        bottom: bounds.y + (bounds.height * 0.5)
    });

    const edgesToBounds = (edges: TestWorldEditorEdges): TestWorldEditorBounds => ({
        x: (edges.left + edges.right) * 0.5,
        y: (edges.top + edges.bottom) * 0.5,
        width: Math.max(MIN_EDITOR_RECT_SIZE, edges.right - edges.left),
        height: Math.max(MIN_EDITOR_RECT_SIZE, edges.bottom - edges.top)
    });

    const snapMoveAxis = (min: number, max: number): { min: number; max: number } => {
        if (!gridEnabled || gridSize <= 1) {
            return { min, max };
        }

        const size = max - min;
        const snappedMin = snapValue(min);
        const snappedMax = snapValue(max);
        const minError = Math.abs(snappedMin - min);
        const maxError = Math.abs(snappedMax - max);
        if (minError <= maxError) {
            return {
                min: snappedMin,
                max: snappedMin + size
            };
        }

        return {
            min: snappedMax - size,
            max: snappedMax
        };
    };

    const snapMoveBounds = (bounds: TestWorldEditorBounds): TestWorldEditorBounds => {
        const edges = boundsToEdges(bounds);
        const horizontal = snapMoveAxis(edges.left, edges.right);
        const vertical = snapMoveAxis(edges.top, edges.bottom);
        return edgesToBounds({
            left: horizontal.min,
            right: horizontal.max,
            top: vertical.min,
            bottom: vertical.max
        });
    };

    const snapResizeBounds = (
        bounds: TestWorldEditorBounds,
        handle: ResizeHandle,
        dx: number,
        dy: number
    ): TestWorldEditorBounds => {
        const edges = boundsToEdges(bounds);
        const nextEdges = { ...edges };

        if (handle === 'nw' || handle === 'sw') {
            nextEdges.left = edges.left + dx;
            if (gridEnabled && gridSize > 1) {
                nextEdges.left = snapValue(nextEdges.left);
            }
            nextEdges.left = Math.min(nextEdges.left, edges.right - MIN_EDITOR_RECT_SIZE);
        } else {
            nextEdges.right = edges.right + dx;
            if (gridEnabled && gridSize > 1) {
                nextEdges.right = snapValue(nextEdges.right);
            }
            nextEdges.right = Math.max(nextEdges.right, edges.left + MIN_EDITOR_RECT_SIZE);
        }

        if (handle === 'nw' || handle === 'ne') {
            nextEdges.top = edges.top + dy;
            if (gridEnabled && gridSize > 1) {
                nextEdges.top = snapValue(nextEdges.top);
            }
            nextEdges.top = Math.min(nextEdges.top, edges.bottom - MIN_EDITOR_RECT_SIZE);
        } else {
            nextEdges.bottom = edges.bottom + dy;
            if (gridEnabled && gridSize > 1) {
                nextEdges.bottom = snapValue(nextEdges.bottom);
            }
            nextEdges.bottom = Math.max(nextEdges.bottom, edges.top + MIN_EDITOR_RECT_SIZE);
        }

        return edgesToBounds(nextEdges);
    };

    const getPlacementAnchorPart = (type: TestWorldEditorObjectType): TestWorldEditorSelectionPart => {
        return type === 'triggerPlatform' ? 'platform' : 'main';
    };

    const buildPlacementPreview = (type: TestWorldEditorObjectType, anchorX: number, anchorY: number): TestWorldPlacementPreview | null => {
        if (type === 'playerSpawn') {
            const spawnBounds = snapMoveBounds({
                x: anchorX,
                y: anchorY,
                width: worldRuntime.getConfig().playerSpawn.width,
                height: worldRuntime.getConfig().playerSpawn.height
            });
            return {
                anchorX: spawnBounds.x,
                anchorY: spawnBounds.y,
                rects: [{
                    bounds: spawnBounds,
                    part: 'main'
                }]
            };
        }

        const adapter = TEST_WORLD_EDITOR_ADAPTERS[type];
        const previewConfig = adapter.createDefault({
            id: '__placement_preview__',
            x: anchorX,
            y: anchorY
        });
        if (!previewConfig) {
            return null;
        }

        const handleDefinitions = adapter.getHandles(previewConfig);
        const anchorHandle = handleDefinitions.find((entry) => entry.part === getPlacementAnchorPart(type)) ?? handleDefinitions[0];
        if (!anchorHandle) {
            return null;
        }

        const rawAnchorBounds = anchorHandle.getBounds(previewConfig);
        const snappedAnchorBounds = snapMoveBounds(rawAnchorBounds);
        const snappedAnchorX = anchorX + (snappedAnchorBounds.x - rawAnchorBounds.x);
        const snappedAnchorY = anchorY + (snappedAnchorBounds.y - rawAnchorBounds.y);
        const snappedConfig = adapter.createDefault({
            id: '__placement_preview__',
            x: snappedAnchorX,
            y: snappedAnchorY
        });
        if (!snappedConfig) {
            return null;
        }

        return {
            anchorX: snappedAnchorX,
            anchorY: snappedAnchorY,
            rects: adapter.getHandles(snappedConfig).map((entry) => ({
                bounds: entry.getBounds(snappedConfig),
                part: entry.part
            }))
        };
    };

    const getCameraCenter = (): { x: number; y: number } => {
        const camera = scene.cameras.main;
        return {
            x: camera.scrollX + (camera.width * 0.5 / camera.zoom),
            y: camera.scrollY + (camera.height * 0.5 / camera.zoom)
        };
    };

    const getResizeHandleAtPointer = (handle: TestWorldEditorHandle, worldX: number, worldY: number): ResizeHandle | null => {
        const bounds = handle.getBounds();
        const points: Array<{ kind: ResizeHandle; x: number; y: number }> = [
            { kind: 'nw', x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'ne', x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'sw', x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
            { kind: 'se', x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
        ];
        return points.find((point) => Math.abs(worldX - point.x) <= RESIZE_HANDLE_SIZE && Math.abs(worldY - point.y) <= RESIZE_HANDLE_SIZE)?.kind ?? null;
    };

    const beginCameraPan = (pointer: Input.Pointer): void => {
        pointerDragState = {
            mode: 'pan',
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            startScrollX: scene.cameras.main.scrollX,
            startScrollY: scene.cameras.main.scrollY
        };
    };

    const beginObjectInteraction = (pointer: Input.Pointer): void => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const selectedHandle = getSelectedHandle();
        if (selectedHandle && !selectedHandle.isLocked()) {
            const resizeHandle = getResizeHandleAtPointer(selectedHandle, worldX, worldY);
            if (resizeHandle) {
                pushUndoSnapshot();
                pointerDragState = {
                    mode: 'resize',
                    handle: resizeHandle,
                    startWorldX: worldX,
                    startWorldY: worldY,
                    startScrollX: 0,
                    startScrollY: 0,
                    initialBounds: selectedHandle.getBounds()
                };
                return;
            }
        }

        const hit = [...getSelectableHandles()].reverse().find((entry) => entry.containsPoint(worldX, worldY)) ?? null;
        if (!hit) {
            selectedHandleId = null;
            syncSidebar();
            return;
        }

        selectedHandleId = hit.id;
        syncSidebar();
        if (hit.isLocked()) {
            return;
        }
        pushUndoSnapshot();
        pointerDragState = {
            mode: 'move',
            startWorldX: worldX,
            startWorldY: worldY,
            startScrollX: 0,
            startScrollY: 0,
            initialBounds: hit.getBounds()
        };
    };

    const patchBackgroundBounds = (targetId: BackgroundSelectionId, bounds: TestWorldEditorBounds): TestWorldConfig => {
        const config = worldRuntime.getConfig();
        if (targetId === 'static') {
            applyBackgroundLevelField(config, 'backgroundStaticX', bounds.x);
            applyBackgroundLevelField(config, 'backgroundStaticY', bounds.y);
            applyBackgroundLevelField(config, 'backgroundStaticWidth', bounds.width);
            applyBackgroundLevelField(config, 'backgroundStaticHeight', bounds.height);
            return config;
        }

        const layerNumber = targetId === 'layer_1' ? 1 : 2;
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}X`, bounds.x);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Y`, bounds.y);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Width`, bounds.width);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Height`, bounds.height);
        return config;
    };

    const beginBackgroundInteraction = (pointer: Input.Pointer): void => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const selectedBackgroundHandle = getSelectedBackgroundHandle();
        if (selectedBackgroundHandle) {
            const resizeHandle = getResizeHandleAtPointer({
                getBounds: () => selectedBackgroundHandle.bounds
            } as TestWorldEditorHandle, worldX, worldY);
            if (resizeHandle) {
                pushUndoSnapshot();
                pointerDragState = {
                    mode: 'resize',
                    handle: resizeHandle,
                    startWorldX: worldX,
                    startWorldY: worldY,
                    startScrollX: 0,
                    startScrollY: 0,
                    initialBounds: selectedBackgroundHandle.bounds
                };
                return;
            }
        }

        const hit = [...getBackgroundHandles()].reverse().find((entry) => {
            const bounds = entry.bounds;
            const left = bounds.x - (bounds.width * 0.5);
            const right = bounds.x + (bounds.width * 0.5);
            const top = bounds.y - (bounds.height * 0.5);
            const bottom = bounds.y + (bounds.height * 0.5);
            return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
        }) ?? null;
        if (!hit) {
            selectedBackgroundId = null;
            syncSidebar();
            return;
        }

        selectedBackgroundId = hit.id;
        syncSidebar();
        pushUndoSnapshot();
        pointerDragState = {
            mode: 'move',
            startWorldX: worldX,
            startWorldY: worldY,
            startScrollX: 0,
            startScrollY: 0,
            initialBounds: hit.bounds
        };
    };

    const applyPointerDrag = (): void => {
        if (!pointerDragState) {
            return;
        }
        const pointer = scene.input.activePointer;
        if (!pointer.isDown) {
            return;
        }
        if (pointerDragState.mode === 'pan') {
            scene.cameras.main.scrollX = pointerDragState.startScrollX - (pointer.worldX - pointerDragState.startWorldX);
            scene.cameras.main.scrollY = pointerDragState.startScrollY - (pointer.worldY - pointerDragState.startWorldY);
            return;
        }

        if (!pointerDragState.initialBounds) {
            return;
        }
        const dx = pointer.worldX - pointerDragState.startWorldX;
        const dy = pointer.worldY - pointerDragState.startWorldY;
        let nextBounds = { ...pointerDragState.initialBounds };
        if (pointerDragState.mode === 'move') {
            nextBounds.x += dx;
            nextBounds.y += dy;
            nextBounds = snapMoveBounds(nextBounds);
        } else {
            nextBounds = snapResizeBounds(pointerDragState.initialBounds, pointerDragState.handle ?? 'se', dx, dy);
        }

            if (isBackgroundTabActive()) {
                const selectedBackgroundHandle = getSelectedBackgroundHandle();
                if (!selectedBackgroundHandle) {
                    return;
                }
                const config = patchBackgroundBounds(selectedBackgroundHandle.id, nextBounds);
                worldRuntime.setConfig(config);
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({ refreshGeometry: false });
                return;
            }

        const selectedHandle = getSelectedHandle();
        if (!selectedHandle) {
            return;
        }
        worldRuntime.patchObjectBounds(selectedHandle.id, nextBounds);
        markConfigDirty();
    };

    const deleteSelected = (): void => {
        const rootId = getSelectedRootId();
        if (!rootId || rootId === 'player_spawn') {
            return;
        }
        pushUndoSnapshot();
        worldRuntime.removeObject(rootId);
        redoStack.length = 0;
        selectedHandleId = null;
        markConfigDirty();
        setStatus(`deleted ${rootId}`);
    };

    const focusTarget = (id: string): void => {
        const point = worldRuntime.focusObjectPoint(id);
        if (!point) {
            return;
        }
        scene.cameras.main.centerOn(point.x, point.y);
    };

    const captureGameplayCameraSnapshot = (): EditorCameraSnapshot => {
        const camera = scene.cameras.main;
        return {
            scrollX: camera.scrollX,
            scrollY: camera.scrollY,
            zoom: camera.zoom
        };
    };

    const syncEditorPreviewCameraBasis = (): void => {
        onEditorPreviewCameraBasisChanged?.(
            active && gameplayCameraSnapshot
                ? {
                    scrollX: gameplayCameraSnapshot.scrollX,
                    scrollY: gameplayCameraSnapshot.scrollY,
                    zoom: gameplayCameraSnapshot.zoom
                }
                : null
        );
    };

    const toggleEditor = (): void => {
        if (destroyed) {
            return;
        }
        active = !active;
        overlayText.setVisible(active);
        rulerGraphics.setVisible(active);
        rulerCanvas.style.display = active ? 'block' : 'none';
        syncEventDebugPanelVisibility();
        if (active) {
            renderEventDebugEntries();
            gameplayCameraSnapshot = captureGameplayCameraSnapshot();
            enterAuthoringEditorCameraMode();
            syncEditorPreviewCameraBasis();
            setStatus('editor mode on');
        } else {
            pointerDragState = null;
            pendingPlacementType = null;
            const camera = scene.cameras.main;
            if (gameplayCameraSnapshot) {
                camera.setZoom(gameplayCameraSnapshot.zoom);
            }
            const v2OwnsCamera = authoringEditorDevLauncher.isOpen();
            if (v2OwnsCamera) {
                setStatus('editor mode off | camera restore skipped (authoring editor v2 open)');
            } else if (tryRestoreGameplayCameraFollow('editor_runtime:toggle_off')) {
                setStatus('editor mode off');
            } else {
                setStatus('editor mode off | camera restore skipped (cutscene running)');
            }
            gameplayCameraSnapshot = null;
            syncEditorPreviewCameraBasis();
        }
        syncSidebar();
    };

    if (initialOpen) {
        toggleEditor();
    }

    const getWorldPointFromClientPosition = (clientX: number, clientY: number): { x: number; y: number } | null => {
        const canvas = scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
        return scene.cameras.main.getWorldPoint(canvasX, canvasY);
    };

    const handleCanvasPointerDown = (event: PointerEvent): void => {
        if (!active) {
            return;
        }

        const worldPoint = getWorldPointFromClientPosition(event.clientX, event.clientY);
        if (!worldPoint) {
            return;
        }

        const pointer = scene.input.activePointer;
        pointer.worldX = worldPoint.x;
        pointer.worldY = worldPoint.y;

        if (event.button === 2) {
            event.preventDefault();
            cancelPlacementMode();
            return;
        }
        if (pendingPlacementType && event.button === 0) {
            placePendingObject(pointer);
            return;
        }
        if (event.button === 1 || (event.button === 0 && spaceKey.isDown)) {
            beginCameraPan(pointer);
            return;
        }
        if (event.button === 0) {
            if (isBackgroundTabActive()) {
                beginBackgroundInteraction(pointer);
                return;
            }
            if (isObjectInteractionTabActive()) {
                beginObjectInteraction(pointer);
            }
        }
    };

    const handlePointerUp = (): void => {
        pointerDragState = null;
    };

    const handleWheel = (_pointer: Input.Pointer, _gameObjects: unknown, _dx: number, dy: number): void => {
        if (!active) {
            return;
        }
        const camera = scene.cameras.main;
        camera.setZoom(Math.max(0.25, Math.min(2.5, camera.zoom - (Math.sign(dy) * ZOOM_STEP))));
    };

    scene.input.on('pointerup', handlePointerUp);
    scene.input.on('wheel', handleWheel);
    scene.game.canvas.addEventListener('pointerdown', handleCanvasPointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        onEditorPreviewCameraBasisChanged?.(null);
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        scene.input.off('pointerup', handlePointerUp);
        scene.input.off('wheel', handleWheel);
        scene.game.canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
        window.removeEventListener('pointerup', handlePointerUp);
        worldRuntime.setEventDebugSink?.(undefined);
        selectionGraphics.destroy();
        placementGraphics.destroy();
        gridGraphics.destroy();
        rulerGraphics.destroy();
        boundsGraphics.destroy();
        authoringEditorV2Overlay.destroy();
        overlayText.destroy();
        backgroundSelectionText.destroy();
        rulerCanvas.remove();
        sidebar.destroy();
        authoringEditorDevLauncher.destroy();
        refreshDebugEventsButton?.removeEventListener('click', handleRefreshDebugEvents);
        clearDebugEventsButton?.removeEventListener('click', handleClearDebugEvents);
        eventTimelinePanel.destroy();
        eventDebugPanelRoot?.remove();
        eventDebugPanelTimelineContainer = null;
        refreshDebugEventsButton = null;
        clearDebugEventsButton = null;
        eventDebugPanelButtons = null;
        eventDebugPanelToolbar = null;
        eventDebugPanelRoot = null;
    };

    scene.events.once('shutdown', destroy);
    scene.events.once('destroy', destroy);

    syncSidebar();
    syncEventDebugPanelVisibility();

    return {
        update: (deltaMs: number): void => {
            const f2Pressed = Input.Keyboard.JustDown(toggleKey);
            if (f2Pressed && shiftKey.isDown) {
                const shouldOpenLegacyEditor = !active;
                if (shouldOpenLegacyEditor && authoringEditorDevLauncher.isOpen()) {
                    // Migration ownership: Shift+F2 keeps legacy fallback, so close V2 before opening legacy.
                    authoringEditorDevLauncher.close();
                }
                toggleEditor();
            } else if (f2Pressed) {
                if (!authoringEditorDevLauncher.isEnabled()) {
                    toggleEditor();
                } else {
                    const shouldOpenAuthoringEditorV2 = !authoringEditorDevLauncher.isOpen();
                    if (active && shouldOpenAuthoringEditorV2) {
                        // Migration ownership: F2 is now for V2, so close legacy first.
                        toggleEditor();
                    }
                    authoringEditorDevLauncher.toggle();
                }
            }
            const camera = scene.cameras.main;
            const worldBounds = worldRuntime.getWorldBounds();
            authoringEditorV2Overlay.update(camera, {
                x: 0,
                y: 0,
                width: worldBounds.width,
                height: worldBounds.height
            });
            authoringEditorDevLauncher.update(deltaMs);
            if (!active) {
                selectionGraphics.clear();
                placementGraphics.clear();
                gridGraphics.clear();
                rulerGraphics.clear();
                boundsGraphics.clear();
                overlayText.setVisible(false);
                backgroundSelectionText.setVisible(false);
                return;
            }

            const domTextInputFocused = isDomTextInputFocused();
            const pointer = scene.input.activePointer;
            const helpOverlayPosition = resolveTestHudAnchorPosition(scene, TEST_EDITOR_HELP_OVERLAY_LAYOUT);
            overlayText.setPosition(helpOverlayPosition.x, helpOverlayPosition.y);
            const selectedHandle = isBackgroundTabActive()
                ? null
                : getSelectedHandle();
            const selectedBounds = selectedHandle?.getBounds() ?? null;
            overlayText.setText([
                'Shift+F2 legacy toggle  F2 authoring v2 toggle  Del delete  Ctrl+D duplicate  Ctrl+Z/Y undo redo',
                pendingPlacementType
                    ? `Placement ${pendingPlacementType}: LMB place  Esc/RMB cancel  wheel zoom`
                    : 'LMB select/move  drag corners resize  wheel zoom  middle or Space+drag pan',
                `Arrows pan camera  G grid  1/2/3/4 = ${GRID_SIZES.join('/')}  F focus  P spawn`,
                `Cursor ${Math.round(pointer.worldX)},${Math.round(pointer.worldY)}`
                + (selectedBounds ? `  |  Selected ${Math.round(selectedBounds.x)},${Math.round(selectedBounds.y)}` : '')
            ].join('\n'));

            if (!domTextInputFocused) {
                digitKeys.forEach((key, index) => {
                    if (Input.Keyboard.JustDown(key)) {
                        gridSize = GRID_SIZES[index] ?? gridSize;
                        setStatus(`grid ${gridSize}`);
                    }
                });
                if (Input.Keyboard.JustDown(gridKey)) {
                    gridEnabled = !gridEnabled;
                    setStatus(gridEnabled ? 'grid on' : 'grid off');
                }
                if (Input.Keyboard.JustDown(cancelPlacementKey)) {
                    cancelPlacementMode();
                }
                if (!pendingPlacementType && (Input.Keyboard.JustDown(deleteKey) || Input.Keyboard.JustDown(backspaceKey))) {
                    deleteSelected();
                }
                if (!pendingPlacementType && ctrlKey.isDown && Input.Keyboard.JustDown(duplicateKey)) {
                    const rootId = getSelectedRootId();
                    if (rootId) {
                        pushUndoSnapshot();
                        const duplicatedId = worldRuntime.duplicateObject(rootId);
                        redoStack.length = 0;
                        selectRoot(duplicatedId);
                        markConfigDirty();
                    }
                }
                if (ctrlKey.isDown && Input.Keyboard.JustDown(undoKey) && undoStack.length > 0) {
                    const previous = undoStack.pop();
                    if (previous) {
                        redoStack.push(worldRuntime.getConfig());
                        worldRuntime.setConfig(previous);
                        syncCameraBoundsToWorld();
                        onLevelConfigChanged?.(worldRuntime.getConfig());
                        syncSidebar();
                    }
                }
                if (ctrlKey.isDown && Input.Keyboard.JustDown(redoKey) && redoStack.length > 0) {
                    const next = redoStack.pop();
                    if (next) {
                        undoStack.push(worldRuntime.getConfig());
                        worldRuntime.setConfig(next);
                        syncCameraBoundsToWorld();
                        onLevelConfigChanged?.(worldRuntime.getConfig());
                        syncSidebar();
                    }
                }
                if (!pendingPlacementType && Input.Keyboard.JustDown(focusKey)) {
                    if (isBackgroundTabActive()) {
                        const backgroundHandle = getSelectedBackgroundHandle();
                        if (backgroundHandle) {
                            scene.cameras.main.centerOn(backgroundHandle.bounds.x, backgroundHandle.bounds.y);
                        }
                    } else if (isObjectInteractionTabActive()) {
                        const rootId = getSelectedRootId();
                        if (rootId) {
                            focusTarget(rootId);
                        }
                    }
                }
                if (!pendingPlacementType && Input.Keyboard.JustDown(focusSpawnKey)) {
                    focusTarget('player_spawn');
                }
            }

            const panStep = (CAMERA_PAN_SPEED * deltaMs) / 1000;
            if (!domTextInputFocused) {
                if (leftKey.isDown) {
                    camera.scrollX -= panStep;
                }
                if (rightKey.isDown) {
                    camera.scrollX += panStep;
                }
                if (upKey.isDown) {
                    camera.scrollY -= panStep;
                }
                if (downKey.isDown) {
                    camera.scrollY += panStep;
                }
            }

            applyPointerDrag();
            drawWorldBoundsOverlay(boundsGraphics, camera, worldBounds);
            drawGrid(gridGraphics, camera, worldBounds, gridEnabled ? gridSize : 0);
            drawCoordinateRulerCanvas(
                rulerCanvas,
                rulerCanvasContext,
                camera,
                worldBounds,
                gridEnabled ? gridSize : 0
            );
            const selectedBackgroundHandle = getSelectedBackgroundHandle();
            drawSelection(
                selectionGraphics,
                isBackgroundTabActive()
                    ? (selectedBackgroundHandle
                        ? ({
                            getBounds: () => selectedBackgroundHandle.bounds
                        } as TestWorldEditorHandle)
                        : null)
                    : getSelectedHandle(),
                isBackgroundTabActive() ? 0x8cffd1 : 0xffeb3b,
                isBackgroundTabActive() ? 0x8cffd1 : 0xffeb3b
            );
            if (isBackgroundTabActive() && selectedBackgroundHandle) {
                const backgroundBadgePosition = resolveTestHudAnchorPosition(scene, TEST_EDITOR_BACKGROUND_BADGE_LAYOUT);
                backgroundSelectionText.setText(
                    `Background: ${selectedBackgroundHandle.label}  @ ${Math.round(selectedBackgroundHandle.bounds.x)},${Math.round(selectedBackgroundHandle.bounds.y)}`
                );
                backgroundSelectionText.setPosition(
                    backgroundBadgePosition.x - backgroundSelectionText.width,
                    backgroundBadgePosition.y
                );
                backgroundSelectionText.setVisible(true);
            } else {
                backgroundSelectionText.setVisible(false);
            }
            drawPlacementPreview(
                placementGraphics,
                camera,
                pendingPlacementType,
                scene.input.activePointer,
                (type, worldX, worldY) => buildPlacementPreview(type, worldX, worldY)
            );
        },
        isActive: (): boolean => active,
        open: (): void => {
            if (destroyed || active) {
                return;
            }
            toggleEditor();
        },
        close: (): void => {
            if (destroyed || !active) {
                return;
            }
            toggleEditor();
        },
        destroy
    };
};

const drawSelection = (
    graphics: Phaser.GameObjects.Graphics,
    handle: TestWorldEditorHandle | null,
    strokeColor: number = 0xffeb3b,
    fillColor: number = 0xffeb3b
): void => {
    graphics.clear();
    if (!handle) {
        return;
    }
    const bounds = handle.getBounds();
    graphics.lineStyle(2, strokeColor, 1);
    graphics.strokeRect(bounds.x - (bounds.width * 0.5), bounds.y - (bounds.height * 0.5), bounds.width, bounds.height);
    const points = [
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
    ];
    points.forEach((point) => {
        graphics.fillStyle(fillColor, 1);
        graphics.fillRect(point.x - 4, point.y - 4, 8, 8);
    });
};

const drawWorldBoundsOverlay = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    bounds: { width: number; height: number }
): void => {
    graphics.clear();
    const viewLeft = camera.worldView.left;
    const viewRight = camera.worldView.right;
    const viewTop = camera.worldView.top;
    const viewBottom = camera.worldView.bottom;
    const innerLeft = 0;
    const innerTop = 0;
    const innerRight = bounds.width;
    const innerBottom = bounds.height;
    const visibleInnerTop = Math.max(viewTop, innerTop);
    const visibleInnerBottom = Math.min(viewBottom, innerBottom);

    graphics.fillStyle(0x041017, 0.22);
    if (viewTop < innerTop) {
        graphics.fillRect(viewLeft, viewTop, viewRight - viewLeft, innerTop - viewTop);
    }
    if (viewBottom > innerBottom) {
        graphics.fillRect(viewLeft, innerBottom, viewRight - viewLeft, viewBottom - innerBottom);
    }
    if (viewLeft < innerLeft && visibleInnerBottom > visibleInnerTop) {
        graphics.fillRect(viewLeft, visibleInnerTop, innerLeft - viewLeft, visibleInnerBottom - visibleInnerTop);
    }
    if (viewRight > innerRight && visibleInnerBottom > visibleInnerTop) {
        graphics.fillRect(innerRight, visibleInnerTop, viewRight - innerRight, visibleInnerBottom - visibleInnerTop);
    }

    graphics.lineStyle(3, 0x7ee0ff, 0.95);
    graphics.strokeRect(innerLeft, innerTop, bounds.width, bounds.height);
    graphics.lineStyle(1, 0xb3ecff, 0.5);
    graphics.strokeRect(innerLeft + 2, innerTop + 2, Math.max(0, bounds.width - 4), Math.max(0, bounds.height - 4));
};

const drawGrid = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    bounds: { width: number; height: number },
    gridSize: number
): void => {
    graphics.clear();
    if (gridSize <= 1) {
        return;
    }

    const left = Math.max(0, Math.floor(camera.worldView.left / gridSize) * gridSize);
    const right = Math.min(bounds.width, Math.ceil(camera.worldView.right / gridSize) * gridSize);
    const top = Math.max(0, Math.floor(camera.worldView.top / gridSize) * gridSize);
    const bottom = Math.min(bounds.height, Math.ceil(camera.worldView.bottom / gridSize) * gridSize);
    if (right <= left || bottom <= top) {
        return;
    }

    graphics.lineStyle(1, 0xffffff, 0.08);
    for (let x = left; x <= right; x += gridSize) {
        graphics.moveTo(x, top);
        graphics.lineTo(x, bottom);
    }
    for (let y = top; y <= bottom; y += gridSize) {
        graphics.moveTo(left, y);
        graphics.lineTo(right, y);
    }
    graphics.strokePath();
};

const computeRulerStep = (
    camera: Phaser.Cameras.Scene2D.Camera,
    gridSize: number
): number => {
    const minWorldStep = 72 / Math.max(camera.zoom, 0.0001);
    const baseStep = gridSize > 1 ? gridSize : 8;
    let step = baseStep;
    while (step < minWorldStep) {
        step *= 2;
    }
    return step;
};

const drawCoordinateRulerCanvas = (
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    camera: Phaser.Cameras.Scene2D.Camera,
    bounds: { width: number; height: number },
    gridSize: number
): void => {
    const viewportWidth = camera.width;
    const viewportHeight = camera.height;
    if (canvas.width !== viewportWidth || canvas.height !== viewportHeight) {
        canvas.width = Math.max(1, viewportWidth);
        canvas.height = Math.max(1, viewportHeight);
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(7, 19, 26, 0.88)';
    context.fillRect(0, 0, viewportWidth, RULER_THICKNESS_PX);
    context.fillRect(0, 0, RULER_THICKNESS_PX, viewportHeight);
    context.fillStyle = 'rgba(16, 33, 43, 0.95)';
    context.fillRect(0, 0, RULER_THICKNESS_PX, RULER_THICKNESS_PX);
    context.strokeStyle = 'rgba(184, 236, 255, 0.22)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, RULER_THICKNESS_PX + 0.5);
    context.lineTo(viewportWidth, RULER_THICKNESS_PX + 0.5);
    context.moveTo(RULER_THICKNESS_PX + 0.5, 0);
    context.lineTo(RULER_THICKNESS_PX + 0.5, viewportHeight);
    context.stroke();

    const worldLeft = Math.max(0, camera.worldView.left);
    const worldRight = Math.min(bounds.width, camera.worldView.right);
    const worldTop = Math.max(0, camera.worldView.top);
    const worldBottom = Math.min(bounds.height, camera.worldView.bottom);
    if (worldRight <= worldLeft || worldBottom <= worldTop) {
        return;
    }

    const step = computeRulerStep(camera, gridSize);
    const tickAlpha = 0.55;
    const majorTickSize = 9;
    const minorTickSize = 5;
    context.strokeStyle = `rgba(184, 236, 255, ${tickAlpha})`;
    context.fillStyle = '#d7f6ff';
    context.font = '10px monospace';
    context.textBaseline = 'top';

    const xStart = Math.floor(worldLeft / step) * step;
    for (let x = xStart; x <= worldRight; x += step) {
        if (x < 0 || x > bounds.width) {
            continue;
        }
        const screenX = (x - camera.worldView.left) * camera.zoom;
        if (screenX < RULER_THICKNESS_PX - 2 || screenX > viewportWidth) {
            continue;
        }
        const isMajor = x % (step * 2) === 0;
        context.beginPath();
        context.moveTo(screenX + 0.5, RULER_THICKNESS_PX);
        context.lineTo(screenX + 0.5, RULER_THICKNESS_PX - (isMajor ? majorTickSize : minorTickSize));
        context.stroke();
        if (isMajor) {
            context.fillText(`${Math.round(x)}`, screenX + 3, 3);
        }
    }

    const yStart = Math.floor(worldTop / step) * step;
    for (let y = yStart; y <= worldBottom; y += step) {
        if (y < 0 || y > bounds.height) {
            continue;
        }
        const screenY = (y - camera.worldView.top) * camera.zoom;
        if (screenY < RULER_THICKNESS_PX - 2 || screenY > viewportHeight) {
            continue;
        }
        const isMajor = y % (step * 2) === 0;
        context.beginPath();
        context.moveTo(RULER_THICKNESS_PX, screenY + 0.5);
        context.lineTo(RULER_THICKNESS_PX - (isMajor ? majorTickSize : minorTickSize), screenY + 0.5);
        context.stroke();
        if (isMajor) {
            context.fillText(`${Math.round(y)}`, 3, screenY + 1);
        }
    }
};

const drawPlacementPreview = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    pendingPlacementType: TestWorldEditorObjectType | null,
    pointer: Input.Pointer,
    resolvePreview: (type: TestWorldEditorObjectType, worldX: number, worldY: number) => TestWorldPlacementPreview | null
): void => {
    graphics.clear();
    if (!pendingPlacementType || !pointer.withinGame) {
        return;
    }

    const preview = resolvePreview(pendingPlacementType, pointer.worldX, pointer.worldY);
    if (!preview) {
        return;
    }

    const size = PLACEMENT_PREVIEW_SIZE / camera.zoom;
    preview.rects.forEach((entry) => {
        const isPrimary = entry.part === 'main' || entry.part === 'platform';
        const color = isPrimary ? 0x8cffd1 : 0xb8fff0;
        const alpha = isPrimary ? 0.95 : 0.65;
        graphics.lineStyle(2, color, alpha);
        graphics.fillStyle(color, 0.08);
        graphics.fillRect(
            entry.bounds.x - (entry.bounds.width * 0.5),
            entry.bounds.y - (entry.bounds.height * 0.5),
            entry.bounds.width,
            entry.bounds.height
        );
        graphics.strokeRect(
            entry.bounds.x - (entry.bounds.width * 0.5),
            entry.bounds.y - (entry.bounds.height * 0.5),
            entry.bounds.width,
            entry.bounds.height
        );
    });

    graphics.lineStyle(2, 0x8cffd1, 0.95);
    graphics.lineBetween(preview.anchorX - size * 1.4, preview.anchorY, preview.anchorX + size * 1.4, preview.anchorY);
    graphics.lineBetween(preview.anchorX, preview.anchorY - size * 1.4, preview.anchorX, preview.anchorY + size * 1.4);
};

const summarizeTriggerCommand = (
    command: TestWorldTriggerVolumeConfig['enterCommand'] | TestWorldTriggerVolumeConfig['exitCommand']
): string => {
    if (!command) {
        return 'None';
    }
    const valueText = typeof command.value === 'boolean'
        ? String(command.value)
        : String(command.value ?? '');
    return `${command.targetType}:${command.targetId} / ${command.operation} = ${valueText}`;
};

const summarizeTriggerCommandPresence = (
    command: TestWorldTriggerVolumeConfig['enterCommand'] | TestWorldTriggerVolumeConfig['exitCommand']
): string => {
    return command ? 'present' : 'none';
};

const buildLogicTriggerSections = (
    config: TestWorldConfig,
    trigger: TestWorldTriggerVolumeConfig | null
): TestWorldEditorSidebarSection[] => {
    if (!trigger) {
        return [];
    }
    const onEnterCount = trigger.onEnter?.length ?? 0;
    const onExitCount = trigger.onExit?.length ?? 0;
    const onStayCount = trigger.onStay?.length ?? 0;
    return [
        {
            title: 'Logic Editor / Triggers',
            fields: [
                { key: 'logic:trigger:id', label: 'Trigger Id', input: 'text', value: trigger.id },
                { key: 'logic:trigger:activator', label: 'Activator', input: 'text', value: trigger.activator },
                {
                    key: 'logic:trigger:geometry',
                    label: 'Geometry',
                    input: 'text',
                    value: `trigger(${Math.round(trigger.triggerX)}, ${Math.round(trigger.triggerY)}, ${Math.round(trigger.triggerWidth)}, ${Math.round(trigger.triggerHeight)})`
                },
                {
                    key: 'logic:trigger:releaseGeometry',
                    label: 'Release Geometry',
                    input: 'text',
                    value: `release(${Math.round(trigger.deactivateTriggerX ?? 0)}, ${Math.round(trigger.deactivateTriggerY ?? 0)}, ${Math.round(trigger.deactivateTriggerWidth ?? 0)}, ${Math.round(trigger.deactivateTriggerHeight ?? 0)})`
                },
                {
                    key: 'logic:trigger:sourceIds',
                    label: 'Source Ids',
                    input: 'text',
                    value: (trigger.sourceIds ?? []).join(', ')
                },
                {
                    key: 'logic:trigger:eventCounts',
                    label: 'Event Blocks',
                    input: 'text',
                    value: `onEnter=${onEnterCount}, onExit=${onExitCount}, onStay=${onStayCount}`
                },
                {
                    key: 'logic:trigger:legacyEnter',
                    label: 'Legacy enterCommand',
                    input: 'text',
                    value: summarizeTriggerCommand(trigger.enterCommand ?? null)
                },
                {
                    key: 'logic:trigger:legacyExit',
                    label: 'Legacy exitCommand',
                    input: 'text',
                    value: summarizeTriggerCommand(trigger.exitCommand ?? null)
                }
            ]
        },
        ...buildTriggerEventEditorSections(trigger, {
            npcIds: config.npcs.map((npc) => npc.id),
            cutsceneRefs: getTestCutsceneRefs()
        })
    ];
};

const collectWorldLogicObjectIds = (config: TestWorldConfig): string[] => {
    return [
        ...config.surfaces.map((entry) => entry.id),
        ...config.hazards.map((entry) => entry.id),
        ...config.checkpoints.map((entry) => entry.id),
        ...config.movingPlatforms.map((entry) => entry.id),
        ...config.triggerPlatforms.map((entry) => entry.id),
        ...config.triggerVolumes.map((entry) => entry.id),
        ...config.dragBoxes.map((entry) => entry.id),
        ...config.windZones.map((entry) => entry.id),
        ...config.triangleFlightBreakWalls.map((entry) => entry.id),
        ...config.trianglePickups.map((entry) => entry.id),
        ...(config.finish ? [config.finish.id] : [])
    ];
};

const buildLogicRuleSections = (
    config: TestWorldConfig,
    rule: TestWorldLogicRule | null
): TestWorldEditorSidebarSection[] => {
    return buildWorldLogicRuleEditorSections(rule, {
        npcIds: config.npcs.map((npc) => npc.id),
        cutsceneRefs: getTestCutsceneRefs(),
        objectIds: collectWorldLogicObjectIds(config)
    });
};

const summarizeWorldLogicRule = (rule: TestWorldLogicRule): string => {
    const whenSummary = rule.when.kind === 'trigger_event'
        ? `trigger_event:${rule.when.eventId}`
        : rule.when.kind;
    return `WHEN ${whenSummary} -> DO ${rule.actions.length} actions`;
};

const buildLogicFlagsSections = (): TestWorldEditorSidebarSection[] => {
    const snapshot = getWorldFlagsDebugSnapshot();
    const lines = Object.entries(snapshot)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([flagId, value]) => `${flagId} = ${value ? 'true' : 'false'}`);
    return [{
        title: 'Runtime Flags Snapshot',
        fields: [{
            key: 'logic:flags:snapshot',
            label: 'Flags',
            input: 'textarea',
            value: lines.length > 0 ? lines.join('\n') : 'No runtime flags set'
        }]
    }];
};

const buildInspectorSections = (
    config: TestWorldConfig,
    rootId: string | null,
    type: TestWorldEditorObjectType | null
): TestWorldEditorSidebarSection[] => {
    if (!rootId || !type) {
        return [];
    }

    if (type === 'playerSpawn') {
        return [{
            title: 'Transform',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: config.playerSpawn.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: config.playerSpawn.y, step: 1 },
                { key: 'width', label: 'Width', input: 'number', value: config.playerSpawn.width, min: 8, step: 1 },
                { key: 'height', label: 'Height', input: 'number', value: config.playerSpawn.height, min: 8, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: config.playerSpawn.fillColor ?? 0x81d4fa },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: config.playerSpawn.strokeColor ?? 0x0277bd }
            ]
        }];
    }
    if (type === 'finish') {
        const entry = config.finish?.id === rootId ? config.finish : null;
        return entry ? [{
            title: 'Finish',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                { key: 'width', label: 'Width', input: 'number', value: entry.width, min: 8, step: 1 },
                { key: 'height', label: 'Height', input: 'number', value: entry.height, min: 8, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0x99ff99 },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0x00aa66 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }

    const findById = <T extends { id: string }>(items: readonly T[]): T | null => items.find((entry) => entry.id === rootId) ?? null;
    const rectSection = (entry: { x: number; y: number; width: number; height: number; fillColor?: number; strokeColor?: number }): TestWorldEditorSidebarSection => ({
        title: 'Bounds',
        fields: [
            { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
            { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
            { key: 'width', label: 'Width', input: 'number', value: entry.width, min: 8, step: 1 },
            { key: 'height', label: 'Height', input: 'number', value: entry.height, min: 8, step: 1 },
            { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0x999999 },
            { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffffff }
        ]
    });
    const resolveInitialManpuValue = (value: string | null | undefined): string => {
        if (value === undefined) {
            return 'none';
        }
        const resolved = resolveTestNpcManpuEmotion(value);
        if (resolved.shouldHide) {
            return 'none';
        }
        return resolved.canonicalEmotionId ?? 'none';
    };
    const npcSections = (entry: NonNullable<ReturnType<typeof findById<TestWorldConfig['npcs'][number]>>>): TestWorldEditorSidebarSection[] => {
        const resolved = resolveTestNpcConfig(entry);
        const profileOptions = getTestNpcProfiles().map((candidate) => ({
            value: candidate.id,
            label: `${candidate.id} - ${candidate.displayName}`
        }));
        const behaviorPageCount = Array.isArray((entry.behavior as Record<string, unknown> | undefined)?.pages)
            ? ((entry.behavior as Record<string, unknown>).pages as unknown[]).length
            : 0;
        const scriptedSequenceRef = entry.scriptedLoopRef === null
            ? 'none'
            : (entry.scriptedLoopRef ?? (resolved?.scriptedLoopRef ?? 'none'));
        return [
            {
                title: 'NPC',
                fields: [
                    { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                    { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                    {
                        key: 'profileId',
                        label: 'Profile',
                        input: 'select',
                        value: entry.profileId,
                        options: profileOptions
                    },
                    {
                        key: 'initialManpuEmotionId',
                        label: 'Initial Manpu',
                        input: 'select',
                        value: resolveInitialManpuValue(entry.initialManpuEmotionId),
                        options: NPC_INITIAL_MANPU_OPTIONS.map((option) => ({
                            value: option.value,
                            label: option.label
                        }))
                    },
                    {
                        key: 'facing',
                        label: 'Facing',
                        input: 'select',
                        value: entry.facing ?? 'right',
                        options: [
                            { value: 'right', label: 'Right' },
                            { value: 'left', label: 'Left' }
                        ]
                    },
                    { key: 'logic:npc:scriptedLoopRef', label: 'Scripted Sequence Ref', input: 'text', value: scriptedSequenceRef },
                    { key: 'logic:npc:behaviorPages', label: 'Behavior Pages Count', input: 'number', value: behaviorPageCount }
                ]
            },
            {
                title: 'Logic',
                fields: [],
                actions: [
                    { id: 'open_logic_npc_behavior', label: 'Open in Logic / NPC Behavior' }
                ]
            },
            buildVisualOrderSection('npc', entry)
        ];
    };

    if (type === 'surface') {
        const entry = findById(config.surfaces);
        return entry ? [
            rectSection(entry),
            {
                title: 'Surface',
                fields: [
                    {
                        key: 'collisionMode',
                        label: 'Collision',
                        input: 'select',
                        value: entry.collisionMode ?? 'solid',
                        options: [
                            { value: 'solid', label: 'Solid' },
                            { value: 'visual_only', label: 'Visual Only' }
                        ]
                    },
                    {
                        key: 'alpha',
                        label: 'Alpha',
                        input: 'number',
                        value: entry.alpha ?? ((entry.collisionMode ?? 'solid') === 'visual_only' ? 0.45 : 1),
                        min: 0,
                        step: 0.05
                    }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    if (type === 'npc') {
        const entry = findById(config.npcs);
        return entry ? npcSections(entry) : [];
    }
    if (type === 'hazard') {
        const entry = findById(config.hazards);
        return entry ? [rectSection(entry), buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'checkpoint') {
        const entry = findById(config.checkpoints);
        return entry ? [rectSection(entry), {
            title: 'Checkpoint',
            fields: [
                { key: 'respawnX', label: 'Respawn X', input: 'number', value: entry.respawnX, step: 1 },
                { key: 'respawnY', label: 'Respawn Y', input: 'number', value: entry.respawnY, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'movingPlatform') {
        const entry = findById(config.movingPlatforms);
        return entry ? [rectSection(entry), {
            title: 'Platform',
            fields: [
                { key: 'axis', label: 'Axis', input: 'select', value: entry.axis, options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] },
                { key: 'travelDistance', label: 'Travel', input: 'number', value: entry.travelDistance, min: 0, step: 1 },
                { key: 'speed', label: 'Speed', input: 'number', value: entry.speed, min: 0, step: 1 },
                {
                    key: 'initialMotionState',
                    label: 'Initial Motion',
                    input: 'select',
                    value: entry.initialMotionState ?? 'running_loop',
                    options: [
                        { value: 'running_loop', label: 'Running Loop' },
                        { value: 'stopped', label: 'Stopped' },
                        { value: 'run_once', label: 'Run Once' }
                    ]
                }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'dragBox') {
        const entry = findById(config.dragBoxes);
        return entry ? [rectSection(entry), {
            title: 'Drag Box',
            fields: [
                { key: 'targetTriggerPlatformId', label: 'Linked Trigger Id', input: 'text', value: entry.targetTriggerPlatformId ?? '' },
                { key: 'gravityY', label: 'Gravity Y', input: 'number', value: entry.gravityY ?? 2200, min: 0, step: 1 },
                { key: 'mass', label: 'Mass', input: 'number', value: entry.mass ?? 10, min: 1, step: 1 },
                { key: 'pullAcceleration', label: 'Pull Accel', input: 'number', value: entry.pullAcceleration ?? 1400, min: 0, step: 1 },
                { key: 'pullMaxSpeed', label: 'Pull Max Speed', input: 'number', value: entry.pullMaxSpeed ?? 150, min: 0, step: 1 },
                { key: 'dragX', label: 'Drag X', input: 'number', value: entry.dragX ?? 900, min: 0, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'windZone') {
        const entry = findById(config.windZones);
        return entry ? [rectSection(entry), {
            title: 'Wind',
            fields: [
                { key: 'directionX', label: 'Direction', input: 'select', value: String(entry.directionX), options: [{ value: '1', label: 'Right' }, { value: '-1', label: 'Left' }] },
                { key: 'force', label: 'Force', input: 'number', value: entry.force, min: 0, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'triangleFlightBreakWall') {
        const entry = findById(config.triangleFlightBreakWalls);
        return entry ? [rectSection(entry), buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'trianglePickup') {
        const entry = findById(config.trianglePickups);
        return entry ? [{
            title: 'Pickup',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                { key: 'radius', label: 'Radius', input: 'number', value: entry.radius, min: 4, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0xfff59d },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffca28 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'triggerPlatform') {
        const entry = findById(config.triggerPlatforms);
        return entry ? [
            {
                title: 'Trigger Zone',
                fields: [
                    { key: 'triggerX', label: 'X', input: 'number', value: entry.triggerX, step: 1 },
                    { key: 'triggerY', label: 'Y', input: 'number', value: entry.triggerY, step: 1 },
                    { key: 'triggerWidth', label: 'Width', input: 'number', value: entry.triggerWidth, min: 8, step: 1 },
                    { key: 'triggerHeight', label: 'Height', input: 'number', value: entry.triggerHeight, min: 8, step: 1 },
                    { key: 'triggerFillColor', label: 'Fill', input: 'color', value: entry.triggerFillColor ?? 0xfff59d },
                    { key: 'triggerStrokeColor', label: 'Stroke', input: 'color', value: entry.triggerStrokeColor ?? 0xf9a825 }
                ]
            },
            {
                title: 'Release Zone',
                fields: [
                    { key: 'deactivateTriggerX', label: 'X', input: 'number', value: entry.deactivateTriggerX ?? 0, step: 1 },
                    { key: 'deactivateTriggerY', label: 'Y', input: 'number', value: entry.deactivateTriggerY ?? 0, step: 1 },
                    { key: 'deactivateTriggerWidth', label: 'Width', input: 'number', value: entry.deactivateTriggerWidth ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerHeight', label: 'Height', input: 'number', value: entry.deactivateTriggerHeight ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerFillColor', label: 'Fill', input: 'color', value: entry.deactivateTriggerFillColor ?? 0xffccbc },
                    { key: 'deactivateTriggerStrokeColor', label: 'Stroke', input: 'color', value: entry.deactivateTriggerStrokeColor ?? 0xe64a19 }
                ]
            },
            {
                title: 'Platform',
                fields: [
                    { key: 'platformX', label: 'X', input: 'number', value: entry.platformX, step: 1 },
                    { key: 'platformY', label: 'Y', input: 'number', value: entry.platformY, step: 1 },
                    { key: 'platformWidth', label: 'Width', input: 'number', value: entry.platformWidth, min: 8, step: 1 },
                    { key: 'platformHeight', label: 'Height', input: 'number', value: entry.platformHeight, min: 8, step: 1 },
                    { key: 'platformFillColor', label: 'Fill', input: 'color', value: entry.platformFillColor ?? 0x616161 },
                    { key: 'platformStrokeColor', label: 'Stroke', input: 'color', value: entry.platformStrokeColor ?? 0xb0bec5 },
                    { key: 'activator', label: 'Activator', input: 'select', value: entry.activator ?? 'player', options: [{ value: 'player', label: 'Player' }, { value: 'drag_box', label: 'Drag Box' }] },
                    { key: 'triggerAction', label: 'On Trigger', input: 'select', value: entry.triggerAction ?? 'activate', options: [{ value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' }] },
                    { key: 'deactivateTriggerAction', label: 'On Release Zone', input: 'select', value: entry.deactivateTriggerAction ?? 'deactivate', options: [{ value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' }] },
                    { key: 'initiallyActive', label: 'Initial Active', input: 'checkbox', value: entry.initiallyActive ?? false }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    if (type === 'triggerVolume') {
        const entry = findById(config.triggerVolumes);
        return entry ? [
            {
                title: 'Trigger Zone',
                fields: [
                    { key: 'triggerX', label: 'X', input: 'number', value: entry.triggerX, step: 1 },
                    { key: 'triggerY', label: 'Y', input: 'number', value: entry.triggerY, step: 1 },
                    { key: 'triggerWidth', label: 'Width', input: 'number', value: entry.triggerWidth, min: 8, step: 1 },
                    { key: 'triggerHeight', label: 'Height', input: 'number', value: entry.triggerHeight, min: 8, step: 1 },
                    { key: 'triggerFillColor', label: 'Fill', input: 'color', value: entry.triggerFillColor ?? 0xb3e5fc },
                    { key: 'triggerStrokeColor', label: 'Stroke', input: 'color', value: entry.triggerStrokeColor ?? 0x0277bd }
                ]
            },
            {
                title: 'Release Zone',
                fields: [
                    { key: 'deactivateTriggerX', label: 'X', input: 'number', value: entry.deactivateTriggerX ?? 0, step: 1 },
                    { key: 'deactivateTriggerY', label: 'Y', input: 'number', value: entry.deactivateTriggerY ?? 0, step: 1 },
                    { key: 'deactivateTriggerWidth', label: 'Width', input: 'number', value: entry.deactivateTriggerWidth ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerHeight', label: 'Height', input: 'number', value: entry.deactivateTriggerHeight ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerFillColor', label: 'Fill', input: 'color', value: entry.deactivateTriggerFillColor ?? 0xffccbc },
                    { key: 'deactivateTriggerStrokeColor', label: 'Stroke', input: 'color', value: entry.deactivateTriggerStrokeColor ?? 0xe64a19 }
                ]
            },
            {
                title: 'Trigger',
                fields: [
                    { key: 'activator', label: 'Activator', input: 'select', value: entry.activator, options: [{ value: 'player', label: 'Player' }, { value: 'drag_box', label: 'Drag Box' }] },
                    { key: 'sourceIdsCsv', label: 'Source Ids', input: 'text', value: (entry.sourceIds ?? []).join(', ') },
                    { key: 'logic:summary:enterCommandPresence', label: 'Legacy enterCommand', input: 'text', value: summarizeTriggerCommandPresence(entry.enterCommand ?? null) },
                    { key: 'logic:summary:exitCommandPresence', label: 'Legacy exitCommand', input: 'text', value: summarizeTriggerCommandPresence(entry.exitCommand ?? null) }
                ]
            },
            {
                title: 'Event Blocks Summary',
                fields: [
                    {
                        key: 'logic:summary:onEnterCount',
                        label: 'On Enter Blocks',
                        input: 'number',
                        value: entry.onEnter?.length ?? 0
                    },
                    {
                        key: 'logic:summary:onExitCount',
                        label: 'On Exit Blocks',
                        input: 'number',
                        value: entry.onExit?.length ?? 0
                    },
                    {
                        key: 'logic:summary:onStayCount',
                        label: 'On Stay Blocks',
                        input: 'number',
                        value: entry.onStay?.length ?? 0
                    }
                ],
                actions: [
                    { id: 'open_logic_trigger', label: 'Open in Logic' }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    return [];
};

const buildNpcInspectorSections = (
    config: TestWorldConfig,
    rootId: string | null
): TestWorldEditorSidebarSection[] => {
    if (!rootId) {
        return [];
    }
    const entry = config.npcs.find((npc) => npc.id === rootId) ?? null;
    if (!entry) {
        return [];
    }
    return buildInspectorSections(config, rootId, 'npc');
};

const buildScriptedSequenceSections = (
    definition: TestNpcScriptedSequenceDefinition | null
): TestWorldEditorSidebarSection[] => {
    if (!definition) {
        return [];
    }

    return [{
        title: 'Sequence',
        fields: [
            {
                key: 'id',
                label: 'Sequence Id',
                input: 'text',
                value: definition.id
            }
        ]
    }];
};

const buildScriptedSequenceAuditSections = (): TestWorldEditorSidebarSection[] => {
    const audit = getTestNpcScriptedSequenceRegistryAuditSnapshot();
    const storageAudit = getTestNpcScriptedSequenceDraftStorageAuditSnapshot();
    return [{
        title: 'Registry Audit',
        fields: [
            { key: 'registryAuditSource', label: 'Current Source', input: 'text', value: audit.registrySource },
            { key: 'registryAuditDefaultCount', label: 'Default Count', input: 'number', value: audit.defaultSequenceCount },
            { key: 'registryAuditLiveCount', label: 'Live Count', input: 'number', value: audit.liveSequenceCount },
            { key: 'registryAuditStorageKey', label: 'Storage Key', input: 'text', value: storageAudit.storageKey },
            {
                key: 'registryAuditStoragePresent',
                label: 'Storage Draft Present',
                input: 'text',
                value: storageAudit.draftPresent ? 'yes' : 'no'
            },
            {
                key: 'registryAuditStorageCount',
                label: 'Storage Draft Count',
                input: 'number',
                value: storageAudit.draftEntryCount
            },
            {
                key: 'registryAuditStorageLastAction',
                label: 'Last Storage Action',
                input: 'text',
                value: storageAudit.lastStorageAction
            },
            { key: 'registryAuditDefaultIds', label: 'Default Ids', input: 'textarea', value: audit.defaultSequenceIds.join('\n') },
            { key: 'registryAuditLiveIds', label: 'Live Ids', input: 'textarea', value: audit.liveSequenceIds.join('\n') },
            {
                key: 'registryAuditModuleInitCount',
                label: 'Module Init Default Count',
                input: 'number',
                value: audit.moduleInitDefaultSequenceCount
            },
            {
                key: 'registryAuditModuleInitIds',
                label: 'Module Init Default Ids',
                input: 'textarea',
                value: audit.moduleInitDefaultSequenceIds.join('\n')
            }
        ]
    }];
};

const buildScriptedSequenceActionSections = (
    action: ActorAction | null
): TestWorldEditorSidebarSection[] => {
    if (!action) {
        return [];
    }

    const baseFields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: 'kind',
            label: 'Kind',
            input: 'select',
            value: action.kind,
            options: TEST_NPC_SCRIPTED_SEQUENCE_ACTION_KINDS.map((kind) => ({
                value: kind,
                label: kind
            }))
        },
        {
            key: 'ref',
            label: 'Ref',
            input: 'text',
            value: action.ref ?? ''
        }
    ];

    if (action.kind === 'wait') {
        return [{
            title: 'Action',
            fields: [
                ...baseFields,
                {
                    key: 'durationMs',
                    label: 'Duration Ms',
                    input: 'number',
                    value: action.durationMs,
                    min: 0,
                    step: 1
                }
            ]
        }];
    }
    if (action.kind === 'face') {
        return [{
            title: 'Action',
            fields: [
                ...baseFields,
                {
                    key: 'facing',
                    label: 'Facing',
                    input: 'select',
                    value: String(action.facing),
                    options: [
                        { value: '1', label: 'Right' },
                        { value: '-1', label: 'Left' }
                    ]
                }
            ]
        }];
    }
    if (action.kind === 'walk_to_x') {
        return [{
            title: 'Action',
            fields: [
                ...baseFields,
                { key: 'targetX', label: 'Target X', input: 'number', value: action.targetX, step: 1 },
                { key: 'moveSpeed', label: 'Move Speed', input: 'number', value: action.moveSpeed, min: 0, step: 1 },
                { key: 'tolerancePx', label: 'Tolerance Px', input: 'number', value: action.tolerancePx, min: 0, step: 1 }
            ]
        }];
    }
    if (action.kind === 'play_animation') {
        return [{
            title: 'Action',
            fields: [
                ...baseFields,
                { key: 'animationId', label: 'Animation Id', input: 'text', value: action.animationId }
            ]
        }];
    }
    if (action.kind === 'set_emotion') {
        const resolvedEmotion = resolveTestNpcManpuEmotion(action.emotionId);
        const canonicalEmotionValue = resolvedEmotion.shouldHide
            ? 'calm'
            : (resolvedEmotion.canonicalEmotionId ?? 'calm');
        return [{
            title: 'Action',
            fields: [
                ...baseFields,
                {
                    key: 'emotionId',
                    label: 'Emotion',
                    input: 'select',
                    value: canonicalEmotionValue,
                    options: NPC_SET_EMOTION_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label
                    }))
                }
            ]
        }];
    }

    return [{
        title: 'Action',
        fields: [
            ...baseFields,
            { key: 'eventId', label: 'Event Id', input: 'text', value: action.eventId },
            {
                key: 'payloadJson',
                label: 'Payload JSON',
                input: 'textarea',
                value: action.payload ? JSON.stringify(action.payload, null, 2) : ''
            }
        ]
    }];
};

const buildCutsceneSections = (
    definition: TestCutsceneDefinition | null
): TestWorldEditorSidebarSection[] => {
    if (!definition) {
        return [];
    }

    return [{
        title: 'Cutscene',
        fields: [
            {
                key: 'id',
                label: 'Cutscene Id',
                input: 'text',
                value: definition.id
            },
            {
                key: 'mode',
                label: 'Mode',
                input: 'select',
                value: definition.mode,
                options: [
                    { value: 'in_level', label: 'in_level' },
                    { value: 'overlay', label: 'overlay' }
                ]
            }
        ]
    }];
};

const buildCutsceneAuditSections = (): TestWorldEditorSidebarSection[] => {
    const audit = getTestCutsceneRegistryAuditSnapshot();
    const storageAudit = getTestCutsceneDraftStorageAuditSnapshot();
    return [{
        title: 'Registry Audit',
        fields: [
            { key: 'registryAuditSource', label: 'Current Source', input: 'text', value: audit.registrySource },
            { key: 'registryAuditDefaultCount', label: 'Default Count', input: 'number', value: audit.defaultCutsceneCount },
            { key: 'registryAuditLiveCount', label: 'Live Count', input: 'number', value: audit.liveCutsceneCount },
            { key: 'registryAuditStorageKey', label: 'Storage Key', input: 'text', value: storageAudit.storageKey },
            {
                key: 'registryAuditStoragePresent',
                label: 'Storage Draft Present',
                input: 'text',
                value: storageAudit.draftPresent ? 'yes' : 'no'
            },
            {
                key: 'registryAuditStorageCount',
                label: 'Storage Draft Count',
                input: 'number',
                value: storageAudit.draftEntryCount
            },
            {
                key: 'registryAuditStorageLastAction',
                label: 'Last Storage Action',
                input: 'text',
                value: storageAudit.lastStorageAction
            },
            { key: 'registryAuditDefaultIds', label: 'Default Ids', input: 'textarea', value: audit.defaultCutsceneIds.join('\n') },
            { key: 'registryAuditLiveIds', label: 'Live Ids', input: 'textarea', value: audit.liveCutsceneIds.join('\n') },
            {
                key: 'registryAuditModuleInitCount',
                label: 'Module Init Default Count',
                input: 'number',
                value: audit.moduleInitDefaultCutsceneCount
            },
            {
                key: 'registryAuditModuleInitIds',
                label: 'Module Init Default Ids',
                input: 'textarea',
                value: audit.moduleInitDefaultCutsceneIds.join('\n')
            }
        ]
    }];
};

const buildCutsceneStepSections = (
    config: TestWorldConfig,
    step: TestCutsceneStep | null
): TestWorldEditorSidebarSection[] => {
    if (!step) {
        return [];
    }

    const actorIdOptions = [
        { value: 'player', label: 'player' },
        ...config.npcs.map((npc) => ({
            value: npc.id,
            label: npc.id
        }))
    ];
    const withSelectedActorOption = (actorId: string): Array<{ value: string; label: string }> => {
        return actorIdOptions.some((option) => option.value === actorId)
            ? actorIdOptions
            : [{ value: actorId, label: `${actorId} (missing)` }, ...actorIdOptions];
    };

    const baseFields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: 'kind',
            label: 'Kind',
            input: 'select',
            value: step.kind,
            options: TEST_CUTSCENE_STEP_KINDS.map((kind) => ({
                value: kind,
                label: kind
            }))
        },
        {
            key: 'ref',
            label: 'Ref',
            input: 'text',
            value: step.ref ?? ''
        }
    ];

    if (step.kind === 'lock_input' || step.kind === 'unlock_input') {
        return [{ title: 'Step', fields: baseFields }];
    }
    if (step.kind === 'camera_focus_actor') {
        const cameraStep = step as TestCutsceneCameraFocusActorStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                {
                    key: 'actorId',
                    label: 'Actor Id',
                    input: 'select',
                    value: cameraStep.actorId,
                    options: withSelectedActorOption(cameraStep.actorId)
                },
                { key: 'durationMs', label: 'Duration Ms', input: 'number', value: cameraStep.durationMs ?? 280, min: 0, step: 1 },
                { key: 'ease', label: 'Ease', input: 'text', value: cameraStep.ease ?? '' },
                { key: 'tolerancePx', label: 'Tolerance Px', input: 'number', value: cameraStep.tolerancePx ?? 1.25, min: 0.1, step: 0.1 }
            ]
        }];
    }
    if (step.kind === 'camera_pan_to') {
        const panStep = step as TestCutsceneCameraPanToStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                { key: 'x', label: 'X', input: 'number', value: panStep.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: panStep.y, step: 1 },
                { key: 'durationMs', label: 'Duration Ms', input: 'number', value: panStep.durationMs, min: 0, step: 1 },
                { key: 'ease', label: 'Ease', input: 'text', value: panStep.ease ?? '' }
            ]
        }];
    }
    if (step.kind === 'wait') {
        const waitStep = step as TestCutsceneWaitStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                { key: 'durationMs', label: 'Duration Ms', input: 'number', value: waitStep.durationMs, min: 0, step: 1 }
            ]
        }];
    }
    if (step.kind === 'play_sfx') {
        const sfxStep = step as TestCutscenePlaySfxStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                { key: 'sfxId', label: 'Sfx Id', input: 'text', value: sfxStep.sfxId }
            ]
        }];
    }
    if (step.kind === 'spawn_vfx') {
        const vfxStep = step as TestCutsceneSpawnVfxStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                { key: 'vfxId', label: 'Vfx Id', input: 'text', value: vfxStep.vfxId },
                { key: 'actorId', label: 'Actor Id (Optional)', input: 'text', value: vfxStep.actorId ?? '' },
                { key: 'x', label: 'X', input: 'number', value: vfxStep.x ?? 0, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: vfxStep.y ?? 0, step: 1 }
            ]
        }];
    }
    if (step.kind === 'subtitle') {
        const subtitleStep = step as TestCutsceneSubtitleStep;
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                { key: 'text', label: 'Text', input: 'textarea', value: subtitleStep.text },
                { key: 'durationMs', label: 'Duration Ms', input: 'number', value: subtitleStep.durationMs ?? 900, min: 0, step: 1 }
            ]
        }];
    }

    if (step.kind === 'set_emotion') {
        const setEmotionStep = step as TestCutsceneSetEmotionStep;
        const resolvedEmotion = resolveTestNpcManpuEmotion(setEmotionStep.emotionId);
        const canonicalEmotionValue = resolvedEmotion.shouldHide
            ? 'calm'
            : (resolvedEmotion.canonicalEmotionId ?? 'calm');
        return [{
            title: 'Step',
            fields: [
                ...baseFields,
                {
                    key: 'actorId',
                    label: 'Actor Id',
                    input: 'select',
                    value: setEmotionStep.actorId,
                    options: withSelectedActorOption(setEmotionStep.actorId)
                },
                {
                    key: 'emotionId',
                    label: 'Emotion',
                    input: 'select',
                    value: canonicalEmotionValue,
                    options: NPC_SET_EMOTION_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label
                    }))
                }
            ]
        }];
    }

    const actorSequenceStep = step as TestCutsceneActorSequenceRefStep;
    return [{
        title: 'Step',
        fields: [
            ...baseFields,
            {
                key: 'actorId',
                label: 'Actor Id',
                input: 'select',
                value: actorSequenceStep.actorId,
                options: withSelectedActorOption(actorSequenceStep.actorId)
            },
            {
                key: 'sequenceRef',
                label: 'Sequence Ref',
                input: 'select',
                value: actorSequenceStep.sequenceRef,
                options: getTestNpcScriptedSequenceRefs().map((sequenceRef) => ({
                    value: sequenceRef,
                    label: sequenceRef
                }))
            }
        ]
    }];
};

const buildLevelSectionsLegacy = (
    config: TestWorldConfig,
    campaignLevels: ReadonlyArray<{ id: string; displayName: string }>
): TestWorldEditorSidebarSection[] => {
    const nextLevelOptions = [
        { value: '', label: 'None' },
        ...campaignLevels
            .filter((entry) => entry.id !== config.meta.id)
            .map((entry) => ({
                value: entry.id,
                label: `${entry.id} — ${entry.displayName}`
            }))
    ];
    const switchLevelOptions = campaignLevels.map((entry) => ({
        value: entry.id,
        label: `${entry.id} — ${entry.displayName}`
    }));

    return [
        {
            title: 'Metadata',
            fields: [
                { key: 'displayName', label: 'Display Name', input: 'text', value: config.meta.displayName },
                { key: 'nextLevelId', label: 'Next Level', input: 'select', value: config.nextLevelId ?? '', options: nextLevelOptions },
                { key: 'switchLevelId', label: 'Open Level', input: 'select', value: config.meta.id, options: switchLevelOptions }
            ]
        },
        {
            title: 'World',
            fields: [
                { key: 'worldWidth', label: 'Width', input: 'number', value: config.worldBounds.width, min: 64, step: 1 },
                { key: 'worldHeight', label: 'Height', input: 'number', value: config.worldBounds.height, min: 64, step: 1 }
            ]
        }
    ];
};

interface TestWorldLevelSourceAuditView {
    currentSourceLabel: string;
    campaignSourceLabel: string;
    bootstrapWorldSourceLabel: string;
    bootstrapWorldError: string | null;
    initialDraftPresent: boolean;
    draftPresent: boolean;
    draftValid: boolean;
    draftStorageKey: string;
    draftNpcCount: number;
    draftNpcIds: string[];
    draftParseError: string | null;
    fileNpcCount: number;
    fileNpcIds: string[];
    campaignNpcCount: number;
    campaignNpcIds: string[];
    loadedNpcCount: number;
    loadedNpcIds: string[];
}

const buildLevelSections = (
    config: TestWorldConfig,
    campaignLevels: ReadonlyArray<{ id: string; displayName: string }>,
    sourceAudit: TestWorldLevelSourceAuditView
): TestWorldEditorSidebarSection[] => {
    const nextLevelOptions = [
        { value: '', label: 'None' },
        ...campaignLevels
            .filter((entry) => entry.id !== config.meta.id)
            .map((entry) => ({
                value: entry.id,
                label: `${entry.id} - ${entry.displayName}`
            }))
    ];
    const switchLevelOptions = campaignLevels.map((entry) => ({
        value: entry.id,
        label: `${entry.id} - ${entry.displayName}`
    }));

    return [
        {
            title: 'Metadata',
            fields: [
                { key: 'displayName', label: 'Display Name', input: 'text', value: config.meta.displayName },
                { key: 'nextLevelId', label: 'Next Level', input: 'select', value: config.nextLevelId ?? '', options: nextLevelOptions },
                { key: 'switchLevelId', label: 'Open Level', input: 'select', value: config.meta.id, options: switchLevelOptions }
            ]
        },
        {
            title: 'World',
            fields: [
                { key: 'worldWidth', label: 'Width', input: 'number', value: config.worldBounds.width, min: 64, step: 1 },
                { key: 'worldHeight', label: 'Height', input: 'number', value: config.worldBounds.height, min: 64, step: 1 }
            ]
        },
        {
            title: 'Level Source Audit',
            fields: [
                { key: 'auditCurrentWorldSource', label: 'Current World Source', input: 'text', value: sourceAudit.currentSourceLabel },
                { key: 'auditCampaignSource', label: 'Campaign Config Source', input: 'text', value: sourceAudit.campaignSourceLabel },
                { key: 'auditBootstrapSource', label: 'Bootstrap World Source', input: 'text', value: sourceAudit.bootstrapWorldSourceLabel },
                { key: 'auditBootstrapError', label: 'Bootstrap World Error', input: 'text', value: sourceAudit.bootstrapWorldError ?? 'none' },
                { key: 'auditInitialDraftPresent', label: 'Draft Present on Boot', input: 'text', value: sourceAudit.initialDraftPresent ? 'yes' : 'no' },
                { key: 'auditDraftPresentNow', label: 'Draft Present Now', input: 'text', value: sourceAudit.draftPresent ? 'yes' : 'no' },
                { key: 'auditDraftValidNow', label: 'Draft Valid Now', input: 'text', value: sourceAudit.draftValid ? 'yes' : 'no' },
                { key: 'auditDraftStorageKey', label: 'Draft Storage Key', input: 'text', value: sourceAudit.draftStorageKey },
                { key: 'auditDraftNpcCount', label: 'Draft NPC Count', input: 'number', value: sourceAudit.draftNpcCount },
                { key: 'auditDraftNpcIds', label: 'Draft NPC Ids', input: 'textarea', value: sourceAudit.draftNpcIds.join('\n') },
                { key: 'auditDraftParseError', label: 'Draft Parse Error', input: 'text', value: sourceAudit.draftParseError ?? 'none' },
                { key: 'auditFileNpcCount', label: 'File NPC Count', input: 'number', value: sourceAudit.fileNpcCount },
                { key: 'auditFileNpcIds', label: 'File NPC Ids', input: 'textarea', value: sourceAudit.fileNpcIds.join('\n') },
                { key: 'auditCampaignNpcCount', label: 'Campaign NPC Count', input: 'number', value: sourceAudit.campaignNpcCount },
                { key: 'auditCampaignNpcIds', label: 'Campaign NPC Ids', input: 'textarea', value: sourceAudit.campaignNpcIds.join('\n') },
                { key: 'auditLoadedNpcCount', label: 'Loaded NPC Count', input: 'number', value: sourceAudit.loadedNpcCount },
                { key: 'auditLoadedNpcIds', label: 'Loaded NPC Ids', input: 'textarea', value: sourceAudit.loadedNpcIds.join('\n') }
            ]
        }
    ];
};

const buildVisualOrderSection = (
    type: TestWorldEditorObjectType,
    entry: Pick<TestWorldVisualOrderConfig, 'visualLayer' | 'renderOrder'>
): TestWorldEditorSidebarSection => {
    const resolvedLayer = resolveTestWorldVisualLayer(type, entry);
    const effectiveRenderOrder = resolveTestWorldRenderOrder(type, entry);
    const fields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: 'visualLayer',
            label: 'Layer',
            input: 'select',
            value: entry.visualLayer ?? 'default',
            options: TEST_WORLD_VISUAL_LAYER_OPTIONS.map((option) => ({
                value: option.value,
                label: option.value === 'default'
                    ? `${option.label} (${resolvedLayer})`
                    : option.label
            }))
        },
        {
            key: 'renderOrderEnabled',
            label: 'Use Explicit Order',
            input: 'checkbox',
            value: entry.renderOrder !== undefined
        },
        {
            key: 'renderOrder',
            label: 'Render Order',
            input: 'number',
            value: entry.renderOrder ?? effectiveRenderOrder,
            step: 1
        }
    ];

    return {
        title: 'Visual Order',
        fields
    };
};

const buildBackgroundSections = (config: TestWorldConfig): TestWorldEditorSidebarSection[] => {
    const editableBackground = getEditableBackground(config);
    const staticImage = cloneStaticBackgroundImage(editableBackground.staticImage);
    const layers = Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => {
        return cloneBackgroundLayer(editableBackground.layers?.[index], index);
    });

    const sections: TestWorldEditorSidebarSection[] = [
        {
            title: 'Profile',
            fields: [
                {
                    key: 'backgroundColor',
                    label: 'Base Color',
                    input: 'color',
                    value: editableBackground.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR
                }
            ]
        },
        {
            title: 'Static Layer',
            fields: [
                { key: 'backgroundStaticTextureKey', label: 'Texture Key', input: 'text', value: staticImage.textureKey },
                { key: 'backgroundStaticTextureAsset', label: 'Texture Asset', input: 'text', value: staticImage.textureAsset ?? '' },
                { key: 'backgroundStaticFillColor', label: 'Fallback Fill', input: 'color', value: staticImage.fillColor ?? 0x1f2d36 },
                { key: 'backgroundStaticTintColor', label: 'Tint', input: 'color', value: staticImage.tintColor ?? 0xffffff },
                { key: 'backgroundStaticAlpha', label: 'Alpha', input: 'number', value: staticImage.alpha ?? 1, min: 0, step: 0.05 },
                { key: 'backgroundStaticScale', label: 'Editor Scale', input: 'number', value: staticImage.scale ?? 1, min: 0.1, step: 0.1 },
                { key: 'backgroundStaticWidth', label: 'Editor Width', input: 'number', value: staticImage.width ?? 1600, min: 8, step: 1 },
                { key: 'backgroundStaticHeight', label: 'Editor Height', input: 'number', value: staticImage.height ?? 900, min: 8, step: 1 },
                { key: 'backgroundStaticRepeat', label: 'Tile Repeat', input: 'checkbox', value: staticImage.repeat ?? false },
                { key: 'backgroundStaticX', label: 'Editor Center X', input: 'number', value: staticImage.x ?? 0, step: 1 },
                { key: 'backgroundStaticY', label: 'Editor Center Y', input: 'number', value: staticImage.y ?? 0, step: 1 }
            ]
        }
    ];

    layers.forEach((layer, index) => {
        const layerNumber = index + 1;
        sections.push({
            title: `Parallax Layer ${layerNumber}`,
            fields: [
                { key: `backgroundLayer${layerNumber}TextureKey`, label: 'Texture Key', input: 'text', value: layer.textureKey },
                { key: `backgroundLayer${layerNumber}TextureAsset`, label: 'Texture Asset', input: 'text', value: layer.textureAsset ?? '' },
                { key: `backgroundLayer${layerNumber}FillColor`, label: 'Fallback Fill', input: 'color', value: layer.fillColor ?? 0x24343d },
                { key: `backgroundLayer${layerNumber}TintColor`, label: 'Tint', input: 'color', value: layer.tintColor ?? 0xffffff },
                { key: `backgroundLayer${layerNumber}Alpha`, label: 'Alpha', input: 'number', value: layer.alpha ?? 1, min: 0, step: 0.05 },
                { key: `backgroundLayer${layerNumber}Scale`, label: 'Editor Scale', input: 'number', value: layer.scale ?? 1, min: 0.1, step: 0.1 },
                { key: `backgroundLayer${layerNumber}Width`, label: 'Editor Width', input: 'number', value: layer.width ?? 1920, min: 8, step: 1 },
                { key: `backgroundLayer${layerNumber}Repeat`, label: 'Tile Repeat', input: 'checkbox', value: layer.repeat ?? true },
                { key: `backgroundLayer${layerNumber}X`, label: 'Editor Center X', input: 'number', value: layer.x ?? 0, step: 1 },
                { key: `backgroundLayer${layerNumber}Y`, label: 'Editor Center Y', input: 'number', value: layer.y, step: 1 },
                { key: `backgroundLayer${layerNumber}Height`, label: 'Editor Height', input: 'number', value: layer.height, min: 8, step: 1 },
                { key: `backgroundLayer${layerNumber}ScrollFactorX`, label: 'Game Parallax X', input: 'number', value: layer.scrollFactorX, min: 0, step: 0.05 },
                { key: `backgroundLayer${layerNumber}ScrollFactorY`, label: 'Game Parallax Y', input: 'number', value: layer.scrollFactorY ?? layer.scrollFactorX, min: 0, step: 0.05 }
            ]
        });
    });

    return sections;
};
