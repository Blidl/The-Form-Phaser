import type {
    DebugActionResult,
    DebugConditionResult,
    DebugEventType,
    DebugMatchedRule,
    DebugValidationSummary,
    EventDebugEntry,
    EventDebugRecordInput
} from './event_debug_types';

export interface EventDebugRecorder {
    record(input: EventDebugRecordInput): EventDebugEntry;
    getEntries(): readonly EventDebugEntry[];
    clear(): void;
    getEntriesBySource(source: string): readonly EventDebugEntry[];
    getEntriesByType(type: DebugEventType): readonly EventDebugEntry[];
    getCapacity(): number;
}

interface EventDebugRecorderOptions {
    readonly capacity?: number;
    readonly nowMs?: () => number;
    readonly defaultSource?: string;
}

const DEFAULT_CAPACITY = 500;

const normalizeCapacity = (capacity?: number): number => {
    if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) {
        return DEFAULT_CAPACITY;
    }
    const normalized = Math.floor(capacity);
    return normalized > 0 ? normalized : DEFAULT_CAPACITY;
};

const cloneMatchedRules = (rules?: readonly DebugMatchedRule[]): readonly DebugMatchedRule[] | undefined =>
    rules?.map((rule) => ({ ...rule }));

const cloneConditionResults = (
    results?: readonly DebugConditionResult[]
): readonly DebugConditionResult[] | undefined => results?.map((result) => ({ ...result }));

const cloneActionResults = (results?: readonly DebugActionResult[]): readonly DebugActionResult[] | undefined =>
    results?.map((result) => ({ ...result }));

const cloneValidationSummary = (summary?: DebugValidationSummary): DebugValidationSummary | undefined =>
    summary ? { ...summary } : undefined;

const clonePayload = (payload?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined =>
    payload ? { ...payload } : undefined;

const cloneEntry = (entry: EventDebugEntry): EventDebugEntry => ({
    ...entry,
    matchedRules: cloneMatchedRules(entry.matchedRules),
    conditionResults: cloneConditionResults(entry.conditionResults),
    actionResults: cloneActionResults(entry.actionResults),
    validationSummary: cloneValidationSummary(entry.validationSummary),
    payload: clonePayload(entry.payload)
});

const resolveTimestampMs = (timestampMs: number | undefined, nowMs: () => number): number => {
    if (typeof timestampMs === 'number' && Number.isFinite(timestampMs)) {
        return timestampMs;
    }

    const nowValue = nowMs();
    if (typeof nowValue === 'number' && Number.isFinite(nowValue)) {
        return nowValue;
    }

    return Date.now();
};

const resolveSource = (source: string | undefined, defaultSource: string | undefined): string => {
    if (typeof source === 'string' && source.length > 0) {
        return source;
    }
    if (typeof defaultSource === 'string' && defaultSource.length > 0) {
        return defaultSource;
    }
    return 'unknown';
};

export const createEventDebugRecorder = (options?: EventDebugRecorderOptions): EventDebugRecorder => {
    const capacity = normalizeCapacity(options?.capacity);
    const nowMs = options?.nowMs ?? Date.now;
    const defaultSource = options?.defaultSource;

    const entries: EventDebugEntry[] = [];
    let nextId = 1;

    return {
        record(input: EventDebugRecordInput): EventDebugEntry {
            const entry: EventDebugEntry = {
                ...input,
                id: nextId++,
                timestampMs: resolveTimestampMs(input.timestampMs, nowMs),
                source: resolveSource(input.source, defaultSource),
                matchedRules: cloneMatchedRules(input.matchedRules),
                conditionResults: cloneConditionResults(input.conditionResults),
                actionResults: cloneActionResults(input.actionResults),
                validationSummary: cloneValidationSummary(input.validationSummary),
                payload: clonePayload(input.payload)
            };

            entries.push(entry);
            if (entries.length > capacity) {
                entries.shift();
            }

            return cloneEntry(entry);
        },
        getEntries(): readonly EventDebugEntry[] {
            return entries.map(cloneEntry);
        },
        clear(): void {
            entries.length = 0;
        },
        getEntriesBySource(source: string): readonly EventDebugEntry[] {
            return entries.filter((entry) => entry.source === source).map(cloneEntry);
        },
        getEntriesByType(type: DebugEventType): readonly EventDebugEntry[] {
            return entries.filter((entry) => entry.type === type).map(cloneEntry);
        },
        getCapacity(): number {
            return capacity;
        }
    };
};
