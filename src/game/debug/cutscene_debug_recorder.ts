import type { EventDebugEntry } from './event_debug_types';
import type { EventDebugRecorder } from './event_debug_recorder';

export interface RecordCutsceneStartedArgs {
    readonly source?: string;
    readonly cutsceneId: string;
    readonly timestampMs?: number;
}

export interface RecordCutsceneFinishedArgs {
    readonly source?: string;
    readonly cutsceneId: string;
    readonly timestampMs?: number;
}

export interface RecordCutsceneFailedArgs {
    readonly source?: string;
    readonly cutsceneId: string;
    readonly message?: string;
    readonly timestampMs?: number;
}

export const recordCutsceneStarted = (
    recorder: EventDebugRecorder,
    args: RecordCutsceneStartedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'cutscene.started',
        cutsceneId: args.cutsceneId
    });

export const recordCutsceneFinished = (
    recorder: EventDebugRecorder,
    args: RecordCutsceneFinishedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'cutscene.finished',
        cutsceneId: args.cutsceneId
    });

export const recordCutsceneFailed = (
    recorder: EventDebugRecorder,
    args: RecordCutsceneFailedArgs
): EventDebugEntry =>
    recorder.record({
        source: args.source,
        timestampMs: args.timestampMs,
        type: 'cutscene.failed',
        severity: 'error',
        cutsceneId: args.cutsceneId,
        message: args.message
    });
