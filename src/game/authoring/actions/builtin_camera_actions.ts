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
        scope: 'camera',
        category: 'camera',
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

export const BUILTIN_CAMERA_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'camera.focus_actor',
        title: 'Focus Actor',
        defaultParams: { actorId: '', durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'actorId', label: 'Actor', type: 'actor_ref', required: true },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.pan_to',
        title: 'Pan To Point',
        defaultParams: { point: { x: 0, y: 0 }, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'point', label: 'Point', type: 'point', required: true },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.zoom_to',
        title: 'Zoom To',
        defaultParams: { zoom: 1, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'zoom', label: 'Zoom', type: 'number', required: true, min: 0 },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.shake',
        title: 'Shake',
        defaultParams: { intensity: 0, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'intensity', label: 'Intensity', type: 'number', required: true, min: 0 },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.fade_in',
        title: 'Fade In',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.fade_out',
        title: 'Fade Out',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.flash',
        title: 'Flash',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.letterbox_show',
        title: 'Show Letterbox',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'camera.letterbox_hide',
        title: 'Hide Letterbox',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }]
        }
    })
];

export const registerBuiltinCameraActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_CAMERA_ACTIONS);
};


