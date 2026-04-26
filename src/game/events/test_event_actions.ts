import type { ActorAction } from '../actor_actions/actor_action_types';
import {
    evaluateTestEventConditionsDetailed,
    type TestEventCondition,
    type TestEventConditionContext
} from './test_event_conditions';
import type {
    DebugEventType,
    EventDebugRecordInput
} from '../debug/event_debug_types';

export type TestEventAction =
    | {
        kind: 'actor_action';
        actorId: string;
        action: ActorAction;
    }
    | {
        kind: 'start_cutscene';
        cutsceneRef: string;
    }
    | {
        kind: 'set_flag';
        flagId: string;
        value: boolean;
    }
    | {
        kind: 'trigger_event';
        eventId: string;
        payload?: Record<string, unknown>;
    }
    | {
        kind: 'play_sfx';
        sfxId: string;
    }
    | {
        kind: 'spawn_vfx';
        vfxId: string;
        actorId?: string;
        x?: number;
        y?: number;
    };

export interface TestEventBlock {
    id: string;
    conditions?: TestEventCondition[];
    actions: TestEventAction[];
}

export interface TestEventRuntimeContext extends TestEventConditionContext {
    setWorldFlag: (flagId: string, value: boolean) => void;
    executeActorAction: (actorId: string, action: ActorAction) => boolean;
    startCutscene: (cutsceneRef: string) => boolean;
    dispatchTriggerEvent?: (eventId: string, payload?: Record<string, unknown>) => boolean;
    playSfx?: (sfxId: string) => boolean;
    spawnVfx?: (
        vfxId: string,
        actorId?: string,
        x?: number,
        y?: number
    ) => boolean;
    consumeOnceKey?: (key: string) => void;
}

export type TestWorldDebugEventSink = (entry: EventDebugRecordInput) => void;

export type TestEventActionExecutionStatus = 'executed' | 'failed' | 'skipped';

export interface TestEventActionExecutionEntry {
    index: number;
    kind: string;
    status: TestEventActionExecutionStatus;
    detail: string | null;
}

export interface TestEventActionExecutionResult {
    started: boolean;
    executedCount: number;
    failedCount: number;
    skippedCount: number;
    entries: readonly TestEventActionExecutionEntry[];
}

export interface TestEventBlockExecutionResult {
    blockId: string;
    conditionsPassed: boolean;
    executed: boolean;
    onceKeysConsumed: readonly string[];
    actionResult: TestEventActionExecutionResult | null;
}

export interface TestEventActionDebugContext {
    eventId?: string;
    source?: string;
}

const normalizeNonEmptyString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

export const executeTestEventActions = (
    context: TestEventRuntimeContext,
    actions: readonly TestEventAction[] | null | undefined,
    debugSink?: TestWorldDebugEventSink,
    debugContext?: TestEventActionDebugContext
): TestEventActionExecutionResult => {
    if (!Array.isArray(actions) || actions.length <= 0) {
        return {
            started: false,
            executedCount: 0,
            failedCount: 0,
            skippedCount: 0,
            entries: []
        };
    }

    const entries: TestEventActionExecutionEntry[] = [];
    let executedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    const emitActionDebugEvent = (
        action: TestEventAction,
        entry: TestEventActionExecutionEntry
    ): void => {
        if (!debugSink) {
            return;
        }

        const typeByStatus: Record<TestEventActionExecutionStatus, DebugEventType> = {
            executed: 'action.executed',
            failed: 'action.failed',
            skipped: 'action.skipped'
        };
        const eventType = typeByStatus[entry.status];
        const actorId = action.kind === 'actor_action' ? normalizeNonEmptyString(action.actorId) ?? undefined : undefined;
        const cutsceneId = action.kind === 'start_cutscene' ? normalizeNonEmptyString(action.cutsceneRef) ?? undefined : undefined;
        const payload: Record<string, unknown> = {
            index: entry.index,
            actionType: entry.kind
        };
        if (action.kind === 'trigger_event') {
            const triggerEventId = normalizeNonEmptyString(action.eventId);
            if (triggerEventId) {
                payload.triggerEventId = triggerEventId;
            }
        }
        if (action.kind === 'spawn_vfx') {
            const vfxId = normalizeNonEmptyString(action.vfxId);
            if (vfxId) {
                payload.vfxId = vfxId;
            }
        }
        if (action.kind === 'play_sfx') {
            const sfxId = normalizeNonEmptyString(action.sfxId);
            if (sfxId) {
                payload.sfxId = sfxId;
            }
        }

        debugSink({
            type: eventType,
            source: debugContext?.source ?? 'test_event_actions',
            eventId: debugContext?.eventId,
            actorId,
            cutsceneId,
            message: entry.detail ?? undefined,
            payload
        });
    };

    actions.forEach((action, index) => {
        const fallbackEntry = (): void => {
            skippedCount += 1;
            const entry: TestEventActionExecutionEntry = {
                index,
                kind: typeof action?.kind === 'string' ? action.kind : 'unknown',
                status: 'skipped',
                detail: 'invalid action payload'
            };
            entries.push(entry);
            if (action && typeof action === 'object' && typeof action.kind === 'string') {
                emitActionDebugEvent(action as TestEventAction, entry);
            }
        };

        if (!action || typeof action !== 'object' || typeof action.kind !== 'string') {
            fallbackEntry();
            return;
        }

        if (action.kind === 'actor_action') {
            const actorId = normalizeNonEmptyString(action.actorId);
            if (!actorId || !action.action || typeof action.action !== 'object' || typeof action.action.kind !== 'string') {
                fallbackEntry();
                return;
            }
            const succeeded = context.executeActorAction(actorId, action.action);
            if (succeeded) {
                executedCount += 1;
                const entry: TestEventActionExecutionEntry = { index, kind: action.kind, status: 'executed', detail: actorId };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            } else {
                failedCount += 1;
                const entry: TestEventActionExecutionEntry = { index, kind: action.kind, status: 'failed', detail: actorId };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            }
            return;
        }

        if (action.kind === 'start_cutscene') {
            const cutsceneRef = normalizeNonEmptyString(action.cutsceneRef);
            if (!cutsceneRef) {
                fallbackEntry();
                return;
            }
            const accepted = context.startCutscene(cutsceneRef);
            if (accepted) {
                executedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'executed',
                    detail: cutsceneRef
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            } else {
                failedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'failed',
                    detail: cutsceneRef
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            }
            return;
        }

        if (action.kind === 'set_flag') {
            const flagId = normalizeNonEmptyString(action.flagId);
            if (!flagId || typeof action.value !== 'boolean') {
                fallbackEntry();
                return;
            }
            context.setWorldFlag(flagId, action.value);
            executedCount += 1;
            const entry: TestEventActionExecutionEntry = {
                index,
                kind: action.kind,
                status: 'executed',
                detail: `${flagId}=${String(action.value)}`
            };
            entries.push(entry);
            emitActionDebugEvent(action, entry);
            return;
        }

        if (action.kind === 'trigger_event') {
            const eventId = normalizeNonEmptyString(action.eventId);
            if (!eventId) {
                fallbackEntry();
                return;
            }
            if (!context.dispatchTriggerEvent) {
                skippedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'skipped',
                    detail: 'dispatchTriggerEvent is unavailable'
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
                return;
            }
            const dispatched = context.dispatchTriggerEvent(eventId, action.payload);
            if (dispatched) {
                executedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'executed',
                    detail: eventId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            } else {
                failedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'failed',
                    detail: eventId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            }
            return;
        }

        if (action.kind === 'play_sfx') {
            const sfxId = normalizeNonEmptyString(action.sfxId);
            if (!sfxId) {
                fallbackEntry();
                return;
            }
            if (!context.playSfx) {
                skippedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'skipped',
                    detail: 'playSfx is unavailable'
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
                return;
            }
            const played = context.playSfx(sfxId);
            if (played) {
                executedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'executed',
                    detail: sfxId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            } else {
                failedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'failed',
                    detail: sfxId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            }
            return;
        }

        if (action.kind === 'spawn_vfx') {
            const vfxId = normalizeNonEmptyString(action.vfxId);
            if (!vfxId) {
                fallbackEntry();
                return;
            }
            if (!context.spawnVfx) {
                skippedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'skipped',
                    detail: 'spawnVfx is unavailable'
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
                return;
            }
            const spawned = context.spawnVfx(vfxId, action.actorId, action.x, action.y);
            if (spawned) {
                executedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'executed',
                    detail: vfxId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            } else {
                failedCount += 1;
                const entry: TestEventActionExecutionEntry = {
                    index,
                    kind: action.kind,
                    status: 'failed',
                    detail: vfxId
                };
                entries.push(entry);
                emitActionDebugEvent(action, entry);
            }
            return;
        }

        skippedCount += 1;
        const entry: TestEventActionExecutionEntry = {
            index,
            kind: action.kind,
            status: 'skipped',
            detail: `unknown action kind "${action.kind}"`
        };
        entries.push(entry);
        emitActionDebugEvent(action, entry);
    });

    return {
        started: true,
        executedCount,
        failedCount,
        skippedCount,
        entries
    };
};

export const executeTestEventBlock = (
    context: TestEventRuntimeContext,
    block: TestEventBlock,
    ownerKey: string,
    debugSink?: TestWorldDebugEventSink,
    debugContext?: TestEventActionDebugContext
): TestEventBlockExecutionResult => {
    const blockId = normalizeNonEmptyString(block?.id) ?? 'event_block';
    const conditionResult = evaluateTestEventConditionsDetailed(context, block?.conditions, ownerKey);
    if (!conditionResult.passed) {
        return {
            blockId,
            conditionsPassed: false,
            executed: false,
            onceKeysConsumed: [],
            actionResult: null
        };
    }

    const safeActions = Array.isArray(block?.actions) ? block.actions : [];
    const started = safeActions.length > 0;
    const onceKeysConsumed: string[] = [];
    if (started && conditionResult.pendingOnceKeys.length > 0) {
        conditionResult.pendingOnceKeys.forEach((onceKey) => {
            context.consumeOnceKey?.(onceKey);
            onceKeysConsumed.push(onceKey);
        });
    }

    const actionResult = executeTestEventActions(context, safeActions, debugSink, debugContext);
    return {
        blockId,
        conditionsPassed: true,
        executed: started,
        onceKeysConsumed,
        actionResult
    };
};
