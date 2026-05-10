import { type GameObjects, Physics, type Scene } from 'phaser';
import { createCheckpoint, type CheckpointObject } from '../checkpoint';
import { createDraggableBox, type DraggableBoxObject } from '../draggable_box';
import { createHazard, type HazardObject } from '../hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../moving_platform';
import { createTriangleFlightPickup, type TriangleFlightPickupObject } from '../triangle_flight_pickup';
import {
    createTriangleFlightBreakWall,
    doesTriangleFlightBreakWallOverlapPlayerShape,
    type TriangleFlightBreakWallObject
} from '../triangle_flight_break_wall';
import { createTriggerPlatform, type TriggerPlatformObject } from '../trigger_platform';
import { createWindZone, type WindZoneObject } from '../wind_zone';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from '../world_surface_tags';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import type { RespawnPoint } from './world_runtime_types';
import {
    TEST_WORLD_EDITOR_ADAPTERS,
    createNextWorldObjectId,
    type TestWorldEditorBounds,
    type TestWorldEditorHandleDefinition,
    type TestWorldEditorObjectType,
    type TestWorldEditorSelectionPart
} from './test_world_editor_adapters';
import {
    cloneTestWorldConfig,
    type TestWorldBoundsConfig,
    type TestWorldCheckpointConfig,
    type TestWorldConfig,
    type TestWorldDragBoxConfig,
    type TestWorldFinishConfig,
    type TestWorldHazardConfig,
    type TestWorldMovingPlatformConfig,
    type TestWorldPlayerSpawnConfig,
    type TestWorldSurfaceConfig,
    type TestWorldTriangleFlightBreakWallConfig,
    type TestWorldTrianglePickupConfig,
    type TestWorldTriggerPlatformConfig,
    type TestWorldTriggerVolumeConfig,
    type TestWorldWindZoneConfig
} from './test_world_config';
import type { TestNpcControlMode, TestNpcInstanceConfig } from '../../npc/npc_types';
import { normalizeTestWorldConfig } from './test_world_config_validation';
import { createTestWorldSurfaceOutlineRenderer } from './test_world_surface_outline_renderer';
import { createTestWorldMovingPlatformRuntimeController } from './test_world_moving_platform_runtime';
import { createTestWorldTriggerRuntime, type TestWorldTriggerVolumeRuntime } from './test_world_trigger_runtime';
import { applyTestWorldVisualDepthEntries, type TestWorldVisualDepthEntry } from './test_world_visual_order';
import {
    createTestWorldActorContactRuntime,
    TEST_WORLD_PLAYER_ACTOR_ID
} from './test_world_actor_contact_runtime';
import {
    createTestNpcRuntime,
    type TestNpcCutsceneSequenceDispatchResult,
    type TestNpcCutsceneSequenceSnapshot,
    type TestNpcPatrolBehaviorRuntimeAssignment,
    type TestNpcPatrolBehaviorRuntimeDebugEntry,
    type TestNpcRuntime,
    type TestNpcWorldCollisionRuntime
} from '../../npc/npc_runtime';
import { createTestNpcInteractionRuntime, type TestNpcInteractionRuntime } from '../../npc/npc_interaction_runtime';
import type { TestNpcDebugEntry, TestNpcInteractionDebugState } from '../../npc/npc_types';
import type { ActorActionSequence } from '../../actor_actions/actor_action_types';
import type {
    TestEventRuntimeContext,
    TestWorldDebugEventSink
} from '../../events/test_event_actions';
import {
    cloneTestNpcScriptedSequenceAction,
    getTestNpcScriptedSequenceDefinition
} from '../../npc/npc_scripted_sequences';
import {
    getWorldFlag,
    getWorldFlagsDebugSnapshot,
    resetWorldFlags,
    setWorldFlag
} from '../../events/test_world_flags';
import {
    executeMatchingWorldLogicRules,
    type TestWorldLogicEvent
} from '../../events/test_world_logic_rules';
import type {
    DebugEventType,
    EventDebugRecordInput
} from '../../debug/event_debug_types';
import {
    executeLogicBindingsForEvent,
    executeLogicScriptForWorldOnStart,
    type LogicBindingEventTrace,
    type LogicScriptCommandExecutionResult,
    type LogicScriptRuntimeStatus,
    type LogicScriptExecutionResult,
    type LogicScriptWorldOnStartExecutionContext,
    type LogicWorldOnStartTrace
} from './logic_script_runtime';
import {
    cloneWorldOnStartLogicTrace,
    createWorldOnStartLogicStartupTrace
} from './logic_script_startup_runtime';
import {
    normalizeRuntimeReplaceConfig,
    normalizeRuntimeSetConfig
} from './test_world_runtime_rebuild';
import {
    ensureExternalLogicScriptsLoaded,
    getLogicScriptAsset,
    reloadExternalLogicScripts
} from './logic_script_registry';
import {
    getPlatformMovePingPongParams,
    PLATFORM_MOVE_PING_PONG_COMMAND_TYPE,
    summarizePlatformMovePingPongContract,
    type PlatformMovePingPongAxis,
    type PlatformMovePingPongStart
} from './platform_command_registry';
import {
    getNpcPatrolPingPongParams,
    NPC_PATROL_PING_PONG_COMMAND_TYPE,
    summarizeNpcPatrolPingPongContract
} from './npc_command_registry';

export interface TestWorldEditorHandle {
    id: string;
    rootId: string;
    label: string;
    type: TestWorldEditorObjectType;
    part: TestWorldEditorSelectionPart;
    isLocked: () => boolean;
    getBounds: () => TestWorldEditorBounds;
    containsPoint: (worldX: number, worldY: number) => boolean;
}

export interface TestWorldEditorObjectSummary {
    id: string;
    label: string;
    type: TestWorldEditorObjectType;
    locked: boolean;
    onlyDebugView?: boolean;
    runtimeVisual?: {
        fillColor?: string;
        strokeColor?: string;
        alpha?: number;
        layer?: number;
        shaderKey?: string | null;
        textureKey?: string | null;
    };
}

export type ObjectInteractionTraceStatus =
    | 'idle'
    | 'no_bindings'
    | 'no_player'
    | 'no_target_in_range'
    | 'executed'
    | 'skipped'
    | 'error';

export interface ObjectInteractionCandidateTrace {
    targetId: string;
    distancePx?: number;
    hasFocusPoint: boolean;
    inRange: boolean;
}

export interface ObjectInteractionTrace {
    attempted: boolean;
    attemptId: number;
    status: ObjectInteractionTraceStatus;
    selectedTargetId?: string;
    selectedDistancePx?: number;
    radiusPx: number;
    candidateCount: number;
    candidates: ObjectInteractionCandidateTrace[];
    bindingTrace?: LogicBindingEventTrace;
    message: string;
}

export type NpcInteractionTraceStatus =
    | 'idle'
    | 'no_bindings'
    | 'no_player'
    | 'no_target_in_range'
    | 'executed'
    | 'skipped'
    | 'error';

export interface NpcInteractionCandidateTrace {
    targetId: string;
    distancePx?: number;
    hasFocusPoint: boolean;
    inRange: boolean;
}

export interface NpcDefaultActionTrace {
    scriptId: string | null;
    status: LogicScriptRuntimeStatus;
    reason?: string;
    commands: LogicScriptCommandExecutionResult[];
}

export interface NpcInteractionTrace {
    attempted: boolean;
    attemptId: number;
    status: NpcInteractionTraceStatus;
    selectedTargetId?: string;
    selectedDistancePx?: number;
    radiusPx: number;
    candidateCount: number;
    candidates: NpcInteractionCandidateTrace[];
    bindingTrace?: LogicBindingEventTrace;
    defaultActionTrace?: NpcDefaultActionTrace;
    message: string;
}

export interface CutsceneLogicTrace {
    attemptId: number;
    cutsceneId: string;
    slot: 'onFinish';
    status: LogicBindingEventTrace['status'];
    bindingTrace: LogicBindingEventTrace;
    message: string;
}

export interface TriggerOnEnterLogicTrace {
    attemptId: number;
    triggerId: string;
    sourceId: string;
    slot: 'onEnter';
    status: LogicBindingEventTrace['status'];
    bindingTrace: LogicBindingEventTrace;
    message: string;
}

export interface SurfaceMoveRuntimeDebugEntry {
    surfaceId: string;
    assignedScriptId: string | null;
    scriptFound: boolean;
    scriptCategory: string | null;
    commandType: string | null;
    paramsValid: boolean | null;
    resolved: boolean;
    moverActive: boolean;
    currentX: number;
    currentY: number;
    originX: number;
    originY: number;
    direction: -1 | 0 | 1;
    velocityX: number;
    velocityY: number;
    lastDeltaX: number;
    lastDeltaY: number;
    lastCarryDeltaX: number;
    lastCarryDeltaY: number;
    blockedReason: string | null;
    updateVisitCount: number;
    visitedThisFrame: boolean;
}

export interface SurfaceMoveRuntimeDebugSnapshot {
    discoveredAssignments: number;
    resolvedAssignments: number;
    moverStateCount: number;
    moversVisitedThisFrame: number;
    surfaces: SurfaceMoveRuntimeDebugEntry[];
}

export interface NpcPatrolRuntimeDebugEntry {
    npcId: string;
    controlMode: TestNpcControlMode;
    controlledBy: string | null;
    assignedScriptId: string | null;
    scriptFound: boolean;
    scriptCategory: string | null;
    commandType: string | null;
    paramsValid: boolean | null;
    axis: 'horizontal' | 'vertical' | null;
    direction: -1 | 0 | 1;
    velocityX: number;
    velocityY: number;
    resolved: boolean;
    active: boolean;
    currentX: number;
    currentY: number;
    originX: number;
    originY: number;
    blockedReason: string | null;
}

export interface NpcPatrolRuntimeDebugSnapshot {
    discoveredAssignments: number;
    resolvedAssignments: number;
    activeAssignments: number;
    npcs: NpcPatrolRuntimeDebugEntry[];
}

export interface TestWorldRuntime {
    hazards: readonly HazardObject[];
    updateMovingPlatforms: (deltaMs: number) => void;
    updateNpcs: (deltaMs: number) => void;
    updateNpcInteractionTarget: () => void;
    tryTriggerObjectLogicInteraction: () => boolean;
    tryTriggerNpcLogicInteraction: () => boolean;
    tryTriggerNpcInteraction: () => void;
    syncNpcTriangleSupportSurfaces: () => void;
    postPlayerTickUpdate: () => void;
    resetRespawnObjects: () => void;
    syncPlayerCollisionMode: () => void;
    consumeFinishReached: () => boolean;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    getWorldBounds: () => TestWorldBoundsConfig;
    getLevelId: () => string;
    getNextLevelId: () => string | null;
    getNpcDebugEntries: () => readonly TestNpcDebugEntry[];
    getNpcInteractionDebugState: () => TestNpcInteractionDebugState;
    setNpcControlMode: (actorId: string, mode: TestNpcControlMode, controlledBy?: string) => boolean;
    clearNpcControlMode: (actorId: string) => boolean;
    dispatchWorldLogicEvent: (event: TestWorldLogicEvent) => boolean;
    dispatchCutsceneActorSequenceRef: (
        actorId: string,
        sequenceRef: string,
        cutsceneRef: string,
        stepRef: string
    ) => {
        actorId: string;
        result: 'dispatched' | 'invalid_sequence_ref' | 'unknown_actor' | 'busy';
        detail: string;
        sequenceId: string | null;
    };
    dispatchCutsceneSetEmotion: (
        actorId: string,
        emotionId: string
    ) => {
        actorId: string;
        result: 'applied' | 'unknown_actor';
        detail: string;
    };
    getCutsceneActorSequenceSnapshot: (actorId: string) => TestNpcCutsceneSequenceSnapshot | null;
    getNpcCameraFocusObject: (actorId: string) => GameObjects.Container | null;
    executeCutsceneLogicOnFinish: (cutsceneId: string) => LogicBindingEventTrace;
    getWorldOnStartLogicTrace: () => LogicWorldOnStartTrace | null;
    getRuntimeWorldFlagsSnapshot: () => Record<string, boolean>;
    getLastObjectInteractionTrace: () => ObjectInteractionTrace;
    getLastNpcInteractionTrace: () => NpcInteractionTrace;
    getLastCutsceneLogicTrace: () => CutsceneLogicTrace | null;
    getLastTriggerOnEnterLogicTrace: () => TriggerOnEnterLogicTrace | null;
    getSurfaceMoveRuntimeDebugSnapshot: () => SurfaceMoveRuntimeDebugSnapshot;
    getNpcPatrolRuntimeDebugSnapshot: () => NpcPatrolRuntimeDebugSnapshot;
    getConfig: () => TestWorldConfig;
    setConfig: (config: TestWorldConfig) => void;
    replaceConfig: (
        config: unknown,
        options?: { mode?: 'runtime_patch' | 'full_import' }
    ) => { success: boolean; reason?: string };
    getEditorHandles: () => readonly TestWorldEditorHandle[];
    getEditorObjects: () => readonly TestWorldEditorObjectSummary[];
    getEditorHandle: (id: string) => TestWorldEditorHandle | null;
    patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds) => boolean;
    patchObjectFields: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchNpcFields: (id: string, patch: Record<string, unknown>) => boolean;
    patchObjectColors: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectDebugVisibility: (rootId: string, onlyDebugView: boolean) => boolean;
    setEditorDebugViewActive: (active: boolean) => void;
    setSurfaceMoveRuntimeEditingActive: (surfaceId: string, active: boolean) => boolean;
    setObjectLocked: (rootId: string, locked: boolean) => boolean;
    createObject: (type: TestWorldEditorObjectType, worldX: number, worldY: number) => string | null;
    duplicateObject: (rootId: string) => string | null;
    removeObject: (rootId: string) => boolean;
    focusObjectPoint: (targetId: string) => { x: number; y: number } | null;
    rebuildFromCurrentConfig: () => void;
    setEventDebugSink?: (sink: ((entry: EventDebugRecordInput) => void) | undefined) => void;
    destroy: () => void;
}

interface CreateTestWorldRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    initialConfig: TestWorldConfig;
    onCheckpointActivated: (point: RespawnPoint) => void;
    eventDebugSink?: TestWorldDebugEventSink;
}

interface PlayerSpawnMarkerObject {
    body: Phaser.GameObjects.Rectangle;
    glow: Phaser.GameObjects.Rectangle;
    crosshair: Phaser.GameObjects.Graphics;
    refresh: () => void;
    destroy: () => void;
}

interface RuntimeBinding {
    rootId: string;
    type: TestWorldEditorObjectType;
    label: string;
    isLocked: () => boolean;
    setLocked: (locked: boolean) => void;
    handleDefinitions: TestWorldEditorHandleDefinition<unknown>[];
    refresh: () => void;
    patchFields: (patch: Record<string, unknown>) => void;
    patchColors: (patch: Record<string, unknown>) => void;
}

interface BuiltWorldInstance {
    hazards: HazardObject[];
    updateMovingPlatforms: (deltaMs: number) => void;
    updateNpcs: (deltaMs: number) => void;
    updateNpcInteractionTarget: () => void;
    tryTriggerNpcInteraction: () => void;
    syncNpcTriangleSupportSurfaces: () => void;
    postPlayerTickUpdate: () => void;
    resetRespawnObjects: () => void;
    syncPlayerCollisionMode: (useArcadePlatformCollisions: boolean) => void;
    consumeFinishReached: () => boolean;
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
    getNpcDebugEntries: () => readonly TestNpcDebugEntry[];
    getNpcInteractionDebugState: () => TestNpcInteractionDebugState;
    setNpcControlMode: (actorId: string, mode: TestNpcControlMode, controlledBy?: string) => boolean;
    clearNpcControlMode: (actorId: string) => boolean;
    dispatchWorldLogicEvent: (event: TestWorldLogicEvent) => boolean;
    dispatchCutsceneActorSequenceRef: (
        actorId: string,
        sequenceRef: string,
        cutsceneRef: string,
        stepRef: string
    ) => {
        actorId: string;
        result: 'dispatched' | 'invalid_sequence_ref' | 'unknown_actor' | 'busy';
        detail: string;
        sequenceId: string | null;
    };
    dispatchCutsceneSetEmotion: (
        actorId: string,
        emotionId: string
    ) => {
        actorId: string;
        result: 'applied' | 'unknown_actor';
        detail: string;
    };
    getCutsceneActorSequenceSnapshot: (actorId: string) => TestNpcCutsceneSequenceSnapshot | null;
    getNpcCameraFocusObject: (actorId: string) => GameObjects.Container | null;
    getNpcActorBounds: (actorId: string) => { x: number; y: number; width: number; height: number } | null;
    activatePendingSurfaceMovers: () => number;
    getSurfaceMoveRuntimeDebugSnapshot: () => SurfaceMoveRuntimeDebugSnapshot;
    getNpcPatrolRuntimeDebugSnapshot: () => NpcPatrolRuntimeDebugSnapshot;
    getEditorHandles: () => readonly TestWorldEditorHandle[];
    getEditorObjects: () => readonly TestWorldEditorObjectSummary[];
    getEditorHandle: (id: string) => TestWorldEditorHandle | null;
    patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds) => boolean;
    patchObjectFields: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectColors: (rootId: string, patch: Record<string, unknown>) => boolean;
    patchObjectDebugVisibility: (rootId: string, onlyDebugView: boolean) => boolean;
    setEditorDebugViewActive: (active: boolean) => void;
    setSurfaceMoveRuntimeEditingActive: (surfaceId: string, active: boolean) => boolean;
    setObjectLocked: (rootId: string, locked: boolean) => boolean;
    focusObjectPoint: (targetId: string) => { x: number; y: number } | null;
    destroy: () => void;
}

interface FinishTriggerObject {
    trigger: Phaser.GameObjects.Rectangle;
    refresh: () => void;
    destroy: () => void;
}

interface TriggerVolumeObject extends TestWorldTriggerVolumeRuntime {
    refresh: () => void;
    destroy: () => void;
}

const applyWorldBounds = (scene: Scene, bounds: TestWorldBoundsConfig): void => {
    scene.physics.world.setBounds(0, 0, bounds.width, bounds.height);
    scene.matter.world.setBounds(0, 0, bounds.width, bounds.height, 64, true, true, true, true);
};

const captureCreatedDisplayObjects = <T>(
    scene: Scene,
    factory: () => T
): { result: T; createdObjects: Phaser.GameObjects.GameObject[] } => {
    const before = new Set(scene.children.getChildren());
    const result = factory();
    const createdObjects = scene.children.getChildren().filter((entry) => !before.has(entry));
    return {
        result,
        createdObjects
    };
};

const isSurfaceSolid = (config: TestWorldSurfaceConfig): boolean => {
    return (config.collisionMode ?? 'solid') === 'solid';
};

type SurfaceMoveMatterBody = MatterJS.BodyType & {
    pfCarryDeltaX?: number;
    pfCarryDeltaY?: number;
};

interface SurfaceMoveRuntimeAssignment {
    surfaceId: string;
    axis: PlatformMovePingPongAxis;
    distance: number;
    speed: number;
    start: PlatformMovePingPongStart;
}

interface SurfaceMoveRuntimeState {
    assignment: SurfaceMoveRuntimeAssignment;
    surface: Phaser.GameObjects.Rectangle;
    matterBody: SurfaceMoveMatterBody;
    mode: PlatformMovePingPongStart;
    direction: 1 | -1;
    runOnceCompleted: boolean;
    originX: number;
    originY: number;
    lastDeltaX: number;
    lastDeltaY: number;
    lastCarryDeltaX: number;
    lastCarryDeltaY: number;
    updateVisitCount: number;
    lastVisitedFrame: number;
}

const resolveSurfaceMoveRuntimeAssignment = (
    surfaceConfig: TestWorldSurfaceConfig
): SurfaceMoveRuntimeAssignment | null => {
    const scriptId = typeof surfaceConfig.behaviorScripts?.move === 'string'
        ? surfaceConfig.behaviorScripts.move.trim()
        : '';
    if (scriptId.length <= 0) {
        return null;
    }

    const script = getLogicScriptAsset(scriptId);
    if (!script || script.category !== 'platform.move') {
        return null;
    }
    const summary = summarizePlatformMovePingPongContract(script.commands);
    if (!summary.hasExactlyOneValidCommand) {
        return null;
    }

    const command = script.commands[0];
    if (!command || command.type.trim() !== PLATFORM_MOVE_PING_PONG_COMMAND_TYPE) {
        return null;
    }
    const params = getPlatformMovePingPongParams(command.params);
    if (!params) {
        return null;
    }

    return {
        surfaceId: surfaceConfig.id,
        axis: params.axis,
        distance: params.distance,
        speed: params.speed,
        start: params.start
    };
};

const hasAssignedSurfaceMoveScript = (surfaceConfig: TestWorldSurfaceConfig): boolean => {
    const scriptId = typeof surfaceConfig.behaviorScripts?.move === 'string'
        ? surfaceConfig.behaviorScripts.move.trim()
        : '';
    return scriptId.length > 0;
};

const resolveNpcPatrolRuntimeAssignment = (
    npcConfig: TestNpcInstanceConfig
): TestNpcPatrolBehaviorRuntimeAssignment | null => {
    const scriptId = typeof npcConfig.behaviorScripts?.patrol === 'string'
        ? npcConfig.behaviorScripts.patrol.trim()
        : '';
    if (scriptId.length <= 0) {
        return null;
    }
    const script = getLogicScriptAsset(scriptId);
    if (!script || script.category !== 'npc.patrol') {
        return null;
    }
    const summary = summarizeNpcPatrolPingPongContract(script.commands);
    if (!summary.hasExactlyOneValidCommand) {
        return null;
    }
    const command = script.commands[0];
    if (!command || command.type.trim() !== NPC_PATROL_PING_PONG_COMMAND_TYPE) {
        return null;
    }
    const params = getNpcPatrolPingPongParams(command.params);
    if (!params) {
        return null;
    }
    return {
        scriptId,
        axis: params.axis,
        distance: params.distance,
        speed: params.speed,
        start: params.start
    };
};

const NPC_ARCADE_CARRY_SOURCE_DATA_KEY = 'pf_npc_arcade_carry_source';
const NPC_ARCADE_CARRY_VELOCITY_X_DATA_KEY = 'pf_npc_arcade_carry_velocity_x';
const NPC_CARRY_TOP_GAP_TOLERANCE_UP_PX = 12;
const NPC_CARRY_TOP_GAP_TOLERANCE_DOWN_PX = 10;
const NPC_CARRY_MIN_OVERLAP_X_PX = 4;
const NPC_CARRY_SUPPORT_GRACE_FRAMES = 3;
const NPC_CARRY_GRACE_MAX_UPWARD_VELOCITY = -40;
const OBJECT_LOGIC_INTERACTION_SLOT = 'onInteract';
const NPC_LOGIC_INTERACTION_SLOT = 'onInteract';
const OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX = 96;
const NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX = 96;
const CUTSCENE_LOGIC_ON_FINISH_SLOT = 'onFinish';

const createIdleObjectInteractionTrace = (): ObjectInteractionTrace => ({
    attempted: false,
    attemptId: 0,
    status: 'idle',
    radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
    candidateCount: 0,
    candidates: [],
    message: 'No interaction attempted yet.'
});

const cloneObjectInteractionTrace = (
    trace: ObjectInteractionTrace
): ObjectInteractionTrace => JSON.parse(JSON.stringify(trace)) as ObjectInteractionTrace;

const createIdleNpcInteractionTrace = (): NpcInteractionTrace => ({
    attempted: false,
    attemptId: 0,
    status: 'idle',
    radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
    candidateCount: 0,
    candidates: [],
    message: 'No interaction attempted yet.'
});

const cloneNpcInteractionTrace = (
    trace: NpcInteractionTrace
): NpcInteractionTrace => JSON.parse(JSON.stringify(trace)) as NpcInteractionTrace;

const cloneCutsceneLogicTrace = (
    trace: CutsceneLogicTrace
): CutsceneLogicTrace => JSON.parse(JSON.stringify(trace)) as CutsceneLogicTrace;

const cloneTriggerOnEnterLogicTrace = (
    trace: TriggerOnEnterLogicTrace
): TriggerOnEnterLogicTrace => JSON.parse(JSON.stringify(trace)) as TriggerOnEnterLogicTrace;

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(max, Math.max(min, value));
};

const roundDistance = (distancePx: number): number => Math.round(distancePx * 100) / 100;

const getDistanceToObjectBounds = (
    playerX: number,
    playerY: number,
    bounds: TestWorldEditorBounds
): number => {
    const halfWidth = Math.max(0, Math.abs(bounds.width) * 0.5);
    const halfHeight = Math.max(0, Math.abs(bounds.height) * 0.5);
    const left = bounds.x - halfWidth;
    const right = bounds.x + halfWidth;
    const top = bounds.y - halfHeight;
    const bottom = bounds.y + halfHeight;
    const nearestX = clamp(playerX, left, right);
    const nearestY = clamp(playerY, top, bottom);
    return Math.hypot(playerX - nearestX, playerY - nearestY);
};

const createCutsceneActorSequenceFromRef = (
    actorId: string,
    sequenceRef: string,
    cutsceneRef: string,
    stepRef: string
): ActorActionSequence | null => {
    const definition = getTestNpcScriptedSequenceDefinition(sequenceRef);
    if (!definition) {
        return null;
    }

    return {
        id: `${actorId}:cutscene:${cutsceneRef}:${stepRef}:${definition.id}`,
        source: 'cutscene_runtime',
        targetRef: definition.id,
        actions: definition.actions.map(cloneTestNpcScriptedSequenceAction)
    };
};

export const createTestWorldRuntime = (
    params: CreateTestWorldRuntimeParams
): TestWorldRuntime => {
    const {
        scene,
        player,
        onCheckpointActivated,
        eventDebugSink
    } = params;
    let currentEventDebugSink = eventDebugSink;
    const forwardedEventDebugSink: TestWorldDebugEventSink = (entry) => {
        currentEventDebugSink?.(entry);
    };
    let currentConfig = normalizeTestWorldConfig(params.initialConfig, {
        fallbackConfig: params.initialConfig
    });
    const worldOnStartTraceConfig = cloneTestWorldConfig(currentConfig);
    let hasExecutedWorldOnStartLogicTrace = false;
    let lastWorldOnStartLogicTrace: LogicWorldOnStartTrace | null = null;
    let lastObjectInteractionTrace: ObjectInteractionTrace = createIdleObjectInteractionTrace();
    let lastNpcInteractionTrace: NpcInteractionTrace = createIdleNpcInteractionTrace();
    let lastCutsceneLogicTrace: CutsceneLogicTrace | null = null;
    let lastTriggerOnEnterLogicTrace: TriggerOnEnterLogicTrace | null = null;
    let objectInteractionAttemptId = 0;
    let npcInteractionAttemptId = 0;
    let cutsceneLogicAttemptId = 0;
    let triggerOnEnterLogicAttemptId = 0;
    let useArcadePlatformCollisions = player.currentForm !== 'triangle';
    let editorDebugViewActive = false;
    const isKnownConfigCutsceneId = (cutsceneRef: string): boolean => {
        const cutscenes = Array.isArray(currentConfig.cutscenes) ? currentConfig.cutscenes : [];
        return cutscenes.some((entry) => entry.id.trim() === cutsceneRef);
    };
    const hasBindingTraceCutsceneRequest = (bindingTrace: LogicBindingEventTrace, cutsceneId: string): boolean => {
        return bindingTrace.bindings.some((binding) => binding.commands.some((command) => {
            return command.type === 'start_cutscene'
                && command.status === 'success'
                && command.message.includes(`"${cutsceneId}"`)
                && command.message.includes('requested');
        }));
    };
    const executeTriggerOnEnterLogic = (triggerId: string, sourceId: string): void => {
        const normalizedTriggerId = triggerId.trim();
        const normalizedSourceId = sourceId.trim();
        if (normalizedTriggerId.length <= 0) {
            return;
        }

        triggerOnEnterLogicAttemptId += 1;
        const attemptId = triggerOnEnterLogicAttemptId;

        try {
            const bindingTrace = executeLogicBindingsForEvent(
                currentConfig,
                {
                    targetType: 'trigger',
                    targetId: normalizedTriggerId,
                    slot: 'onEnter'
                },
                createLogicScriptRuntimeContext()
            );
            const triggerConfig = currentConfig.triggerVolumes.find((entry) => entry.id === normalizedTriggerId) ?? null;
            const directCutsceneId = triggerConfig?.onEnterCutsceneId?.trim() ?? '';
            let directCutsceneStatusMessage = '';
            let traceStatus: LogicBindingEventTrace['status'] = bindingTrace.status;
            if (directCutsceneId.length > 0) {
                if (!isKnownConfigCutsceneId(directCutsceneId)) {
                    directCutsceneStatusMessage = ` Direct cutscene "${directCutsceneId}" is missing in current level cutscenes.`;
                    traceStatus = 'error';
                } else if (hasBindingTraceCutsceneRequest(bindingTrace, directCutsceneId)) {
                    directCutsceneStatusMessage = ` Direct cutscene "${directCutsceneId}" skipped (already requested by onEnter script).`;
                } else {
                    scene.events.emit('pf:npc_interaction_cutscene_request', {
                        actorId: `trigger_on_enter:${normalizedTriggerId}`,
                        cutsceneRef: directCutsceneId
                    });
                    directCutsceneStatusMessage = ` Direct cutscene "${directCutsceneId}" requested by trigger ${normalizedTriggerId}.`;
                }
            }
            const message = (bindingTrace.bindings.length <= 0
                ? `No matching trigger/onEnter bindings for ${normalizedTriggerId}.`
                : bindingTrace.status === 'success'
                    ? `Executed trigger/onEnter bindings for ${normalizedTriggerId}.`
                    : bindingTrace.status === 'error'
                        ? `Trigger/onEnter binding execution failed for ${normalizedTriggerId}.`
                        : `Trigger/onEnter binding execution skipped for ${normalizedTriggerId}.`) + directCutsceneStatusMessage;
            lastTriggerOnEnterLogicTrace = {
                attemptId,
                triggerId: normalizedTriggerId,
                sourceId: normalizedSourceId,
                slot: 'onEnter',
                status: traceStatus,
                bindingTrace,
                message
            };
        } catch (error) {
            const errorMessage = error instanceof Error && error.message.trim().length > 0
                ? error.message
                : 'Unknown trigger/onEnter runtime error.';
            const bindingTrace: LogicBindingEventTrace = {
                targetType: 'trigger',
                targetId: normalizedTriggerId,
                slot: 'onEnter',
                status: 'error',
                bindings: []
            };
            lastTriggerOnEnterLogicTrace = {
                attemptId,
                triggerId: normalizedTriggerId,
                sourceId: normalizedSourceId,
                slot: 'onEnter',
                status: 'error',
                bindingTrace,
                message: `Trigger/onEnter runtime exception for ${normalizedTriggerId}: ${errorMessage}`
            };
        }
    };

    let instance = buildWorldInstance(
        scene,
        player,
        onCheckpointActivated,
        currentConfig,
        useArcadePlatformCollisions,
        forwardedEventDebugSink,
        executeTriggerOnEnterLogic
    );

    const createLogicScriptRuntimeContext = (): LogicScriptWorldOnStartExecutionContext => ({
        setWorldFlag: (key, value) => {
            setWorldFlag(key, value);
        },
        startCutscene: (cutsceneRef) => {
            const normalizedCutsceneRef = cutsceneRef.trim();
            if (normalizedCutsceneRef.length <= 0 || !isKnownConfigCutsceneId(normalizedCutsceneRef)) {
                return false;
            }
            scene.events.emit('pf:npc_interaction_cutscene_request', {
                actorId: 'world_on_start_logic_runtime',
                cutsceneRef: normalizedCutsceneRef
            });
            return true;
        }
    });

    const executeWorldOnStartLogicTraceOnce = (): void => {
        if (hasExecutedWorldOnStartLogicTrace) {
            return;
        }
        void createWorldOnStartLogicStartupTrace(worldOnStartTraceConfig, createLogicScriptRuntimeContext())
            .then((trace) => {
                if (hasExecutedWorldOnStartLogicTrace) {
                    return;
                }
                hasExecutedWorldOnStartLogicTrace = true;
                lastWorldOnStartLogicTrace = trace;
            })
            .catch(() => {
                if (hasExecutedWorldOnStartLogicTrace) {
                    return;
                }
                hasExecutedWorldOnStartLogicTrace = true;
            });
    };

    executeWorldOnStartLogicTraceOnce();

    const tryBootstrapSurfaceMoveRuntimeAfterScriptLoad = (): void => {
        const hasMoveAssignments = currentConfig.surfaces.some((surfaceConfig) => hasAssignedSurfaceMoveScript(surfaceConfig));
        if (!hasMoveAssignments) {
            return;
        }
        const hasResolvableAssignmentsNow = currentConfig.surfaces.some(
            (surfaceConfig) => resolveSurfaceMoveRuntimeAssignment(surfaceConfig) !== null
        );
        if (hasResolvableAssignmentsNow) {
            instance.activatePendingSurfaceMovers();
            return;
        }

        void ensureExternalLogicScriptsLoaded()
            .then((preloadResult) => {
                if (preloadResult.success) {
                    return preloadResult;
                }
                return reloadExternalLogicScripts();
            })
            .then((reloadResult) => {
                if (!reloadResult.success) {
                    return;
                }
                instance.activatePendingSurfaceMovers();
            })
            .catch(() => {
                // Keep runtime safe and static when script preload fails.
            });
    };

    const rebuildFromCurrentConfig = (): void => {
        instance.destroy();
        instance = buildWorldInstance(
            scene,
            player,
            onCheckpointActivated,
            currentConfig,
            useArcadePlatformCollisions,
            forwardedEventDebugSink,
            executeTriggerOnEnterLogic
        );
        instance.setEditorDebugViewActive(editorDebugViewActive);
    };

    tryBootstrapSurfaceMoveRuntimeAfterScriptLoad();

    const removeByRootId = (rootId: string): boolean => {
        if (rootId === 'player_spawn') {
            return false;
        }
        if (currentConfig.finish?.id === rootId) {
            currentConfig.finish = null;
            return true;
        }

        const removeFrom = <T extends { id: string }>(items: T[]): boolean => {
            const index = items.findIndex((entry) => entry.id === rootId);
            if (index < 0) {
                return false;
            }
            items.splice(index, 1);
            return true;
        };

        return removeFrom(currentConfig.surfaces)
            || removeFrom(currentConfig.npcs)
            || removeFrom(currentConfig.hazards)
            || removeFrom(currentConfig.checkpoints)
            || removeFrom(currentConfig.movingPlatforms)
            || removeFrom(currentConfig.triggerPlatforms)
            || removeFrom(currentConfig.triggerVolumes)
            || removeFrom(currentConfig.dragBoxes)
            || removeFrom(currentConfig.windZones)
            || removeFrom(currentConfig.triangleFlightBreakWalls)
            || removeFrom(currentConfig.trianglePickups);
    };

    const findRootConfigById = (
        rootId: string
    ):
        | TestWorldPlayerSpawnConfig
        | TestWorldSurfaceConfig
        | TestWorldHazardConfig
        | TestWorldCheckpointConfig
        | TestWorldFinishConfig
        | TestNpcInstanceConfig
        | TestWorldMovingPlatformConfig
        | TestWorldTriggerPlatformConfig
        | TestWorldTriggerVolumeConfig
        | TestWorldDragBoxConfig
        | TestWorldWindZoneConfig
        | TestWorldTriangleFlightBreakWallConfig
        | TestWorldTrianglePickupConfig
        | null => {
        if (rootId === 'player_spawn') {
            return currentConfig.playerSpawn;
        }
        if (currentConfig.finish?.id === rootId) {
            return currentConfig.finish;
        }

        return currentConfig.surfaces.find((entry) => entry.id === rootId)
            ?? currentConfig.npcs.find((entry) => entry.id === rootId)
            ?? currentConfig.hazards.find((entry) => entry.id === rootId)
            ?? currentConfig.checkpoints.find((entry) => entry.id === rootId)
            ?? currentConfig.movingPlatforms.find((entry) => entry.id === rootId)
            ?? currentConfig.triggerPlatforms.find((entry) => entry.id === rootId)
            ?? currentConfig.triggerVolumes.find((entry) => entry.id === rootId)
            ?? currentConfig.dragBoxes.find((entry) => entry.id === rootId)
            ?? currentConfig.windZones.find((entry) => entry.id === rootId)
            ?? currentConfig.triangleFlightBreakWalls.find((entry) => entry.id === rootId)
            ?? currentConfig.trianglePickups.find((entry) => entry.id === rootId)
            ?? null;
    };

    const collectObjectInteractionCandidateIds = (): string[] => {
        const candidateIds = new Set(
            currentConfig.logic.bindings
                .filter((binding) => (
                    binding.targetType === 'object'
                    && binding.slot.trim() === OBJECT_LOGIC_INTERACTION_SLOT
                    && typeof binding.targetId === 'string'
                    && binding.targetId.trim().length > 0
                ))
                .map((binding) => binding.targetId!.trim())
        );
        return [...candidateIds];
    };

    const collectNpcInteractionCandidateIds = (): string[] => {
        const candidateIds = new Set(
            currentConfig.npcs
                .map((npc) => npc.id.trim())
                .filter((npcId) => npcId.length > 0)
        );
        return [...candidateIds];
    };

    const resolveInteractionTargetBounds = (targetId: string): TestWorldEditorBounds | null => {
        const directHandle = instance.getEditorHandle(targetId);
        if (directHandle) {
            return directHandle.getBounds();
        }
        const fallbackHandle = instance.getEditorHandles().find((entry) => entry.rootId === targetId) ?? null;
        return fallbackHandle?.getBounds() ?? null;
    };

    const tryTriggerObjectLogicInteraction = (): boolean => {
        objectInteractionAttemptId += 1;
        const attemptId = objectInteractionAttemptId;
        const candidateIds = collectObjectInteractionCandidateIds();
        if (candidateIds.length <= 0) {
            lastObjectInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_bindings',
                radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: 0,
                candidates: [],
                message: 'No object interaction candidates were found for onInteract.'
            };
            return false;
        }

        const playerX = player.arcadeBodyObject.x;
        const playerY = player.arcadeBodyObject.y;
        if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
            lastObjectInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_player',
                radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates: candidateIds.map((targetId) => ({
                    targetId,
                    hasFocusPoint: false,
                    inRange: false
                })),
                message: 'Player position is unavailable for object interaction.'
            };
            return false;
        }

        let selectedTargetId: string | null = null;
        let selectedDistancePx = Number.POSITIVE_INFINITY;
        const candidates: ObjectInteractionCandidateTrace[] = [];

        for (const targetId of candidateIds) {
            const bounds = resolveInteractionTargetBounds(targetId);
            if (!bounds) {
                candidates.push({
                    targetId,
                    hasFocusPoint: false,
                    inRange: false
                });
                continue;
            }

            const distancePx = getDistanceToObjectBounds(playerX, playerY, bounds);
            const inRange = distancePx <= OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX;
            candidates.push({
                targetId,
                distancePx: roundDistance(distancePx),
                hasFocusPoint: true,
                inRange
            });
            if (!inRange || distancePx >= selectedDistancePx) {
                continue;
            }
            selectedDistancePx = distancePx;
            selectedTargetId = targetId;
        }

        if (!selectedTargetId) {
            const nearestCandidate = candidates
                .filter((candidate) => typeof candidate.distancePx === 'number')
                .sort((left, right) => (left.distancePx as number) - (right.distancePx as number))[0];
            const nearestSummary = nearestCandidate
                ? ` nearest ${nearestCandidate.targetId} distance ${nearestCandidate.distancePx}px`
                : ' no candidate with focus point';
            lastObjectInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_target_in_range',
                radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates,
                message: `No interaction target in range.${nearestSummary}; radius ${OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX}px.`
            };
            return false;
        }

        const bindingTrace = executeLogicBindingsForEvent(
            currentConfig,
            {
                targetType: 'object',
                targetId: selectedTargetId,
                slot: OBJECT_LOGIC_INTERACTION_SLOT
            },
            createLogicScriptRuntimeContext()
        );
        if (bindingTrace.bindings.length <= 0) {
            lastObjectInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'skipped',
                selectedTargetId,
                selectedDistancePx: roundDistance(selectedDistancePx),
                radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates,
                bindingTrace,
                message: `Target ${selectedTargetId} had no matching onInteract binding at execution time.`
            };
            return false;
        }

        const interactionStatus: ObjectInteractionTraceStatus = bindingTrace.status === 'success'
            ? 'executed'
            : bindingTrace.status;
        const statusMessage = interactionStatus === 'executed'
            ? `Executed onInteract for ${selectedTargetId}.`
            : interactionStatus === 'skipped'
                ? `Interaction skipped for ${selectedTargetId}.`
                : `Interaction execution error for ${selectedTargetId}.`;
        lastObjectInteractionTrace = {
            attempted: true,
            attemptId,
            status: interactionStatus,
            selectedTargetId,
            selectedDistancePx: roundDistance(selectedDistancePx),
            radiusPx: OBJECT_LOGIC_INTERACTION_MAX_DISTANCE_PX,
            candidateCount: candidateIds.length,
            candidates,
            bindingTrace,
            message: statusMessage
        };
        return true;
    };

    const tryTriggerNpcLogicInteraction = (): boolean => {
        npcInteractionAttemptId += 1;
        const attemptId = npcInteractionAttemptId;
        const candidateIds = collectNpcInteractionCandidateIds();
        if (candidateIds.length <= 0) {
            lastNpcInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_bindings',
                radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: 0,
                candidates: [],
                message: 'No NPC instances were found for onInteract.'
            };
            return false;
        }

        const playerX = player.arcadeBodyObject.x;
        const playerY = player.arcadeBodyObject.y;
        if (!Number.isFinite(playerX) || !Number.isFinite(playerY)) {
            lastNpcInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_player',
                radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates: candidateIds.map((targetId) => ({
                    targetId,
                    hasFocusPoint: false,
                    inRange: false
                })),
                message: 'Player position is unavailable for NPC interaction.'
            };
            return false;
        }

        let selectedTargetId: string | null = null;
        let selectedDistancePx = Number.POSITIVE_INFINITY;
        const candidates: NpcInteractionCandidateTrace[] = [];

        for (const targetId of candidateIds) {
            const bounds = resolveInteractionTargetBounds(targetId);
            if (!bounds) {
                candidates.push({
                    targetId,
                    hasFocusPoint: false,
                    inRange: false
                });
                continue;
            }

            const distancePx = getDistanceToObjectBounds(playerX, playerY, bounds);
            const inRange = distancePx <= NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX;
            candidates.push({
                targetId,
                distancePx: roundDistance(distancePx),
                hasFocusPoint: true,
                inRange
            });
            if (!inRange || distancePx >= selectedDistancePx) {
                continue;
            }
            selectedDistancePx = distancePx;
            selectedTargetId = targetId;
        }

        if (!selectedTargetId) {
            const nearestCandidate = candidates
                .filter((candidate) => typeof candidate.distancePx === 'number')
                .sort((left, right) => (left.distancePx as number) - (right.distancePx as number))[0];
            const nearestSummary = nearestCandidate
                ? ` nearest ${nearestCandidate.targetId} distance ${nearestCandidate.distancePx}px`
                : ' no candidate with focus point';
            lastNpcInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'no_target_in_range',
                radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates,
                message: `No NPC interaction target in range.${nearestSummary}; radius ${NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX}px.`
            };
            return false;
        }

        const executeNpcDefaultAction = (targetId: string): NpcDefaultActionTrace => {
            const selectedNpc = currentConfig.npcs.find((entry) => entry.id === targetId) ?? null;
            const scriptId = typeof selectedNpc?.behaviorScripts?.defaultAction === 'string'
                ? selectedNpc.behaviorScripts.defaultAction.trim()
                : '';
            if (scriptId.length <= 0) {
                return {
                    scriptId: null,
                    status: 'skipped',
                    reason: 'no behaviorScripts.defaultAction assigned',
                    commands: []
                };
            }

            const script = getLogicScriptAsset(scriptId);
            if (!script) {
                return {
                    scriptId,
                    status: 'error',
                    reason: `missing defaultAction script "${scriptId}"`,
                    commands: []
                };
            }

            if (script.category !== 'npc.action') {
                return {
                    scriptId,
                    status: 'error',
                    reason: `defaultAction script "${scriptId}" has category "${script.category}", expected "npc.action"`,
                    commands: []
                };
            }

            const result: LogicScriptExecutionResult = executeLogicScriptForWorldOnStart(
                script,
                createLogicScriptRuntimeContext()
            );
            return {
                scriptId,
                status: result.status,
                reason: result.status === 'error'
                    ? 'script execution error'
                    : result.status === 'skipped'
                        ? 'script execution skipped'
                        : undefined,
                commands: result.commands
            };
        };

        const bindingTrace = executeLogicBindingsForEvent(
            currentConfig,
            {
                targetType: 'npc',
                targetId: selectedTargetId,
                slot: NPC_LOGIC_INTERACTION_SLOT
            },
            createLogicScriptRuntimeContext()
        );
        if (bindingTrace.bindings.length > 0) {
            const interactionStatus: NpcInteractionTraceStatus = bindingTrace.status === 'success'
                ? 'executed'
                : bindingTrace.status;
            const selectedNpc = currentConfig.npcs.find((entry) => entry.id === selectedTargetId) ?? null;
            const assignedDefaultAction = typeof selectedNpc?.behaviorScripts?.defaultAction === 'string'
                ? selectedNpc.behaviorScripts.defaultAction.trim()
                : '';
            const statusMessage = interactionStatus === 'executed'
                ? (assignedDefaultAction.length > 0
                    ? `Executed explicit npc/onInteract for ${selectedTargetId}; behaviorScripts.defaultAction "${assignedDefaultAction}" was not run.`
                    : `Executed explicit npc/onInteract for ${selectedTargetId}.`)
                : interactionStatus === 'skipped'
                    ? `Explicit npc/onInteract skipped for ${selectedTargetId}; behaviorScripts.defaultAction was not run because explicit binding takes precedence.`
                    : `Explicit npc/onInteract execution error for ${selectedTargetId}; behaviorScripts.defaultAction was not run because explicit binding takes precedence.`;
            lastNpcInteractionTrace = {
                attempted: true,
                attemptId,
                status: interactionStatus,
                selectedTargetId,
                selectedDistancePx: roundDistance(selectedDistancePx),
                radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates,
                bindingTrace,
                message: statusMessage
            };
            return true;
        }

        const defaultActionTrace = executeNpcDefaultAction(selectedTargetId);
        if (defaultActionTrace.scriptId === null) {
            lastNpcInteractionTrace = {
                attempted: true,
                attemptId,
                status: 'skipped',
                selectedTargetId,
                selectedDistancePx: roundDistance(selectedDistancePx),
                radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
                candidateCount: candidateIds.length,
                candidates,
                bindingTrace,
                defaultActionTrace,
                message: `Nearest NPC ${selectedTargetId} had no explicit npc/onInteract binding or behaviorScripts.defaultAction.`
            };
            return false;
        }

        const interactionStatus: NpcInteractionTraceStatus = defaultActionTrace.status === 'success'
            ? 'executed'
            : defaultActionTrace.status;
        const statusMessage = interactionStatus === 'executed'
            ? `Executed behaviorScripts.defaultAction "${defaultActionTrace.scriptId}" for ${selectedTargetId}.`
            : interactionStatus === 'skipped'
                ? `behaviorScripts.defaultAction "${defaultActionTrace.scriptId}" skipped for ${selectedTargetId}.`
                : `behaviorScripts.defaultAction "${defaultActionTrace.scriptId}" execution error for ${selectedTargetId}.`;
        lastNpcInteractionTrace = {
            attempted: true,
            attemptId,
            status: interactionStatus,
            selectedTargetId,
            selectedDistancePx: roundDistance(selectedDistancePx),
            radiusPx: NPC_LOGIC_INTERACTION_MAX_DISTANCE_PX,
            candidateCount: candidateIds.length,
            candidates,
            bindingTrace,
            defaultActionTrace,
            message: statusMessage
        };
        return true;
    };

    const executeCutsceneLogicOnFinish = (cutsceneId: string): LogicBindingEventTrace => {
        const normalizedCutsceneId = cutsceneId.trim();
        const bindingTrace = executeLogicBindingsForEvent(
            currentConfig,
            {
                targetType: 'cutscene',
                targetId: normalizedCutsceneId,
                slot: CUTSCENE_LOGIC_ON_FINISH_SLOT
            },
            createLogicScriptRuntimeContext()
        );
        cutsceneLogicAttemptId += 1;
        const message = bindingTrace.bindings.length <= 0
            ? `No matching cutscene/${CUTSCENE_LOGIC_ON_FINISH_SLOT} bindings.`
            : bindingTrace.status === 'success'
                ? `Executed cutscene/${CUTSCENE_LOGIC_ON_FINISH_SLOT} bindings.`
                : bindingTrace.status === 'error'
                    ? `Cutscene/${CUTSCENE_LOGIC_ON_FINISH_SLOT} binding execution failed.`
                    : `Cutscene/${CUTSCENE_LOGIC_ON_FINISH_SLOT} binding execution skipped.`;
        lastCutsceneLogicTrace = {
            attemptId: cutsceneLogicAttemptId,
            cutsceneId: normalizedCutsceneId,
            slot: CUTSCENE_LOGIC_ON_FINISH_SLOT,
            status: bindingTrace.status,
            bindingTrace,
            message
        };
        return bindingTrace;
    };

    return {
        get hazards(): readonly HazardObject[] {
            return instance.hazards;
        },
        updateMovingPlatforms: (deltaMs: number): void => {
            instance.updateMovingPlatforms(deltaMs);
        },
        updateNpcs: (deltaMs: number): void => {
            instance.updateNpcs(deltaMs);
        },
        updateNpcInteractionTarget: (): void => {
            instance.updateNpcInteractionTarget();
        },
        tryTriggerObjectLogicInteraction: (): boolean => {
            return tryTriggerObjectLogicInteraction();
        },
        tryTriggerNpcLogicInteraction: (): boolean => {
            return tryTriggerNpcLogicInteraction();
        },
        tryTriggerNpcInteraction: (): void => {
            instance.tryTriggerNpcInteraction();
        },
        syncNpcTriangleSupportSurfaces: (): void => {
            instance.syncNpcTriangleSupportSurfaces();
        },
        postPlayerTickUpdate: (): void => {
            instance.postPlayerTickUpdate();
        },
        resetRespawnObjects: (): void => {
            instance.resetRespawnObjects();
        },
        syncPlayerCollisionMode: (): void => {
            useArcadePlatformCollisions = player.currentForm !== 'triangle';
            instance.syncPlayerCollisionMode(useArcadePlatformCollisions);
        },
        consumeFinishReached: (): boolean => {
            return instance.consumeFinishReached();
        },
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            return instance.resolveWindInfluenceX(playerObject);
        },
        getWorldBounds: (): TestWorldBoundsConfig => ({ ...currentConfig.worldBounds }),
        getLevelId: (): string => currentConfig.meta.id,
        getNextLevelId: (): string | null => currentConfig.nextLevelId,
        getNpcDebugEntries: (): readonly TestNpcDebugEntry[] => instance.getNpcDebugEntries(),
        getNpcInteractionDebugState: (): TestNpcInteractionDebugState => instance.getNpcInteractionDebugState(),
        setNpcControlMode: (actorId: string, mode: TestNpcControlMode, controlledBy?: string): boolean => (
            instance.setNpcControlMode(actorId, mode, controlledBy)
        ),
        clearNpcControlMode: (actorId: string): boolean => instance.clearNpcControlMode(actorId),
        dispatchWorldLogicEvent: (event: TestWorldLogicEvent): boolean => instance.dispatchWorldLogicEvent(event),
        dispatchCutsceneActorSequenceRef: (
            actorId: string,
            sequenceRef: string,
            cutsceneRef: string,
            stepRef: string
        ) => instance.dispatchCutsceneActorSequenceRef(actorId, sequenceRef, cutsceneRef, stepRef),
        dispatchCutsceneSetEmotion: (
            actorId: string,
            emotionId: string
        ) => instance.dispatchCutsceneSetEmotion(actorId, emotionId),
        getCutsceneActorSequenceSnapshot: (actorId: string): TestNpcCutsceneSequenceSnapshot | null => (
            instance.getCutsceneActorSequenceSnapshot(actorId)
        ),
        getNpcCameraFocusObject: (actorId: string): GameObjects.Container | null => (
            instance.getNpcCameraFocusObject(actorId)
        ),
        getNpcActorBounds: (actorId: string): { x: number; y: number; width: number; height: number } | null => (
            instance.getNpcActorBounds(actorId)
        ),
        executeCutsceneLogicOnFinish,
        getWorldOnStartLogicTrace: (): LogicWorldOnStartTrace | null => {
            if (!lastWorldOnStartLogicTrace) {
                return null;
            }
            return cloneWorldOnStartLogicTrace(lastWorldOnStartLogicTrace);
        },
        getRuntimeWorldFlagsSnapshot: (): Record<string, boolean> => ({
            ...getWorldFlagsDebugSnapshot()
        }),
        getLastObjectInteractionTrace: (): ObjectInteractionTrace => {
            return cloneObjectInteractionTrace(lastObjectInteractionTrace);
        },
        getLastNpcInteractionTrace: (): NpcInteractionTrace => {
            return cloneNpcInteractionTrace(lastNpcInteractionTrace);
        },
        getLastCutsceneLogicTrace: (): CutsceneLogicTrace | null => {
            if (!lastCutsceneLogicTrace) {
                return null;
            }
            return cloneCutsceneLogicTrace(lastCutsceneLogicTrace);
        },
        getLastTriggerOnEnterLogicTrace: (): TriggerOnEnterLogicTrace | null => {
            if (!lastTriggerOnEnterLogicTrace) {
                return null;
            }
            return cloneTriggerOnEnterLogicTrace(lastTriggerOnEnterLogicTrace);
        },
        getSurfaceMoveRuntimeDebugSnapshot: (): SurfaceMoveRuntimeDebugSnapshot => {
            return instance.getSurfaceMoveRuntimeDebugSnapshot();
        },
        getNpcPatrolRuntimeDebugSnapshot: (): NpcPatrolRuntimeDebugSnapshot => {
            return instance.getNpcPatrolRuntimeDebugSnapshot();
        },
        getConfig: (): TestWorldConfig => cloneTestWorldConfig(currentConfig),
        setConfig: (config: TestWorldConfig): void => {
            currentConfig = normalizeRuntimeSetConfig(config, currentConfig);
            rebuildFromCurrentConfig();
        },
        replaceConfig: (
            config: unknown,
            options?: { mode?: 'runtime_patch' | 'full_import' }
        ): { success: boolean; reason?: string } => {
            const result = normalizeRuntimeReplaceConfig(config, currentConfig, options);
            if (!result.success) {
                return { success: false, reason: result.reason };
            }
            currentConfig = result.nextConfig;
            rebuildFromCurrentConfig();
            return { success: true };
        },
        getEditorHandles: (): readonly TestWorldEditorHandle[] => instance.getEditorHandles(),
        getEditorObjects: (): readonly TestWorldEditorObjectSummary[] => instance.getEditorObjects(),
        getEditorHandle: (id: string): TestWorldEditorHandle | null => instance.getEditorHandle(id),
        patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds): boolean => {
            return instance.patchObjectBounds(handleId, bounds);
        },
        patchObjectFields: (rootId: string, patch: Record<string, unknown>): boolean => {
            return instance.patchObjectFields(rootId, patch);
        },
        patchNpcFields: (id: string, patch: Record<string, unknown>): boolean => {
            return instance.patchNpcFields(id, patch);
        },
        patchObjectColors: (rootId: string, patch: Record<string, unknown>): boolean => {
            return instance.patchObjectColors(rootId, patch);
        },
        patchObjectDebugVisibility: (rootId: string, onlyDebugView: boolean): boolean => {
            return instance.patchObjectDebugVisibility(rootId, onlyDebugView);
        },
        setEditorDebugViewActive: (active: boolean): void => {
            editorDebugViewActive = active;
            instance.setEditorDebugViewActive(active);
        },
        setSurfaceMoveRuntimeEditingActive: (surfaceId: string, active: boolean): boolean => {
            return instance.setSurfaceMoveRuntimeEditingActive(surfaceId, active);
        },
        setObjectLocked: (rootId: string, locked: boolean): boolean => {
            return instance.setObjectLocked(rootId, locked);
        },
        createObject: (type: TestWorldEditorObjectType, worldX: number, worldY: number): string | null => {
            if (type === 'playerSpawn') {
                currentConfig.playerSpawn.x = worldX;
                currentConfig.playerSpawn.y = worldY;
                instance.patchObjectFields('player_spawn', { x: worldX, y: worldY });
                return 'player_spawn';
            }
            if (type === 'finish') {
                if (currentConfig.finish) {
                    return currentConfig.finish.id;
                }
                const nextId = createNextWorldObjectId(type, currentConfig);
                const nextObject = TEST_WORLD_EDITOR_ADAPTERS.finish.createDefault({ id: nextId, x: worldX, y: worldY });
                if (!nextObject) {
                    return null;
                }
                currentConfig.finish = nextObject;
                rebuildFromCurrentConfig();
                return nextId;
            }

            const nextId = createNextWorldObjectId(type, currentConfig);
            const configFactory = TEST_WORLD_EDITOR_ADAPTERS[type];
            const nextObject = configFactory.createDefault({ id: nextId, x: worldX, y: worldY });
            if (nextObject === null) {
                return null;
            }

            if (type === 'surface') {
                currentConfig.surfaces.push(nextObject as TestWorldSurfaceConfig);
            } else if (type === 'npc') {
                currentConfig.npcs.push(nextObject as TestNpcInstanceConfig);
            } else if (type === 'hazard') {
                currentConfig.hazards.push(nextObject as TestWorldHazardConfig);
            } else if (type === 'checkpoint') {
                currentConfig.checkpoints.push(nextObject as TestWorldCheckpointConfig);
            } else if (type === 'movingPlatform') {
                currentConfig.movingPlatforms.push(nextObject as TestWorldMovingPlatformConfig);
            } else if (type === 'triggerPlatform') {
                currentConfig.triggerPlatforms.push(nextObject as TestWorldTriggerPlatformConfig);
            } else if (type === 'triggerVolume') {
                currentConfig.triggerVolumes.push(nextObject as TestWorldTriggerVolumeConfig);
            } else if (type === 'dragBox') {
                currentConfig.dragBoxes.push(nextObject as TestWorldDragBoxConfig);
            } else if (type === 'windZone') {
                currentConfig.windZones.push(nextObject as TestWorldWindZoneConfig);
            } else if (type === 'triangleFlightBreakWall') {
                currentConfig.triangleFlightBreakWalls.push(nextObject as TestWorldTriangleFlightBreakWallConfig);
            } else if (type === 'trianglePickup') {
                currentConfig.trianglePickups.push(nextObject as TestWorldTrianglePickupConfig);
            } else {
                return null;
            }

            rebuildFromCurrentConfig();
            return nextId;
        },
        duplicateObject: (rootId: string): string | null => {
            if (rootId === 'player_spawn' || currentConfig.finish?.id === rootId) {
                return null;
            }

            const source = findRootConfigById(rootId);
            if (!source) {
                return null;
            }

            const binding = instance.getEditorObjects().find((entry) => entry.id === rootId);
            if (!binding) {
                return null;
            }

            const nextId = createNextWorldObjectId(binding.type, currentConfig);
            const adapter = TEST_WORLD_EDITOR_ADAPTERS[binding.type];
            const duplicated = adapter.duplicate(source as never, nextId) as never;
            if (binding.type === 'surface' || binding.type === 'hazard' || binding.type === 'checkpoint' || binding.type === 'movingPlatform'
                || binding.type === 'dragBox' || binding.type === 'windZone' || binding.type === 'triangleFlightBreakWall') {
                const rectLike = duplicated as { x: number; y: number };
                adapter.patchFields(duplicated, { x: rectLike.x + 24, y: rectLike.y + 24 });
            } else if (binding.type === 'npc') {
                const npc = duplicated as TestNpcInstanceConfig;
                adapter.patchFields(duplicated, { x: npc.x + 24, y: npc.y });
            } else if (binding.type === 'trianglePickup') {
                const pickup = duplicated as TestWorldTrianglePickupConfig;
                adapter.patchFields(duplicated, { x: pickup.x + 24, y: pickup.y + 24 });
            } else if (binding.type === 'triggerPlatform') {
                const triggerPlatform = duplicated as TestWorldTriggerPlatformConfig;
                adapter.patchFields(duplicated, {
                    triggerX: triggerPlatform.triggerX + 24,
                    triggerY: triggerPlatform.triggerY + 24,
                    deactivateTriggerX: (triggerPlatform.deactivateTriggerX ?? triggerPlatform.triggerX) + 24,
                    deactivateTriggerY: (triggerPlatform.deactivateTriggerY ?? triggerPlatform.triggerY) + 24,
                    platformX: triggerPlatform.platformX + 24,
                    platformY: triggerPlatform.platformY + 24
                });
            } else if (binding.type === 'triggerVolume') {
                const triggerVolume = duplicated as TestWorldTriggerVolumeConfig;
                adapter.patchFields(duplicated, {
                    triggerX: triggerVolume.triggerX + 24,
                    triggerY: triggerVolume.triggerY + 24,
                    deactivateTriggerX: (triggerVolume.deactivateTriggerX ?? triggerVolume.triggerX) + 24,
                    deactivateTriggerY: (triggerVolume.deactivateTriggerY ?? triggerVolume.triggerY) + 24
                });
            }

            if (binding.type === 'surface') {
                currentConfig.surfaces.push(duplicated as TestWorldSurfaceConfig);
            } else if (binding.type === 'npc') {
                currentConfig.npcs.push(duplicated as TestNpcInstanceConfig);
            } else if (binding.type === 'hazard') {
                currentConfig.hazards.push(duplicated as TestWorldHazardConfig);
            } else if (binding.type === 'checkpoint') {
                currentConfig.checkpoints.push(duplicated as TestWorldCheckpointConfig);
            } else if (binding.type === 'movingPlatform') {
                currentConfig.movingPlatforms.push(duplicated as TestWorldMovingPlatformConfig);
            } else if (binding.type === 'triggerPlatform') {
                currentConfig.triggerPlatforms.push(duplicated as TestWorldTriggerPlatformConfig);
            } else if (binding.type === 'triggerVolume') {
                currentConfig.triggerVolumes.push(duplicated as TestWorldTriggerVolumeConfig);
            } else if (binding.type === 'dragBox') {
                currentConfig.dragBoxes.push(duplicated as TestWorldDragBoxConfig);
            } else if (binding.type === 'windZone') {
                currentConfig.windZones.push(duplicated as TestWorldWindZoneConfig);
            } else if (binding.type === 'triangleFlightBreakWall') {
                currentConfig.triangleFlightBreakWalls.push(duplicated as TestWorldTriangleFlightBreakWallConfig);
            } else if (binding.type === 'trianglePickup') {
                currentConfig.trianglePickups.push(duplicated as TestWorldTrianglePickupConfig);
            } else {
                return null;
            }

            rebuildFromCurrentConfig();
            return nextId;
        },
        removeObject: (rootId: string): boolean => {
            const removed = removeByRootId(rootId);
            if (removed) {
                rebuildFromCurrentConfig();
            }
            return removed;
        },
        focusObjectPoint: (targetId: string): { x: number; y: number } | null => {
            return instance.focusObjectPoint(targetId);
        },
        rebuildFromCurrentConfig,
        setEventDebugSink: (sink): void => {
            currentEventDebugSink = sink;
        },
        destroy: (): void => {
            instance.destroy();
        }
    };
};

const buildWorldInstance = (
    scene: Scene,
    player: PlayerWorldActor,
    onCheckpointActivated: (point: RespawnPoint) => void,
    config: TestWorldConfig,
    useArcadePlatformCollisions: boolean,
    eventDebugSink?: TestWorldDebugEventSink,
    onTriggerEnterLogic?: (triggerId: string, sourceId: string) => void
): BuiltWorldInstance => {
    let editorDebugViewActive = false;
    applyWorldBounds(scene, config.worldBounds);
    const cleanup: Array<() => void> = [];
    const hazards: HazardObject[] = [];
    const movingPlatforms: MovingPlatformObject[] = [];
    const dragBoxes: DraggableBoxObject[] = [];
    const triggerPlatforms: TriggerPlatformObject[] = [];
    const triggerVolumes: TriggerVolumeObject[] = [];
    const windZones: WindZoneObject[] = [];
    const triangleFlightBreakWalls: TriangleFlightBreakWallObject[] = [];
    const trianglePickups: TriangleFlightPickupObject[] = [];
    const surfaces = new Map<string, Phaser.GameObjects.Rectangle>();
    const surfaceMoveAssignmentsById = new Map<string, SurfaceMoveRuntimeAssignment>();
    const movingSurfaceStatesById = new Map<string, SurfaceMoveRuntimeState>();
    const surfaceMoveEditingActiveIds = new Set<string>();
    const pendingSurfaceMoveScriptLoadIds = new Set<string>();
    let surfaceMoveUpdateFrame = 0;
    let surfaceMoveVisitedThisFrame = 0;
    const checkpointsById = new Map<string, CheckpointObject>();
    const movingPlatformsById = new Map<string, MovingPlatformObject>();
    const dragBoxesById = new Map<string, DraggableBoxObject>();
    const triggerPlatformsById = new Map<string, TriggerPlatformObject>();
    const triggerVolumesById = new Map<string, TriggerVolumeObject>();
    const windZonesById = new Map<string, WindZoneObject>();
    const windZoneDecorationObjectsById = new Map<string, Phaser.GameObjects.GameObject[]>();
    const triangleFlightBreakWallsById = new Map<string, TriangleFlightBreakWallObject>();
    const pickupsById = new Map<string, TriangleFlightPickupObject>();
    const pickupDecorationObjectsById = new Map<string, Phaser.GameObjects.GameObject[]>();
    const bindings = new Map<string, RuntimeBinding>();
    const handleMap = new Map<string, TestWorldEditorHandle>();
    const objectSummaries: TestWorldEditorObjectSummary[] = [];
    const dragBoxWorldColliders: Physics.Arcade.Collider[] = [];
    const playerDragBoxColliders: Physics.Arcade.Collider[] = [];
    const overlapColliders: Physics.Arcade.Collider[] = [];
    const pickupOverlapColliders = new Map<string, Physics.Arcade.Collider>();
    let activeCheckpointId = config.checkpoints[0]?.id ?? null;
    let finishReached = false;
    let wasTriangleGrounded = false;
    let finishTriggerObject: FinishTriggerObject | null = null;
    const consumedWorldRuleOnceKeys = new Set<string>();
    const MAX_WORLD_LOGIC_DISPATCH_DEPTH = 8;
    let worldLogicDispatchDepth = 0;
    const surfaceOutlineRenderer = createTestWorldSurfaceOutlineRenderer(scene, config.surfaces, {
        resolveRuntimeBounds: (surfaceId) => {
            const surface = surfaces.get(surfaceId);
            if (!surface) {
                return null;
            }
            return {
                x: surface.x,
                y: surface.y,
                width: surface.width,
                height: surface.height
            };
        }
    });

    const addCleanup = (cleanupFn: () => void): void => {
        cleanup.push(cleanupFn);
    };
    addCleanup(() => surfaceOutlineRenderer.destroy());

    config.surfaces.forEach((surfaceConfig) => {
        const assignment = resolveSurfaceMoveRuntimeAssignment(surfaceConfig);
        if (assignment) {
            surfaceMoveAssignmentsById.set(surfaceConfig.id, assignment);
        }
    });

    const resolveAndStoreSurfaceMoveAssignment = (
        surfaceConfig: TestWorldSurfaceConfig
    ): SurfaceMoveRuntimeAssignment | null => {
        const assignment = resolveSurfaceMoveRuntimeAssignment(surfaceConfig);
        if (assignment) {
            surfaceMoveAssignmentsById.set(surfaceConfig.id, assignment);
            return assignment;
        }
        surfaceMoveAssignmentsById.delete(surfaceConfig.id);
        return null;
    };

    const dispatchWorldLogicEvent = (event: TestWorldLogicEvent): boolean => {
        if (!event || typeof event !== 'object' || typeof event.kind !== 'string') {
            return false;
        }
        if (worldLogicDispatchDepth >= MAX_WORLD_LOGIC_DISPATCH_DEPTH) {
            return false;
        }

        const eventRuntimeContext: TestEventRuntimeContext = {
            getWorldFlag: (flagId) => getWorldFlag(flagId),
            setWorldFlag: (flagId, value) => {
                setWorldFlag(flagId, value);
            },
            getPlayerFormId: () => player.currentForm,
            executeActorAction: (actorId, action) => {
                if (action.kind === 'set_emotion') {
                    return npcRuntime.setPresentationEmotionFromTrigger(actorId, action.emotionId);
                }
                if (action.kind === 'trigger_event') {
                    return dispatchTriggerEvent(action.eventId, action.payload, actorId);
                }
                return false;
            },
            startCutscene: (cutsceneRef) => {
                const normalizedCutsceneRef = cutsceneRef.trim();
                if (normalizedCutsceneRef.length <= 0 || !isKnownConfigCutsceneId(normalizedCutsceneRef)) {
                    return false;
                }
                scene.events.emit('pf:npc_interaction_cutscene_request', {
                    actorId: 'world_logic_rule_runtime',
                    cutsceneRef: normalizedCutsceneRef
                });
                return true;
            },
            dispatchTriggerEvent: (eventId, payload) => dispatchTriggerEvent(eventId, payload, 'world_logic_rule_runtime'),
            playSfx: (sfxId) => {
                const normalizedSfxId = sfxId.trim();
                if (normalizedSfxId.length <= 0) {
                    return false;
                }
                scene.events.emit('pf:test_world_play_sfx_stub', {
                    source: 'world_logic_rule_runtime',
                    sfxId: normalizedSfxId
                });
                return true;
            },
            spawnVfx: (vfxId, actorId, x, y) => {
                const normalizedVfxId = vfxId.trim();
                if (normalizedVfxId.length <= 0) {
                    return false;
                }
                scene.events.emit('pf:test_world_spawn_vfx_stub', {
                    source: 'world_logic_rule_runtime',
                    vfxId: normalizedVfxId,
                    actorId: actorId ?? null,
                    x: typeof x === 'number' ? x : null,
                    y: typeof y === 'number' ? y : null
                });
                return true;
            },
            isOnceConsumed: (key) => consumedWorldRuleOnceKeys.has(key),
            consumeOnceKey: (key) => {
                consumedWorldRuleOnceKeys.add(key);
            }
        };

        worldLogicDispatchDepth += 1;
        try {
            emitWorldEventDebug(eventDebugSink, event);
            executeMatchingWorldLogicRules(eventRuntimeContext, config.worldLogicRules, event, eventDebugSink);
        } finally {
            worldLogicDispatchDepth = Math.max(0, worldLogicDispatchDepth - 1);
        }
        return true;
    };

    const dispatchTriggerEvent = (
        eventId: string,
        payload?: Record<string, unknown>,
        sourceId: string = 'trigger_runtime'
    ): boolean => {
        const normalizedEventId = eventId.trim();
        if (normalizedEventId.length <= 0) {
            return false;
        }
        dispatchWorldLogicEvent({
            kind: 'trigger_event',
            eventId: normalizedEventId,
            sourceId,
            payload
        });
        scene.events.emit('pf:npc_actor_action_event', {
            actorId: sourceId,
            eventId: normalizedEventId,
            payload
        });
        return true;
    };

    const destroyColliderList = (colliders: Physics.Arcade.Collider[]): void => {
        const seen = new Set<Physics.Arcade.Collider>();
        for (const collider of colliders) {
            if (!collider) {
                continue;
            }
            if (seen.has(collider)) {
                continue;
            }
            seen.add(collider);
            try {
                const maybeCollider = collider as Physics.Arcade.Collider & { world?: unknown };
                if (!maybeCollider.world) {
                    continue;
                }
                collider.destroy();
            } catch (error) {
                console.warn('[test_world_runtime] Failed to destroy collider during rebuild', error);
            }
        }
        colliders.length = 0;
    };

    const actorContactRuntime = createTestWorldActorContactRuntime({
        scene,
        getSolidSurfaces: () => {
            return config.surfaces
                .filter((surfaceConfig) => isSurfaceSolid(surfaceConfig))
                .map((surfaceConfig) => surfaces.get(surfaceConfig.id))
                .filter((surface): surface is Phaser.GameObjects.Rectangle => surface !== undefined);
        },
        getMovingPlatformBodies: () => movingPlatforms.map((entry) => entry.bodyObject),
        getTriggerPlatformBodies: () => triggerPlatforms.map((entry) => entry.platformBodyObject),
        getBreakWallBodies: () => triangleFlightBreakWalls.map((entry) => entry.bodyObject)
    });
    addCleanup(() => actorContactRuntime.destroy());
    actorContactRuntime.registerActor({
        actorId: TEST_WORLD_PLAYER_ACTOR_ID,
        kind: 'player',
        bodyObject: player.arcadeBodyObject,
        body: player.arcadeBodyObject.body as Physics.Arcade.Body,
        getContactShapeSnapshot: () => player.contactShapeSnapshot,
        getWorldContactSnapshot: () => player.worldContactSnapshot,
        applyContactPush: (deltaX, deltaY) => player.applyActorContactPush(deltaX, deltaY),
        worldCollisionEnabled: useArcadePlatformCollisions
    });

    const npcWorldCollisionRuntime: TestNpcWorldCollisionRuntime = {
        registerActor: actorContactRuntime.registerActor,
        getContactSnapshot: actorContactRuntime.getContactSnapshot
    };

    const rebuildDragBoxWorldColliders = (): void => {
        destroyColliderList(dragBoxWorldColliders);
        dragBoxes.forEach((dragBox) => {
            surfaces.forEach((surface, id) => {
                const surfaceConfig = config.surfaces.find((entry) => entry.id === id);
                if (!surfaceConfig || !isSurfaceSolid(surfaceConfig)) {
                    return;
                }
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, surface));
            });
            movingPlatforms.forEach((platform) => {
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, platform.bodyObject));
            });
            triggerPlatforms.forEach((platform) => {
                dragBoxWorldColliders.push(scene.physics.add.collider(dragBox.bodyObject, platform.platformBodyObject));
            });
        });
    };

    const rebuildPlayerDragBoxColliders = (): void => {
        destroyColliderList(playerDragBoxColliders);
        dragBoxes.forEach((dragBox) => {
            const collider = scene.physics.add.collider(player.arcadeBodyObject, dragBox.bodyObject);
            collider.active = useArcadePlatformCollisions;
            playerDragBoxColliders.push(collider);
        });
    };

    const refreshVisualDepths = (): void => {
        const entries: TestWorldVisualDepthEntry[] = [];
        const applyDebugOnlyVisibility = (
            visualConfig: { onlyDebugView?: boolean },
            gameObject: Phaser.GameObjects.GameObject | null | undefined
        ): void => {
            if (!gameObject) {
                return;
            }
            gameObject.setVisible(!(visualConfig.onlyDebugView ?? false) || editorDebugViewActive);
        };
        const pushEntry = (
            objectType: TestWorldEditorObjectType,
            visualConfig: {
                id: string;
                visualLayer?: TestWorldSurfaceConfig['visualLayer'];
                renderOrder?: TestWorldSurfaceConfig['renderOrder'];
                onlyDebugView?: boolean;
            },
            partKey: string,
            gameObject: Phaser.GameObjects.GameObject | null | undefined,
            partOrder: number = 0
        ): void => {
            if (!gameObject) {
                return;
            }
            applyDebugOnlyVisibility(visualConfig, gameObject);
            entries.push({
                gameObject,
                objectType,
                config: visualConfig,
                partKey,
                partOrder
            });
        };

        if (config.finish) {
            pushEntry('finish', config.finish, 'trigger', finishTriggerObject?.trigger, 0);
        }

        surfaces.forEach((surface, id) => {
            const surfaceConfig = config.surfaces.find((entry) => entry.id === id);
            if (surfaceConfig) {
                pushEntry('surface', surfaceConfig, 'body', surface, 0);
            }
        });

        config.npcs.forEach((npcConfig) => {
            const npcVisual = npcRuntime.getVisualObject(npcConfig.id);
            if (npcVisual) {
                pushEntry('npc', npcConfig, 'visual', npcVisual, 0);
            }
        });

        hazards.forEach((hazard, index) => {
            const hazardConfig = config.hazards[index];
            if (hazardConfig) {
                pushEntry('hazard', hazardConfig, 'trigger', hazard.trigger, 0);
            }
        });

        config.checkpoints.forEach((checkpointConfig) => {
            const checkpoint = checkpointsById.get(checkpointConfig.id);
            if (!checkpoint) {
                return;
            }
            pushEntry('checkpoint', checkpointConfig, 'trigger', checkpoint.trigger, 0);
            pushEntry('checkpoint', checkpointConfig, 'beacon', checkpoint.beacon, 1);
        });

        config.movingPlatforms.forEach((platformConfig) => {
            const platform = movingPlatformsById.get(platformConfig.id);
            if (platform) {
                pushEntry('movingPlatform', platformConfig, 'body', platform.bodyObject, 0);
            }
        });

        config.dragBoxes.forEach((dragBoxConfig) => {
            const dragBox = dragBoxesById.get(dragBoxConfig.id);
            if (dragBox) {
                pushEntry('dragBox', dragBoxConfig, 'body', dragBox.bodyObject, 0);
            }
        });

        config.triggerPlatforms.forEach((triggerConfig) => {
            const triggerPlatform = triggerPlatformsById.get(triggerConfig.id);
            if (!triggerPlatform) {
                return;
            }
            pushEntry('triggerPlatform', triggerConfig, 'trigger', triggerPlatform.triggerZone, 0);
            pushEntry('triggerPlatform', triggerConfig, 'deactivate', triggerPlatform.deactivateTriggerZone, 1);
            pushEntry('triggerPlatform', triggerConfig, 'platform', triggerPlatform.platformBodyObject, 2);
        });

        config.triggerVolumes.forEach((triggerVolumeConfig) => {
            const triggerVolume = triggerVolumesById.get(triggerVolumeConfig.id);
            if (!triggerVolume) {
                return;
            }
            pushEntry('triggerVolume', triggerVolumeConfig, 'trigger', triggerVolume.triggerZone, 0);
            pushEntry('triggerVolume', triggerVolumeConfig, 'deactivate', triggerVolume.deactivateTriggerZone, 1);
        });

        config.windZones.forEach((windZoneConfig) => {
            const windZone = windZonesById.get(windZoneConfig.id);
            if (!windZone) {
                return;
            }
            pushEntry('windZone', windZoneConfig, 'trigger', windZone.trigger, 0);
            (windZoneDecorationObjectsById.get(windZoneConfig.id) ?? []).forEach((gameObject, index) => {
                pushEntry('windZone', windZoneConfig, `decoration_${index}`, gameObject, index + 1);
            });
        });

        config.triangleFlightBreakWalls.forEach((wallConfig) => {
            const wall = triangleFlightBreakWallsById.get(wallConfig.id);
            if (!wall || wall.isBroken()) {
                return;
            }
            pushEntry('triangleFlightBreakWall', wallConfig, 'body', wall.bodyObject, 0);
        });

        config.trianglePickups.forEach((pickupConfig) => {
            const pickup = pickupsById.get(pickupConfig.id);
            if (!pickup) {
                return;
            }
            pushEntry('trianglePickup', pickupConfig, 'visual', pickup.visual, 0);
            (pickupDecorationObjectsById.get(pickupConfig.id) ?? []).forEach((gameObject, index) => {
                pushEntry('trianglePickup', pickupConfig, `decoration_${index}`, gameObject, index + 1);
            });
        });

        applyTestWorldVisualDepthEntries(entries);
    };

    const containsBoundsPoint = (bounds: TestWorldEditorBounds, worldX: number, worldY: number): boolean => {
        return Math.abs(worldX - bounds.x) <= (bounds.width * 0.5)
            && Math.abs(worldY - bounds.y) <= (bounds.height * 0.5);
    };

    const getLiveHandleBounds = <TConfig>(
        binding: Omit<RuntimeBinding, 'handleDefinitions'>,
        definition: TestWorldEditorHandleDefinition<TConfig>,
        configObject: TConfig
    ): TestWorldEditorBounds => {
        if (binding.type === 'npc' && definition.part === 'main') {
            const runtimeNpcBounds = npcRuntime.getActorBounds(binding.rootId);
            if (runtimeNpcBounds) {
                return runtimeNpcBounds;
            }
        }

        if (binding.type === 'dragBox' && definition.part === 'main') {
            const runtimeDragBox = dragBoxesById.get(binding.rootId);
            if (runtimeDragBox) {
                return {
                    x: runtimeDragBox.bodyObject.x,
                    y: runtimeDragBox.bodyObject.y,
                    width: runtimeDragBox.bodyObject.width,
                    height: runtimeDragBox.bodyObject.height
                };
            }
        }

        return definition.getBounds(configObject);
    };

    const addBinding = <TConfig>(
        configObject: TConfig,
        binding: Omit<RuntimeBinding, 'handleDefinitions'>,
        handleDefinitions: TestWorldEditorHandleDefinition<TConfig>[]
    ): void => {
        const runtimeBinding: RuntimeBinding = {
            ...binding,
            handleDefinitions: handleDefinitions as unknown as TestWorldEditorHandleDefinition<unknown>[]
        };
        bindings.set(binding.rootId, runtimeBinding);
        objectSummaries.push({
            id: binding.rootId,
            label: binding.label,
            type: binding.type,
            locked: binding.isLocked()
        });
        handleDefinitions.forEach((definition) => {
            handleMap.set(definition.id, {
                id: definition.id,
                rootId: definition.rootId,
                label: definition.label,
                type: definition.type,
                part: definition.part,
                isLocked: () => binding.isLocked(),
                getBounds: () => getLiveHandleBounds(binding, definition, configObject),
                containsPoint: (worldX, worldY) => {
                    if ((binding.type === 'dragBox' || binding.type === 'npc') && definition.part === 'main') {
                        return containsBoundsPoint(getLiveHandleBounds(binding, definition, configObject), worldX, worldY);
                    }
                    if (binding.type === 'surface' && definition.part === 'main') {
                        const runtimeSurface = surfaces.get(binding.rootId);
                        if (runtimeSurface) {
                            return containsBoundsPoint({
                                x: runtimeSurface.x,
                                y: runtimeSurface.y,
                                width: runtimeSurface.width,
                                height: runtimeSurface.height
                            }, worldX, worldY);
                        }
                    }

                    return definition.containsPoint(configObject, worldX, worldY);
                }
            });
        });
    };

    const playerSpawnMarker = createPlayerSpawnMarker(scene, config.playerSpawn);
    addCleanup(() => playerSpawnMarker.destroy());
    addBinding(
        config.playerSpawn,
        {
            rootId: 'player_spawn',
            type: 'playerSpawn',
            label: 'player_spawn',
            isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.getLocked(config.playerSpawn),
            setLocked: (locked) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.setLocked(config.playerSpawn, locked);
            },
            refresh: () => {
                playerSpawnMarker.refresh();
            },
            patchFields: (patch) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.patchFields(config.playerSpawn, patch);
                playerSpawnMarker.refresh();
            },
            patchColors: (patch) => {
                TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.patchColors(config.playerSpawn, patch);
                playerSpawnMarker.refresh();
            }
        },
        TEST_WORLD_EDITOR_ADAPTERS.playerSpawn.getHandles(config.playerSpawn)
    );

    if (config.finish) {
        const finishTrigger = createFinishTrigger(scene, config.finish);
        finishTriggerObject = finishTrigger;
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, finishTrigger.trigger, () => {
            finishReached = true;
        }));
        addCleanup(() => finishTrigger.destroy());
        addBinding(
            config.finish,
            {
                rootId: config.finish.id,
                type: 'finish',
                label: config.finish.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.finish.getLocked(config.finish!),
                setLocked: (locked) => {
                    if (!config.finish) {
                        return;
                    }
                    TEST_WORLD_EDITOR_ADAPTERS.finish.setLocked(config.finish, locked);
                },
                refresh: () => {
                    finishTrigger.refresh();
                },
                patchFields: (patch) => {
                    if (!config.finish) {
                        return;
                    }
                    TEST_WORLD_EDITOR_ADAPTERS.finish.patchFields(config.finish, patch);
                    finishTrigger.refresh();
                },
                patchColors: (patch) => {
                    if (!config.finish) {
                        return;
                    }
                    TEST_WORLD_EDITOR_ADAPTERS.finish.patchColors(config.finish, patch);
                    finishTrigger.refresh();
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.finish.getHandles(config.finish)
        );
    }

    const stopMovingSurface = (runtimeState: SurfaceMoveRuntimeState): void => {
        const body = runtimeState.surface.body as Physics.Arcade.Body | undefined;
        body?.setVelocity(0, 0);
        runtimeState.matterBody.pfCarryDeltaX = 0;
        runtimeState.matterBody.pfCarryDeltaY = 0;
        runtimeState.lastDeltaX = 0;
        runtimeState.lastDeltaY = 0;
        runtimeState.lastCarryDeltaX = 0;
        runtimeState.lastCarryDeltaY = 0;
        scene.matter.body.setPosition(runtimeState.matterBody, {
            x: runtimeState.surface.x,
            y: runtimeState.surface.y
        });
    };

    const createSurfaceMoveRuntimeStateIfResolvable = (
        surfaceConfig: TestWorldSurfaceConfig
    ): boolean => {
        if (movingSurfaceStatesById.has(surfaceConfig.id)) {
            return false;
        }
        const assignment = resolveAndStoreSurfaceMoveAssignment(surfaceConfig);
        if (!assignment) {
            return false;
        }
        const surface = surfaces.get(surfaceConfig.id);
        if (!surface) {
            return false;
        }
        const body = surface.body as Physics.Arcade.Body | undefined;
        if (!(body instanceof Physics.Arcade.Body)) {
            return false;
        }
        const matterBody = surface.getData('pf_matter_body') as SurfaceMoveMatterBody | null;
        if (!matterBody) {
            return false;
        }
        const runtimeState: SurfaceMoveRuntimeState = {
            assignment,
            surface,
            matterBody,
            mode: assignment.start,
            direction: 1,
            runOnceCompleted: false,
            originX: surfaceConfig.x,
            originY: surfaceConfig.y,
            lastDeltaX: 0,
            lastDeltaY: 0,
            lastCarryDeltaX: 0,
            lastCarryDeltaY: 0,
            updateVisitCount: 0,
            lastVisitedFrame: 0
        };
        movingSurfaceStatesById.set(surfaceConfig.id, runtimeState);
        stopMovingSurface(runtimeState);
        return true;
    };

    const reconcileSurfaceMoveRuntimeState = (
        surfaceConfig: TestWorldSurfaceConfig
    ): boolean => {
        const surface = surfaces.get(surfaceConfig.id);
        if (!surface) {
            movingSurfaceStatesById.delete(surfaceConfig.id);
            surfaceMoveAssignmentsById.delete(surfaceConfig.id);
            return false;
        }

        const assignment = resolveAndStoreSurfaceMoveAssignment(surfaceConfig);
        const runtimeState = movingSurfaceStatesById.get(surfaceConfig.id);

        if (!assignment) {
            if (runtimeState) {
                stopMovingSurface(runtimeState);
                movingSurfaceStatesById.delete(surfaceConfig.id);
            }
            return false;
        }

        const matterBody = surface.getData('pf_matter_body') as SurfaceMoveMatterBody | null;
        if (!matterBody || !(surface.body instanceof Physics.Arcade.Body)) {
            if (runtimeState) {
                movingSurfaceStatesById.delete(surfaceConfig.id);
            }
            return false;
        }

        if (runtimeState) {
            runtimeState.assignment = assignment;
            runtimeState.matterBody = matterBody;
            runtimeState.mode = assignment.start;
            runtimeState.direction = 1;
            runtimeState.runOnceCompleted = false;
            runtimeState.originX = surfaceConfig.x;
            runtimeState.originY = surfaceConfig.y;
            stopMovingSurface(runtimeState);
            return true;
        }

        return createSurfaceMoveRuntimeStateIfResolvable(surfaceConfig);
    };

    const setSurfaceMoveRuntimeEditingActive = (
        surfaceId: string,
        active: boolean
    ): boolean => {
        const surfaceConfig = config.surfaces.find((entry) => entry.id === surfaceId) ?? null;
        if (!surfaceConfig) {
            return false;
        }
        if (active) {
            surfaceMoveEditingActiveIds.add(surfaceId);
            const runtimeState = movingSurfaceStatesById.get(surfaceId);
            if (runtimeState) {
                stopMovingSurface(runtimeState);
            }
            surfaceOutlineRenderer.refresh();
            return true;
        }
        surfaceMoveEditingActiveIds.delete(surfaceId);
        const resolved = reconcileSurfaceMoveRuntimeState(surfaceConfig);
        if (!resolved && hasAssignedSurfaceMoveScript(surfaceConfig)) {
            requestSurfaceMoveRuntimeStateReconcileAfterScriptLoad(surfaceConfig);
        }
        actorContactRuntime.rebuildColliders();
        rebuildDragBoxWorldColliders();
        surfaceOutlineRenderer.refresh();
        return true;
    };

    const requestSurfaceMoveRuntimeStateReconcileAfterScriptLoad = (
        surfaceConfig: TestWorldSurfaceConfig
    ): void => {
        const surfaceId = surfaceConfig.id;
        if (pendingSurfaceMoveScriptLoadIds.has(surfaceId)) {
            return;
        }
        pendingSurfaceMoveScriptLoadIds.add(surfaceId);
        void ensureExternalLogicScriptsLoaded()
            .then((preloadResult) => {
                if (preloadResult.success) {
                    return preloadResult;
                }
                return reloadExternalLogicScripts();
            })
            .then((loadResult) => {
                if (!loadResult.success) {
                    return;
                }
                const activeSurfaceConfig = config.surfaces.find((entry) => entry.id === surfaceId) ?? null;
                if (!activeSurfaceConfig || !hasAssignedSurfaceMoveScript(activeSurfaceConfig)) {
                    return;
                }
                reconcileSurfaceMoveRuntimeState(activeSurfaceConfig);
                actorContactRuntime.rebuildColliders();
                rebuildDragBoxWorldColliders();
                surfaceOutlineRenderer.refresh();
            })
            .catch(() => {
                // Keep runtime safe/static if script load fails.
            })
            .finally(() => {
                pendingSurfaceMoveScriptLoadIds.delete(surfaceId);
            });
    };

    const activatePendingSurfaceMovers = (): number => {
        let createdCount = 0;
        config.surfaces.forEach((surfaceConfig) => {
            if (!hasAssignedSurfaceMoveScript(surfaceConfig) || movingSurfaceStatesById.has(surfaceConfig.id)) {
                return;
            }
            if (reconcileSurfaceMoveRuntimeState(surfaceConfig)) {
                createdCount += 1;
            }
        });
        if (createdCount > 0) {
            actorContactRuntime.rebuildColliders();
            rebuildDragBoxWorldColliders();
        }
        return createdCount;
    };

    const updateMovingSurfaceStates = (deltaMs: number): void => {
        activatePendingSurfaceMovers();
        surfaceMoveUpdateFrame += 1;
        surfaceMoveVisitedThisFrame = 0;
        const safeDeltaMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
        const deltaSec = safeDeltaMs / 1000;
        movingSurfaceStatesById.forEach((runtimeState) => {
            const body = runtimeState.surface.body as Physics.Arcade.Body | undefined;
            if (!body) {
                runtimeState.lastDeltaX = 0;
                runtimeState.lastDeltaY = 0;
                runtimeState.lastCarryDeltaX = 0;
                runtimeState.lastCarryDeltaY = 0;
                return;
            }
            runtimeState.updateVisitCount += 1;
            runtimeState.lastVisitedFrame = surfaceMoveUpdateFrame;
            surfaceMoveVisitedThisFrame += 1;

            if (surfaceMoveEditingActiveIds.has(runtimeState.assignment.surfaceId)) {
                stopMovingSurface(runtimeState);
                return;
            }

            if (deltaSec <= 0 || runtimeState.mode === 'stopped' || runtimeState.runOnceCompleted) {
                stopMovingSurface(runtimeState);
                return;
            }

            const previousX = runtimeState.surface.x;
            const previousY = runtimeState.surface.y;
            const axis = runtimeState.assignment.axis;
            const speed = runtimeState.assignment.speed;
            const distance = runtimeState.assignment.distance;
            const signedSpeed = speed * runtimeState.direction;

            if (axis === 'horizontal') {
                body.setVelocity(signedSpeed, 0);
                const offset = runtimeState.surface.x - runtimeState.originX;
                if (runtimeState.direction > 0) {
                    if (offset >= distance) {
                        runtimeState.surface.x = runtimeState.originX + distance;
                        if (runtimeState.mode === 'run_once') {
                            runtimeState.runOnceCompleted = true;
                            runtimeState.mode = 'stopped';
                            stopMovingSurface(runtimeState);
                        } else {
                            runtimeState.direction = -1;
                            body.setVelocity(-speed, 0);
                        }
                    }
                } else if (offset <= -distance) {
                    runtimeState.surface.x = runtimeState.originX - distance;
                    runtimeState.direction = 1;
                    body.setVelocity(speed, 0);
                }
            } else {
                body.setVelocity(0, signedSpeed);
                const offset = runtimeState.surface.y - runtimeState.originY;
                if (runtimeState.direction > 0) {
                    if (offset >= distance) {
                        runtimeState.surface.y = runtimeState.originY + distance;
                        if (runtimeState.mode === 'run_once') {
                            runtimeState.runOnceCompleted = true;
                            runtimeState.mode = 'stopped';
                            stopMovingSurface(runtimeState);
                        } else {
                            runtimeState.direction = -1;
                            body.setVelocity(0, -speed);
                        }
                    }
                } else if (offset <= -distance) {
                    runtimeState.surface.y = runtimeState.originY - distance;
                    runtimeState.direction = 1;
                    body.setVelocity(0, speed);
                }
            }

            const realizedDeltaX = runtimeState.surface.x - previousX;
            const realizedDeltaY = runtimeState.surface.y - previousY;
            const carryDeltaX = Math.abs(realizedDeltaX) > 0 ? realizedDeltaX : (body.velocity.x * deltaSec);
            const carryDeltaY = Math.abs(realizedDeltaY) > 0 ? realizedDeltaY : (body.velocity.y * deltaSec);
            runtimeState.lastDeltaX = realizedDeltaX;
            runtimeState.lastDeltaY = realizedDeltaY;
            runtimeState.lastCarryDeltaX = carryDeltaX;
            runtimeState.lastCarryDeltaY = carryDeltaY;
            runtimeState.matterBody.pfCarryDeltaX = carryDeltaX;
            runtimeState.matterBody.pfCarryDeltaY = carryDeltaY;
            scene.matter.body.setPosition(runtimeState.matterBody, {
                x: runtimeState.surface.x,
                y: runtimeState.surface.y
            });
        });
        if (movingSurfaceStatesById.size > 0) {
            surfaceOutlineRenderer.refresh();
        }
    };

    const getSurfaceMoveRuntimeDebugSnapshot = (): SurfaceMoveRuntimeDebugSnapshot => {
        const surfacesSnapshot: SurfaceMoveRuntimeDebugEntry[] = config.surfaces.map((surfaceConfig) => {
            const assignedScriptId = typeof surfaceConfig.behaviorScripts?.move === 'string'
                ? surfaceConfig.behaviorScripts.move.trim()
                : '';
            const normalizedAssignedScriptId = assignedScriptId.length > 0 ? assignedScriptId : null;
            const script = normalizedAssignedScriptId ? getLogicScriptAsset(normalizedAssignedScriptId) : null;
            const command = script?.commands[0];
            const commandType = command?.type.trim() ?? null;
            const paramsValid = command && commandType === PLATFORM_MOVE_PING_PONG_COMMAND_TYPE
                ? getPlatformMovePingPongParams(command.params) !== null
                : null;
            const resolvedAssignment = surfaceMoveAssignmentsById.get(surfaceConfig.id) ?? null;
            const runtimeState = movingSurfaceStatesById.get(surfaceConfig.id) ?? null;
            const editingActive = surfaceMoveEditingActiveIds.has(surfaceConfig.id);
            const surface = surfaces.get(surfaceConfig.id) ?? null;
            const body = surface?.body as Physics.Arcade.Body | Physics.Arcade.StaticBody | undefined;
            const moverActive = !editingActive
                && runtimeState !== null
                && runtimeState.mode !== 'stopped'
                && !runtimeState.runOnceCompleted;
            let blockedReason: string | null = null;
            if (!normalizedAssignedScriptId) {
                blockedReason = 'no_move_assignment';
            } else if (!script) {
                blockedReason = 'missing_script_asset';
            } else if (script.category !== 'platform.move') {
                blockedReason = `script_category_mismatch:${script.category}`;
            } else if (!resolvedAssignment) {
                blockedReason = 'assignment_not_resolved';
            } else if (!surface) {
                blockedReason = 'surface_runtime_missing';
            } else if (!(body instanceof Physics.Arcade.Body)) {
                blockedReason = 'surface_body_not_dynamic';
            } else if (!runtimeState) {
                blockedReason = 'mover_state_missing';
            } else if (editingActive) {
                blockedReason = 'editor_edit_active';
            } else if (runtimeState.mode === 'stopped' || runtimeState.runOnceCompleted) {
                blockedReason = runtimeState.runOnceCompleted ? 'run_once_completed' : 'mover_stopped';
            }
            return {
                surfaceId: surfaceConfig.id,
                assignedScriptId: normalizedAssignedScriptId,
                scriptFound: script !== null,
                scriptCategory: script?.category ?? null,
                commandType,
                paramsValid,
                resolved: resolvedAssignment !== null,
                moverActive,
                currentX: surface?.x ?? surfaceConfig.x,
                currentY: surface?.y ?? surfaceConfig.y,
                originX: runtimeState?.originX ?? surfaceConfig.x,
                originY: runtimeState?.originY ?? surfaceConfig.y,
                direction: runtimeState?.direction ?? 0,
                velocityX: body instanceof Physics.Arcade.Body ? body.velocity.x : 0,
                velocityY: body instanceof Physics.Arcade.Body ? body.velocity.y : 0,
                lastDeltaX: runtimeState?.lastDeltaX ?? 0,
                lastDeltaY: runtimeState?.lastDeltaY ?? 0,
                lastCarryDeltaX: runtimeState?.lastCarryDeltaX ?? 0,
                lastCarryDeltaY: runtimeState?.lastCarryDeltaY ?? 0,
                blockedReason,
                updateVisitCount: runtimeState?.updateVisitCount ?? 0,
                visitedThisFrame: runtimeState ? runtimeState.lastVisitedFrame === surfaceMoveUpdateFrame : false
            };
        });
        const discoveredAssignments = config.surfaces.filter((surfaceConfig) => hasAssignedSurfaceMoveScript(surfaceConfig)).length;
        return {
            discoveredAssignments,
            resolvedAssignments: surfaceMoveAssignmentsById.size,
            moverStateCount: movingSurfaceStatesById.size,
            moversVisitedThisFrame: surfaceMoveVisitedThisFrame,
            surfaces: surfacesSnapshot
        };
    };

    const getNpcPatrolRuntimeDebugSnapshot = (): NpcPatrolRuntimeDebugSnapshot => {
        const runtimeEntriesById = new Map<string, TestNpcPatrolBehaviorRuntimeDebugEntry>();
        npcRuntime.getPatrolBehaviorRuntimeDebugEntries().forEach((entry) => {
            runtimeEntriesById.set(entry.actorId, entry);
        });
        const npcsSnapshot: NpcPatrolRuntimeDebugEntry[] = config.npcs.map((npcConfig) => {
            const assignedScriptId = typeof npcConfig.behaviorScripts?.patrol === 'string'
                ? npcConfig.behaviorScripts.patrol.trim()
                : '';
            const normalizedAssignedScriptId = assignedScriptId.length > 0 ? assignedScriptId : null;
            const script = normalizedAssignedScriptId ? getLogicScriptAsset(normalizedAssignedScriptId) : null;
            const command = script?.commands[0];
            const commandType = command?.type?.trim() ?? null;
            const params = command ? getNpcPatrolPingPongParams(command.params) : null;
            const runtimeEntry = runtimeEntriesById.get(npcConfig.id);
            return {
                npcId: npcConfig.id,
                controlMode: runtimeEntry?.controlMode ?? 'behavior',
                controlledBy: runtimeEntry?.controlledBy ?? null,
                assignedScriptId: normalizedAssignedScriptId,
                scriptFound: script !== null,
                scriptCategory: script?.category ?? null,
                commandType,
                paramsValid: normalizedAssignedScriptId ? (params !== null) : null,
                axis: runtimeEntry?.axis ?? null,
                direction: runtimeEntry?.direction ?? 0,
                velocityX: runtimeEntry?.velocityX ?? 0,
                velocityY: runtimeEntry?.velocityY ?? 0,
                resolved: runtimeEntry?.resolved ?? false,
                active: runtimeEntry?.active ?? false,
                currentX: runtimeEntry?.currentX ?? npcConfig.x,
                currentY: runtimeEntry?.currentY ?? npcConfig.y,
                originX: runtimeEntry?.originX ?? npcConfig.x,
                originY: runtimeEntry?.originY ?? npcConfig.y,
                blockedReason: runtimeEntry?.blockedReason ?? (
                    normalizedAssignedScriptId
                        ? (script === null
                            ? 'missing assigned script'
                            : (script.category !== 'npc.patrol'
                                ? `wrong category: ${script.category}`
                                : (commandType !== NPC_PATROL_PING_PONG_COMMAND_TYPE
                                    ? `unsupported command: ${commandType ?? 'none'}`
                                    : (params === null ? 'invalid npc_patrol_ping_pong params' : null))))
                        : null
                )
            };
        });
        return {
            discoveredAssignments: npcsSnapshot.filter((entry) => entry.assignedScriptId !== null).length,
            resolvedAssignments: npcsSnapshot.filter((entry) => entry.resolved).length,
            activeAssignments: npcsSnapshot.filter((entry) => entry.active).length,
            npcs: npcsSnapshot
        };
    };

    config.surfaces.forEach((surfaceConfig) => {
        const surfaceMoveAssignment = surfaceMoveAssignmentsById.get(surfaceConfig.id) ?? null;
        const surface = createSurface(scene, surfaceConfig);
        surfaces.set(surfaceConfig.id, surface);
        if (surfaceMoveAssignment) {
            createSurfaceMoveRuntimeStateIfResolvable(surfaceConfig);
        }
        addCleanup(() => {
            const matterBody = surface.getData('pf_matter_body') as MatterJS.BodyType | undefined;
            if (matterBody) {
                scene.matter.world.remove(matterBody);
            }
            surfaceMoveEditingActiveIds.delete(surfaceConfig.id);
            movingSurfaceStatesById.delete(surfaceConfig.id);
            surface.destroy();
        });
        addBinding(
            surfaceConfig,
            {
                rootId: surfaceConfig.id,
                type: 'surface',
                label: surfaceConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.surface.getLocked(surfaceConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.setLocked(surfaceConfig, locked);
                },
                refresh: () => {
                    syncSurfaceObject(scene, surface, surfaceConfig);
                    const runtimeState = movingSurfaceStatesById.get(surfaceConfig.id);
                    if (runtimeState) {
                        runtimeState.originX = surfaceConfig.x;
                        runtimeState.originY = surfaceConfig.y;
                    }
                    surfaceOutlineRenderer.refresh();
                    actorContactRuntime.rebuildColliders();
                    rebuildDragBoxWorldColliders();
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.patchFields(surfaceConfig, patch);
                    replaceSurfaceMatterBody(scene, surface, surfaceConfig);
                    syncSurfaceObject(scene, surface, surfaceConfig);
                    const resolved = reconcileSurfaceMoveRuntimeState(surfaceConfig);
                    if (!resolved && hasAssignedSurfaceMoveScript(surfaceConfig)) {
                        requestSurfaceMoveRuntimeStateReconcileAfterScriptLoad(surfaceConfig);
                    }
                    surfaceOutlineRenderer.refresh();
                    actorContactRuntime.rebuildColliders();
                    rebuildDragBoxWorldColliders();
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.surface.patchColors(surfaceConfig, patch);
                    syncSurfaceObject(scene, surface, surfaceConfig);
                    surfaceOutlineRenderer.refresh();
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.surface.getHandles(surfaceConfig)
        );
    });

    const rebuildNpcObjects = (): void => {
        npcRuntime.destroy();
        npcRuntime = createTestNpcRuntime(
            scene,
            player,
            npcWorldCollisionRuntime,
            config.npcs,
            resolveNpcPatrolAssignmentMap()
        );
        npcInteractionRuntime = createTestNpcInteractionRuntime(player, npcRuntime, config.npcs);
        refreshVisualDepths();
    };

    config.npcs.forEach((npcConfig) => {
        addBinding(
            npcConfig,
            {
                rootId: npcConfig.id,
                type: 'npc',
                label: npcConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.npc.getLocked(npcConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.npc.setLocked(npcConfig, locked);
                },
                refresh: () => {
                    rebuildNpcObjects();
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.npc.patchFields(npcConfig, patch);
                    rebuildNpcObjects();
                },
                patchColors: () => {
                    rebuildNpcObjects();
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.npc.getHandles(npcConfig)
        );
    });

    config.hazards.forEach((hazardConfig) => {
        const hazard = createHazard(scene, hazardConfig);
        hazards.push(hazard);
        addCleanup(() => hazard.destroy());
        addBinding(
            hazardConfig,
            {
                rootId: hazardConfig.id,
                type: 'hazard',
                label: hazardConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.hazard.getLocked(hazardConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.setLocked(hazardConfig, locked);
                },
                refresh: () => {
                    syncHazardObject(scene, hazard, hazardConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.patchFields(hazardConfig, patch);
                    syncHazardObject(scene, hazard, hazardConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.hazard.patchColors(hazardConfig, patch);
                    syncHazardObject(scene, hazard, hazardConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.hazard.getHandles(hazardConfig)
        );
    });

    config.checkpoints.forEach((checkpointConfig) => {
        const checkpoint = createCheckpoint(scene, checkpointConfig);
        checkpointsById.set(checkpointConfig.id, checkpoint);
        overlapColliders.push(scene.physics.add.overlap(player.arcadeBodyObject, checkpoint.trigger, () => {
            activeCheckpointId = checkpointConfig.id;
            applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
        }));
        addCleanup(() => checkpoint.destroy());
        addBinding(
            checkpointConfig,
            {
                rootId: checkpointConfig.id,
                type: 'checkpoint',
                label: checkpointConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.checkpoint.getLocked(checkpointConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.setLocked(checkpointConfig, locked);
                },
                refresh: () => {
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.patchFields(checkpointConfig, patch);
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.checkpoint.patchColors(checkpointConfig, patch);
                    refreshCheckpointObject(scene, checkpoint, checkpointConfig);
                    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.checkpoint.getHandles(checkpointConfig)
        );
    });
    applyActiveCheckpointState(checkpointsById, config.checkpoints, activeCheckpointId, onCheckpointActivated);

    const rebuildMovingPlatformObject = (platformConfig: TestWorldMovingPlatformConfig): void => {
        const existing = movingPlatformsById.get(platformConfig.id);
        if (existing) {
            const index = movingPlatforms.indexOf(existing);
            if (index >= 0) {
                movingPlatforms.splice(index, 1);
            }
            existing.destroy();
        }
        const platform = createMovingPlatform(scene, platformConfig);
        movingPlatforms.push(platform);
        movingPlatformsById.set(platformConfig.id, platform);
        actorContactRuntime.rebuildColliders();
        rebuildDragBoxWorldColliders();
    };

    config.movingPlatforms.forEach((platformConfig) => {
        rebuildMovingPlatformObject(platformConfig);
        addBinding(
            platformConfig,
            {
                rootId: platformConfig.id,
                type: 'movingPlatform',
                label: platformConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.getLocked(platformConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.setLocked(platformConfig, locked);
                },
                refresh: () => {
                    rebuildMovingPlatformObject(platformConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.patchFields(platformConfig, patch);
                    rebuildMovingPlatformObject(platformConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.patchColors(platformConfig, patch);
                    rebuildMovingPlatformObject(platformConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.movingPlatform.getHandles(platformConfig)
        );
    });
    const movingPlatformRuntime = createTestWorldMovingPlatformRuntimeController({
        scene,
        platformConfigs: config.movingPlatforms,
        getPlatform: (id) => movingPlatformsById.get(id) ?? null,
        eventDebugSink
    });

    const rebuildDragBoxObject = (dragBoxConfig: TestWorldDragBoxConfig): void => {
        const existing = dragBoxesById.get(dragBoxConfig.id);
        if (existing) {
            const index = dragBoxes.indexOf(existing);
            if (index >= 0) {
                dragBoxes.splice(index, 1);
            }
            existing.destroy();
        }
        const dragBox = createDraggableBox(scene, dragBoxConfig);
        dragBox.bodyObject.setName(dragBoxConfig.id);
        dragBoxes.push(dragBox);
        dragBoxesById.set(dragBoxConfig.id, dragBox);
        actorContactRuntime.rebuildColliders();
        rebuildPlayerDragBoxColliders();
        rebuildDragBoxWorldColliders();
    };

    config.dragBoxes.forEach((dragBoxConfig) => {
        rebuildDragBoxObject(dragBoxConfig);
        addBinding(
            dragBoxConfig,
            {
                rootId: dragBoxConfig.id,
                type: 'dragBox',
                label: dragBoxConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.dragBox.getLocked(dragBoxConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.setLocked(dragBoxConfig, locked);
                },
                refresh: () => {
                    rebuildDragBoxObject(dragBoxConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.patchFields(dragBoxConfig, patch);
                    rebuildDragBoxObject(dragBoxConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.dragBox.patchColors(dragBoxConfig, patch);
                    rebuildDragBoxObject(dragBoxConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.dragBox.getHandles(dragBoxConfig)
        );
    });

    const rebuildTriggerPlatformObject = (triggerConfig: TestWorldTriggerPlatformConfig): void => {
        const existing = triggerPlatformsById.get(triggerConfig.id);
        if (existing) {
            const index = triggerPlatforms.indexOf(existing);
            if (index >= 0) {
                triggerPlatforms.splice(index, 1);
            }
            existing.destroy();
        }
        const triggerPlatform = createTriggerPlatform(scene, triggerConfig);
        triggerPlatforms.push(triggerPlatform);
        triggerPlatformsById.set(triggerConfig.id, triggerPlatform);
        actorContactRuntime.rebuildColliders();
        rebuildDragBoxWorldColliders();
    };

    config.triggerPlatforms.forEach((triggerConfig) => {
        rebuildTriggerPlatformObject(triggerConfig);
        addBinding(
            triggerConfig,
            {
                rootId: triggerConfig.id,
                type: 'triggerPlatform',
                label: triggerConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.getLocked(triggerConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.setLocked(triggerConfig, locked);
                },
                refresh: () => {
                    rebuildTriggerPlatformObject(triggerConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.patchFields(triggerConfig, patch);
                    rebuildTriggerPlatformObject(triggerConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.patchColors(triggerConfig, patch);
                    rebuildTriggerPlatformObject(triggerConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.triggerPlatform.getHandles(triggerConfig)
        );
    });

    const rebuildTriggerVolumeObject = (triggerVolumeConfig: TestWorldTriggerVolumeConfig): void => {
        const existing = triggerVolumesById.get(triggerVolumeConfig.id);
        if (existing) {
            const index = triggerVolumes.indexOf(existing);
            if (index >= 0) {
                triggerVolumes.splice(index, 1);
            }
            existing.destroy();
        }
        const triggerVolume = createTriggerVolume(scene, triggerVolumeConfig);
        triggerVolumes.push(triggerVolume);
        triggerVolumesById.set(triggerVolumeConfig.id, triggerVolume);
    };

    config.triggerVolumes.forEach((triggerVolumeConfig) => {
        rebuildTriggerVolumeObject(triggerVolumeConfig);
        addBinding(
            triggerVolumeConfig,
            {
                rootId: triggerVolumeConfig.id,
                type: 'triggerVolume',
                label: triggerVolumeConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.triggerVolume.getLocked(triggerVolumeConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerVolume.setLocked(triggerVolumeConfig, locked);
                },
                refresh: () => {
                    rebuildTriggerVolumeObject(triggerVolumeConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerVolume.patchFields(triggerVolumeConfig, patch);
                    rebuildTriggerVolumeObject(triggerVolumeConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triggerVolume.patchColors(triggerVolumeConfig, patch);
                    rebuildTriggerVolumeObject(triggerVolumeConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.triggerVolume.getHandles(triggerVolumeConfig)
        );
    });

    const rebuildWindZoneObject = (windZoneConfig: TestWorldWindZoneConfig): void => {
        const existing = windZonesById.get(windZoneConfig.id);
        if (existing) {
            const index = windZones.indexOf(existing);
            if (index >= 0) {
                windZones.splice(index, 1);
            }
            existing.destroy();
        }
        windZoneDecorationObjectsById.delete(windZoneConfig.id);
        const { result: windZone, createdObjects } = captureCreatedDisplayObjects(scene, () => createWindZone(scene, windZoneConfig));
        windZones.push(windZone);
        windZonesById.set(windZoneConfig.id, windZone);
        windZoneDecorationObjectsById.set(
            windZoneConfig.id,
            createdObjects.filter((entry) => entry !== windZone.trigger)
        );
    };

    config.windZones.forEach((windZoneConfig) => {
        rebuildWindZoneObject(windZoneConfig);
        addBinding(
            windZoneConfig,
            {
                rootId: windZoneConfig.id,
                type: 'windZone',
                label: windZoneConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.windZone.getLocked(windZoneConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.setLocked(windZoneConfig, locked);
                },
                refresh: () => {
                    rebuildWindZoneObject(windZoneConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.patchFields(windZoneConfig, patch);
                    rebuildWindZoneObject(windZoneConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.windZone.patchColors(windZoneConfig, patch);
                    rebuildWindZoneObject(windZoneConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.windZone.getHandles(windZoneConfig)
        );
    });

    config.triangleFlightBreakWalls.forEach((wallConfig) => {
        const wall = createTriangleFlightBreakWall(scene, wallConfig);
        triangleFlightBreakWalls.push(wall);
        triangleFlightBreakWallsById.set(wallConfig.id, wall);
        addCleanup(() => {
            triangleFlightBreakWallsById.delete(wallConfig.id);
            wall.destroy();
        });
        addBinding(
            wallConfig,
            {
                rootId: wallConfig.id,
                type: 'triangleFlightBreakWall',
                label: wallConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.getLocked(wallConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.setLocked(wallConfig, locked);
                },
                refresh: () => {
                    syncBreakWallObject(scene, wall, wallConfig);
                    actorContactRuntime.rebuildColliders();
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.patchFields(wallConfig, patch);
                    syncBreakWallObject(scene, wall, wallConfig);
                    actorContactRuntime.rebuildColliders();
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.patchColors(wallConfig, patch);
                    syncBreakWallObject(scene, wall, wallConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.triangleFlightBreakWall.getHandles(wallConfig)
        );
    });

    const rebuildPickupObject = (pickupConfig: TestWorldTrianglePickupConfig): void => {
        const existing = pickupsById.get(pickupConfig.id);
        if (existing) {
            const index = trianglePickups.indexOf(existing);
            if (index >= 0) {
                trianglePickups.splice(index, 1);
            }
            existing.destroy();
        }
        pickupDecorationObjectsById.delete(pickupConfig.id);
        pickupOverlapColliders.get(pickupConfig.id)?.destroy();
        pickupOverlapColliders.delete(pickupConfig.id);
        const { result: pickup, createdObjects } = captureCreatedDisplayObjects(scene, () => createTriangleFlightPickup(scene, pickupConfig));
        trianglePickups.push(pickup);
        pickupsById.set(pickupConfig.id, pickup);
        pickupDecorationObjectsById.set(
            pickupConfig.id,
            createdObjects.filter((entry) => entry !== pickup.visual)
        );
        const collider = scene.physics.add.overlap(player.arcadeBodyObject, pickup.trigger, () => {
            if (pickup.isCollected() || player.currentForm !== 'triangle') {
                return;
            }

            pickup.collect();
            player.refillTriangleFlightResource();
        });
        overlapColliders.push(collider);
        pickupOverlapColliders.set(pickupConfig.id, collider);
    };

    config.trianglePickups.forEach((pickupConfig) => {
        rebuildPickupObject(pickupConfig);
        addBinding(
            pickupConfig,
            {
                rootId: pickupConfig.id,
                type: 'trianglePickup',
                label: pickupConfig.id,
                isLocked: () => TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.getLocked(pickupConfig),
                setLocked: (locked) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.setLocked(pickupConfig, locked);
                },
                refresh: () => {
                    rebuildPickupObject(pickupConfig);
                },
                patchFields: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.patchFields(pickupConfig, patch);
                    rebuildPickupObject(pickupConfig);
                },
                patchColors: (patch) => {
                    TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.patchColors(pickupConfig, patch);
                    rebuildPickupObject(pickupConfig);
                }
            },
            TEST_WORLD_EDITOR_ADAPTERS.trianglePickup.getHandles(pickupConfig)
        );
    });

    const resolveNpcPatrolAssignmentMap = (): Map<string, TestNpcPatrolBehaviorRuntimeAssignment> => {
        const map = new Map<string, TestNpcPatrolBehaviorRuntimeAssignment>();
        config.npcs.forEach((npcConfig) => {
            const assignment = resolveNpcPatrolRuntimeAssignment(npcConfig);
            if (assignment) {
                map.set(npcConfig.id, assignment);
            }
        });
        return map;
    };
    let npcRuntime: TestNpcRuntime = createTestNpcRuntime(
        scene,
        player,
        npcWorldCollisionRuntime,
        config.npcs,
        resolveNpcPatrolAssignmentMap()
    );
    let npcInteractionRuntime: TestNpcInteractionRuntime = createTestNpcInteractionRuntime(
        player,
        npcRuntime,
        config.npcs
    );
    let npcCarrySupportGraceFramesRemaining = 0;
    let npcCarrySupportGraceVelocityX = 0;
    addCleanup(() => npcRuntime.destroy());
    const handleNpcActorActionEvent = (payload: unknown): void => {
        if (!payload || typeof payload !== 'object') {
            return;
        }
        const raw = payload as Record<string, unknown>;
        const actorId = typeof raw.actorId === 'string' ? raw.actorId.trim() : '';
        const eventId = typeof raw.eventId === 'string' ? raw.eventId.trim() : '';
        if (actorId.length <= 0 || eventId.length <= 0 || actorId === 'trigger_runtime') {
            return;
        }
        const eventPayload = (
            raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
                ? raw.payload as Record<string, unknown>
                : undefined
        );
        dispatchWorldLogicEvent({
            kind: 'npc_event',
            actorId,
            eventId,
            payload: eventPayload
        });
    };
    scene.events.on('pf:npc_actor_action_event', handleNpcActorActionEvent);
    addCleanup(() => {
        scene.events.off('pf:npc_actor_action_event', handleNpcActorActionEvent);
    });
    npcRuntime.syncTriangleSupportSurfaces();
    actorContactRuntime.rebuildColliders();
    rebuildPlayerDragBoxColliders();
    rebuildDragBoxWorldColliders();
    refreshVisualDepths();
    resetWorldFlags(config.worldFlags);
    const triggerRuntime = createTestWorldTriggerRuntime({
        scene,
        player,
        triggerPlatformConfigs: config.triggerPlatforms,
        triggerVolumeConfigs: config.triggerVolumes,
        dragBoxConfigs: config.dragBoxes,
        getTriggerPlatform: (id) => triggerPlatformsById.get(id) ?? null,
        getTriggerVolume: (id) => triggerVolumesById.get(id) ?? null,
        getDragBox: (id) => dragBoxesById.get(id) ?? null,
        setTriggerPlatformActive: (id, active) => {
            triggerPlatformsById.get(id)?.setActive(active);
        },
        setMovingPlatformMotionState: (id, mode) => {
            movingPlatformRuntime.setMotionState(id, mode);
        },
        setNpcPresentationEmotionFromTrigger: (id, emotionId) => {
            return npcRuntime.setPresentationEmotionFromTrigger(id, emotionId);
        },
        getPlayerFormId: () => player.currentForm,
        executeActorAction: (actorId, action) => {
            if (action.kind === 'set_emotion') {
                return npcRuntime.setPresentationEmotionFromTrigger(actorId, action.emotionId);
            }
            if (action.kind === 'trigger_event') {
                return dispatchTriggerEvent(action.eventId, action.payload, actorId);
            }
            return false;
        },
        startCutscene: (cutsceneRef) => {
            const normalizedCutsceneRef = cutsceneRef.trim();
            if (normalizedCutsceneRef.length <= 0 || !isKnownConfigCutsceneId(normalizedCutsceneRef)) {
                return false;
            }
            scene.events.emit('pf:npc_interaction_cutscene_request', {
                actorId: 'trigger_runtime',
                cutsceneRef: normalizedCutsceneRef
            });
            return true;
        },
        dispatchTriggerEvent: (eventId, payload) => {
            return dispatchTriggerEvent(eventId, payload, 'trigger_runtime');
        },
        playSfx: (sfxId) => {
            const normalizedSfxId = sfxId.trim();
            if (normalizedSfxId.length <= 0) {
                return false;
            }
            scene.events.emit('pf:test_world_play_sfx_stub', {
                source: 'trigger_event_runtime',
                sfxId: normalizedSfxId
            });
            return true;
        },
        spawnVfx: (vfxId, actorId, x, y) => {
            const normalizedVfxId = vfxId.trim();
            if (normalizedVfxId.length <= 0) {
                return false;
            }
            scene.events.emit('pf:test_world_spawn_vfx_stub', {
                source: 'trigger_event_runtime',
                vfxId: normalizedVfxId,
                actorId: actorId ?? null,
                x: typeof x === 'number' ? x : null,
                y: typeof y === 'number' ? y : null
            });
            return true;
        },
        onTriggerEnter: (triggerId, sourceId) => {
            onTriggerEnterLogic?.(triggerId, sourceId);
        }
    });

    return {
        hazards,
        updateMovingPlatforms: (deltaMs: number): void => {
            movingPlatformRuntime.update(deltaMs);
            updateMovingSurfaceStates(deltaMs);
            dragBoxes.forEach((dragBox) => {
                dragBox.update(player);
            });
            if (deltaMs > 0) {
                triggerRuntime.update();
            }
        },
        updateNpcs: (deltaMs: number): void => {
            npcRuntime.update(deltaMs);
        },
        updateNpcInteractionTarget: (): void => {
            npcInteractionRuntime.update();
        },
        tryTriggerNpcInteraction: (): void => {
            // Legacy profile/default NPC interactions are disabled by the XS10.10
            // behavior-script runtime. Explicit npc/onInteract bindings still run
            // through tryTriggerNpcLogicInteraction before this fallback is reached.
        },
        syncNpcTriangleSupportSurfaces: (): void => {
            npcRuntime.syncTriangleSupportSurfaces();
        },
        postPlayerTickUpdate: (): void => {
            if (player.currentForm === 'triangle' && player.isTriangleBreakWallActive) {
                config.triangleFlightBreakWalls.forEach((wallConfig) => {
                    const wall = triangleFlightBreakWallsById.get(wallConfig.id);
                    if (!wall) {
                        return;
                    }
                    if (wall.isBroken()) {
                        return;
                    }

                    if (doesTriangleFlightBreakWallOverlapPlayerShape(wall, player.hazardHitShape)) {
                        const previousBroken = wall.isBroken();
                        wall.breakWall();
                        if (!previousBroken && wall.isBroken()) {
                            dispatchWorldLogicEvent({
                                kind: 'object_state_changed',
                                objectId: wallConfig.id,
                                fromState: 'intact',
                                toState: 'broken'
                            });
                        }
                    }
                });
            }

            const isTriangleGrounded = player.currentForm === 'triangle' && player.isCurrentlyGrounded;
            if (isTriangleGrounded && !wasTriangleGrounded) {
                trianglePickups.forEach((pickup) => {
                    pickup.respawn();
                });
            }
            wasTriangleGrounded = isTriangleGrounded;
        },
        resetRespawnObjects: (): void => {
            triangleFlightBreakWalls.forEach((wall) => {
                wall.respawn();
            });
        },
        syncPlayerCollisionMode: (shouldUseArcadePlatformCollisions: boolean): void => {
            actorContactRuntime.setActorWorldCollisionEnabled(TEST_WORLD_PLAYER_ACTOR_ID, shouldUseArcadePlatformCollisions);
            playerDragBoxColliders.forEach((collider) => {
                collider.active = shouldUseArcadePlatformCollisions;
            });
        },
        consumeFinishReached: (): boolean => {
            if (!finishReached) {
                return false;
            }
            finishReached = false;
            return true;
        },
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            let horizontalInfluenceX = 0;
            windZones.forEach((zone) => {
                if (scene.physics.overlap(playerObject, zone.trigger)) {
                    horizontalInfluenceX += zone.force * zone.directionX;
                }
            });

            if (player.currentForm === 'triangle') {
                return horizontalInfluenceX;
            }
            const playerBody = playerObject.body as Physics.Arcade.Body | undefined;
            if (!playerBody) {
                return horizontalInfluenceX;
            }

            const probeBodies = scene.physics.overlapRect(
                playerBody.x + 1,
                playerBody.bottom - 6,
                Math.max(2, playerBody.width - 2),
                12,
                true,
                true
            ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;

            let bestNpcCarryVelocityX = 0;
            let bestOverlapX = 0;
            probeBodies.forEach((candidateBody) => {
                const candidateGameObject = candidateBody.gameObject;
                if (
                    candidateBody === playerBody
                    || candidateBody.enable === false
                    || candidateGameObject?.active !== true
                    || candidateGameObject.getData(NPC_ARCADE_CARRY_SOURCE_DATA_KEY) !== true
                ) {
                    return;
                }

                const dataVelocityX = candidateGameObject.getData(NPC_ARCADE_CARRY_VELOCITY_X_DATA_KEY);
                const bodyVelocityX = (candidateBody as Physics.Arcade.Body).velocity?.x;
                const hasDataVelocityX = typeof dataVelocityX === 'number' && Number.isFinite(dataVelocityX);
                const hasBodyVelocityX = typeof bodyVelocityX === 'number' && Number.isFinite(bodyVelocityX);
                const candidateVelocityX = hasDataVelocityX && hasBodyVelocityX
                    ? (Math.abs(dataVelocityX) >= Math.abs(bodyVelocityX) ? dataVelocityX : bodyVelocityX)
                    : (hasDataVelocityX ? dataVelocityX : bodyVelocityX);
                if (typeof candidateVelocityX !== 'number' || !Number.isFinite(candidateVelocityX)) {
                    return;
                }

                const overlapX = Math.min(
                    playerBody.right,
                    candidateBody.x + candidateBody.width
                ) - Math.max(
                    playerBody.x,
                    candidateBody.x
                );
                if (overlapX < NPC_CARRY_MIN_OVERLAP_X_PX) {
                    return;
                }

                const topGap = candidateBody.y - playerBody.bottom;
                if (topGap > NPC_CARRY_TOP_GAP_TOLERANCE_UP_PX || topGap < -NPC_CARRY_TOP_GAP_TOLERANCE_DOWN_PX) {
                    return;
                }

                if (overlapX > bestOverlapX) {
                    bestOverlapX = overlapX;
                    bestNpcCarryVelocityX = candidateVelocityX;
                }
            });

            if (bestOverlapX > 0) {
                npcCarrySupportGraceFramesRemaining = NPC_CARRY_SUPPORT_GRACE_FRAMES;
                npcCarrySupportGraceVelocityX = bestNpcCarryVelocityX;
            } else if (
                npcCarrySupportGraceFramesRemaining > 0
                && playerBody.velocity.y >= NPC_CARRY_GRACE_MAX_UPWARD_VELOCITY
            ) {
                bestNpcCarryVelocityX = npcCarrySupportGraceVelocityX;
                npcCarrySupportGraceFramesRemaining -= 1;
            } else {
                npcCarrySupportGraceFramesRemaining = 0;
                npcCarrySupportGraceVelocityX = 0;
            }

            horizontalInfluenceX += bestNpcCarryVelocityX;
            return horizontalInfluenceX;
        },
        getNpcDebugEntries: (): readonly TestNpcDebugEntry[] => npcRuntime.getDebugEntries(),
        getNpcInteractionDebugState: (): TestNpcInteractionDebugState => npcInteractionRuntime.getDebugState(),
        setNpcControlMode: (actorId: string, mode: TestNpcControlMode, controlledBy?: string): boolean => (
            npcRuntime.setNpcControlMode(actorId, mode, controlledBy)
        ),
        clearNpcControlMode: (actorId: string): boolean => npcRuntime.clearNpcControlMode(actorId),
        dispatchWorldLogicEvent,
        dispatchCutsceneActorSequenceRef: (
            actorId: string,
            sequenceRef: string,
            cutsceneRef: string,
            stepRef: string
        ) => {
            const sequence = createCutsceneActorSequenceFromRef(actorId, sequenceRef, cutsceneRef, stepRef);
            if (!sequence) {
                return {
                    actorId,
                    result: 'invalid_sequence_ref' as const,
                    detail: `missing scripted sequence ref "${sequenceRef}"`,
                    sequenceId: null
                };
            }

            const dispatchResult: TestNpcCutsceneSequenceDispatchResult = npcRuntime.dispatchCutsceneSequence(
                actorId,
                sequence,
                cutsceneRef,
                stepRef
            );
            return {
                actorId: dispatchResult.actorId,
                result: dispatchResult.result,
                detail: dispatchResult.detail,
                sequenceId: dispatchResult.sequenceId
            };
        },
        dispatchCutsceneSetEmotion: (actorId: string, emotionId: string) => {
            const applied = npcRuntime.setPresentationEmotionFromTrigger(actorId, emotionId);
            if (!applied) {
                return {
                    actorId,
                    result: 'unknown_actor' as const,
                    detail: `npc actor was not found for "${actorId}"`
                };
            }
            return {
                actorId,
                result: 'applied' as const,
                detail: emotionId
            };
        },
        getCutsceneActorSequenceSnapshot: (actorId: string): TestNpcCutsceneSequenceSnapshot | null => {
            return npcRuntime.getCutsceneSequenceSnapshot(actorId);
        },
        getNpcCameraFocusObject: (actorId: string): GameObjects.Container | null => {
            return npcRuntime.getVisualObject(actorId);
        },
        getNpcActorBounds: (actorId: string): { x: number; y: number; width: number; height: number } | null => {
            return npcRuntime.getActorBounds(actorId);
        },
        activatePendingSurfaceMovers: (): number => {
            return activatePendingSurfaceMovers();
        },
        getSurfaceMoveRuntimeDebugSnapshot: (): SurfaceMoveRuntimeDebugSnapshot => {
            return JSON.parse(JSON.stringify(getSurfaceMoveRuntimeDebugSnapshot())) as SurfaceMoveRuntimeDebugSnapshot;
        },
        getNpcPatrolRuntimeDebugSnapshot: (): NpcPatrolRuntimeDebugSnapshot => {
            return JSON.parse(JSON.stringify(getNpcPatrolRuntimeDebugSnapshot())) as NpcPatrolRuntimeDebugSnapshot;
        },
        getEditorHandles: (): readonly TestWorldEditorHandle[] => {
            return [...handleMap.values()].filter((handle) => {
                if (handle.type !== 'triangleFlightBreakWall') {
                    return true;
                }
                const wall = triangleFlightBreakWallsById.get(handle.rootId);
                return !!wall && !wall.isBroken();
            });
        },
        getEditorObjects: (): readonly TestWorldEditorObjectSummary[] => {
            return objectSummaries
                .filter((entry) => {
                    if (entry.type !== 'triangleFlightBreakWall') {
                        return true;
                    }
                    const wall = triangleFlightBreakWallsById.get(entry.id);
                    return !!wall && !wall.isBroken();
                })
                .map((entry) => ({
                    ...entry,
                    locked: bindings.get(entry.id)?.isLocked() ?? entry.locked,
                    runtimeVisual: resolveRuntimeVisualSummary(config, entry.type, entry.id),
                    onlyDebugView: (getConfigReference(config, entry.type, entry.id) as TestWorldVisualOrderConfig | null)
                        ?.onlyDebugView
                }));
        },
        getEditorHandle: (id: string): TestWorldEditorHandle | null => handleMap.get(id) ?? null,
        patchObjectBounds: (handleId: string, bounds: TestWorldEditorBounds): boolean => {
            const handle = handleMap.get(handleId);
            if (!handle) {
                return false;
            }
            const binding = bindings.get(handle.rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            const definition = binding.handleDefinitions.find((entry) => entry.id === handleId);
            if (!definition) {
                return false;
            }

            const targetConfig = getConfigReference(config, binding.type, handle.rootId);
            if (!targetConfig) {
                return false;
            }

            definition.setBounds(targetConfig as never, bounds);
            binding.refresh();
            refreshVisualDepths();
            return true;
        },
        patchObjectFields: (rootId: string, patch: Record<string, unknown>): boolean => {
            const binding = bindings.get(rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            const configRef = getConfigReference(config, binding.type, rootId) as Record<string, unknown> | null;
            if (configRef) {
                if ('editorFillColor' in patch && typeof patch.editorFillColor === 'string') {
                    configRef.editorFillColor = patch.editorFillColor;
                }
                if ('editorStrokeColor' in patch && typeof patch.editorStrokeColor === 'string') {
                    configRef.editorStrokeColor = patch.editorStrokeColor;
                }
            }
            binding.patchFields(patch);
            refreshVisualDepths();
            return true;
        },
        patchNpcFields: (id: string, patch: Record<string, unknown>): boolean => {
            const binding = bindings.get(id);
            if (!binding || binding.type !== 'npc' || binding.isLocked()) {
                return false;
            }
            const npcConfig = config.npcs.find((entry) => entry.id === id);
            if (!npcConfig) {
                return false;
            }
            const onlyPositionPatch = Object.keys(patch).every((key) => key === 'x' || key === 'y');
            if (!onlyPositionPatch) {
                binding.patchFields(patch);
                refreshVisualDepths();
                return true;
            }
            const nextX = typeof patch.x === 'number' && Number.isFinite(patch.x) ? patch.x : npcConfig.x;
            const nextY = typeof patch.y === 'number' && Number.isFinite(patch.y) ? patch.y : npcConfig.y;
            if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
                return false;
            }
            TEST_WORLD_EDITOR_ADAPTERS.npc.patchFields(npcConfig, { x: nextX, y: nextY });
            const patchedRuntimeActor = npcRuntime.patchActorPosition(id, nextX, nextY, { syncPatrolOrigin: true });
            if (!patchedRuntimeActor) {
                return false;
            }
            refreshVisualDepths();
            return true;
        },
        patchObjectColors: (rootId: string, patch: Record<string, unknown>): boolean => {
            const binding = bindings.get(rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            binding.patchColors(patch);
            refreshVisualDepths();
            return true;
        },
        patchObjectDebugVisibility: (rootId: string, onlyDebugView: boolean): boolean => {
            const binding = bindings.get(rootId);
            if (!binding || binding.isLocked()) {
                return false;
            }
            const configRef = getConfigReference(config, binding.type, rootId) as Record<string, unknown> | null;
            if (configRef) {
                const previousOnlyDebugView = configRef.onlyDebugView;
                if (previousOnlyDebugView === onlyDebugView) {
                    return true;
                }
                configRef.onlyDebugView = onlyDebugView;
            }
            refreshVisualDepths();
            return true;
        },
        setEditorDebugViewActive: (active: boolean): void => {
            editorDebugViewActive = active;
            refreshVisualDepths();
        },
        setSurfaceMoveRuntimeEditingActive: (surfaceId: string, active: boolean): boolean => {
            return setSurfaceMoveRuntimeEditingActive(surfaceId, active);
        },
        setObjectLocked: (rootId: string, locked: boolean): boolean => {
            const binding = bindings.get(rootId);
            if (!binding) {
                return false;
            }
            binding.setLocked(locked);
            return true;
        },
        focusObjectPoint: (targetId: string): { x: number; y: number } | null => {
            const handle = handleMap.get(targetId)
                ?? [...handleMap.values()].find((entry) => entry.rootId === targetId)
                ?? null;
            if (!handle) {
                return null;
            }
            const bounds = handle.getBounds();
            return { x: bounds.x, y: bounds.y };
        },
        destroy: (): void => {
            destroyColliderList(playerDragBoxColliders);
            destroyColliderList(dragBoxWorldColliders);
            destroyColliderList(overlapColliders);
            movingPlatforms.forEach((entry) => entry.destroy());
            dragBoxes.forEach((entry) => entry.destroy());
            triggerPlatforms.forEach((entry) => entry.destroy());
            triggerVolumes.forEach((entry) => entry.destroy());
            windZones.forEach((entry) => entry.destroy());
            trianglePickups.forEach((entry) => entry.destroy());
            windZoneDecorationObjectsById.clear();
            pickupDecorationObjectsById.clear();
            triangleFlightBreakWallsById.clear();
            cleanup.forEach((cleanupFn) => cleanupFn());
        }
    };
};

const resolveWorldLogicEventId = (event: TestWorldLogicEvent): string => {
    if (event.kind === 'object_state_changed') {
        return `object_state_changed:${event.objectId}:${event.toState}`;
    }
    if (event.kind === 'trigger_event') {
        return `trigger_event:${event.eventId}`;
    }
    if (event.kind === 'npc_event') {
        return `npc_event:${event.actorId}:${event.eventId}`;
    }
    return `cutscene_finished:${event.cutsceneRef}`;
};

const emitWorldEventDebug = (
    eventDebugSink: TestWorldDebugEventSink | undefined,
    event: TestWorldLogicEvent
): void => {
    if (!eventDebugSink) {
        return;
    }

    const payload: Record<string, unknown> = {
        kind: event.kind
    };
    if (event.kind === 'object_state_changed') {
        payload.objectId = event.objectId;
        payload.fromState = event.fromState ?? null;
        payload.toState = event.toState;
    } else if (event.kind === 'trigger_event') {
        payload.triggerEventId = event.eventId;
        payload.sourceId = event.sourceId ?? null;
    } else if (event.kind === 'npc_event') {
        payload.actorId = event.actorId;
        payload.npcEventId = event.eventId;
    } else {
        payload.cutsceneRef = event.cutsceneRef;
    }

    const debugType: DebugEventType = 'world.event';
    const entry: EventDebugRecordInput = {
        type: debugType,
        source: 'test_world_runtime',
        eventId: resolveWorldLogicEventId(event),
        message: `world logic event: ${event.kind}`,
        payload
    };
    eventDebugSink(entry);
};

const refreshRectangleGameObject = (
    scene: Scene,
    rectangle: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc,
    x: number,
    y: number,
    width: number,
    height: number
): void => {
    rectangle.setPosition(x, y);
    if (rectangle instanceof Phaser.GameObjects.Rectangle) {
        rectangle.setSize(width, height);
    } else {
        rectangle.setRadius(Math.max(width, height) * 0.5);
    }

    const body = rectangle.body as Physics.Arcade.StaticBody | Physics.Arcade.Body | undefined;
    if (body instanceof Physics.Arcade.Body) {
        body.setSize(width, height, true);
    }
    body?.updateFromGameObject();
    scene.children.bringToTop(rectangle);
};

const replaceSurfaceMatterBody = (
    scene: Scene,
    surface: Phaser.GameObjects.Rectangle,
    config: TestWorldSurfaceConfig
): void => {
    const existingMatterBody = surface.getData('pf_matter_body') as MatterJS.BodyType | undefined;
    if (existingMatterBody) {
        scene.matter.world.remove(existingMatterBody);
    }
    if (!isSurfaceSolid(config)) {
        surface.setData('pf_world_surface_kind', null);
        surface.setData('pf_matter_body', null);
        return;
    }
    const matterBody = scene.matter.add.rectangle(config.x, config.y, config.width, config.height, { isStatic: true }) as SurfaceMoveMatterBody;
    markMatterBodyAsPlatformSurface(matterBody);
    matterBody.pfCarryDeltaX = 0;
    matterBody.pfCarryDeltaY = 0;
    markAsPlatformSurface(surface);
    surface.setData('pf_matter_body', matterBody);
};

const syncSurfaceObject = (
    scene: Scene,
    surface: Phaser.GameObjects.Rectangle,
    config: TestWorldSurfaceConfig
): void => {
    refreshRectangleGameObject(scene, surface, config.x, config.y, config.width, config.height);
    const alpha = config.alpha ?? (isSurfaceSolid(config) ? 1 : 0.45);
    surface.setFillStyle(config.fillColor, alpha);
    surface.setStrokeStyle(0, config.strokeColor, 0);
    const body = surface.body as Physics.Arcade.StaticBody | Physics.Arcade.Body | undefined;
    if (body instanceof Physics.Arcade.Body) {
        body.enable = isSurfaceSolid(config);
        body.setImmovable(true);
        body.setAllowGravity(false);
        body.pushable = false;
        if (body.enable) {
            body.updateFromGameObject();
        }
    } else if (body) {
        body.enable = isSurfaceSolid(config);
        if (body.enable) {
            body.updateFromGameObject();
        }
    }
};

const syncHazardObject = (
    scene: Scene,
    hazard: HazardObject,
    config: TestWorldHazardConfig
): void => {
    refreshRectangleGameObject(scene, hazard.trigger, config.x, config.y, config.width, config.height);
    hazard.trigger.setFillStyle(config.fillColor ?? 0xef5350, 0.75);
    hazard.trigger.setStrokeStyle(2, config.strokeColor ?? 0xb71c1c);
};

const syncFinishTriggerObject = (
    scene: Scene,
    finish: { trigger: Phaser.GameObjects.Rectangle },
    config: TestWorldFinishConfig
): void => {
    refreshRectangleGameObject(scene, finish.trigger, config.x, config.y, config.width, config.height);
    finish.trigger.setFillStyle(config.fillColor ?? 0x99ff99, 0.28);
    finish.trigger.setStrokeStyle(2, config.strokeColor ?? 0x00aa66);
};

const syncTriggerVolumeObject = (
    scene: Scene,
    triggerVolume: TriggerVolumeObject,
    config: TestWorldTriggerVolumeConfig
): void => {
    refreshRectangleGameObject(scene, triggerVolume.triggerZone, config.triggerX, config.triggerY, config.triggerWidth, config.triggerHeight);
    triggerVolume.triggerZone.setFillStyle(config.triggerFillColor ?? 0xb3e5fc, 0.3);
    triggerVolume.triggerZone.setStrokeStyle(2, config.triggerStrokeColor ?? 0x0277bd);
    if (triggerVolume.deactivateTriggerZone) {
        const x = config.deactivateTriggerX ?? config.triggerX;
        const y = config.deactivateTriggerY ?? config.triggerY;
        const width = config.deactivateTriggerWidth ?? config.triggerWidth;
        const height = config.deactivateTriggerHeight ?? config.triggerHeight;
        refreshRectangleGameObject(scene, triggerVolume.deactivateTriggerZone, x, y, width, height);
        triggerVolume.deactivateTriggerZone.setFillStyle(config.deactivateTriggerFillColor ?? 0xffccbc, 0.28);
        triggerVolume.deactivateTriggerZone.setStrokeStyle(2, config.deactivateTriggerStrokeColor ?? 0xe64a19);
    }
};

const syncBreakWallObject = (
    scene: Scene,
    wall: TriangleFlightBreakWallObject,
    config: TestWorldTriangleFlightBreakWallConfig
): void => {
    refreshRectangleGameObject(scene, wall.bodyObject, config.x, config.y, config.width, config.height);
    wall.bodyObject.setFillStyle(config.fillColor ?? 0x8d6e63, 0.95);
    wall.bodyObject.setStrokeStyle(2, config.strokeColor ?? 0x4e342e);
    scene.matter.world.remove(wall.matterBody);
    wall.matterBody = scene.matter.add.rectangle(config.x, config.y, config.width, config.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(wall.matterBody);
};

const refreshCheckpointObject = (
    scene: Scene,
    checkpoint: CheckpointObject,
    config: TestWorldCheckpointConfig
): void => {
    refreshRectangleGameObject(scene, checkpoint.trigger, config.x, config.y, config.width, config.height);
    checkpoint.beacon.setPosition(config.x, config.y - (config.height * 0.5) - 14);
    checkpoint.trigger.setFillStyle(config.fillColor ?? 0x90caf9, 0.35);
    checkpoint.trigger.setStrokeStyle(2, config.strokeColor ?? 0x64b5f6);
};

const createPlayerSpawnMarker = (scene: Scene, config: TestWorldPlayerSpawnConfig): PlayerSpawnMarkerObject => {
    const glow = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0x81d4fa, 0.12)
        .setDepth(4188);
    const body = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0x81d4fa, 0.28)
        .setStrokeStyle(2, config.strokeColor ?? 0x0277bd)
        .setDepth(4189);
    const crosshair = scene.add.graphics().setDepth(4190);

    const refresh = (): void => {
        glow.setPosition(config.x, config.y);
        glow.setSize(config.width, config.height);
        glow.setFillStyle(config.fillColor ?? 0x81d4fa, 0.12);
        body.setPosition(config.x, config.y);
        body.setSize(config.width, config.height);
        body.setFillStyle(config.fillColor ?? 0x81d4fa, 0.28);
        body.setStrokeStyle(2, config.strokeColor ?? 0x0277bd);
        crosshair.clear();
        crosshair.lineStyle(2, config.strokeColor ?? 0x0277bd, 1);
        crosshair.strokeLineShape(new Phaser.Geom.Line(config.x - 14, config.y, config.x + 14, config.y));
        crosshair.strokeLineShape(new Phaser.Geom.Line(config.x, config.y - 14, config.x, config.y + 14));
    };
    refresh();

    return {
        body,
        glow,
        crosshair,
        refresh,
        destroy: (): void => {
            glow.destroy();
            body.destroy();
            crosshair.destroy();
        }
    };
};

const createSurface = (
    scene: Scene,
    config: TestWorldSurfaceConfig
): Phaser.GameObjects.Rectangle => {
    const surface = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor)
        .setName(config.id)
        .setDepth(4200);

    // Use a stable dynamic immovable Arcade body for every surface to keep
    // live move assignment idempotent and avoid runtime body mode swaps.
    scene.physics.add.existing(surface, false);
    if (surface.body instanceof Physics.Arcade.Body) {
        surface.body.setImmovable(true);
        surface.body.setAllowGravity(false);
        surface.body.pushable = false;
    }
    if (isSurfaceSolid(config)) {
        const matterBody = scene.matter.add.rectangle(surface.x, surface.y, surface.width, surface.height, { isStatic: true }) as SurfaceMoveMatterBody;
        markMatterBodyAsPlatformSurface(matterBody);
        matterBody.pfCarryDeltaX = 0;
        matterBody.pfCarryDeltaY = 0;
        markAsPlatformSurface(surface);
        surface.setData('pf_matter_body', matterBody);
    } else {
        surface.setData('pf_world_surface_kind', null);
        surface.setData('pf_matter_body', null);
    }
    syncSurfaceObject(scene, surface, config);
    return surface;
};

const createFinishTrigger = (scene: Scene, config: TestWorldFinishConfig): FinishTriggerObject => {
    const trigger = scene.add.rectangle(config.x, config.y, config.width, config.height, config.fillColor ?? 0x99ff99, 0.28)
        .setStrokeStyle(2, config.strokeColor ?? 0x00aa66)
        .setDepth(4195);
    scene.physics.add.existing(trigger, true);
    syncFinishTriggerObject(scene, { trigger }, config);

    return {
        trigger,
        refresh: () => {
            syncFinishTriggerObject(scene, { trigger }, config);
        },
        destroy: () => {
            trigger.destroy();
        }
    };
};

const createTriggerVolume = (
    scene: Scene,
    config: TestWorldTriggerVolumeConfig
): TriggerVolumeObject => {
    const triggerZone = scene.add.rectangle(
        config.triggerX,
        config.triggerY,
        config.triggerWidth,
        config.triggerHeight,
        config.triggerFillColor ?? 0xb3e5fc,
        0.3
    )
        .setStrokeStyle(2, config.triggerStrokeColor ?? 0x0277bd)
        .setDepth(4201);
    scene.physics.add.existing(triggerZone, true);
    const triggerBody = triggerZone.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    const deactivateTriggerZone = (
        typeof config.deactivateTriggerX === 'number'
        && typeof config.deactivateTriggerY === 'number'
        && typeof config.deactivateTriggerWidth === 'number'
        && typeof config.deactivateTriggerHeight === 'number'
    )
        ? scene.add.rectangle(
            config.deactivateTriggerX,
            config.deactivateTriggerY,
            config.deactivateTriggerWidth,
            config.deactivateTriggerHeight,
            config.deactivateTriggerFillColor ?? 0xffccbc,
            0.28
        )
            .setStrokeStyle(2, config.deactivateTriggerStrokeColor ?? 0xe64a19)
            .setDepth(4201)
        : null;
    if (deactivateTriggerZone) {
        scene.physics.add.existing(deactivateTriggerZone, true);
        const deactivateBody = deactivateTriggerZone.body as Physics.Arcade.StaticBody;
        deactivateBody.checkCollision.none = false;
        deactivateBody.checkCollision.up = false;
        deactivateBody.checkCollision.down = false;
        deactivateBody.checkCollision.left = false;
        deactivateBody.checkCollision.right = false;
    }

    const runtime: TriggerVolumeObject = {
        id: config.id,
        triggerZone,
        deactivateTriggerZone,
        refresh: () => {
            syncTriggerVolumeObject(scene, runtime, config);
        },
        destroy: () => {
            triggerZone.destroy();
            deactivateTriggerZone?.destroy();
        }
    };
    runtime.refresh();
    return runtime;
};

const getConfigReference = (config: TestWorldConfig, type: TestWorldEditorObjectType, rootId: string): unknown => {
    if (type === 'playerSpawn') {
        return config.playerSpawn;
    }
    if (type === 'finish') {
        return config.finish?.id === rootId ? config.finish : null;
    }
    if (type === 'surface') {
        return config.surfaces.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'npc') {
        return config.npcs.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'hazard') {
        return config.hazards.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'checkpoint') {
        return config.checkpoints.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'movingPlatform') {
        return config.movingPlatforms.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'triggerPlatform') {
        return config.triggerPlatforms.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'triggerVolume') {
        return config.triggerVolumes.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'dragBox') {
        return config.dragBoxes.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'windZone') {
        return config.windZones.find((entry) => entry.id === rootId) ?? null;
    }
    if (type === 'triangleFlightBreakWall') {
        return config.triangleFlightBreakWalls.find((entry) => entry.id === rootId) ?? null;
    }
    return config.trianglePickups.find((entry) => entry.id === rootId) ?? null;
};

const rgbIntToHex = (value: number | undefined): string | undefined => {
    if (!Number.isFinite(value)) {
        return undefined;
    }
    const clamped = Math.max(0, Math.min(0xffffff, Math.floor(value as number)));
    return `#${clamped.toString(16).padStart(6, '0')}`;
};

const resolveRuntimeVisualSummary = (
    config: TestWorldConfig,
    type: TestWorldEditorObjectType,
    rootId: string
): {
    fillColor?: string;
    strokeColor?: string;
    alpha?: number;
    layer?: number;
    shaderKey?: string | null;
    textureKey?: string | null;
} | undefined => {
    const ref = getConfigReference(config, type, rootId) as Record<string, unknown> | null;
    if (!ref) {
        return undefined;
    }
    const visualLayer = typeof ref.visualLayer === 'string' && /^layer_[1-5]$/.test(ref.visualLayer)
        ? Number((ref.visualLayer as string).slice('layer_'.length))
        : undefined;
    const alpha = typeof ref.alpha === 'number' && Number.isFinite(ref.alpha)
        ? Math.max(0, Math.min(1, ref.alpha))
        : undefined;
    const editorFillColor = typeof ref.editorFillColor === 'string' ? ref.editorFillColor : undefined;
    const editorStrokeColor = typeof ref.editorStrokeColor === 'string' ? ref.editorStrokeColor : undefined;
    if (type === 'triggerPlatform') {
        const fillColor = rgbIntToHex(ref.platformFillColor as number | undefined);
        const strokeColor = rgbIntToHex(ref.platformStrokeColor as number | undefined);
        return {
            fillColor: editorFillColor ?? fillColor,
            strokeColor: editorStrokeColor ?? strokeColor,
            alpha,
            layer: visualLayer
        };
    }
    if (type === 'triggerVolume') {
        const fillColor = rgbIntToHex(ref.triggerFillColor as number | undefined);
        const strokeColor = rgbIntToHex(ref.triggerStrokeColor as number | undefined);
        return {
            fillColor: editorFillColor ?? fillColor,
            strokeColor: editorStrokeColor ?? strokeColor,
            alpha,
            layer: visualLayer
        };
    }
    const fillColor = rgbIntToHex(ref.fillColor as number | undefined);
    const strokeColor = rgbIntToHex(ref.strokeColor as number | undefined);
    return {
        fillColor: editorFillColor ?? fillColor,
        strokeColor: editorStrokeColor ?? strokeColor,
        alpha,
        layer: visualLayer
    };
};

const applyActiveCheckpointState = (
    checkpointsById: Map<string, CheckpointObject>,
    checkpointConfigs: TestWorldCheckpointConfig[],
    activeCheckpointId: string | null,
    onCheckpointActivated: (point: RespawnPoint) => void
): void => {
    const activeIndex = checkpointConfigs.findIndex((entry) => entry.id === activeCheckpointId);
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const activeConfig = checkpointConfigs[safeIndex];
    if (activeConfig) {
        onCheckpointActivated({
            x: activeConfig.respawnX,
            y: activeConfig.respawnY
        });
    }

    checkpointConfigs.forEach((checkpointConfig, index) => {
        checkpointsById.get(checkpointConfig.id)?.setActive(index === safeIndex);
    });
};
