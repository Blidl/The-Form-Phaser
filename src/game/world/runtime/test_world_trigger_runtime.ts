import type { Scene } from 'phaser';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
import type { ActorAction } from '../../actor_actions/actor_action_types';
import {
    executeTestEventBlock,
    type TestEventBlockExecutionResult,
    type TestEventRuntimeContext
} from '../../events/test_event_actions';
import {
    getWorldFlag,
    setWorldFlag
} from '../../events/test_world_flags';
import type { DraggableBoxObject } from '../draggable_box';
import type { TriggerPlatformObject } from '../trigger_platform';
import type {
    TestWorldDragBoxConfig,
    TestWorldMovingPlatformMotionState,
    TestWorldTriggerCommandConfig,
    TestWorldTriggerPlatformAction,
    TestWorldTriggerPlatformConfig,
    TestWorldTriggerVolumeConfig
} from './test_world_config';

const DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON = 16;

export interface TestWorldTriggerRuntime {
    update: () => void;
}

export interface TestWorldTriggerVolumeRuntime {
    id: string;
    triggerZone: Phaser.GameObjects.Rectangle;
    deactivateTriggerZone: Phaser.GameObjects.Rectangle | null;
}

interface CreateTestWorldTriggerRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    triggerPlatformConfigs: readonly TestWorldTriggerPlatformConfig[];
    triggerVolumeConfigs: readonly TestWorldTriggerVolumeConfig[];
    dragBoxConfigs: readonly TestWorldDragBoxConfig[];
    getTriggerPlatform: (id: string) => TriggerPlatformObject | null;
    getTriggerVolume: (id: string) => TestWorldTriggerVolumeRuntime | null;
    getDragBox: (id: string) => DraggableBoxObject | null;
    setTriggerPlatformActive: (id: string, active: boolean) => void;
    setMovingPlatformMotionState: (id: string, mode: TestWorldMovingPlatformMotionState) => void;
    setNpcPresentationEmotionFromTrigger: (id: string, emotionId: string) => boolean;
    getPlayerFormId: () => string | null;
    executeActorAction: (actorId: string, action: ActorAction) => boolean;
    startCutscene: (cutsceneRef: string) => boolean;
    dispatchTriggerEvent?: (eventId: string, payload?: Record<string, unknown>) => boolean;
    playSfx?: (sfxId: string) => boolean;
    spawnVfx?: (vfxId: string, actorId?: string, x?: number, y?: number) => boolean;
    onTriggerEnter?: (triggerId: string, sourceId: string) => void;
}

interface TriggerSourceRuntime {
    id: string;
    bodyObject: Phaser.GameObjects.GameObject;
    isSettling: () => boolean;
}

interface TriggerOccupancyState {
    insideTriggerZone: Set<string>;
    insideDeactivateZone: Set<string>;
}

interface TriggerBlockExecutionRecord {
    triggerId: string;
    sourceId: string;
    phase: 'onEnter' | 'onExit' | 'onStay';
    blockResult: TestEventBlockExecutionResult;
}

interface TriggerTickExecutionState {
    enteredTriggerIds: Set<string>;
}

export const createTestWorldTriggerRuntime = (
    params: CreateTestWorldTriggerRuntimeParams
): TestWorldTriggerRuntime => {
    const occupancyByTriggerId = new Map<string, TriggerOccupancyState>();
    const consumedOnceKeys = new Set<string>();
    let isUpdateInProgress = false;
    const eventRuntimeContext: TestEventRuntimeContext = {
        getWorldFlag,
        setWorldFlag,
        getPlayerFormId: () => params.getPlayerFormId(),
        executeActorAction: (actorId, action) => params.executeActorAction(actorId, action),
        startCutscene: (cutsceneRef) => params.startCutscene(cutsceneRef),
        dispatchTriggerEvent: params.dispatchTriggerEvent,
        playSfx: params.playSfx,
        spawnVfx: params.spawnVfx,
        isOnceConsumed: (key) => consumedOnceKeys.has(key),
        consumeOnceKey: (key) => {
            consumedOnceKeys.add(key);
        }
    };

    return {
        update: (): void => {
            if (isUpdateInProgress) {
                return;
            }
            isUpdateInProgress = true;
            const tickExecutionState: TriggerTickExecutionState = {
                enteredTriggerIds: new Set<string>()
            };
            try {
                const triggerPlatformConfigs = [...params.triggerPlatformConfigs];
                triggerPlatformConfigs.forEach((triggerConfig) => {
                    const triggerPlatform = params.getTriggerPlatform(triggerConfig.id);
                    if (!triggerPlatform) {
                        occupancyByTriggerId.delete(triggerConfig.id);
                        return;
                    }

                    const volumeRuntime: TestWorldTriggerVolumeRuntime = {
                        id: triggerConfig.id,
                        triggerZone: triggerPlatform.triggerZone,
                        deactivateTriggerZone: triggerPlatform.deactivateTriggerZone
                    };
                    const sources = resolveSourcesForActivator(
                        triggerConfig.activator,
                        undefined,
                        params.player,
                        params.dragBoxConfigs,
                        params.getDragBox
                    );
                    stepTriggerVolume(
                        params.scene,
                        triggerConfig.id,
                        volumeRuntime,
                        sources,
                        createLegacyTriggerEnterCommand(triggerConfig),
                        createLegacyTriggerExitCommand(triggerConfig),
                        undefined,
                        undefined,
                        undefined,
                        occupancyByTriggerId,
                        (command) => executeTriggerCommand(command, params),
                        (_record) => {},
                        eventRuntimeContext,
                        params.onTriggerEnter,
                        tickExecutionState
                    );
                });

                const triggerVolumeConfigs = [...params.triggerVolumeConfigs];
                triggerVolumeConfigs.forEach((triggerVolumeConfig) => {
                    const triggerVolume = params.getTriggerVolume(triggerVolumeConfig.id);
                    if (!triggerVolume) {
                        occupancyByTriggerId.delete(triggerVolumeConfig.id);
                        return;
                    }
                    const sources = resolveSourcesForActivator(
                        triggerVolumeConfig.activator,
                        triggerVolumeConfig.sourceIds,
                        params.player,
                        params.dragBoxConfigs,
                        params.getDragBox
                    );
                    stepTriggerVolume(
                        params.scene,
                        triggerVolumeConfig.id,
                        triggerVolume,
                        sources,
                        triggerVolumeConfig.enterCommand ?? null,
                        triggerVolumeConfig.exitCommand ?? null,
                        triggerVolumeConfig.onEnter,
                        triggerVolumeConfig.onExit,
                        triggerVolumeConfig.onStay,
                        occupancyByTriggerId,
                        (command) => executeTriggerCommand(command, params),
                        (_record) => {},
                        eventRuntimeContext,
                        params.onTriggerEnter,
                        tickExecutionState
                    );
                });
            } finally {
                isUpdateInProgress = false;
            }
        }
    };
};

const stepTriggerVolume = (
    scene: Scene,
    triggerId: string,
    triggerVolume: TestWorldTriggerVolumeRuntime,
    sources: readonly TriggerSourceRuntime[],
    enterCommand: TestWorldTriggerCommandConfig | null,
    exitCommand: TestWorldTriggerCommandConfig | null,
    onEnterBlocks: readonly TestEventBlock[] | undefined,
    onExitBlocks: readonly TestEventBlock[] | undefined,
    onStayBlocks: readonly TestEventBlock[] | undefined,
    occupancyByTriggerId: Map<string, TriggerOccupancyState>,
    executeCommand: (command: TestWorldTriggerCommandConfig) => void,
    onBlockExecution: (record: TriggerBlockExecutionRecord) => void,
    eventRuntimeContext: TestEventRuntimeContext,
    onTriggerEnter: ((triggerId: string, sourceId: string) => void) | undefined,
    tickExecutionState: TriggerTickExecutionState
): void => {
    const previousOccupancy = occupancyByTriggerId.get(triggerId) ?? {
        insideTriggerZone: new Set<string>(),
        insideDeactivateZone: new Set<string>()
    };
    const nextOccupancy: TriggerOccupancyState = {
        insideTriggerZone: new Set<string>(),
        insideDeactivateZone: new Set<string>()
    };
    const enteredTriggerSourceIds: string[] = [];
    const stayedTriggerSourceIds: string[] = [];
    const enteredDeactivateSourceIds: string[] = [];

    sources.forEach((source) => {
        const wasInsideTriggerZone = previousOccupancy.insideTriggerZone.has(source.id);
        const isInsideTriggerZone = scene.physics.overlap(source.bodyObject, triggerVolume.triggerZone)
            || (wasInsideTriggerZone && source.isSettling());
        if (isInsideTriggerZone) {
            nextOccupancy.insideTriggerZone.add(source.id);
            if (!wasInsideTriggerZone) {
                enteredTriggerSourceIds.push(source.id);
            } else {
                stayedTriggerSourceIds.push(source.id);
            }
        }

        const wasInsideDeactivateZone = previousOccupancy.insideDeactivateZone.has(source.id);
        const isInsideDeactivateZone = triggerVolume.deactivateTriggerZone !== null && (
            scene.physics.overlap(source.bodyObject, triggerVolume.deactivateTriggerZone)
            || (wasInsideDeactivateZone && source.isSettling())
        );
        if (isInsideDeactivateZone) {
            nextOccupancy.insideDeactivateZone.add(source.id);
            if (!wasInsideDeactivateZone) {
                enteredDeactivateSourceIds.push(source.id);
            }
        }
    });

    // Commit occupancy before executing enter callbacks/commands to avoid re-entry loops.
    occupancyByTriggerId.set(triggerId, nextOccupancy);

    const canRunEnterForTrigger = !tickExecutionState.enteredTriggerIds.has(triggerId);
    if (enteredTriggerSourceIds.length > 0 && canRunEnterForTrigger) {
        tickExecutionState.enteredTriggerIds.add(triggerId);
        if (enterCommand) {
            executeCommand(enterCommand);
        }
        enteredTriggerSourceIds.forEach((sourceId) => {
            onTriggerEnter?.(triggerId, sourceId);
            executeTriggerEventBlocks(triggerId, sourceId, 'onEnter', onEnterBlocks, onBlockExecution, eventRuntimeContext);
        });
    }

    stayedTriggerSourceIds.forEach((sourceId) => {
        executeTriggerEventBlocks(triggerId, sourceId, 'onStay', onStayBlocks, onBlockExecution, eventRuntimeContext);
    });
    if (enteredDeactivateSourceIds.length > 0) {
        if (exitCommand) {
            executeCommand(exitCommand);
        }
        enteredDeactivateSourceIds.forEach((sourceId) => {
            executeTriggerEventBlocks(triggerId, sourceId, 'onExit', onExitBlocks, onBlockExecution, eventRuntimeContext);
        });
    }
};

const executeTriggerEventBlocks = (
    triggerId: string,
    sourceId: string,
    phase: 'onEnter' | 'onExit' | 'onStay',
    blocks: readonly TestEventBlock[] | undefined,
    onBlockExecution: (record: TriggerBlockExecutionRecord) => void,
    eventRuntimeContext: TestEventRuntimeContext
): void => {
    if (!blocks || blocks.length <= 0) {
        return;
    }

    blocks.forEach((block, index) => {
        const normalizedBlockId = typeof block.id === 'string' && block.id.trim().length > 0
            ? block.id.trim()
            : `block_${index + 1}`;
        const ownerKey = `trigger:${triggerId}:${phase}:${normalizedBlockId}`;
        const blockResult = executeTestEventBlock(eventRuntimeContext, block, ownerKey);
        onBlockExecution({
            triggerId,
            sourceId,
            phase,
            blockResult
        });
    });
};

const resolveSourcesForActivator = (
    activator: 'player' | 'drag_box',
    sourceIds: readonly string[] | undefined,
    player: PlayerWorldActor,
    dragBoxConfigs: readonly TestWorldDragBoxConfig[],
    getDragBox: (id: string) => DraggableBoxObject | null
): TriggerSourceRuntime[] => {
    if (activator === 'player') {
        return [{
            id: 'player',
            bodyObject: player.arcadeBodyObject,
            isSettling: () => false
        }];
    }

    const allowedIds = sourceIds && sourceIds.length > 0 ? new Set(sourceIds) : null;
    return dragBoxConfigs
        .filter((dragBoxConfig) => allowedIds === null || allowedIds.has(dragBoxConfig.id))
        .map((dragBoxConfig) => {
            const dragBox = getDragBox(dragBoxConfig.id);
            if (!dragBox) {
                return null;
            }
            return {
                id: dragBoxConfig.id,
                bodyObject: dragBox.bodyObject,
                isSettling: () => isDragBoxStillMoving(dragBox)
            };
        })
        .filter((entry): entry is TriggerSourceRuntime => entry !== null);
};

const createLegacyTriggerEnterCommand = (
    triggerConfig: TestWorldTriggerPlatformConfig
): TestWorldTriggerCommandConfig => ({
    targetType: 'trigger_platform',
    targetId: triggerConfig.id,
    operation: 'set_active',
    value: resolveTriggerActionState(triggerConfig.triggerAction)
});

const createLegacyTriggerExitCommand = (
    triggerConfig: TestWorldTriggerPlatformConfig
): TestWorldTriggerCommandConfig => ({
    targetType: 'trigger_platform',
    targetId: triggerConfig.id,
    operation: 'set_active',
    value: resolveTriggerActionState(triggerConfig.deactivateTriggerAction)
});

const executeTriggerCommand = (
    command: TestWorldTriggerCommandConfig,
    params: CreateTestWorldTriggerRuntimeParams
): void => {
    if (command.targetType === 'trigger_platform' && command.operation === 'set_active' && typeof command.value === 'boolean') {
        params.setTriggerPlatformActive(command.targetId, command.value);
        return;
    }
    if (command.targetType === 'moving_platform' && command.operation === 'set_motion_state' && typeof command.value === 'string') {
        params.setMovingPlatformMotionState(command.targetId, command.value);
        return;
    }
    if (command.targetType === 'npc' && command.operation === 'set_emotion' && typeof command.value === 'string') {
        params.setNpcPresentationEmotionFromTrigger(command.targetId, command.value);
    }
};

const resolveTriggerActionState = (action: TestWorldTriggerPlatformAction): boolean => {
    return action === 'activate';
};

const isDragBoxStillMoving = (dragBox: DraggableBoxObject): boolean => {
    return Math.abs(dragBox.body.velocity.x) > DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON
        || Math.abs(dragBox.body.velocity.y) > DRAG_BOX_TRIGGER_RELEASE_SPEED_EPSILON;
};
