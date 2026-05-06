import type { TestWorldConfig } from './test_world_config';
import {
    executeLogicScriptForWorldOnStart,
    traceWorldOnStartLogicBindings,
    type LogicWorldOnStartTrace
} from './logic_script_runtime';
import {
    ensureExternalLogicScriptsLoaded,
    reloadExternalLogicScripts
} from './logic_script_registry';

export interface WorldOnStartLogicRuntimeContext {
    setWorldFlag: (key: string, value: boolean) => void;
    startCutscene?: (cutsceneId: string) => boolean;
}

export const createWorldOnStartLogicStartupTrace = async (
    config: TestWorldConfig,
    context: WorldOnStartLogicRuntimeContext
): Promise<LogicWorldOnStartTrace> => {
    let preloadResult = await ensureExternalLogicScriptsLoaded();
    if (!preloadResult.success) {
        // Retry once to avoid finalizing trace from a transient empty fallback state.
        preloadResult = await reloadExternalLogicScripts();
    }
    return traceWorldOnStartLogicBindings(
        config,
        (script) => executeLogicScriptForWorldOnStart(script, context)
    );
};

export const cloneWorldOnStartLogicTrace = (
    trace: LogicWorldOnStartTrace
): LogicWorldOnStartTrace => JSON.parse(JSON.stringify(trace)) as LogicWorldOnStartTrace;
