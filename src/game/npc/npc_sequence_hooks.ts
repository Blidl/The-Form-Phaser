import type { ActorActionSequence } from '../actor_actions/actor_action_types';
import {
    cloneTestNpcScriptedSequenceAction,
    getTestNpcScriptedSequenceDefinition
} from './npc_scripted_sequences';
import type {
    TestNpcInstanceSequenceHookRefOverrides,
    TestNpcPlayerDistanceSequenceHookRoute,
    TestNpcProfileSequenceHooks,
    TestNpcResolvedSequenceHooks,
    TestNpcSequenceHookId,
    TestNpcSequenceHookRestartPolicy,
    TestNpcSequenceHookRoute,
    TestNpcTriggerEventSequenceHookRoute
} from './npc_types';

export const NPC_SEQUENCE_HOOK_SOURCE = 'npc_sequence_hook';

const DEFAULT_RESTART_POLICY: TestNpcSequenceHookRestartPolicy = 'restart';

const cloneBaseHookRoute = <TRoute extends TestNpcSequenceHookRoute>(route: TRoute): TRoute => {
    return { ...route };
};

const cloneTriggerEventRoute = (
    route: TestNpcTriggerEventSequenceHookRoute
): TestNpcTriggerEventSequenceHookRoute => ({ ...route });

const resolveRestartPolicy = (
    value: TestNpcSequenceHookRestartPolicy | undefined
): TestNpcSequenceHookRestartPolicy => value === 'keep_running' ? 'keep_running' : DEFAULT_RESTART_POLICY;

const applySequenceRefOverride = <TRoute extends TestNpcSequenceHookRoute>(
    route: TRoute | undefined,
    sequenceRefOverride: string | null | undefined
): TRoute | null => {
    if (sequenceRefOverride === null) {
        return null;
    }
    if (typeof sequenceRefOverride === 'string' && sequenceRefOverride.trim().length > 0) {
        if (!route) {
            return null;
        }
        return {
            ...route,
            sequenceRef: sequenceRefOverride.trim()
        };
    }
    return route ? cloneBaseHookRoute(route) : null;
};

export const resolveTestNpcSequenceHooks = (
    profileHooks: TestNpcProfileSequenceHooks | undefined,
    overrides: TestNpcInstanceSequenceHookRefOverrides | undefined
): TestNpcResolvedSequenceHooks => {
    const profileOnSpawn = profileHooks?.onSpawn;
    const resolvedOnSpawn = overrides?.onSpawnSequenceRef === null
        ? null
        : (typeof overrides?.onSpawnSequenceRef === 'string' && overrides.onSpawnSequenceRef.trim().length > 0
            ? {
                sequenceRef: overrides.onSpawnSequenceRef.trim(),
                restartPolicy: resolveRestartPolicy(profileOnSpawn?.restartPolicy)
            }
            : (profileOnSpawn ? cloneBaseHookRoute(profileOnSpawn) : null));
    const resolvedOnPlayerNear = applySequenceRefOverride(profileHooks?.onPlayerNear, overrides?.onPlayerNearSequenceRef);
    const resolvedOnPlayerFar = applySequenceRefOverride(profileHooks?.onPlayerFar, overrides?.onPlayerFarSequenceRef);

    return {
        onSpawn: resolvedOnSpawn
            ? {
                ...resolvedOnSpawn,
                restartPolicy: resolveRestartPolicy(resolvedOnSpawn.restartPolicy)
            }
            : null,
        onPlayerNear: resolvedOnPlayerNear
            ? {
                ...resolvedOnPlayerNear,
                restartPolicy: resolveRestartPolicy(resolvedOnPlayerNear.restartPolicy)
            } as TestNpcPlayerDistanceSequenceHookRoute
            : null,
        onPlayerFar: resolvedOnPlayerFar
            ? {
                ...resolvedOnPlayerFar,
                restartPolicy: resolveRestartPolicy(resolvedOnPlayerFar.restartPolicy)
            } as TestNpcPlayerDistanceSequenceHookRoute
            : null,
        onTriggerEvent: (profileHooks?.onTriggerEvent ?? []).map((route) => ({
            ...cloneTriggerEventRoute(route),
            restartPolicy: resolveRestartPolicy(route.restartPolicy)
        }))
    };
};

export const createTestNpcHookSequence = (
    actorId: string,
    hookId: TestNpcSequenceHookId,
    sequenceRef: string
): ActorActionSequence | null => {
    const definition = getTestNpcScriptedSequenceDefinition(sequenceRef);
    if (!definition) {
        return null;
    }

    return {
        id: `${actorId}:hook:${hookId}:${definition.id}`,
        source: NPC_SEQUENCE_HOOK_SOURCE,
        targetRef: definition.id,
        actions: definition.actions.map(cloneTestNpcScriptedSequenceAction)
    };
};

