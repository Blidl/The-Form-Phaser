export type ActionRunnerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ActionRunnerDebugSnapshot {
    readonly type: string;
    readonly status: ActionRunnerStatus;
    readonly elapsedMs: number;
    readonly detail?: string;
}

export interface ActionRunnerContext {
    readonly source?: string;
    readonly actorId?: string;
    readonly services?: Readonly<Record<string, unknown>>;
}

export interface ActionRunner {
    begin(): ActionRunnerStatus;
    update(deltaMs: number): ActionRunnerStatus;
    cancel(): void;
    getDebugSnapshot(): ActionRunnerDebugSnapshot;
}

export const createImmediateActionRunner = (type: string, detail?: string): ActionRunner => {
    let status: ActionRunnerStatus = 'idle';
    let elapsedMs = 0;

    return {
        begin(): ActionRunnerStatus {
            status = 'completed';
            return status;
        },
        update(deltaMs: number): ActionRunnerStatus {
            if (Number.isFinite(deltaMs) && deltaMs > 0) {
                elapsedMs += deltaMs;
            }
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed') {
                return;
            }
            status = 'cancelled';
        },
        getDebugSnapshot(): ActionRunnerDebugSnapshot {
            return {
                type,
                status,
                elapsedMs,
                detail
            };
        }
    };
};
