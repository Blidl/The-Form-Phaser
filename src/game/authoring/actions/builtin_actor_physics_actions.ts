import { registerActionDefinitions, type ActionCatalog } from './action_catalog';
import { validateParamsAgainstEditorSchema, type ActionEditorSchema } from './action_editor_schema';
import { createImmediateActionRunner } from './action_runner';
import type { ActionDefinition, ActionParams } from './action_types';

const createBuiltinActionDefinition = <P extends ActionParams>(config: {
    readonly type: string;
    readonly title: string;
    readonly defaultParams: P;
    readonly editorSchema: ActionEditorSchema;
}): ActionDefinition<P> => {
    const definition: ActionDefinition<P> = {
        type: config.type,
        title: config.title,
        scope: 'actor',
        category: 'actor_physics',
        defaultParams: config.defaultParams,
        editorSchema: config.editorSchema,
        validate(params, context) {
            return validateParamsAgainstEditorSchema(params, definition.editorSchema, context);
        },
        createRunner(_params, _context) {
            return createImmediateActionRunner(definition.type, 'stub');
        }
    };
    return definition;
};

export const BUILTIN_ACTOR_PHYSICS_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'actor.set_form',
        title: 'Set Form',
        defaultParams: { formId: '' },
        editorSchema: {
            fields: [{ key: 'formId', label: 'Form', type: 'form_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_physics_mode',
        title: 'Set Physics Mode',
        defaultParams: { mode: 'dynamic' },
        editorSchema: {
            fields: [
                {
                    key: 'mode',
                    label: 'Mode',
                    type: 'enum',
                    required: true,
                    options: [
                        { value: 'dynamic', label: 'Dynamic' },
                        { value: 'kinematic', label: 'Kinematic' },
                        { value: 'static', label: 'Static' },
                        { value: 'ghost', label: 'Ghost' }
                    ]
                }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.enable_gravity',
        title: 'Enable Gravity',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.disable_gravity',
        title: 'Disable Gravity',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_collision_enabled',
        title: 'Set Collision Enabled',
        defaultParams: { enabled: true },
        editorSchema: {
            fields: [{ key: 'enabled', label: 'Enabled', type: 'boolean', required: true }]
        }
    })
];

export const registerBuiltinActorPhysicsActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_ACTOR_PHYSICS_ACTIONS);
};


