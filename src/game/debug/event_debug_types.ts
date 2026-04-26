export type DebugEventSeverity = 'debug' | 'info' | 'warning' | 'error';

export type DebugEventType =
    | 'world.event'
    | 'world.rule_matched'
    | 'condition.evaluated'
    | 'action.started'
    | 'action.executed'
    | 'action.failed'
    | 'action.skipped'
    | 'actor_program.started'
    | 'actor_program.finished'
    | 'actor_program.failed'
    | 'cutscene.started'
    | 'cutscene.finished'
    | 'cutscene.failed'
    | 'platform.motion_state_changed'
    | 'validation.summary';

export interface DebugConditionResult {
    readonly conditionType: string;
    readonly passed: boolean;
    readonly detail?: string;
}

export interface DebugActionResult {
    readonly actionType: string;
    readonly status: 'started' | 'executed' | 'failed' | 'skipped';
    readonly actorId?: string;
    readonly detail?: string;
}

export interface DebugMatchedRule {
    readonly ruleId: string;
    readonly source?: string;
}

export interface DebugValidationSummary {
    readonly errorCount: number;
    readonly warningCount: number;
    readonly infoCount: number;
    readonly source?: string;
}

export interface EventDebugEntry {
    readonly id: number;
    readonly timestampMs: number;
    readonly source: string;
    readonly type: DebugEventType;
    readonly eventId?: string;
    readonly severity?: DebugEventSeverity;
    readonly message?: string;
    readonly actorId?: string;
    readonly cutsceneId?: string;
    readonly programId?: string;
    readonly platformId?: string;
    readonly matchedRules?: readonly DebugMatchedRule[];
    readonly conditionResults?: readonly DebugConditionResult[];
    readonly actionResults?: readonly DebugActionResult[];
    readonly validationSummary?: DebugValidationSummary;
    readonly payload?: Readonly<Record<string, unknown>>;
}

export interface EventDebugRecordInput extends Omit<EventDebugEntry, 'id' | 'timestampMs' | 'source'> {
    readonly type: DebugEventType;
    readonly timestampMs?: number;
    readonly source?: string;
}
