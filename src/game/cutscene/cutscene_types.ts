export type TestCutsceneMode = 'in_level' | 'overlay';
export type TestCutsceneRunStatus = 'running' | 'completed' | 'cancelled' | 'failed';
export type TestCutsceneRequestResult =
    | 'accepted'
    | 'rejected'
    | 'missing_ref'
    | 'already_running'
    | 'completed'
    | 'failed';

interface TestCutsceneStepBase {
    kind: string;
    ref?: string;
}

export interface TestCutsceneLockInputStep extends TestCutsceneStepBase {
    kind: 'lock_input';
}

export interface TestCutsceneUnlockInputStep extends TestCutsceneStepBase {
    kind: 'unlock_input';
}

export interface TestCutsceneCameraFocusActorStep extends TestCutsceneStepBase {
    kind: 'camera_focus_actor';
    actorId: string;
    durationMs?: number;
    ease?: string;
    tolerancePx?: number;
}

export interface TestCutsceneCameraPanToStep extends TestCutsceneStepBase {
    kind: 'camera_pan_to';
    x: number;
    y: number;
    durationMs: number;
    ease?: string;
}

export interface TestCutsceneWaitStep extends TestCutsceneStepBase {
    kind: 'wait';
    durationMs: number;
}

export interface TestCutscenePlaySfxStep extends TestCutsceneStepBase {
    kind: 'play_sfx';
    sfxId: string;
}

export interface TestCutsceneSpawnVfxStep extends TestCutsceneStepBase {
    kind: 'spawn_vfx';
    vfxId: string;
    actorId?: string;
    x?: number;
    y?: number;
}

export interface TestCutsceneSubtitleStep extends TestCutsceneStepBase {
    kind: 'subtitle';
    text: string;
    durationMs?: number;
}

export interface TestCutsceneActorSequenceRefStep extends TestCutsceneStepBase {
    kind: 'actor_sequence_ref';
    actorId: string;
    sequenceRef: string;
}

export type TestCutsceneStep =
    | TestCutsceneLockInputStep
    | TestCutsceneUnlockInputStep
    | TestCutsceneCameraFocusActorStep
    | TestCutsceneCameraPanToStep
    | TestCutsceneWaitStep
    | TestCutscenePlaySfxStep
    | TestCutsceneSpawnVfxStep
    | TestCutsceneSubtitleStep
    | TestCutsceneActorSequenceRefStep;

export interface TestCutsceneDefinition {
    id: string;
    mode: TestCutsceneMode;
    steps: readonly TestCutsceneStep[];
}

export interface TestCutsceneDebugState {
    lastCutsceneRequestRef: string | null;
    lastCutsceneRequestResult: TestCutsceneRequestResult | null;
    activeCutsceneRef: string | null;
    activeStepIndex: number;
    activeStepKind: string | null;
    status: TestCutsceneRunStatus | null;
    failureReason: string | null;
    detail: string | null;
    blockReason: string | null;
    cameraOwner: 'cutscene_runtime' | 'player_follow_runtime';
    cameraFocusActorId: string | null;
    cameraTransitionMode: 'none' | 'pan_to_point' | 'focus_actor_handoff';
    cameraTargetX: number | null;
    cameraTargetY: number | null;
    cameraRemainingDeltaX: number | null;
    cameraRemainingDeltaY: number | null;
    cameraRemainingDistancePx: number | null;
    activeActorSequenceActorId: string | null;
    activeActorSequenceRef: string | null;
    activeActorSequenceId: string | null;
    activeActorSequenceStatus: 'running' | 'succeeded' | 'failed' | 'cancelled' | null;
    cutsceneActive: boolean;
    normalCameraPathStatus: 'none' | 'applied' | 'skipped';
    normalCameraPathSource: string | null;
    normalCameraPathReason: string | null;
}
