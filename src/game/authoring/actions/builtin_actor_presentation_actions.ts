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
        category: 'actor_presentation',
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

export const BUILTIN_ACTOR_PRESENTATION_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'actor.play_animation',
        title: 'Play Animation',
        defaultParams: { animationId: '' },
        editorSchema: {
            fields: [{ key: 'animationId', label: 'Animation', type: 'animation_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_animation_state',
        title: 'Set Animation State',
        defaultParams: { stateId: '' },
        editorSchema: {
            fields: [{ key: 'stateId', label: 'State', type: 'animation_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.manpu.show',
        title: 'Show Manpu',
        defaultParams: { manpuId: '', durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'manpuId', label: 'Manpu Id', type: 'string', required: true },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.manpu.hide',
        title: 'Hide Manpu',
        defaultParams: {},
        editorSchema: {
            fields: [{ key: 'manpuId', label: 'Manpu Id', type: 'string' }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.manpu.clear',
        title: 'Clear Manpu',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.focus_marker.set',
        title: 'Set Focus Marker',
        defaultParams: {},
        editorSchema: {
            fields: [
                { key: 'targetActorId', label: 'Target Actor', type: 'actor_ref' },
                { key: 'markerId', label: 'Marker', type: 'marker_ref' },
                { key: 'x', label: 'X', type: 'number' },
                { key: 'y', label: 'Y', type: 'number' }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.focus_marker.clear',
        title: 'Clear Focus Marker',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.face_focus_marker',
        title: 'Face Focus Marker',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_tint',
        title: 'Set Tint',
        defaultParams: { color: '#ffffff' },
        editorSchema: {
            fields: [{ key: 'color', label: 'Color', type: 'color', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.clear_tint',
        title: 'Clear Tint',
        defaultParams: {},
        editorSchema: { fields: [] }
    })
];

export const registerBuiltinActorPresentationActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_ACTOR_PRESENTATION_ACTIONS);
};

