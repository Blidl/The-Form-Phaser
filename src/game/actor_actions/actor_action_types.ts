export type ActorActionExecutionStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface ActorActionBase {
    kind: string;
    ref?: string;
}

export interface ActorWaitAction extends ActorActionBase {
    kind: 'wait';
    durationMs: number;
}

export interface ActorFaceAction extends ActorActionBase {
    kind: 'face';
    facing: -1 | 1;
}

export interface ActorWalkToXAction extends ActorActionBase {
    kind: 'walk_to_x';
    targetX: number;
    moveSpeed: number;
    tolerancePx: number;
}

export interface ActorPlayAnimationAction extends ActorActionBase {
    kind: 'play_animation';
    animationId: string;
}

export interface ActorSetEmotionAction extends ActorActionBase {
    kind: 'set_emotion';
    emotionId: string;
}

export interface ActorTriggerEventAction extends ActorActionBase {
    kind: 'trigger_event';
    eventId: string;
    payload?: Record<string, unknown>;
}

export type ActorAction =
    | ActorWaitAction
    | ActorFaceAction
    | ActorWalkToXAction
    | ActorPlayAnimationAction
    | ActorSetEmotionAction
    | ActorTriggerEventAction;

export interface ActorActionSequence {
    id: string;
    source: string;
    targetRef?: string;
    actions: readonly ActorAction[];
}

export type ActorActionStepUpdateResult =
    | { status: 'running' }
    | { status: 'succeeded' }
    | { status: 'failed'; reason: string };

export interface ActorActionAdapter {
    beginAction: (action: ActorAction) => ActorActionStepUpdateResult | void;
    updateAction: (action: ActorAction, deltaMs: number) => ActorActionStepUpdateResult;
    cancelAction: (action: ActorAction) => void;
}

export interface ActorActionExecutionSnapshot {
    sequenceId: string | null;
    sequenceSource: string | null;
    sequenceTargetRef: string | null;
    sequenceStatus: ActorActionExecutionStatus | null;
    activeActionIndex: number;
    activeAction: ActorAction | null;
    activeActionStatus: ActorActionExecutionStatus | null;
    activeActionRef: string | null;
    failureReason: string | null;
}

export const describeActorActionTarget = (action: ActorAction | null): string | null => {
    if (!action) {
        return null;
    }

    if (action.kind === 'wait') {
        return `${Math.round(action.durationMs)}ms`;
    }
    if (action.kind === 'face') {
        return action.facing < 0 ? 'left' : 'right';
    }
    if (action.kind === 'walk_to_x') {
        return `x=${action.targetX.toFixed(1)}`;
    }
    if (action.kind === 'play_animation') {
        return action.animationId;
    }
    if (action.kind === 'set_emotion') {
        return action.emotionId;
    }
    return action.eventId;
};
