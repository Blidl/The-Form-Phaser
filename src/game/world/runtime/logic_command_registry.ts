import type { TestWorldLogicScriptCommandConfig } from './test_world_config';

export type LogicCommandParamValidationResult = {
    valid: boolean;
    message?: string;
    fieldPath?: string;
};

export interface LogicCommandParamSpecEntry {
    key: string;
    description: string;
    required: boolean;
    expectedType: 'string' | 'boolean';
    nonEmpty?: boolean;
}

export interface LogicCommandDefinition {
    type: string;
    label: string;
    description: string;
    readOnlyDisplay: {
        summaryTemplate: string;
    };
    paramSpec: LogicCommandParamSpecEntry[];
    runtimeSupported: boolean;
    previewSupported: boolean;
    previewBehaviorNote: string;
    runtimeSupportedSlots: readonly string[];
    validateParams: (params: unknown) => LogicCommandParamValidationResult;
    formatDisplay: (command: TestWorldLogicScriptCommandConfig) => string;
}

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

const asNonEmptyTrimmedString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const validateNoopParams = (params: unknown): LogicCommandParamValidationResult => {
    if (params === undefined) {
        return { valid: true };
    }
    return asObject(params)
        ? { valid: true }
        : {
            valid: false,
            message: 'requires params to be an object when present',
            fieldPath: 'params'
        };
};

const validateSetWorldFlagParams = (params: unknown): LogicCommandParamValidationResult => {
    const raw = asObject(params);
    if (!raw) {
        return {
            valid: false,
            message: 'requires params object',
            fieldPath: 'params'
        };
    }

    const key = asNonEmptyTrimmedString(raw.key);
    if (!key) {
        return {
            valid: false,
            message: 'requires non-empty key',
            fieldPath: 'params.key'
        };
    }

    if (typeof raw.value !== 'boolean') {
        return {
            valid: false,
            message: 'requires boolean value',
            fieldPath: 'params.value'
        };
    }

    return { valid: true };
};

const validateStartCutsceneParams = (params: unknown): LogicCommandParamValidationResult => {
    const raw = asObject(params);
    if (!raw) {
        return {
            valid: false,
            message: 'requires params object',
            fieldPath: 'params'
        };
    }

    const cutsceneId = asNonEmptyTrimmedString(raw.cutsceneId);
    if (!cutsceneId) {
        return {
            valid: false,
            message: 'requires non-empty cutsceneId',
            fieldPath: 'params.cutsceneId'
        };
    }

    return { valid: true };
};

const getSetWorldFlagDisplay = (command: TestWorldLogicScriptCommandConfig): string => {
    const raw = asObject(command.params);
    const key = asNonEmptyTrimmedString(raw?.key) ?? '<invalid-key>';
    const value = typeof raw?.value === 'boolean' ? String(raw.value) : '<invalid-value>';
    return `set_world_flag ${key}=${value}`;
};

const getStartCutsceneDisplay = (command: TestWorldLogicScriptCommandConfig): string => {
    const raw = asObject(command.params);
    const cutsceneId = asNonEmptyTrimmedString(raw?.cutsceneId) ?? '<invalid-cutsceneId>';
    return `start_cutscene ${cutsceneId}`;
};

const LOGIC_COMMAND_DEFINITIONS: readonly LogicCommandDefinition[] = [
    {
        type: 'noop',
        label: 'No-op',
        description: 'Does nothing; useful as a placeholder command.',
        readOnlyDisplay: {
            summaryTemplate: 'noop'
        },
        paramSpec: [],
        runtimeSupported: true,
        previewSupported: true,
        previewBehaviorNote: 'Executes immediately and succeeds.',
        runtimeSupportedSlots: ['world/onStart', 'object/onInteract', 'cutscene/onFinish'],
        validateParams: validateNoopParams,
        formatDisplay: () => 'noop'
    },
    {
        type: 'set_world_flag',
        label: 'Set World Flag',
        description: 'Sets a world flag to true/false.',
        readOnlyDisplay: {
            summaryTemplate: 'set_world_flag <key>=<value>'
        },
        paramSpec: [
            {
                key: 'key',
                description: 'World flag key to set.',
                required: true,
                expectedType: 'string',
                nonEmpty: true
            },
            {
                key: 'value',
                description: 'Boolean value to write to the world flag.',
                required: true,
                expectedType: 'boolean'
            }
        ],
        runtimeSupported: true,
        previewSupported: true,
        previewBehaviorNote: 'Applies to preview-only sandbox world flags.',
        runtimeSupportedSlots: ['world/onStart', 'object/onInteract', 'cutscene/onFinish'],
        validateParams: validateSetWorldFlagParams,
        formatDisplay: getSetWorldFlagDisplay
    },
    {
        type: 'start_cutscene',
        label: 'Start Cutscene',
        description: 'Requests a cutscene start by id.',
        readOnlyDisplay: {
            summaryTemplate: 'start_cutscene <cutsceneId>'
        },
        paramSpec: [
            {
                key: 'cutsceneId',
                description: 'Cutscene id to start.',
                required: true,
                expectedType: 'string',
                nonEmpty: true
            }
        ],
        runtimeSupported: true,
        previewSupported: true,
        previewBehaviorNote: 'Deferred/skipped in preview; no cutscene is started.',
        runtimeSupportedSlots: ['world/onStart', 'object/onInteract', 'cutscene/onFinish'],
        validateParams: validateStartCutsceneParams,
        formatDisplay: getStartCutsceneDisplay
    }
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
    const result = validateStartCutsceneParams(params);
    if (!result.valid) {
        return null;
    }
    const raw = asObject(params);
    return asNonEmptyTrimmedString(raw?.cutsceneId);
};

export const getSetWorldFlagCommandParams = (
    params: unknown
): { key: string; value: boolean } | null => {
    const result = validateSetWorldFlagParams(params);
    if (!result.valid) {
        return null;
    }
    const raw = asObject(params);
    return raw
        ? {
            key: (raw.key as string).trim(),
            value: raw.value as boolean
        }
        : null;
};
