import type { AuthoringValidationContext, ValidationIssue } from '../validation/validation_types';
import {
    validateActorRef,
    validateCutsceneRef,
    validateFlagRef,
    validateMovingPlatformRef,
    validateNpcProfileRef,
    validateObjectRef,
    validateSequenceRef,
    validateTriggerPlatformRef,
    validateTriggerRef
} from '../validation/validation_service';

export type ActionEditorFieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'actor_ref'
    | 'npc_profile_ref'
    | 'cutscene_ref'
    | 'sequence_ref'
    | 'flag_ref'
    | 'object_ref'
    | 'trigger_ref'
    | 'moving_platform_ref'
    | 'trigger_platform_ref'
    | 'point'
    | 'color'
    | 'marker_ref'
    | 'animation_ref'
    | 'audio_ref'
    | 'vfx_ref'
    | 'form_ref'
    | 'physics_mode_ref';

export interface ActionEditorFieldOption {
    readonly value: string;
    readonly label: string;
}

export interface ActionEditorField {
    readonly key: string;
    readonly label: string;
    readonly type: ActionEditorFieldType;
    readonly required?: boolean;
    readonly defaultValue?: unknown;
    readonly options?: readonly ActionEditorFieldOption[];
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly helpText?: string;
}

export interface ActionEditorSchema {
    readonly fields: readonly ActionEditorField[];
}

const createIssue = (
    context: AuthoringValidationContext,
    code: string,
    message: string,
    path: string
): ValidationIssue => {
    return {
        severity: 'error',
        code,
        message,
        path,
        source: context.source
    };
};

const isMissingRequiredValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
        return true;
    }

    if (typeof value === 'string') {
        return value.trim().length === 0;
    }

    return false;
};

const isBlankString = (value: unknown): boolean => {
    return typeof value === 'string' && value.trim().length === 0;
};

const validateStringOnlyRef = (
    value: unknown,
    key: string,
    context: AuthoringValidationContext,
    required: boolean
): readonly ValidationIssue[] => {
    const path = `params.${key}`;

    if (value === null || value === undefined || isBlankString(value)) {
        if (required) {
            return [
                createIssue(context, 'missing_action_param', `Required action parameter "${key}" is missing.`, path)
            ];
        }
        return [];
    }

    if (typeof value !== 'string') {
        return [
            createIssue(
                context,
                'invalid_action_param_type',
                `Action parameter "${key}" must be a string reference id.`,
                path
            )
        ];
    }

    return [];
};

const validatePoint = (
    value: unknown,
    key: string,
    context: AuthoringValidationContext
): readonly ValidationIssue[] => {
    const path = `params.${key}`;
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return [
            createIssue(
                context,
                'invalid_action_param_type',
                `Action parameter "${key}" must be a point object with numeric x/y.`,
                path
            )
        ];
    }

    const point = value as { x?: unknown; y?: unknown };
    const hasValidX = typeof point.x === 'number' && Number.isFinite(point.x);
    const hasValidY = typeof point.y === 'number' && Number.isFinite(point.y);
    if (!hasValidX || !hasValidY) {
        return [
            createIssue(
                context,
                'invalid_action_param_type',
                `Action parameter "${key}" must include finite numeric x and y values.`,
                path
            )
        ];
    }

    return [];
};

const validateFieldValue = (
    params: Readonly<Record<string, unknown>>,
    field: ActionEditorField,
    context: AuthoringValidationContext
): readonly ValidationIssue[] => {
    const value = params[field.key];
    const path = `params.${field.key}`;

    if (value === null || value === undefined) {
        return [];
    }

    switch (field.type) {
        case 'string': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string.`,
                        path
                    )
                ];
            }
            return [];
        }
        case 'number': {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a finite number.`,
                        path
                    )
                ];
            }

            const issues: ValidationIssue[] = [];
            if (typeof field.min === 'number' && value < field.min) {
                issues.push(
                    createIssue(
                        context,
                        'action_param_out_of_range',
                        `Action parameter "${field.key}" must be >= ${field.min}.`,
                        path
                    )
                );
            }
            if (typeof field.max === 'number' && value > field.max) {
                issues.push(
                    createIssue(
                        context,
                        'action_param_out_of_range',
                        `Action parameter "${field.key}" must be <= ${field.max}.`,
                        path
                    )
                );
            }
            return issues;
        }
        case 'boolean': {
            if (typeof value !== 'boolean') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a boolean.`,
                        path
                    )
                ];
            }
            return [];
        }
        case 'enum': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be an enum string value.`,
                        path
                    )
                ];
            }

            const options = field.options ?? [];
            const isValidOption = options.some((option) => option.value === value);
            if (!isValidOption) {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_option',
                        `Action parameter "${field.key}" must match a configured enum option.`,
                        path
                    )
                ];
            }
            return [];
        }
        case 'actor_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string actor reference id.`,
                        path
                    )
                ];
            }
            return validateActorRef(context, value, path);
        }
        case 'npc_profile_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string npc profile reference id.`,
                        path
                    )
                ];
            }
            return validateNpcProfileRef(context, value, path);
        }
        case 'cutscene_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string cutscene reference id.`,
                        path
                    )
                ];
            }
            return validateCutsceneRef(context, value, path);
        }
        case 'sequence_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string sequence reference id.`,
                        path
                    )
                ];
            }
            return validateSequenceRef(context, value, path);
        }
        case 'flag_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string flag reference id.`,
                        path
                    )
                ];
            }
            return validateFlagRef(context, value, path);
        }
        case 'object_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string object reference id.`,
                        path
                    )
                ];
            }
            return validateObjectRef(context, value, path);
        }
        case 'trigger_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string trigger reference id.`,
                        path
                    )
                ];
            }
            return validateTriggerRef(context, value, path);
        }
        case 'moving_platform_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string moving platform reference id.`,
                        path
                    )
                ];
            }
            return validateMovingPlatformRef(context, value, path);
        }
        case 'trigger_platform_ref': {
            if (typeof value !== 'string') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string trigger platform reference id.`,
                        path
                    )
                ];
            }
            return validateTriggerPlatformRef(context, value, path);
        }
        case 'marker_ref':
        case 'animation_ref':
        case 'audio_ref':
        case 'vfx_ref':
        case 'form_ref':
        case 'physics_mode_ref': {
            return validateStringOnlyRef(value, field.key, context, false);
        }
        case 'point': {
            return validatePoint(value, field.key, context);
        }
        case 'color': {
            if (typeof value !== 'string' && typeof value !== 'number') {
                return [
                    createIssue(
                        context,
                        'invalid_action_param_type',
                        `Action parameter "${field.key}" must be a string or number color value.`,
                        path
                    )
                ];
            }
            return [];
        }
        default: {
            return [];
        }
    }
};

export const validateParamsAgainstEditorSchema = (
    params: Readonly<Record<string, unknown>>,
    schema: ActionEditorSchema,
    context: AuthoringValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    schema.fields.forEach((field) => {
        const value = params[field.key];
        const path = `params.${field.key}`;

        if (field.required && isMissingRequiredValue(value)) {
            issues.push(
                createIssue(context, 'missing_action_param', `Required action parameter "${field.key}" is missing.`, path)
            );
            return;
        }

        issues.push(...validateFieldValue(params, field, context));
    });

    return issues;
};
