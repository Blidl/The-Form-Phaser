import {
    cloneActorControlClaim,
    getDefaultControlPriority,
    normalizeActorControlClaimRequest,
    selectActiveActorControlClaim,
} from './actor_control_claims';
import { createActorControlDebugSnapshot, type ActorControlDebugSnapshot } from './actor_control_debug';
import type {
    ActorControlClaim,
    ActorControlClaimRequest,
    ActorControlClaimResult,
    ActorControlRegistry,
    ActorControlReleaseRequest,
    ActorControlReleaseResult,
    ControlLayer,
} from './actor_control_types';

function isClaimOwnedBy(claim: ActorControlClaim, ownerId: string, actorId: string): boolean {
    return claim.ownerId === ownerId && claim.actorId === actorId;
}

function cloneClaims(claims: readonly ActorControlClaim[]): ActorControlClaim[] {
    return claims.map((claim) => cloneActorControlClaim(claim));
}

export function createActorControlRegistry(options?: {
    readonly nowMs?: () => number;
}): ActorControlRegistry {
    const nowMs = options?.nowMs ?? Date.now;
    const claimsByActor = new Map<string, ActorControlClaim[]>();

    function getInternalActiveClaim(actorId: string): ActorControlClaim | null {
        const claims = claimsByActor.get(actorId);
        if (!claims || claims.length === 0) {
            return null;
        }

        return selectActiveActorControlClaim(claims);
    }

    function upsertClaim(claim: ActorControlClaim): void {
        const claims = claimsByActor.get(claim.actorId);
        if (!claims) {
            claimsByActor.set(claim.actorId, [claim]);
            return;
        }

        const existingIndex = claims.findIndex((existingClaim) => existingClaim.ownerId === claim.ownerId);
        if (existingIndex >= 0) {
            claims[existingIndex] = claim;
            return;
        }

        claims.push(claim);
    }

    function claimControl(request: ActorControlClaimRequest): ActorControlClaimResult {
        const normalizedClaim = normalizeActorControlClaimRequest(request, nowMs());
        upsertClaim(normalizedClaim);

        const activeClaim = getInternalActiveClaim(normalizedClaim.actorId);
        if (activeClaim === null) {
            throw new Error('invalid_actor_control_claim: active claim should exist after claimControl');
        }

        return {
            claim: cloneActorControlClaim(normalizedClaim),
            activeClaim: cloneActorControlClaim(activeClaim),
            becameActive: isClaimOwnedBy(activeClaim, normalizedClaim.ownerId, normalizedClaim.actorId),
        };
    }

    function releaseControl(request: ActorControlReleaseRequest): ActorControlReleaseResult {
        const actorId = request.actorId.trim();
        const ownerId = request.ownerId.trim();

        const claims = claimsByActor.get(actorId);
        if (!claims || claims.length === 0) {
            return {
                released: false,
                activeClaimAfterRelease: null,
            };
        }

        const releaseIndex = claims.findIndex((claim) => claim.ownerId === ownerId);
        if (releaseIndex < 0) {
            const activeClaim = selectActiveActorControlClaim(claims);
            return {
                released: false,
                activeClaimAfterRelease: activeClaim ? cloneActorControlClaim(activeClaim) : null,
            };
        }

        const [releasedClaim] = claims.splice(releaseIndex, 1);
        if (claims.length === 0) {
            claimsByActor.delete(actorId);
            return {
                released: true,
                releasedClaim: cloneActorControlClaim(releasedClaim),
                activeClaimAfterRelease: null,
            };
        }

        const activeAfterRelease = selectActiveActorControlClaim(claims);
        return {
            released: true,
            releasedClaim: cloneActorControlClaim(releasedClaim),
            activeClaimAfterRelease: activeAfterRelease ? cloneActorControlClaim(activeAfterRelease) : null,
        };
    }

    function getActiveClaim(actorId: string): ActorControlClaim | null {
        const activeClaim = getInternalActiveClaim(actorId.trim());
        return activeClaim ? cloneActorControlClaim(activeClaim) : null;
    }

    function canControl(actorId: string, requestedLayer: ControlLayer, requestedPriority?: number): boolean {
        const activeClaim = getInternalActiveClaim(actorId.trim());
        if (!activeClaim) {
            return true;
        }

        const candidatePriority = requestedPriority ?? getDefaultControlPriority(requestedLayer);
        return candidatePriority >= activeClaim.priority;
    }

    function getDebugSnapshot(actorId?: string): ActorControlDebugSnapshot {
        if (actorId !== undefined) {
            const normalizedActorId = actorId.trim();
            const actorClaims = claimsByActor.get(normalizedActorId);
            const singleActorMap = new Map<string, readonly ActorControlClaim[]>();
            if (actorClaims && actorClaims.length > 0) {
                singleActorMap.set(normalizedActorId, cloneClaims(actorClaims));
            }

            return createActorControlDebugSnapshot(singleActorMap);
        }

        const allClaims = new Map<string, readonly ActorControlClaim[]>();
        for (const [currentActorId, claims] of claimsByActor.entries()) {
            if (claims.length > 0) {
                allClaims.set(currentActorId, cloneClaims(claims));
            }
        }

        return createActorControlDebugSnapshot(allClaims);
    }

    return {
        claimControl,
        releaseControl,
        getActiveClaim,
        canControl,
        getDebugSnapshot,
    };
}
