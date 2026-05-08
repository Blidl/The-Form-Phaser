import type { TestWorldLogicScriptCommandConfig } from './test_world_config';
import { EVENT_LOGIC_COMMAND_DEFINITIONS, getEventSetWorldFlagCommandParams, getEventStartCutsceneCommandIdFromParams } from './event_command_registry';
import { NPC_LOGIC_COMMAND_DEFINITIONS } from './npc_command_registry';
import { PLATFORM_LOGIC_COMMAND_DEFINITIONS } from './platform_command_registry';
import { asObject } from './script_command_core';
import type {
    LogicCommandDefinition
} from './script_command_core';

export type {
    LogicCommandAssignmentKind,
    LogicCommandDefinition,
    LogicCommandDomain,
    LogicCommandParamSpecEntry,
    LogicCommandParamValidationResult
} from './script_command_core';

const LOGIC_COMMAND_DEFINITIONS: readonly LogicCommandDefinition[] = [
    ...EVENT_LOGIC_COMMAND_DEFINITIONS,
    ...NPC_LOGIC_COMMAND_DEFINITIONS,
    ...PLATFORM_LOGIC_COMMAND_DEFINITIONS
] as const;

const LOGIC_COMMAND_DEFINITIONS_BY_TYPE = new Map<string, LogicCommandDefinition>(
    LOGIC_COMMAND_DEFINITIONS.map((definition) => [definition.type, definition] as const)
);

export const listLogicCommandDefinitions = (): LogicCommandDefinition[] => {
    return [...LOGIC_COMMAND_DEFINITIONS];
};

export const getLogicCommandDefinition = (type: string): LogicCommandDefinition | null => {
    const normalizedType = type.trim();
    if (normalizedType.length <= 0) {
        return null;
    }
    return LOGIC_COMMAND_DEFINITIONS_BY_TYPE.get(normalizedType) ?? null;
};

export const isKnownLogicCommandType = (type: string): boolean => {
    return getLogicCommandDefinition(type) !== null;
};

export const formatLogicCommandForDisplay = (command: TestWorldLogicScriptCommandConfig): string => {
    const definition = getLogicCommandDefinition(command.type);
    if (!definition) {
        const params = asObject(command.params) ?? {};
        return `${command.type} ${JSON.stringify(params)}`;
    }
    return definition.formatDisplay(command);
};

export const validateKnownLogicCommandParams = (
    command: Pick<TestWorldLogicScriptCommandConfig, 'type' | 'params'>
): LogicCommandParamValidationResult | null => {
    const definition = getLogicCommandDefinition(command.type);
    if (!definition) {
        return null;
    }
    return definition.validateParams(command.params);
};

export const getStartCutsceneCommandIdFromParams = (params: unknown): string | null => {
    return getEventStartCutsceneCommandIdFromParams(params);
};

export const getSetWorldFlagCommandParams = (
    params: unknown
): { key: string; value: boolean } | null => {
    return getEventSetWorldFlagCommandParams(params);
};
