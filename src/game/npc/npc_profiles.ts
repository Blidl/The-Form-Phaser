import profilesJson from './data/test_npc_profiles.json';
import { isTestNpcScriptedSequenceRef } from './npc_scripted_sequences';
import { resolveTestNpcSequenceHooks } from './npc_sequence_hooks';
import { isTestCutsceneRef } from '../cutscene/test_cutscene_registry';
import type {
    TestNpcEnemyProfileBehavior,
    TestNpcInteractionConfig,
    TestNpcInteractionOutcome,
    TestNpcProfileSequenceHooks,
    TestNpcPassiveProfileBehavior,
    TestNpcPlayerDistanceSequenceHookRoute,
    TestNpcPlayerBodyContactMode,
    TestNpcProfile,
    TestNpcResolvedConfig,
    TestNpcInstanceConfig,
    TestNpcSequenceHookRestartPolicy,
    TestNpcSequenceHookRoute,
    TestNpcTriggerEventSequenceHookRoute
} from './npc_types';

const DEFAULT_PASSIVE_BEHAVIOR: TestNpcPassiveProfileBehavior = {
    mode: 'idle',
    patrolDistance: 0,
    moveSpeed: 24,
    idleDurationMs: 1000,
    patrolPauseMs: 800
};

const DEFAULT_ENEMY_BEHAVIOR: TestNpcEnemyProfileBehavior = {
    patrolDistance: 72,
    patrolSpeed: 30,
    alertDurationMs: 400,
    chaseSpeed: 72,
    senseRadius: 144,
    chaseReleaseRadius: 200,
    returnSpeed: 38,
    postTolerance: 4
};

const asPlayerBodyContactMode = (
    value: unknown,
    fallback: TestNpcPlayerBodyContactMode = 'block'
): TestNpcPlayerBodyContactMode => {
    return value === 'block' || value === 'overlap' || value === 'ignore'
        ? value
        : fallback;
};

const clampPositive = (value: unknown, fallback: number, minimum: number = 0): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(minimum, value);
};

const asTrimmedString = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

const asRestartPolicy = (
    value: unknown
): TestNpcSequenceHookRestartPolicy | undefined => {
    return value === 'keep_running' || value === 'restart'
        ? value
        : undefined;
};

const asInteractionOutcome = (value: unknown): TestNpcInteractionOutcome | undefined => {
    const raw = asObject(value);
    if (!raw) {
        return undefined;
    }

    if (raw.kind === 'run_sequence_ref') {
        const sequenceRef = asTrimmedString(raw.sequenceRef);
        if (!sequenceRef || !isTestNpcScriptedSequenceRef(sequenceRef)) {
            return undefined;
        }

        return {
            kind: 'run_sequence_ref',
            sequenceRef
        };
    }

    if (raw.kind === 'trigger_event') {
        const eventId = asTrimmedString(raw.eventId);
        if (!eventId) {
            return undefined;
        }

        return {
            kind: 'trigger_event',
            eventId
        };
    }

    if (raw.kind === 'request_cutscene_ref') {
        const cutsceneRef = asTrimmedString(raw.cutsceneRef);
        if (!cutsceneRef || !isTestCutsceneRef(cutsceneRef)) {
            return undefined;
        }

        return {
            kind: 'request_cutscene_ref',
            cutsceneRef
        };
    }

    return undefined;
};

const asInteractionConfig = (value: unknown): TestNpcInteractionConfig | undefined => {
    const raw = asObject(value);
    const outcome = asInteractionOutcome(raw?.outcome);
    if (!raw || !outcome) {
        return undefined;
    }

    return {
        distancePx: clampPositive(raw.distancePx, 56, 0),
        outcome
    };
};

const asHookRoute = (value: unknown): TestNpcSequenceHookRoute | undefined => {
    const raw = asObject(value);
    const sequenceRef = asTrimmedString(raw?.sequenceRef);
    if (!sequenceRef || !isTestNpcScriptedSequenceRef(sequenceRef)) {
        return undefined;
    }

    return {
        sequenceRef,
        restartPolicy: asRestartPolicy(raw?.restartPolicy)
    };
};

const asPlayerDistanceHookRoute = (
    value: unknown
): TestNpcPlayerDistanceSequenceHookRoute | undefined => {
    const baseRoute = asHookRoute(value);
    const raw = asObject(value);
    if (!baseRoute || typeof raw?.distancePx !== 'number' || !Number.isFinite(raw.distancePx)) {
        return undefined;
    }

    return {
        ...baseRoute,
        distancePx: Math.max(0, raw.distancePx)
    };
};

const asTriggerEventHookRoute = (
    value: unknown
): TestNpcTriggerEventSequenceHookRoute | undefined => {
    const baseRoute = asHookRoute(value);
    const raw = asObject(value);
    const eventId = asTrimmedString(raw?.eventId);
    if (!baseRoute || !eventId) {
        return undefined;
    }

    return {
        ...baseRoute,
        eventId
    };
};

const asProfileSequenceHooks = (value: unknown): TestNpcProfileSequenceHooks | undefined => {
    const raw = asObject(value);
    if (!raw) {
        return undefined;
    }

    const onTriggerEvent = Array.isArray(raw.onTriggerEvent)
        ? raw.onTriggerEvent
            .map((entry) => asTriggerEventHookRoute(entry))
            .filter((entry): entry is TestNpcTriggerEventSequenceHookRoute => entry !== undefined)
        : [];
    const hooks: TestNpcProfileSequenceHooks = {};
    const onSpawn = asHookRoute(raw.onSpawn);
    const onPlayerNear = asPlayerDistanceHookRoute(raw.onPlayerNear);
    const onPlayerFar = asPlayerDistanceHookRoute(raw.onPlayerFar);

    if (onSpawn) {
        hooks.onSpawn = onSpawn;
    }
    if (onPlayerNear) {
        hooks.onPlayerNear = onPlayerNear;
    }
    if (onPlayerFar) {
        hooks.onPlayerFar = onPlayerFar;
    }
    if (onTriggerEvent.length > 0) {
        hooks.onTriggerEvent = onTriggerEvent;
    }

    return Object.keys(hooks).length > 0 ? hooks : undefined;
};

const asProfile = (value: unknown, index: number): TestNpcProfile | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    const raw = value as Record<string, unknown>;
    const id = typeof raw.id === 'string' && raw.id.trim().length > 0
        ? raw.id.trim()
        : `npc_profile_${index + 1}`;
    const archetype = raw.archetype === 'enemy' ? 'enemy' : 'passive';
    const rawVisual = typeof raw.visual === 'object' && raw.visual !== null && !Array.isArray(raw.visual)
        ? raw.visual as Record<string, unknown>
        : {};
    const passiveBehaviorSource = typeof raw.passiveBehavior === 'object' && raw.passiveBehavior !== null && !Array.isArray(raw.passiveBehavior)
        ? raw.passiveBehavior as Record<string, unknown>
        : null;
    const enemyBehaviorSource = typeof raw.enemyBehavior === 'object' && raw.enemyBehavior !== null && !Array.isArray(raw.enemyBehavior)
        ? raw.enemyBehavior as Record<string, unknown>
        : null;

    return {
        id,
        displayName: typeof raw.displayName === 'string' && raw.displayName.trim().length > 0
            ? raw.displayName.trim()
            : id,
        archetype,
        scriptedLoopRef: typeof raw.scriptedLoopRef === 'string' && raw.scriptedLoopRef.trim().length > 0
            ? raw.scriptedLoopRef.trim()
            : undefined,
        sequenceHooks: asProfileSequenceHooks(raw.sequenceHooks),
        interaction: asInteractionConfig(raw.interaction),
        playerBodyContactMode: asPlayerBodyContactMode(raw.playerBodyContactMode, 'block'),
        visual: {
            label: typeof rawVisual.label === 'string' && rawVisual.label.trim().length > 0
                ? rawVisual.label.trim()
                : archetype === 'enemy' ? 'E' : 'P',
            bodyWidth: clampPositive(rawVisual.bodyWidth, archetype === 'enemy' ? 30 : 28, 12),
            bodyHeight: clampPositive(rawVisual.bodyHeight, archetype === 'enemy' ? 42 : 40, 12),
            fillColor: typeof rawVisual.fillColor === 'number' ? rawVisual.fillColor : (archetype === 'enemy' ? 0xe55d4b : 0x7cea98),
            strokeColor: typeof rawVisual.strokeColor === 'number' ? rawVisual.strokeColor : (archetype === 'enemy' ? 0x6be0dc : 0x196b42),
            accentColor: typeof rawVisual.accentColor === 'number' ? rawVisual.accentColor : undefined,
            textColor: typeof rawVisual.textColor === 'string' ? rawVisual.textColor : undefined
        },
        passiveBehavior: archetype === 'passive'
            ? {
                mode: passiveBehaviorSource?.mode === 'idle_patrol' ? 'idle_patrol' : DEFAULT_PASSIVE_BEHAVIOR.mode,
                patrolDistance: clampPositive(passiveBehaviorSource?.patrolDistance, DEFAULT_PASSIVE_BEHAVIOR.patrolDistance),
                moveSpeed: clampPositive(passiveBehaviorSource?.moveSpeed, DEFAULT_PASSIVE_BEHAVIOR.moveSpeed),
                idleDurationMs: clampPositive(passiveBehaviorSource?.idleDurationMs, DEFAULT_PASSIVE_BEHAVIOR.idleDurationMs, 0),
                patrolPauseMs: clampPositive(passiveBehaviorSource?.patrolPauseMs, DEFAULT_PASSIVE_BEHAVIOR.patrolPauseMs, 0)
            }
            : undefined,
        enemyBehavior: archetype === 'enemy'
            ? {
                patrolDistance: clampPositive(enemyBehaviorSource?.patrolDistance, DEFAULT_ENEMY_BEHAVIOR.patrolDistance),
                patrolSpeed: clampPositive(enemyBehaviorSource?.patrolSpeed, DEFAULT_ENEMY_BEHAVIOR.patrolSpeed),
                alertDurationMs: clampPositive(enemyBehaviorSource?.alertDurationMs, DEFAULT_ENEMY_BEHAVIOR.alertDurationMs, 0),
                chaseSpeed: clampPositive(enemyBehaviorSource?.chaseSpeed, DEFAULT_ENEMY_BEHAVIOR.chaseSpeed),
                senseRadius: clampPositive(enemyBehaviorSource?.senseRadius, DEFAULT_ENEMY_BEHAVIOR.senseRadius),
                chaseReleaseRadius: clampPositive(enemyBehaviorSource?.chaseReleaseRadius, DEFAULT_ENEMY_BEHAVIOR.chaseReleaseRadius),
                returnSpeed: clampPositive(enemyBehaviorSource?.returnSpeed, DEFAULT_ENEMY_BEHAVIOR.returnSpeed),
                postTolerance: clampPositive(enemyBehaviorSource?.postTolerance, DEFAULT_ENEMY_BEHAVIOR.postTolerance, 1)
            }
            : undefined
    };
};

const PROFILE_LIST = (Array.isArray(profilesJson) ? profilesJson : [])
    .map((entry, index) => asProfile(entry, index))
    .filter((entry): entry is TestNpcProfile => entry !== null);

const PROFILE_MAP = new Map(PROFILE_LIST.map((profile) => [profile.id, profile] satisfies readonly [string, TestNpcProfile]));

export const getTestNpcProfiles = (): readonly TestNpcProfile[] => {
    return PROFILE_LIST;
};

export const getTestNpcProfileIds = (): readonly string[] => {
    return PROFILE_LIST.map((profile) => profile.id);
};

export const getTestNpcProfile = (profileId: string): TestNpcProfile | null => {
    return PROFILE_MAP.get(profileId) ?? null;
};

export const resolveTestNpcConfig = (instance: TestNpcInstanceConfig): TestNpcResolvedConfig | null => {
    const profile = getTestNpcProfile(instance.profileId);
    if (!profile) {
        return null;
    }

    const profileInteraction = profile.interaction;
    const interactionOverride = instance.interactionOverride;
    const resolvedInteraction = interactionOverride?.outcome === null
        ? null
        : (() => {
            const outcome = interactionOverride?.outcome ?? profileInteraction?.outcome;
            if (!outcome) {
                return null;
            }

            return {
                distancePx: clampPositive(
                    interactionOverride?.distancePx,
                    profileInteraction?.distancePx ?? 56,
                    0
                ),
                outcome: { ...outcome }
            } satisfies TestNpcInteractionConfig;
        })();

    return {
        instance,
        profile,
        facing: instance.facing === 'left' ? 'left' : 'right',
        scriptedLoopRef: instance.scriptedLoopRef === null
            ? null
            : (typeof instance.scriptedLoopRef === 'string' && instance.scriptedLoopRef.trim().length > 0
                ? instance.scriptedLoopRef.trim()
                : (profile.scriptedLoopRef ?? null)),
        sequenceHooks: resolveTestNpcSequenceHooks(profile.sequenceHooks, instance.sequenceHookOverrides),
        interaction: resolvedInteraction,
        playerBodyContactMode: asPlayerBodyContactMode(instance.playerBodyContactMode, profile.playerBodyContactMode),
        passiveBehavior: profile.archetype === 'passive'
            ? {
                mode: instance.behavior?.passiveMode ?? profile.passiveBehavior?.mode ?? DEFAULT_PASSIVE_BEHAVIOR.mode,
                patrolDistance: clampPositive(instance.behavior?.patrolDistance, profile.passiveBehavior?.patrolDistance ?? DEFAULT_PASSIVE_BEHAVIOR.patrolDistance),
                moveSpeed: clampPositive(
                    instance.behavior?.moveSpeed,
                    profile.passiveBehavior?.moveSpeed ?? DEFAULT_PASSIVE_BEHAVIOR.moveSpeed
                ),
                idleDurationMs: clampPositive(
                    instance.behavior?.idleDurationMs,
                    profile.passiveBehavior?.idleDurationMs ?? DEFAULT_PASSIVE_BEHAVIOR.idleDurationMs,
                    0
                ),
                patrolPauseMs: clampPositive(
                    instance.behavior?.patrolPauseMs,
                    profile.passiveBehavior?.patrolPauseMs ?? DEFAULT_PASSIVE_BEHAVIOR.patrolPauseMs,
                    0
                )
            }
            : null,
        enemyBehavior: profile.archetype === 'enemy'
            ? {
                patrolDistance: clampPositive(
                    instance.behavior?.patrolDistance,
                    profile.enemyBehavior?.patrolDistance ?? DEFAULT_ENEMY_BEHAVIOR.patrolDistance
                ),
                patrolSpeed: clampPositive(
                    instance.behavior?.patrolSpeed,
                    profile.enemyBehavior?.patrolSpeed ?? DEFAULT_ENEMY_BEHAVIOR.patrolSpeed
                ),
                alertDurationMs: clampPositive(
                    instance.behavior?.alertDurationMs,
                    profile.enemyBehavior?.alertDurationMs ?? DEFAULT_ENEMY_BEHAVIOR.alertDurationMs,
                    0
                ),
                chaseSpeed: clampPositive(
                    instance.behavior?.chaseSpeed,
                    profile.enemyBehavior?.chaseSpeed ?? DEFAULT_ENEMY_BEHAVIOR.chaseSpeed
                ),
                senseRadius: clampPositive(
                    instance.behavior?.senseRadius,
                    profile.enemyBehavior?.senseRadius ?? DEFAULT_ENEMY_BEHAVIOR.senseRadius
                ),
                chaseReleaseRadius: clampPositive(
                    instance.behavior?.chaseReleaseRadius,
                    profile.enemyBehavior?.chaseReleaseRadius ?? DEFAULT_ENEMY_BEHAVIOR.chaseReleaseRadius
                ),
                returnSpeed: clampPositive(
                    instance.behavior?.returnSpeed,
                    profile.enemyBehavior?.returnSpeed ?? DEFAULT_ENEMY_BEHAVIOR.returnSpeed
                ),
                postTolerance: clampPositive(
                    instance.behavior?.postTolerance,
                    profile.enemyBehavior?.postTolerance ?? DEFAULT_ENEMY_BEHAVIOR.postTolerance,
                    1
                )
            }
            : null
    };
};
