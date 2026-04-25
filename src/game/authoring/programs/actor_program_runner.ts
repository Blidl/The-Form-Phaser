import type { ActionCatalog } from '../actions/action_catalog';
import type { ActionRunner, ActionRunnerContext, ActionRunnerStatus } from '../actions/action_runner';
import type { ActorProgramDebugNodeSnapshot, ActorProgramDebugSnapshot, ActorProgramNodeStatus } from './actor_program_debug';
import type {
    ActorProgram,
    ActorProgramActionNode,
    ActorProgramCondition,
    ActorProgramEmitEventNode,
    ActorProgramIfNode,
    ActorProgramLoopNode,
    ActorProgramNode,
    ActorProgramParallelNode,
    ActorProgramSequenceNode,
    ActorProgramWaitNode
} from './actor_program_types';

export type ActorProgramRunnerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ActorProgramRunnerContext {
    readonly actionCatalog: ActionCatalog;
    readonly actorId?: string;
    readonly source?: string;
    readonly variables?: Readonly<Record<string, unknown>>;
    readonly emitEvent?: (eventId: string, payload: Readonly<Record<string, unknown>> | undefined) => void;
    readonly evaluateConditions?: (
        conditions: readonly ActorProgramCondition[],
        context: ActorProgramRunnerContext
    ) => boolean;
}

export interface ActorProgramRunner {
    begin(): ActorProgramRunnerStatus;
    update(deltaMs: number): ActorProgramRunnerStatus;
    cancel(): void;
    getDebugSnapshot(): ActorProgramDebugSnapshot;
    getActiveNodeIds(): readonly string[];
}

interface NodeRuntime {
    begin(): ActorProgramNodeStatus;
    update(deltaMs: number): ActorProgramNodeStatus;
    cancel(): void;
    getStatus(): ActorProgramNodeStatus;
    getDebugSnapshot(): ActorProgramDebugNodeSnapshot;
    collectActiveNodeIds(target: string[]): void;
}

const LOOP_SAME_TICK_SAFETY_GUARD = 1000;

export const createActorProgramRunner = (program: ActorProgram, context: ActorProgramRunnerContext): ActorProgramRunner => {
    const rootRuntime = createNodeRuntime(program.root, 'root', context);

    let status: ActorProgramRunnerStatus = 'idle';
    let elapsedMs = 0;

    const updateStatusFromRoot = (nextRootStatus: ActorProgramNodeStatus): ActorProgramRunnerStatus => {
        status = nextRootStatus;
        return status;
    };

    return {
        begin(): ActorProgramRunnerStatus {
            if (status !== 'idle') {
                return status;
            }

            return updateStatusFromRoot(rootRuntime.begin());
        },
        update(deltaMs: number): ActorProgramRunnerStatus {
            const delta = clampDeltaMs(deltaMs);
            elapsedMs += delta;

            if (status === 'idle') {
                return status;
            }
            if (status !== 'running') {
                return status;
            }

            return updateStatusFromRoot(rootRuntime.update(delta));
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            rootRuntime.cancel();
            status = 'cancelled';
        },
        getDebugSnapshot(): ActorProgramDebugSnapshot {
            return {
                programId: program.id,
                status,
                elapsedMs,
                activeNodeIds: this.getActiveNodeIds(),
                root: rootRuntime.getDebugSnapshot()
            };
        },
        getActiveNodeIds(): readonly string[] {
            if (status !== 'running') {
                return [];
            }

            const activeNodeIds: string[] = [];
            rootRuntime.collectActiveNodeIds(activeNodeIds);
            return activeNodeIds;
        }
    };
};

const createNodeRuntime = (node: ActorProgramNode, pathId: string, context: ActorProgramRunnerContext): NodeRuntime => {
    switch (node.kind) {
        case 'sequence':
            return createSequenceNodeRuntime(node, pathId, context);
        case 'parallel':
            return createParallelNodeRuntime(node, pathId, context);
        case 'action':
            return createActionNodeRuntime(node, pathId, context);
        case 'wait':
            return createWaitNodeRuntime(node, pathId);
        case 'if':
            return createIfNodeRuntime(node, pathId, context);
        case 'loop':
            return createLoopNodeRuntime(node, pathId, context);
        case 'emit_event':
            return createEmitEventNodeRuntime(node, pathId, context);
        default: {
            const neverNode: never = node;
            return neverNode;
        }
    }
};

const createSequenceNodeRuntime = (
    node: ActorProgramSequenceNode,
    pathId: string,
    context: ActorProgramRunnerContext
): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);
    const childRuntimes = node.children.map((child, index) => createNodeRuntime(child, `${pathId}.children[${index}]`, context));

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;
    let activeIndex = 0;

    const beginNextChildren = (): ActorProgramNodeStatus => {
        while (activeIndex < childRuntimes.length) {
            const childStatus = childRuntimes[activeIndex].begin();
            if (childStatus === 'running') {
                return 'running';
            }
            if (childStatus === 'completed') {
                activeIndex += 1;
                continue;
            }
            if (childStatus === 'failed') {
                detail = `Sequence child failed at index ${activeIndex}.`;
                return 'failed';
            }

            detail = `Sequence child cancelled at index ${activeIndex}.`;
            return 'cancelled';
        }

        return 'completed';
    };

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            status = 'running';
            status = beginNextChildren();
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            const delta = clampDeltaMs(deltaMs);
            elapsedMs += delta;

            while (activeIndex < childRuntimes.length) {
                const childStatus = childRuntimes[activeIndex].update(delta);
                if (childStatus === 'running') {
                    return status;
                }
                if (childStatus === 'completed') {
                    activeIndex += 1;
                    if (activeIndex >= childRuntimes.length) {
                        status = 'completed';
                        return status;
                    }
                    const nextBeginStatus = childRuntimes[activeIndex].begin();
                    if (nextBeginStatus === 'running') {
                        return status;
                    }
                    if (nextBeginStatus === 'completed') {
                        continue;
                    }
                    if (nextBeginStatus === 'failed') {
                        status = 'failed';
                        detail = `Sequence child failed at index ${activeIndex}.`;
                        return status;
                    }
                    status = 'cancelled';
                    detail = `Sequence child cancelled at index ${activeIndex}.`;
                    return status;
                }
                if (childStatus === 'failed') {
                    status = 'failed';
                    detail = `Sequence child failed at index ${activeIndex}.`;
                    return status;
                }

                status = 'cancelled';
                detail = `Sequence child cancelled at index ${activeIndex}.`;
                return status;
            }

            status = 'completed';
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            childRuntimes.forEach((childRuntime) => {
                childRuntime.cancel();
            });

            status = 'cancelled';
            detail = 'Sequence cancelled.';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail,
                children: childRuntimes.map((childRuntime) => childRuntime.getDebugSnapshot())
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status !== 'running') {
                return;
            }

            target.push(nodeId);
            if (activeIndex < childRuntimes.length) {
                childRuntimes[activeIndex].collectActiveNodeIds(target);
            }
        }
    };
};

const createParallelNodeRuntime = (
    node: ActorProgramParallelNode,
    pathId: string,
    context: ActorProgramRunnerContext
): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);
    const childRuntimes = node.children.map((child, index) => createNodeRuntime(child, `${pathId}.children[${index}]`, context));

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;

    const resolveStatus = (): ActorProgramNodeStatus => {
        const childStatuses = childRuntimes.map((child) => child.getStatus());

        if (node.policy === 'wait_all') {
            if (childStatuses.includes('failed')) {
                childRuntimes.forEach((childRuntime) => {
                    if (childRuntime.getStatus() === 'running') {
                        childRuntime.cancel();
                    }
                });
                detail = 'Parallel wait_all failed because a child failed.';
                return 'failed';
            }
            if (childStatuses.includes('cancelled')) {
                detail = 'Parallel wait_all cancelled because a child was cancelled.';
                return 'cancelled';
            }
            if (childStatuses.every((childStatus) => childStatus === 'completed')) {
                return 'completed';
            }
            return 'running';
        }

        if (node.policy === 'wait_first') {
            if (childStatuses.includes('completed')) {
                childRuntimes.forEach((childRuntime) => {
                    if (childRuntime.getStatus() === 'running') {
                        childRuntime.cancel();
                    }
                });
                return 'completed';
            }

            const allTerminal = childStatuses.every(
                (childStatus) => childStatus === 'failed' || childStatus === 'cancelled' || childStatus === 'completed'
            );

            if (!allTerminal) {
                return 'running';
            }

            if (childStatuses.every((childStatus) => childStatus === 'failed')) {
                detail = 'Parallel wait_first failed because all children failed.';
                return 'failed';
            }

            detail = 'Parallel wait_first cancelled before any child completed.';
            return 'cancelled';
        }

        return 'completed';
    };

    const beginChildren = (): void => {
        childRuntimes.forEach((childRuntime) => {
            childRuntime.begin();
        });
    };

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            status = 'running';
            beginChildren();

            if (node.policy === 'fire_and_forget') {
                status = 'completed';
                return status;
            }

            status = resolveStatus();
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            const delta = clampDeltaMs(deltaMs);
            elapsedMs += delta;

            childRuntimes.forEach((childRuntime) => {
                if (childRuntime.getStatus() === 'running') {
                    childRuntime.update(delta);
                }
            });

            status = resolveStatus();
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            childRuntimes.forEach((childRuntime) => {
                childRuntime.cancel();
            });

            status = 'cancelled';
            detail = 'Parallel cancelled.';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail,
                children: childRuntimes.map((childRuntime) => childRuntime.getDebugSnapshot())
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status !== 'running') {
                return;
            }

            target.push(nodeId);
            childRuntimes.forEach((childRuntime) => {
                childRuntime.collectActiveNodeIds(target);
            });
        }
    };
};

const createActionNodeRuntime = (
    node: ActorProgramActionNode,
    pathId: string,
    context: ActorProgramRunnerContext
): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;
    let actionRunner: ActionRunner | undefined;

    const createActionRunner = (): ActionRunner | undefined => {
        const actionDefinition = context.actionCatalog.get(node.actionType);
        if (!actionDefinition) {
            detail = `Unknown action type "${node.actionType}".`;
            status = 'failed';
            return undefined;
        }

        const resolvedParams = resolveVariables(node.params ?? {}, context) as Readonly<Record<string, unknown>>;
        const actionRunnerContext: ActionRunnerContext = {
            source: context.source,
            actorId: context.actorId
        };

        try {
            return actionDefinition.createRunner(resolvedParams, actionRunnerContext);
        } catch (error) {
            detail = `Action runner creation failed: ${toErrorMessage(error)}`;
            status = 'failed';
            return undefined;
        }
    };

    const applyActionRunnerStatus = (nextStatus: ActionRunnerStatus): ActorProgramNodeStatus => {
        if (nextStatus === 'idle' || nextStatus === 'running') {
            return 'running';
        }
        if (nextStatus === 'completed') {
            return 'completed';
        }
        if (nextStatus === 'failed') {
            detail = `Action "${node.actionType}" failed.`;
            return 'failed';
        }
        detail = `Action "${node.actionType}" cancelled.`;
        return 'cancelled';
    };

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            actionRunner = createActionRunner();
            if (!actionRunner) {
                return status;
            }

            status = 'running';
            try {
                status = applyActionRunnerStatus(actionRunner.begin());
            } catch (error) {
                status = 'failed';
                detail = `Action begin failed: ${toErrorMessage(error)}`;
            }
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            const delta = clampDeltaMs(deltaMs);
            elapsedMs += delta;

            if (!actionRunner) {
                status = 'failed';
                detail = `Action "${node.actionType}" has no runner.`;
                return status;
            }

            try {
                status = applyActionRunnerStatus(actionRunner.update(delta));
            } catch (error) {
                status = 'failed';
                detail = `Action update failed: ${toErrorMessage(error)}`;
            }
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            if (actionRunner) {
                try {
                    actionRunner.cancel();
                } catch {
                    // Treat as cancelled even if runner throws.
                }
            }
            status = 'cancelled';
            detail = `Action "${node.actionType}" cancelled.`;
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            const runnerSnapshot = actionRunner?.getDebugSnapshot();
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail: detail ?? runnerSnapshot?.detail
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status === 'running') {
                target.push(nodeId);
            }
        }
    };
};

const createWaitNodeRuntime = (node: ActorProgramWaitNode, pathId: string): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);
    const durationMs = Math.max(0, Number.isFinite(node.durationMs) ? node.durationMs : 0);

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            status = durationMs <= 0 ? 'completed' : 'running';
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            elapsedMs += clampDeltaMs(deltaMs);
            if (elapsedMs >= durationMs) {
                status = 'completed';
            }
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }
            status = 'cancelled';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail: status === 'running' ? `Waiting for ${Math.max(durationMs - elapsedMs, 0)} ms.` : undefined
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status === 'running') {
                target.push(nodeId);
            }
        }
    };
};

const createIfNodeRuntime = (node: ActorProgramIfNode, pathId: string, context: ActorProgramRunnerContext): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;
    let branchRuntime: NodeRuntime | undefined;

    const chooseBranch = (): ActorProgramNode | undefined => {
        const passed = evaluateConditions(node.conditions, context);
        if (passed) {
            return node.then;
        }
        return node.else;
    };

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            status = 'running';
            const selectedBranch = chooseBranch();
            if (!selectedBranch) {
                status = 'completed';
                return status;
            }

            const branchPath = selectedBranch === node.then ? `${pathId}.then` : `${pathId}.else`;
            branchRuntime = createNodeRuntime(selectedBranch, branchPath, context);

            const branchStatus = branchRuntime.begin();
            if (branchStatus === 'running') {
                return status;
            }
            status = branchStatus;
            if (status === 'failed') {
                detail = 'If branch failed.';
            }
            if (status === 'cancelled') {
                detail = 'If branch cancelled.';
            }
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            elapsedMs += clampDeltaMs(deltaMs);
            if (!branchRuntime) {
                status = 'completed';
                return status;
            }

            status = branchRuntime.update(deltaMs);
            if (status === 'failed') {
                detail = 'If branch failed.';
            }
            if (status === 'cancelled') {
                detail = 'If branch cancelled.';
            }
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            branchRuntime?.cancel();
            status = 'cancelled';
            detail = 'If node cancelled.';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail,
                children: branchRuntime ? [branchRuntime.getDebugSnapshot()] : undefined
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status !== 'running') {
                return;
            }

            target.push(nodeId);
            branchRuntime?.collectActiveNodeIds(target);
        }
    };
};

const createLoopNodeRuntime = (
    node: ActorProgramLoopNode,
    pathId: string,
    context: ActorProgramRunnerContext
): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;
    let iterationCount = 0;
    let activeChildRuntime: NodeRuntime | undefined;

    const countLimit = normalizeCount(node.count);

    const canContinue = (): boolean => {
        if (node.policy === 'count') {
            return iterationCount < countLimit;
        }

        if (node.policy === 'while_conditions') {
            if (!node.conditions || node.conditions.length === 0) {
                return false;
            }
            return evaluateConditions(node.conditions, context);
        }

        if (node.maxIterations !== undefined && Number.isFinite(node.maxIterations) && node.maxIterations >= 0) {
            return iterationCount < node.maxIterations;
        }

        return true;
    };

    const createAndBeginChild = (): ActorProgramNodeStatus => {
        activeChildRuntime = createNodeRuntime(node.child, `${pathId}.child`, context);
        iterationCount += 1;
        return activeChildRuntime.begin();
    };

    const failSafetyGuard = (): ActorProgramNodeStatus => {
        status = 'failed';
        detail = `Loop safety guard exceeded ${LOOP_SAME_TICK_SAFETY_GUARD} immediate iterations.`;
        return status;
    };

    const advanceLoop = (deltaMs: number): ActorProgramNodeStatus => {
        let sameTickIterationTransitions = 0;
        let pendingDelta = clampDeltaMs(deltaMs);

        while (status === 'running') {
            if (!activeChildRuntime) {
                if (!canContinue()) {
                    status = 'completed';
                    return status;
                }

                const beginStatus = createAndBeginChild();
                if (beginStatus === 'running') {
                    return status;
                }
                if (beginStatus === 'failed') {
                    status = 'failed';
                    detail = `Loop child failed at iteration ${iterationCount}.`;
                    return status;
                }
                if (beginStatus === 'cancelled') {
                    status = 'cancelled';
                    detail = `Loop child cancelled at iteration ${iterationCount}.`;
                    return status;
                }

                activeChildRuntime = undefined;
                sameTickIterationTransitions += 1;
                pendingDelta = 0;
                if (sameTickIterationTransitions > LOOP_SAME_TICK_SAFETY_GUARD) {
                    return failSafetyGuard();
                }
                continue;
            }

            const childStatus = activeChildRuntime.update(pendingDelta);
            pendingDelta = 0;
            if (childStatus === 'running') {
                return status;
            }
            if (childStatus === 'failed') {
                status = 'failed';
                detail = `Loop child failed at iteration ${iterationCount}.`;
                return status;
            }
            if (childStatus === 'cancelled') {
                status = 'cancelled';
                detail = `Loop child cancelled at iteration ${iterationCount}.`;
                return status;
            }

            activeChildRuntime = undefined;
            sameTickIterationTransitions += 1;
            if (sameTickIterationTransitions > LOOP_SAME_TICK_SAFETY_GUARD) {
                return failSafetyGuard();
            }
        }

        return status;
    };

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            status = 'running';
            return advanceLoop(0);
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            if (status !== 'running') {
                return status;
            }

            elapsedMs += clampDeltaMs(deltaMs);
            return advanceLoop(deltaMs);
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }

            activeChildRuntime?.cancel();
            status = 'cancelled';
            detail = 'Loop cancelled.';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail,
                children: activeChildRuntime ? [activeChildRuntime.getDebugSnapshot()] : undefined
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status !== 'running') {
                return;
            }

            target.push(nodeId);
            activeChildRuntime?.collectActiveNodeIds(target);
        }
    };
};

const createEmitEventNodeRuntime = (
    node: ActorProgramEmitEventNode,
    pathId: string,
    context: ActorProgramRunnerContext
): NodeRuntime => {
    const nodeId = getNodeDebugId(node, pathId);

    let status: ActorProgramNodeStatus = 'idle';
    let elapsedMs = 0;
    let detail: string | undefined;

    return {
        begin(): ActorProgramNodeStatus {
            if (status !== 'idle') {
                return status;
            }

            try {
                const resolvedPayload = resolveVariables(node.payload, context) as Readonly<Record<string, unknown>> | undefined;
                context.emitEvent?.(node.eventId, resolvedPayload);
                status = 'completed';
            } catch (error) {
                status = 'failed';
                detail = `Emit event failed: ${toErrorMessage(error)}`;
            }
            return status;
        },
        update(deltaMs: number): ActorProgramNodeStatus {
            elapsedMs += clampDeltaMs(deltaMs);
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
                return;
            }
            status = 'cancelled';
            detail = 'Emit event cancelled.';
        },
        getStatus(): ActorProgramNodeStatus {
            return status;
        },
        getDebugSnapshot(): ActorProgramDebugNodeSnapshot {
            return {
                id: nodeId,
                kind: node.kind,
                status,
                elapsedMs,
                detail
            };
        },
        collectActiveNodeIds(target: string[]): void {
            if (status === 'running') {
                target.push(nodeId);
            }
        }
    };
};

const clampDeltaMs = (deltaMs: number): number => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }
    return deltaMs;
};

const getNodeDebugId = (node: ActorProgramNode, pathId: string): string => {
    return node.id ?? pathId;
};

const evaluateConditions = (
    conditions: readonly ActorProgramCondition[],
    context: ActorProgramRunnerContext
): boolean => {
    if (!context.evaluateConditions) {
        return false;
    }

    try {
        return context.evaluateConditions(conditions, context);
    } catch {
        return false;
    }
};

const resolveVariables = (value: unknown, context: ActorProgramRunnerContext): unknown => {
    if (typeof value === 'string') {
        return resolveStringVariable(value, context);
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolveVariables(item, context));
    }

    if (isPlainObject(value)) {
        const resolvedEntries = Object.entries(value).map(([entryKey, entryValue]) => {
            return [entryKey, resolveVariables(entryValue, context)] as const;
        });
        return Object.fromEntries(resolvedEntries);
    }

    return value;
};

const resolveStringVariable = (value: string, context: ActorProgramRunnerContext): unknown => {
    if (value === '$self') {
        return context.actorId ?? value;
    }
    if (value === '$source') {
        return context.source ?? value;
    }
    if (value.startsWith('$var.')) {
        const variableName = value.slice('$var.'.length);
        if (variableName.length === 0) {
            return value;
        }
        if (context.variables && Object.prototype.hasOwnProperty.call(context.variables, variableName)) {
            return context.variables[variableName];
        }
    }

    return value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const normalizeCount = (count: number | undefined): number => {
    if (!Number.isFinite(count)) {
        return 0;
    }

    const normalized = Math.floor(count ?? 0);
    return Math.max(0, normalized);
};

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.length > 0) {
        return error.message;
    }

    return String(error);
};
