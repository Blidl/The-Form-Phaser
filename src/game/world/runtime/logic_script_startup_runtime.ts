import type { TestWorldConfig } from './test_world_config';
import {
    traceWorldOnStartLogicBindings,
    type LogicWorldOnStartTrace
} from './logic_script_runtime';
import { ensureExternalLogicScriptsLoaded } from './logic_script_registry';

export const createWorldOnStartLogicStartupTrace = async (
    config: TestWorldConfig
): Promise<LogicWorldOnStartTrace> => {
    try {
        await ensureExternalLogicScriptsLoaded();
    } catch {
        // Ignore preload errors and produce the same trace shape from current registry state.
    }
    return traceWorldOnStartLogicBindings(config);
};

export const cloneWorldOnStartLogicTrace = (
    trace: LogicWorldOnStartTrace
): LogicWorldOnStartTrace => JSON.parse(JSON.stringify(trace)) as LogicWorldOnStartTrace;
