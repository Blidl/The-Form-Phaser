import { getLogicScriptAsset } from './logic_script_registry';
import type {
    TestWorldConfig,
    TestWorldLogicBindingConfig,
    TestWorldLogicBindingTargetType,
    TestWorldLogicScriptConfig
} from './test_world_config';

export type LogicScriptRuntimeStatus =
    | 'success'
    | 'skipped'
    | 'error';

export interface LogicScriptCommandExecutionResult {
    commandId: string;
    type: string;
    status: LogicScriptRuntimeStatus;
    message: string;
}

export interface LogicScriptExecutionResult {
    scriptId: string;
    status: LogicScriptRuntimeStatus;
    commands: LogicScriptCommandExecutionResult[];
    worldFlags?: Record<string, boolean>;
    stateChanges?: LogicScriptStateChange[];
}

export interface LogicScriptStateChange {
    commandId: string;
    key: string;
    from: boolean | undefined;
    to: boolean;
}

export type LogicBindingRuntimeStatus =
    | 'success'
    | 'skipped'
    | 'error';

export interface LogicBindingExecutionTrace {
    bindingId: string;
    scriptId: string;
    targetType: TestWorldLogicBindingTargetType;
    slot: string;
    status: LogicBindingRuntimeStatus;
    reason?: string;
    scriptResult?: LogicScriptExecutionResult;
}

export interface LogicWorldOnStartTrace {
    status: LogicBindingRuntimeStatus;
    bindings: LogicBindingExecutionTrace[];
}

const asErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }
    return 'Unknown runtime error';
};

const toCommandErrorResult = (
    commandId: string,
    type: string,
    error: unknown
): LogicScriptCommandExecutionResult => {
    return {
        commandId,
        type,
        status: 'error',
        message: `Unexpected command execution error: ${asErrorMessage(error)}`
    };
};

export const executeLogicScriptNoopOnly = (
    script: TestWorldLogicScriptConfig
): LogicScriptExecutionResult => {
    const commandResults: LogicScriptCommandExecutionResult[] = [];
    const commands = script.commands;

    if (commands.length <= 0) {
        return {
            scriptId: script.id,
            status: 'skipped',
            commands: commandResults
        };
    }

    for (const command of commands) {
        try {
            if (command.type === 'noop') {
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'success',
                    message: 'noop'
                });
                continue;
            }

            if (command.type === 'set_world_flag') {
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'skipped',
                    message: 'set_world_flag execution deferred'
                });
                continue;
            }

            commandResults.push({
                commandId: command.id,
                type: command.type,
                status: 'error',
                message: `Unknown command type: ${command.type}`
            });

            return {
                scriptId: script.id,
                status: 'error',
                commands: commandResults
            };
        } catch (error) {
            commandResults.push(toCommandErrorResult(command.id, command.type, error));
            return {
                scriptId: script.id,
                status: 'error',
                commands: commandResults
            };
        }
    }

    return {
        scriptId: script.id,
        status: 'success',
        commands: commandResults
    };
};

interface ExecuteLogicScriptPreviewSandboxOptions {
    initialWorldFlags?: Record<string, boolean>;
}

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

const isBoolean = (value: unknown): value is boolean => {
    return typeof value === 'boolean';
};

export const executeLogicScriptPreviewSandbox = (
    script: TestWorldLogicScriptConfig,
    options?: ExecuteLogicScriptPreviewSandboxOptions
): LogicScriptExecutionResult => {
    const commandResults: LogicScriptCommandExecutionResult[] = [];
    const stateChanges: LogicScriptStateChange[] = [];
    const sandboxWorldFlags: Record<string, boolean> = {
        ...(options?.initialWorldFlags ?? {})
    };
    const commands = script.commands;

    if (commands.length <= 0) {
        return {
            scriptId: script.id,
            status: 'skipped',
            commands: commandResults,
            worldFlags: sandboxWorldFlags,
            stateChanges
        };
    }

    for (const command of commands) {
        try {
            if (command.type === 'noop') {
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'success',
                    message: 'noop'
                });
                continue;
            }

            if (command.type === 'set_world_flag') {
                const key = command.params?.key;
                const value = command.params?.value;
                if (!isNonEmptyString(key) || !isBoolean(value)) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: 'invalid set_world_flag params'
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults,
                        worldFlags: sandboxWorldFlags,
                        stateChanges
                    };
                }

                const from = sandboxWorldFlags[key];
                sandboxWorldFlags[key] = value;
                stateChanges.push({
                    commandId: command.id,
                    key,
                    from,
                    to: value
                });
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'success',
                    message: `set_world_flag "${key}" = ${value} (preview only)`
                });
                continue;
            }

            commandResults.push({
                commandId: command.id,
                type: command.type,
                status: 'error',
                message: `Unknown command type: ${command.type}`
            });

            return {
                scriptId: script.id,
                status: 'error',
                commands: commandResults,
                worldFlags: sandboxWorldFlags,
                stateChanges
            };
        } catch (error) {
            commandResults.push(toCommandErrorResult(command.id, command.type, error));
            return {
                scriptId: script.id,
                status: 'error',
                commands: commandResults,
                worldFlags: sandboxWorldFlags,
                stateChanges
            };
        }
    }

    return {
        scriptId: script.id,
        status: 'success',
        commands: commandResults,
        worldFlags: sandboxWorldFlags,
        stateChanges
    };
};

export const createLogicScriptPreviewTrace = (
    script: TestWorldLogicScriptConfig
): LogicScriptCommandExecutionResult[] => {
    return executeLogicScriptNoopOnly(script).commands;
};

const LOGIC_WORLD_ON_START_SLOT = 'onStart';

const isWorldOnStartBinding = (binding: TestWorldLogicBindingConfig): boolean => {
    return binding.targetType === 'world' && binding.slot.trim() === LOGIC_WORLD_ON_START_SLOT;
};

const collectEmbeddedLogicScripts = (config: TestWorldConfig): Map<string, TestWorldLogicScriptConfig> => {
    const scriptsById = new Map<string, TestWorldLogicScriptConfig>();
    for (const script of config.logic.scripts) {
        const scriptId = script.id.trim();
        if (scriptId.length <= 0 || scriptsById.has(scriptId)) {
            continue;
        }
        scriptsById.set(scriptId, script);
    }
    return scriptsById;
};

const collectReferencedScriptIds = (config: TestWorldConfig): Set<string> => {
    const scriptRefIds = new Set<string>();
    for (const scriptRef of config.logic.scriptRefs) {
        const scriptId = scriptRef.id.trim();
        if (scriptId.length <= 0) {
            continue;
        }
        scriptRefIds.add(scriptId);
    }
    return scriptRefIds;
};

const resolveBindingScript = (
    scriptId: string,
    embeddedScripts: Map<string, TestWorldLogicScriptConfig>,
    referencedScriptIds: Set<string>
): TestWorldLogicScriptConfig | null => {
    const embeddedScript = embeddedScripts.get(scriptId);
    if (embeddedScript) {
        return embeddedScript;
    }

    if (!referencedScriptIds.has(scriptId)) {
        return null;
    }

    return getLogicScriptAsset(scriptId);
};

export const traceWorldOnStartLogicBindings = (
    config: TestWorldConfig
): LogicWorldOnStartTrace => {
    const candidates = config.logic.bindings.filter((binding) => isWorldOnStartBinding(binding));
    if (candidates.length <= 0) {
        return {
            status: 'skipped',
            bindings: []
        };
    }

    const embeddedScripts = collectEmbeddedLogicScripts(config);
    const referencedScriptIds = collectReferencedScriptIds(config);
    const traces: LogicBindingExecutionTrace[] = [];

    for (const binding of candidates) {
        const scriptId = binding.scriptId.trim();

        if (binding.enabled === false) {
            traces.push({
                bindingId: binding.id,
                scriptId,
                targetType: binding.targetType,
                slot: binding.slot,
                status: 'skipped',
                reason: 'disabled'
            });
            continue;
        }

        const script = resolveBindingScript(scriptId, embeddedScripts, referencedScriptIds);
        if (!script) {
            traces.push({
                bindingId: binding.id,
                scriptId,
                targetType: binding.targetType,
                slot: binding.slot,
                status: 'error',
                reason: 'missing script'
            });
            continue;
        }

        const scriptResult = executeLogicScriptNoopOnly(script);
        traces.push({
            bindingId: binding.id,
            scriptId,
            targetType: binding.targetType,
            slot: binding.slot,
            status: scriptResult.status === 'error' ? 'error' : 'success',
            reason: scriptResult.status === 'error' ? 'script execution error' : undefined,
            scriptResult
        });
    }

    const hasErrors = traces.some((trace) => trace.status === 'error');
    if (hasErrors) {
        return {
            status: 'error',
            bindings: traces
        };
    }

    const hasEnabledBinding = candidates.some((binding) => binding.enabled !== false);
    if (!hasEnabledBinding) {
        return {
            status: 'skipped',
            bindings: traces
        };
    }

    return {
        status: 'success',
        bindings: traces
    };
};
