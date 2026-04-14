import profilesJson from './data/test_npc_profiles.json';
import type {
    TestNpcEnemyProfileBehavior,
    TestNpcPassiveProfileBehavior,
    TestNpcPlayerBodyContactMode,
    TestNpcProfile,
    TestNpcResolvedConfig,
    TestNpcInstanceConfig
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

    return {
        instance,
        profile,
        facing: instance.facing === 'left' ? 'left' : 'right',
        scriptedLoopRef: instance.scriptedLoopRef === null
            ? null
            : (typeof instance.scriptedLoopRef === 'string' && instance.scriptedLoopRef.trim().length > 0
                ? instance.scriptedLoopRef.trim()
                : (profile.scriptedLoopRef ?? null)),
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
