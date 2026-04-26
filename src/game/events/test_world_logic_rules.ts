import {
    evaluateTestEventConditionsDetailed,
    type TestEventCondition
} from './test_event_conditions';
import {
    executeTestEventActions,
    type TestEventActionDebugContext,
    type TestEventAction,
    type TestEventActionExecutionResult,
    type TestWorldDebugEventSink,
    type TestEventRuntimeContext
} from './test_event_actions';
import type {
    DebugActionResult,
    DebugConditionResult,
    EventDebugRecordInput
} from '../debug/event_debug_types';

export interface TestWorldLogicRule {
    id: string;
    enabled?: boolean;
    when: TestWorldLogicEventMatcher;
    conditions?: TestEventCondition[];
    actions: TestEventAction[];
}

export type TestWorldLogicEventMatcher =
    | {
        kind: 'object_state_changed';
        objectId: string;
        fromState?: string;
        toState?: string;
    }
    | {
        kind: 'trigger_event';
        eventId: string;
        sourceId?: string;
    }
    | {
        kind: 'npc_event';
        actorId?: string;
        eventId: string;
    }
    | {
        kind: 'cutscene_finished';
        cutsceneRef?: string;
    };

export type TestWorldLogicEvent =
    | {
        kind: 'object_state_changed';
        objectId: string;
        fromState?: string;
        toState: string;
    }
    | {
        kind: 'trigger_event';
        eventId: string;
        sourceId?: string;
        payload?: Record<string, unknown>;
    }
    | {
        kind: 'npc_event';
        actorId: string;
        eventId: string;
        payload?: Record<string, unknown>;
    }
    | {
        kind: 'cutscene_finished';
        cutsceneRef: string;
    };

export interface TestWorldLogicRuleExecutionEntry {
    ruleId: string;
    status: 'executed' | 'skipped';
    detail: string;
    actionResult: TestEventActionExecutionResult | null;
}

export interface TestWorldLogicRuleExecutionResult {
    eventKind: TestWorldLogicEvent['kind'];
    matchedCount: number;
    executedCount: number;
    entries: readonly TestWorldLogicRuleExecutionEntry[];
}

const normalizeText = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

export const matchTestWorldLogicRuleEvent = (
    matcher: TestWorldLogicEventMatcher,
    event: TestWorldLogicEvent
): boolean => {
    if (matcher.kind !== event.kind) {
        return false;
    }

    if (matcher.kind === 'object_state_changed' && event.kind === 'object_state_changed') {
        if (matcher.objectId !== event.objectId) {
            return false;
        }
        if (matcher.fromState !== undefined && matcher.fromState !== event.fromState) {
            return false;
        }
        if (matcher.toState !== undefined && matcher.toState !== event.toState) {
            return false;
        }
        return true;
    }

    if (matcher.kind === 'trigger_event' && event.kind === 'trigger_event') {
        if (matcher.eventId !== event.eventId) {
            return false;
        }
        if (matcher.sourceId !== undefined && matcher.sourceId !== event.sourceId) {
            return false;
        }
        return true;
    }

    if (matcher.kind === 'npc_event' && event.kind === 'npc_event') {
        if (matcher.eventId !== event.eventId) {
            return false;
        }
        if (matcher.actorId !== undefined && matcher.actorId !== event.actorId) {
            return false;
        }
        return true;
    }

    if (matcher.kind === 'cutscene_finished' && event.kind === 'cutscene_finished') {
        if (matcher.cutsceneRef !== undefined && matcher.cutsceneRef !== event.cutsceneRef) {
            return false;
        }
        return true;
    }

    return false;
};

export const executeMatchingWorldLogicRules = (
    context: TestEventRuntimeContext,
    rules: readonly TestWorldLogicRule[] | null | undefined,
    event: TestWorldLogicEvent,
    debugSink?: TestWorldDebugEventSink
): TestWorldLogicRuleExecutionResult => {
    if (!Array.isArray(rules) || rules.length <= 0) {
        return {
            eventKind: event.kind,
            matchedCount: 0,
            executedCount: 0,
            entries: []
        };
    }

    const entries: TestWorldLogicRuleExecutionEntry[] = [];
    let matchedCount = 0;
    let executedCount = 0;
    const eventId = resolveWorldLogicEventId(event);

    rules.forEach((rule, index) => {
        const normalizedRuleId = normalizeText(rule?.id) ?? `rule_${index + 1}`;
        if (!rule || typeof rule !== 'object' || !rule.when || !Array.isArray(rule.actions)) {
            entries.push({
                ruleId: normalizedRuleId,
                status: 'skipped',
                detail: 'invalid rule payload',
                actionResult: null
            });
            return;
        }
        if (rule.enabled === false) {
            entries.push({
                ruleId: normalizedRuleId,
                status: 'skipped',
                detail: 'rule disabled',
                actionResult: null
            });
            return;
        }
        if (!matchTestWorldLogicRuleEvent(rule.when, event)) {
            entries.push({
                ruleId: normalizedRuleId,
                status: 'skipped',
                detail: 'event mismatch',
                actionResult: null
            });
            return;
        }

        matchedCount += 1;
        const ownerKey = `worldRule:${normalizedRuleId}`;
        const conditionResult = evaluateTestEventConditionsDetailed(context, rule.conditions, ownerKey);
        if (!conditionResult.passed) {
            emitRuleDebugEvent(debugSink, {
                type: 'world.rule_matched',
                source: 'test_world_logic_rules',
                eventId,
                message: `rule ${normalizedRuleId} skipped: conditions failed`,
                matchedRules: [{ ruleId: normalizedRuleId, source: 'test_world_logic_rules' }],
                conditionResults: [
                    {
                        conditionType: 'world_rule_conditions',
                        passed: false,
                        detail: 'conditions failed'
                    }
                ]
            });
            emitRuleDebugEvent(debugSink, {
                type: 'condition.evaluated',
                source: 'test_world_logic_rules',
                eventId,
                message: 'conditions failed',
                matchedRules: [{ ruleId: normalizedRuleId, source: 'test_world_logic_rules' }],
                conditionResults: [
                    {
                        conditionType: 'world_rule_conditions',
                        passed: false,
                        detail: 'conditions failed'
                    }
                ]
            });
            entries.push({
                ruleId: normalizedRuleId,
                status: 'skipped',
                detail: 'conditions failed',
                actionResult: null
            });
            return;
        }

        if (conditionResult.pendingOnceKeys.length > 0 && rule.actions.length > 0) {
            conditionResult.pendingOnceKeys.forEach((onceKey) => {
                context.consumeOnceKey?.(onceKey);
            });
        }
        const actionDebugContext: TestEventActionDebugContext = {
            source: 'test_event_actions',
            eventId
        };
        const actionResult = executeTestEventActions(context, rule.actions, debugSink, actionDebugContext);
        executedCount += 1;
        emitRuleDebugEvent(debugSink, {
            type: 'world.rule_matched',
            source: 'test_world_logic_rules',
            eventId,
            message: `rule ${normalizedRuleId} executed`,
            matchedRules: [{ ruleId: normalizedRuleId, source: 'test_world_logic_rules' }],
            conditionResults: [
                {
                    conditionType: 'world_rule_conditions',
                    passed: true,
                    detail: 'conditions passed'
                }
            ],
            actionResults: mapActionResults(actionResult)
        });
        entries.push({
            ruleId: normalizedRuleId,
            status: 'executed',
            detail: `actions=${rule.actions.length}`,
            actionResult
        });
    });

    return {
        eventKind: event.kind,
        matchedCount,
        executedCount,
        entries
    };
};

const resolveWorldLogicEventId = (event: TestWorldLogicEvent): string => {
    if (event.kind === 'object_state_changed') {
        return `object_state_changed:${event.objectId}:${event.toState}`;
    }
    if (event.kind === 'trigger_event') {
        return `trigger_event:${event.eventId}`;
    }
    if (event.kind === 'npc_event') {
        return `npc_event:${event.actorId}:${event.eventId}`;
    }
    return `cutscene_finished:${event.cutsceneRef}`;
};

const mapActionResults = (actionResult: TestEventActionExecutionResult): DebugActionResult[] => {
    return actionResult.entries.map((entry) => ({
        actionType: entry.kind,
        status: entry.status,
        detail: entry.detail ?? undefined,
        actorId: entry.kind === 'actor_action' ? normalizeText(entry.detail) ?? undefined : undefined
    }));
};

const emitRuleDebugEvent = (
    debugSink: TestWorldDebugEventSink | undefined,
    entry: EventDebugRecordInput & {
        matchedRules?: { ruleId: string; source?: string }[];
        conditionResults?: DebugConditionResult[];
        actionResults?: DebugActionResult[];
    }
): void => {
    debugSink?.(entry);
};
