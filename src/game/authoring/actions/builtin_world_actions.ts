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
        scope: 'world',
        category: 'world',
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

export const BUILTIN_WORLD_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'world.set_flag',
        title: 'Set Flag',
        defaultParams: { flagId: '', value: false },
        editorSchema: {
            fields: [
                { key: 'flagId', label: 'Flag', type: 'flag_ref', required: true },
                { key: 'value', label: 'Value', type: 'boolean', required: true }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'world.emit_event',
        title: 'Emit Event',
        defaultParams: { eventId: '' },
        editorSchema: {
            fields: [{ key: 'eventId', label: 'Event Id', type: 'string', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'world.set_object_state',
        title: 'Set Object State',
        defaultParams: { objectId: '', stateId: '' },
        editorSchema: {
            fields: [
                { key: 'objectId', label: 'Object', type: 'object_ref', required: true },
                { key: 'stateId', label: 'State Id', type: 'string', required: true }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'world.enable_object',
        title: 'Enable Object',
        defaultParams: { objectId: '' },
        editorSchema: {
            fields: [{ key: 'objectId', label: 'Object', type: 'object_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'world.disable_object',
        title: 'Disable Object',
        defaultParams: { objectId: '' },
        editorSchema: {
            fields: [{ key: 'objectId', label: 'Object', type: 'object_ref', required: true }]
        }
    })
];

export const registerBuiltinWorldActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_WORLD_ACTIONS);
};


