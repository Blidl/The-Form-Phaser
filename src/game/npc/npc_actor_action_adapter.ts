import type { ActorActionAdapter, ActorActionStepUpdateResult, ActorAction } from '../actor_actions/actor_action_types';

export type TestNpcHorizontalMovementResult =
    | 'applied'
    | 'blocked_left'
    | 'blocked_right'
    | 'triangle_push_locked';

export interface TestNpcActorActionAdapterHost {
    getX: () => number;
    stopHorizontalMovement: () => void;
    tryApplyHorizontalMovement: (velocityX: number, deltaMs: number) => TestNpcHorizontalMovementResult;
    setFacing: (facing: -1 | 1) => void;
    setPresentationAnimationStub: (animationId: string | null) => void;
    setPresentationEmotionStub: (emotionId: string | null) => void;
    emitActorActionEvent: (eventId: string, payload?: Record<string, unknown>) => void;
}

interface AdapterState {
    waitRemainingMs: number;
}

const RUNNING_RESULT: ActorActionStepUpdateResult = { status: 'running' };
const SUCCEEDED_RESULT: ActorActionStepUpdateResult = { status: 'succeeded' };

export const createTestNpcActorActionAdapter = (
    host: TestNpcActorActionAdapterHost
): ActorActionAdapter => {
    const state: AdapterState = {
        waitRemainingMs: 0
    };

    const updateWalkToX = (
        action: Extract<ActorAction, { kind: 'walk_to_x' }>,
        deltaMs: number
    ): ActorActionStepUpdateResult => {
        const deltaX = action.targetX - host.getX();
        if (Math.abs(deltaX) <= action.tolerancePx) {
            host.stopHorizontalMovement();
            return SUCCEEDED_RESULT;
        }

        const direction: -1 | 1 = deltaX < 0 ? -1 : 1;
        host.setFacing(direction);
        const movementResult = host.tryApplyHorizontalMovement(action.moveSpeed * direction, deltaMs);
        if (movementResult === 'triangle_push_locked') {
            return RUNNING_RESULT;
        }
        if (movementResult !== 'applied') {
            return {
                status: 'failed',
                reason: movementResult
            };
        }
        return RUNNING_RESULT;
    };

    return {
        beginAction: (action): ActorActionStepUpdateResult | void => {
            if (action.kind === 'wait') {
                state.waitRemainingMs = Math.max(0, action.durationMs);
                host.stopHorizontalMovement();
                return state.waitRemainingMs <= 0 ? SUCCEEDED_RESULT : RUNNING_RESULT;
            }
            if (action.kind === 'face') {
                host.stopHorizontalMovement();
                host.setFacing(action.facing);
                return SUCCEEDED_RESULT;
            }
            if (action.kind === 'walk_to_x') {
                return updateWalkToX(action, 0);
            }
            if (action.kind === 'play_animation') {
                // TEMPORARY: animation routing currently goes through a runtime-safe
                // NPC presentation stub instead of a dedicated presentation layer.
                host.setPresentationAnimationStub(action.animationId);
                return SUCCEEDED_RESULT;
            }
            if (action.kind === 'set_emotion') {
                // TEMPORARY: emotion routing currently goes through a runtime-safe
                // NPC presentation stub instead of a dedicated presentation layer.
                host.setPresentationEmotionStub(action.emotionId);
                return SUCCEEDED_RESULT;
            }

            host.emitActorActionEvent(action.eventId, action.payload);
            return SUCCEEDED_RESULT;
        },
        updateAction: (action, deltaMs): ActorActionStepUpdateResult => {
            if (action.kind === 'wait') {
                state.waitRemainingMs = Math.max(0, state.waitRemainingMs - Math.max(0, deltaMs));
                host.stopHorizontalMovement();
                return state.waitRemainingMs <= 0 ? SUCCEEDED_RESULT : RUNNING_RESULT;
            }
            if (action.kind === 'walk_to_x') {
                return updateWalkToX(action, deltaMs);
            }

            return SUCCEEDED_RESULT;
        },
        cancelAction: (action): void => {
            if (action.kind === 'wait' || action.kind === 'walk_to_x' || action.kind === 'face') {
                host.stopHorizontalMovement();
            }
        }
    };
};
