export type TestNpcArchetype = 'passive' | 'enemy';
export type TestNpcFacing = 'left' | 'right';
export type TestNpcPassiveMode = 'idle' | 'idle_patrol';
export type TestNpcPassiveState = 'idle' | 'idle_patrol';
export type TestNpcEnemyState = 'patrol' | 'alert' | 'chase' | 'return_to_post';
export type TestNpcState = TestNpcPassiveState | TestNpcEnemyState;
export type TestNpcVisualLayer = 'layer_1' | 'layer_2' | 'layer_3' | 'layer_4' | 'layer_5';

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
    passiveBehavior: TestNpcPassiveResolvedBehavior | null;
    enemyBehavior: TestNpcEnemyResolvedBehavior | null;
}

export interface TestNpcDebugEntry {
    id: string;
    archetype: TestNpcArchetype;
    state: TestNpcState;
    locomotion: 'grounded' | 'airborne';
    blockedLeft: boolean;
    blockedRight: boolean;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
}
