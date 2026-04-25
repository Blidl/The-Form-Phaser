import type { ActorProgram, ActorProgramCondition } from '../../authoring/programs/actor_program_types';

export type NpcBehaviorAssetId = string;
export type NpcBehaviorPageId = string;
export type NpcBehaviorProgramId = string;
export type NpcEventReactionId = string;

export type NpcActorPhysicsMode = 'dynamic' | 'kinematic' | 'static' | 'ghost';

export type NpcBehaviorPageMode =
    | 'idle'
    | 'patrol_path'
    | 'guard_area'
    | 'chase_player'
    | 'attack_player'
    | 'scripted_program'
    | 'dead'
    | 'disabled';

export type NpcBehaviorInterruptPolicy = 'ignore_if_busy' | 'interrupt' | 'queue';

export type NpcBehaviorEventType =
    | 'player.near'
    | 'player.far'
    | 'player.visible'
    | 'player.interact'
    | 'world.flag_changed'
    | 'trigger.enter'
    | 'event.received'
    | 'cutscene.started'
    | 'cutscene.finished'
    | 'actor.died'
    | 'actor.touched_actor';

export interface NpcBehaviorPage {
    readonly id: NpcBehaviorPageId;
    readonly title?: string;
    readonly enabled: boolean;
    readonly priority: number;
    readonly conditions: readonly ActorProgramCondition[];
    readonly mode: NpcBehaviorPageMode;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly enterProgramRef?: NpcBehaviorProgramId;
    readonly tickProgramRef?: NpcBehaviorProgramId;
    readonly exitProgramRef?: NpcBehaviorProgramId;
    readonly interruptPolicy: NpcBehaviorInterruptPolicy;
}

export interface NpcEventReaction {
    readonly id: NpcEventReactionId;
    readonly eventType: NpcBehaviorEventType;
    readonly enabled: boolean;
    readonly priority: number;
    readonly conditions?: readonly ActorProgramCondition[];
    readonly programRef: NpcBehaviorProgramId;
    readonly interruptPolicy: NpcBehaviorInterruptPolicy;
    readonly params?: Readonly<Record<string, unknown>>;
}

export interface NpcBehaviorAsset {
    readonly id: NpcBehaviorAssetId;
    readonly displayName?: string;
    readonly physicsMode?: NpcActorPhysicsMode;
    readonly pages: readonly NpcBehaviorPage[];
    readonly eventReactions: readonly NpcEventReaction[];
    readonly programs: readonly ActorProgram[];
}

export interface NpcBehaviorEvaluationContext {
    readonly actorId?: string;
    readonly variables?: Readonly<Record<string, unknown>>;
    readonly evaluateConditions?: (conditions: readonly ActorProgramCondition[]) => boolean;
}

export interface NpcBehaviorResolvedPage {
    readonly assetId: string;
    readonly page: NpcBehaviorPage;
}

export interface NpcEventReactionInput {
    readonly eventType: NpcBehaviorEventType;
    readonly payload?: Readonly<Record<string, unknown>>;
}

export interface NpcBehaviorResolvedEventReaction {
    readonly assetId: string;
    readonly reaction: NpcEventReaction;
    readonly event: NpcEventReactionInput;
}
