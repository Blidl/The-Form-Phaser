import type { AuthoringValidationContext, ValidationIssue } from '../validation/validation_types';
import type { ActionEditorSchema } from './action_editor_schema';
import type { ActionRunner, ActionRunnerContext } from './action_runner';

export type ActionTypeId = string;

export type ActionParams = Readonly<Record<string, unknown>>;

export type ActionScope = 'actor' | 'world' | 'camera' | 'platform' | 'audio' | 'vfx';

export type ActionCategory =
    | 'actor_movement'
    | 'actor_physics'
    | 'actor_combat'
    | 'actor_presentation'
    | 'world'
    | 'camera'
    | 'platform'
    | 'audio_vfx';

export interface ActionDefinition<P extends ActionParams = ActionParams> {
    readonly type: ActionTypeId;
    readonly title: string;
    readonly scope: ActionScope;
    readonly category: ActionCategory;
    readonly defaultParams: P;
    readonly editorSchema: ActionEditorSchema;
    validate(params: P, context: AuthoringValidationContext): readonly ValidationIssue[];
    createRunner(params: P, context: ActionRunnerContext): ActionRunner;
}
