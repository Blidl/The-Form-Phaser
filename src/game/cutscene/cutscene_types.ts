export type TestCutsceneMode = 'in_level' | 'overlay';
export type TestCutsceneRunStatus = 'running' | 'completed' | 'cancelled' | 'failed';

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
    activeCutsceneRef: string | null;
    activeStepIndex: number;
    activeStepKind: string | null;
    status: TestCutsceneRunStatus | null;
    detail: string | null;
}
