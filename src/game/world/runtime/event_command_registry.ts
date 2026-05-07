import type { TestWorldLogicScriptCommandConfig } from './test_world_config';
import {
    asNonEmptyTrimmedString,
    asObject,
    type LogicCommandDefinition,
    type LogicCommandParamValidationResult
} from './script_command_core';

const EVENT_RUNTIME_SUPPORTED_SLOTS = ['world/onStart', 'object/onInteract', 'npc/onInteract', 'cutscene/onFinish'] as const;
const EVENT_SUPPORTED_ASSIGNMENT_KINDS = ['event'] as const;

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

export const EVENT_LOGIC_COMMAND_DEFINITIONS: readonly LogicCommandDefinition[] = [
    {
        type: 'noop',
        label: 'No-op',
        description: 'Does nothing; useful as a placeholder command.',
        domain: 'event',
        supportedAssignmentKinds: EVENT_SUPPORTED_ASSIGNMENT_KINDS,
        eventRuntimeSupported: true,
        readOnlyDisplay: {
            summaryTemplate: 'noop'
        },
        paramSpec: [],
        runtimeSupported: true,
        previewSupported: true,
        previewBehaviorNote: 'Executes immediately and succeeds.',
        runtimeSupportedSlots: EVENT_RUNTIME_SUPPORTED_SLOTS,
        validateParams: validateNoopParams,
        formatDisplay: () => 'noop'
    },
    {
        type: 'set_world_flag',
        label: 'Set World Flag',
        description: 'Sets a world flag to true/false.',
        domain: 'event',
        supportedAssignmentKinds: EVENT_SUPPORTED_ASSIGNMENT_KINDS,
        eventRuntimeSupported: true,
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
        runtimeSupportedSlots: EVENT_RUNTIME_SUPPORTED_SLOTS,
        validateParams: validateSetWorldFlagParams,
        formatDisplay: getSetWorldFlagDisplay
    },
    {
        type: 'start_cutscene',
        label: 'Start Cutscene',
        description: 'Requests a cutscene start by id.',
        domain: 'event',
        supportedAssignmentKinds: EVENT_SUPPORTED_ASSIGNMENT_KINDS,
        eventRuntimeSupported: true,
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
        runtimeSupportedSlots: EVENT_RUNTIME_SUPPORTED_SLOTS,
        validateParams: validateStartCutsceneParams,
        formatDisplay: getStartCutsceneDisplay
    }
] as const;

export const getEventStartCutsceneCommandIdFromParams = (params: unknown): string | null => {
    const result = validateStartCutsceneParams(params);
    if (!result.valid) {
        return null;
    }
    const raw = asObject(params);
    return asNonEmptyTrimmedString(raw?.cutsceneId);
};

export const getEventSetWorldFlagCommandParams = (
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
