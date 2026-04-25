import type { ActorControlDebugSnapshot } from './actor_control_debug';

export type ControlLayer =
    | 'ambient_behavior'
    | 'event_reaction'
    | 'interaction'
    | 'cutscene'
    | 'debug_manual';

export const DEFAULT_CONTROL_LAYER_PRIORITIES = {
    debug_manual: 10000,
    cutscene: 9000,
    interaction: 5000,
    event_reaction: 3000,
    ambient_behavior: 1000,
} satisfies Readonly<Record<ControlLayer, number>>;

export interface ActorControlClaim {
    readonly ownerId: string;
    readonly actorId: string;
    readonly layer: ControlLayer;
    readonly priority: number;
    readonly lockMovement: boolean;
    readonly lockFacing: boolean;
    readonly lockActions: boolean;
    readonly lockPresentation: boolean;
    readonly reason?: string;
    readonly startedAtMs: number;
}

export interface ActorControlClaimRequest {
    readonly ownerId: string;
    readonly actorId: string;
    readonly layer: ControlLayer;
    readonly priority?: number;
    readonly lockMovement?: boolean;
    readonly lockFacing?: boolean;
    readonly lockActions?: boolean;
    readonly lockPresentation?: boolean;
    readonly reason?: string;
    readonly startedAtMs?: number;
}

export interface ActorControlReleaseRequest {
    readonly ownerId: string;
    readonly actorId: string;
}

export interface ActorControlClaimResult {
    readonly claim: ActorControlClaim;
    readonly activeClaim: ActorControlClaim;
    readonly becameActive: boolean;
}

export interface ActorControlReleaseResult {
    readonly released: boolean;
    readonly releasedClaim?: ActorControlClaim;
    readonly activeClaimAfterRelease: ActorControlClaim | null;
}

export interface ActorControlRegistry {
    claimControl(request: ActorControlClaimRequest): ActorControlClaimResult;
    releaseControl(request: ActorControlReleaseRequest): ActorControlReleaseResult;
    getActiveClaim(actorId: string): ActorControlClaim | null;
    canControl(actorId: string, requestedLayer: ControlLayer, requestedPriority?: number): boolean;
    getDebugSnapshot(actorId?: string): ActorControlDebugSnapshot;
}