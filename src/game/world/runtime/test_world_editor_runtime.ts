import { Input, Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../../camera/follow_camera';
import type { PfPlayer } from '../../player/PfPlayer';
import type {
    TestWorldBackgroundConfig,
    TestWorldBackgroundImageConfig,
    TestWorldConfig,
    TestWorldParallaxLayerConfig,
    TestWorldVisualLayer,
    TestWorldVisualOrderConfig
} from './test_world_config';
import { createDefaultTestWorldConfig, parseTestWorldConfigJson } from './test_world_config_validation';
import {
    TEST_WORLD_EDITOR_ADAPTERS,
    TEST_WORLD_EDITOR_PALETTE,
    type TestWorldEditorBounds,
    type TestWorldEditorObjectType,
    type TestWorldEditorSelectionPart
} from './test_world_editor_adapters';
import { TestWorldEditorSidebar, type TestWorldEditorSidebarSection, type TestWorldEditorSidebarState, type TestWorldEditorTabId } from './test_world_editor_sidebar';
import { clearTestWorldEditorDraft, saveTestWorldEditorDraft } from './test_world_editor_storage';
import { createCampaignLevel, deleteCampaignLevel, getCampaignLevelSummaries, syncCampaignLevelHeader } from './test_campaign_registry';
import type { TestWorldEditorHandle, TestWorldRuntime } from './test_world_runtime';
import { TestScene } from '../../../scenes/TestScene';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../../shared/dom_input_focus';
import {
    TEST_WORLD_VISUAL_LAYER_OPTIONS,
    resolveTestWorldRenderOrder,
    resolveTestWorldVisualLayer
} from './test_world_visual_order';

export interface TestWorldEditorRuntime {
    update: (deltaMs: number) => void;
    isActive: () => boolean;
    open: () => void;
    close: () => void;
    destroy: () => void;
}

type DragMode = 'move' | 'resize' | 'pan';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface PointerDragState {
    mode: DragMode;
    handle?: ResizeHandle;
    startWorldX: number;
    startWorldY: number;
    startScrollX: number;
    startScrollY: number;
    initialBounds?: TestWorldEditorBounds;
}

interface EditorCameraSnapshot {
    scrollX: number;
    scrollY: number;
    zoom: number;
}

type BackgroundSelectionId = 'static' | 'layer_1' | 'layer_2';

interface BackgroundEditorHandle {
    id: BackgroundSelectionId;
    label: string;
    bounds: TestWorldEditorBounds;
}

const GRID_SIZES = [1, 8, 16, 32] as const;
const RESIZE_HANDLE_SIZE = 10;
const CAMERA_PAN_SPEED = 480;
const ZOOM_STEP = 0.08;
const DRAFT_AUTOSAVE_DELAY_MS = 500;
const PLACEMENT_PREVIEW_SIZE = 18;
const MIN_EDITOR_RECT_SIZE = 8;
const EDITOR_FALLBACK_BACKGROUND_COLOR = 0x263238;

interface TestWorldEditorEdges {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface TestWorldPlacementPreviewRect {
    bounds: TestWorldEditorBounds;
    part: TestWorldEditorSelectionPart;
}

interface TestWorldPlacementPreview {
    anchorX: number;
    anchorY: number;
    rects: TestWorldPlacementPreviewRect[];
}

type BackgroundLevelFieldKey =
    | 'backgroundColor'
    | 'backgroundStaticTextureKey'
    | 'backgroundStaticTextureAsset'
    | 'backgroundStaticFillColor'
    | 'backgroundStaticTintColor'
    | 'backgroundStaticAlpha'
    | 'backgroundStaticScale'
    | 'backgroundStaticWidth'
    | 'backgroundStaticHeight'
    | 'backgroundStaticRepeat'
    | 'backgroundStaticX'
    | 'backgroundStaticY'
    | `backgroundLayer${1 | 2}TextureKey`
    | `backgroundLayer${1 | 2}TextureAsset`
    | `backgroundLayer${1 | 2}FillColor`
    | `backgroundLayer${1 | 2}TintColor`
    | `backgroundLayer${1 | 2}Alpha`
    | `backgroundLayer${1 | 2}Scale`
    | `backgroundLayer${1 | 2}Width`
    | `backgroundLayer${1 | 2}Repeat`
    | `backgroundLayer${1 | 2}X`
    | `backgroundLayer${1 | 2}Y`
    | `backgroundLayer${1 | 2}Height`
    | `backgroundLayer${1 | 2}ScrollFactorX`
    | `backgroundLayer${1 | 2}ScrollFactorY`;

const EDITOR_BACKGROUND_LAYER_COUNT = 2;

const sanitizeOptionalText = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

const clampUnitInterval = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(1, value));
};

const clampPositiveScale = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0.1, Math.min(8, value));
};

const clampScrollFactor = (value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(2, value));
};

const clampBackgroundColor = (value: unknown, fallback: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback;
    }

    return Math.max(0, Math.min(0xffffff, Math.round(value)));
};

const createDefaultBackgroundLayer = (index: number): TestWorldParallaxLayerConfig => ({
    id: `layer_${index + 1}`,
    textureKey: '',
    x: 0,
    y: 220 + (index * 180),
    width: 1920,
    height: 256,
    repeat: true,
    scrollFactorX: 0.25 + (index * 0.2),
    scrollFactorY: 0.25 + (index * 0.2),
    alpha: 1,
    scale: 1
});

const cloneBackgroundLayer = (layer: TestWorldParallaxLayerConfig | undefined, index: number): TestWorldParallaxLayerConfig => ({
    ...createDefaultBackgroundLayer(index),
    ...layer
});

const cloneStaticBackgroundImage = (image: TestWorldBackgroundImageConfig | undefined): TestWorldBackgroundImageConfig => ({
    textureKey: image?.textureKey ?? '',
    textureAsset: image?.textureAsset,
    tintColor: image?.tintColor,
    alpha: image?.alpha ?? 1,
    scale: image?.scale ?? 1,
    width: image?.width ?? 1600,
    height: image?.height ?? 900,
    repeat: image?.repeat ?? false,
    fillColor: image?.fillColor,
    x: image?.x ?? 0,
    y: image?.y ?? 0
});

const getEditableBackground = (config: TestWorldConfig): TestWorldBackgroundConfig => {
    const background = config.background;
    if (!background) {
        return {
            color: EDITOR_FALLBACK_BACKGROUND_COLOR,
            staticImage: cloneStaticBackgroundImage(undefined),
            layers: Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => createDefaultBackgroundLayer(index))
        };
    }

    const layers = Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => {
        return cloneBackgroundLayer(background.layers?.[index], index);
    });

    return {
        color: background.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR,
        staticImage: cloneStaticBackgroundImage(background.staticImage),
        layers
    };
};

const compactBackgroundImage = (image: TestWorldBackgroundImageConfig): TestWorldBackgroundImageConfig | undefined => {
    const textureKey = sanitizeOptionalText(image.textureKey) ?? '';
    const textureAsset = sanitizeOptionalText(image.textureAsset);
    const fillColor = image.fillColor;
    const hasContent = textureKey.length > 0 || textureAsset !== undefined || fillColor !== undefined;
    if (!hasContent) {
        return undefined;
    }

    return {
        textureKey,
        textureAsset,
        tintColor: image.tintColor,
        alpha: clampUnitInterval(image.alpha ?? 1, 1),
        scale: clampPositiveScale(image.scale ?? 1, 1),
        width: Math.max(MIN_EDITOR_RECT_SIZE, Math.round(Number.isFinite(image.width) ? image.width : 256)),
        height: Math.max(MIN_EDITOR_RECT_SIZE, Math.round(Number.isFinite(image.height) ? image.height : 256)),
        repeat: image.repeat ?? false,
        fillColor,
        x: Number.isFinite(image.x) ? image.x : 0,
        y: Number.isFinite(image.y) ? image.y : 0
    };
};

const compactBackgroundLayer = (layer: TestWorldParallaxLayerConfig, index: number): TestWorldParallaxLayerConfig | null => {
    const image = compactBackgroundImage(layer);
    if (!image) {
        return null;
    }

    return {
        id: sanitizeOptionalText(layer.id) ?? `layer_${index + 1}`,
        y: Number.isFinite(layer.y) ? layer.y : createDefaultBackgroundLayer(index).y,
        height: Math.max(8, Math.round(Number.isFinite(layer.height) ? layer.height : createDefaultBackgroundLayer(index).height)),
        scrollFactorX: clampScrollFactor(layer.scrollFactorX, createDefaultBackgroundLayer(index).scrollFactorX),
        scrollFactorY: clampScrollFactor(layer.scrollFactorY ?? layer.scrollFactorX, createDefaultBackgroundLayer(index).scrollFactorY ?? createDefaultBackgroundLayer(index).scrollFactorX),
        ...image
    };
};

const applyBackgroundLevelField = (
    config: TestWorldConfig,
    key: BackgroundLevelFieldKey,
    value: string | number | boolean
): boolean => {
    const editable = getEditableBackground(config);
    if (key === 'backgroundColor') {
        editable.color = clampBackgroundColor(value, editable.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR);
    } else if (key === 'backgroundStaticTextureKey') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.textureKey = typeof value === 'string' ? value : editable.staticImage.textureKey;
    } else if (key === 'backgroundStaticTextureAsset') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.textureAsset = typeof value === 'string' ? value : editable.staticImage.textureAsset;
    } else if (key === 'backgroundStaticFillColor') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.fillColor = typeof value === 'number' ? clampBackgroundColor(value, 0) : editable.staticImage.fillColor;
    } else if (key === 'backgroundStaticTintColor') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.tintColor = typeof value === 'number' ? clampBackgroundColor(value, 0xffffff) : editable.staticImage.tintColor;
    } else if (key === 'backgroundStaticAlpha') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.alpha = typeof value === 'number' ? clampUnitInterval(value, 1) : editable.staticImage.alpha;
    } else if (key === 'backgroundStaticScale') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.scale = typeof value === 'number' ? clampPositiveScale(value, 1) : editable.staticImage.scale;
    } else if (key === 'backgroundStaticWidth') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.width = typeof value === 'number' && Number.isFinite(value)
            ? Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value))
            : editable.staticImage.width;
    } else if (key === 'backgroundStaticHeight') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.height = typeof value === 'number' && Number.isFinite(value)
            ? Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value))
            : editable.staticImage.height;
    } else if (key === 'backgroundStaticRepeat') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.repeat = typeof value === 'boolean' ? value : editable.staticImage.repeat;
    } else if (key === 'backgroundStaticX') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.x = typeof value === 'number' && Number.isFinite(value) ? value : editable.staticImage.x;
    } else if (key === 'backgroundStaticY') {
        editable.staticImage = cloneStaticBackgroundImage(editable.staticImage);
        editable.staticImage.y = typeof value === 'number' && Number.isFinite(value) ? value : editable.staticImage.y;
    } else {
        const layerMatch = /^backgroundLayer(\d+)(TextureKey|TextureAsset|FillColor|TintColor|Alpha|Scale|Width|Repeat|X|Y|Height|ScrollFactorX|ScrollFactorY)$/.exec(key);
        if (!layerMatch) {
            return false;
        }
        const layerIndex = Math.max(0, Number.parseInt(layerMatch[1] ?? '1', 10) - 1);
        const layerField = layerMatch[2];
        const layers = editable.layers ?? [];
        while (layers.length <= layerIndex) {
            layers.push(createDefaultBackgroundLayer(layers.length));
        }
        const layer = layers[layerIndex] ?? createDefaultBackgroundLayer(layerIndex);
        if (layerField === 'TextureKey' && typeof value === 'string') {
            layer.textureKey = value;
        } else if (layerField === 'TextureAsset' && typeof value === 'string') {
            layer.textureAsset = value;
        } else if (layerField === 'FillColor' && typeof value === 'number') {
            layer.fillColor = clampBackgroundColor(value, 0);
        } else if (layerField === 'TintColor' && typeof value === 'number') {
            layer.tintColor = clampBackgroundColor(value, 0xffffff);
        } else if (layerField === 'Alpha' && typeof value === 'number') {
            layer.alpha = clampUnitInterval(value, 1);
        } else if (layerField === 'Scale' && typeof value === 'number') {
            layer.scale = clampPositiveScale(value, 1);
        } else if (layerField === 'Width' && typeof value === 'number' && Number.isFinite(value)) {
            layer.width = Math.max(MIN_EDITOR_RECT_SIZE, Math.round(value));
        } else if (layerField === 'Repeat' && typeof value === 'boolean') {
            layer.repeat = value;
        } else if (layerField === 'X' && typeof value === 'number' && Number.isFinite(value)) {
            layer.x = value;
        } else if (layerField === 'Y' && typeof value === 'number' && Number.isFinite(value)) {
            layer.y = value;
        } else if (layerField === 'Height' && typeof value === 'number' && Number.isFinite(value)) {
            layer.height = Math.max(8, Math.round(value));
        } else if (layerField === 'ScrollFactorX' && typeof value === 'number') {
            layer.scrollFactorX = clampScrollFactor(value, 0.4);
        } else if (layerField === 'ScrollFactorY' && typeof value === 'number') {
            layer.scrollFactorY = clampScrollFactor(value, layer.scrollFactorX);
        } else {
            return false;
        }
        editable.layers = layers;
    }

    const compactStaticImage = compactBackgroundImage(editable.staticImage ?? cloneStaticBackgroundImage(undefined));
    const compactLayers = (editable.layers ?? [])
        .map((layer, index) => compactBackgroundLayer(layer, index))
        .filter((layer): layer is TestWorldParallaxLayerConfig => layer !== null);
    const hasBackground = compactStaticImage !== undefined || compactLayers.length > 0;

    if (!hasBackground) {
        config.background = null;
        return true;
    }

    config.background = {
        color: clampBackgroundColor(editable.color, EDITOR_FALLBACK_BACKGROUND_COLOR),
        staticImage: compactStaticImage,
        layers: compactLayers
    };
    return true;
};

export const createTestWorldEditorRuntime = (
    scene: Scene,
    worldRuntime: TestWorldRuntime,
    player: PfPlayer,
    levelId: string,
    defaultConfig: TestWorldConfig,
    initialOpen: boolean = false,
    initialStatus: string | null = null,
    onLevelConfigChanged?: (config: TestWorldConfig) => void,
    onEditorPreviewCameraBasisChanged?: (basis: { scrollX: number; scrollY: number; zoom: number } | null) => void
): TestWorldEditorRuntime => {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.F2);
    const deleteKey = keyboard.addKey(Input.Keyboard.KeyCodes.DELETE);
    const backspaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.BACKSPACE);
    const duplicateKey = keyboard.addKey(Input.Keyboard.KeyCodes.D);
    const undoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Z);
    const redoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Y);
    const gridKey = keyboard.addKey(Input.Keyboard.KeyCodes.G);
    const focusKey = keyboard.addKey(Input.Keyboard.KeyCodes.F);
    const focusSpawnKey = keyboard.addKey(Input.Keyboard.KeyCodes.P);
    const spaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
    const ctrlKey = keyboard.addKey(Input.Keyboard.KeyCodes.CTRL);
    const leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
    const rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
    const upKey = keyboard.addKey(Input.Keyboard.KeyCodes.UP);
    const downKey = keyboard.addKey(Input.Keyboard.KeyCodes.DOWN);
    const digitKeys = [
        keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Input.Keyboard.KeyCodes.FOUR)
    ];
    const cancelPlacementKey = keyboard.addKey(Input.Keyboard.KeyCodes.ESC);

    relaxKeyboardCapture(keyboard, [
        Input.Keyboard.KeyCodes.DELETE,
        Input.Keyboard.KeyCodes.BACKSPACE,
        Input.Keyboard.KeyCodes.D,
        Input.Keyboard.KeyCodes.Z,
        Input.Keyboard.KeyCodes.Y,
        Input.Keyboard.KeyCodes.G,
        Input.Keyboard.KeyCodes.F,
        Input.Keyboard.KeyCodes.P,
        Input.Keyboard.KeyCodes.SPACE,
        Input.Keyboard.KeyCodes.LEFT,
        Input.Keyboard.KeyCodes.RIGHT,
        Input.Keyboard.KeyCodes.UP,
        Input.Keyboard.KeyCodes.DOWN,
        Input.Keyboard.KeyCodes.ONE,
        Input.Keyboard.KeyCodes.TWO,
        Input.Keyboard.KeyCodes.THREE,
        Input.Keyboard.KeyCodes.FOUR,
        Input.Keyboard.KeyCodes.ESC
    ]);

    scene.input.mouse?.disableContextMenu();
    const selectionGraphics = scene.add.graphics().setDepth(4990);
    const placementGraphics = scene.add.graphics().setDepth(4992);
    const gridGraphics = scene.add.graphics().setDepth(4985);
    const boundsGraphics = scene.add.graphics().setDepth(4980);
    const overlayText = scene.add.text(18, 18, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.45)'
    })
        .setDepth(4995)
        .setScrollFactor(0)
        .setVisible(false);
    const backgroundSelectionText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#081018',
        backgroundColor: 'rgba(140, 255, 209, 0.92)',
        padding: {
            left: 6,
            right: 6,
            top: 3,
            bottom: 3
        }
    })
        .setDepth(4994)
        .setVisible(false);

    const appRoot = document.getElementById('app');
    if (!appRoot) {
        throw new Error('#app was not found.');
    }

    let active = false;
    let destroyed = false;
    let selectedHandleId: string | null = null;
    let searchTerm = '';
    let gridEnabled = true;
    let gridSize = 16;
    let status = initialStatus ?? '';
    let autosaveTimer: number | null = null;
    let pointerDragState: PointerDragState | null = null;
    let pendingPlacementType: TestWorldEditorObjectType | null = null;
    let gameplayCameraSnapshot: EditorCameraSnapshot | null = null;
    let activeTab: TestWorldEditorTabId = 'level';
    let selectedBackgroundId: BackgroundSelectionId | null = null;
    const undoStack: TestWorldConfig[] = [];
    const redoStack: TestWorldConfig[] = [];
    const inspectorColorKeys = new Set<string>([
        'fillColor',
        'strokeColor',
        'triggerFillColor',
        'triggerStrokeColor',
        'deactivateTriggerFillColor',
        'deactivateTriggerStrokeColor',
        'platformFillColor',
        'platformStrokeColor'
    ]);
    const getHandles = (): readonly TestWorldEditorHandle[] => worldRuntime.getEditorHandles();
    const getSelectedHandle = (): TestWorldEditorHandle | null => {
        if (!selectedHandleId) {
            return null;
        }
        return worldRuntime.getEditorHandle(selectedHandleId);
    };
    const getSelectedRootId = (): string | null => getSelectedHandle()?.rootId ?? null;
    const isObjectsTabActive = (): boolean => activeTab === 'objects';
    const isNpcTabActive = (): boolean => activeTab === 'npc';
    const isInspectorTabActive = (): boolean => activeTab === 'inspector';
    const isObjectInteractionTabActive = (): boolean => isObjectsTabActive() || isNpcTabActive() || isInspectorTabActive();
    const isBackgroundTabActive = (): boolean => activeTab === 'background';
    const getSelectableHandles = (): readonly TestWorldEditorHandle[] => {
        const handles = getHandles();
        if (isNpcTabActive()) {
            return handles.filter((entry) => entry.type === 'npc');
        }
        if (isObjectsTabActive()) {
            return handles.filter((entry) => entry.type !== 'npc');
        }
        return handles;
    };

    const getBackgroundHandles = (): BackgroundEditorHandle[] => {
        const background = worldRuntime.getConfig().background;
        if (!background) {
            return [];
        }

        const handles: BackgroundEditorHandle[] = [];
        if (background.staticImage) {
            const staticImage = cloneStaticBackgroundImage(background.staticImage);
            handles.push({
                id: 'static',
                label: 'Static',
                bounds: {
                    x: staticImage.x ?? 0,
                    y: staticImage.y ?? 0,
                    width: staticImage.width ?? 1600,
                    height: staticImage.height ?? 900
                }
            });
        }

        background.layers?.slice(0, EDITOR_BACKGROUND_LAYER_COUNT).forEach((layer, index) => {
            const clonedLayer = cloneBackgroundLayer(layer, index);
            handles.push({
                id: `layer_${index + 1}` as BackgroundSelectionId,
                label: `Parallax ${index + 1}`,
                bounds: {
                    x: clonedLayer.x ?? 0,
                    y: clonedLayer.y,
                    width: clonedLayer.width ?? 1920,
                    height: clonedLayer.height
                }
            });
        });

        return handles;
    };

    const getSelectedBackgroundHandle = (): BackgroundEditorHandle | null => {
        if (!selectedBackgroundId) {
            return null;
        }
        return getBackgroundHandles().find((entry) => entry.id === selectedBackgroundId) ?? null;
    };

    const buildSidebarState = (): TestWorldEditorSidebarState => {
        const config = worldRuntime.getConfig();
        const selectedRootId = getSelectedRootId();
        const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === selectedRootId)?.type ?? null;
        const npcItems = worldRuntime.getEditorObjects()
            .filter((entry) => entry.type === 'npc')
            .map((entry) => ({
                id: entry.id,
                label: entry.label,
                type: entry.type,
                locked: entry.locked,
                selected: entry.id === selectedRootId
            }));
        return {
            visible: active,
            search: searchTerm,
            status,
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            levelId,
            pendingPlacementType,
            levelSections: buildLevelSections(config, getCampaignLevelSummaries()),
            backgroundSections: buildBackgroundSections(config),
            palette: TEST_WORLD_EDITOR_PALETTE,
            objectItems: worldRuntime.getEditorObjects()
                .filter((entry) => entry.type !== 'npc')
                .filter((entry) => {
                    const haystack = `${entry.label} ${entry.type}`.toLowerCase();
                    return searchTerm.trim().length === 0 || haystack.includes(searchTerm.trim().toLowerCase());
                })
                .map((entry) => ({
                    id: entry.id,
                    label: entry.label,
                    type: entry.type,
                    locked: entry.locked,
                    selected: entry.id === selectedRootId
                })),
            npcItems,
            inspectorId: selectedRootId,
            inspectorType: selectedType,
            inspectorSections: buildInspectorSections(config, selectedRootId, selectedType),
            npcInspectorId: selectedType === 'npc' ? selectedRootId : null,
            npcInspectorSections: buildNpcInspectorSections(config, selectedType === 'npc' ? selectedRootId : null),
            selectedLocked: getSelectedHandle()?.isLocked() ?? false
        };
    };

    const sidebar = new TestWorldEditorSidebar(appRoot, {
        onSaveDraft: () => {
            saveDraftNow();
            setStatus('draft saved');
        },
        onCreateLevel: () => {
            saveDraftNow();
            const createdLevel = createCampaignLevel();
            saveTestWorldEditorDraft(createdLevel.meta.id, createdLevel);
            scene.scene.restart({
                levelId: createdLevel.meta.id,
                editorOpen: active
            });
        },
        onDeleteLevel: () => {
            const levelSummaries = getCampaignLevelSummaries();
            if (levelSummaries.length <= 1) {
                setStatus('cannot delete the last remaining level');
                return;
            }
            const confirmed = window.confirm(`Delete level '${levelId}'? This cannot be undone.`);
            if (!confirmed) {
                return;
            }

            const deleted = deleteCampaignLevel(levelId);
            if (!deleted) {
                setStatus('failed to delete level');
                return;
            }

            scene.scene.restart({
                levelId: deleted.switchedToLevelId,
                editorOpen: active
            });
        },
        onExportJson: () => {
            const blob = new Blob([JSON.stringify(worldRuntime.getConfig(), null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${levelId}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('exported json');
        },
        onImportJson: (jsonText) => {
            const parsed = parseTestWorldConfigJson(jsonText, { fallbackConfig: defaultConfig });
            if (parsed.config === null) {
                setStatus(`import failed: ${parsed.error ?? 'invalid json'}`);
                return;
            }
            pushUndoSnapshot();
            worldRuntime.setConfig(parsed.config);
            syncCampaignLevelHeader(parsed.config);
            syncCameraBoundsToWorld();
            redoStack.length = 0;
            selectRoot(parsed.config.finish?.id ?? 'player_spawn');
            onLevelConfigChanged?.(worldRuntime.getConfig());
            markConfigDirty();
            setStatus('imported json');
        },
        onResetDefault: () => {
            const resetConfig = createDefaultTestWorldConfig(defaultConfig);
            pushUndoSnapshot();
            worldRuntime.setConfig(resetConfig);
            syncCampaignLevelHeader(resetConfig);
            syncCameraBoundsToWorld();
            redoStack.length = 0;
            selectRoot('player_spawn');
            onLevelConfigChanged?.(worldRuntime.getConfig());
            markConfigDirty();
            setStatus('reset to default');
        },
        onClearSavedDraft: () => {
            clearTestWorldEditorDraft(levelId);
            setStatus('saved draft cleared');
        },
        onCreateObject: (type) => {
            if (type === 'finish' && worldRuntime.getConfig().finish) {
                selectRoot(worldRuntime.getConfig().finish?.id ?? null);
                setStatus('finish already exists');
                return;
            }
            pendingPlacementType = type;
            pointerDragState = null;
            syncSidebar();
            setStatus(`placing ${type}: click scene to place, Esc or RMB to cancel`);
        },
        onSearchChange: (search) => {
            searchTerm = search;
            syncSidebar();
        },
        onSelectObject: (id) => {
            pendingPlacementType = null;
            selectRoot(id);
            const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === id)?.type ?? null;
            if (isNpcTabActive()) {
                activeTab = 'npc';
            } else {
                activeTab = selectedType === 'npc' ? 'npc' : 'inspector';
            }
            focusTarget(id);
        },
        onTabChanged: (tabId) => {
            activeTab = tabId;
            pointerDragState = null;
            if (tabId === 'background') {
                pendingPlacementType = null;
                selectedHandleId = null;
            } else if (tabId !== 'background') {
                selectedBackgroundId = null;
            }
            syncSidebar();
        },
        onDuplicateSelected: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            pushUndoSnapshot();
            const duplicatedId = worldRuntime.duplicateObject(rootId);
            redoStack.length = 0;
            selectRoot(duplicatedId);
            markConfigDirty();
        },
        onDeleteSelected: () => {
            deleteSelected();
        },
        onToggleSelectedLock: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            const nextLocked = !(getSelectedHandle()?.isLocked() ?? false);
            worldRuntime.setObjectLocked(rootId, nextLocked);
            markConfigDirty();
            setStatus(nextLocked ? 'locked' : 'unlocked');
        },
        onLevelFieldChange: (key, value) => {
            if (key === 'switchLevelId') {
                const nextLevelId = String(value).trim();
                if (!nextLevelId || nextLevelId === levelId) {
                    return;
                }
                saveDraftNow();
                scene.scene.restart({
                    levelId: nextLevelId,
                    editorOpen: true
                });
                return;
            }

            const config = worldRuntime.getConfig();
            if (key === 'displayName' && typeof value === 'string') {
                pushUndoSnapshot();
                config.meta.displayName = value.trim() || config.meta.displayName;
                worldRuntime.setConfig(config);
                player.refreshWorldGeometryState();
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                return;
            }
            if ((key === 'worldWidth' || key === 'worldHeight') && typeof value === 'number') {
                pushUndoSnapshot();
                if (key === 'worldWidth') {
                    config.worldBounds.width = value;
                } else {
                    config.worldBounds.height = value;
                }
                worldRuntime.setConfig(config);
                player.refreshWorldGeometryState();
                syncCameraBoundsToWorld();
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                setStatus('world bounds updated');
                return;
            }
            if (key === 'nextLevelId') {
                pushUndoSnapshot();
                config.nextLevelId = typeof value === 'string' && value.length > 0 ? value : null;
                worldRuntime.setConfig(config);
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty();
                return;
            }
            pushUndoSnapshot();
            if (applyBackgroundLevelField(config, key as BackgroundLevelFieldKey, value)) {
                worldRuntime.setConfig(config);
                syncCampaignLevelHeader(config);
                redoStack.length = 0;
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({
                    refreshGeometry: false,
                    syncSidebar: false
                });
                return;
            }
        },
        onInspectorFieldChange: (key, value) => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            if (key === 'directionX') {
                value = Number(value);
            }
            if (inspectorColorKeys.has(key)) {
                worldRuntime.patchObjectColors(rootId, { [key]: value });
            } else {
                worldRuntime.patchObjectFields(rootId, { [key]: value });
            }
            markConfigDirty();
        }
    });

    const syncSidebar = (): void => {
        if (destroyed) {
            return;
        }
        sidebar.setState(buildSidebarState());
    };

    const syncCameraBoundsToWorld = (): void => {
        const worldBounds = worldRuntime.getWorldBounds();
        const camera = scene.cameras.main;
        camera.setBounds(0, 0, worldBounds.width, worldBounds.height);
        const maxScrollX = Math.max(0, worldBounds.width - (camera.width / camera.zoom));
        const maxScrollY = Math.max(0, worldBounds.height - (camera.height / camera.zoom));
        camera.setScroll(
            Math.max(0, Math.min(camera.scrollX, maxScrollX)),
            Math.max(0, Math.min(camera.scrollY, maxScrollY))
        );
    };

    const cancelPlacementMode = (): void => {
        if (!pendingPlacementType) {
            return;
        }
        pendingPlacementType = null;
        syncSidebar();
        setStatus('placement cancelled');
    };

    const placePendingObject = (pointer: Input.Pointer): void => {
        if (!pendingPlacementType) {
            return;
        }
        const placementType = pendingPlacementType;
        const preview = buildPlacementPreview(placementType, pointer.worldX, pointer.worldY);
        const worldX = preview?.anchorX ?? pointer.worldX;
        const worldY = preview?.anchorY ?? pointer.worldY;
        pushUndoSnapshot();
        const createdId = worldRuntime.createObject(placementType, worldX, worldY);
        redoStack.length = 0;
        pendingPlacementType = null;
        selectRoot(createdId);
        markConfigDirty();
        if (createdId) {
            setStatus(`placed ${createdId}`);
        } else {
            setStatus(`failed to place ${placementType}`);
        }
    };

    const pushUndoSnapshot = (): void => {
        undoStack.push(worldRuntime.getConfig());
        if (undoStack.length > 100) {
            undoStack.shift();
        }
    };

    const scheduleAutosave = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
        }
        autosaveTimer = window.setTimeout(() => {
            saveDraftNow();
        }, DRAFT_AUTOSAVE_DELAY_MS);
    };

    const saveDraftNow = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        saveTestWorldEditorDraft(levelId, worldRuntime.getConfig());
    };

    const markConfigDirty = (
        options: {
            refreshGeometry?: boolean;
            syncSidebar?: boolean;
        } = {}
    ): void => {
        if (options.refreshGeometry ?? true) {
            player.refreshWorldGeometryState();
        }
        scheduleAutosave();
        if (options.syncSidebar ?? true) {
            syncSidebar();
        }
    };

    const setStatus = (message: string): void => {
        if (destroyed) {
            return;
        }
        status = message;
        syncSidebar();
    };

    const selectRoot = (rootId: string | null): void => {
        if (!rootId) {
            selectedHandleId = null;
        } else {
            const nextHandle = getHandles().find((entry) => entry.rootId === rootId && entry.part === 'main')
                ?? getHandles().find((entry) => entry.rootId === rootId)
                ?? null;
            selectedHandleId = nextHandle?.id ?? null;
            const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === rootId)?.type ?? null;
            if (selectedType === 'npc' && activeTab !== 'background' && activeTab !== 'level' && activeTab !== 'objects') {
                activeTab = 'npc';
            }
            if (activeTab === 'npc' && selectedType !== 'npc') {
                selectedHandleId = null;
            }
        }
        syncSidebar();
    };

    const snapValue = (value: number): number => {
        if (!gridEnabled || gridSize <= 1) {
            return value;
        }
        return Math.round(value / gridSize) * gridSize;
    };

    const boundsToEdges = (bounds: TestWorldEditorBounds): TestWorldEditorEdges => ({
        left: bounds.x - (bounds.width * 0.5),
        right: bounds.x + (bounds.width * 0.5),
        top: bounds.y - (bounds.height * 0.5),
        bottom: bounds.y + (bounds.height * 0.5)
    });

    const edgesToBounds = (edges: TestWorldEditorEdges): TestWorldEditorBounds => ({
        x: (edges.left + edges.right) * 0.5,
        y: (edges.top + edges.bottom) * 0.5,
        width: Math.max(MIN_EDITOR_RECT_SIZE, edges.right - edges.left),
        height: Math.max(MIN_EDITOR_RECT_SIZE, edges.bottom - edges.top)
    });

    const snapMoveAxis = (min: number, max: number): { min: number; max: number } => {
        if (!gridEnabled || gridSize <= 1) {
            return { min, max };
        }

        const size = max - min;
        const snappedMin = snapValue(min);
        const snappedMax = snapValue(max);
        const minError = Math.abs(snappedMin - min);
        const maxError = Math.abs(snappedMax - max);
        if (minError <= maxError) {
            return {
                min: snappedMin,
                max: snappedMin + size
            };
        }

        return {
            min: snappedMax - size,
            max: snappedMax
        };
    };

    const snapMoveBounds = (bounds: TestWorldEditorBounds): TestWorldEditorBounds => {
        const edges = boundsToEdges(bounds);
        const horizontal = snapMoveAxis(edges.left, edges.right);
        const vertical = snapMoveAxis(edges.top, edges.bottom);
        return edgesToBounds({
            left: horizontal.min,
            right: horizontal.max,
            top: vertical.min,
            bottom: vertical.max
        });
    };

    const snapResizeBounds = (
        bounds: TestWorldEditorBounds,
        handle: ResizeHandle,
        dx: number,
        dy: number
    ): TestWorldEditorBounds => {
        const edges = boundsToEdges(bounds);
        const nextEdges = { ...edges };

        if (handle === 'nw' || handle === 'sw') {
            nextEdges.left = edges.left + dx;
            if (gridEnabled && gridSize > 1) {
                nextEdges.left = snapValue(nextEdges.left);
            }
            nextEdges.left = Math.min(nextEdges.left, edges.right - MIN_EDITOR_RECT_SIZE);
        } else {
            nextEdges.right = edges.right + dx;
            if (gridEnabled && gridSize > 1) {
                nextEdges.right = snapValue(nextEdges.right);
            }
            nextEdges.right = Math.max(nextEdges.right, edges.left + MIN_EDITOR_RECT_SIZE);
        }

        if (handle === 'nw' || handle === 'ne') {
            nextEdges.top = edges.top + dy;
            if (gridEnabled && gridSize > 1) {
                nextEdges.top = snapValue(nextEdges.top);
            }
            nextEdges.top = Math.min(nextEdges.top, edges.bottom - MIN_EDITOR_RECT_SIZE);
        } else {
            nextEdges.bottom = edges.bottom + dy;
            if (gridEnabled && gridSize > 1) {
                nextEdges.bottom = snapValue(nextEdges.bottom);
            }
            nextEdges.bottom = Math.max(nextEdges.bottom, edges.top + MIN_EDITOR_RECT_SIZE);
        }

        return edgesToBounds(nextEdges);
    };

    const getPlacementAnchorPart = (type: TestWorldEditorObjectType): TestWorldEditorSelectionPart => {
        return type === 'triggerPlatform' ? 'platform' : 'main';
    };

    const buildPlacementPreview = (type: TestWorldEditorObjectType, anchorX: number, anchorY: number): TestWorldPlacementPreview | null => {
        if (type === 'playerSpawn') {
            const spawnBounds = snapMoveBounds({
                x: anchorX,
                y: anchorY,
                width: worldRuntime.getConfig().playerSpawn.width,
                height: worldRuntime.getConfig().playerSpawn.height
            });
            return {
                anchorX: spawnBounds.x,
                anchorY: spawnBounds.y,
                rects: [{
                    bounds: spawnBounds,
                    part: 'main'
                }]
            };
        }

        const adapter = TEST_WORLD_EDITOR_ADAPTERS[type];
        const previewConfig = adapter.createDefault({
            id: '__placement_preview__',
            x: anchorX,
            y: anchorY
        });
        if (!previewConfig) {
            return null;
        }

        const handleDefinitions = adapter.getHandles(previewConfig);
        const anchorHandle = handleDefinitions.find((entry) => entry.part === getPlacementAnchorPart(type)) ?? handleDefinitions[0];
        if (!anchorHandle) {
            return null;
        }

        const rawAnchorBounds = anchorHandle.getBounds(previewConfig);
        const snappedAnchorBounds = snapMoveBounds(rawAnchorBounds);
        const snappedAnchorX = anchorX + (snappedAnchorBounds.x - rawAnchorBounds.x);
        const snappedAnchorY = anchorY + (snappedAnchorBounds.y - rawAnchorBounds.y);
        const snappedConfig = adapter.createDefault({
            id: '__placement_preview__',
            x: snappedAnchorX,
            y: snappedAnchorY
        });
        if (!snappedConfig) {
            return null;
        }

        return {
            anchorX: snappedAnchorX,
            anchorY: snappedAnchorY,
            rects: adapter.getHandles(snappedConfig).map((entry) => ({
                bounds: entry.getBounds(snappedConfig),
                part: entry.part
            }))
        };
    };

    const getCameraCenter = (): { x: number; y: number } => {
        const camera = scene.cameras.main;
        return {
            x: camera.scrollX + (camera.width * 0.5 / camera.zoom),
            y: camera.scrollY + (camera.height * 0.5 / camera.zoom)
        };
    };

    const getResizeHandleAtPointer = (handle: TestWorldEditorHandle, worldX: number, worldY: number): ResizeHandle | null => {
        const bounds = handle.getBounds();
        const points: Array<{ kind: ResizeHandle; x: number; y: number }> = [
            { kind: 'nw', x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'ne', x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'sw', x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
            { kind: 'se', x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
        ];
        return points.find((point) => Math.abs(worldX - point.x) <= RESIZE_HANDLE_SIZE && Math.abs(worldY - point.y) <= RESIZE_HANDLE_SIZE)?.kind ?? null;
    };

    const beginCameraPan = (pointer: Input.Pointer): void => {
        pointerDragState = {
            mode: 'pan',
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            startScrollX: scene.cameras.main.scrollX,
            startScrollY: scene.cameras.main.scrollY
        };
    };

    const beginObjectInteraction = (pointer: Input.Pointer): void => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const selectedHandle = getSelectedHandle();
        if (selectedHandle && !selectedHandle.isLocked()) {
            const resizeHandle = getResizeHandleAtPointer(selectedHandle, worldX, worldY);
            if (resizeHandle) {
                pushUndoSnapshot();
                pointerDragState = {
                    mode: 'resize',
                    handle: resizeHandle,
                    startWorldX: worldX,
                    startWorldY: worldY,
                    startScrollX: 0,
                    startScrollY: 0,
                    initialBounds: selectedHandle.getBounds()
                };
                return;
            }
        }

        const hit = [...getSelectableHandles()].reverse().find((entry) => entry.containsPoint(worldX, worldY)) ?? null;
        if (!hit) {
            selectedHandleId = null;
            syncSidebar();
            return;
        }

        selectedHandleId = hit.id;
        syncSidebar();
        if (hit.isLocked()) {
            return;
        }
        pushUndoSnapshot();
        pointerDragState = {
            mode: 'move',
            startWorldX: worldX,
            startWorldY: worldY,
            startScrollX: 0,
            startScrollY: 0,
            initialBounds: hit.getBounds()
        };
    };

    const patchBackgroundBounds = (targetId: BackgroundSelectionId, bounds: TestWorldEditorBounds): TestWorldConfig => {
        const config = worldRuntime.getConfig();
        if (targetId === 'static') {
            applyBackgroundLevelField(config, 'backgroundStaticX', bounds.x);
            applyBackgroundLevelField(config, 'backgroundStaticY', bounds.y);
            applyBackgroundLevelField(config, 'backgroundStaticWidth', bounds.width);
            applyBackgroundLevelField(config, 'backgroundStaticHeight', bounds.height);
            return config;
        }

        const layerNumber = targetId === 'layer_1' ? 1 : 2;
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}X`, bounds.x);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Y`, bounds.y);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Width`, bounds.width);
        applyBackgroundLevelField(config, `backgroundLayer${layerNumber}Height`, bounds.height);
        return config;
    };

    const beginBackgroundInteraction = (pointer: Input.Pointer): void => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const selectedBackgroundHandle = getSelectedBackgroundHandle();
        if (selectedBackgroundHandle) {
            const resizeHandle = getResizeHandleAtPointer({
                getBounds: () => selectedBackgroundHandle.bounds
            } as TestWorldEditorHandle, worldX, worldY);
            if (resizeHandle) {
                pushUndoSnapshot();
                pointerDragState = {
                    mode: 'resize',
                    handle: resizeHandle,
                    startWorldX: worldX,
                    startWorldY: worldY,
                    startScrollX: 0,
                    startScrollY: 0,
                    initialBounds: selectedBackgroundHandle.bounds
                };
                return;
            }
        }

        const hit = [...getBackgroundHandles()].reverse().find((entry) => {
            const bounds = entry.bounds;
            const left = bounds.x - (bounds.width * 0.5);
            const right = bounds.x + (bounds.width * 0.5);
            const top = bounds.y - (bounds.height * 0.5);
            const bottom = bounds.y + (bounds.height * 0.5);
            return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
        }) ?? null;
        if (!hit) {
            selectedBackgroundId = null;
            syncSidebar();
            return;
        }

        selectedBackgroundId = hit.id;
        syncSidebar();
        pushUndoSnapshot();
        pointerDragState = {
            mode: 'move',
            startWorldX: worldX,
            startWorldY: worldY,
            startScrollX: 0,
            startScrollY: 0,
            initialBounds: hit.bounds
        };
    };

    const applyPointerDrag = (): void => {
        if (!pointerDragState) {
            return;
        }
        const pointer = scene.input.activePointer;
        if (!pointer.isDown) {
            return;
        }
        if (pointerDragState.mode === 'pan') {
            scene.cameras.main.scrollX = pointerDragState.startScrollX - (pointer.worldX - pointerDragState.startWorldX);
            scene.cameras.main.scrollY = pointerDragState.startScrollY - (pointer.worldY - pointerDragState.startWorldY);
            return;
        }

        if (!pointerDragState.initialBounds) {
            return;
        }
        const dx = pointer.worldX - pointerDragState.startWorldX;
        const dy = pointer.worldY - pointerDragState.startWorldY;
        let nextBounds = { ...pointerDragState.initialBounds };
        if (pointerDragState.mode === 'move') {
            nextBounds.x += dx;
            nextBounds.y += dy;
            nextBounds = snapMoveBounds(nextBounds);
        } else {
            nextBounds = snapResizeBounds(pointerDragState.initialBounds, pointerDragState.handle ?? 'se', dx, dy);
        }

            if (isBackgroundTabActive()) {
                const selectedBackgroundHandle = getSelectedBackgroundHandle();
                if (!selectedBackgroundHandle) {
                    return;
                }
                const config = patchBackgroundBounds(selectedBackgroundHandle.id, nextBounds);
                worldRuntime.setConfig(config);
                onLevelConfigChanged?.(worldRuntime.getConfig());
                markConfigDirty({ refreshGeometry: false });
                return;
            }

        const selectedHandle = getSelectedHandle();
        if (!selectedHandle) {
            return;
        }
        worldRuntime.patchObjectBounds(selectedHandle.id, nextBounds);
        markConfigDirty();
    };

    const deleteSelected = (): void => {
        const rootId = getSelectedRootId();
        if (!rootId || rootId === 'player_spawn') {
            return;
        }
        pushUndoSnapshot();
        worldRuntime.removeObject(rootId);
        redoStack.length = 0;
        selectedHandleId = null;
        markConfigDirty();
        setStatus(`deleted ${rootId}`);
    };

    const focusTarget = (id: string): void => {
        const point = worldRuntime.focusObjectPoint(id);
        if (!point) {
            return;
        }
        scene.cameras.main.centerOn(point.x, point.y);
    };

    const captureGameplayCameraSnapshot = (): EditorCameraSnapshot => {
        const camera = scene.cameras.main;
        return {
            scrollX: camera.scrollX,
            scrollY: camera.scrollY,
            zoom: camera.zoom
        };
    };

    const syncEditorPreviewCameraBasis = (): void => {
        onEditorPreviewCameraBasisChanged?.(
            active && gameplayCameraSnapshot
                ? {
                    scrollX: gameplayCameraSnapshot.scrollX,
                    scrollY: gameplayCameraSnapshot.scrollY,
                    zoom: gameplayCameraSnapshot.zoom
                }
                : null
        );
    };

    const toggleEditor = (): void => {
        if (destroyed) {
            return;
        }
        active = !active;
        overlayText.setVisible(active);
        if (active) {
            gameplayCameraSnapshot = captureGameplayCameraSnapshot();
            scene.cameras.main.stopFollow();
            syncEditorPreviewCameraBasis();
            setStatus('editor mode on');
        } else {
            pointerDragState = null;
            pendingPlacementType = null;
            const worldBounds = worldRuntime.getWorldBounds();
            const camera = scene.cameras.main;
            if (gameplayCameraSnapshot) {
                camera.setZoom(gameplayCameraSnapshot.zoom);
            }
            setupBaselineFollowCamera(scene, player.arcadeBodyObject, {
                width: worldBounds.width,
                height: worldBounds.height
            });
            gameplayCameraSnapshot = null;
            syncEditorPreviewCameraBasis();
            setStatus('editor mode off');
        }
        syncSidebar();
    };

    if (initialOpen) {
        toggleEditor();
    }

    const getWorldPointFromClientPosition = (clientX: number, clientY: number): { x: number; y: number } | null => {
        const canvas = scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
        return scene.cameras.main.getWorldPoint(canvasX, canvasY);
    };

    const handleCanvasPointerDown = (event: PointerEvent): void => {
        if (!active) {
            return;
        }

        const worldPoint = getWorldPointFromClientPosition(event.clientX, event.clientY);
        if (!worldPoint) {
            return;
        }

        const pointer = scene.input.activePointer;
        pointer.worldX = worldPoint.x;
        pointer.worldY = worldPoint.y;

        if (event.button === 2) {
            event.preventDefault();
            cancelPlacementMode();
            return;
        }
        if (pendingPlacementType && event.button === 0) {
            placePendingObject(pointer);
            return;
        }
        if (event.button === 1 || (event.button === 0 && spaceKey.isDown)) {
            beginCameraPan(pointer);
            return;
        }
        if (event.button === 0) {
            if (isBackgroundTabActive()) {
                beginBackgroundInteraction(pointer);
                return;
            }
            if (isObjectInteractionTabActive()) {
                beginObjectInteraction(pointer);
            }
        }
    };

    const handlePointerUp = (): void => {
        pointerDragState = null;
    };

    const handleWheel = (_pointer: Input.Pointer, _gameObjects: unknown, _dx: number, dy: number): void => {
        if (!active) {
            return;
        }
        const camera = scene.cameras.main;
        camera.setZoom(Math.max(0.25, Math.min(2.5, camera.zoom - (Math.sign(dy) * ZOOM_STEP))));
    };

    scene.input.on('pointerup', handlePointerUp);
    scene.input.on('wheel', handleWheel);
    scene.game.canvas.addEventListener('pointerdown', handleCanvasPointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        onEditorPreviewCameraBasisChanged?.(null);
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        scene.input.off('pointerup', handlePointerUp);
        scene.input.off('wheel', handleWheel);
        scene.game.canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
        window.removeEventListener('pointerup', handlePointerUp);
        selectionGraphics.destroy();
        placementGraphics.destroy();
        gridGraphics.destroy();
        boundsGraphics.destroy();
        overlayText.destroy();
        backgroundSelectionText.destroy();
        sidebar.destroy();
    };

    scene.events.once('shutdown', destroy);
    scene.events.once('destroy', destroy);

    syncSidebar();

    return {
        update: (deltaMs: number): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleEditor();
            }
            if (!active) {
                selectionGraphics.clear();
                placementGraphics.clear();
                gridGraphics.clear();
                boundsGraphics.clear();
                overlayText.setVisible(false);
                backgroundSelectionText.setVisible(false);
                return;
            }

            const domTextInputFocused = isDomTextInputFocused();
            overlayText.setText([
                'F2 toggle  Del delete  Ctrl+D duplicate  Ctrl+Z/Y undo redo',
                pendingPlacementType
                    ? `Placement ${pendingPlacementType}: LMB place  Esc/RMB cancel  wheel zoom`
                    : 'LMB select/move  drag corners resize  wheel zoom  middle or Space+drag pan',
                `Arrows pan camera  G grid  1/2/3/4 = ${GRID_SIZES.join('/')}  F focus  P spawn`
            ].join('\n'));

            if (!domTextInputFocused) {
                digitKeys.forEach((key, index) => {
                    if (Input.Keyboard.JustDown(key)) {
                        gridSize = GRID_SIZES[index] ?? gridSize;
                        setStatus(`grid ${gridSize}`);
                    }
                });
                if (Input.Keyboard.JustDown(gridKey)) {
                    gridEnabled = !gridEnabled;
                    setStatus(gridEnabled ? 'grid on' : 'grid off');
                }
                if (Input.Keyboard.JustDown(cancelPlacementKey)) {
                    cancelPlacementMode();
                }
                if (!pendingPlacementType && (Input.Keyboard.JustDown(deleteKey) || Input.Keyboard.JustDown(backspaceKey))) {
                    deleteSelected();
                }
                if (!pendingPlacementType && ctrlKey.isDown && Input.Keyboard.JustDown(duplicateKey)) {
                    const rootId = getSelectedRootId();
                    if (rootId) {
                        pushUndoSnapshot();
                        const duplicatedId = worldRuntime.duplicateObject(rootId);
                        redoStack.length = 0;
                        selectRoot(duplicatedId);
                        markConfigDirty();
                    }
                }
                if (ctrlKey.isDown && Input.Keyboard.JustDown(undoKey) && undoStack.length > 0) {
                    const previous = undoStack.pop();
                    if (previous) {
                        redoStack.push(worldRuntime.getConfig());
                        worldRuntime.setConfig(previous);
                        syncCameraBoundsToWorld();
                        onLevelConfigChanged?.(worldRuntime.getConfig());
                        syncSidebar();
                    }
                }
                if (ctrlKey.isDown && Input.Keyboard.JustDown(redoKey) && redoStack.length > 0) {
                    const next = redoStack.pop();
                    if (next) {
                        undoStack.push(worldRuntime.getConfig());
                        worldRuntime.setConfig(next);
                        syncCameraBoundsToWorld();
                        onLevelConfigChanged?.(worldRuntime.getConfig());
                        syncSidebar();
                    }
                }
                if (!pendingPlacementType && Input.Keyboard.JustDown(focusKey)) {
                    if (isBackgroundTabActive()) {
                        const backgroundHandle = getSelectedBackgroundHandle();
                        if (backgroundHandle) {
                            scene.cameras.main.centerOn(backgroundHandle.bounds.x, backgroundHandle.bounds.y);
                        }
                    } else if (isObjectInteractionTabActive()) {
                        const rootId = getSelectedRootId();
                        if (rootId) {
                            focusTarget(rootId);
                        }
                    }
                }
                if (!pendingPlacementType && Input.Keyboard.JustDown(focusSpawnKey)) {
                    focusTarget('player_spawn');
                }
            }

            const camera = scene.cameras.main;
            const panStep = (CAMERA_PAN_SPEED * deltaMs) / 1000;
            if (!domTextInputFocused) {
                if (leftKey.isDown) {
                    camera.scrollX -= panStep;
                }
                if (rightKey.isDown) {
                    camera.scrollX += panStep;
                }
                if (upKey.isDown) {
                    camera.scrollY -= panStep;
                }
                if (downKey.isDown) {
                    camera.scrollY += panStep;
                }
            }

            applyPointerDrag();
            const worldBounds = worldRuntime.getWorldBounds();
            drawWorldBoundsOverlay(boundsGraphics, camera, worldBounds);
            drawGrid(gridGraphics, camera, worldBounds, gridEnabled ? gridSize : 0);
            const selectedBackgroundHandle = getSelectedBackgroundHandle();
            drawSelection(
                selectionGraphics,
                isBackgroundTabActive()
                    ? (selectedBackgroundHandle
                        ? ({
                            getBounds: () => selectedBackgroundHandle.bounds
                        } as TestWorldEditorHandle)
                        : null)
                    : getSelectedHandle(),
                isBackgroundTabActive() ? 0x8cffd1 : 0xffeb3b,
                isBackgroundTabActive() ? 0x8cffd1 : 0xffeb3b
            );
            if (isBackgroundTabActive() && selectedBackgroundHandle) {
                const bounds = selectedBackgroundHandle.bounds;
                backgroundSelectionText.setText(`Background: ${selectedBackgroundHandle.label}`);
                backgroundSelectionText.setPosition(
                    bounds.x - (bounds.width * 0.5),
                    bounds.y - (bounds.height * 0.5) - 24
                );
                backgroundSelectionText.setVisible(true);
            } else {
                backgroundSelectionText.setVisible(false);
            }
            drawPlacementPreview(
                placementGraphics,
                camera,
                pendingPlacementType,
                scene.input.activePointer,
                (type, worldX, worldY) => buildPlacementPreview(type, worldX, worldY)
            );
        },
        isActive: (): boolean => active,
        open: (): void => {
            if (destroyed || active) {
                return;
            }
            toggleEditor();
        },
        close: (): void => {
            if (destroyed || !active) {
                return;
            }
            toggleEditor();
        },
        destroy
    };
};

const drawSelection = (
    graphics: Phaser.GameObjects.Graphics,
    handle: TestWorldEditorHandle | null,
    strokeColor: number = 0xffeb3b,
    fillColor: number = 0xffeb3b
): void => {
    graphics.clear();
    if (!handle) {
        return;
    }
    const bounds = handle.getBounds();
    graphics.lineStyle(2, strokeColor, 1);
    graphics.strokeRect(bounds.x - (bounds.width * 0.5), bounds.y - (bounds.height * 0.5), bounds.width, bounds.height);
    const points = [
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
    ];
    points.forEach((point) => {
        graphics.fillStyle(fillColor, 1);
        graphics.fillRect(point.x - 4, point.y - 4, 8, 8);
    });
};

const drawWorldBoundsOverlay = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    bounds: { width: number; height: number }
): void => {
    graphics.clear();
    const viewLeft = camera.worldView.left;
    const viewRight = camera.worldView.right;
    const viewTop = camera.worldView.top;
    const viewBottom = camera.worldView.bottom;
    const innerLeft = 0;
    const innerTop = 0;
    const innerRight = bounds.width;
    const innerBottom = bounds.height;
    const visibleInnerTop = Math.max(viewTop, innerTop);
    const visibleInnerBottom = Math.min(viewBottom, innerBottom);

    graphics.fillStyle(0x041017, 0.22);
    if (viewTop < innerTop) {
        graphics.fillRect(viewLeft, viewTop, viewRight - viewLeft, innerTop - viewTop);
    }
    if (viewBottom > innerBottom) {
        graphics.fillRect(viewLeft, innerBottom, viewRight - viewLeft, viewBottom - innerBottom);
    }
    if (viewLeft < innerLeft && visibleInnerBottom > visibleInnerTop) {
        graphics.fillRect(viewLeft, visibleInnerTop, innerLeft - viewLeft, visibleInnerBottom - visibleInnerTop);
    }
    if (viewRight > innerRight && visibleInnerBottom > visibleInnerTop) {
        graphics.fillRect(innerRight, visibleInnerTop, viewRight - innerRight, visibleInnerBottom - visibleInnerTop);
    }

    graphics.lineStyle(3, 0x7ee0ff, 0.95);
    graphics.strokeRect(innerLeft, innerTop, bounds.width, bounds.height);
    graphics.lineStyle(1, 0xb3ecff, 0.5);
    graphics.strokeRect(innerLeft + 2, innerTop + 2, Math.max(0, bounds.width - 4), Math.max(0, bounds.height - 4));
};

const drawGrid = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    bounds: { width: number; height: number },
    gridSize: number
): void => {
    graphics.clear();
    if (gridSize <= 1) {
        return;
    }

    const left = Math.max(0, Math.floor(camera.worldView.left / gridSize) * gridSize);
    const right = Math.min(bounds.width, Math.ceil(camera.worldView.right / gridSize) * gridSize);
    const top = Math.max(0, Math.floor(camera.worldView.top / gridSize) * gridSize);
    const bottom = Math.min(bounds.height, Math.ceil(camera.worldView.bottom / gridSize) * gridSize);
    if (right <= left || bottom <= top) {
        return;
    }

    graphics.lineStyle(1, 0xffffff, 0.08);
    for (let x = left; x <= right; x += gridSize) {
        graphics.moveTo(x, top);
        graphics.lineTo(x, bottom);
    }
    for (let y = top; y <= bottom; y += gridSize) {
        graphics.moveTo(left, y);
        graphics.lineTo(right, y);
    }
    graphics.strokePath();
};

const drawPlacementPreview = (
    graphics: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    pendingPlacementType: TestWorldEditorObjectType | null,
    pointer: Input.Pointer,
    resolvePreview: (type: TestWorldEditorObjectType, worldX: number, worldY: number) => TestWorldPlacementPreview | null
): void => {
    graphics.clear();
    if (!pendingPlacementType || !pointer.withinGame) {
        return;
    }

    const preview = resolvePreview(pendingPlacementType, pointer.worldX, pointer.worldY);
    if (!preview) {
        return;
    }

    const size = PLACEMENT_PREVIEW_SIZE / camera.zoom;
    preview.rects.forEach((entry) => {
        const isPrimary = entry.part === 'main' || entry.part === 'platform';
        const color = isPrimary ? 0x8cffd1 : 0xb8fff0;
        const alpha = isPrimary ? 0.95 : 0.65;
        graphics.lineStyle(2, color, alpha);
        graphics.fillStyle(color, 0.08);
        graphics.fillRect(
            entry.bounds.x - (entry.bounds.width * 0.5),
            entry.bounds.y - (entry.bounds.height * 0.5),
            entry.bounds.width,
            entry.bounds.height
        );
        graphics.strokeRect(
            entry.bounds.x - (entry.bounds.width * 0.5),
            entry.bounds.y - (entry.bounds.height * 0.5),
            entry.bounds.width,
            entry.bounds.height
        );
    });

    graphics.lineStyle(2, 0x8cffd1, 0.95);
    graphics.lineBetween(preview.anchorX - size * 1.4, preview.anchorY, preview.anchorX + size * 1.4, preview.anchorY);
    graphics.lineBetween(preview.anchorX, preview.anchorY - size * 1.4, preview.anchorX, preview.anchorY + size * 1.4);
};

const buildInspectorSections = (
    config: TestWorldConfig,
    rootId: string | null,
    type: TestWorldEditorObjectType | null
): TestWorldEditorSidebarSection[] => {
    if (!rootId || !type) {
        return [];
    }

    if (type === 'playerSpawn') {
        return [{
            title: 'Transform',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: config.playerSpawn.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: config.playerSpawn.y, step: 1 },
                { key: 'width', label: 'Width', input: 'number', value: config.playerSpawn.width, min: 8, step: 1 },
                { key: 'height', label: 'Height', input: 'number', value: config.playerSpawn.height, min: 8, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: config.playerSpawn.fillColor ?? 0x81d4fa },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: config.playerSpawn.strokeColor ?? 0x0277bd }
            ]
        }];
    }
    if (type === 'finish') {
        const entry = config.finish?.id === rootId ? config.finish : null;
        return entry ? [{
            title: 'Finish',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                { key: 'width', label: 'Width', input: 'number', value: entry.width, min: 8, step: 1 },
                { key: 'height', label: 'Height', input: 'number', value: entry.height, min: 8, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0x99ff99 },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0x00aa66 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }

    const findById = <T extends { id: string }>(items: readonly T[]): T | null => items.find((entry) => entry.id === rootId) ?? null;
    const rectSection = (entry: { x: number; y: number; width: number; height: number; fillColor?: number; strokeColor?: number }): TestWorldEditorSidebarSection => ({
        title: 'Bounds',
        fields: [
            { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
            { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
            { key: 'width', label: 'Width', input: 'number', value: entry.width, min: 8, step: 1 },
            { key: 'height', label: 'Height', input: 'number', value: entry.height, min: 8, step: 1 },
            { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0x999999 },
            { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffffff }
        ]
    });
    const npcSections = (entry: NonNullable<ReturnType<typeof findById<TestWorldConfig['npcs'][number]>>>): TestWorldEditorSidebarSection[] => {
        return [
            {
                title: 'NPC',
                fields: [
                    { key: 'x', label: 'Author X', input: 'number', value: entry.x, step: 1 },
                    { key: 'y', label: 'Author Y', input: 'number', value: entry.y, step: 1 },
                    {
                        key: 'profileId',
                        label: 'Profile',
                        input: 'select',
                        value: entry.profileId,
                        options: [
                            { value: 'passive_observer', label: 'passive_observer' },
                            { value: 'enemy_sentry', label: 'enemy_sentry' }
                        ]
                    },
                    {
                        key: 'facing',
                        label: 'Facing',
                        input: 'select',
                        value: entry.facing ?? 'right',
                        options: [
                            { value: 'right', label: 'Right' },
                            { value: 'left', label: 'Left' }
                        ]
                    }
                ]
            },
            {
                title: 'Behavior',
                fields: [
                    {
                        key: 'passiveMode',
                        label: 'Passive Mode',
                        input: 'select',
                        value: entry.behavior?.passiveMode ?? 'idle',
                        options: [
                            { value: 'idle', label: 'Idle' },
                            { value: 'idle_patrol', label: 'Idle Patrol' }
                        ]
                    },
                    { key: 'patrolDistance', label: 'Patrol Distance', input: 'number', value: entry.behavior?.patrolDistance ?? 64, min: 0, step: 1 },
                    { key: 'moveSpeed', label: 'Move Speed', input: 'number', value: entry.behavior?.moveSpeed ?? 28, min: 0, step: 1 },
                    { key: 'patrolSpeed', label: 'Patrol Speed', input: 'number', value: entry.behavior?.patrolSpeed ?? 34, min: 0, step: 1 },
                    { key: 'idleDurationMs', label: 'Idle Ms', input: 'number', value: entry.behavior?.idleDurationMs ?? 900, min: 0, step: 1 },
                    { key: 'patrolPauseMs', label: 'Patrol Pause Ms', input: 'number', value: entry.behavior?.patrolPauseMs ?? 700, min: 0, step: 1 },
                    { key: 'alertDurationMs', label: 'Alert Ms', input: 'number', value: entry.behavior?.alertDurationMs ?? 450, min: 0, step: 1 },
                    { key: 'senseRadius', label: 'Sense Radius', input: 'number', value: entry.behavior?.senseRadius ?? 150, min: 0, step: 1 },
                    { key: 'chaseSpeed', label: 'Chase Speed', input: 'number', value: entry.behavior?.chaseSpeed ?? 82, min: 0, step: 1 },
                    { key: 'chaseReleaseRadius', label: 'Release Radius', input: 'number', value: entry.behavior?.chaseReleaseRadius ?? 210, min: 0, step: 1 },
                    { key: 'returnSpeed', label: 'Return Speed', input: 'number', value: entry.behavior?.returnSpeed ?? 40, min: 0, step: 1 },
                    { key: 'postTolerance', label: 'Post Tolerance', input: 'number', value: entry.behavior?.postTolerance ?? 4, min: 1, step: 1 }
                ]
            },
            buildVisualOrderSection('npc', entry)
        ];
    };

    if (type === 'surface') {
        const entry = findById(config.surfaces);
        return entry ? [
            rectSection(entry),
            {
                title: 'Surface',
                fields: [
                    {
                        key: 'collisionMode',
                        label: 'Collision',
                        input: 'select',
                        value: entry.collisionMode ?? 'solid',
                        options: [
                            { value: 'solid', label: 'Solid' },
                            { value: 'visual_only', label: 'Visual Only' }
                        ]
                    },
                    {
                        key: 'alpha',
                        label: 'Alpha',
                        input: 'number',
                        value: entry.alpha ?? ((entry.collisionMode ?? 'solid') === 'visual_only' ? 0.45 : 1),
                        min: 0,
                        step: 0.05
                    }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    if (type === 'npc') {
        const entry = findById(config.npcs);
        return entry ? npcSections(entry) : [];
    }
    if (type === 'hazard') {
        const entry = findById(config.hazards);
        return entry ? [rectSection(entry), buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'checkpoint') {
        const entry = findById(config.checkpoints);
        return entry ? [rectSection(entry), {
            title: 'Checkpoint',
            fields: [
                { key: 'respawnX', label: 'Respawn X', input: 'number', value: entry.respawnX, step: 1 },
                { key: 'respawnY', label: 'Respawn Y', input: 'number', value: entry.respawnY, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'movingPlatform') {
        const entry = findById(config.movingPlatforms);
        return entry ? [rectSection(entry), {
            title: 'Platform',
            fields: [
                { key: 'axis', label: 'Axis', input: 'select', value: entry.axis, options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] },
                { key: 'travelDistance', label: 'Travel', input: 'number', value: entry.travelDistance, min: 0, step: 1 },
                { key: 'speed', label: 'Speed', input: 'number', value: entry.speed, min: 0, step: 1 },
                {
                    key: 'initialMotionState',
                    label: 'Initial Motion',
                    input: 'select',
                    value: entry.initialMotionState ?? 'running_loop',
                    options: [
                        { value: 'running_loop', label: 'Running Loop' },
                        { value: 'stopped', label: 'Stopped' },
                        { value: 'run_once', label: 'Run Once' }
                    ]
                }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'dragBox') {
        const entry = findById(config.dragBoxes);
        return entry ? [rectSection(entry), {
            title: 'Drag Box',
            fields: [
                { key: 'targetTriggerPlatformId', label: 'Linked Trigger Id', input: 'text', value: entry.targetTriggerPlatformId ?? '' },
                { key: 'gravityY', label: 'Gravity Y', input: 'number', value: entry.gravityY ?? 2200, min: 0, step: 1 },
                { key: 'mass', label: 'Mass', input: 'number', value: entry.mass ?? 10, min: 1, step: 1 },
                { key: 'pullAcceleration', label: 'Pull Accel', input: 'number', value: entry.pullAcceleration ?? 1400, min: 0, step: 1 },
                { key: 'pullMaxSpeed', label: 'Pull Max Speed', input: 'number', value: entry.pullMaxSpeed ?? 150, min: 0, step: 1 },
                { key: 'dragX', label: 'Drag X', input: 'number', value: entry.dragX ?? 900, min: 0, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'windZone') {
        const entry = findById(config.windZones);
        return entry ? [rectSection(entry), {
            title: 'Wind',
            fields: [
                { key: 'directionX', label: 'Direction', input: 'select', value: String(entry.directionX), options: [{ value: '1', label: 'Right' }, { value: '-1', label: 'Left' }] },
                { key: 'force', label: 'Force', input: 'number', value: entry.force, min: 0, step: 1 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'triangleFlightBreakWall') {
        const entry = findById(config.triangleFlightBreakWalls);
        return entry ? [rectSection(entry), buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'trianglePickup') {
        const entry = findById(config.trianglePickups);
        return entry ? [{
            title: 'Pickup',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                { key: 'radius', label: 'Radius', input: 'number', value: entry.radius, min: 4, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0xfff59d },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffca28 }
            ]
        }, buildVisualOrderSection(type, entry)] : [];
    }
    if (type === 'triggerPlatform') {
        const entry = findById(config.triggerPlatforms);
        return entry ? [
            {
                title: 'Trigger Zone',
                fields: [
                    { key: 'triggerX', label: 'X', input: 'number', value: entry.triggerX, step: 1 },
                    { key: 'triggerY', label: 'Y', input: 'number', value: entry.triggerY, step: 1 },
                    { key: 'triggerWidth', label: 'Width', input: 'number', value: entry.triggerWidth, min: 8, step: 1 },
                    { key: 'triggerHeight', label: 'Height', input: 'number', value: entry.triggerHeight, min: 8, step: 1 },
                    { key: 'triggerFillColor', label: 'Fill', input: 'color', value: entry.triggerFillColor ?? 0xfff59d },
                    { key: 'triggerStrokeColor', label: 'Stroke', input: 'color', value: entry.triggerStrokeColor ?? 0xf9a825 }
                ]
            },
            {
                title: 'Release Zone',
                fields: [
                    { key: 'deactivateTriggerX', label: 'X', input: 'number', value: entry.deactivateTriggerX ?? 0, step: 1 },
                    { key: 'deactivateTriggerY', label: 'Y', input: 'number', value: entry.deactivateTriggerY ?? 0, step: 1 },
                    { key: 'deactivateTriggerWidth', label: 'Width', input: 'number', value: entry.deactivateTriggerWidth ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerHeight', label: 'Height', input: 'number', value: entry.deactivateTriggerHeight ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerFillColor', label: 'Fill', input: 'color', value: entry.deactivateTriggerFillColor ?? 0xffccbc },
                    { key: 'deactivateTriggerStrokeColor', label: 'Stroke', input: 'color', value: entry.deactivateTriggerStrokeColor ?? 0xe64a19 }
                ]
            },
            {
                title: 'Platform',
                fields: [
                    { key: 'platformX', label: 'X', input: 'number', value: entry.platformX, step: 1 },
                    { key: 'platformY', label: 'Y', input: 'number', value: entry.platformY, step: 1 },
                    { key: 'platformWidth', label: 'Width', input: 'number', value: entry.platformWidth, min: 8, step: 1 },
                    { key: 'platformHeight', label: 'Height', input: 'number', value: entry.platformHeight, min: 8, step: 1 },
                    { key: 'platformFillColor', label: 'Fill', input: 'color', value: entry.platformFillColor ?? 0x616161 },
                    { key: 'platformStrokeColor', label: 'Stroke', input: 'color', value: entry.platformStrokeColor ?? 0xb0bec5 },
                    { key: 'activator', label: 'Activator', input: 'select', value: entry.activator ?? 'player', options: [{ value: 'player', label: 'Player' }, { value: 'drag_box', label: 'Drag Box' }] },
                    { key: 'triggerAction', label: 'On Trigger', input: 'select', value: entry.triggerAction ?? 'activate', options: [{ value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' }] },
                    { key: 'deactivateTriggerAction', label: 'On Release Zone', input: 'select', value: entry.deactivateTriggerAction ?? 'deactivate', options: [{ value: 'activate', label: 'Activate' }, { value: 'deactivate', label: 'Deactivate' }] },
                    { key: 'initiallyActive', label: 'Initial Active', input: 'checkbox', value: entry.initiallyActive ?? false }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    if (type === 'triggerVolume') {
        const entry = findById(config.triggerVolumes);
        const enterCommand = entry?.enterCommand ?? null;
        const exitCommand = entry?.exitCommand ?? null;
        return entry ? [
            {
                title: 'Trigger Zone',
                fields: [
                    { key: 'triggerX', label: 'X', input: 'number', value: entry.triggerX, step: 1 },
                    { key: 'triggerY', label: 'Y', input: 'number', value: entry.triggerY, step: 1 },
                    { key: 'triggerWidth', label: 'Width', input: 'number', value: entry.triggerWidth, min: 8, step: 1 },
                    { key: 'triggerHeight', label: 'Height', input: 'number', value: entry.triggerHeight, min: 8, step: 1 },
                    { key: 'triggerFillColor', label: 'Fill', input: 'color', value: entry.triggerFillColor ?? 0xb3e5fc },
                    { key: 'triggerStrokeColor', label: 'Stroke', input: 'color', value: entry.triggerStrokeColor ?? 0x0277bd }
                ]
            },
            {
                title: 'Release Zone',
                fields: [
                    { key: 'deactivateTriggerX', label: 'X', input: 'number', value: entry.deactivateTriggerX ?? 0, step: 1 },
                    { key: 'deactivateTriggerY', label: 'Y', input: 'number', value: entry.deactivateTriggerY ?? 0, step: 1 },
                    { key: 'deactivateTriggerWidth', label: 'Width', input: 'number', value: entry.deactivateTriggerWidth ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerHeight', label: 'Height', input: 'number', value: entry.deactivateTriggerHeight ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerFillColor', label: 'Fill', input: 'color', value: entry.deactivateTriggerFillColor ?? 0xffccbc },
                    { key: 'deactivateTriggerStrokeColor', label: 'Stroke', input: 'color', value: entry.deactivateTriggerStrokeColor ?? 0xe64a19 }
                ]
            },
            {
                title: 'Trigger Logic',
                fields: [
                    { key: 'activator', label: 'Activator', input: 'select', value: entry.activator, options: [{ value: 'player', label: 'Player' }, { value: 'drag_box', label: 'Drag Box' }] },
                    { key: 'sourceIdsCsv', label: 'Source Ids CSV', input: 'text', value: (entry.sourceIds ?? []).join(', ') },
                    { key: 'enterCommandEnabled', label: 'Enter Command', input: 'checkbox', value: enterCommand !== null },
                    { key: 'enterTargetType', label: 'Enter Target Type', input: 'select', value: enterCommand?.targetType ?? 'trigger_platform', options: [{ value: 'trigger_platform', label: 'Trigger Platform' }, { value: 'moving_platform', label: 'Moving Platform' }] },
                    { key: 'enterTargetId', label: 'Enter Target Id', input: 'text', value: enterCommand?.targetId ?? '' },
                    { key: 'enterOperation', label: 'Enter Operation', input: 'select', value: enterCommand?.operation ?? 'set_active', options: [{ value: 'set_active', label: 'Set Active' }, { value: 'set_motion_state', label: 'Set Motion State' }] },
                    { key: 'enterValue', label: 'Enter Value', input: 'select', value: typeof enterCommand?.value === 'boolean' ? String(enterCommand.value) : (enterCommand?.value ?? 'running_loop'), options: [{ value: 'true', label: 'True / Activate' }, { value: 'false', label: 'False / Deactivate' }, { value: 'running_loop', label: 'Running Loop' }, { value: 'stopped', label: 'Stopped' }, { value: 'run_once', label: 'Run Once' }] },
                    { key: 'exitCommandEnabled', label: 'Exit Command', input: 'checkbox', value: exitCommand !== null },
                    { key: 'exitTargetType', label: 'Exit Target Type', input: 'select', value: exitCommand?.targetType ?? 'trigger_platform', options: [{ value: 'trigger_platform', label: 'Trigger Platform' }, { value: 'moving_platform', label: 'Moving Platform' }] },
                    { key: 'exitTargetId', label: 'Exit Target Id', input: 'text', value: exitCommand?.targetId ?? '' },
                    { key: 'exitOperation', label: 'Exit Operation', input: 'select', value: exitCommand?.operation ?? 'set_active', options: [{ value: 'set_active', label: 'Set Active' }, { value: 'set_motion_state', label: 'Set Motion State' }] },
                    { key: 'exitValue', label: 'Exit Value', input: 'select', value: typeof exitCommand?.value === 'boolean' ? String(exitCommand.value) : (exitCommand?.value ?? 'running_loop'), options: [{ value: 'true', label: 'True / Activate' }, { value: 'false', label: 'False / Deactivate' }, { value: 'running_loop', label: 'Running Loop' }, { value: 'stopped', label: 'Stopped' }, { value: 'run_once', label: 'Run Once' }] }
                ]
            },
            buildVisualOrderSection(type, entry)
        ] : [];
    }
    return [];
};

const buildNpcInspectorSections = (
    config: TestWorldConfig,
    rootId: string | null
): TestWorldEditorSidebarSection[] => {
    if (!rootId) {
        return [];
    }
    const entry = config.npcs.find((npc) => npc.id === rootId) ?? null;
    if (!entry) {
        return [];
    }
    return buildInspectorSections(config, rootId, 'npc');
};

const buildLevelSectionsLegacy = (
    config: TestWorldConfig,
    campaignLevels: ReadonlyArray<{ id: string; displayName: string }>
): TestWorldEditorSidebarSection[] => {
    const nextLevelOptions = [
        { value: '', label: 'None' },
        ...campaignLevels
            .filter((entry) => entry.id !== config.meta.id)
            .map((entry) => ({
                value: entry.id,
                label: `${entry.id} — ${entry.displayName}`
            }))
    ];
    const switchLevelOptions = campaignLevels.map((entry) => ({
        value: entry.id,
        label: `${entry.id} — ${entry.displayName}`
    }));

    return [
        {
            title: 'Metadata',
            fields: [
                { key: 'displayName', label: 'Display Name', input: 'text', value: config.meta.displayName },
                { key: 'nextLevelId', label: 'Next Level', input: 'select', value: config.nextLevelId ?? '', options: nextLevelOptions },
                { key: 'switchLevelId', label: 'Open Level', input: 'select', value: config.meta.id, options: switchLevelOptions }
            ]
        },
        {
            title: 'World',
            fields: [
                { key: 'worldWidth', label: 'Width', input: 'number', value: config.worldBounds.width, min: 64, step: 1 },
                { key: 'worldHeight', label: 'Height', input: 'number', value: config.worldBounds.height, min: 64, step: 1 }
            ]
        }
    ];
};

const buildLevelSections = (
    config: TestWorldConfig,
    campaignLevels: ReadonlyArray<{ id: string; displayName: string }>
): TestWorldEditorSidebarSection[] => {
    const nextLevelOptions = [
        { value: '', label: 'None' },
        ...campaignLevels
            .filter((entry) => entry.id !== config.meta.id)
            .map((entry) => ({
                value: entry.id,
                label: `${entry.id} - ${entry.displayName}`
            }))
    ];
    const switchLevelOptions = campaignLevels.map((entry) => ({
        value: entry.id,
        label: `${entry.id} - ${entry.displayName}`
    }));

    return [
        {
            title: 'Metadata',
            fields: [
                { key: 'displayName', label: 'Display Name', input: 'text', value: config.meta.displayName },
                { key: 'nextLevelId', label: 'Next Level', input: 'select', value: config.nextLevelId ?? '', options: nextLevelOptions },
                { key: 'switchLevelId', label: 'Open Level', input: 'select', value: config.meta.id, options: switchLevelOptions }
            ]
        },
        {
            title: 'World',
            fields: [
                { key: 'worldWidth', label: 'Width', input: 'number', value: config.worldBounds.width, min: 64, step: 1 },
                { key: 'worldHeight', label: 'Height', input: 'number', value: config.worldBounds.height, min: 64, step: 1 }
            ]
        }
    ];
};

const buildVisualOrderSection = (
    type: TestWorldEditorObjectType,
    entry: Pick<TestWorldVisualOrderConfig, 'visualLayer' | 'renderOrder'>
): TestWorldEditorSidebarSection => {
    const resolvedLayer = resolveTestWorldVisualLayer(type, entry);
    const effectiveRenderOrder = resolveTestWorldRenderOrder(type, entry);
    const fields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: 'visualLayer',
            label: 'Layer',
            input: 'select',
            value: entry.visualLayer ?? 'default',
            options: TEST_WORLD_VISUAL_LAYER_OPTIONS.map((option) => ({
                value: option.value,
                label: option.value === 'default'
                    ? `${option.label} (${resolvedLayer})`
                    : option.label
            }))
        },
        {
            key: 'renderOrderEnabled',
            label: 'Use Explicit Order',
            input: 'checkbox',
            value: entry.renderOrder !== undefined
        },
        {
            key: 'renderOrder',
            label: 'Render Order',
            input: 'number',
            value: entry.renderOrder ?? effectiveRenderOrder,
            step: 1
        }
    ];

    return {
        title: 'Visual Order',
        fields
    };
};

const buildBackgroundSections = (config: TestWorldConfig): TestWorldEditorSidebarSection[] => {
    const editableBackground = getEditableBackground(config);
    const staticImage = cloneStaticBackgroundImage(editableBackground.staticImage);
    const layers = Array.from({ length: EDITOR_BACKGROUND_LAYER_COUNT }, (_, index) => {
        return cloneBackgroundLayer(editableBackground.layers?.[index], index);
    });

    const sections: TestWorldEditorSidebarSection[] = [
        {
            title: 'Profile',
            fields: [
                {
                    key: 'backgroundColor',
                    label: 'Base Color',
                    input: 'color',
                    value: editableBackground.color ?? EDITOR_FALLBACK_BACKGROUND_COLOR
                }
            ]
        },
        {
            title: 'Static Layer',
            fields: [
                { key: 'backgroundStaticTextureKey', label: 'Texture Key', input: 'text', value: staticImage.textureKey },
                { key: 'backgroundStaticTextureAsset', label: 'Texture Asset', input: 'text', value: staticImage.textureAsset ?? '' },
                { key: 'backgroundStaticFillColor', label: 'Fallback Fill', input: 'color', value: staticImage.fillColor ?? 0x1f2d36 },
                { key: 'backgroundStaticTintColor', label: 'Tint', input: 'color', value: staticImage.tintColor ?? 0xffffff },
                { key: 'backgroundStaticAlpha', label: 'Alpha', input: 'number', value: staticImage.alpha ?? 1, min: 0, step: 0.05 },
                { key: 'backgroundStaticScale', label: 'Editor Scale', input: 'number', value: staticImage.scale ?? 1, min: 0.1, step: 0.1 },
                { key: 'backgroundStaticWidth', label: 'Editor Width', input: 'number', value: staticImage.width ?? 1600, min: 8, step: 1 },
                { key: 'backgroundStaticHeight', label: 'Editor Height', input: 'number', value: staticImage.height ?? 900, min: 8, step: 1 },
                { key: 'backgroundStaticRepeat', label: 'Tile Repeat', input: 'checkbox', value: staticImage.repeat ?? false },
                { key: 'backgroundStaticX', label: 'Editor Center X', input: 'number', value: staticImage.x ?? 0, step: 1 },
                { key: 'backgroundStaticY', label: 'Editor Center Y', input: 'number', value: staticImage.y ?? 0, step: 1 }
            ]
        }
    ];

    layers.forEach((layer, index) => {
        const layerNumber = index + 1;
        sections.push({
            title: `Parallax Layer ${layerNumber}`,
            fields: [
                { key: `backgroundLayer${layerNumber}TextureKey`, label: 'Texture Key', input: 'text', value: layer.textureKey },
                { key: `backgroundLayer${layerNumber}TextureAsset`, label: 'Texture Asset', input: 'text', value: layer.textureAsset ?? '' },
                { key: `backgroundLayer${layerNumber}FillColor`, label: 'Fallback Fill', input: 'color', value: layer.fillColor ?? 0x24343d },
                { key: `backgroundLayer${layerNumber}TintColor`, label: 'Tint', input: 'color', value: layer.tintColor ?? 0xffffff },
                { key: `backgroundLayer${layerNumber}Alpha`, label: 'Alpha', input: 'number', value: layer.alpha ?? 1, min: 0, step: 0.05 },
                { key: `backgroundLayer${layerNumber}Scale`, label: 'Editor Scale', input: 'number', value: layer.scale ?? 1, min: 0.1, step: 0.1 },
                { key: `backgroundLayer${layerNumber}Width`, label: 'Editor Width', input: 'number', value: layer.width ?? 1920, min: 8, step: 1 },
                { key: `backgroundLayer${layerNumber}Repeat`, label: 'Tile Repeat', input: 'checkbox', value: layer.repeat ?? true },
                { key: `backgroundLayer${layerNumber}X`, label: 'Editor Center X', input: 'number', value: layer.x ?? 0, step: 1 },
                { key: `backgroundLayer${layerNumber}Y`, label: 'Editor Center Y', input: 'number', value: layer.y, step: 1 },
                { key: `backgroundLayer${layerNumber}Height`, label: 'Editor Height', input: 'number', value: layer.height, min: 8, step: 1 },
                { key: `backgroundLayer${layerNumber}ScrollFactorX`, label: 'Game Parallax X', input: 'number', value: layer.scrollFactorX, min: 0, step: 0.05 },
                { key: `backgroundLayer${layerNumber}ScrollFactorY`, label: 'Game Parallax Y', input: 'number', value: layer.scrollFactorY ?? layer.scrollFactorX, min: 0, step: 0.05 }
            ]
        });
    });

    return sections;
};
