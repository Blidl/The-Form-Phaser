export type EditorObjectCategory = 'platforms' | 'special' | 'objects';

export type EditorObjectCollisionType = 'solid' | 'visual_only';

export interface EditorObjectBoundsData {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
}

export interface EditorObjectVisualData {
    shaderKey: string | null;
    textureKey: string | null;
    fillColor: string;
    strokeColor: string;
    alpha: number;
    layer: number;
    onlyDebugView: boolean;
}

export interface EditorObjectSettingsData {
    type: string;
    category: EditorObjectCategory;
    collision: EditorObjectCollisionType;
}

export interface EditorObjectActionsData {
    moveScriptId: string | null;
    rotateScriptId: string | null;
    defaultActionId: string | null;
    actionScriptIds: string[];
}

export interface EditorObjectData {
    id: string;
    name: string;
    bounds: EditorObjectBoundsData;
    visual: EditorObjectVisualData;
    settings: EditorObjectSettingsData;
    actions: EditorObjectActionsData;
    editor?: {
        locked?: boolean;
    };
}

export interface CreateDefaultEditorObjectOptions {
    id: string;
    name?: string;
    bounds?: Partial<EditorObjectBoundsData>;
    visual?: Partial<EditorObjectVisualData>;
    settings?: Partial<EditorObjectSettingsData>;
    actions?: Partial<EditorObjectActionsData>;
    editor?: EditorObjectData['editor'];
}

export const createDefaultEditorObjectData = (
    options: CreateDefaultEditorObjectOptions
): EditorObjectData => {
    const type = options.settings?.type ?? 'platform_default';
    const category = options.settings?.category ?? 'platforms';

    return {
        id: options.id,
        name: options.name ?? `${type} ${options.id}`,
        bounds: {
            x: options.bounds?.x ?? 0,
            y: options.bounds?.y ?? 0,
            width: options.bounds?.width ?? 128,
            height: options.bounds?.height ?? 32,
            rotation: options.bounds?.rotation ?? 0
        },
        visual: {
            shaderKey: options.visual?.shaderKey ?? null,
            textureKey: options.visual?.textureKey ?? null,
            fillColor: options.visual?.fillColor ?? '#ffffff',
            strokeColor: options.visual?.strokeColor ?? '#000000',
            alpha: options.visual?.alpha ?? 1,
            layer: options.visual?.layer ?? 3,
            onlyDebugView: options.visual?.onlyDebugView ?? false
        },
        settings: {
            type,
            category,
            collision: options.settings?.collision ?? 'solid'
        },
        actions: {
            moveScriptId: options.actions?.moveScriptId ?? null,
            rotateScriptId: options.actions?.rotateScriptId ?? null,
            defaultActionId: options.actions?.defaultActionId ?? null,
            actionScriptIds: options.actions?.actionScriptIds
                ? [...options.actions.actionScriptIds]
                : []
        },
        editor: options.editor ? { ...options.editor } : undefined
    };
};
