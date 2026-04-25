import type {
    AuthoringValidationContext,
    ContentReferenceKind,
    ValidationIssue,
    ValidationSeverity
} from './validation_types';
import { hasReference } from '../registry/reference_index';

export interface ValidationRule<T> {
    id: string;
    validate(value: T, context: AuthoringValidationContext): readonly ValidationIssue[];
}

export interface ValidationService<T> {
    validate(value: T, context: AuthoringValidationContext): readonly ValidationIssue[];
}

export const createValidationService = <T>(rules: readonly ValidationRule<T>[]): ValidationService<T> => {
    const frozenRules = [...rules];

    return {
        validate(value: T, context: AuthoringValidationContext): readonly ValidationIssue[] {
            const issues: ValidationIssue[] = [];
            frozenRules.forEach((rule) => {
                const ruleIssues = rule.validate(value, context);
                issues.push(...ruleIssues);
            });
            return issues;
        }
    };
};

export const hasValidationErrors = (issues: readonly ValidationIssue[]): boolean => {
    return issues.some((issue) => issue.severity === 'error');
};

export const createMissingReferenceIssue = (args: {
    kind: ContentReferenceKind;
    id: string;
    path?: string;
    source?: string;
    severity?: ValidationSeverity;
}): ValidationIssue => {
    const trimmedId = args.id.trim();

    return {
        severity: args.severity ?? 'error',
        code: 'unknown_reference',
        message: `Unknown ${args.kind} reference "${trimmedId}".`,
        path: args.path,
        source: args.source,
        refKind: args.kind,
        refId: trimmedId
    };
};

const createMissingReferenceIdIssue = (args: {
    kind: ContentReferenceKind;
    path?: string;
    source?: string;
}): ValidationIssue => {
    return {
        severity: 'error',
        code: 'missing_reference_id',
        message: `Missing ${args.kind} reference id.`,
        path: args.path,
        source: args.source,
        refKind: args.kind
    };
};

const validateReference = (
    context: AuthoringValidationContext,
    kind: ContentReferenceKind,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (trimmed.length === 0) {
        return [
            createMissingReferenceIdIssue({
                kind,
                path,
                source: context.source
            })
        ];
    }

    if (!hasReference(context.referenceIndex, kind, trimmed)) {
        return [
            createMissingReferenceIssue({
                kind,
                id: trimmed,
                path,
                source: context.source
            })
        ];
    }

    return [];
};

export const validateActorRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'actor', id, path);
};

export const validateNpcProfileRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'npc_profile', id, path);
};

export const validateCutsceneRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'cutscene', id, path);
};

export const validateSequenceRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'npc_scripted_sequence', id, path);
};

export const validateFlagRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'world_flag', id, path);
};

export const validateObjectRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'level_object', id, path);
};

export const validateTriggerRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'trigger_volume', id, path);
};

export const validateMovingPlatformRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'moving_platform', id, path);
};

export const validateTriggerPlatformRef = (
    context: AuthoringValidationContext,
    id: string | null | undefined,
    path?: string
): readonly ValidationIssue[] => {
    return validateReference(context, 'trigger_platform', id, path);
};
