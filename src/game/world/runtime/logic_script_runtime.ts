import { getLogicScriptAsset } from './logic_script_registry';
import {
    getSetWorldFlagCommandParams,
    getStartCutsceneCommandIdFromParams
} from './logic_command_registry';
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

export interface LogicScriptWorldOnStartExecutionContext {
    setWorldFlag: (key: string, value: boolean) => void;
    startCutscene?: (cutsceneId: string) => boolean;
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

export type LogicBindingEventTargetType = TestWorldLogicBindingTargetType;

export interface LogicBindingEventDescriptor {
    targetType: LogicBindingEventTargetType;
    targetId?: string;
    slot: string;
}

export interface LogicBindingEventExecutionTrace {
    bindingId: string;
    targetType: LogicBindingEventTargetType;
    targetId?: string;
    slot: string;
    scriptId: string;
    status: LogicBindingRuntimeStatus;
    reason?: string;
    commands: LogicScriptCommandExecutionResult[];
}

export interface LogicBindingEventTrace {
    targetType: LogicBindingEventTargetType;
    targetId?: string;
    slot: string;
    status: LogicBindingRuntimeStatus;
    bindings: LogicBindingEventExecutionTrace[];
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
                const flagParams = getSetWorldFlagCommandParams(command.params);
                if (!flagParams) {
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
                const { key, value } = flagParams;

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

            if (command.type === 'start_cutscene') {
                const cutsceneId = getStartCutsceneCommandIdFromParams(command.params);
                if (!cutsceneId) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: 'invalid start_cutscene params (requires non-empty cutsceneId)'
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults,
                        worldFlags: sandboxWorldFlags,
                        stateChanges
                    };
                }
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'skipped',
                    message: `start_cutscene "${cutsceneId}" deferred in preview`
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

export const executeLogicScriptForWorldOnStart = (
    script: TestWorldLogicScriptConfig,
    context: LogicScriptWorldOnStartExecutionContext
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
                const flagParams = getSetWorldFlagCommandParams(command.params);
                if (!flagParams) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: 'invalid set_world_flag params'
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults
                    };
                }
                const { key, value } = flagParams;
                context.setWorldFlag(key, value);
                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'success',
                    message: `set_world_flag "${key}" = ${value}`
                });
                continue;
            }

            if (command.type === 'start_cutscene') {
                const cutsceneId = getStartCutsceneCommandIdFromParams(command.params);
                if (!cutsceneId) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: 'invalid start_cutscene params (requires non-empty cutsceneId)'
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults
                    };
                }

                if (!context.startCutscene) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'skipped',
                        message: `start_cutscene "${cutsceneId}" deferred: callback unavailable`
                    });
                    continue;
                }

                let accepted = false;
                try {
                    accepted = context.startCutscene(cutsceneId);
                } catch (error) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: `start_cutscene "${cutsceneId}" failed: ${asErrorMessage(error)}`
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults
                    };
                }

                if (!accepted) {
                    commandResults.push({
                        commandId: command.id,
                        type: command.type,
                        status: 'error',
                        message: `start_cutscene "${cutsceneId}" rejected`
                    });
                    return {
                        scriptId: script.id,
                        status: 'error',
                        commands: commandResults
                    };
                }

                commandResults.push({
                    commandId: command.id,
                    type: command.type,
                    status: 'success',
                    message: `start_cutscene "${cutsceneId}" requested`
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

const doesBindingMatchEvent = (
    binding: TestWorldLogicBindingConfig,
    event: LogicBindingEventDescriptor
): boolean => {
    if (binding.targetType !== event.targetType) {
        return false;
    }

    if (binding.slot.trim() !== event.slot.trim()) {
        return false;
    }

    if (event.targetType === 'world') {
        return true;
    }

    return binding.targetId === event.targetId;
};

export const executeLogicBindingsForEvent = (
    config: TestWorldConfig,
    event: LogicBindingEventDescriptor,
    context: LogicScriptWorldOnStartExecutionContext,
    executeScript: (
        script: TestWorldLogicScriptConfig,
        runtimeContext: LogicScriptWorldOnStartExecutionContext
    ) => LogicScriptExecutionResult = executeLogicScriptForWorldOnStart
): LogicBindingEventTrace => {
    const candidates = config.logic.bindings.filter((binding) => doesBindingMatchEvent(binding, event));
    if (candidates.length <= 0) {
        return {
            targetType: event.targetType,
            targetId: event.targetId,
            slot: event.slot,
            status: 'skipped',
            bindings: []
        };
    }

    const embeddedScripts = collectEmbeddedLogicScripts(config);
    const referencedScriptIds = collectReferencedScriptIds(config);
    const traces: LogicBindingEventExecutionTrace[] = [];

    for (const binding of candidates) {
        const scriptId = binding.scriptId.trim();

        if (binding.enabled === false) {
            traces.push({
                bindingId: binding.id,
                targetType: binding.targetType,
                targetId: binding.targetId,
                slot: binding.slot,
                scriptId,
                status: 'skipped',
                reason: 'disabled',
                commands: []
            });
            continue;
        }

        const script = resolveBindingScript(scriptId, embeddedScripts, referencedScriptIds);
        if (!script) {
            traces.push({
                bindingId: binding.id,
                targetType: binding.targetType,
                targetId: binding.targetId,
                slot: binding.slot,
                scriptId,
                status: 'error',
                reason: 'missing script',
                commands: []
            });
            continue;
        }

        const scriptResult = executeScript(script, context);
        traces.push({
            bindingId: binding.id,
            targetType: binding.targetType,
            targetId: binding.targetId,
            slot: binding.slot,
            scriptId,
            status: scriptResult.status,
            reason: scriptResult.status === 'error' ? 'script execution error' : undefined,
            commands: scriptResult.commands
        });
    }

    const hasError = traces.some((trace) => trace.status === 'error');
    if (hasError) {
        return {
            targetType: event.targetType,
            targetId: event.targetId,
            slot: event.slot,
            status: 'error',
            bindings: traces
        };
    }

    const allSkipped = traces.every((trace) => trace.status === 'skipped');
    if (allSkipped) {
        return {
            targetType: event.targetType,
            targetId: event.targetId,
            slot: event.slot,
            status: 'skipped',
            bindings: traces
        };
    }

    return {
        targetType: event.targetType,
        targetId: event.targetId,
        slot: event.slot,
        status: 'success',
        bindings: traces
    };
};

export const traceWorldOnStartLogicBindings = (
    config: TestWorldConfig,
    executeScript: (script: TestWorldLogicScriptConfig) => LogicScriptExecutionResult = executeLogicScriptNoopOnly
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

        const scriptResult = executeScript(script);
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
