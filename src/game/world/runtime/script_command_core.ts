import type {
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig
} from './test_world_config';

export type LogicCommandDomain =
    | 'event'
    | 'platform'
    | 'npc'
    | 'player'
    | 'cutscene';

export type LogicCommandAssignmentKind = LogicCommandDomain;

export type LogicCommandParamValidationResult = {
    valid: boolean;
    message?: string;
    fieldPath?: string;
};

export interface LogicCommandParamSpecEntry {
    key: string;
    description: string;
    required: boolean;
    expectedType: 'string' | 'boolean' | 'number';
    nonEmpty?: boolean;
}

export interface LogicCommandDefinition {
    type: string;
    label: string;
    description: string;
    domain: LogicCommandDomain;
    supportedAssignmentKinds?: readonly LogicCommandAssignmentKind[];
    supportedScriptCategories?: readonly TestWorldLogicScriptCategory[];
    eventRuntimeSupported?: boolean;
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

export const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

export const asNonEmptyTrimmedString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
