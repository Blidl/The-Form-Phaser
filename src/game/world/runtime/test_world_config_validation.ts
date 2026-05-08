import {
    TEST_WORLD_CONFIG,
    type TestWorldBackgroundConfig,
    type TestWorldBackgroundLayerSettingsConfig,
    type TestWorldBackgroundLayerScrollFactorConfig,
    type TestWorldBackgroundImageConfig,
    type TestWorldBackgroundObjectBoundsConfig,
    type TestWorldBackgroundObjectConfig,
    type TestWorldBackgroundObjectEditorConfig,
    type TestWorldBackgroundObjectLayerId,
    type TestWorldBackgroundObjectVisualConfig,
    type TestWorldParallaxLayerConfig,
    cloneTestWorldConfig,
    type TestWorldBoundsConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldDragBoxConfig,
    type TestWorldFinishConfig,
    type TestWorldHazardConfig,
    type TestWorldMetaConfig,
    type TestWorldLogicBindingConfig,
    type TestWorldLogicBindingTargetType,
    type TestWorldLogicConfig,
    type TestWorldLogicScriptCategory,
    type TestWorldLogicScriptCommandConfig,
    type TestWorldLogicScriptConfig,
    type TestWorldLogicScriptEditorConfig,
    type TestWorldLogicScriptRefConfig,
    type TestWorldMovingPlatformMotionState,
    type TestWorldMovingPlatformConfig,
    type TestWorldPlayerSpawnConfig,
    type TestWorldBehaviorScriptsConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTriggerCommandConfig,
    type TestWorldTriangleFlightBreakWallConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldVisualLayer,
    type TestWorldVisualOrderConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldTriggerVolumeConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';
import type { PlayerFormId } from '../../player/player_types';
import type { ActorAction } from '../../actor_actions/actor_action_types';
import type { TestEventAction, TestEventBlock } from '../../events/test_event_actions';
import type { TestEventCondition } from '../../events/test_event_conditions';
import type {
    TestWorldLogicEventMatcher,
    TestWorldLogicRule
} from '../../events/test_world_logic_rules';
import type { TestNpcInstanceConfig } from '../../npc/npc_types';
import { isTestNpcScriptedSequenceRef } from '../../npc/npc_scripted_sequences';
import { isTestCutsceneRef } from '../../cutscene/test_cutscene_registry';

const MIN_RECT_SIZE = 8;
const MIN_PICKUP_RADIUS = 4;
const MIN_WORLD_SIZE = 64;
const MAX_BACKGROUND_LAYERS = 6;
const DEFAULT_BACKGROUND_COLOR = 0x263238;
const DEFAULT_BACKGROUND_OBJECT_LAYER_SCROLL: Record<TestWorldBackgroundObjectLayerId, TestWorldBackgroundLayerScrollFactorConfig> = {
    static: { scrollFactorX: 0, scrollFactorY: 0 },
    parallax1: { scrollFactorX: 0.45, scrollFactorY: 0.45 },
    parallax2: { scrollFactorX: 0.2, scrollFactorY: 0.2 }
};
const DEFAULT_TRIGGER_PLATFORM_FILL_COLOR = 0xfff59d;
const DEFAULT_TRIGGER_PLATFORM_STROKE_COLOR = 0xf9a825;
const DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_FILL_COLOR = 0xffccbc;
const DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_STROKE_COLOR = 0xe64a19;
const DEFAULT_TRIGGER_PLATFORM_BODY_FILL_COLOR = 0x616161;
const DEFAULT_TRIGGER_PLATFORM_BODY_STROKE_COLOR = 0xb0bec5;
const DEFAULT_TRIGGER_VOLUME_FILL_COLOR = 0xb3e5fc;
const DEFAULT_TRIGGER_VOLUME_STROKE_COLOR = 0x0277bd;
const DEFAULT_TRIGGER_VOLUME_DEACTIVATE_FILL_COLOR = 0xffccbc;
const DEFAULT_TRIGGER_VOLUME_DEACTIVATE_STROKE_COLOR = 0xe64a19;
const PLAYER_FORM_IDS = new Set<PlayerFormId>(['ball', 'triangle', 'square']);
const TEST_WORLD_LOGIC_SCRIPT_CATEGORIES = new Set<TestWorldLogicScriptCategory>([
    'object.move',
    'object.rotate',
    'object.action',
    'platform.move',
    'platform.rotate',
    'platform.defaultAction',
    'platform.action',
    'npc.patrol',
    'npc.action',
    'npc.altAction',
    'cutscene.npc',
    'cutscene.camera',
    'cutscene.player',
    'cutscene.other',
    'trigger.action',
    'world.rule'
]);
const TEST_WORLD_LOGIC_BINDING_TARGET_TYPES = new Set<TestWorldLogicBindingTargetType>([
    'object',
    'npc',
    'cutscene',
    'trigger',
    'world'
]);

export type TestWorldLogicDiagnosticSeverity = 'warning' | 'error';

export type TestWorldLogicDiagnosticCode =
    | 'missing_logic_script_ref'
    | 'missing_logic_script_asset'
    | 'duplicate_logic_script_id'
    | 'duplicate_logic_script_ref'
    | 'invalid_logic_binding_target'
    | 'unsupported_logic_binding_runtime_slot'
    | 'unknown_logic_command_type'
    | 'invalid_logic_command_category'
    | 'invalid_logic_command_params'
    | 'invalid_logic_command_ref'
    | 'invalid_platform_move_script_contract'
    | 'invalid_platform_rotate_script_contract'
    | 'invalid_surface_behavior_script_assignment'
    | 'missing_logic_command_cutscene_scene_participant_dependency';

export interface TestWorldLogicDiagnostic {
    id: string;
    severity: TestWorldLogicDiagnosticSeverity;
    code: TestWorldLogicDiagnosticCode;
    message: string;
    scriptId?: string;
    commandId?: string;
    bindingId?: string;
    targetType?: string;
    targetId?: string;
    slot?: string;
    path?: string;
    cutsceneId?: string;
    missingParticipantId?: string;
}

const isRuntimeSupportedLogicBindingSlot = (targetType: string, slot: string): boolean => {
    return (targetType === 'world' && slot === 'onStart')
        || (targetType === 'object' && slot === 'onInteract')
        || (targetType === 'npc' && slot === 'onInteract')
        || (targetType === 'trigger' && slot === 'onEnter')
        || (targetType === 'cutscene' && slot === 'onFinish');
};

const getUnsupportedRuntimeBindingSlotMessage = (
    bindingLabel: string,
    targetType: string,
    slot: string
): string => {
    if (targetType === 'object') {
        return `Binding "${bindingLabel}" targets object slot "${slot}", but runtime currently supports only object/onInteract.`;
    }
    if (targetType === 'world') {
        return `Binding "${bindingLabel}" targets world slot "${slot}", but runtime currently supports only world/onStart.`;
    }
    if (targetType === 'npc') {
        return `Binding "${bindingLabel}" targets npc slot "${slot}", but runtime currently supports only npc/onInteract.`;
    }
    if (targetType === 'cutscene') {
        return `Binding "${bindingLabel}" targets cutscene slot "${slot}", but runtime currently supports only cutscene/onFinish.`;
    }
    if (targetType === 'trigger') {
        return `Binding "${bindingLabel}" targets trigger slot "${slot}", but runtime currently supports only trigger/onEnter.`;
    }
    return `Binding "${bindingLabel}" targets ${targetType} slot "${slot}", but runtime currently supports only world/onStart, object/onInteract, npc/onInteract, trigger/onEnter, and cutscene/onFinish.`;
};

const asNumber = (value: unknown, fallback: number): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const asColor = (value: unknown, fallback: number | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const asBoolean = (value: unknown, fallback: boolean = false): boolean => {
    return typeof value === 'boolean' ? value : fallback;
};

const asOptionalString = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const asString = (value: unknown, fallback: string): string => {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
};

const asArray = (value: unknown): unknown[] => {
    return Array.isArray(value) ? value : [];
};

const clampRectSize = (value: number): number => {
    return Math.max(MIN_RECT_SIZE, Math.round(value));
};

const clampPickupRadius = (value: number): number => {
    return Math.max(MIN_PICKUP_RADIUS, Math.round(value));
};

const clampAlpha = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(1, value));
};

const clampScale = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0.1, Math.min(8, value));
};

const clampScrollFactor = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(2, value));
};

const asVisualLayer = (
    value: unknown,
    fallback: TestWorldVisualLayer | undefined
): TestWorldVisualLayer | undefined => {
    if (value === 'background') {
        return 'layer_1';
    }
    if (value === 'gameplay') {
        return 'layer_3';
    }
    if (value === 'foreground') {
        return 'layer_5';
    }

    return value === 'layer_1'
        || value === 'layer_2'
        || value === 'layer_3'
        || value === 'layer_4'
        || value === 'layer_5'
        ? value
        : fallback;
};

const asRenderOrder = (value: unknown, fallback: number | undefined): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(-9999, Math.min(9999, Math.round(value)));
};

const normalizeVisualOrder = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldVisualOrderConfig
): Pick<TestWorldVisualOrderConfig, 'visualLayer' | 'renderOrder'> => {
    return {
        visualLayer: asVisualLayer(raw?.visualLayer, fallback.visualLayer),
        renderOrder: asRenderOrder(raw?.renderOrder, fallback.renderOrder)
    };
};

const ensureUniqueId = (id: string, usedIds: Set<string>, prefix: string): string => {
    let candidate = id.length > 0 ? id : prefix;
    let nextIndex = 1;
    while (usedIds.has(candidate)) {
        candidate = `${prefix}_${nextIndex}`;
        nextIndex += 1;
    }
    usedIds.add(candidate);
    return candidate;
};

const asMotionState = (
    value: unknown,
    fallback: TestWorldMovingPlatformMotionState
): TestWorldMovingPlatformMotionState => {
    if (value === 'stopped' || value === 'run_once' || value === 'running_loop') {
        return value;
    }
    return fallback;
};

const asTriggerTargetType = (
    value: unknown,
    fallback: TestWorldTriggerCommandConfig['targetType']
): TestWorldTriggerCommandConfig['targetType'] => {
    return value === 'moving_platform' || value === 'trigger_platform' || value === 'npc'
        ? value
        : fallback;
};

const asTriggerOperation = (
    value: unknown,
    fallback: TestWorldTriggerCommandConfig['operation']
): TestWorldTriggerCommandConfig['operation'] => {
    return value === 'set_motion_state' || value === 'set_active' || value === 'set_emotion'
        ? value
        : fallback;
};

const normalizeTriggerCommand = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerCommandConfig | null
): TestWorldTriggerCommandConfig | null => {
    if (!raw && !fallback) {
        return null;
    }

    const safeFallback = fallback ?? {
        targetType: 'trigger_platform',
        targetId: '',
        operation: 'set_active',
        value: true
    } satisfies TestWorldTriggerCommandConfig;
    const targetId = asString(raw?.targetId, safeFallback.targetId);
    if (targetId.length === 0) {
        return null;
    }

    const targetType = asTriggerTargetType(raw?.targetType, safeFallback.targetType);
    const operation = asTriggerOperation(raw?.operation, safeFallback.operation);
    const value = operation === 'set_motion_state'
        ? asMotionState(
            raw?.value,
            safeFallback.operation === 'set_motion_state'
                ? safeFallback.value as TestWorldMovingPlatformMotionState
                : 'running_loop'
        )
        : operation === 'set_active'
            ? asBoolean(raw?.value, safeFallback.operation === 'set_active' ? safeFallback.value as boolean : true)
            : asString(
                raw?.value,
                safeFallback.operation === 'set_emotion'
                    ? safeFallback.value as string
                    : ''
            );

    return {
        targetType,
        targetId,
        operation,
        value
    };
};

const normalizeWorldFlags = (
    raw: Record<string, unknown> | null,
    fallback: Record<string, boolean> | undefined
): Record<string, boolean> | undefined => {
    const source = raw ?? fallback ?? null;
    if (!source) {
        return undefined;
    }

    const normalized: Record<string, boolean> = {};
    Object.entries(source).forEach(([rawFlagId, rawValue]) => {
        const flagId = rawFlagId.trim();
        if (flagId.length <= 0 || typeof rawValue !== 'boolean') {
            return;
        }
        normalized[flagId] = rawValue;
    });
    return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeActorAction = (
    raw: Record<string, unknown> | null
): ActorAction | null => {
    if (!raw || typeof raw.kind !== 'string') {
        return null;
    }

    if (raw.kind === 'wait') {
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0) {
            return null;
        }
        return {
            kind: 'wait',
            durationMs: raw.durationMs
        };
    }

    if (raw.kind === 'face') {
        if (raw.facing !== -1 && raw.facing !== 1) {
            return null;
        }
        return {
            kind: 'face',
            facing: raw.facing
        };
    }

    if (raw.kind === 'walk_to_x') {
        if (typeof raw.targetX !== 'number' || !Number.isFinite(raw.targetX)) {
            return null;
        }
        if (typeof raw.moveSpeed !== 'number' || !Number.isFinite(raw.moveSpeed) || raw.moveSpeed < 0) {
            return null;
        }
        if (typeof raw.tolerancePx !== 'number' || !Number.isFinite(raw.tolerancePx) || raw.tolerancePx < 0) {
            return null;
        }
        return {
            kind: 'walk_to_x',
            targetX: raw.targetX,
            moveSpeed: raw.moveSpeed,
            tolerancePx: raw.tolerancePx
        };
    }

    if (raw.kind === 'play_animation') {
        const animationId = asOptionalString(raw.animationId);
        if (!animationId) {
            return null;
        }
        return {
            kind: 'play_animation',
            animationId
        };
    }

    if (raw.kind === 'set_emotion') {
        const emotionId = asOptionalString(raw.emotionId);
        if (!emotionId) {
            return null;
        }
        return {
            kind: 'set_emotion',
            emotionId
        };
    }

    if (raw.kind === 'trigger_event') {
        const eventId = asOptionalString(raw.eventId);
        if (!eventId) {
            return null;
        }
        const payload = asObject(raw.payload) ?? undefined;
        return {
            kind: 'trigger_event',
            eventId,
            payload
        };
    }

    return null;
};

const normalizeTestEventCondition = (
    raw: Record<string, unknown> | null
): TestEventCondition | null => {
    if (!raw || typeof raw.kind !== 'string') {
        return null;
    }

    if (raw.kind === 'flag') {
        const flagId = asOptionalString(raw.flagId);
        if (!flagId || typeof raw.equals !== 'boolean') {
            return null;
        }
        return {
            kind: 'flag',
            flagId,
            equals: raw.equals
        };
    }

    if (raw.kind === 'once') {
        const key = asOptionalString(raw.key);
        return key ? { kind: 'once', key } : { kind: 'once' };
    }

    if (raw.kind === 'player_form') {
        const form = asOptionalString(raw.form);
        if (!form || !PLAYER_FORM_IDS.has(form as PlayerFormId)) {
            return null;
        }
        return {
            kind: 'player_form',
            form
        };
    }

    return null;
};

const normalizeTestEventAction = (
    raw: Record<string, unknown> | null
): TestEventAction | null => {
    if (!raw || typeof raw.kind !== 'string') {
        return null;
    }

    if (raw.kind === 'actor_action') {
        const actorId = asOptionalString(raw.actorId);
        const action = normalizeActorAction(asObject(raw.action));
        if (!actorId || !action) {
            return null;
        }
        return {
            kind: 'actor_action',
            actorId,
            action
        };
    }

    if (raw.kind === 'start_cutscene') {
        const cutsceneRef = asOptionalString(raw.cutsceneRef);
        if (!cutsceneRef) {
            return null;
        }
        return {
            kind: 'start_cutscene',
            cutsceneRef
        };
    }

    if (raw.kind === 'set_flag') {
        const flagId = asOptionalString(raw.flagId);
        if (!flagId || typeof raw.value !== 'boolean') {
            return null;
        }
        return {
            kind: 'set_flag',
            flagId,
            value: raw.value
        };
    }

    if (raw.kind === 'trigger_event') {
        const eventId = asOptionalString(raw.eventId);
        if (!eventId) {
            return null;
        }
        return {
            kind: 'trigger_event',
            eventId,
            payload: asObject(raw.payload) ?? undefined
        };
    }

    if (raw.kind === 'play_sfx') {
        const sfxId = asOptionalString(raw.sfxId);
        if (!sfxId) {
            return null;
        }
        return {
            kind: 'play_sfx',
            sfxId
        };
    }

    if (raw.kind === 'spawn_vfx') {
        const vfxId = asOptionalString(raw.vfxId);
        if (!vfxId) {
            return null;
        }
        const actorId = asOptionalString(raw.actorId) ?? undefined;
        const x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : undefined;
        const y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : undefined;
        return {
            kind: 'spawn_vfx',
            vfxId,
            actorId,
            x,
            y
        };
    }

    return null;
};

const normalizeTestEventBlock = (
    raw: Record<string, unknown> | null,
    fallbackId: string
): TestEventBlock | null => {
    if (!raw) {
        return null;
    }
    const id = asString(raw.id, fallbackId);
    const actions = asArray(raw.actions)
        .map((entry) => normalizeTestEventAction(asObject(entry)))
        .filter((entry): entry is TestEventAction => entry !== null);
    if (actions.length <= 0) {
        return null;
    }
    const conditions = asArray(raw.conditions)
        .map((entry) => normalizeTestEventCondition(asObject(entry)))
        .filter((entry): entry is TestEventCondition => entry !== null);
    return {
        id,
        conditions: conditions.length > 0 ? conditions : undefined,
        actions
    };
};

const normalizeTestEventBlocks = (
    raw: unknown,
    ownerPrefix: string
): TestEventBlock[] | undefined => {
    const blocks = asArray(raw)
        .map((entry, index) => normalizeTestEventBlock(asObject(entry), `${ownerPrefix}_block_${index + 1}`))
        .filter((entry): entry is TestEventBlock => entry !== null);
    return blocks.length > 0 ? blocks : undefined;
};

const normalizeTestWorldLogicEventMatcher = (
    raw: Record<string, unknown> | null
): TestWorldLogicEventMatcher | null => {
    if (!raw || typeof raw.kind !== 'string') {
        return null;
    }
    if (raw.kind === 'object_state_changed') {
        const objectId = asOptionalString(raw.objectId);
        if (!objectId) {
            return null;
        }
        return {
            kind: 'object_state_changed',
            objectId,
            fromState: asOptionalString(raw.fromState),
            toState: asOptionalString(raw.toState)
        };
    }
    if (raw.kind === 'trigger_event') {
        const eventId = asOptionalString(raw.eventId);
        if (!eventId) {
            return null;
        }
        return {
            kind: 'trigger_event',
            eventId,
            sourceId: asOptionalString(raw.sourceId)
        };
    }
    if (raw.kind === 'npc_event') {
        const eventId = asOptionalString(raw.eventId);
        if (!eventId) {
            return null;
        }
        return {
            kind: 'npc_event',
            actorId: asOptionalString(raw.actorId),
            eventId
        };
    }
    if (raw.kind === 'cutscene_finished') {
        return {
            kind: 'cutscene_finished',
            cutsceneRef: asOptionalString(raw.cutsceneRef)
        };
    }
    return null;
};

const normalizeTestWorldLogicRule = (
    raw: Record<string, unknown> | null,
    fallbackId: string
): TestWorldLogicRule | null => {
    if (!raw) {
        return null;
    }
    const id = asString(raw.id, fallbackId);
    const when = normalizeTestWorldLogicEventMatcher(asObject(raw.when));
    if (!when) {
        return null;
    }
    const actions = asArray(raw.actions)
        .map((entry) => normalizeTestEventAction(asObject(entry)))
        .filter((entry): entry is TestEventAction => entry !== null);
    if (actions.length <= 0) {
        return null;
    }
    const conditions = asArray(raw.conditions)
        .map((entry) => normalizeTestEventCondition(asObject(entry)))
        .filter((entry): entry is TestEventCondition => entry !== null);
    const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : undefined;
    return {
        id,
        enabled,
        when,
        conditions: conditions.length > 0 ? conditions : undefined,
        actions
    };
};

const normalizeTestWorldLogicRules = (
    raw: unknown,
    fallback: readonly TestWorldLogicRule[] | undefined
): TestWorldLogicRule[] | undefined => {
    if (raw === undefined) {
        return fallback ? fallback.map((entry) => ({
            ...entry,
            when: { ...entry.when },
            conditions: entry.conditions?.map((condition) => ({ ...condition })),
            actions: entry.actions.map((action) => (
                action.kind === 'actor_action'
                    ? { ...action, action: { ...action.action } }
                    : { ...action }
            ))
        })) : undefined;
    }
    const normalized = asArray(raw)
        .map((entry, index) => normalizeTestWorldLogicRule(asObject(entry), `world_logic_rule_${index + 1}`))
        .filter((entry): entry is TestWorldLogicRule => entry !== null);
    return normalized.length > 0 ? normalized : undefined;
};

const asLogicScriptCategory = (value: unknown): TestWorldLogicScriptCategory | null => {
    return typeof value === 'string' && TEST_WORLD_LOGIC_SCRIPT_CATEGORIES.has(value as TestWorldLogicScriptCategory)
        ? value as TestWorldLogicScriptCategory
        : null;
};

const asLogicBindingTargetType = (value: unknown): TestWorldLogicBindingTargetType | null => {
    return typeof value === 'string' && TEST_WORLD_LOGIC_BINDING_TARGET_TYPES.has(value as TestWorldLogicBindingTargetType)
        ? value as TestWorldLogicBindingTargetType
        : null;
};

const normalizeTestWorldLogicScriptCommand = (
    raw: Record<string, unknown> | null
): TestWorldLogicScriptCommandConfig | null => {
    if (!raw) {
        return null;
    }
    const id = asOptionalString(raw.id);
    const type = asOptionalString(raw.type);
    if (!id || !type) {
        return null;
    }

    return {
        id,
        type,
        params: asObject(raw.params) ?? {}
    };
};

const normalizeTestWorldLogicScriptEditor = (
    raw: Record<string, unknown> | null
): TestWorldLogicScriptEditorConfig | undefined => {
    if (!raw) {
        return undefined;
    }
    const rawLines = asArray(raw.rawLines)
        .filter((entry): entry is string => typeof entry === 'string');
    const hasLocked = typeof raw.locked === 'boolean';
    const locked = asBoolean(raw.locked, false);
    if (rawLines.length <= 0 && !hasLocked) {
        return undefined;
    }
    return {
        rawLines: rawLines.length > 0 ? rawLines : undefined,
        locked
    };
};

const normalizeTestWorldLogicScripts = (
    raw: unknown
): TestWorldLogicScriptConfig[] => {
    const usedScriptIds = new Set<string>();
    return asArray(raw)
        .map((entry, index) => {
            const item = asObject(entry);
            if (!item) {
                return null;
            }
            const category = asLogicScriptCategory(item.category);
            if (!category) {
                return null;
            }
            const commands = asArray(item.commands)
                .map((commandEntry) => normalizeTestWorldLogicScriptCommand(asObject(commandEntry)))
                .filter((command): command is TestWorldLogicScriptCommandConfig => command !== null);
            const scriptId = ensureUniqueId(
                asString(item.id, `logic_script_${index + 1}`),
                usedScriptIds,
                `logic_script_${index + 1}`
            );
            return {
                id: scriptId,
                name: asString(item.name, scriptId),
                category,
                commands,
                editor: normalizeTestWorldLogicScriptEditor(asObject(item.editor))
            } satisfies TestWorldLogicScriptConfig;
        })
        .filter((entry): entry is TestWorldLogicScriptConfig => entry !== null);
};

const normalizeTestWorldLogicScriptRefs = (
    raw: unknown
): TestWorldLogicScriptRefConfig[] => {
    const usedScriptRefIds = new Set<string>();
    return asArray(raw)
        .map((entry, index) => {
            const item = asObject(entry);
            if (!item) {
                return null;
            }
            const rawScriptRefId = asOptionalString(item.id);
            if (!rawScriptRefId) {
                return null;
            }
            const id = ensureUniqueId(rawScriptRefId, usedScriptRefIds, `logic_script_ref_${index + 1}`);
            return {
                id,
                path: asOptionalString(item.path),
                displayName: asOptionalString(item.displayName)
            } satisfies TestWorldLogicScriptRefConfig;
        })
        .filter((entry): entry is TestWorldLogicScriptRefConfig => entry !== null);
};

const collectWorldObjectIds = (
    config: TestWorldConfig,
    includePlayer: boolean
): Set<string> => {
    const ids = new Set<string>([
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
    ]);
    if (includePlayer) {
        ids.add('player');
    }
    return ids;
};

const normalizeTestWorldLogicBindings = (
    raw: unknown,
    config: TestWorldConfig
): TestWorldLogicBindingConfig[] => {
    const worldObjectIds = collectWorldObjectIds(config, false);
    const npcIds = new Set(config.npcs.map((entry) => entry.id));
    const triggerTargetIds = new Set<string>([
        ...config.triggerPlatforms.map((entry) => entry.id),
        ...config.triggerVolumes.map((entry) => entry.id)
    ]);
    const usedBindingIds = new Set<string>();

    return asArray(raw)
        .map((entry, index) => {
            const item = asObject(entry);
            if (!item) {
                return null;
            }
            const targetType = asLogicBindingTargetType(item.targetType);
            const slot = asOptionalString(item.slot);
            const scriptId = asOptionalString(item.scriptId);
            if (!targetType || !slot || !scriptId) {
                return null;
            }

            const targetId = asOptionalString(item.targetId);
            if (targetType === 'object' && (!targetId || !worldObjectIds.has(targetId))) {
                return null;
            }
            if (targetType === 'npc' && (!targetId || !npcIds.has(targetId))) {
                return null;
            }
            if (targetType === 'trigger' && (!targetId || !triggerTargetIds.has(targetId))) {
                return null;
            }
            if (targetType === 'cutscene' && (!targetId || !isTestCutsceneRef(targetId))) {
                return null;
            }

            const bindingId = ensureUniqueId(
                asString(item.id, `logic_binding_${index + 1}`),
                usedBindingIds,
                `logic_binding_${index + 1}`
            );
            return {
                id: bindingId,
                targetType,
                targetId: targetType === 'world' ? targetId : targetId ?? undefined,
                slot,
                scriptId,
                enabled: asBoolean(item.enabled, true)
            } satisfies TestWorldLogicBindingConfig;
        })
        .filter((entry): entry is TestWorldLogicBindingConfig => entry !== null);
};

const normalizeTestWorldLogicConfig = (
    rawValue: unknown,
    fallback: TestWorldLogicConfig | undefined,
    preserveMissingFields: boolean,
    config: TestWorldConfig
): TestWorldLogicConfig => {
    const source = rawValue === undefined
        ? (preserveMissingFields ? fallback : undefined)
        : rawValue;
    const raw = asObject(source);
    if (!raw) {
        return {
            scripts: [],
            scriptRefs: [],
            bindings: []
        };
    }

    const scripts = normalizeTestWorldLogicScripts(raw.scripts);
    const scriptRefs = normalizeTestWorldLogicScriptRefs(raw.scriptRefs);
    const bindings = normalizeTestWorldLogicBindings(raw.bindings, config);
    return {
        scripts,
        scriptRefs,
        bindings
    };
};

export const collectTestWorldLogicDiagnostics = (
    config: TestWorldConfig,
    options?: {
        availableExternalScriptIds?: ReadonlySet<string> | string[];
    }
): TestWorldLogicDiagnostic[] => {
    const diagnostics: TestWorldLogicDiagnostic[] = [];
    let diagnosticIndex = 1;
    const nextDiagnosticId = (code: TestWorldLogicDiagnosticCode): string => {
        const id = `${code}_${diagnosticIndex}`;
        diagnosticIndex += 1;
        return id;
    };
    const logic = config.logic;
    const scripts = Array.isArray(logic?.scripts) ? logic.scripts : [];
    const scriptRefs = Array.isArray(logic?.scriptRefs) ? logic.scriptRefs : [];
    const bindings = Array.isArray(logic?.bindings) ? logic.bindings : [];
    const knownScriptIds = new Set<string>();
    const seenScriptIds = new Set<string>();
    const seenScriptRefIds = new Set<string>();
    const externalScriptIds = new Set<string>();

    scripts.forEach((script, index) => {
        const scriptId = typeof script.id === 'string' ? script.id.trim() : '';
        if (scriptId.length <= 0) {
            return;
        }
        if (seenScriptIds.has(scriptId)) {
            diagnostics.push({
                id: nextDiagnosticId('duplicate_logic_script_id'),
                severity: 'warning',
                code: 'duplicate_logic_script_id',
                message: `Duplicate logic script id "${scriptId}".`,
                scriptId,
                path: `logic.scripts[${index}].id`
            });
        } else {
            seenScriptIds.add(scriptId);
        }
        knownScriptIds.add(scriptId);
    });

    scriptRefs.forEach((scriptRef, index) => {
        const scriptId = typeof scriptRef.id === 'string' ? scriptRef.id.trim() : '';
        if (scriptId.length <= 0) {
            return;
        }
        if (seenScriptRefIds.has(scriptId)) {
            diagnostics.push({
                id: nextDiagnosticId('duplicate_logic_script_ref'),
                severity: 'warning',
                code: 'duplicate_logic_script_ref',
                message: `Duplicate logic script ref id "${scriptId}".`,
                scriptId,
                path: `logic.scriptRefs[${index}].id`
            });
        } else {
            seenScriptRefIds.add(scriptId);
        }
        knownScriptIds.add(scriptId);
    });

    const availableExternalScriptIds = options?.availableExternalScriptIds;
    if (availableExternalScriptIds) {
        availableExternalScriptIds.forEach((entry) => {
            const scriptId = entry.trim();
            if (scriptId.length > 0) {
                externalScriptIds.add(scriptId);
                knownScriptIds.add(scriptId);
            }
        });
    }

    if (availableExternalScriptIds) {
        scriptRefs.forEach((scriptRef, index) => {
            const scriptId = typeof scriptRef.id === 'string' ? scriptRef.id.trim() : '';
            if (scriptId.length <= 0) {
                return;
            }
            const hasEmbeddedScript = seenScriptIds.has(scriptId);
            if (!hasEmbeddedScript && !externalScriptIds.has(scriptId)) {
                diagnostics.push({
                    id: nextDiagnosticId('missing_logic_script_asset'),
                    severity: 'warning',
                    code: 'missing_logic_script_asset',
                    message: `Script ref "${scriptId}" is missing from external logic script assets.`,
                    scriptId,
                    path: `logic.scriptRefs[${index}].id`
                });
            }
        });
    }

    const worldObjectIds = collectWorldObjectIds(config, false);
    const npcIds = new Set(config.npcs.map((entry) => entry.id));
    const triggerTargetIds = new Set<string>([
        ...config.triggerPlatforms.map((entry) => entry.id),
        ...config.triggerVolumes.map((entry) => entry.id)
    ]);

    bindings.forEach((binding, index) => {
        const bindingId = typeof binding.id === 'string' ? binding.id.trim() : '';
        const bindingLabel = bindingId || `logic_binding_${index + 1}`;
        const scriptId = typeof binding.scriptId === 'string' ? binding.scriptId.trim() : '';
        const slot = typeof binding.slot === 'string' ? binding.slot.trim() : '';
        if (scriptId.length > 0 && !knownScriptIds.has(scriptId)) {
            diagnostics.push({
                id: nextDiagnosticId('missing_logic_script_ref'),
                severity: 'warning',
                code: 'missing_logic_script_ref',
                message: `Binding "${bindingLabel}" references missing script "${scriptId}".`,
                scriptId,
                bindingId: bindingId || undefined,
                path: `logic.bindings[${index}].scriptId`
            });
        }

        const targetType = binding.targetType;
        const targetId = typeof binding.targetId === 'string' ? binding.targetId.trim() : '';
        let targetValid = true;
        if (targetType === 'object') {
            targetValid = targetId.length > 0 && worldObjectIds.has(targetId);
        } else if (targetType === 'npc') {
            targetValid = targetId.length > 0 && npcIds.has(targetId);
        } else if (targetType === 'trigger') {
            targetValid = targetId.length > 0 && triggerTargetIds.has(targetId);
        } else if (targetType === 'cutscene') {
            targetValid = targetId.length > 0 && isTestCutsceneRef(targetId);
        } else if (targetType === 'world') {
            targetValid = true;
        } else {
            targetValid = false;
        }

        if (!targetValid) {
            diagnostics.push({
                id: nextDiagnosticId('invalid_logic_binding_target'),
                severity: 'error',
                code: 'invalid_logic_binding_target',
                message: `Binding "${bindingLabel}" has an invalid ${targetType} target.`,
                bindingId: bindingId || undefined,
                path: `logic.bindings[${index}].targetId`
            });
        }

        if (!isRuntimeSupportedLogicBindingSlot(targetType, slot)) {
            diagnostics.push({
                id: nextDiagnosticId('unsupported_logic_binding_runtime_slot'),
                severity: 'warning',
                code: 'unsupported_logic_binding_runtime_slot',
                message: getUnsupportedRuntimeBindingSlotMessage(bindingLabel, targetType, slot),
                bindingId: bindingId || undefined,
                targetType,
                targetId: targetId || undefined,
                slot,
                path: `logic.bindings[${index}].slot`
            });
        }
    });

    return diagnostics;
};

const normalizePlayerSpawn = (raw: Record<string, unknown> | null): TestWorldPlayerSpawnConfig => {
    const fallback = TEST_WORLD_CONFIG.playerSpawn;
    return {
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false)
    };
};

const normalizeMeta = (raw: Record<string, unknown> | null, fallback: TestWorldMetaConfig): TestWorldMetaConfig => {
    return {
        id: asString(raw?.id, fallback.id),
        displayName: asString(raw?.displayName, fallback.displayName)
    };
};

const normalizeWorldBounds = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBoundsConfig
): TestWorldBoundsConfig => {
    return {
        width: Math.max(MIN_WORLD_SIZE, Math.round(asNumber(raw?.width, fallback.width))),
        height: Math.max(MIN_WORLD_SIZE, Math.round(asNumber(raw?.height, fallback.height)))
    };
};

const normalizeBackgroundImage = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundImageConfig | undefined
): TestWorldBackgroundImageConfig | undefined => {
    const textureKey = asString(raw?.textureKey, fallback?.textureKey ?? '');
    const textureAsset = asOptionalString(raw?.textureAsset) ?? fallback?.textureAsset;
    const tintColor = asColor(raw?.tintColor, fallback?.tintColor);
    const fillColor = asColor(raw?.fillColor, fallback?.fillColor);
    const alpha = clampAlpha(raw?.alpha, fallback?.alpha ?? 1);
    const scale = clampScale(raw?.scale, fallback?.scale ?? 1);
    const hasRenderableContent = textureKey.length > 0 || textureAsset !== undefined || fillColor !== undefined;

    if (!hasRenderableContent) {
        return undefined;
    }

    return {
        textureKey,
        textureAsset,
        tintColor,
        alpha,
        scale,
        width: Math.max(MIN_RECT_SIZE, Math.round(asNumber(raw?.width, fallback?.width ?? 256))),
        height: Math.max(MIN_RECT_SIZE, Math.round(asNumber(raw?.height, fallback?.height ?? 256))),
        repeat: asBoolean(raw?.repeat, fallback?.repeat ?? false),
        fillColor,
        x: asNumber(raw?.x, fallback?.x ?? 0),
        y: asNumber(raw?.y, fallback?.y ?? 0)
    };
};

const normalizeParallaxLayer = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldParallaxLayerConfig | undefined,
    index: number
): TestWorldParallaxLayerConfig | null => {
    const image = normalizeBackgroundImage(raw, fallback);
    if (!image) {
        return null;
    }

    return {
        id: asString(raw?.id, fallback?.id ?? `layer_${index + 1}`),
        height: clampRectSize(asNumber(raw?.height, fallback?.height ?? 256)),
        scrollFactorX: clampScrollFactor(raw?.scrollFactorX, fallback?.scrollFactorX ?? 0.4),
        scrollFactorY: clampScrollFactor(raw?.scrollFactorY, fallback?.scrollFactorY ?? fallback?.scrollFactorX ?? 0.4),
        ...image
    };
};

const asBackgroundObjectLayer = (
    value: unknown,
    fallback: TestWorldBackgroundObjectLayerId
): TestWorldBackgroundObjectLayerId => {
    return value === 'static' || value === 'parallax1' || value === 'parallax2'
        ? value
        : fallback;
};

const cloneBackgroundObjectBounds = (
    bounds: TestWorldBackgroundObjectBoundsConfig
): TestWorldBackgroundObjectBoundsConfig => ({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: bounds.rotation
});

const cloneBackgroundObjectVisual = (
    visual: TestWorldBackgroundObjectVisualConfig
): TestWorldBackgroundObjectVisualConfig => ({
    shaderKey: visual.shaderKey,
    textureKey: visual.textureKey,
    textureAsset: visual.textureAsset,
    fillColor: visual.fillColor,
    strokeColor: visual.strokeColor,
    alpha: visual.alpha,
    tileHorizontalRepeat: visual.tileHorizontalRepeat,
    tileVerticalRepeat: visual.tileVerticalRepeat
});

const cloneBackgroundObjectEditor = (
    editor: TestWorldBackgroundObjectEditorConfig | undefined
): TestWorldBackgroundObjectEditorConfig | undefined => {
    if (!editor) {
        return undefined;
    }
    return {
        locked: editor.locked,
        hidden: editor.hidden
    };
};

const cloneBackgroundObject = (
    entry: TestWorldBackgroundObjectConfig
): TestWorldBackgroundObjectConfig => ({
    id: entry.id,
    name: entry.name,
    layer: entry.layer,
    bounds: cloneBackgroundObjectBounds(entry.bounds),
    visual: cloneBackgroundObjectVisual(entry.visual),
    editor: cloneBackgroundObjectEditor(entry.editor)
});

const cloneBackgroundLayerScrollFactor = (
    entry: TestWorldBackgroundLayerScrollFactorConfig
): TestWorldBackgroundLayerScrollFactorConfig => ({
    scrollFactorX: entry.scrollFactorX,
    scrollFactorY: entry.scrollFactorY
});

const cloneBackgroundLayerSettings = (
    settings: TestWorldBackgroundLayerSettingsConfig | undefined
): TestWorldBackgroundLayerSettingsConfig | undefined => {
    if (!settings) {
        return undefined;
    }
    return {
        static: settings.static ? cloneBackgroundLayerScrollFactor(settings.static) : undefined,
        parallax1: settings.parallax1 ? cloneBackgroundLayerScrollFactor(settings.parallax1) : undefined,
        parallax2: settings.parallax2 ? cloneBackgroundLayerScrollFactor(settings.parallax2) : undefined
    };
};

const normalizeBackgroundObjectVisual = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundObjectVisualConfig | undefined
): TestWorldBackgroundObjectVisualConfig | null => {
    const textureKey = asOptionalString(raw?.textureKey) ?? fallback?.textureKey;
    const textureAsset = asOptionalString(raw?.textureAsset) ?? fallback?.textureAsset;
    const fillColor = asColor(raw?.fillColor, fallback?.fillColor);
    const hasRenderableSource = textureKey !== undefined || textureAsset !== undefined || fillColor !== undefined;
    if (!hasRenderableSource) {
        return null;
    }

    return {
        shaderKey: asOptionalString(raw?.shaderKey) ?? fallback?.shaderKey,
        textureKey,
        textureAsset,
        fillColor,
        strokeColor: asColor(raw?.strokeColor, fallback?.strokeColor),
        alpha: clampAlpha(raw?.alpha, fallback?.alpha ?? 1),
        tileHorizontalRepeat: asBoolean(raw?.tileHorizontalRepeat, fallback?.tileHorizontalRepeat ?? false),
        tileVerticalRepeat: asBoolean(raw?.tileVerticalRepeat, fallback?.tileVerticalRepeat ?? false)
    };
};

const normalizeBackgroundObjectEditor = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundObjectEditorConfig | undefined
): TestWorldBackgroundObjectEditorConfig => {
    return {
        locked: asBoolean(raw?.locked, fallback?.locked ?? false),
        hidden: asBoolean(raw?.hidden, fallback?.hidden ?? false)
    };
};

const normalizeBackgroundObject = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundObjectConfig | undefined,
    usedIds: Set<string>,
    index: number
): TestWorldBackgroundObjectConfig | null => {
    const fallbackId = fallback?.id ?? `background_object_${index + 1}`;
    const boundsRaw = asObject(raw?.bounds);
    const fallbackBounds = fallback?.bounds;
    const visualRaw = asObject(raw?.visual);
    const normalizedVisual = normalizeBackgroundObjectVisual(visualRaw, fallback?.visual);
    if (!normalizedVisual) {
        return null;
    }

    return {
        id: ensureUniqueId(asString(raw?.id, fallbackId), usedIds, fallbackId),
        name: asOptionalString(raw?.name) ?? fallback?.name,
        layer: asBackgroundObjectLayer(raw?.layer, fallback?.layer ?? 'static'),
        bounds: {
            x: asNumber(boundsRaw?.x, fallbackBounds?.x ?? 0),
            y: asNumber(boundsRaw?.y, fallbackBounds?.y ?? 0),
            width: clampRectSize(asNumber(boundsRaw?.width, fallbackBounds?.width ?? MIN_RECT_SIZE)),
            height: clampRectSize(asNumber(boundsRaw?.height, fallbackBounds?.height ?? MIN_RECT_SIZE)),
            rotation: asNumber(boundsRaw?.rotation, fallbackBounds?.rotation ?? 0)
        },
        visual: normalizedVisual,
        editor: normalizeBackgroundObjectEditor(asObject(raw?.editor), fallback?.editor)
    };
};

const normalizeBackgroundObjects = (
    rawValue: unknown,
    fallback: readonly TestWorldBackgroundObjectConfig[] | undefined,
    preserveMissingFields: boolean
): TestWorldBackgroundObjectConfig[] | undefined => {
    if (rawValue === undefined) {
        return preserveMissingFields
            ? fallback?.map((entry) => cloneBackgroundObject(entry))
            : [];
    }
    if (rawValue === null) {
        return [];
    }
    if (!Array.isArray(rawValue)) {
        return preserveMissingFields
            ? (fallback?.map((entry) => cloneBackgroundObject(entry)) ?? [])
            : [];
    }

    const fallbackItems = fallback ?? [];
    const usedIds = new Set<string>();
    const normalized = rawValue
        .map((entry, index) => normalizeBackgroundObject(asObject(entry), fallbackItems[index], usedIds, index))
        .filter((entry): entry is TestWorldBackgroundObjectConfig => entry !== null);
    return normalized;
};

const normalizeBackgroundLayerScrollFactor = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBackgroundLayerScrollFactorConfig | undefined,
    layer: TestWorldBackgroundObjectLayerId
): TestWorldBackgroundLayerScrollFactorConfig => {
    const defaults = DEFAULT_BACKGROUND_OBJECT_LAYER_SCROLL[layer];
    return {
        scrollFactorX: clampScrollFactor(raw?.scrollFactorX, fallback?.scrollFactorX ?? defaults.scrollFactorX),
        scrollFactorY: clampScrollFactor(raw?.scrollFactorY, fallback?.scrollFactorY ?? defaults.scrollFactorY)
    };
};

const normalizeBackgroundLayerSettings = (
    rawValue: unknown,
    fallback: TestWorldBackgroundLayerSettingsConfig | undefined,
    preserveMissingFields: boolean
): TestWorldBackgroundLayerSettingsConfig | undefined => {
    if (rawValue === undefined) {
        return preserveMissingFields ? cloneBackgroundLayerSettings(fallback) : undefined;
    }
    if (rawValue === null) {
        return undefined;
    }

    const raw = asObject(rawValue);
    if (!raw) {
        return preserveMissingFields ? cloneBackgroundLayerSettings(fallback) : undefined;
    }

    const hasRawStatic = Object.prototype.hasOwnProperty.call(raw, 'static');
    const hasRawParallax1 = Object.prototype.hasOwnProperty.call(raw, 'parallax1');
    const hasRawParallax2 = Object.prototype.hasOwnProperty.call(raw, 'parallax2');
    const fallbackStatic = preserveMissingFields ? fallback?.static : undefined;
    const fallbackParallax1 = preserveMissingFields ? fallback?.parallax1 : undefined;
    const fallbackParallax2 = preserveMissingFields ? fallback?.parallax2 : undefined;
    const hasFallback = Boolean(fallbackStatic || fallbackParallax1 || fallbackParallax2);
    if (!hasRawStatic && !hasRawParallax1 && !hasRawParallax2 && !hasFallback) {
        return undefined;
    }

    return {
        static: hasRawStatic || fallbackStatic
            ? normalizeBackgroundLayerScrollFactor(asObject(raw.static), fallbackStatic, 'static')
            : undefined,
        parallax1: hasRawParallax1 || fallbackParallax1
            ? normalizeBackgroundLayerScrollFactor(asObject(raw.parallax1), fallbackParallax1, 'parallax1')
            : undefined,
        parallax2: hasRawParallax2 || fallbackParallax2
            ? normalizeBackgroundLayerScrollFactor(asObject(raw.parallax2), fallbackParallax2, 'parallax2')
            : undefined
    };
};

const normalizeBackground = (
    rawValue: unknown,
    fallback: TestWorldBackgroundConfig | null,
    preserveMissingObjectFields: boolean
): TestWorldBackgroundConfig | null => {
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    const raw = asObject(rawValue);
    if (!raw) {
        return null;
    }

    const color = asColor(raw.color, fallback?.color ?? DEFAULT_BACKGROUND_COLOR);
    const staticImage = normalizeBackgroundImage(asObject(raw.staticImage), fallback?.staticImage);

    const rawLayers = asArray(raw.layers).slice(0, MAX_BACKGROUND_LAYERS);
    const fallbackLayers = fallback?.layers ?? [];
    const normalizedLayers = rawLayers
        .map((entry, index) => normalizeParallaxLayer(asObject(entry), fallbackLayers[index], index))
        .filter((entry): entry is TestWorldParallaxLayerConfig => entry !== null);

    return {
        color,
        staticImage,
        layers: normalizedLayers,
        backgroundObjects: normalizeBackgroundObjects(
            raw.backgroundObjects,
            fallback?.backgroundObjects,
            preserveMissingObjectFields
        ),
        backgroundLayerSettings: normalizeBackgroundLayerSettings(
            raw.backgroundLayerSettings,
            fallback?.backgroundLayerSettings,
            preserveMissingObjectFields
        )
    };
};

const normalizeBehaviorScripts = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldBehaviorScriptsConfig | undefined,
    preserveMissingFields: boolean
): TestWorldBehaviorScriptsConfig | undefined => {
    if (!raw && (!fallback || !preserveMissingFields)) {
        return undefined;
    }
    const source = raw ?? {};
    const fallbackScripts = preserveMissingFields ? fallback : undefined;
    const move = asOptionalString(source.move) ?? fallbackScripts?.move;
    const rotate = asOptionalString(source.rotate) ?? fallbackScripts?.rotate;
    const defaultAction = asOptionalString(source.defaultAction) ?? fallbackScripts?.defaultAction;
    const rawActions = Array.isArray(source.actions)
        ? source.actions
        : fallbackScripts?.actions;
    const actions = rawActions
        ?.filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    if (!move && !rotate && !defaultAction && (!actions || actions.length <= 0)) {
        return undefined;
    }

    return {
        move: move ?? undefined,
        rotate: rotate ?? undefined,
        defaultAction: defaultAction ?? undefined,
        actions: actions && actions.length > 0 ? actions : undefined
    };
};

const normalizeSurface = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldSurfaceConfig,
    usedIds: Set<string>,
    index: number,
    preserveMissingBehaviorScriptFields: boolean
): TestWorldSurfaceConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `surface_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor) ?? fallback.fillColor,
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor) ?? fallback.strokeColor,
        alpha: clampAlpha(raw?.alpha, fallback.alpha ?? 1),
        collisionMode: raw?.collisionMode === 'visual_only' ? 'visual_only' : 'solid',
        behaviorScripts: normalizeBehaviorScripts(
            asObject(raw?.behaviorScripts),
            fallback.behaviorScripts,
            preserveMissingBehaviorScriptFields
        ),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeHazard = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldHazardConfig,
    usedIds: Set<string>,
    index: number
): TestWorldHazardConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `hazard_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeCheckpoint = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldCheckpointConfig,
    usedIds: Set<string>,
    index: number
): TestWorldCheckpointConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `checkpoint_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        respawnX: asNumber(raw?.respawnX, fallback.respawnX),
        respawnY: asNumber(raw?.respawnY, fallback.respawnY),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeFinish = (
    rawValue: unknown,
    fallback: TestWorldFinishConfig | null,
    usedIds: Set<string>
): TestWorldFinishConfig | null => {
    if (rawValue === null) {
        return null;
    }

    const raw = asObject(rawValue);
    if (raw === null && fallback === null) {
        return null;
    }

    const safeFallback = fallback ?? TEST_WORLD_CONFIG.finish;
    return {
        id: ensureUniqueId(asString(raw?.id, safeFallback.id), usedIds, 'finish'),
        x: asNumber(raw?.x, safeFallback.x),
        y: asNumber(raw?.y, safeFallback.y),
        width: clampRectSize(asNumber(raw?.width, safeFallback.width)),
        height: clampRectSize(asNumber(raw?.height, safeFallback.height)),
        fillColor: asColor(raw?.fillColor, safeFallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, safeFallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, safeFallback)
    };
};

const normalizeMovingPlatform = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldMovingPlatformConfig,
    usedIds: Set<string>,
    index: number
): TestWorldMovingPlatformConfig => {
    const axis = raw?.axis === 'vertical' ? 'vertical' : 'horizontal';
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `moving_platform_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        axis,
        travelDistance: Math.max(0, asNumber(raw?.travelDistance, fallback.travelDistance)),
        speed: Math.max(0, asNumber(raw?.speed, fallback.speed)),
        initialMotionState: asMotionState(raw?.initialMotionState, fallback.initialMotionState ?? 'running_loop'),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeTriggerPlatform = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerPlatformConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriggerPlatformConfig => {
    const hasDeactivate = typeof raw?.deactivateTriggerX === 'number'
        && typeof raw?.deactivateTriggerY === 'number'
        && typeof raw?.deactivateTriggerWidth === 'number'
        && typeof raw?.deactivateTriggerHeight === 'number';

    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `trigger_platform_${index + 1}`),
        triggerX: asNumber(raw?.triggerX, fallback.triggerX),
        triggerY: asNumber(raw?.triggerY, fallback.triggerY),
        triggerWidth: clampRectSize(asNumber(raw?.triggerWidth, fallback.triggerWidth)),
        triggerHeight: clampRectSize(asNumber(raw?.triggerHeight, fallback.triggerHeight)),
        deactivateTriggerX: hasDeactivate ? asNumber(raw?.deactivateTriggerX, fallback.deactivateTriggerX ?? fallback.triggerX) : undefined,
        deactivateTriggerY: hasDeactivate ? asNumber(raw?.deactivateTriggerY, fallback.deactivateTriggerY ?? fallback.triggerY) : undefined,
        deactivateTriggerWidth: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerWidth, fallback.deactivateTriggerWidth ?? fallback.triggerWidth))
            : undefined,
        deactivateTriggerHeight: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerHeight, fallback.deactivateTriggerHeight ?? fallback.triggerHeight))
            : undefined,
        platformX: asNumber(raw?.platformX, fallback.platformX),
        platformY: asNumber(raw?.platformY, fallback.platformY),
        platformWidth: clampRectSize(asNumber(raw?.platformWidth, fallback.platformWidth)),
        platformHeight: clampRectSize(asNumber(raw?.platformHeight, fallback.platformHeight)),
        activator: raw?.activator === 'drag_box' ? 'drag_box' : 'player',
        triggerAction: raw?.triggerAction === 'deactivate' ? 'deactivate' : 'activate',
        deactivateTriggerAction: raw?.deactivateTriggerAction === 'activate' ? 'activate' : 'deactivate',
        initiallyActive: asBoolean(raw?.initiallyActive, false),
        triggerFillColor: asColor(raw?.triggerFillColor, fallback.triggerFillColor ?? DEFAULT_TRIGGER_PLATFORM_FILL_COLOR),
        triggerStrokeColor: asColor(raw?.triggerStrokeColor, fallback.triggerStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_STROKE_COLOR),
        deactivateTriggerFillColor: asColor(
            raw?.deactivateTriggerFillColor,
            fallback.deactivateTriggerFillColor ?? DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_FILL_COLOR
        ),
        deactivateTriggerStrokeColor: asColor(
            raw?.deactivateTriggerStrokeColor,
            fallback.deactivateTriggerStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_DEACTIVATE_STROKE_COLOR
        ),
        platformFillColor: asColor(raw?.platformFillColor, fallback.platformFillColor ?? DEFAULT_TRIGGER_PLATFORM_BODY_FILL_COLOR),
        platformStrokeColor: asColor(raw?.platformStrokeColor, fallback.platformStrokeColor ?? DEFAULT_TRIGGER_PLATFORM_BODY_STROKE_COLOR),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeTriggerVolume = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriggerVolumeConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriggerVolumeConfig => {
    const hasDeactivate = typeof raw?.deactivateTriggerX === 'number'
        && typeof raw?.deactivateTriggerY === 'number'
        && typeof raw?.deactivateTriggerWidth === 'number'
        && typeof raw?.deactivateTriggerHeight === 'number';
    const sourceIds = asArray(raw?.sourceIds)
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    const id = ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `trigger_volume_${index + 1}`);
    return {
        id,
        triggerX: asNumber(raw?.triggerX, fallback.triggerX),
        triggerY: asNumber(raw?.triggerY, fallback.triggerY),
        triggerWidth: clampRectSize(asNumber(raw?.triggerWidth, fallback.triggerWidth)),
        triggerHeight: clampRectSize(asNumber(raw?.triggerHeight, fallback.triggerHeight)),
        deactivateTriggerX: hasDeactivate ? asNumber(raw?.deactivateTriggerX, fallback.deactivateTriggerX ?? fallback.triggerX) : undefined,
        deactivateTriggerY: hasDeactivate ? asNumber(raw?.deactivateTriggerY, fallback.deactivateTriggerY ?? fallback.triggerY) : undefined,
        deactivateTriggerWidth: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerWidth, fallback.deactivateTriggerWidth ?? fallback.triggerWidth))
            : undefined,
        deactivateTriggerHeight: hasDeactivate
            ? clampRectSize(asNumber(raw?.deactivateTriggerHeight, fallback.deactivateTriggerHeight ?? fallback.triggerHeight))
            : undefined,
        activator: raw?.activator === 'drag_box' ? 'drag_box' : 'player',
        sourceIds: sourceIds.length > 0 ? sourceIds : fallback.sourceIds,
        enterCommand: normalizeTriggerCommand(asObject(raw?.enterCommand), fallback.enterCommand ?? null),
        exitCommand: normalizeTriggerCommand(asObject(raw?.exitCommand), fallback.exitCommand ?? null),
        onEnter: normalizeTestEventBlocks(raw?.onEnter, `trigger:${id}:onEnter`),
        onExit: normalizeTestEventBlocks(raw?.onExit, `trigger:${id}:onExit`),
        onStay: normalizeTestEventBlocks(raw?.onStay, `trigger:${id}:onStay`),
        triggerFillColor: asColor(raw?.triggerFillColor, fallback.triggerFillColor ?? DEFAULT_TRIGGER_VOLUME_FILL_COLOR),
        triggerStrokeColor: asColor(raw?.triggerStrokeColor, fallback.triggerStrokeColor ?? DEFAULT_TRIGGER_VOLUME_STROKE_COLOR),
        deactivateTriggerFillColor: asColor(
            raw?.deactivateTriggerFillColor,
            fallback.deactivateTriggerFillColor ?? DEFAULT_TRIGGER_VOLUME_DEACTIVATE_FILL_COLOR
        ),
        deactivateTriggerStrokeColor: asColor(
            raw?.deactivateTriggerStrokeColor,
            fallback.deactivateTriggerStrokeColor ?? DEFAULT_TRIGGER_VOLUME_DEACTIVATE_STROKE_COLOR
        ),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const createTriggerVolumeFallback = (index: number): TestWorldTriggerVolumeConfig => ({
    id: `trigger_volume_${index + 1}`,
    triggerX: 0,
    triggerY: 0,
    triggerWidth: 112,
    triggerHeight: 80,
    deactivateTriggerX: undefined,
    deactivateTriggerY: undefined,
    deactivateTriggerWidth: undefined,
    deactivateTriggerHeight: undefined,
    activator: 'player',
    sourceIds: undefined,
    enterCommand: null,
    exitCommand: null,
    onEnter: undefined,
    onExit: undefined,
    onStay: undefined,
    triggerFillColor: DEFAULT_TRIGGER_VOLUME_FILL_COLOR,
    triggerStrokeColor: DEFAULT_TRIGGER_VOLUME_STROKE_COLOR,
    deactivateTriggerFillColor: DEFAULT_TRIGGER_VOLUME_DEACTIVATE_FILL_COLOR,
    deactivateTriggerStrokeColor: DEFAULT_TRIGGER_VOLUME_DEACTIVATE_STROKE_COLOR
});

const normalizeTriggerVolumeArray = (
    rawItems: unknown,
    defaults: readonly TestWorldTriggerVolumeConfig[],
    usedIds: Set<string>
): TestWorldTriggerVolumeConfig[] => {
    if (rawItems === undefined) {
        return defaults.map((entry, index) => normalizeTriggerVolume({
            id: entry.id,
            triggerX: entry.triggerX,
            triggerY: entry.triggerY,
            triggerWidth: entry.triggerWidth,
            triggerHeight: entry.triggerHeight,
            deactivateTriggerX: entry.deactivateTriggerX,
            deactivateTriggerY: entry.deactivateTriggerY,
            deactivateTriggerWidth: entry.deactivateTriggerWidth,
            deactivateTriggerHeight: entry.deactivateTriggerHeight,
            activator: entry.activator,
            sourceIds: entry.sourceIds,
            enterCommand: entry.enterCommand,
            exitCommand: entry.exitCommand,
            onEnter: entry.onEnter,
            onExit: entry.onExit,
            onStay: entry.onStay,
            triggerFillColor: entry.triggerFillColor,
            triggerStrokeColor: entry.triggerStrokeColor,
            deactivateTriggerFillColor: entry.deactivateTriggerFillColor,
            deactivateTriggerStrokeColor: entry.deactivateTriggerStrokeColor,
            editorLocked: entry.editorLocked,
            visualLayer: entry.visualLayer,
            renderOrder: entry.renderOrder
        }, entry, usedIds, index));
    }

    return asArray(rawItems).map((entry, index) => {
        const raw = asObject(entry);
        const rawId = typeof raw?.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null;
        const fallback = (
            rawId
                ? defaults.find((item) => item.id === rawId)
                : undefined
        ) ?? defaults[index] ?? createTriggerVolumeFallback(index);
        return normalizeTriggerVolume(raw, fallback, usedIds, index);
    });
};

const normalizeDragBox = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldDragBoxConfig,
    usedIds: Set<string>,
    index: number
): TestWorldDragBoxConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `drag_box_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        targetTriggerPlatformId: typeof raw?.targetTriggerPlatformId === 'string' ? raw.targetTriggerPlatformId : fallback.targetTriggerPlatformId,
        gravityY: Math.max(0, asNumber(raw?.gravityY, fallback.gravityY ?? 2200)),
        mass: Math.max(1, asNumber(raw?.mass, fallback.mass ?? 10)),
        pullAcceleration: Math.max(0, asNumber(raw?.pullAcceleration, fallback.pullAcceleration ?? 1400)),
        pullMaxSpeed: Math.max(0, asNumber(raw?.pullMaxSpeed, fallback.pullMaxSpeed ?? 150)),
        dragX: Math.max(0, asNumber(raw?.dragX, fallback.dragX ?? 900)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeWindZone = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldWindZoneConfig,
    usedIds: Set<string>,
    index: number
): TestWorldWindZoneConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `wind_zone_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        directionX: raw?.directionX === -1 ? -1 : 1,
        force: Math.max(0, asNumber(raw?.force, fallback.force)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeBreakWall = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTriangleFlightBreakWallConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTriangleFlightBreakWallConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `triangle_break_wall_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        width: clampRectSize(asNumber(raw?.width, fallback.width)),
        height: clampRectSize(asNumber(raw?.height, fallback.height)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizePickup = (
    raw: Record<string, unknown> | null,
    fallback: TestWorldTrianglePickupConfig,
    usedIds: Set<string>,
    index: number
): TestWorldTrianglePickupConfig => {
    return {
        id: ensureUniqueId(asString(raw?.id, fallback.id), usedIds, `triangle_pickup_${index + 1}`),
        x: asNumber(raw?.x, fallback.x),
        y: asNumber(raw?.y, fallback.y),
        radius: clampPickupRadius(asNumber(raw?.radius, fallback.radius)),
        fillColor: asColor(raw?.fillColor, fallback.fillColor),
        strokeColor: asColor(raw?.strokeColor, fallback.strokeColor),
        editorLocked: asBoolean(raw?.editorLocked, false),
        ...normalizeVisualOrder(raw, fallback)
    };
};

const normalizeNpcInstance = (
    raw: Record<string, unknown> | null,
    usedIds: Set<string>,
    index: number
): TestNpcInstanceConfig | null => {
    const profileId = asString(raw?.profileId, '');
    if (profileId.length === 0) {
        return null;
    }

    const behaviorSource = asObject(raw?.behavior);
    const behavior = behaviorSource
        ? {
            passiveMode: behaviorSource.passiveMode === 'idle_patrol' || behaviorSource.passiveMode === 'idle'
                ? behaviorSource.passiveMode
                : undefined,
            patrolDistance: typeof behaviorSource.patrolDistance === 'number' && Number.isFinite(behaviorSource.patrolDistance)
                ? Math.max(0, behaviorSource.patrolDistance)
                : undefined,
            moveSpeed: typeof behaviorSource.moveSpeed === 'number' && Number.isFinite(behaviorSource.moveSpeed)
                ? Math.max(0, behaviorSource.moveSpeed)
                : undefined,
            patrolSpeed: typeof behaviorSource.patrolSpeed === 'number' && Number.isFinite(behaviorSource.patrolSpeed)
                ? Math.max(0, behaviorSource.patrolSpeed)
                : undefined,
            idleDurationMs: typeof behaviorSource.idleDurationMs === 'number' && Number.isFinite(behaviorSource.idleDurationMs)
                ? Math.max(0, behaviorSource.idleDurationMs)
                : undefined,
            patrolPauseMs: typeof behaviorSource.patrolPauseMs === 'number' && Number.isFinite(behaviorSource.patrolPauseMs)
                ? Math.max(0, behaviorSource.patrolPauseMs)
                : undefined,
            alertDurationMs: typeof behaviorSource.alertDurationMs === 'number' && Number.isFinite(behaviorSource.alertDurationMs)
                ? Math.max(0, behaviorSource.alertDurationMs)
                : undefined,
            chaseSpeed: typeof behaviorSource.chaseSpeed === 'number' && Number.isFinite(behaviorSource.chaseSpeed)
                ? Math.max(0, behaviorSource.chaseSpeed)
                : undefined,
            senseRadius: typeof behaviorSource.senseRadius === 'number' && Number.isFinite(behaviorSource.senseRadius)
                ? Math.max(0, behaviorSource.senseRadius)
                : undefined,
            chaseReleaseRadius: typeof behaviorSource.chaseReleaseRadius === 'number' && Number.isFinite(behaviorSource.chaseReleaseRadius)
                ? Math.max(0, behaviorSource.chaseReleaseRadius)
                : undefined,
            returnSpeed: typeof behaviorSource.returnSpeed === 'number' && Number.isFinite(behaviorSource.returnSpeed)
                ? Math.max(0, behaviorSource.returnSpeed)
                : undefined,
            postTolerance: typeof behaviorSource.postTolerance === 'number' && Number.isFinite(behaviorSource.postTolerance)
                ? Math.max(1, behaviorSource.postTolerance)
                : undefined
        }
        : undefined;

    const scriptedLoopRef = raw?.scriptedLoopRef === null
        ? null
        : (() => {
            const ref = asOptionalString(raw?.scriptedLoopRef);
            return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
        })();
    const hookOverridesSource = asObject(raw?.sequenceHookOverrides);
    const sequenceHookOverrides = hookOverridesSource
        ? {
            onSpawnSequenceRef: hookOverridesSource.onSpawnSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onSpawnSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })(),
            onPlayerNearSequenceRef: hookOverridesSource.onPlayerNearSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onPlayerNearSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })(),
            onPlayerFarSequenceRef: hookOverridesSource.onPlayerFarSequenceRef === null
                ? null
                : (() => {
                    const ref = asOptionalString(hookOverridesSource.onPlayerFarSequenceRef);
                    return ref && isTestNpcScriptedSequenceRef(ref) ? ref : undefined;
                })()
        }
        : undefined;
    const interactionOverrideSource = asObject(raw?.interactionOverride);
    const interactionOverride = interactionOverrideSource
        ? {
            distancePx: typeof interactionOverrideSource.distancePx === 'number' && Number.isFinite(interactionOverrideSource.distancePx)
                ? Math.max(0, interactionOverrideSource.distancePx)
                : undefined,
            outcome: interactionOverrideSource.outcome === null
                ? null
                : (() => {
                    const outcomeSource = asObject(interactionOverrideSource.outcome);
                    if (!outcomeSource) {
                        return undefined;
                    }
                    if (outcomeSource.kind === 'run_sequence_ref') {
                        const sequenceRef = asOptionalString(outcomeSource.sequenceRef);
                        return sequenceRef && isTestNpcScriptedSequenceRef(sequenceRef)
                            ? {
                                kind: 'run_sequence_ref' as const,
                                sequenceRef
                            }
                            : undefined;
                    }
                    if (outcomeSource.kind === 'trigger_event') {
                        const eventId = asOptionalString(outcomeSource.eventId);
                        return eventId
                            ? {
                                kind: 'trigger_event' as const,
                                eventId
                            }
                            : undefined;
                    }
                    if (outcomeSource.kind === 'request_cutscene_ref') {
                        const cutsceneRef = asOptionalString(outcomeSource.cutsceneRef);
                        return cutsceneRef && isTestCutsceneRef(cutsceneRef)
                            ? {
                                kind: 'request_cutscene_ref' as const,
                                cutsceneRef
                            }
                            : undefined;
                    }
                    return undefined;
                })()
        }
        : undefined;
    const behaviorScriptsSource = asObject(raw?.behaviorScripts);
    const behaviorScripts = behaviorScriptsSource
        ? {
            patrol: asOptionalString(behaviorScriptsSource.patrol),
            defaultAction: asOptionalString(behaviorScriptsSource.defaultAction),
            altActions: Array.isArray(behaviorScriptsSource.altActions)
                ? behaviorScriptsSource.altActions
                    .filter((entry): entry is string => typeof entry === 'string')
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
                : undefined
        }
        : undefined;

    return {
        id: ensureUniqueId(asString(raw?.id, `npc_${index + 1}`), usedIds, `npc_${index + 1}`),
        profileId,
        x: asNumber(raw?.x, 0),
        y: asNumber(raw?.y, 0),
        initialManpuEmotionId: raw?.initialManpuEmotionId === null
            ? null
            : asOptionalString(raw?.initialManpuEmotionId),
        facing: raw?.facing === 'left' ? 'left' : raw?.facing === 'right' ? 'right' : undefined,
        scriptedLoopRef,
        sequenceHookOverrides,
        interactionOverride,
        playerBodyContactMode: raw?.playerBodyContactMode === 'block'
            || raw?.playerBodyContactMode === 'overlap'
            || raw?.playerBodyContactMode === 'ignore'
            ? raw.playerBodyContactMode
            : undefined,
        visualLayer: asVisualLayer(raw?.visualLayer, undefined),
        renderOrder: typeof raw?.renderOrder === 'number' && Number.isFinite(raw.renderOrder)
            ? Math.max(-9999, Math.min(9999, Math.round(raw.renderOrder)))
            : undefined,
        behavior,
        behaviorScripts: behaviorScripts && (
            behaviorScripts.patrol
            || behaviorScripts.defaultAction
            || (behaviorScripts.altActions && behaviorScripts.altActions.length > 0)
        )
            ? behaviorScripts
            : undefined
    };
};

const normalizeNpcInstances = (
    rawItems: unknown,
    defaults: readonly TestNpcInstanceConfig[],
    usedIds: Set<string>
): TestNpcInstanceConfig[] => {
    if (rawItems === undefined) {
        return defaults.map((entry, index) => normalizeNpcInstance({
            id: entry.id,
            profileId: entry.profileId,
            x: entry.x,
            y: entry.y,
            initialManpuEmotionId: entry.initialManpuEmotionId,
            facing: entry.facing,
            scriptedLoopRef: entry.scriptedLoopRef,
            sequenceHookOverrides: entry.sequenceHookOverrides,
            interactionOverride: entry.interactionOverride,
            playerBodyContactMode: entry.playerBodyContactMode,
            behavior: entry.behavior,
            behaviorScripts: entry.behaviorScripts
        }, usedIds, index)).filter((entry): entry is TestNpcInstanceConfig => entry !== null);
    }

    return asArray(rawItems)
        .map((entry, index) => normalizeNpcInstance(asObject(entry), usedIds, index))
        .filter((entry): entry is TestNpcInstanceConfig => entry !== null);
};

const normalizeArray = <T>(
    rawItems: unknown,
    defaults: readonly T[],
    normalizeItem: (raw: Record<string, unknown> | null, fallback: T, usedIds: Set<string>, index: number) => T,
    usedIds: Set<string>,
    getId?: (fallback: T) => string
): T[] => {
    const rawArrayProvided = Array.isArray(rawItems);
    const sourceItems = asArray(rawItems);
    const safeLength = rawArrayProvided ? sourceItems.length : defaults.length;
    const normalized: T[] = [];

    for (let index = 0; index < safeLength; index += 1) {
        const raw = asObject(sourceItems[index]);
        const rawId = typeof raw?.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null;
        const matchedFallback = rawId && getId
            ? defaults.find((entry) => getId(entry) === rawId)
            : undefined;
        const fallback = matchedFallback ?? defaults[index] ?? defaults[Math.max(0, defaults.length - 1)];
        if (!fallback) {
            break;
        }

        normalized.push(normalizeItem(raw, fallback, usedIds, index));
    }

    return normalized;
};

const fixDanglingDragBoxTargets = (config: TestWorldConfig): void => {
    const triggerPlatformIds = new Set(config.triggerPlatforms.map((entry) => entry.id));
    config.dragBoxes.forEach((dragBox) => {
        if (dragBox.targetTriggerPlatformId && !triggerPlatformIds.has(dragBox.targetTriggerPlatformId)) {
            dragBox.targetTriggerPlatformId = undefined;
        }
    });
};

const fixDanglingTriggerCommandTargets = (config: TestWorldConfig): void => {
    const triggerPlatformIds = new Set(config.triggerPlatforms.map((entry) => entry.id));
    const movingPlatformIds = new Set(config.movingPlatforms.map((entry) => entry.id));
    const npcIds = new Set(config.npcs.map((entry) => entry.id));
    const dragBoxIds = new Set(config.dragBoxes.map((entry) => entry.id));

    const sanitizeCommand = (command: TestWorldTriggerCommandConfig | null | undefined): TestWorldTriggerCommandConfig | null => {
        if (!command) {
            return null;
        }
        if (command.targetType === 'trigger_platform' && !triggerPlatformIds.has(command.targetId)) {
            return null;
        }
        if (command.targetType === 'trigger_platform') {
            if (command.operation !== 'set_active') {
                return null;
            }
            if (typeof command.value !== 'boolean') {
                return null;
            }
        }
        if (command.targetType === 'moving_platform' && !movingPlatformIds.has(command.targetId)) {
            return null;
        }
        if (command.targetType === 'moving_platform') {
            if (command.operation !== 'set_motion_state') {
                return null;
            }
            if (typeof command.value !== 'string') {
                return null;
            }
        }
        if (command.targetType === 'npc') {
            if (!npcIds.has(command.targetId)) {
                return null;
            }
            if (command.operation !== 'set_emotion') {
                return null;
            }
            if (typeof command.value !== 'string') {
                return null;
            }
        }
        return command;
    };

    const sanitizeEventBlocks = (
        blocks: TestEventBlock[] | undefined
    ): TestEventBlock[] | undefined => {
        if (!blocks || blocks.length <= 0) {
            return undefined;
        }
        const sanitizeEventActions = (
            actions: readonly TestEventAction[]
        ): TestEventAction[] => {
            return actions.filter((action) => {
                if (action.kind === 'actor_action') {
                    return npcIds.has(action.actorId);
                }
                if (action.kind === 'start_cutscene') {
                    return isTestCutsceneRef(action.cutsceneRef);
                }
                if (action.kind === 'set_flag') {
                    return action.flagId.trim().length > 0;
                }
                if (action.kind === 'trigger_event') {
                    return action.eventId.trim().length > 0;
                }
                if (action.kind === 'play_sfx') {
                    return action.sfxId.trim().length > 0;
                }
                if (action.kind === 'spawn_vfx') {
                    return action.vfxId.trim().length > 0;
                }
                return false;
            });
        };
        const sanitizedBlocks = blocks
            .map((block) => {
                const actions = sanitizeEventActions(block.actions);
                if (actions.length <= 0) {
                    return null;
                }
                return {
                    ...block,
                    actions
                } satisfies TestEventBlock;
            })
            .filter((entry): entry is TestEventBlock => entry !== null);

        return sanitizedBlocks.length > 0 ? sanitizedBlocks : undefined;
    };

    const sanitizeWorldLogicRules = (
        rules: TestWorldLogicRule[] | undefined
    ): TestWorldLogicRule[] | undefined => {
        if (!rules || rules.length <= 0) {
            return undefined;
        }
        const worldObjectIds = collectWorldObjectIds(config, true);
        const normalizedRules = rules
            .map((rule) => {
                if (!rule.id || !rule.when || !Array.isArray(rule.actions) || rule.actions.length <= 0) {
                    return null;
                }
                if (rule.when.kind === 'object_state_changed' && !worldObjectIds.has(rule.when.objectId)) {
                    return null;
                }
                if (rule.when.kind === 'npc_event' && rule.when.actorId && !npcIds.has(rule.when.actorId)) {
                    return null;
                }
                if (rule.when.kind === 'cutscene_finished' && rule.when.cutsceneRef && !isTestCutsceneRef(rule.when.cutsceneRef)) {
                    return null;
                }
                if (rule.when.kind === 'trigger_event' && rule.when.eventId.trim().length <= 0) {
                    return null;
                }

                const actions = rule.actions.filter((action) => {
                    if (action.kind === 'actor_action') {
                        return npcIds.has(action.actorId);
                    }
                    if (action.kind === 'start_cutscene') {
                        return isTestCutsceneRef(action.cutsceneRef);
                    }
                    if (action.kind === 'set_flag') {
                        return action.flagId.trim().length > 0;
                    }
                    if (action.kind === 'trigger_event') {
                        return action.eventId.trim().length > 0;
                    }
                    if (action.kind === 'play_sfx') {
                        return action.sfxId.trim().length > 0;
                    }
                    if (action.kind === 'spawn_vfx') {
                        return action.vfxId.trim().length > 0;
                    }
                    return false;
                });
                if (actions.length <= 0) {
                    return null;
                }
                return {
                    ...rule,
                    actions
                } satisfies TestWorldLogicRule;
            })
            .filter((entry): entry is TestWorldLogicRule => entry !== null);
        return normalizedRules.length > 0 ? normalizedRules : undefined;
    };

    config.triggerVolumes.forEach((triggerVolume) => {
        triggerVolume.enterCommand = sanitizeCommand(triggerVolume.enterCommand);
        triggerVolume.exitCommand = sanitizeCommand(triggerVolume.exitCommand);
        triggerVolume.onEnter = sanitizeEventBlocks(triggerVolume.onEnter);
        triggerVolume.onExit = sanitizeEventBlocks(triggerVolume.onExit);
        triggerVolume.onStay = sanitizeEventBlocks(triggerVolume.onStay);
        if (triggerVolume.activator === 'drag_box' && triggerVolume.sourceIds) {
            triggerVolume.sourceIds = triggerVolume.sourceIds.filter((entry) => dragBoxIds.has(entry));
            if (triggerVolume.sourceIds.length === 0) {
                triggerVolume.sourceIds = undefined;
            }
        }
    });
    config.worldLogicRules = sanitizeWorldLogicRules(config.worldLogicRules);
};

export interface ParseTestWorldConfigResult {
    config: TestWorldConfig | null;
    error: string | null;
}

export interface NormalizeTestWorldConfigOptions {
    fallbackConfig?: TestWorldConfig;
    preserveMissingBackgroundObjectFields?: boolean;
    preserveMissingLogicFields?: boolean;
    preserveMissingBehaviorScriptFields?: boolean;
}

export const normalizeTestWorldConfig = (
    input: unknown,
    options?: NormalizeTestWorldConfigOptions
): TestWorldConfig => {
    const defaults = cloneTestWorldConfig(options?.fallbackConfig ?? TEST_WORLD_CONFIG);
    const preserveMissingBackgroundObjectFields = options?.preserveMissingBackgroundObjectFields ?? true;
    const preserveMissingLogicFields = options?.preserveMissingLogicFields ?? true;
    const preserveMissingBehaviorScriptFields = options?.preserveMissingBehaviorScriptFields ?? true;
    const root = asObject(input);
    const usedIds = new Set<string>();
    const normalized: TestWorldConfig = {
        meta: normalizeMeta(asObject(root?.meta), defaults.meta),
        worldBounds: normalizeWorldBounds(asObject(root?.worldBounds), defaults.worldBounds),
        background: normalizeBackground(
            root?.background,
            defaults.background,
            preserveMissingBackgroundObjectFields
        ),
        worldFlags: normalizeWorldFlags(asObject(root?.worldFlags), defaults.worldFlags),
        worldLogicRules: normalizeTestWorldLogicRules(root?.worldLogicRules, defaults.worldLogicRules),
        logic: {
            scripts: [],
            scriptRefs: [],
            bindings: []
        },
        playerSpawn: normalizePlayerSpawn(asObject(root?.playerSpawn)),
        npcs: normalizeNpcInstances(root?.npcs, defaults.npcs, usedIds),
        surfaces: normalizeArray(
            root?.surfaces,
            defaults.surfaces,
            (raw, fallback, nextUsedIds, index) => normalizeSurface(
                raw,
                fallback,
                nextUsedIds,
                index,
                preserveMissingBehaviorScriptFields
            ),
            usedIds,
            (entry) => entry.id
        ),
        hazards: normalizeArray(root?.hazards, defaults.hazards, normalizeHazard, usedIds, (entry) => entry.id),
        checkpoints: normalizeArray(root?.checkpoints, defaults.checkpoints, normalizeCheckpoint, usedIds, (entry) => entry.id),
        finish: normalizeFinish(root?.finish, defaults.finish, usedIds),
        movingPlatforms: normalizeArray(root?.movingPlatforms, defaults.movingPlatforms, normalizeMovingPlatform, usedIds, (entry) => entry.id),
        triggerPlatforms: normalizeArray(root?.triggerPlatforms, defaults.triggerPlatforms, normalizeTriggerPlatform, usedIds, (entry) => entry.id),
        triggerVolumes: normalizeTriggerVolumeArray(root?.triggerVolumes, defaults.triggerVolumes ?? [], usedIds),
        dragBoxes: normalizeArray(root?.dragBoxes, defaults.dragBoxes, normalizeDragBox, usedIds, (entry) => entry.id),
        windZones: normalizeArray(root?.windZones, defaults.windZones, normalizeWindZone, usedIds, (entry) => entry.id),
        triangleFlightBreakWalls: normalizeArray(
            root?.triangleFlightBreakWalls,
            defaults.triangleFlightBreakWalls,
            normalizeBreakWall,
            usedIds,
            (entry) => entry.id
        ),
        trianglePickups: normalizeArray(root?.trianglePickups, defaults.trianglePickups, normalizePickup, usedIds, (entry) => entry.id),
        nextLevelId: root?.nextLevelId === null
            ? null
            : typeof root?.nextLevelId === 'string' && root.nextLevelId.trim().length > 0
                ? root.nextLevelId.trim()
                : defaults.nextLevelId
    };
    normalized.logic = normalizeTestWorldLogicConfig(
        root?.logic,
        defaults.logic,
        preserveMissingLogicFields,
        normalized
    );
    fixDanglingDragBoxTargets(normalized);
    fixDanglingTriggerCommandTargets(normalized);
    return normalized;
};

export const parseTestWorldConfigJson = (
    jsonText: string,
    options?: NormalizeTestWorldConfigOptions
): ParseTestWorldConfigResult => {
    try {
        const parsed = JSON.parse(jsonText) as unknown;
        return {
            config: normalizeTestWorldConfig(parsed, options),
            error: null
        };
    } catch (error) {
        return {
            config: null,
            error: error instanceof Error ? error.message : 'Invalid JSON.'
        };
    }
};

export const createDefaultTestWorldConfig = (fallbackConfig: TestWorldConfig = TEST_WORLD_CONFIG): TestWorldConfig => {
    return cloneTestWorldConfig(fallbackConfig);
};

export const createMinimalTestWorldConfig = (
    levelId: string,
    displayName: string
): TestWorldConfig => {
    return normalizeTestWorldConfig({
        meta: {
            id: levelId,
            displayName
        },
        worldBounds: {
            width: 1600,
            height: 900
        },
        background: null,
        worldLogicRules: [],
        logic: {
            scripts: [],
            scriptRefs: [],
            bindings: []
        },
        playerSpawn: {
            x: 128,
            y: 128,
            width: 32,
            height: 64,
            fillColor: 0x81d4fa,
            strokeColor: 0x0277bd
        },
        npcs: [],
        surfaces: [],
        hazards: [],
        checkpoints: [],
        finish: {
            id: 'finish',
            x: 1488,
            y: 768,
            width: 72,
            height: 120,
            fillColor: 0x99ff99,
            strokeColor: 0x00aa66,
            editorLocked: false
        },
        movingPlatforms: [],
        triggerPlatforms: [],
        triggerVolumes: [],
        dragBoxes: [],
        windZones: [],
        triangleFlightBreakWalls: [],
        trianglePickups: [],
        nextLevelId: null
    });
};
