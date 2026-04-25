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
        category: 'actor_movement',
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

export const BUILTIN_ACTOR_MOVEMENT_ACTIONS: readonly ActionDefinition[] = [
    createBuiltinActionDefinition({
        type: 'actor.wait',
        title: 'Actor Wait',
        defaultParams: { durationMs: 0 },
        editorSchema: {
            fields: [{ key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.move_to_x',
        title: 'Move To X',
        defaultParams: { x: 0, speed: 0, tolerancePx: 0 },
        editorSchema: {
            fields: [
                { key: 'x', label: 'Target X', type: 'number', required: true },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'tolerancePx', label: 'Tolerance (px)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.move_to_y',
        title: 'Move To Y',
        defaultParams: { y: 0, speed: 0, tolerancePx: 0 },
        editorSchema: {
            fields: [
                { key: 'y', label: 'Target Y', type: 'number', required: true },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'tolerancePx', label: 'Tolerance (px)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.move_to_point',
        title: 'Move To Point',
        defaultParams: { point: { x: 0, y: 0 }, speed: 0, tolerancePx: 0 },
        editorSchema: {
            fields: [
                { key: 'point', label: 'Point', type: 'point', required: true },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'tolerancePx', label: 'Tolerance (px)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.move_to_marker',
        title: 'Move To Marker',
        defaultParams: { markerId: '', speed: 0, tolerancePx: 0 },
        editorSchema: {
            fields: [
                { key: 'markerId', label: 'Marker', type: 'marker_ref', required: true },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'tolerancePx', label: 'Tolerance (px)', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.walk_left',
        title: 'Walk Left',
        defaultParams: { speed: 0 },
        editorSchema: {
            fields: [{ key: 'speed', label: 'Speed', type: 'number', min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.walk_right',
        title: 'Walk Right',
        defaultParams: { speed: 0 },
        editorSchema: {
            fields: [{ key: 'speed', label: 'Speed', type: 'number', min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.stop_horizontal',
        title: 'Stop Horizontal',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.stop_all',
        title: 'Stop All',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.jump',
        title: 'Jump',
        defaultParams: { strength: 0 },
        editorSchema: {
            fields: [{ key: 'strength', label: 'Strength', type: 'number', min: 0 }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.jump_to_marker',
        title: 'Jump To Marker',
        defaultParams: { markerId: '', strength: 0 },
        editorSchema: {
            fields: [
                { key: 'markerId', label: 'Marker', type: 'marker_ref', required: true },
                { key: 'strength', label: 'Strength', type: 'number', min: 0 }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.set_velocity',
        title: 'Set Velocity',
        defaultParams: { vx: 0, vy: 0 },
        editorSchema: {
            fields: [
                { key: 'vx', label: 'Velocity X', type: 'number', required: true },
                { key: 'vy', label: 'Velocity Y', type: 'number', required: true }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.dash',
        title: 'Dash',
        defaultParams: { direction: 'toward_facing', speed: 0, durationMs: 0 },
        editorSchema: {
            fields: [
                {
                    key: 'direction',
                    label: 'Direction',
                    type: 'enum',
                    required: true,
                    options: [
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' },
                        { value: 'toward_facing', label: 'Toward Facing' },
                        { value: 'toward_target', label: 'Toward Target' }
                    ]
                },
                { key: 'speed', label: 'Speed', type: 'number', required: true, min: 0 },
                { key: 'durationMs', label: 'Duration (ms)', type: 'number', required: true, min: 0 },
                { key: 'targetActorId', label: 'Target Actor', type: 'actor_ref' }
            ]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.face_left',
        title: 'Face Left',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.face_right',
        title: 'Face Right',
        defaultParams: {},
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.face_target',
        title: 'Face Target',
        defaultParams: { targetActorId: '' },
        editorSchema: {
            fields: [{ key: 'targetActorId', label: 'Target Actor', type: 'actor_ref', required: true }]
        }
    })
];

export const registerBuiltinActorMovementActions = (catalog: ActionCatalog): void => {
    registerActionDefinitions(catalog, BUILTIN_ACTOR_MOVEMENT_ACTIONS);
};

