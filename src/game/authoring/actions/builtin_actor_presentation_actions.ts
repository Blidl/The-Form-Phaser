import { registerActionDefinitions, type ActionCatalog } from './action_catalog';
import { validateParamsAgainstEditorSchema, type ActionEditorSchema } from './action_editor_schema';
import { createImmediateActionRunner, type ActionRunner, type ActionRunnerContext } from './action_runner';
import type { ActionDefinition, ActionParams } from './action_types';
import type { ActorFocusMarkerRuntime } from '../../actors/overlays/actor_focus_marker_runtime';
import type { ActorFocusMarkerTarget } from '../../actors/overlays/actor_focus_marker_types';
import type { ActorManpuRuntime } from '../../actors/overlays/actor_manpu_runtime';

type OverlayActionRuntimeServices = {
    readonly manpuRuntime?: ActorManpuRuntime;
    readonly focusMarkerRuntime?: ActorFocusMarkerRuntime;
    readonly faceFocusMarker?: (actorId: string) => void;
};

const createBuiltinActionDefinition = <P extends ActionParams>(config: {
    readonly type: string;
    readonly title: string;
    readonly defaultParams: P;
    readonly editorSchema: ActionEditorSchema;
    readonly createRunner?: (params: P, context: ActionRunnerContext) => ActionRunner;
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
        createRunner(params, context) {
            if (config.createRunner !== undefined) {
                return config.createRunner(params, context);
            }
            return createImmediateActionRunner(definition.type, 'stub');
        }
    };
    return definition;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null;

const hasFunction = <K extends string>(
    value: Readonly<Record<string, unknown>>,
    key: K
): value is Readonly<Record<K, (...args: readonly unknown[]) => unknown>> => typeof value[key] === 'function';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const toOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalFiniteNumber = (value: unknown): number | undefined => (isFiniteNumber(value) ? value : undefined);

const isActorManpuRuntime = (value: unknown): value is ActorManpuRuntime =>
    isRecord(value) && hasFunction(value, 'show') && hasFunction(value, 'hide') && hasFunction(value, 'clear');

const isActorFocusMarkerRuntime = (value: unknown): value is ActorFocusMarkerRuntime =>
    isRecord(value) && hasFunction(value, 'set') && hasFunction(value, 'clear');

const isFaceFocusMarker = (value: unknown): value is (actorId: string) => void => typeof value === 'function';

const getOverlayServices = (context: ActionRunnerContext): OverlayActionRuntimeServices => {
    const services = context.services;
    if (!isRecord(services)) {
        return {};
    }

    const manpuRuntime = isActorManpuRuntime(services.manpuRuntime) ? services.manpuRuntime : undefined;
    const focusMarkerRuntime = isActorFocusMarkerRuntime(services.focusMarkerRuntime)
        ? services.focusMarkerRuntime
        : undefined;
    const faceFocusMarker = isFaceFocusMarker(services.faceFocusMarker) ? services.faceFocusMarker : undefined;

    return {
        manpuRuntime,
        focusMarkerRuntime,
        faceFocusMarker
    };
};

const resolveActorId = (params: ActionParams, context: ActionRunnerContext): string | undefined =>
    toOptionalString(params.actorId) ?? toOptionalString(context.actorId);

const toManpuAnchor = (
    value: unknown
):
    | 'top_right'
    | 'top_left'
    | 'center_right'
    | 'center_left'
    | undefined => {
    if (
        value === 'top_right' ||
        value === 'top_left' ||
        value === 'center_right' ||
        value === 'center_left'
    ) {
        return value;
    }
    return undefined;
};

const resolveFocusMarkerTarget = (params: ActionParams): ActorFocusMarkerTarget | undefined => {
    const targetActorId = toOptionalString(params.targetActorId);
    if (targetActorId !== undefined) {
        return { kind: 'actor', actorId: targetActorId };
    }

    const markerId = toOptionalString(params.markerId);
    if (markerId !== undefined) {
        return { kind: 'marker', markerId };
    }

    const x = toOptionalFiniteNumber(params.x);
    const y = toOptionalFiniteNumber(params.y);
    if (x !== undefined && y !== undefined) {
        return { kind: 'point', x, y };
    }

    return undefined;
};

const createOverlayAdapterRunner = (
    type: string,
    execute: () => string
): ActionRunner => {
    let status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' = 'idle';
    let elapsedMs = 0;
    let detail = 'overlay_adapter';

    return {
        begin(): 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' {
            if (status !== 'idle') {
                return status;
            }

            status = 'running';
            try {
                detail = execute();
            } catch {
                detail = 'overlay_adapter_failed';
                status = 'failed';
                return status;
            }

            status = 'completed';
            return status;
        },
        update(deltaMs: number): 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' {
            if (Number.isFinite(deltaMs)) {
                elapsedMs += Math.max(0, deltaMs);
            }
            return status;
        },
        cancel(): void {
            if (status === 'completed' || status === 'failed') {
                return;
            }
            status = 'cancelled';
        },
        getDebugSnapshot() {
            return {
                type,
                status,
                elapsedMs,
                detail
            };
        }
    };
};

const createActorManpuShowRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.manpu.show', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const manpuRuntime = getOverlayServices(context).manpuRuntime;
        if (manpuRuntime === undefined) {
            return 'overlay_adapter_no_service';
        }

        const manpuId = toOptionalString(params.manpuId);
        if (manpuId === undefined) {
            return 'overlay_adapter_missing_manpu_id';
        }

        manpuRuntime.show({
            actorId,
            manpuId,
            durationMs: toOptionalFiniteNumber(params.durationMs),
            anchor: toManpuAnchor(params.anchor),
            offsetX: toOptionalFiniteNumber(params.offsetX),
            offsetY: toOptionalFiniteNumber(params.offsetY)
        });

        return 'overlay_adapter';
    });

const createActorManpuHideRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.manpu.hide', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const manpuRuntime = getOverlayServices(context).manpuRuntime;
        if (manpuRuntime === undefined) {
            return 'overlay_adapter_no_service';
        }

        const manpuId = toOptionalString(params.manpuId);
        manpuRuntime.hide(manpuId !== undefined ? { actorId, manpuId } : { actorId });
        return 'overlay_adapter';
    });

const createActorManpuClearRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.manpu.clear', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const manpuRuntime = getOverlayServices(context).manpuRuntime;
        if (manpuRuntime === undefined) {
            return 'overlay_adapter_no_service';
        }

        manpuRuntime.clear({ actorId });
        return 'overlay_adapter';
    });

const createActorFocusMarkerSetRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.focus_marker.set', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const focusMarkerRuntime = getOverlayServices(context).focusMarkerRuntime;
        if (focusMarkerRuntime === undefined) {
            return 'overlay_adapter_no_service';
        }

        const target = resolveFocusMarkerTarget(params);
        if (target === undefined) {
            return 'overlay_adapter_missing_target';
        }

        focusMarkerRuntime.set({
            actorId,
            target,
            styleId: toOptionalString(params.styleId),
            durationMs: toOptionalFiniteNumber(params.durationMs)
        });

        return 'overlay_adapter';
    });

const createActorFocusMarkerClearRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.focus_marker.clear', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const focusMarkerRuntime = getOverlayServices(context).focusMarkerRuntime;
        if (focusMarkerRuntime === undefined) {
            return 'overlay_adapter_no_service';
        }

        focusMarkerRuntime.clear({ actorId });
        return 'overlay_adapter';
    });

const createActorFaceFocusMarkerRunner = (params: ActionParams, context: ActionRunnerContext): ActionRunner =>
    createOverlayAdapterRunner('actor.face_focus_marker', () => {
        const actorId = resolveActorId(params, context);
        if (actorId === undefined) {
            return 'overlay_adapter_missing_actor';
        }

        const faceFocusMarker = getOverlayServices(context).faceFocusMarker;
        if (faceFocusMarker === undefined) {
            return 'overlay_adapter_no_service';
        }

        faceFocusMarker(actorId);
        return 'overlay_adapter';
    });

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
        createRunner: createActorManpuShowRunner,
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
        createRunner: createActorManpuHideRunner,
        editorSchema: {
            fields: [{ key: 'manpuId', label: 'Manpu Id', type: 'string' }]
        }
    }),
    createBuiltinActionDefinition({
        type: 'actor.manpu.clear',
        title: 'Clear Manpu',
        defaultParams: {},
        createRunner: createActorManpuClearRunner,
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.focus_marker.set',
        title: 'Set Focus Marker',
        defaultParams: {},
        createRunner: createActorFocusMarkerSetRunner,
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
        createRunner: createActorFocusMarkerClearRunner,
        editorSchema: { fields: [] }
    }),
    createBuiltinActionDefinition({
        type: 'actor.face_focus_marker',
        title: 'Face Focus Marker',
        defaultParams: {},
        createRunner: createActorFaceFocusMarkerRunner,
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

