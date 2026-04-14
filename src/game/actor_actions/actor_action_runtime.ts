import type {
    ActorActionAdapter,
    ActorActionExecutionSnapshot,
    ActorActionExecutionStatus,
    ActorActionSequence,
    ActorActionStepUpdateResult
} from './actor_action_types';

export interface ActorActionSequenceRuntime {
    ensureSequence: (sequence: ActorActionSequence | null) => void;
    startSequence: (sequence: ActorActionSequence) => void;
    cancelActiveSequence: () => void;
    update: (deltaMs: number) => void;
    getSnapshot: () => Readonly<ActorActionExecutionSnapshot>;
}

interface ActiveExecution {
    sequence: ActorActionSequence;
    signature: string;
    sequenceStatus: ActorActionExecutionStatus;
    activeActionIndex: number;
    activeActionStatus: ActorActionExecutionStatus | null;
    failureReason: string | null;
}

const EMPTY_SNAPSHOT: ActorActionExecutionSnapshot = {
    sequenceId: null,
    sequenceSource: null,
    sequenceTargetRef: null,
    sequenceStatus: null,
    activeActionIndex: -1,
    activeAction: null,
    activeActionStatus: null,
    activeActionRef: null,
    failureReason: null
};

const RUNNING_STEP_RESULT: ActorActionStepUpdateResult = { status: 'running' };

const getSequenceStructuralSignature = (sequence: ActorActionSequence): string => {
    return JSON.stringify({
        id: sequence.id,
        source: sequence.source,
        actions: sequence.actions.map((action) => ({
            kind: action.kind,
            ref: action.ref ?? null
        }))
    });
};

export const createActorActionSequenceRuntime = (
    adapter: ActorActionAdapter
): ActorActionSequenceRuntime => {
    let activeExecution: ActiveExecution | null = null;

    const finishSequence = (status: ActorActionExecutionStatus, failureReason: string | null = null): void => {
        if (!activeExecution) {
            return;
        }

        activeExecution.sequenceStatus = status;
        activeExecution.activeActionIndex = -1;
        activeExecution.activeActionStatus = null;
        activeExecution.failureReason = failureReason;
    };

    const finishAction = (result: ActorActionStepUpdateResult): void => {
        if (!activeExecution) {
            return;
        }

        if (result.status === 'failed') {
            activeExecution.activeActionStatus = 'failed';
            finishSequence('failed', result.reason);
            return;
        }

        activeExecution.activeActionStatus = 'succeeded';
        activeExecution.activeActionIndex += 1;
        if (activeExecution.activeActionIndex >= activeExecution.sequence.actions.length) {
            finishSequence('succeeded');
        }
    };

    const beginUntilRunningOrDone = (): void => {
        while (activeExecution && activeExecution.sequenceStatus === 'running') {
            const action = activeExecution.sequence.actions[activeExecution.activeActionIndex];
            if (!action) {
                finishSequence('succeeded');
                return;
            }

            activeExecution.activeActionStatus = 'running';
            const beginResult = adapter.beginAction(action) ?? RUNNING_STEP_RESULT;
            if (beginResult.status === 'running') {
                return;
            }

            finishAction(beginResult);
        }
    };

    return {
        ensureSequence: (sequence): void => {
            if (!sequence) {
                if (activeExecution?.sequenceStatus === 'running') {
                    const activeAction = activeExecution.sequence.actions[activeExecution.activeActionIndex];
                    if (activeAction) {
                        adapter.cancelAction(activeAction);
                    }
                    activeExecution.sequenceStatus = 'cancelled';
                    activeExecution.activeActionStatus = 'cancelled';
                    activeExecution.activeActionIndex = -1;
                }
                return;
            }

            const nextSignature = getSequenceStructuralSignature(sequence);
            if (activeExecution && activeExecution.signature === nextSignature) {
                activeExecution.sequence = sequence;
                if (activeExecution.sequenceStatus !== 'running') {
                    activeExecution.sequenceStatus = 'running';
                    activeExecution.activeActionIndex = 0;
                    activeExecution.activeActionStatus = 'running';
                    activeExecution.failureReason = null;
                    beginUntilRunningOrDone();
                }
                return;
            }

            if (activeExecution?.sequenceStatus === 'running') {
                const activeAction = activeExecution.sequence.actions[activeExecution.activeActionIndex];
                if (activeAction) {
                    adapter.cancelAction(activeAction);
                }
            }

            activeExecution = {
                sequence,
                signature: nextSignature,
                sequenceStatus: 'running',
                activeActionIndex: 0,
                activeActionStatus: 'running',
                failureReason: null
            };
            beginUntilRunningOrDone();
        },
        startSequence: (sequence): void => {
            if (activeExecution?.sequenceStatus === 'running') {
                const activeAction = activeExecution.sequence.actions[activeExecution.activeActionIndex];
                if (activeAction) {
                    adapter.cancelAction(activeAction);
                }
            }

            activeExecution = {
                sequence,
                signature: getSequenceStructuralSignature(sequence),
                sequenceStatus: 'running',
                activeActionIndex: 0,
                activeActionStatus: 'running',
                failureReason: null
            };
            beginUntilRunningOrDone();
        },
        cancelActiveSequence: (): void => {
            if (!activeExecution) {
                return;
            }

            if (activeExecution.sequenceStatus === 'running') {
                const activeAction = activeExecution.sequence.actions[activeExecution.activeActionIndex];
                if (activeAction) {
                    adapter.cancelAction(activeAction);
                }
            }

            activeExecution.sequenceStatus = 'cancelled';
            activeExecution.activeActionStatus = 'cancelled';
            activeExecution.activeActionIndex = -1;
        },
        update: (deltaMs): void => {
            if (!activeExecution || activeExecution.sequenceStatus !== 'running') {
                return;
            }

            const action = activeExecution.sequence.actions[activeExecution.activeActionIndex];
            if (!action) {
                finishSequence('succeeded');
                return;
            }

            const result = adapter.updateAction(action, deltaMs);
            if (result.status === 'running') {
                return;
            }

            finishAction(result);
            beginUntilRunningOrDone();
        },
        getSnapshot: (): Readonly<ActorActionExecutionSnapshot> => {
            if (!activeExecution) {
                return EMPTY_SNAPSHOT;
            }

            const activeAction = activeExecution.activeActionIndex >= 0
                ? activeExecution.sequence.actions[activeExecution.activeActionIndex] ?? null
                : null;
            return {
                sequenceId: activeExecution.sequence.id,
                sequenceSource: activeExecution.sequence.source,
                sequenceTargetRef: activeExecution.sequence.targetRef ?? null,
                sequenceStatus: activeExecution.sequenceStatus,
                activeActionIndex: activeExecution.activeActionIndex,
                activeAction,
                activeActionStatus: activeAction ? activeExecution.activeActionStatus : null,
                activeActionRef: activeAction?.ref ?? activeExecution.sequence.targetRef ?? null,
                failureReason: activeExecution.failureReason
            };
        }
    };
};
