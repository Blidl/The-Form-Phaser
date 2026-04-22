import type { PlayerWorldActor } from '../player/player_runtime_contracts';
import { isTestCutsceneRef } from '../cutscene/test_cutscene_registry';
import { getTestNpcProfile, resolveTestNpcConfig } from './npc_profiles';
import type { TestNpcRuntime } from './npc_runtime';
import type {
    TestNpcInteractionAvailability,
    TestNpcInteractionArbitrationSource,
    TestNpcInteractionCutsceneRefStatus,
    TestNpcInteractionDebugState,
    TestNpcInteractionDispatchResult,
    TestNpcInteractionInputAttemptDebugEntry,
    TestNpcInteractionObservableResult,
    TestNpcInteractionOutcomeSource,
    TestNpcInteractionOutcome,
    TestNpcInteractionTargetDebugEntry,
    TestNpcInteractionUnavailableReason,
    TestNpcInstanceConfig
} from './npc_types';

const TEMPORARY_MANUAL_TRIGGER_KEY = 'I';

interface InteractionActorEntry {
    actorId: string;
    displayName: string;
    interaction: NonNullable<NonNullable<ReturnType<typeof resolveTestNpcConfig>>['interaction']>;
    outcomeSource: TestNpcInteractionOutcomeSource;
}

export interface TestNpcInteractionRuntime {
    update: () => void;
    tryDispatchCurrentTarget: () => TestNpcInteractionDispatchResult;
    getDebugState: () => TestNpcInteractionDebugState;
}

const getOutcomeRef = (outcome: TestNpcInteractionOutcome): string => {
    if (outcome.kind === 'run_sequence_ref') {
        return outcome.sequenceRef;
    }
    if (outcome.kind === 'trigger_event') {
        return outcome.eventId;
    }
    return outcome.cutsceneRef;
};

const resolveOutcomeSource = (
    instance: TestNpcInstanceConfig
): TestNpcInteractionOutcomeSource => {
    return instance.interactionOverride?.outcome !== undefined
        ? 'instance_override'
        : 'profile_default';
};

const resolveCutsceneRefDebug = (
    outcome: TestNpcInteractionOutcome,
    source: TestNpcInteractionOutcomeSource
): {
    effectiveCutsceneRef: string | null;
    cutsceneRefSource: TestNpcInteractionOutcomeSource | null;
    cutsceneRefStatus: TestNpcInteractionCutsceneRefStatus;
    cutsceneRefIssue: string | null;
} => {
    if (outcome.kind !== 'request_cutscene_ref') {
        return {
            effectiveCutsceneRef: null,
            cutsceneRefSource: null,
            cutsceneRefStatus: 'n/a',
            cutsceneRefIssue: null
        };
    }

    const cutsceneRef = outcome.cutsceneRef.trim();
    if (cutsceneRef.length <= 0) {
        return {
            effectiveCutsceneRef: null,
            cutsceneRefSource: source,
            cutsceneRefStatus: 'missing_ref',
            cutsceneRefIssue: 'cutscene ref is empty'
        };
    }
    if (!isTestCutsceneRef(cutsceneRef)) {
        return {
            effectiveCutsceneRef: cutsceneRef,
            cutsceneRefSource: source,
            cutsceneRefStatus: 'invalid_ref',
            cutsceneRefIssue: `unknown cutscene ref "${cutsceneRef}"`
        };
    }
    return {
        effectiveCutsceneRef: cutsceneRef,
        cutsceneRefSource: source,
        cutsceneRefStatus: 'valid',
        cutsceneRefIssue: null
    };
};

export const createTestNpcInteractionRuntime = (
    player: PlayerWorldActor,
    npcRuntime: Pick<TestNpcRuntime, 'dispatchInteractionOutcome' | 'getActorBounds' | 'getDebugEntries'>,
    instances: readonly TestNpcInstanceConfig[]
): TestNpcInteractionRuntime => {
    const interactionActors = instances
        .map((instance) => {
            const profile = getTestNpcProfile(instance.profileId);
            const resolved = resolveTestNpcConfig(instance);
            if (!profile || !resolved?.interaction) {
                return null;
            }
            return {
                actorId: instance.id,
                displayName: profile.displayName,
                interaction: resolved.interaction,
                outcomeSource: resolveOutcomeSource(instance)
            } satisfies InteractionActorEntry;
        })
        .filter((entry): entry is InteractionActorEntry => entry !== null)
        .map((entry) => ({
            actorId: entry.actorId,
            displayName: entry.displayName,
            interaction: entry.interaction,
            outcomeSource: entry.outcomeSource
        } satisfies InteractionActorEntry));
    let currentTarget: TestNpcInteractionTargetDebugEntry | null = null;
    let arbitrationSource: TestNpcInteractionArbitrationSource = 'none';
    let arbitrationDetail: string | null = null;
    let attemptNonce = 0;
    let lastInputAttempt: TestNpcInteractionInputAttemptDebugEntry | null = null;
    let lastDispatchResult: TestNpcInteractionDispatchResult | null = null;

    const resolveUnavailableReason = (
        actorId: string,
        distancePx: number,
        maxDistancePx: number
    ): TestNpcInteractionUnavailableReason | null => {
        const actorBounds = npcRuntime.getActorBounds(actorId);
        if (!actorBounds) {
            return 'missing_runtime_actor';
        }

        const npcDebugEntry = npcRuntime.getDebugEntries().find((entry) => entry.id === actorId) ?? null;
        const isBusy = npcDebugEntry?.state === 'hook_sequence'
            || npcDebugEntry?.state === 'interaction_sequence';
        if (isBusy) {
            return 'npc_busy';
        }

        if (distancePx > maxDistancePx) {
            return 'out_of_range';
        }

        return null;
    };

    return {
        update: (): void => {
            const candidates: TestNpcInteractionTargetDebugEntry[] = [];

            interactionActors.forEach((entry) => {
                const actorBounds = npcRuntime.getActorBounds(entry.actorId);
                const actorX = actorBounds?.x ?? Number.POSITIVE_INFINITY;
                const actorY = actorBounds?.y ?? Number.POSITIVE_INFINITY;
                const distancePx = actorBounds
                    ? Math.hypot(player.arcadeBodyObject.x - actorX, player.arcadeBodyObject.y - actorY)
                    : Number.POSITIVE_INFINITY;
                const unavailableReason = resolveUnavailableReason(
                    entry.actorId,
                    distancePx,
                    entry.interaction.distancePx
                );
                const availability: TestNpcInteractionAvailability = unavailableReason === null
                    ? 'available'
                    : 'unavailable';
                const candidate: TestNpcInteractionTargetDebugEntry = {
                    actorId: entry.actorId,
                    displayName: entry.displayName,
                    distancePx: Number.isFinite(distancePx) ? distancePx : -1,
                    maxDistancePx: entry.interaction.distancePx,
                    outcomeKind: entry.interaction.outcome.kind,
                    outcomeRef: getOutcomeRef(entry.interaction.outcome),
                    outcomeSource: entry.outcomeSource,
                    ...resolveCutsceneRefDebug(entry.interaction.outcome, entry.outcomeSource),
                    availability,
                    unavailableReason
                };
                candidates.push(candidate);
            });

            const sortByDistance = (
                left: TestNpcInteractionTargetDebugEntry,
                right: TestNpcInteractionTargetDebugEntry
            ): number => {
                const leftDistance = left.distancePx >= 0 ? left.distancePx : Number.POSITIVE_INFINITY;
                const rightDistance = right.distancePx >= 0 ? right.distancePx : Number.POSITIVE_INFINITY;
                return leftDistance - rightDistance;
            };
            const availableCandidates = candidates
                .filter((entry) => entry.availability === 'available')
                .sort(sortByDistance);
            const unavailableCandidates = candidates
                .filter((entry) => entry.availability !== 'available')
                .sort(sortByDistance);
            const stableCurrentTarget = currentTarget
                ? availableCandidates.find((entry) => entry.actorId === currentTarget?.actorId) ?? null
                : null;

            if (stableCurrentTarget) {
                currentTarget = stableCurrentTarget;
                arbitrationSource = 'stable_current_target';
                arbitrationDetail = stableCurrentTarget.actorId;
                return;
            }

            if (availableCandidates.length > 0) {
                currentTarget = availableCandidates[0] ?? null;
                arbitrationSource = 'nearest_available';
                arbitrationDetail = currentTarget?.actorId ?? null;
                return;
            }

            if (unavailableCandidates.length > 0) {
                currentTarget = unavailableCandidates[0] ?? null;
                arbitrationSource = 'nearest_unavailable';
                arbitrationDetail = currentTarget?.unavailableReason ?? currentTarget?.actorId ?? null;
                return;
            }

            currentTarget = null;
            arbitrationSource = 'none';
            arbitrationDetail = null;
        },
        tryDispatchCurrentTarget: (): TestNpcInteractionDispatchResult => {
            const commitAttempt = (
                sourceTarget: TestNpcInteractionTargetDebugEntry | null,
                observableResult: TestNpcInteractionObservableResult,
                detail: string
            ): void => {
                attemptNonce += 1;
                lastInputAttempt = {
                    attemptNonce,
                    actorId: sourceTarget?.actorId ?? null,
                    distancePx: sourceTarget ? sourceTarget.distancePx : null,
                    availability: sourceTarget?.availability ?? null,
                    unavailableReason: sourceTarget?.unavailableReason ?? null,
                    outcomeKind: sourceTarget?.outcomeKind ?? null,
                    outcomeRef: sourceTarget?.outcomeRef ?? null,
                    outcomeSource: sourceTarget?.outcomeSource ?? null,
                    effectiveCutsceneRef: sourceTarget?.effectiveCutsceneRef ?? null,
                    cutsceneRefSource: sourceTarget?.cutsceneRefSource ?? null,
                    cutsceneRefStatus: sourceTarget?.cutsceneRefStatus ?? 'n/a',
                    cutsceneRefIssue: sourceTarget?.cutsceneRefIssue ?? null,
                    observableResult,
                    detail
                };
            };

            if (!currentTarget) {
                commitAttempt(null, 'no_target', 'no interaction target is configured');
                lastDispatchResult = {
                    actorId: null,
                    outcomeKind: null,
                    result: 'no_target',
                    detail: 'no interaction target is configured'
                };
                return lastDispatchResult;
            }

            if (currentTarget.availability !== 'available') {
                commitAttempt(
                    currentTarget,
                    currentTarget.unavailableReason === 'out_of_range'
                        ? 'out_of_range'
                        : (currentTarget.unavailableReason === 'npc_busy' ? 'busy' : 'rejected'),
                    currentTarget.unavailableReason ?? 'interaction target is unavailable'
                );
                lastDispatchResult = {
                    actorId: currentTarget.actorId,
                    outcomeKind: currentTarget.outcomeKind,
                    result: 'unavailable',
                    detail: currentTarget.unavailableReason ?? 'interaction target is unavailable'
                };
                return lastDispatchResult;
            }

            const interactionActor = interactionActors.find((entry) => entry.actorId === currentTarget?.actorId) ?? null;
            if (!interactionActor || !interactionActor.interaction?.outcome) {
                commitAttempt(currentTarget, 'no_outcome', 'interaction target disappeared before dispatch');
                lastDispatchResult = {
                    actorId: currentTarget.actorId,
                    outcomeKind: currentTarget.outcomeKind,
                    result: 'unknown_actor',
                    detail: 'interaction target disappeared before dispatch'
                };
                return lastDispatchResult;
            }

            lastDispatchResult = npcRuntime.dispatchInteractionOutcome(
                interactionActor.actorId,
                interactionActor.interaction.outcome
            );
            const observableResult: TestNpcInteractionObservableResult = lastDispatchResult.result === 'dispatched_sequence'
                ? 'dispatched_sequence'
                : (lastDispatchResult.result === 'dispatched_event'
                    ? 'dispatched_event'
                    : (lastDispatchResult.result === 'requested_cutscene'
                        ? 'requested_cutscene'
                        : (lastDispatchResult.result === 'busy'
                            ? 'busy'
                            : (lastDispatchResult.result === 'no_target'
                                ? 'no_target'
                                : (lastDispatchResult.result === 'invalid_outcome'
                                    ? 'no_outcome'
                                    : 'rejected')))));
            commitAttempt(currentTarget, observableResult, lastDispatchResult.detail);
            return lastDispatchResult;
        },
        getDebugState: (): TestNpcInteractionDebugState => ({
            target: currentTarget,
            arbitrationSource,
            arbitrationDetail,
            lastInputAttempt,
            lastDispatchResult,
            temporaryManualTriggerKey: TEMPORARY_MANUAL_TRIGGER_KEY
        })
    };
};
