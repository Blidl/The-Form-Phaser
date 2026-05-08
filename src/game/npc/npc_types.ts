export type TestNpcArchetype = 'passive' | 'enemy';
export type TestNpcFacing = 'left' | 'right';
export type TestNpcPassiveMode = 'idle' | 'idle_patrol';
export type TestNpcPlayerBodyContactMode = 'block' | 'overlap' | 'ignore';
export type TestNpcPassiveState = 'idle' | 'idle_patrol' | 'scripted_loop' | 'hook_sequence' | 'interaction_sequence' | 'cutscene_sequence';
export type TestNpcEnemyState = 'patrol' | 'alert' | 'chase' | 'return_to_post' | 'scripted_loop' | 'hook_sequence' | 'interaction_sequence' | 'cutscene_sequence';
export type TestNpcState = TestNpcPassiveState | TestNpcEnemyState;
export type TestNpcVisualLayer = 'layer_1' | 'layer_2' | 'layer_3' | 'layer_4' | 'layer_5';
export type TestNpcPresentationEmotion = string;
export type TestNpcPresentationAnimation = string;
export type TestNpcSequenceHookId = 'on_spawn' | 'on_player_near' | 'on_player_far' | 'on_trigger_event';
export type TestNpcSequenceHookRestartPolicy = 'restart' | 'keep_running';
export type TestNpcInteractionOutcomeKind = 'run_sequence_ref' | 'trigger_event' | 'request_cutscene_ref';
export type TestNpcInteractionAvailability = 'available' | 'unavailable';
export type TestNpcInteractionUnavailableReason =
    | 'no_interaction'
    | 'missing_runtime_actor'
    | 'out_of_range'
    | 'npc_busy';
export type TestNpcInteractionDispatchResultKind =
    | 'dispatched_sequence'
    | 'dispatched_event'
    | 'requested_cutscene'
    | 'no_target'
    | 'unavailable'
    | 'unknown_actor'
    | 'busy'
    | 'invalid_outcome';
export type TestNpcInteractionObservableResult =
    | 'busy'
    | 'rejected'
    | 'no_target'
    | 'out_of_range'
    | 'no_outcome'
    | 'dispatched_sequence'
    | 'dispatched_event'
    | 'requested_cutscene';

export interface TestNpcSequenceHookRoute {
    sequenceRef: string;
    restartPolicy?: TestNpcSequenceHookRestartPolicy;
}

export interface TestNpcPlayerDistanceSequenceHookRoute extends TestNpcSequenceHookRoute {
    distancePx: number;
}

export interface TestNpcTriggerEventSequenceHookRoute extends TestNpcSequenceHookRoute {
    eventId: string;
}

export interface TestNpcProfileSequenceHooks {
    onSpawn?: TestNpcSequenceHookRoute;
    onPlayerNear?: TestNpcPlayerDistanceSequenceHookRoute;
    onPlayerFar?: TestNpcPlayerDistanceSequenceHookRoute;
    onTriggerEvent?: readonly TestNpcTriggerEventSequenceHookRoute[];
}

export interface TestNpcInstanceSequenceHookRefOverrides {
    onSpawnSequenceRef?: string | null;
    onPlayerNearSequenceRef?: string | null;
    onPlayerFarSequenceRef?: string | null;
}

export interface TestNpcResolvedSequenceHooks {
    onSpawn: TestNpcSequenceHookRoute | null;
    onPlayerNear: TestNpcPlayerDistanceSequenceHookRoute | null;
    onPlayerFar: TestNpcPlayerDistanceSequenceHookRoute | null;
    onTriggerEvent: readonly TestNpcTriggerEventSequenceHookRoute[];
}

export interface TestNpcRunSequenceInteractionOutcome {
    kind: 'run_sequence_ref';
    sequenceRef: string;
}

export interface TestNpcTriggerEventInteractionOutcome {
    kind: 'trigger_event';
    eventId: string;
}

export interface TestNpcRequestCutsceneInteractionOutcome {
    kind: 'request_cutscene_ref';
    cutsceneRef: string;
}

export type TestNpcInteractionOutcome =
    | TestNpcRunSequenceInteractionOutcome
    | TestNpcTriggerEventInteractionOutcome
    | TestNpcRequestCutsceneInteractionOutcome;

export interface TestNpcInteractionConfig {
    distancePx: number;
    outcome: TestNpcInteractionOutcome;
}

export interface TestNpcInstanceInteractionOverride {
    distancePx?: number;
    outcome?: TestNpcInteractionOutcome | null;
}

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

export interface TestNpcBehaviorScriptsConfig {
    patrol?: string;
    defaultAction?: string;
    altActions?: string[];
}

export interface TestNpcInstanceConfig {
    id: string;
    profileId: string;
    x: number;
    y: number;
    initialManpuEmotionId?: string | null;
    facing?: TestNpcFacing;
    scriptedLoopRef?: string | null;
    sequenceHookOverrides?: TestNpcInstanceSequenceHookRefOverrides;
    interactionOverride?: TestNpcInstanceInteractionOverride;
    playerBodyContactMode?: TestNpcPlayerBodyContactMode;
    visualLayer?: TestNpcVisualLayer;
    renderOrder?: number;
    behavior?: TestNpcBehaviorOverrides;
    behaviorScripts?: TestNpcBehaviorScriptsConfig;
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
    sequenceHooks?: TestNpcProfileSequenceHooks;
    interaction?: TestNpcInteractionConfig;
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
    sequenceHooks: TestNpcResolvedSequenceHooks;
    interaction: TestNpcInteractionConfig | null;
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
    activeHookId: TestNpcSequenceHookId | null;
    activeHookSequenceRef: string | null;
    activeHookReason: string | null;
    activeHookActivationNonce: number | null;
    activeHookRestartPolicy: TestNpcSequenceHookRestartPolicy | null;
    activeHookSource: 'profile_default' | 'instance_override' | null;
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

export interface TestNpcInteractionTargetDebugEntry {
    actorId: string;
    displayName: string;
    distancePx: number;
    maxDistancePx: number;
    outcomeKind: TestNpcInteractionOutcomeKind;
    outcomeRef: string;
    outcomeSource: TestNpcInteractionOutcomeSource;
    effectiveCutsceneRef: string | null;
    cutsceneRefSource: TestNpcInteractionOutcomeSource | null;
    cutsceneRefStatus: TestNpcInteractionCutsceneRefStatus;
    cutsceneRefIssue: string | null;
    availability: TestNpcInteractionAvailability;
    unavailableReason: TestNpcInteractionUnavailableReason | null;
}

export type TestNpcInteractionArbitrationSource =
    | 'stable_current_target'
    | 'nearest_available'
    | 'nearest_unavailable'
    | 'none';
export type TestNpcInteractionOutcomeSource = 'profile_default' | 'instance_override';
export type TestNpcInteractionCutsceneRefStatus = 'n/a' | 'valid' | 'missing_ref' | 'invalid_ref';

export interface TestNpcInteractionDispatchResult {
    actorId: string | null;
    outcomeKind: TestNpcInteractionOutcomeKind | null;
    result: TestNpcInteractionDispatchResultKind;
    detail: string;
}

export interface TestNpcInteractionInputAttemptDebugEntry {
    attemptNonce: number;
    actorId: string | null;
    distancePx: number | null;
    availability: TestNpcInteractionAvailability | null;
    unavailableReason: TestNpcInteractionUnavailableReason | null;
    outcomeKind: TestNpcInteractionOutcomeKind | null;
    outcomeRef: string | null;
    outcomeSource: TestNpcInteractionOutcomeSource | null;
    effectiveCutsceneRef: string | null;
    cutsceneRefSource: TestNpcInteractionOutcomeSource | null;
    cutsceneRefStatus: TestNpcInteractionCutsceneRefStatus;
    cutsceneRefIssue: string | null;
    observableResult: TestNpcInteractionObservableResult;
    detail: string;
}

export interface TestNpcInteractionDebugState {
    target: TestNpcInteractionTargetDebugEntry | null;
    arbitrationSource: TestNpcInteractionArbitrationSource;
    arbitrationDetail: string | null;
    lastInputAttempt: TestNpcInteractionInputAttemptDebugEntry | null;
    lastDispatchResult: TestNpcInteractionDispatchResult | null;
    temporaryManualTriggerKey: string;
}

export interface TestNpcActorContactSnapshot {
    grounded: boolean;
    locomotion: 'grounded' | 'airborne';
    blockedLeft: boolean;
    blockedRight: boolean;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
}
