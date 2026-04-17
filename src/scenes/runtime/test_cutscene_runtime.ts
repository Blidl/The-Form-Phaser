import type { Scene } from 'phaser';
import { refreshBaselineFollowCameraLerp } from '../../game/camera/follow_camera';
import type { PlayerWorldActor } from '../../game/player/player_runtime_contracts';
import { getTestCutsceneDefinition } from '../../game/cutscene/test_cutscene_registry';
import type {
    TestCutsceneActorSequenceRefStep,
    TestCutsceneCameraPanToStep,
    TestCutsceneDebugState,
    TestCutsceneDefinition,
    TestCutsceneRunStatus,
    TestCutsceneStep,
    TestCutsceneSubtitleStep
} from '../../game/cutscene/cutscene_types';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';

interface ActiveCutsceneRun {
    definition: TestCutsceneDefinition;
    stepIndex: number;
    waitRemainingMs: number | null;
    waitingActorSequence: {
        actorId: string;
        sequenceId: string;
    } | null;
    waitingCameraPan: boolean;
}

export interface TestCutsceneRuntime {
    update: (deltaMs: number) => void;
    tryStartCutsceneRef: (cutsceneRef: string, sourceDetail: string) => boolean;
    isRunning: () => boolean;
    isInputLocked: () => boolean;
    getDebugState: () => TestCutsceneDebugState;
    destroy: () => void;
}

interface CreateTestCutsceneRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    worldRuntime: Pick<
        TestWorldRuntime,
        'dispatchCutsceneActorSequenceRef' | 'getCutsceneActorSequenceSnapshot' | 'getNpcCameraFocusObject'
    >;
}

const clampDeltaMs = (deltaMs: number): number => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }
    return Math.min(deltaMs, 64);
};

const getStepRef = (step: TestCutsceneStep, stepIndex: number): string => {
    return step.ref && step.ref.trim().length > 0
        ? step.ref.trim()
        : `step_${stepIndex + 1}`;
};

export const createTestCutsceneRuntime = (
    params: CreateTestCutsceneRuntimeParams
): TestCutsceneRuntime => {
    const { scene, player, worldRuntime } = params;
    let activeRun: ActiveCutsceneRun | null = null;
    let inputLocked = false;
    let status: TestCutsceneRunStatus | null = null;
    let detail: string | null = null;

    const restorePlayerCameraFollow = (): void => {
        const camera = scene.cameras.main;
        camera.stopFollow();
        camera.startFollow(player.arcadeBodyObject, true);
        camera.setFollowOffset(0, 96);
        refreshBaselineFollowCameraLerp(camera);
    };

    const finishRun = (nextStatus: TestCutsceneRunStatus, nextDetail: string | null): void => {
        activeRun = null;
        status = nextStatus;
        detail = nextDetail;
        inputLocked = false;
        restorePlayerCameraFollow();
    };

    const resolveFocusObject = (actorId: string): Phaser.GameObjects.GameObject | null => {
        if (actorId === 'player') {
            return player.arcadeBodyObject;
        }
        return worldRuntime.getNpcCameraFocusObject(actorId);
    };

    const executeCameraPanStep = (step: TestCutsceneCameraPanToStep): void => {
        const camera = scene.cameras.main;
        camera.stopFollow();
        const durationMs = Math.max(0, Math.round(step.durationMs));
        if (durationMs <= 0) {
            camera.centerOn(step.x, step.y);
            if (activeRun) {
                activeRun.waitingCameraPan = false;
            }
            return;
        }
        if (activeRun) {
            activeRun.waitingCameraPan = true;
        }
        camera.pan(step.x, step.y, durationMs, step.ease ?? 'Sine.easeInOut', true, () => {
            if (activeRun) {
                activeRun.waitingCameraPan = false;
            }
        });
    };

    const emitSubtitleStub = (
        cutsceneRef: string,
        stepRef: string,
        subtitleStep: TestCutsceneSubtitleStep
    ): void => {
        // TEMPORARY: first-pass subtitle runtime uses a scene event stub
        // until a dedicated subtitle presentation layer is added.
        scene.events.emit('pf:cutscene_subtitle_stub', {
            cutsceneRef,
            stepRef,
            text: subtitleStep.text,
            durationMs: subtitleStep.durationMs ?? null
        });
    };

    const runActorSequenceStep = (
        cutsceneRef: string,
        stepRef: string,
        step: TestCutsceneActorSequenceRefStep
    ): boolean => {
        const dispatchResult = worldRuntime.dispatchCutsceneActorSequenceRef(
            step.actorId,
            step.sequenceRef,
            cutsceneRef,
            stepRef
        );
        if (dispatchResult.result !== 'dispatched' || !dispatchResult.sequenceId) {
            finishRun('failed', `actor_sequence_ref failed: ${dispatchResult.detail}`);
            return false;
        }
        if (activeRun) {
            activeRun.waitingActorSequence = {
                actorId: step.actorId,
                sequenceId: dispatchResult.sequenceId
            };
        }
        return true;
    };

    const executeInstantStep = (step: TestCutsceneStep, stepIndex: number): 'advanced' | 'blocked' => {
        if (!activeRun) {
            return 'blocked';
        }
        const cutsceneRef = activeRun.definition.id;
        const stepRef = getStepRef(step, stepIndex);

        if (step.kind === 'lock_input') {
            inputLocked = true;
            return 'advanced';
        }
        if (step.kind === 'unlock_input') {
            inputLocked = false;
            return 'advanced';
        }
        if (step.kind === 'camera_focus_actor') {
            const focusObject = resolveFocusObject(step.actorId);
            if (!focusObject) {
                finishRun('failed', `camera_focus_actor failed: missing actor "${step.actorId}"`);
                return 'blocked';
            }
            const camera = scene.cameras.main;
            camera.startFollow(focusObject, true);
            camera.setFollowOffset(0, 96);
            refreshBaselineFollowCameraLerp(camera);
            return 'advanced';
        }
        if (step.kind === 'camera_pan_to') {
            executeCameraPanStep(step);
            return 'blocked';
        }
        if (step.kind === 'wait') {
            activeRun.waitRemainingMs = Math.max(0, step.durationMs);
            return activeRun.waitRemainingMs <= 0 ? 'advanced' : 'blocked';
        }
        if (step.kind === 'play_sfx') {
            // TEMPORARY: first-pass SFX runtime uses a scene event stub.
            scene.events.emit('pf:cutscene_play_sfx_stub', {
                cutsceneRef,
                stepRef,
                sfxId: step.sfxId
            });
            return 'advanced';
        }
        if (step.kind === 'spawn_vfx') {
            // TEMPORARY: first-pass VFX runtime uses a scene event stub.
            scene.events.emit('pf:cutscene_spawn_vfx_stub', {
                cutsceneRef,
                stepRef,
                vfxId: step.vfxId,
                actorId: step.actorId ?? null,
                x: step.x ?? null,
                y: step.y ?? null
            });
            return 'advanced';
        }
        if (step.kind === 'subtitle') {
            emitSubtitleStub(cutsceneRef, stepRef, step);
            return 'advanced';
        }
        if (step.kind === 'actor_sequence_ref') {
            runActorSequenceStep(cutsceneRef, stepRef, step);
            return 'blocked';
        }
        finishRun('failed', `unsupported cutscene step kind "${step.kind}"`);
        return 'blocked';
    };

    const updateActiveRun = (deltaMs: number): void => {
        if (!activeRun) {
            return;
        }

        if (activeRun.waitingCameraPan) {
            return;
        }
        if (activeRun.waitingActorSequence) {
            const snapshot = worldRuntime.getCutsceneActorSequenceSnapshot(activeRun.waitingActorSequence.actorId);
            if (!snapshot || snapshot.sequenceId !== activeRun.waitingActorSequence.sequenceId) {
                finishRun('failed', 'actor_sequence_ref lost sequence snapshot');
                return;
            }
            if (snapshot.status === 'running') {
                return;
            }
            if (snapshot.status !== 'succeeded') {
                finishRun('failed', snapshot.failureReason ?? 'actor_sequence_ref did not succeed');
                return;
            }
            activeRun.waitingActorSequence = null;
            activeRun.stepIndex += 1;
        }
        if (!activeRun) {
            return;
        }
        if (activeRun.waitRemainingMs !== null) {
            activeRun.waitRemainingMs = Math.max(0, activeRun.waitRemainingMs - deltaMs);
            if (activeRun.waitRemainingMs > 0) {
                return;
            }
            activeRun.waitRemainingMs = null;
            activeRun.stepIndex += 1;
        }

        while (activeRun) {
            if (activeRun.stepIndex >= activeRun.definition.steps.length) {
                finishRun('completed', activeRun.definition.id);
                return;
            }
            const step = activeRun.definition.steps[activeRun.stepIndex];
            const stepResult = executeInstantStep(step, activeRun.stepIndex);
            if (!activeRun) {
                return;
            }
            if (stepResult !== 'advanced') {
                return;
            }
            activeRun.stepIndex += 1;
        }
    };

    const tryStartCutsceneRef = (cutsceneRef: string, sourceDetail: string): boolean => {
        const definition = getTestCutsceneDefinition(cutsceneRef);
        if (!definition) {
            status = 'failed';
            detail = `missing cutscene ref "${cutsceneRef}"`;
            return false;
        }

        if (activeRun) {
            finishRun('cancelled', `cancelled by ${sourceDetail}`);
        }
        activeRun = {
            definition,
            stepIndex: 0,
            waitRemainingMs: null,
            waitingActorSequence: null,
            waitingCameraPan: false
        };
        status = 'running';
        detail = sourceDetail;
        return true;
    };

    const onNpcCutsceneRequest = (payload: unknown): void => {
        if (typeof payload !== 'object' || payload === null) {
            return;
        }
        const raw = payload as Record<string, unknown>;
        const cutsceneRef = typeof raw.cutsceneRef === 'string' ? raw.cutsceneRef.trim() : '';
        const actorId = typeof raw.actorId === 'string' ? raw.actorId.trim() : '';
        if (!cutsceneRef) {
            return;
        }
        const sourceDetail = actorId ? `npc_interaction:${actorId}` : 'npc_interaction';
        tryStartCutsceneRef(cutsceneRef, sourceDetail);
    };

    scene.events.on('pf:npc_interaction_cutscene_request', onNpcCutsceneRequest);

    return {
        update: (deltaMs: number): void => {
            const safeDeltaMs = clampDeltaMs(deltaMs);
            if (safeDeltaMs <= 0) {
                return;
            }
            if (activeRun && status !== 'running') {
                status = 'running';
            }
            updateActiveRun(safeDeltaMs);
        },
        tryStartCutsceneRef,
        isRunning: (): boolean => activeRun !== null,
        isInputLocked: (): boolean => inputLocked,
        getDebugState: (): TestCutsceneDebugState => {
            const step = activeRun?.definition.steps[activeRun.stepIndex] ?? null;
            return {
                activeCutsceneRef: activeRun?.definition.id ?? null,
                activeStepIndex: activeRun ? activeRun.stepIndex : -1,
                activeStepKind: step?.kind ?? null,
                status,
                detail
            };
        },
        destroy: (): void => {
            scene.events.off('pf:npc_interaction_cutscene_request', onNpcCutsceneRequest);
        }
    };
};
