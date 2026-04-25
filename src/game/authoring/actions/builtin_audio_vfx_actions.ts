import { registerActionDefinitions, type ActionCatalog } from './action_catalog';
import { validateParamsAgainstEditorSchema, type ActionEditorSchema } from './action_editor_schema';
import { createImmediateActionRunner } from './action_runner';
import type { ActionDefinition, ActionParams } from './action_types';

const createBuiltinAudioActionDefinition = <P extends ActionParams>(config: {
    readonly type: string;
    readonly title: string;
    readonly scope: 'audio' | 'vfx';
    readonly defaultParams: P;
    readonly editorSchema: ActionEditorSchema;
}): ActionDefinition<P> => {
    const definition: ActionDefinition<P> = {
        type: config.type,
        title: config.title,
        scope: config.scope,
        category: 'audio_vfx',
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

export const BUILTIN_AUDIO_VFX_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinAudioActionDefinition({
        type: 'audio.play_sfx',
        title: 'Play SFX',
        scope: 'audio',
        defaultParams: { sfxId: '' },
        editorSchema: {
            fields: [{ key: 'sfxId', label: 'SFX', type: 'audio_ref', required: true }]
        }
    }),
    createBuiltinAudioActionDefinition({
        type: 'vfx.spawn',
        title: 'Spawn VFX',
        scope: 'vfx',
        defaultParams: { vfxId: '' },
        editorSchema: {
            fields: [
                { key: 'vfxId', label: 'VFX', type: 'vfx_ref', required: true },
                { key: 'actorId', label: 'Actor', type: 'actor_ref' },
                { key: 'x', label: 'X', type: 'number' },
                { key: 'y', label: 'Y', type: 'number' }
            ]
        }
    })
];

export const registerBuiltinAudioVfxActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_AUDIO_VFX_ACTIONS);
};

