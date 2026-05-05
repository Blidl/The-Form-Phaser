import type { TestWorldLogicScriptConfig } from './test_world_config';

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

export const createLogicScriptPreviewTrace = (
    script: TestWorldLogicScriptConfig
): LogicScriptCommandExecutionResult[] => {
    return executeLogicScriptNoopOnly(script).commands;
};
