import type { Scene } from 'phaser';
import {
    BASELINE_FOLLOW_CAMERA_OFFSET_X,
    BASELINE_FOLLOW_CAMERA_OFFSET_Y,
    refreshBaselineFollowCameraLerp,
    setupBaselineFollowCamera
} from '../../game/camera/follow_camera';
import type { PlayerWorldActor } from '../../game/player/player_runtime_contracts';
import { getTestCutsceneDefinition } from '../../game/cutscene/test_cutscene_registry';
import type {
    TestCutsceneActorSequenceRefStep,
    TestCutsceneCameraFocusActorStep,
    TestCutsceneCameraPanToStep,
    TestCutsceneDebugState,
    TestCutsceneDefinition,
    TestCutsceneSetEmotionStep,
    TestCutsceneRequestResult,
    TestCutsceneRunStatus,
    TestCutsceneStep,
    TestCutsceneSubtitleStep
} from '../../game/cutscene/cutscene_types';
import type { EventDebugRecordInput } from '../../game/debug/event_debug_types';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import type { TestWorldLogicEvent } from '../../game/events/test_world_logic_rules';

type CutsceneDebugEventSink = (entry: EventDebugRecordInput) => void;

interface ActiveCutsceneRun {
    definition: TestCutsceneDefinition;
    stepIndex: number;
    waitRemainingMs: number | null;
    waitingActorSequence: {
        actorId: string;
        sequenceRef: string;
        sequenceId: string;
        stepRef: string;
        status: 'running' | 'succeeded' | 'failed' | 'cancelled' | null;
    } | null;
    waitingCameraPan: {
        stepIndex: number;
        targetX: number;
        targetY: number;
        tolerancePx: number;
    } | null;
    waitingCameraFocus: {
        stepIndex: number;
        actorId: string;
        targetX: number;
        targetY: number;
        tolerancePx: number;
    } | null;
    activeCameraFocusActorId: string | null;
}

export interface TestCutsceneRuntime {
    update: (deltaMs: number) => void;
    tryStartCutsceneRef: (cutsceneRef: string, sourceDetail: string) => boolean;
    requestNormalCameraOwnership: (source: string) => boolean;
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
        | 'dispatchCutsceneActorSequenceRef'
        | 'dispatchCutsceneSetEmotion'
        | 'dispatchWorldLogicEvent'
        | 'executeCutsceneLogicOnFinish'
        | 'getCutsceneActorSequenceSnapshot'
        | 'getWorldBounds'
        | 'getNpcCameraFocusObject'
    >;
    eventDebugSink?: CutsceneDebugEventSink;
}

const clampDeltaMs = (deltaMs: number): number => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }
    return Math.min(deltaMs, 64);
};

const CUTSCENE_CAMERA_PAN_COMPLETE_EPSILON_PX = 1.25;
const CUTSCENE_CAMERA_FOCUS_COMPLETE_EPSILON_PX = 1.25;
const CUTSCENE_CAMERA_FOCUS_TRANSITION_DURATION_MS = 280;
const CUTSCENE_CAMERA_FOLLOW_OFFSET_X = BASELINE_FOLLOW_CAMERA_OFFSET_X;
const CUTSCENE_CAMERA_FOLLOW_OFFSET_Y = BASELINE_FOLLOW_CAMERA_OFFSET_Y;

type CameraPanSnapshot = {
    targetX: number;
    targetY: number;
    deltaX: number;
    deltaY: number;
    remainingDistancePx: number;
    tolerancePx: number;
};

const getCameraCenter = (camera: Phaser.Cameras.Scene2D.Camera): { x: number; y: number } => ({
    x: camera.scrollX + (camera.width * 0.5),
    y: camera.scrollY + (camera.height * 0.5)
});

const getCameraPanSnapshot = (
    camera: Phaser.Cameras.Scene2D.Camera,
    targetX: number,
    targetY: number,
    tolerancePx: number
): CameraPanSnapshot => {
    const center = getCameraCenter(camera);
    const deltaX = targetX - center.x;
    const deltaY = targetY - center.y;
    return {
        targetX,
        targetY,
        deltaX,
        deltaY,
        remainingDistancePx: Math.hypot(deltaX, deltaY),
        tolerancePx
    };
};

const getFocusObjectPosition = (
    focusObject: Phaser.GameObjects.GameObject
): { x: number; y: number } | null => {
    const candidate = focusObject as Partial<{ x: unknown; y: unknown }>;
    if (typeof candidate.x === 'number' && Number.isFinite(candidate.x)
        && typeof candidate.y === 'number' && Number.isFinite(candidate.y)) {
        return { x: candidate.x, y: candidate.y };
    }
    return null;
};

const getStepRef = (step: TestCutsceneStep, stepIndex: number): string => {
    return step.ref && step.ref.trim().length > 0
        ? step.ref.trim()
        : `step_${stepIndex + 1}`;
};

const isActorSequenceTerminalStatus = (
    status: 'running' | 'succeeded' | 'failed' | 'cancelled' | null
): status is 'succeeded' | 'failed' | 'cancelled' => {
    return status === 'succeeded' || status === 'failed' || status === 'cancelled';
};

export const createTestCutsceneRuntime = (
    params: CreateTestCutsceneRuntimeParams
): TestCutsceneRuntime => {
    const { scene, player, worldRuntime, eventDebugSink } = params;
    let activeRun: ActiveCutsceneRun | null = null;
    let inputLocked = false;
    let status: TestCutsceneRunStatus | null = null;
    let detail: string | null = null;
    let failureReason: string | null = null;
    let lastCutsceneRequestRef: string | null = null;
    let lastCutsceneRequestResult: TestCutsceneRequestResult | null = null;
    let blockReason: string | null = null;
    let cameraOwner: 'cutscene_runtime' | 'player_follow_runtime' = 'player_follow_runtime';
    let normalCameraPathStatus: 'none' | 'applied' | 'skipped' = 'none';
    let normalCameraPathSource: string | null = null;
    let normalCameraPathReason: string | null = null;

    const clearBlockReason = (): void => {
        blockReason = null;
    };

    const setBlockReason = (nextBlockReason: string): void => {
        blockReason = nextBlockReason;
    };

    const acquireCutsceneCameraOwnership = (): void => {
        cameraOwner = 'cutscene_runtime';
    };

    const recordNormalCameraPathStatus = (
        nextStatus: 'none' | 'applied' | 'skipped',
        source: string | null,
        reason: string | null
    ): void => {
        normalCameraPathStatus = nextStatus;
        normalCameraPathSource = source;
        normalCameraPathReason = reason;
    };

    const emitCutsceneDebugFeedback = (
        result: TestCutsceneRequestResult,
        cutsceneRef: string | null,
        sourceDetail: string | null,
        nextFailureReason: string | null
    ): void => {
        scene.events.emit('pf:cutscene_debug_feedback', {
            result,
            cutsceneRef,
            sourceDetail,
            failureReason: nextFailureReason
        });
    };

    const recordCutsceneDebug = (entry: EventDebugRecordInput): void => {
        eventDebugSink?.(entry);
    };

    const restorePlayerCameraFollow = (): void => {
        const worldBounds = worldRuntime.getWorldBounds();
        setupBaselineFollowCamera(scene, player.arcadeBodyObject, {
            width: worldBounds.width,
            height: worldBounds.height
        });
        cameraOwner = 'player_follow_runtime';
    };

    const finishRun = (nextStatus: TestCutsceneRunStatus, nextDetail: string | null): void => {
        const completedCutsceneRef = activeRun?.definition.id ?? null;
        const completedStepIndex = activeRun?.stepIndex ?? null;
        activeRun = null;
        status = nextStatus;
        detail = nextDetail;
        failureReason = nextStatus === 'failed'
            ? (nextDetail ?? 'cutscene failed without explicit reason')
            : null;
        if (nextStatus === 'completed') {
            recordCutsceneDebug({
                type: 'cutscene.finished',
                source: 'test_cutscene_runtime',
                cutsceneId: completedCutsceneRef ?? undefined,
                eventId: completedCutsceneRef ? `cutscene_finished:${completedCutsceneRef}` : 'cutscene_finished',
                message: 'cutscene finished',
                payload: {
                    status: nextStatus,
                    detail: nextDetail ?? null,
                    stepIndex: completedStepIndex
                }
            });
            lastCutsceneRequestResult = 'completed';
            emitCutsceneDebugFeedback('completed', completedCutsceneRef, nextDetail, null);
            if (completedCutsceneRef) {
                const event: TestWorldLogicEvent = {
                    kind: 'cutscene_finished',
                    cutsceneRef: completedCutsceneRef
                };
                worldRuntime.dispatchWorldLogicEvent(event);
                worldRuntime.executeCutsceneLogicOnFinish(completedCutsceneRef);
            }
        } else if (nextStatus === 'failed') {
            recordCutsceneDebug({
                type: 'cutscene.failed',
                source: 'test_cutscene_runtime',
                cutsceneId: completedCutsceneRef ?? undefined,
                eventId: completedCutsceneRef ? `cutscene_failed:${completedCutsceneRef}` : 'cutscene_failed',
                severity: 'error',
                message: 'cutscene failed',
                payload: {
                    status: nextStatus,
                    detail: nextDetail ?? null,
                    stepIndex: completedStepIndex
                }
            });
            lastCutsceneRequestResult = 'failed';
            emitCutsceneDebugFeedback('failed', completedCutsceneRef, nextDetail, failureReason);
        }
        clearBlockReason();
        inputLocked = false;
        restorePlayerCameraFollow();
    };

    const resolveFocusObject = (actorId: string): Phaser.GameObjects.GameObject | null => {
        if (actorId === 'player') {
            return player.arcadeBodyObject;
        }
        return worldRuntime.getNpcCameraFocusObject(actorId);
    };

    const executeCameraPanStep = (
        step: TestCutsceneCameraPanToStep,
        stepIndex: number
    ): 'advanced' | 'blocked' => {
        if (!activeRun) {
            return 'blocked';
        }
        const camera = scene.cameras.main;
        acquireCutsceneCameraOwnership();
        camera.stopFollow();
        const durationMs = Math.max(0, Math.round(step.durationMs));
        const tolerancePx = CUTSCENE_CAMERA_PAN_COMPLETE_EPSILON_PX;
        const targetX = step.x;
        const targetY = step.y;
        if (durationMs <= 0) {
            camera.centerOn(targetX, targetY);
            clearBlockReason();
            return 'advanced';
        }
        activeRun.waitingCameraPan = {
            stepIndex,
            targetX,
            targetY,
            tolerancePx
        };
        camera.pan(targetX, targetY, durationMs, step.ease ?? 'Sine.easeInOut', true);
        const panSnapshot = getCameraPanSnapshot(camera, targetX, targetY, tolerancePx);
        setBlockReason(
            `camera_pan_to waiting: remain=${panSnapshot.remainingDistancePx.toFixed(2)}px `
            + `(dx=${panSnapshot.deltaX.toFixed(2)}, dy=${panSnapshot.deltaY.toFixed(2)})`
        );
        return 'blocked';
    };

    const executeCameraFocusActorStep = (
        step: TestCutsceneCameraFocusActorStep,
        stepIndex: number
    ): 'advanced' | 'blocked' => {
        if (!activeRun) {
            return 'blocked';
        }
        const focusObject = resolveFocusObject(step.actorId);
        if (!focusObject) {
            finishRun('failed', `camera_focus_actor failed: missing actor "${step.actorId}"`);
            return 'blocked';
        }
        const focusPosition = getFocusObjectPosition(focusObject);
        if (!focusPosition) {
            finishRun('failed', `camera_focus_actor failed: actor "${step.actorId}" has no x/y focus position`);
            return 'blocked';
        }
        const camera = scene.cameras.main;
        const targetX = focusPosition.x + CUTSCENE_CAMERA_FOLLOW_OFFSET_X;
        const targetY = focusPosition.y + CUTSCENE_CAMERA_FOLLOW_OFFSET_Y;
        const durationMs = Math.max(
            0,
            Math.round(step.durationMs ?? CUTSCENE_CAMERA_FOCUS_TRANSITION_DURATION_MS)
        );
        const tolerancePx = step.tolerancePx ?? CUTSCENE_CAMERA_FOCUS_COMPLETE_EPSILON_PX;
        acquireCutsceneCameraOwnership();
        camera.stopFollow();
        camera.panEffect.reset();
        if (durationMs <= 0) {
            camera.centerOn(targetX, targetY);
            camera.startFollow(focusObject, true);
            camera.setFollowOffset(CUTSCENE_CAMERA_FOLLOW_OFFSET_X, CUTSCENE_CAMERA_FOLLOW_OFFSET_Y);
            refreshBaselineFollowCameraLerp(camera);
            activeRun.activeCameraFocusActorId = step.actorId;
            clearBlockReason();
            return 'advanced';
        }
        activeRun.waitingCameraFocus = {
            stepIndex,
            actorId: step.actorId,
            targetX,
            targetY,
            tolerancePx
        };
        camera.pan(targetX, targetY, durationMs, step.ease ?? 'Sine.easeInOut', true);
        const panSnapshot = getCameraPanSnapshot(camera, targetX, targetY, tolerancePx);
        setBlockReason(
            `camera_focus_actor handoff: remain=${panSnapshot.remainingDistancePx.toFixed(2)}px `
            + `(dx=${panSnapshot.deltaX.toFixed(2)}, dy=${panSnapshot.deltaY.toFixed(2)})`
        );
        return 'blocked';
    };

    const updateCameraPanWait = (): boolean => {
        if (!activeRun?.waitingCameraPan) {
            return false;
        }
        const camera = scene.cameras.main;
        const waitingPan = activeRun.waitingCameraPan;
        const panSnapshot = getCameraPanSnapshot(
            camera,
            waitingPan.targetX,
            waitingPan.targetY,
            waitingPan.tolerancePx
        );
        const reachedTolerance = panSnapshot.remainingDistancePx <= waitingPan.tolerancePx;
        const panFinished = reachedTolerance || !camera.panEffect.isRunning;
        if (panFinished) {
            camera.centerOn(waitingPan.targetX, waitingPan.targetY);
            activeRun.waitingCameraPan = null;
            if (activeRun.stepIndex === waitingPan.stepIndex) {
                activeRun.stepIndex += 1;
            }
            clearBlockReason();
            return false;
        }
        setBlockReason(
            `camera_pan_to waiting: remain=${panSnapshot.remainingDistancePx.toFixed(2)}px `
            + `(dx=${panSnapshot.deltaX.toFixed(2)}, dy=${panSnapshot.deltaY.toFixed(2)})`
        );
        return true;
    };

    const updateCameraFocusWait = (): boolean => {
        if (!activeRun?.waitingCameraFocus) {
            return false;
        }
        const camera = scene.cameras.main;
        const waitingFocus = activeRun.waitingCameraFocus;
        const panSnapshot = getCameraPanSnapshot(
            camera,
            waitingFocus.targetX,
            waitingFocus.targetY,
            waitingFocus.tolerancePx
        );
        const reachedTolerance = panSnapshot.remainingDistancePx <= waitingFocus.tolerancePx;
        const transitionFinished = reachedTolerance || !camera.panEffect.isRunning;
        if (transitionFinished) {
            const focusObject = resolveFocusObject(waitingFocus.actorId);
            if (!focusObject) {
                finishRun('failed', `camera_focus_actor failed: missing actor "${waitingFocus.actorId}"`);
                return false;
            }
            camera.centerOn(waitingFocus.targetX, waitingFocus.targetY);
            camera.startFollow(focusObject, true);
            camera.setFollowOffset(CUTSCENE_CAMERA_FOLLOW_OFFSET_X, CUTSCENE_CAMERA_FOLLOW_OFFSET_Y);
            refreshBaselineFollowCameraLerp(camera);
            activeRun.activeCameraFocusActorId = waitingFocus.actorId;
            activeRun.waitingCameraFocus = null;
            if (activeRun.stepIndex === waitingFocus.stepIndex) {
                activeRun.stepIndex += 1;
            }
            clearBlockReason();
            return false;
        }
        setBlockReason(
            `camera_focus_actor handoff: remain=${panSnapshot.remainingDistancePx.toFixed(2)}px `
            + `(dx=${panSnapshot.deltaX.toFixed(2)}, dy=${panSnapshot.deltaY.toFixed(2)})`
        );
        return true;
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
                sequenceRef: step.sequenceRef,
                sequenceId: dispatchResult.sequenceId,
                stepRef,
                status: 'running'
            };
        }
        return true;
    };

    const runSetEmotionStep = (
        step: TestCutsceneSetEmotionStep
    ): boolean => {
        const dispatchResult = worldRuntime.dispatchCutsceneSetEmotion(step.actorId, step.emotionId);
        if (dispatchResult.result !== 'applied') {
            finishRun('failed', `set_emotion failed: ${dispatchResult.detail}`);
            return false;
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
            return executeCameraFocusActorStep(step, stepIndex);
        }
        if (step.kind === 'camera_pan_to') {
            activeRun.activeCameraFocusActorId = null;
            activeRun.waitingCameraFocus = null;
            return executeCameraPanStep(step, stepIndex);
        }
        if (step.kind === 'wait') {
            activeRun.waitRemainingMs = Math.max(0, step.durationMs);
            if (activeRun.waitRemainingMs > 0) {
                setBlockReason(`wait: ${Math.round(activeRun.waitRemainingMs)}ms remaining`);
            } else {
                clearBlockReason();
            }
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
            const dispatched = runActorSequenceStep(cutsceneRef, stepRef, step);
            if (dispatched) {
                setBlockReason(
                    `actor_sequence_ref: waiting actor "${step.actorId}" `
                    + `ref "${step.sequenceRef}" id "${activeRun.waitingActorSequence?.sequenceId ?? '-'}"`
                );
            }
            return 'blocked';
        }
        if (step.kind === 'set_emotion') {
            return runSetEmotionStep(step) ? 'advanced' : 'blocked';
        }
        const unsupportedStepKind = (step as { kind: string }).kind;
        finishRun('failed', `unsupported cutscene step kind "${unsupportedStepKind}"`);
        return 'blocked';
    };

    const updateActiveRun = (deltaMs: number): void => {
        if (!activeRun) {
            return;
        }

        if (updateCameraPanWait()) {
            return;
        }
        if (updateCameraFocusWait()) {
            return;
        }
        if (activeRun.waitingActorSequence) {
            const snapshot = worldRuntime.getCutsceneActorSequenceSnapshot(activeRun.waitingActorSequence.actorId);
            if (!snapshot || snapshot.sequenceId !== activeRun.waitingActorSequence.sequenceId) {
                finishRun('failed', 'actor_sequence_ref lost sequence snapshot');
                return;
            }
            activeRun.waitingActorSequence.status = snapshot.status;
            if (!isActorSequenceTerminalStatus(snapshot.status)) {
                setBlockReason(
                    `actor_sequence_ref: waiting actor "${activeRun.waitingActorSequence.actorId}" `
                    + `ref "${activeRun.waitingActorSequence.sequenceRef}" `
                    + `id "${activeRun.waitingActorSequence.sequenceId}" `
                    + `status "${snapshot.status ?? 'null'}"`
                );
                return;
            }
            if (snapshot.status !== 'succeeded') {
                finishRun('failed', snapshot.failureReason ?? 'actor_sequence_ref did not succeed');
                return;
            }
            activeRun.waitingActorSequence = null;
            activeRun.stepIndex += 1;
            clearBlockReason();
        }
        if (!activeRun) {
            return;
        }
        if (activeRun.waitRemainingMs !== null) {
            activeRun.waitRemainingMs = Math.max(0, activeRun.waitRemainingMs - deltaMs);
            if (activeRun.waitRemainingMs > 0) {
                setBlockReason(`wait: ${Math.round(activeRun.waitRemainingMs)}ms remaining`);
                return;
            }
            activeRun.waitRemainingMs = null;
            activeRun.stepIndex += 1;
            clearBlockReason();
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
            clearBlockReason();
        }
    };

    const tryStartCutsceneRef = (cutsceneRef: string, sourceDetail: string): boolean => {
        lastCutsceneRequestRef = cutsceneRef;
        failureReason = null;
        const definition = getTestCutsceneDefinition(cutsceneRef);
        if (!definition) {
            status = 'failed';
            detail = `missing cutscene ref "${cutsceneRef}"`;
            failureReason = detail;
            lastCutsceneRequestResult = 'missing_ref';
            emitCutsceneDebugFeedback('missing_ref', cutsceneRef, sourceDetail, detail);
            return false;
        }

        if (activeRun) {
            lastCutsceneRequestResult = 'already_running';
            emitCutsceneDebugFeedback('already_running', cutsceneRef, sourceDetail, null);
            finishRun('cancelled', `cancelled by ${sourceDetail}`);
        }
        acquireCutsceneCameraOwnership();
        activeRun = {
            definition,
            stepIndex: 0,
            waitRemainingMs: null,
            waitingActorSequence: null,
            waitingCameraPan: null,
            waitingCameraFocus: null,
            activeCameraFocusActorId: null
        };
        status = 'running';
        detail = sourceDetail;
        failureReason = null;
        clearBlockReason();
        recordCutsceneDebug({
            type: 'cutscene.started',
            source: 'test_cutscene_runtime',
            cutsceneId: definition.id,
            eventId: `cutscene_started:${definition.id}`,
            message: 'cutscene started',
            payload: {
                cutsceneRef: definition.id,
                sourceDetail
            }
        });
        lastCutsceneRequestResult = 'accepted';
        emitCutsceneDebugFeedback('accepted', cutsceneRef, sourceDetail, null);
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
            lastCutsceneRequestRef = null;
            lastCutsceneRequestResult = 'rejected';
            status = 'failed';
            detail = actorId ? `npc_interaction:${actorId}` : 'npc_interaction';
            failureReason = 'request rejected: empty cutscene ref';
            clearBlockReason();
            emitCutsceneDebugFeedback('rejected', null, detail, failureReason);
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
        requestNormalCameraOwnership: (source: string): boolean => {
            const normalizedSource = source.trim().length > 0 ? source.trim() : 'unknown';
            if (activeRun && status === 'running') {
                recordNormalCameraPathStatus('skipped', normalizedSource, 'cutscene_running');
                return false;
            }
            recordNormalCameraPathStatus('applied', normalizedSource, 'cutscene_inactive');
            cameraOwner = 'player_follow_runtime';
            return true;
        },
        isRunning: (): boolean => activeRun !== null,
        isInputLocked: (): boolean => inputLocked,
        getDebugState: (): TestCutsceneDebugState => {
            const step = activeRun?.definition.steps[activeRun.stepIndex] ?? null;
            const waitingPan = activeRun?.waitingCameraPan ?? null;
            const waitingFocus = activeRun?.waitingCameraFocus ?? null;
            const camera = scene.cameras.main;
            const cameraPanSnapshot = waitingPan
                ? getCameraPanSnapshot(camera, waitingPan.targetX, waitingPan.targetY, waitingPan.tolerancePx)
                : (waitingFocus
                    ? getCameraPanSnapshot(camera, waitingFocus.targetX, waitingFocus.targetY, waitingFocus.tolerancePx)
                    : null);
            return {
                lastCutsceneRequestRef,
                lastCutsceneRequestResult,
                activeCutsceneRef: activeRun?.definition.id ?? null,
                activeStepIndex: activeRun ? activeRun.stepIndex : -1,
                activeStepKind: step?.kind ?? null,
                status,
                failureReason,
                detail,
                blockReason,
                cameraOwner,
                cameraFocusActorId: activeRun?.activeCameraFocusActorId ?? null,
                cameraTransitionMode: waitingPan
                    ? 'pan_to_point'
                    : (waitingFocus ? 'focus_actor_handoff' : 'none'),
                cameraTargetX: cameraPanSnapshot?.targetX ?? null,
                cameraTargetY: cameraPanSnapshot?.targetY ?? null,
                cameraRemainingDeltaX: cameraPanSnapshot?.deltaX ?? null,
                cameraRemainingDeltaY: cameraPanSnapshot?.deltaY ?? null,
                cameraRemainingDistancePx: cameraPanSnapshot?.remainingDistancePx ?? null,
                activeActorSequenceActorId: activeRun?.waitingActorSequence?.actorId ?? null,
                activeActorSequenceRef: activeRun?.waitingActorSequence?.sequenceRef ?? null,
                activeActorSequenceId: activeRun?.waitingActorSequence?.sequenceId ?? null,
                activeActorSequenceStatus: activeRun?.waitingActorSequence?.status ?? null,
                cutsceneActive: activeRun !== null && status === 'running',
                normalCameraPathStatus,
                normalCameraPathSource,
                normalCameraPathReason
            };
        },
        destroy: (): void => {
            if (activeRun || inputLocked || cameraOwner !== 'player_follow_runtime') {
                finishRun('cancelled', 'cutscene runtime destroyed');
            }
            scene.events.off('pf:npc_interaction_cutscene_request', onNpcCutsceneRequest);
        }
    };
};
