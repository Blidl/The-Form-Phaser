export type TestNpcArchetype = 'passive' | 'enemy';
export type TestNpcFacing = 'left' | 'right';
export type TestNpcPassiveMode = 'idle' | 'idle_patrol';
export type TestNpcPlayerBodyContactMode = 'block' | 'overlap' | 'ignore';
export type TestNpcPassiveState = 'idle' | 'idle_patrol' | 'scripted_loop';
export type TestNpcEnemyState = 'patrol' | 'alert' | 'chase' | 'return_to_post' | 'scripted_loop';
export type TestNpcState = TestNpcPassiveState | TestNpcEnemyState;
export type TestNpcVisualLayer = 'layer_1' | 'layer_2' | 'layer_3' | 'layer_4' | 'layer_5';
export type TestNpcPresentationEmotion = string;
export type TestNpcPresentationAnimation = string;

export interface TestNpcVisualConfig {
    label: string;
    bodyWidth: number;
    bodyHeight: number;
    fillColor: number;
    strokeColor: number;
    accentColor?: number;
    textColor?: string;
}

export interface TestNpcBehaviorOverrides {
    passiveMode?: TestNpcPassiveMode;
    patrolDistance?: number;
    moveSpeed?: number;
    patrolSpeed?: number;
    idleDurationMs?: number;
    patrolPauseMs?: number;
    alertDurationMs?: number;
    chaseSpeed?: number;
    senseRadius?: number;
    chaseReleaseRadius?: number;
    returnSpeed?: number;
    postTolerance?: number;
}

export interface TestNpcInstanceConfig {
    id: string;
    profileId: string;
    x: number;
    y: number;
    facing?: TestNpcFacing;
    scriptedLoopRef?: string | null;
    playerBodyContactMode?: TestNpcPlayerBodyContactMode;
    visualLayer?: TestNpcVisualLayer;
    renderOrder?: number;
    behavior?: TestNpcBehaviorOverrides;
}

export interface TestNpcPassiveProfileBehavior {
    mode: TestNpcPassiveMode;
    patrolDistance: number;
    moveSpeed: number;
    idleDurationMs: number;
    patrolPauseMs: number;
}

export interface TestNpcEnemyProfileBehavior {
    patrolDistance: number;
    patrolSpeed: number;
    alertDurationMs: number;
    chaseSpeed: number;
    senseRadius: number;
    chaseReleaseRadius: number;
    returnSpeed: number;
    postTolerance: number;
}

export interface TestNpcProfile {
    id: string;
    displayName: string;
    archetype: TestNpcArchetype;
    scriptedLoopRef?: string;
    playerBodyContactMode: TestNpcPlayerBodyContactMode;
    visual: TestNpcVisualConfig;
    passiveBehavior?: TestNpcPassiveProfileBehavior;
    enemyBehavior?: TestNpcEnemyProfileBehavior;
}

export interface TestNpcPassiveResolvedBehavior {
    mode: TestNpcPassiveMode;
    patrolDistance: number;
    moveSpeed: number;
    idleDurationMs: number;
    patrolPauseMs: number;
}

export interface TestNpcEnemyResolvedBehavior {
    patrolDistance: number;
    patrolSpeed: number;
    alertDurationMs: number;
    chaseSpeed: number;
    senseRadius: number;
    chaseReleaseRadius: number;
    returnSpeed: number;
    postTolerance: number;
}

export interface TestNpcResolvedConfig {
    instance: TestNpcInstanceConfig;
    profile: TestNpcProfile;
    facing: TestNpcFacing;
    scriptedLoopRef: string | null;
    playerBodyContactMode: TestNpcPlayerBodyContactMode;
    passiveBehavior: TestNpcPassiveResolvedBehavior | null;
    enemyBehavior: TestNpcEnemyResolvedBehavior | null;
}

export interface TestNpcDebugEntry {
    id: string;
    archetype: TestNpcArchetype;
    state: TestNpcState;
    playerBodyContactMode: TestNpcPlayerBodyContactMode;
    exportsTriangleSupportSurface: boolean;
    locomotion: 'grounded' | 'airborne';
    blockedLeft: boolean;
    blockedRight: boolean;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
    profileScriptedLoopRef: string | null;
    scriptedLoopInstanceOverride: string | null | undefined;
    scriptedLoopRef: string | null;
    scriptedLoopSource: 'profile_default' | 'instance_override' | 'instance_none';
    activeScriptedSequenceRef: string | null;
    actionSequenceId: string | null;
    actionSequenceSource: string | null;
    actionSequenceTargetRef: string | null;
    actionSequenceStatus: 'running' | 'succeeded' | 'failed' | 'cancelled' | null;
    activeActionIndex: number;
    activeActionKind: string | null;
    activeActionStatus: 'running' | 'succeeded' | 'failed' | 'cancelled' | null;
    actionTargetRef: string | null;
    actionTargetDescription: string | null;
    actionFailureReason: string | null;
    presentationAnimation: TestNpcPresentationAnimation | null;
    presentationEmotion: TestNpcPresentationEmotion | null;
}

export interface TestNpcActorContactSnapshot {
    grounded: boolean;
    locomotion: 'grounded' | 'airborne';
    blockedLeft: boolean;
    blockedRight: boolean;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
}
