import type { EventDebugEntry } from './event_debug_types';
import type { EventDebugRecorder } from './event_debug_recorder';

export interface RecordActorProgramStartedArgs {
    readonly source?: string;
    readonly actorId?: string;
    readonly programId: string;
    readonly timestampMs?: number;
}

export interface RecordActorProgramFinishedArgs {
    readonly source?: string;
    readonly actorId?: string;
    readonly programId: string;
    readonly status?: 'completed' | 'cancelled';
    readonly timestampMs?: number;
}

export interface RecordActorProgramFailedArgs {
    readonly source?: string;
    readonly actorId?: string;
    readonly programId: string;
    readonly message?: string;
    readonly timestampMs?: number;
}

export const recordActorProgramStarted = (
    recorder: EventDebugRecorder,
    args: RecordActorProgramStartedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'actor_program.started',
        actorId: args.actorId,
        programId: args.programId
    });

export const recordActorProgramFinished = (
    recorder: EventDebugRecorder,
    args: RecordActorProgramFinishedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'actor_program.finished',
        actorId: args.actorId,
        programId: args.programId,
        message: args.status ? `status=${args.status}` : undefined,
        payload: args.status ? { status: args.status } : undefined
    });

export const recordActorProgramFailed = (
    recorder: EventDebugRecorder,
    args: RecordActorProgramFailedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'actor_program.failed',
        severity: 'error',
        actorId: args.actorId,
        programId: args.programId,
        message: args.message
    });
