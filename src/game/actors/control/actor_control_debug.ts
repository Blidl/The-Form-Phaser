import { selectActiveActorControlClaim } from './actor_control_claims';
import type { ActorControlClaim, ControlLayer } from './actor_control_types';

export interface ActorControlDebugClaimSnapshot {
    readonly ownerId: string;
    readonly actorId: string;
    readonly layer: ControlLayer;
    readonly priority: number;
    readonly locks: {
        readonly movement: boolean;
        readonly facing: boolean;
        readonly actions: boolean;
        readonly presentation: boolean;
    };
    readonly reason?: string;
    readonly startedAtMs: number;
    readonly active: boolean;
}

export interface ActorControlDebugActorSnapshot {
    readonly actorId: string;
    readonly activeClaim: ActorControlDebugClaimSnapshot | null;
    readonly claims: readonly ActorControlDebugClaimSnapshot[];
}

export interface ActorControlDebugSnapshot {
    readonly actors: readonly ActorControlDebugActorSnapshot[];
}

function isSameClaim(a: ActorControlClaim, b: ActorControlClaim): boolean {
    return (
        a.ownerId === b.ownerId
        && a.actorId === b.actorId
        && a.layer === b.layer
        && a.priority === b.priority
        && a.lockMovement === b.lockMovement
        && a.lockFacing === b.lockFacing
        && a.lockActions === b.lockActions
        && a.lockPresentation === b.lockPresentation
        && a.reason === b.reason
        && a.startedAtMs === b.startedAtMs
    );
}

function toDebugClaimSnapshot(
    claim: ActorControlClaim,
    activeClaim: ActorControlClaim | null,
): ActorControlDebugClaimSnapshot {
    return {
        ownerId: claim.ownerId,
        actorId: claim.actorId,
        layer: claim.layer,
        priority: claim.priority,
        locks: {
            movement: claim.lockMovement,
            facing: claim.lockFacing,
            actions: claim.lockActions,
            presentation: claim.lockPresentation,
        },
        reason: claim.reason,
        startedAtMs: claim.startedAtMs,
        active: activeClaim !== null && isSameClaim(claim, activeClaim),
    };
}

function compareDebugClaimSnapshots(
    a: ActorControlDebugClaimSnapshot,
    b: ActorControlDebugClaimSnapshot,
): number {
    if (a.active !== b.active) {
        return a.active ? -1 : 1;
    }

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

function compareDebugActorSnapshots(
    a: ActorControlDebugActorSnapshot,
    b: ActorControlDebugActorSnapshot,
): number {
    if (a.actorId < b.actorId) {
        return -1;
    }

    if (a.actorId > b.actorId) {
        return 1;
    }

    return 0;
}

export function createActorControlDebugSnapshot(
    claimsByActor: ReadonlyMap<string, readonly ActorControlClaim[]>,
): ActorControlDebugSnapshot {
    const actors: ActorControlDebugActorSnapshot[] = [];

    for (const [actorId, claims] of claimsByActor.entries()) {
        const activeClaim = selectActiveActorControlClaim(claims);
        const claimSnapshots = claims
            .map((claim) => toDebugClaimSnapshot(claim, activeClaim))
            .sort(compareDebugClaimSnapshots);

        const activeClaimSnapshot = claimSnapshots.find((claim) => claim.active) ?? null;

        actors.push({
            actorId,
            activeClaim: activeClaimSnapshot,
            claims: claimSnapshots,
        });
    }

    actors.sort(compareDebugActorSnapshots);

    return {
        actors,
    };
}