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
        category: 'actor_combat',
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

export const BUILTIN_ACTOR_COMBAT_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'actor.attack_contact_enable',
        title: 'Enable Contact Attack',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.attack_contact_disable',
        title: 'Disable Contact Attack',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.attack_melee',
        title: 'Melee Attack',
        defaultParams: { damage: 0, rangePx: 0, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'damage', label: 'Damage', type: 'number', required: true, min: 0 },
                { key: 'rangePx', label: 'Range (px)', type: 'number', required: true, min: 0 },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.attack_projectile',
        title: 'Projectile Attack',
        defaultParams: { projectileId: '', speed: 0, damage: 0 },
        editorSchema: {
            fields: [
                { key: 'projectileId', label: 'Projectile Id', type: 'string', required: true },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'damage', label: 'Damage', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.attack_dash',
        title: 'Dash Attack',
        defaultParams: { speed: 0, durationMs: 0, damage: 0 },
        editorSchema: {
            fields: [
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 },
                { key: 'damage', label: 'Damage', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.kill',
        title: 'Kill Actor',
        defaultParams: {},
        editorSchema: {
            fields: [{ key: 'targetActorId', label: 'Target Actor', type: 'actor_ref' }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.damage',
        title: 'Damage Actor',
        defaultParams: { targetActorId: '', amount: 0 },
        editorSchema: {
            fields: [
                { key: 'targetActorId', label: 'Target Actor', type: 'actor_ref', required: true },
                { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_invulnerable',
        title: 'Set Invulnerable',
        defaultParams: { enabled: false, durationMs: 0 },
        editorSchema: {
            fields: [
                { key: 'enabled', label: 'Enabled', type: 'boolean', required: true },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', min: 0 }
            ]
        }
    })
];

export const registerBuiltinActorCombatActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_ACTOR_COMBAT_ACTIONS);
};

