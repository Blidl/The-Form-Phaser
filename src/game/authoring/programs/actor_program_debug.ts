import type { ActorProgramNode } from './actor_program_types';

export type ActorProgramNodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ActorProgramDebugNodeSnapshot {
    readonly id?: string;
    readonly kind: ActorProgramNode['kind'];
    readonly status: ActorProgramNodeStatus;
    readonly elapsedMs: number;
    readonly detail?: string;
    readonly children?: readonly ActorProgramDebugNodeSnapshot[];
}

export interface ActorProgramDebugSnapshot {
    readonly programId: string;
    readonly status: ActorProgramNodeStatus;
    readonly elapsedMs: number;
    readonly activeNodeIds: readonly string[];
    readonly root: ActorProgramDebugNodeSnapshot;
}