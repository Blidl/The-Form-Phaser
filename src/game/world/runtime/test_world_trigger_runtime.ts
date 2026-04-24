import type { Scene } from 'phaser';
import type { PlayerWorldActor } from '../../player/player_runtime_contracts';
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

export const createTestWorldTriggerRuntime = (
    params: CreateTestWorldTriggerRuntimeParams
): TestWorldTriggerRuntime => {
    const occupancyByTriggerId = new Map<string, TriggerOccupancyState>();

    return {
        update: (): void => {
            params.triggerPlatformConfigs.forEach((triggerConfig) => {
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
                    occupancyByTriggerId,
                    (command) => executeTriggerCommand(command, params)
                );
            });

            params.triggerVolumeConfigs.forEach((triggerVolumeConfig) => {
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
                    occupancyByTriggerId,
                    (command) => executeTriggerCommand(command, params)
                );
            });
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
    occupancyByTriggerId: Map<string, TriggerOccupancyState>,
    executeCommand: (command: TestWorldTriggerCommandConfig) => void
): void => {
    const previousOccupancy = occupancyByTriggerId.get(triggerId) ?? {
        insideTriggerZone: new Set<string>(),
        insideDeactivateZone: new Set<string>()
    };
    const nextOccupancy: TriggerOccupancyState = {
        insideTriggerZone: new Set<string>(),
        insideDeactivateZone: new Set<string>()
    };

    sources.forEach((source) => {
        const isInsideTriggerZone = scene.physics.overlap(source.bodyObject, triggerVolume.triggerZone)
            || (previousOccupancy.insideTriggerZone.has(source.id) && source.isSettling());
        if (isInsideTriggerZone) {
            nextOccupancy.insideTriggerZone.add(source.id);
            if (!previousOccupancy.insideTriggerZone.has(source.id) && enterCommand) {
                executeCommand(enterCommand);
            }
        }

        const isInsideDeactivateZone = triggerVolume.deactivateTriggerZone !== null && (
            scene.physics.overlap(source.bodyObject, triggerVolume.deactivateTriggerZone)
            || (previousOccupancy.insideDeactivateZone.has(source.id) && source.isSettling())
        );
        if (isInsideDeactivateZone) {
            nextOccupancy.insideDeactivateZone.add(source.id);
            if (!previousOccupancy.insideDeactivateZone.has(source.id) && exitCommand) {
                executeCommand(exitCommand);
            }
        }
    });

    occupancyByTriggerId.set(triggerId, nextOccupancy);
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
