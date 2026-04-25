import {
    DEFAULT_CONTROL_LAYER_PRIORITIES,
    type ActorControlClaim,
    type ActorControlClaimRequest,
    type ControlLayer,
} from './actor_control_types';

export function getDefaultControlPriority(layer: ControlLayer): number {
    return DEFAULT_CONTROL_LAYER_PRIORITIES[layer];
}

export function normalizeActorControlClaimRequest(
    request: ActorControlClaimRequest,
    fallbackStartedAtMs: number,
): ActorControlClaim {
    const ownerId = request.ownerId.trim();
    const actorId = request.actorId.trim();

    if (ownerId.length === 0 || actorId.length === 0) {
        throw new Error('invalid_actor_control_claim: ownerId and actorId are required');
    }

    const reason = request.reason?.trim();

    return {
        ownerId,
        actorId,
        layer: request.layer,
        priority: request.priority ?? getDefaultControlPriority(request.layer),
        lockMovement: request.lockMovement ?? false,
        lockFacing: request.lockFacing ?? false,
        lockActions: request.lockActions ?? false,
        lockPresentation: request.lockPresentation ?? false,
        reason: reason && reason.length > 0 ? reason : undefined,
        startedAtMs: request.startedAtMs ?? fallbackStartedAtMs,
    };
}

export function compareActorControlClaims(a: ActorControlClaim, b: ActorControlClaim): number {
    if (a.priority !== b.priority) {
        return b.priority - a.priority;
    }

    if (a.startedAtMs !== b.startedAtMs) {
        return a.startedAtMs - b.startedAtMs;
    }

    if (a.ownerId < b.ownerId) {
        return -1;
    }

    if (a.ownerId > b.ownerId) {
        return 1;
    }

    return 0;
}

export function selectActiveActorControlClaim(claims: readonly ActorControlClaim[]): ActorControlClaim | null {
    if (claims.length === 0) {
        return null;
    }

    let winner = claims[0];

    for (let index = 1; index < claims.length; index += 1) {
        const candidate = claims[index];
        if (compareActorControlClaims(candidate, winner) < 0) {
            winner = candidate;
        }
    }

    return winner;
}

export function cloneActorControlClaim(claim: ActorControlClaim): ActorControlClaim {
    return { ...claim };
}