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
        scope: 'platform',
        category: 'platform',
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

export const BUILTIN_PLATFORM_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'platform.start_motion',
        title: 'Start Platform Motion',
        defaultParams: { platformId: '' },
        editorSchema: {
            fields: [{ key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.stop_motion',
        title: 'Stop Platform Motion',
        defaultParams: { platformId: '' },
        editorSchema: {
            fields: [{ key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.pause_motion',
        title: 'Pause Platform Motion',
        defaultParams: { platformId: '' },
        editorSchema: {
            fields: [{ key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.resume_motion',
        title: 'Resume Platform Motion',
        defaultParams: { platformId: '' },
        editorSchema: {
            fields: [{ key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.set_motion_state',
        title: 'Set Platform Motion State',
        defaultParams: { platformId: '', stateId: '' },
        editorSchema: {
            fields: [
                { key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true },
                { key: 'stateId', label: 'State Id', type: 'string', required: true }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.rotate_to',
        title: 'Rotate Platform',
        defaultParams: { platformId: '', angleDeg: 0, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true },
                { key: 'angleDeg', label: 'Angle (deg)', type: 'number', required: true },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'platform.set_rotation_speed',
        title: 'Set Rotation Speed',
        defaultParams: { platformId: '', degreesPerSecond: 0 },
        editorSchema: {
            fields: [
                { key: 'platformId', label: 'Platform', type: 'moving_platform_ref', required: true },
                { key: 'degreesPerSecond', label: 'Degrees / second', type: 'number', required: true }
            ]
        }
    })
];

export const registerBuiltinPlatformActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_PLATFORM_ACTIONS);
};


