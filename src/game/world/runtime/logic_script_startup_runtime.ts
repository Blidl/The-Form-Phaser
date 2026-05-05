import type { TestWorldConfig } from './test_world_config';
import {
    executeLogicScriptForWorldOnStart,
    traceWorldOnStartLogicBindings,
    type LogicWorldOnStartTrace
} from './logic_script_runtime';
import { ensureExternalLogicScriptsLoaded } from './logic_script_registry';

export interface WorldOnStartLogicRuntimeContext {
    setWorldFlag: (key: string, value: boolean) => void;
}

export const createWorldOnStartLogicStartupTrace = async (
    config: TestWorldConfig,
    context: WorldOnStartLogicRuntimeContext
): Promise<LogicWorldOnStartTrace> => {
    try {
        await ensureExternalLogicScriptsLoaded();
    } catch {
        // Ignore preload errors and produce the same trace shape from current registry state.
    }
    return traceWorldOnStartLogicBindings(
        config,
        (script) => executeLogicScriptForWorldOnStart(script, context)
    );
};

export const cloneWorldOnStartLogicTrace = (
    trace: LogicWorldOnStartTrace
): LogicWorldOnStartTrace => JSON.parse(JSON.stringify(trace)) as LogicWorldOnStartTrace;
