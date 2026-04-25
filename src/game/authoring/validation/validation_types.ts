import type { ReferenceIndex } from '../registry/reference_index';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ContentReferenceKind =
    | 'level'
    | 'level_object'
    | 'actor'
    | 'npc_instance'
    | 'npc_profile'
    | 'npc_scripted_sequence'
    | 'cutscene'
    | 'world_flag'
    | 'trigger_volume'
    | 'moving_platform'
    | 'trigger_platform';

export interface ValidationIssue {
    severity: ValidationSeverity;
    code: string;
    message: string;
    path?: string;
    source?: string;
    refKind?: ContentReferenceKind;
    refId?: string;
}

export interface AuthoringValidationContext {
    referenceIndex: ReferenceIndex;
    source?: string;
}
