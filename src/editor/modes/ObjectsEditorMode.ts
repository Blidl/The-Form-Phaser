import Phaser from 'phaser';
import {
    type EditorMode,
    type EditorModeRuntimeContext,
    type EditorPointerEvent
} from '../core/EditorMode';
import type {
    EditorObjectData,
    EditorObjectBoundsData,
    EditorObjectCategory,
    EditorObjectVisualData
} from '../data/EditorObjectData';
import type { ObjectTypeDefinition, ObjectTypeRegistry } from '../data/ObjectTypeRegistry';
import type { ProjectStore } from '../data/ProjectStore';
import type { EditorPanel } from '../ui/EditorPanel';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { isEditorTextInputFocused } from '../../shared/dom_input_focus';
import { ObjectAuthoringService, type UpdateObjectVisualPatch } from '../object-authoring/ObjectAuthoringService';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import { objectDiag } from '../debug/ObjectEditorDiagnostics';
import { getAllLogicScriptAssets } from '../../game/world/runtime/logic_script_registry';
import {
    PLATFORM_MOVE_PING_PONG_COMMAND_TYPE,
    PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE,
    summarizePlatformMovePingPongContract,
    summarizePlatformRotateConstantContract
} from '../../game/world/runtime/platform_command_registry';
import type {
    TestWorldBehaviorScriptsConfig,
    TestWorldConfig,
    TestWorldLogicBindingConfig,
    TestWorldLogicScriptConfig,
    TestWorldLogicScriptRefConfig
} from '../../game/world/runtime/test_world_config';
import type {
    ObjectInteractionTrace,
    SurfaceMoveRuntimeDebugSnapshot
} from '../../game/world/runtime/test_world_runtime';

interface ObjectsEditorModeOptions {
    scene: Phaser.Scene;
    projectStore: ProjectStore;
    objectTypeRegistry: ObjectTypeRegistry;
    onUiChanged: () => void;
    legacyObjectAdapter: LegacyObjectAdapter | null;
}

const CATEGORY_LABELS: Record<EditorObjectCategory, string> = {
    platforms: 'Platforms',
    special: 'Special',
    objects: 'Objects'
};

const CATEGORY_ORDER: readonly EditorObjectCategory[] = ['platforms', 'special', 'objects'];
const GRID_SIZE_OPTIONS = [8, 16, 32, 64];
const LAYER_OPTIONS = [1, 2, 3, 4, 5] as const;
const LAYER_OPTION_LABELS: Readonly<Record<number, string>> = {
    1: 'Layer 1',
    2: 'Layer 2',
    3: 'Layer 3 Default',
    4: 'Layer 4',
    5: 'Layer 5 Debug'
};
const EDITABLE_BOUNDS_FIELDS = ['x', 'y', 'width', 'height', 'rotation'] as const;
type EditableBoundsField = (typeof EDITABLE_BOUNDS_FIELDS)[number];
const EDITABLE_VISUAL_TEXT_FIELDS = ['shaderKey', 'textureKey'] as const;
type EditableVisualTextField = (typeof EDITABLE_VISUAL_TEXT_FIELDS)[number];
const EDITABLE_VISUAL_COLOR_FIELDS = ['fillColor', 'strokeColor'] as const;
type EditableVisualColorField = (typeof EDITABLE_VISUAL_COLOR_FIELDS)[number];
type ColorPickSampleSource = 'renderedPixel' | 'objectVisualFallback' | 'unavailable';
interface ObjectColorPickSample {
    source: ColorPickSampleSource;
    colorSource: 'runtimeVisual' | 'projectStoreEditedVisual' | 'renderedPixel' | 'unavailable';
    sourceObjectId: string | null;
    sourceValue: string | null;
    runtimeValue: string | null;
    projectStoreValue: string | null;
    isProjectStoreDefault: boolean;
    success: boolean;
    reason?: string;
}
const HEX_COLOR_LIKE_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TRANSPARENT_COLOR_VALUE = 'transparent';
const DEFAULT_AUTHORING_FILL_COLOR = '#ffffff';
const DEFAULT_AUTHORING_STROKE_COLOR = '#000000';
const OBJECT_LOGIC_BINDING_DEFAULT_SLOT = 'onInteract';
const DEBUG_OBJECT_BRIDGE = false;
const RESIZE_HANDLE_SIZE = 8;
const RESIZE_HANDLE_HIT_RADIUS = 6;
const MIN_RESIZE_SIZE = 8;
type ResizeHandle =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'right'
    | 'bottom-right'
    | 'bottom'
    | 'bottom-left'
    | 'left';
interface ResizeDragState {
    objectId: string;
    handle: ResizeHandle;
    startBounds: EditorObjectBoundsData;
    startPointerWorld: { x: number; y: number };
}
interface ObjectClipboardData {
    type: string;
    category: EditorObjectCategory;
    bounds: EditorObjectBoundsData;
    visual: EditorObjectVisualData;
    settings: EditorObjectData['settings'];
    actions: EditorObjectData['actions'];
    editor?: EditorObjectData['editor'];
}
type BehaviorScriptField = 'move' | 'rotate' | 'defaultAction';
type BehaviorScriptFieldLabel = 'Move' | 'Rotate' | 'Default Action';
type BehaviorScriptCategory = 'platform.move' | 'platform.rotate' | 'platform.defaultAction' | 'platform.action';
interface BehaviorScriptOption {
    id: string;
    label: string;
}
const BEHAVIOR_SCRIPT_CATEGORY_BY_FIELD: Readonly<Record<BehaviorScriptField, BehaviorScriptCategory>> = {
    move: 'platform.move',
    rotate: 'platform.rotate',
    defaultAction: 'platform.defaultAction'
};
interface RuntimeBehaviorBindingTarget {
    runtimeType: 'surface';
    behaviorScripts: TestWorldBehaviorScriptsConfig | null;
}

type SurfaceMoveRuntimeDebugEntryView = SurfaceMoveRuntimeDebugSnapshot['surfaces'][number];
interface SurfaceMoveRuntimeDebugLabelsView {
    objectId: string;
    statusLabel: HTMLDivElement;
    assignmentScopeLabel: HTMLDivElement;
    surfaceLabel: HTMLDivElement;
    poseLabel: HTMLDivElement;
}
const KNOWN_RUNTIME_OBJECT_TYPES = new Set<string>([
    'platform_default',
    'drag_box',
    'wind_zone',
    'checkpoint',
    'player_spawn',
    'finish',
    'trigger_volume',
    'triangle_pickup',
    'break_wall',
    'breakable_wall'
]);

export class ObjectsEditorMode implements EditorMode {
    public readonly id = 'objects';
    public readonly label = 'Objects';

    private readonly scene: Phaser.Scene;
    private readonly projectStore: ProjectStore;
    private readonly objectTypeRegistry: ObjectTypeRegistry;
    private readonly onUiChanged: () => void;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly objectAuthoringService: ObjectAuthoringService;
    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly objectViews = new Map<string, Phaser.GameObjects.Rectangle>();
    private readonly selectionOutline: Phaser.GameObjects.Graphics;
    private readonly deleteKey: Phaser.Input.Keyboard.Key | null;
    private readonly escapeKey: Phaser.Input.Keyboard.Key | null;
    private readonly copyKey: Phaser.Input.Keyboard.Key | null;
    private readonly pasteKey: Phaser.Input.Keyboard.Key | null;
    private readonly duplicateKey: Phaser.Input.Keyboard.Key | null;
    private readonly ctrlKey: Phaser.Input.Keyboard.Key | null;

    private activeCatalogCategory: EditorObjectCategory = 'platforms';
    private selectedTypeId: string | null = null;
    private selectedObjectId: string | null = null;
    private draggingObjectId: string | null = null;
    private resizeDragState: ResizeDragState | null = null;
    private surfaceMoveEditObjectId: string | null = null;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private searchValue = '';
    private objectsListScrollTop = 0;
    private activeColorPaletteField: EditableVisualColorField | null = null;
    private colorPaletteObjectId: string | null = null;
    private colorPaletteRoot: HTMLDivElement | null = null;
    private colorPaletteAnchor: HTMLElement | null = null;
    private colorPaletteAnchorRect: { left: number; top: number; width: number; height: number; bottom: number } | null = null;
    private colorPickPreviewRoot: HTMLDivElement | null = null;
    private colorPickPreviewSwatch: HTMLDivElement | null = null;
    private colorPickPreviewHex: HTMLDivElement | null = null;
    private latestColorPickSample: ObjectColorPickSample | null = null;
    private colorPickerHue = 0;
    private colorPickerSaturation = 1;
    private colorPickerValue = 1;
    private syncInProgress = false;
    private syncQueued = false;
    private syncScheduled = false;
    private activePointerButton: number | null = null;
    private liveObjects: EditorObjectData[] = [];
    private objectClipboard: ObjectClipboardData | null = null;
    private lastObjectsListDiagKey: string | null = null;
    private lastBreakWallSummaryDiagKey: string | null = null;
    private objectLogicBindingCreateFormObjectId: string | null = null;
    private objectLogicBindingCreateSlotDraft = OBJECT_LOGIC_BINDING_DEFAULT_SLOT;
    private objectLogicBindingCreateScriptRefId: string | null = null;
    private objectLogicBindingCreateEnabledDraft = true;
    private objectLogicBindingCreateError: string | null = null;
    private readonly objectLogicBindingEnabledDrafts = new Map<string, boolean>();
    private readonly objectLogicBindingMutationErrors = new Map<string, string>();
    private readonly lastAppliedRuntimeDebugVisibilityByObjectId = new Map<string, boolean>();
    private liveSurfaceMoveDebugLabels: SurfaceMoveRuntimeDebugLabelsView | null = null;
    private context: EditorModeRuntimeContext = {
        mouseWorldX: null,
        mouseWorldY: null,
        grid: { enabled: true, snapEnabled: true, size: 32 }
    };

    public constructor(options: ObjectsEditorModeOptions) {
        this.scene = options.scene;
        this.projectStore = options.projectStore;
        this.objectTypeRegistry = options.objectTypeRegistry;
        this.onUiChanged = options.onUiChanged;
        this.legacyObjectAdapter = options.legacyObjectAdapter;
        this.objectAuthoringService = new ObjectAuthoringService({
            projectStore: this.projectStore,
            objectTypeRegistry: this.objectTypeRegistry,
            legacyObjectAdapter: this.legacyObjectAdapter
        });
        this.logicAuthoringService = new LogicAuthoringService(this.legacyObjectAdapter);

        this.selectionOutline = this.scene.add.graphics();
        this.selectionOutline.setDepth(5101);
        this.selectionOutline.setVisible(false);
        this.deleteKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE) ?? null;
        this.escapeKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;
        this.copyKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.C) ?? null;
        this.pasteKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.V) ?? null;
        this.duplicateKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? null;
        this.ctrlKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL) ?? null;
    }

    public enter(): void {
        this.refreshLiveObjects('enter');
        const activeLevel = this.projectStore.getActiveLevel();
        objectDiag('[ObjectsMode:enter]', {
            fileLayer: 'src/editor/modes/ObjectsEditorMode',
            hasObjectAuthoringService: true,
            hasLegacyObjectAdapter: !!this.legacyObjectAdapter,
            hasAuthoringObjectBridge: !!this.legacyObjectAdapter,
            activeLevelId: activeLevel.id,
            activeLevelName: activeLevel.name,
            selectedObjectId: this.selectedObjectId,
            projectStoreObjectCount: this.projectStore.listObjects(activeLevel.id).length,
            serviceObjectCount: this.liveObjects.length,
            activeCategoryTab: this.activeCatalogCategory,
            searchValue: this.searchValue
        });
        this.applyDebugVisibilityToRuntimeLinks();
        this.ensureSelectedTypeMatchesActiveCategory();
        this.syncViewsFromStore();
        this.syncSelectionOutline();
    }

    public exit(): void {
        this.endSurfaceMoveAuthoringEdit('exit');
        this.draggingObjectId = null;
        this.resizeDragState = null;
        this.liveSurfaceMoveDebugLabels = null;
        this.closeColorPalette();
        this.selectionOutline.setVisible(false);
        this.setSceneCursor('default');
    }

    public update(context: EditorModeRuntimeContext): void {
        this.context = context;
        this.refreshLiveObjects(this.syncScheduled ? 'scheduled' : 'update');
        this.syncScheduled = false;
        this.applyDebugVisibilityToRuntimeLinks();
        this.handleDeleteShortcut();
        this.handleObjectUtilityShortcuts();
        this.handleColorPaletteCancelShortcut();
        if (this.activeColorPaletteField && (!this.getSelectedObjectData() || this.colorPaletteObjectId !== this.selectedObjectId)) {
            this.closeColorPalette();
        }
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.refreshSurfaceMoveRuntimeDebugLabels();
    }

    public onRuntimeConfigImported(): void {
        this.clearTransientStateForObject(this.selectedObjectId);
        this.selectedTypeId = null;
        this.refreshLiveObjects('import-json');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerDown(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;

        if (event.button !== 0) {
            return;
        }
        this.activePointerButton = event.button;

        if (this.activeColorPaletteField) {
            return;
        }

        const resizeHit = this.findResizeHandleAtPoint(event.worldX, event.worldY);
        if (resizeHit) {
            const selected = this.getActiveObjects().find((item) => item.id === resizeHit.objectId);
            if (selected) {
                this.selectedObjectId = selected.id;
                this.selectedTypeId = null;
                if (this.isObjectLocked(selected)) {
                    this.resizeDragState = null;
                    this.draggingObjectId = null;
                    this.syncSelectionOutline();
                    this.onUiChanged();
                    return;
                }
                if (!this.beginSurfaceMoveAuthoringEdit(selected.id)) {
                    this.resizeDragState = null;
                    this.draggingObjectId = null;
                    this.syncSelectionOutline();
                    this.onUiChanged();
                    return;
                }
                this.draggingObjectId = null;
                this.resizeDragState = {
                    objectId: selected.id,
                    handle: resizeHit.handle,
                    startBounds: { ...selected.bounds },
                    startPointerWorld: { x: event.worldX, y: event.worldY }
                };
                this.setSceneCursor(this.getHandleCursor(resizeHit.handle));
                objectDiag('[ObjectResize:start]', {
                    objectId: selected.id,
                    handle: resizeHit.handle,
                    startBounds: { ...selected.bounds },
                    pointerWorld: { x: event.worldX, y: event.worldY }
                });
                this.syncSelectionOutline();
                this.onUiChanged();
            }
            return;
        }

        if (this.selectedTypeId) {
            const snappedX = this.snap(event.worldX, context.grid.size);
            const snappedY = this.snap(event.worldY, context.grid.size);
            objectDiag('[ObjectCreate:ui]', {
                selectedCatalogId: this.selectedTypeId,
                activeCategory: this.activeCatalogCategory,
                clickWorldX: event.worldX,
                clickWorldY: event.worldY,
                snappedX,
                snappedY,
                createBranchReached: true,
                willCallObjectAuthoringServiceCreate: true,
                willCallLegacyAdapterCreate: false,
                willFallbackCreate: false
            });
            const created = this.createObjectAt(event.worldX, event.worldY);
            if (created) {
                const isInActiveCategory = created.settings.category === this.activeCatalogCategory;
                const isDisplayed = isInActiveCategory && this.matchesSearch(created, this.searchValue);
                objectDiag('[ObjectCreate:list]', {
                    objectId: created.id,
                    activeCategory: this.activeCatalogCategory,
                    displayedInObjectsList: isDisplayed
                });
            }
            this.onUiChanged();
            return;
        }

        const hitObjectId = this.findObjectIdAtPoint(event.worldX, event.worldY);
        if (hitObjectId) {
            this.selectedObjectId = hitObjectId;
            this.selectedTypeId = null;
            const object = this.getActiveObjects().find((item) => item.id === hitObjectId);
            if (object && !this.isObjectLocked(object)) {
                if (this.beginSurfaceMoveAuthoringEdit(object.id)) {
                    this.draggingObjectId = hitObjectId;
                    this.dragOffsetX = event.worldX - object.bounds.x;
                    this.dragOffsetY = event.worldY - object.bounds.y;
                } else {
                    this.draggingObjectId = null;
                }
            }
            this.syncSelectionOutline();
            objectDiag('[ObjectSelect:mouse]', {
                pointerX: null,
                pointerY: null,
                worldX: event.worldX,
                worldY: event.worldY,
                hitObjectId,
                hitSource: this.legacyObjectAdapter?.hasRuntimeLink(hitObjectId) ? 'runtime' : 'fallback',
                selectedObjectId: this.selectedObjectId,
                hasRuntimeLink: this.legacyObjectAdapter?.hasRuntimeLink(hitObjectId) ?? false
            });
            this.onUiChanged();
            return;
        }
            objectDiag('[ObjectSelect:mouse]', {
                pointerX: null,
                pointerY: null,
                worldX: event.worldX,
                worldY: event.worldY,
                hitObjectId: null,
                hitSource: 'none',
                selectedObjectId: null,
                hasRuntimeLink: false,
                nearestObjectsByBoundsDistance: this.buildNearestObjectsForHitTest(event.worldX, event.worldY)
            });

        this.selectedObjectId = null;
        this.draggingObjectId = null;
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerMove(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;
        if (this.activeColorPaletteField) {
            return;
        }
        if (this.resizeDragState) {
            this.setSceneCursor(this.getHandleCursor(this.resizeDragState.handle));
            this.applyResizeFromPointer(event.worldX, event.worldY, context);
            return;
        }
        if (!this.draggingObjectId) {
            this.updateResizeCursor(event.worldX, event.worldY);
            return;
        }
        const current = this.getActiveObjects().find((item) => item.id === this.draggingObjectId) ?? null;
        if (!current) {
            this.endSurfaceMoveAuthoringEdit('drag-object-missing');
            this.draggingObjectId = null;
            return;
        }
        if (this.isObjectLocked(current)) {
            this.endSurfaceMoveAuthoringEdit('drag-locked');
            this.draggingObjectId = null;
            return;
        }
        const snappedX = this.snap(event.worldX - this.dragOffsetX, context.grid.size);
        const snappedY = this.snap(event.worldY - this.dragOffsetY, context.grid.size);
        const updateResult = this.objectAuthoringService.updateObjectBounds(current.id, {
            x: snappedX,
            y: snappedY
        });
        if (!updateResult.success) {
            if (updateResult.reason) {
                console.warn(`[ObjectsEditorMode] Drag move failed for "${current.id}": ${updateResult.reason}`);
            }
            return;
        }
        this.refreshLiveObjects('drag-move');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerUp(event: EditorPointerEvent): void {
        if (event.button === 0) {
            if (this.resizeDragState) {
                const finalObject = this.getActiveObjects().find((item) => item.id === this.resizeDragState?.objectId) ?? null;
                objectDiag('[ObjectResize:end]', {
                    objectId: this.resizeDragState.objectId,
                    finalBounds: finalObject ? { ...finalObject.bounds } : null
                });
            }
            this.endSurfaceMoveAuthoringEdit('pointer-up');
            this.resizeDragState = null;
            this.draggingObjectId = null;
            this.activePointerButton = null;
            this.setSceneCursor('default');
        }
    }

    public getSelectedObjectId(): string | null {
        return this.selectedObjectId;
    }

    public getDiagnosticsSnapshot(): {
        serviceObjects: number;
        projectStoreObjects: number;
        selectedObjectId: string | null;
        displayedObjects: number;
        breakWallSummary: {
            service: number;
            projectStore: number;
            displayed: number;
        };
    } {
        const activeLevel = this.projectStore.getActiveLevel();
        const displayed = this.getObjectsInActiveCategory(this.liveObjects)
            .filter((obj) => this.matchesSearch(obj, this.searchValue)).length;
        const serviceBreakWallCount = this.countBreakWalls(this.liveObjects);
        const projectStoreObjects = this.projectStore.listObjects(activeLevel.id);
        const storeBreakWallCount = this.countBreakWalls(projectStoreObjects);
        return {
            serviceObjects: this.liveObjects.length,
            projectStoreObjects: projectStoreObjects.length,
            selectedObjectId: this.selectedObjectId,
            displayedObjects: displayed,
            breakWallSummary: {
                service: serviceBreakWallCount,
                projectStore: storeBreakWallCount,
                displayed: serviceBreakWallCount
            }
        };
    }

    public emitDiagnosticsSnapshot(reason: string): void {
        const snapshot = this.getDiagnosticsSnapshot();
        objectDiag('[BreakWall:summary]', {
            reason,
            totalBreakWallObjectsInServiceList: snapshot.breakWallSummary.service,
            totalBreakWallObjectsInProjectStore: snapshot.breakWallSummary.projectStore,
            totalDisplayedBreakWallObjects: snapshot.breakWallSummary.displayed
        });
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const activeLevel = this.projectStore.getActiveLevel();
        const objects = this.getObjectsInActiveCategory(this.getActiveObjects());
        const totalInCategory = objects.length;
        const gridSettings = this.projectStore.getGridSettings();
        const catalog = this.objectTypeRegistry.listByCategory(this.activeCatalogCategory);

        panel.setCustomContent('Objects', (container) => {
            const gridRow = document.createElement('div');
            gridRow.style.display = 'flex';
            gridRow.style.alignItems = 'center';
            gridRow.style.gap = '6px';
            gridRow.style.marginBottom = '8px';

            const gridCheckbox = document.createElement('input');
            gridCheckbox.type = 'checkbox';
            gridCheckbox.checked = gridSettings.enabled;
            gridCheckbox.title = 'Grid On';
            gridCheckbox.addEventListener('change', () => {
                this.projectStore.setGridEnabled(gridCheckbox.checked);
                this.projectStore.setGridSnapEnabled(gridCheckbox.checked);
                this.onUiChanged();
            });

            const gridLabel = document.createElement('label');
            gridLabel.textContent = 'Grid On';
            gridLabel.style.cursor = 'pointer';
            gridLabel.addEventListener('click', () => {
                gridCheckbox.checked = !gridCheckbox.checked;
                this.projectStore.setGridEnabled(gridCheckbox.checked);
                this.projectStore.setGridSnapEnabled(gridCheckbox.checked);
                this.onUiChanged();
            });

            const gridSize = document.createElement('select');
            gridSize.style.marginLeft = 'auto';
            GRID_SIZE_OPTIONS.forEach((size) => {
                const option = document.createElement('option');
                option.value = String(size);
                option.textContent = String(size);
                if (gridSettings.size === size) {
                    option.selected = true;
                }
                gridSize.appendChild(option);
            });
            gridSize.addEventListener('change', () => {
                const nextSize = Number.parseInt(gridSize.value, 10);
                if (!Number.isNaN(nextSize)) {
                    this.projectStore.setGridSize(nextSize);
                    this.onUiChanged();
                }
            });

            gridRow.appendChild(gridCheckbox);
            gridRow.appendChild(gridLabel);
            gridRow.appendChild(gridSize);
            container.appendChild(gridRow);

            const tabsRow = document.createElement('div');
            tabsRow.style.display = 'flex';
            tabsRow.style.gap = '4px';
            tabsRow.style.marginBottom = '8px';
            CATEGORY_ORDER.forEach((category) => {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.textContent = CATEGORY_LABELS[category];
                tab.style.flex = '1';
                tab.style.padding = '4px 6px';
                tab.style.border = '1px solid #5f5f5f';
                tab.style.background = this.activeCatalogCategory === category ? '#70de63' : '#d9d9d9';
                tab.addEventListener('click', () => {
                    if (this.activeCatalogCategory === category) {
                        return;
                    }
                    this.activeCatalogCategory = category;
                    this.ensureSelectedTypeMatchesActiveCategory();
                    this.onUiChanged();
                });
                tabsRow.appendChild(tab);
            });
            container.appendChild(tabsRow);

            container.appendChild(this.makeSectionTitle(CATEGORY_LABELS[this.activeCatalogCategory]));
            catalog.forEach((definition) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = definition.label;
                button.style.width = '100%';
                button.style.textAlign = 'left';
                button.style.marginBottom = '4px';
                button.style.padding = '4px 6px';
                button.style.border = '1px solid #5f5f5f';
                button.style.background = this.selectedTypeId === definition.id ? '#70de63' : '#d9d9d9';
                button.addEventListener('click', () => {
                    this.selectedTypeId = definition.id;
                    this.selectedObjectId = null;
                    this.onUiChanged();
                });
                container.appendChild(button);
            });
            container.appendChild(this.makeSpacer());

            const objectsListTitle = this.makeSectionTitle('');
            container.appendChild(objectsListTitle);
            const search = document.createElement('input');
            search.type = 'text';
            search.value = this.searchValue;
            search.placeholder = 'Search';
            search.style.width = '100%';
            search.style.marginBottom = '6px';
            search.autocomplete = 'off';
            const stopInputEventPropagation = (event: Event): void => {
                event.stopPropagation();
                if ('stopImmediatePropagation' in event) {
                    event.stopImmediatePropagation();
                }
            };
            search.addEventListener('keydown', stopInputEventPropagation);
            search.addEventListener('keyup', stopInputEventPropagation);
            search.addEventListener('keypress', stopInputEventPropagation);
            search.addEventListener('input', () => {
                this.searchValue = search.value;
                renderObjectRows();
            });

            container.appendChild(search);

            const listContainer = document.createElement('div');
            listContainer.style.maxHeight = '280px';
            listContainer.style.overflowY = 'auto';
            listContainer.addEventListener('scroll', () => {
                this.objectsListScrollTop = listContainer.scrollTop;
            });
            container.appendChild(listContainer);

            const restoreListScroll = (desiredScrollTop: number): void => {
                const apply = (): void => {
                    const maxScrollTop = Math.max(0, listContainer.scrollHeight - listContainer.clientHeight);
                    const clamped = Math.max(0, Math.min(desiredScrollTop, maxScrollTop));
                    listContainer.scrollTop = clamped;
                    this.objectsListScrollTop = clamped;
                };
                window.requestAnimationFrame(() => {
                    apply();
                    window.requestAnimationFrame(apply);
                });
            };

            const renderObjectRows = (): void => {
                const desiredScrollTop = listContainer.scrollTop > 0
                    ? listContainer.scrollTop
                    : this.objectsListScrollTop;
                listContainer.replaceChildren();
                const rows = objects.filter((obj) => this.matchesSearch(obj, this.searchValue));
                const displayedItems = rows.slice(0, 50).map((obj) => ({
                    id: obj.id,
                    type: obj.settings.type,
                    category: obj.settings.category,
                    hasRuntimeLink: this.legacyObjectAdapter?.hasRuntimeLink(obj.id) ?? false,
                    source: this.legacyObjectAdapter?.hasRuntimeLink(obj.id)
                        ? 'runtime'
                        : (this.isKnownRuntimeType(obj.settings.type) ? 'unknown' : 'projectStore')
                }));
                const objectsListPayload = {
                    usingObjectAuthoringServiceListObjects: true,
                    activeCategory: this.activeCatalogCategory,
                    searchValue: this.searchValue,
                    totalServiceObjectCount: this.liveObjects.length,
                    totalProjectStoreObjectCount: this.projectStore.listObjects(activeLevel.id).length,
                    displayedItemCount: rows.length,
                    displayedItems,
                    displayedItemsTruncated: rows.length > displayedItems.length
                };
                const nextObjectsListDiagKey = JSON.stringify(objectsListPayload);
                if (this.lastObjectsListDiagKey !== nextObjectsListDiagKey) {
                    this.lastObjectsListDiagKey = nextObjectsListDiagKey;
                    objectDiag('[ObjectsList:source]', objectsListPayload);
                }
                objectsListTitle.textContent = `Objects list (${activeLevel.name}) ${rows.length} / ${totalInCategory}`;
                rows.forEach((obj) => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.minWidth = '0';
                    row.style.gap = '4px';
                    row.style.marginBottom = '4px';

                    const selectButton = document.createElement('button');
                    selectButton.type = 'button';
                    selectButton.style.flex = '1';
                    selectButton.style.minWidth = '0';
                    selectButton.style.textAlign = 'left';
                    selectButton.style.padding = '4px 6px';
                    selectButton.style.border = '1px solid #5f5f5f';
                    selectButton.style.background = this.selectedObjectId === obj.id ? '#70de63' : '#d9d9d9';
                    selectButton.style.whiteSpace = 'normal';
                    selectButton.style.overflowWrap = 'anywhere';
                    selectButton.style.wordBreak = 'break-word';
                    const nameLine = document.createElement('div');
                    nameLine.textContent = obj.name;
                    nameLine.style.fontWeight = 'bold';
                    nameLine.style.overflowWrap = 'anywhere';
                    nameLine.style.wordBreak = 'break-word';
                    const idLine = document.createElement('div');
                    idLine.textContent = obj.id;
                    idLine.style.fontSize = '11px';
                    idLine.style.opacity = '0.8';
                    idLine.style.overflowWrap = 'anywhere';
                    idLine.style.wordBreak = 'break-word';
                    selectButton.append(nameLine, idLine);
                    selectButton.addEventListener('click', () => {
                        this.objectsListScrollTop = listContainer.scrollTop;
                        this.selectedObjectId = obj.id;
                        this.selectedTypeId = null;
                        this.syncSelectionOutline();
                        objectDiag('[ObjectSelect:list]', {
                            clickedRowId: obj.id,
                            clickedType: obj.settings.type,
                            clickedCategory: obj.settings.category,
                            selectedObjectId: this.selectedObjectId,
                            hasRuntimeLink: this.legacyObjectAdapter?.hasRuntimeLink(obj.id) ?? false
                        });
                        this.onUiChanged();
                    });

                    const focusButton = document.createElement('button');
                    focusButton.type = 'button';
                    focusButton.textContent = 'Focus';
                    focusButton.style.padding = '4px 6px';
                    focusButton.style.border = '1px solid #5f5f5f';
                    focusButton.style.background = '#d9d9d9';
                    focusButton.addEventListener('click', () => {
                        const centerX = obj.bounds.x + (obj.bounds.width * 0.5);
                        const centerY = obj.bounds.y + (obj.bounds.height * 0.5);
                        this.scene.cameras.main.centerOn(centerX, centerY);
                        this.selectedObjectId = obj.id;
                        this.selectedTypeId = null;
                        this.syncSelectionOutline();
                        this.onUiChanged();
                    });

                    row.appendChild(selectButton);
                    row.appendChild(focusButton);
                    listContainer.appendChild(row);
                });
                restoreListScroll(desiredScrollTop);
            };

            renderObjectRows();
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        this.liveSurfaceMoveDebugLabels = null;
        const activeLevel = this.projectStore.getActiveLevel();
        const objects = this.getActiveObjects();

        panel.setCustomContent('Object Properties', (container) => {
            const selectedObject = this.selectedObjectId
                ? this.projectStore.getObject(activeLevel.id, this.selectedObjectId)
                : undefined;
            if (!selectedObject) {
                container.appendChild(this.makeLabel(`Active level: ${activeLevel.name} (${activeLevel.id})`));
                container.appendChild(this.makeLabel(`Object count: ${objects.length}`));
                container.appendChild(this.makeSpacer());
                container.appendChild(this.makeSectionTitle('Logic Actions'));
                container.appendChild(this.makeLabel('Select an object to inspect logic actions.'));
                return;
            }
            const objectLogicBindings = this.logicAuthoringService.listBindingsForTarget('object', selectedObject.id);
            objectDiag('[ObjectVisualSync]', {
                phase: 'select',
                objectId: selectedObject.id,
                sourceVisual: this.legacyObjectAdapter?.getRuntimeVisual(selectedObject.id) ?? null,
                projectStoreVisualAfter: selectedObject.visual,
                configVisual: this.legacyObjectAdapter?.getRuntimeVisual(selectedObject.id) ?? null,
                usedDefault: selectedObject.visual.fillColor === '#ffffff'
                    && selectedObject.visual.strokeColor === '#000000'
                    && selectedObject.visual.alpha === 1
                    && selectedObject.visual.layer === 3,
                reason: 'renderRightInspector selected object'
            });

            container.appendChild(this.makeSectionTitle('Bounds'));
            if (this.isObjectLocked(selectedObject)) {
                container.appendChild(this.makeLabel('Locked'));
            }
            container.appendChild(this.makeBoundsInputRow(
                selectedObject,
                [
                    { label: 'X', field: 'x' },
                    { label: 'Y', field: 'y' }
                ]
            ));
            container.appendChild(this.makeBoundsInputRow(
                selectedObject,
                [
                    { label: 'Width', field: 'width' },
                    { label: 'Height', field: 'height' }
                ]
            ));
            container.appendChild(this.makeBoundsInputRow(
                selectedObject,
                [
                    { label: 'Rotation', field: 'rotation' }
                ]
            ));
            container.appendChild(this.makeSpacer());
            container.appendChild(this.makeSectionTitle('Object Actions'));
            container.appendChild(this.makeObjectUtilityActionsRow(selectedObject));
            container.appendChild(this.makeSpacer());

            container.appendChild(this.makeSectionTitle('Visual'));
            container.appendChild(this.makeVisualTextFieldRow(selectedObject, 'Shader', 'shaderKey'));
            container.appendChild(this.makeVisualTextFieldRow(selectedObject, 'Texture', 'textureKey'));
            container.appendChild(this.makeVisualColorFieldRow(selectedObject, 'Fill', 'fillColor'));
            container.appendChild(this.makeVisualColorFieldRow(selectedObject, 'Stroke', 'strokeColor'));
            container.appendChild(this.makeVisualAlphaRow(selectedObject));
            container.appendChild(this.makeVisualLayerRow(selectedObject));
            container.appendChild(this.makeVisualOnlyDebugViewRow(selectedObject));
            container.appendChild(this.makeLabel('Texture preview requires loaded texture key'));
            container.appendChild(this.makeLabel('Shader preview TODO'));
            container.appendChild(this.makeSpacer());

            container.appendChild(this.makeSectionTitle('Settings'));
            container.appendChild(this.makeLabel(`Type: ${selectedObject.settings.type}`));
            container.appendChild(this.makeLabel(`Collision: ${selectedObject.settings.collision}`));
            container.appendChild(this.makeSpacer());

            container.appendChild(this.makeSectionTitle('Behavior Scripts'));
            container.appendChild(this.makeBehaviorScriptsSection(selectedObject));
            container.appendChild(this.makeSpacer());
            container.appendChild(this.makeSectionTitle('Logic Actions'));
            container.appendChild(this.makeObjectLogicActionsView(selectedObject, objectLogicBindings));
        });
    }

    private handleDeleteShortcut(): void {
        if (!this.deleteKey) {
            return;
        }
        const justDown = Phaser.Input.Keyboard.JustDown(this.deleteKey);
        if (!justDown) {
            return;
        }
        const textInputFocused = isEditorTextInputFocused();
        if (textInputFocused) {
            return;
        }
        const selectedId = this.selectedObjectId;
        const activeLevel = this.projectStore.getActiveLevel();
        const selected = selectedId ? this.projectStore.getObject(activeLevel.id, selectedId) : undefined;
        const hasRuntimeLink = selectedId ? (this.legacyObjectAdapter?.hasRuntimeLink(selectedId) ?? false) : false;
        objectDiag('[ObjectDelete:key]', {
            isTextInputFocused: textInputFocused,
            activeEditorMode: this.id,
            selectedObjectId: selectedId ?? null,
            selectedObjectType: selected?.settings.type ?? null,
            selectedObjectCategory: selected?.settings.category ?? null,
            hasRuntimeLink,
            willCallObjectAuthoringServiceDelete: !!selectedId,
            willCallLegacyAdapterDelete: hasRuntimeLink,
            willFallbackDelete: false
        });
        this.deleteSelectedObject();
    }

    private handleColorPaletteCancelShortcut(): void {
        if (!this.activeColorPaletteField || !this.escapeKey) {
            return;
        }
        if (!Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
            return;
        }
        this.closeColorPalette();
    }

    private handleObjectUtilityShortcuts(): void {
        if (!this.ctrlKey || !this.ctrlKey.isDown || isEditorTextInputFocused()) {
            return;
        }
        if (this.copyKey && Phaser.Input.Keyboard.JustDown(this.copyKey)) {
            this.copySelectedObject();
            return;
        }
        if (this.pasteKey && Phaser.Input.Keyboard.JustDown(this.pasteKey)) {
            if (this.pasteClipboardObject()) {
                this.onUiChanged();
            }
            return;
        }
        if (this.duplicateKey && Phaser.Input.Keyboard.JustDown(this.duplicateKey)) {
            objectDiag('[ObjectDuplicate:blocked]', { reason: 'disabled_for_stability_h2_1' });
        }
    }

    private deleteSelectedObject(): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return false;
        }
        const selected = this.getSelectedObjectData();
        if (selected && this.isObjectLocked(selected)) {
            objectDiag('[ObjectDelete:blocked]', { selectedObjectId: selectedId, reason: 'locked' });
            return false;
        }
        const pointerButtonBeforeDelete = this.activePointerButton;
        this.debugLog(`delete:start id=${selectedId} pointer=${pointerButtonBeforeDelete ?? -1}`);

        try {
            const deleteResult = this.objectAuthoringService.deleteObject(selectedId);
            this.debugLog(`delete:runtime-remove id=${selectedId} result=${deleteResult.success ? 'ok' : 'failed'}`);
            if (!deleteResult.success) {
                if (deleteResult.reason) {
                    console.warn(`[ObjectsEditorMode] Delete failed for "${selectedId}": ${deleteResult.reason}`);
                }
                this.refreshLiveObjects('delete:failed');
                this.syncViewsFromStore();
                this.syncSelectionOutline();
                this.onUiChanged();
                return false;
            }

            this.objectViews.get(selectedId)?.destroy();
            this.objectViews.delete(selectedId);
            this.clearTransientStateForObject(selectedId);
            this.selectedObjectId = null;
            this.refreshLiveObjects('delete:success');
            this.syncViewsFromStore();
            this.syncSelectionOutline();
            this.onUiChanged();
            return true;
        } catch (error) {
            const asError = error instanceof Error ? error : new Error(String(error));
            const message = asError.message;
            objectDiag('[ObjectDelete:key]', {
                phase: 'exception',
                selectedObjectId: selectedId,
                errorName: asError.name,
                errorMessage: asError.message,
                errorStack: asError.stack ?? null
            });
            console.warn(`[ObjectsEditorMode] Delete failed for "${selectedId}": ${message}`);
            this.refreshLiveObjects('delete:exception');
            this.syncSelectionOutline();
            this.onUiChanged();
            return false;
        } finally {
            this.draggingObjectId = null;
            this.activePointerButton = null;
        }
    }

    private createObjectAt(worldX: number, worldY: number): EditorObjectData | null {
        const typeId = this.selectedTypeId ?? 'platform_default';
        const x = this.snap(worldX, this.context.grid.size);
        const y = this.snap(worldY, this.context.grid.size);
        const creation = this.objectAuthoringService.createObject(typeId, x, y);
        if (!creation.success || !creation.objectId) {
            console.warn(
                `[ObjectsEditorMode] Runtime creation failed for "${typeId}": ${creation.reason ?? 'unknown error'}`
            );
            return null;
        }
        return this.trySelectCreatedObject(creation.objectId, 'create');
    }

    private makeBoundsInputRow(
        selectedObject: EditorObjectData,
        fields: ReadonlyArray<{ label: string; field: EditableBoundsField }>
    ): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '6px';
        row.style.marginBottom = '6px';

        fields.forEach((entry) => {
            const fieldWrap = document.createElement('label');
            fieldWrap.style.display = 'flex';
            fieldWrap.style.flexDirection = 'column';
            fieldWrap.style.gap = '2px';
            fieldWrap.style.flex = '1';

            const fieldLabel = document.createElement('span');
            fieldLabel.textContent = entry.label;
            fieldLabel.style.fontSize = '11px';

            const input = this.makeBoundsInput(selectedObject, entry.field);
            fieldWrap.appendChild(fieldLabel);
            fieldWrap.appendChild(input);
            row.appendChild(fieldWrap);
        });

        return row;
    }

    private makeBoundsInput(selectedObject: EditorObjectData, field: EditableBoundsField): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.formatBoundsValue(selectedObject.bounds[field]);
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';

        const stopKeyboardEvent = (event: KeyboardEvent): void => {
            event.stopPropagation();
            if ('stopImmediatePropagation' in event) {
                event.stopImmediatePropagation();
            }
        };

        const commitField = (): void => {
            const committed = this.commitSelectedObjectBoundsField(field, input.value);
            const resolvedValue = this.getSelectedBoundsFieldValue(field);
            input.value = this.formatBoundsValue(resolvedValue);
            if (committed) {
                this.onUiChanged();
            }
        };

        input.addEventListener('keydown', (event) => {
            stopKeyboardEvent(event);
            if (event.key === 'Enter') {
                event.preventDefault();
                commitField();
                input.blur();
            }
        });
        input.addEventListener('keyup', stopKeyboardEvent);
        input.addEventListener('keypress', stopKeyboardEvent);
        input.addEventListener('blur', commitField);

        return input;
    }

    private commitSelectedObjectBoundsField(field: EditableBoundsField, rawValue: string): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return false;
        }

        const current = this.getActiveObjects().find((item) => item.id === selectedId) ?? null;
        if (!current) {
            return false;
        }
        if (this.isObjectLocked(current)) {
            return false;
        }

        const trimmedValue = rawValue.trim();
        if (trimmedValue.length === 0) {
            return false;
        }
        const parsed = Number(trimmedValue);
        if (!Number.isFinite(parsed)) {
            return false;
        }

        let nextValue = parsed;
        if ((field === 'width' || field === 'height') && nextValue <= 0) {
            return false;
        }
        if (field === 'x' || field === 'y') {
            const grid = this.projectStore.getGridSettings();
            if (grid.snapEnabled) {
                const size = Math.max(1, Math.round(grid.size));
                if (size > 1) {
                    nextValue = Math.round(nextValue / size) * size;
                }
            }
        }

        if (current.bounds[field] === nextValue) {
            return false;
        }

        const updateResult = this.objectAuthoringService.updateObjectBounds(selectedId, {
            [field]: nextValue
        } as Partial<EditorObjectBoundsData>);
        if (!updateResult.success) {
            if (updateResult.reason) {
                console.warn(`[ObjectsEditorMode] Bounds update failed for "${selectedId}": ${updateResult.reason}`);
            }
            this.refreshLiveObjects('bounds-edit-failed');
            this.syncViewsFromStore();
            this.syncSelectionOutline();
            return false;
        }
        this.refreshLiveObjects('bounds-edit');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return true;
    }

    private getSelectedBoundsFieldValue(field: EditableBoundsField): number {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return 0;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const selectedObject = this.projectStore.getObject(activeLevel.id, selectedId);
        if (!selectedObject) {
            return 0;
        }
        return selectedObject.bounds[field];
    }

    private formatBoundsValue(value: number): string {
        return Number.isFinite(value) ? String(value) : '0';
    }

    private makeVisualTextFieldRow(
        selectedObject: EditorObjectData,
        label: string,
        field: EditableVisualTextField
    ): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = selectedObject.visual[field] ?? '';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        this.bindEditorInputKeyboardGuards(input);

        const commitField = (): void => {
            const committed = this.commitSelectedObjectVisualTextField(field, input.value);
            input.value = this.getSelectedVisualTextFieldValue(field) ?? '';
            if (committed) {
                this.onUiChanged();
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitField();
                input.blur();
            }
        });
        input.addEventListener('blur', commitField);

        return this.makeSingleFieldInputRow(label, input);
    }

    private makeVisualColorFieldRow(
        selectedObject: EditorObjectData,
        label: string,
        field: EditableVisualColorField
    ): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '6px';
        row.style.marginBottom = '6px';

        const fieldWrap = document.createElement('label');
        fieldWrap.style.display = 'flex';
        fieldWrap.style.flexDirection = 'column';
        fieldWrap.style.gap = '2px';
        fieldWrap.style.flex = '1';

        const fieldLabel = document.createElement('span');
        fieldLabel.textContent = label;
        fieldLabel.style.fontSize = '11px';

        const controlsRow = document.createElement('div');
        controlsRow.style.display = 'flex';
        controlsRow.style.alignItems = 'center';
        controlsRow.style.gap = '6px';
        controlsRow.style.flexWrap = 'wrap';

        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.title = field === 'fillColor' ? 'Open fill palette' : 'Open stroke palette';
        swatch.style.width = '28px';
        swatch.style.height = '24px';
        swatch.style.padding = '0';
        swatch.style.border = '1px solid #5f5f5f';
        swatch.style.background = this.resolveSwatchBackground(selectedObject.visual[field]);
        swatch.style.position = 'relative';
        swatch.style.cursor = 'pointer';
        swatch.style.boxSizing = 'border-box';
        swatch.style.flexShrink = '0';
        if (this.isTransparentColorValue(selectedObject.visual[field])) {
            const transparentMark = document.createElement('span');
            transparentMark.textContent = '/';
            transparentMark.style.position = 'absolute';
            transparentMark.style.left = '0';
            transparentMark.style.right = '0';
            transparentMark.style.top = '0';
            transparentMark.style.bottom = '0';
            transparentMark.style.display = 'flex';
            transparentMark.style.alignItems = 'center';
            transparentMark.style.justifyContent = 'center';
            transparentMark.style.fontSize = '11px';
            transparentMark.style.fontWeight = 'bold';
            transparentMark.style.color = '#111111';
            transparentMark.style.textShadow = '0 1px 0 #ffffff';
            swatch.appendChild(transparentMark);
        }
        this.bindEditorInputKeyboardGuards(swatch);
        swatch.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleColorPalette(field, swatch);
        });

        const input = document.createElement('input');
        input.type = 'text';
        input.value = selectedObject.visual[field];
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.flex = '1 1 96px';
        input.style.minWidth = '72px';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        if (this.isObjectLocked(selectedObject)) {
            input.readOnly = true;
            input.disabled = true;
        }
        if (this.isObjectLocked(selectedObject)) {
            input.readOnly = true;
            input.disabled = true;
        }
        this.bindEditorInputKeyboardGuards(input);

        const noneButton = document.createElement('button');
        noneButton.type = 'button';
        noneButton.textContent = field === 'fillColor' ? 'No Fill' : 'No Stroke';
        noneButton.style.padding = '3px 6px';
        noneButton.style.border = '1px solid #5f5f5f';
        noneButton.style.background = '#d9d9d9';
        noneButton.style.flexShrink = '0';
        noneButton.style.whiteSpace = 'nowrap';
        noneButton.addEventListener('click', () => {
            const committed = this.commitSelectedObjectBasicVisualPatch({
                [field]: TRANSPARENT_COLOR_VALUE
            } as UpdateObjectVisualPatch);
            input.value = this.getSelectedVisualColorFieldValue(field);
            if (committed) {
                this.onUiChanged();
            }
        });

        const commitField = (): void => {
            const committed = this.commitSelectedObjectVisualColorField(field, input.value);
            input.value = this.getSelectedVisualColorFieldValue(field);
            if (committed) {
                this.onUiChanged();
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitField();
                input.blur();
            }
        });
        input.addEventListener('blur', commitField);
        controlsRow.appendChild(swatch);
        controlsRow.appendChild(input);
        controlsRow.appendChild(noneButton);
        fieldWrap.appendChild(fieldLabel);
        fieldWrap.appendChild(controlsRow);
        row.appendChild(fieldWrap);
        return row;
    }

    private makeVisualAlphaRow(selectedObject: EditorObjectData): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.formatNumber(selectedObject.visual.alpha);
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        this.bindEditorInputKeyboardGuards(input);

        const commitField = (): void => {
            const committed = this.commitSelectedObjectVisualAlpha(input.value);
            input.value = this.formatNumber(this.getSelectedVisualNumericFieldValue('alpha'));
            if (committed) {
                this.onUiChanged();
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitField();
                input.blur();
            }
        });
        input.addEventListener('blur', commitField);

        return this.makeSingleFieldInputRow('Alpha', input);
    }

    private makeVisualLayerRow(selectedObject: EditorObjectData): HTMLDivElement {
        const input = document.createElement('select');
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        this.bindEditorInputKeyboardGuards(input);

        LAYER_OPTIONS.forEach((value) => {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = LAYER_OPTION_LABELS[value] ?? `Layer ${value}`;
            input.appendChild(option);
        });
        const initialLayer = this.resolveInspectorLayerValue(selectedObject.visual.layer);
        input.value = String(initialLayer);
        objectDiag('[LayerField]', {
            phase: 'render',
            objectId: selectedObject.id,
            uiValue: input.value,
            storedValueBefore: initialLayer,
            requestedLayer: null,
            storedValueAfter: initialLayer,
            success: true,
            reason: null
        });

        const commitField = (): void => {
            const selectedId = this.selectedObjectId;
            const storedValueBefore = this.getSelectedVisualNumericFieldValue('layer');
            const requestedLayer = Number(input.value.trim());
            objectDiag('[LayerField]', {
                phase: 'change',
                objectId: selectedId,
                uiValue: input.value,
                storedValueBefore,
                requestedLayer,
                storedValueAfter: null,
                success: null,
                reason: null
            });

            const committed = this.commitSelectedObjectVisualLayer(input.value);
            const storedValueAfter = this.getSelectedVisualNumericFieldValue('layer');
            input.value = String(this.resolveInspectorLayerValue(storedValueAfter));

            objectDiag('[LayerField]', {
                phase: committed ? 'commit-success' : 'commit-fail',
                objectId: selectedId,
                uiValue: input.value,
                storedValueBefore,
                requestedLayer,
                storedValueAfter,
                success: committed,
                reason: committed ? null : 'Failed to apply via updateObjectVisual.'
            });
            if (committed) {
                this.onUiChanged();
            }
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitField();
                input.blur();
            }
        });
        input.addEventListener('change', commitField);
        input.addEventListener('blur', commitField);

        return this.makeSingleFieldInputRow('Layer', input);
    }

    private makeVisualOnlyDebugViewRow(selectedObject: EditorObjectData): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '6px';
        row.style.marginBottom = '6px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedObject.visual.onlyDebugView;
        this.bindEditorInputKeyboardGuards(checkbox);
        checkbox.addEventListener('change', () => {
            const committed = this.commitSelectedObjectVisualOnlyDebugView(checkbox.checked);
            checkbox.checked = this.getSelectedVisualOnlyDebugViewValue();
            if (committed) {
                this.onUiChanged();
            }
        });

        const label = document.createElement('label');
        label.textContent = 'Only debug view';
        label.style.cursor = 'pointer';
        label.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            const committed = this.commitSelectedObjectVisualOnlyDebugView(checkbox.checked);
            checkbox.checked = this.getSelectedVisualOnlyDebugViewValue();
            if (committed) {
                this.onUiChanged();
            }
        });

        row.appendChild(checkbox);
        row.appendChild(label);
        return row;
    }

    private makeSingleFieldInputRow(label: string, input: HTMLInputElement): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '6px';
        row.style.marginBottom = '6px';

        const fieldWrap = document.createElement('label');
        fieldWrap.style.display = 'flex';
        fieldWrap.style.flexDirection = 'column';
        fieldWrap.style.gap = '2px';
        fieldWrap.style.flex = '1';

        const fieldLabel = document.createElement('span');
        fieldLabel.textContent = label;
        fieldLabel.style.fontSize = '11px';

        fieldWrap.appendChild(fieldLabel);
        fieldWrap.appendChild(input);
        row.appendChild(fieldWrap);
        return row;
    }

    private bindEditorInputKeyboardGuards(input: HTMLElement): void {
        const stopKeyboardEvent = (event: Event): void => {
            event.stopPropagation();
        };
        input.addEventListener('keydown', stopKeyboardEvent);
        input.addEventListener('keyup', stopKeyboardEvent);
        input.addEventListener('keypress', stopKeyboardEvent);
    }

    private toggleColorPalette(field: EditableVisualColorField, anchor: HTMLElement): void {
        if (this.activeColorPaletteField === field && this.colorPaletteRoot) {
            this.closeColorPalette();
            return;
        }
        this.openColorPalette(field, anchor);
    }

    private openColorPalette(field: EditableVisualColorField, anchor: HTMLElement): void {
        this.closeColorPalette();
        this.activeColorPaletteField = field;
        this.colorPaletteObjectId = this.selectedObjectId;
        this.colorPaletteAnchor = anchor;
        this.colorPaletteAnchorRect = this.readAnchorRect(anchor);
        const activeColor = this.getSelectedVisualColorFieldValue(field);
        const normalized = this.normalizeHexLikeColor(activeColor) ?? '#ffffff';
        const hsv = this.hexToHsv(normalized);
        this.colorPickerHue = hsv.h;
        this.colorPickerSaturation = hsv.s;
        this.colorPickerValue = hsv.v;

        const palette = document.createElement('div');
        palette.style.position = 'fixed';
        palette.style.zIndex = '20000';
        palette.style.width = '244px';
        palette.style.border = '1px solid #5f5f5f';
        palette.style.background = '#efefef';
        palette.style.padding = '8px';
        palette.style.boxSizing = 'border-box';
        palette.style.boxShadow = '0 6px 14px rgba(0, 0, 0, 0.2)';
        palette.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });

        const title = document.createElement('div');
        title.textContent = field === 'fillColor' ? 'Fill Palette' : 'Stroke Palette';
        title.style.fontSize = '11px';
        title.style.marginBottom = '6px';
        title.style.fontWeight = 'bold';
        palette.appendChild(title);

        const svArea = document.createElement('div');
        svArea.style.width = '100%';
        svArea.style.height = '124px';
        svArea.style.position = 'relative';
        svArea.style.cursor = 'crosshair';
        svArea.style.marginBottom = '8px';
        svArea.style.border = '1px solid #5f5f5f';
        svArea.style.backgroundColor = '#ff0000';
        svArea.style.backgroundImage = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)';
        const svHandle = document.createElement('div');
        svHandle.style.position = 'absolute';
        svHandle.style.width = '8px';
        svHandle.style.height = '8px';
        svHandle.style.border = '1px solid #ffffff';
        svHandle.style.boxShadow = '0 0 0 1px #000000';
        svHandle.style.borderRadius = '50%';
        svHandle.style.pointerEvents = 'none';
        svArea.appendChild(svHandle);
        palette.appendChild(svArea);

        const hueRow = document.createElement('div');
        hueRow.style.marginBottom = '8px';
        const hueStrip = document.createElement('div');
        hueStrip.style.width = '100%';
        hueStrip.style.height = '14px';
        hueStrip.style.border = '1px solid #5f5f5f';
        hueStrip.style.cursor = 'ew-resize';
        hueStrip.style.background = 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)';
        hueStrip.style.position = 'relative';
        const hueHandle = document.createElement('div');
        hueHandle.style.position = 'absolute';
        hueHandle.style.top = '-2px';
        hueHandle.style.width = '4px';
        hueHandle.style.height = '18px';
        hueHandle.style.background = '#ffffff';
        hueHandle.style.border = '1px solid #000000';
        hueHandle.style.pointerEvents = 'none';
        hueStrip.appendChild(hueHandle);
        hueRow.appendChild(hueStrip);
        palette.appendChild(hueRow);

        const statusRow = document.createElement('div');
        statusRow.style.display = 'flex';
        statusRow.style.gap = '6px';
        statusRow.style.marginBottom = '8px';
        const preview = document.createElement('div');
        preview.style.width = '32px';
        preview.style.height = '24px';
        preview.style.border = '1px solid #5f5f5f';
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.autocomplete = 'off';
        hexInput.spellcheck = false;
        hexInput.style.flex = '1';
        hexInput.style.padding = '2px 4px';
        hexInput.style.border = '1px solid #5f5f5f';
        this.bindEditorInputKeyboardGuards(hexInput);
        statusRow.appendChild(preview);
        statusRow.appendChild(hexInput);
        palette.appendChild(statusRow);

        const bottomRow = document.createElement('div');
        bottomRow.style.display = 'flex';
        bottomRow.style.gap = '6px';

        const transparentButton = document.createElement('button');
        transparentButton.type = 'button';
        transparentButton.textContent = field === 'fillColor' ? 'No Fill' : 'No Stroke';
        transparentButton.style.flex = '1';
        transparentButton.style.padding = '3px 6px';
        transparentButton.style.border = '1px solid #5f5f5f';
        transparentButton.style.background = '#d9d9d9';
        transparentButton.addEventListener('click', () => {
            this.applyPaletteColor(field, TRANSPARENT_COLOR_VALUE);
        });

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'Close';
        closeButton.style.padding = '3px 8px';
        closeButton.style.border = '1px solid #5f5f5f';
        closeButton.style.background = '#d9d9d9';
        closeButton.addEventListener('click', () => {
            this.closeColorPalette();
        });

        bottomRow.appendChild(transparentButton);
        bottomRow.appendChild(closeButton);
        palette.appendChild(bottomRow);
        document.body.appendChild(palette);
        this.colorPaletteRoot = palette;
        this.positionColorPalette();
        this.ensureColorPickPreview();
        document.addEventListener('pointerdown', this.handleDocumentPointerDownForPalette, true);
        this.scene.game.canvas.addEventListener('pointermove', this.handleCanvasPointerMoveForPalette, true);
        this.scene.game.canvas.addEventListener('pointerdown', this.handleCanvasPointerDownForPalette, true);

        let draggingSv = false;
        let draggingHue = false;
        const updateUi = (): void => {
            const hueColor = this.hsvToHex({ h: this.colorPickerHue, s: 1, v: 1 });
            svArea.style.backgroundColor = hueColor;
            const x = Math.round(this.colorPickerSaturation * (svArea.clientWidth - 1));
            const y = Math.round((1 - this.colorPickerValue) * (svArea.clientHeight - 1));
            svHandle.style.left = `${Math.max(0, Math.min(svArea.clientWidth - 1, x)) - 4}px`;
            svHandle.style.top = `${Math.max(0, Math.min(svArea.clientHeight - 1, y)) - 4}px`;
            const hueX = Math.round((this.colorPickerHue / 360) * (hueStrip.clientWidth - 1));
            hueHandle.style.left = `${Math.max(0, Math.min(hueStrip.clientWidth - 1, hueX)) - 2}px`;
            const hex = this.hsvToHex({
                h: this.colorPickerHue,
                s: this.colorPickerSaturation,
                v: this.colorPickerValue
            });
            preview.style.background = hex;
            hexInput.value = hex;
        };
        const commitCurrentColor = (): void => {
            const hex = this.hsvToHex({
                h: this.colorPickerHue,
                s: this.colorPickerSaturation,
                v: this.colorPickerValue
            });
            this.applyPaletteColor(field, hex);
        };
        const updateSvFromEvent = (event: PointerEvent): void => {
            const rect = svArea.getBoundingClientRect();
            const x = Phaser.Math.Clamp(event.clientX - rect.left, 0, rect.width);
            const y = Phaser.Math.Clamp(event.clientY - rect.top, 0, rect.height);
            this.colorPickerSaturation = rect.width <= 0 ? 1 : x / rect.width;
            this.colorPickerValue = rect.height <= 0 ? 1 : 1 - (y / rect.height);
            updateUi();
            commitCurrentColor();
        };
        const updateHueFromEvent = (event: PointerEvent): void => {
            const rect = hueStrip.getBoundingClientRect();
            const x = Phaser.Math.Clamp(event.clientX - rect.left, 0, rect.width);
            const nextHue = rect.width <= 0 ? 0 : (x / rect.width) * 360;
            this.colorPickerHue = nextHue >= 360 ? 359.999 : nextHue;
            updateUi();
            commitCurrentColor();
        };

        svArea.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            draggingSv = true;
            updateSvFromEvent(event);
        });
        hueStrip.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            draggingHue = true;
            updateHueFromEvent(event);
        });
        document.addEventListener('pointermove', this.handleColorPickerPointerMove, true);
        document.addEventListener('pointerup', this.handleColorPickerPointerUp, true);
        this.onColorPickerPointerMove = (event: PointerEvent): void => {
            if (draggingSv) {
                event.preventDefault();
                event.stopPropagation();
                updateSvFromEvent(event);
            } else if (draggingHue) {
                event.preventDefault();
                event.stopPropagation();
                updateHueFromEvent(event);
            }
        };
        this.onColorPickerPointerUp = (): void => {
            draggingSv = false;
            draggingHue = false;
        };
        hexInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const normalized = this.normalizeHexLikeColor(hexInput.value);
                if (!normalized) {
                    return;
                }
                const nextHsv = this.hexToHsv(normalized);
                this.colorPickerHue = nextHsv.h;
                this.colorPickerSaturation = nextHsv.s;
                this.colorPickerValue = nextHsv.v;
                updateUi();
                this.applyPaletteColor(field, normalized);
            }
        });
        updateUi();
    }

    private closeColorPalette(): void {
        if (this.colorPaletteRoot?.parentElement) {
            this.colorPaletteRoot.parentElement.removeChild(this.colorPaletteRoot);
        }
        this.colorPaletteRoot = null;
        this.colorPaletteAnchor = null;
        this.colorPaletteAnchorRect = null;
        this.colorPaletteObjectId = null;
        this.activeColorPaletteField = null;
        this.destroyColorPickPreview();
        document.removeEventListener('pointerdown', this.handleDocumentPointerDownForPalette, true);
        this.scene.game.canvas.removeEventListener('pointermove', this.handleCanvasPointerMoveForPalette, true);
        this.scene.game.canvas.removeEventListener('pointerdown', this.handleCanvasPointerDownForPalette, true);
        document.removeEventListener('pointermove', this.handleColorPickerPointerMove, true);
        document.removeEventListener('pointerup', this.handleColorPickerPointerUp, true);
        this.onColorPickerPointerMove = null;
        this.onColorPickerPointerUp = null;
        this.latestColorPickSample = null;
    }

    private readonly handleDocumentPointerDownForPalette = (event: PointerEvent): void => {
        if (!this.colorPaletteRoot) {
            return;
        }
        const target = event.target;
        if (!(target instanceof Node)) {
            this.closeColorPalette();
            return;
        }
        if (this.colorPaletteRoot.contains(target)) {
            return;
        }
        if (this.colorPaletteAnchor && this.colorPaletteAnchor.contains(target)) {
            return;
        }
        if (target === this.scene.game.canvas) {
            return;
        }
        this.closeColorPalette();
    };

    private readonly handleCanvasPointerDownForPalette = (event: PointerEvent): void => {
        if (!this.activeColorPaletteField) {
            return;
        }
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if ('stopImmediatePropagation' in event) {
            event.stopImmediatePropagation();
        }
        const sampled = this.sampleColorAtClientPointForPalette(event.clientX, event.clientY);
        this.latestColorPickSample = sampled.sample;
        this.updateColorPickPreviewAtClientPoint(event.clientX, event.clientY, sampled.sample);
        const mode = this.activeColorPaletteField;
        const targetObjectId = this.colorPaletteObjectId;
        if (!targetObjectId || this.selectedObjectId !== targetObjectId) {
            objectDiag('[ObjectColorPick:apply]', {
                mode,
                targetObjectId,
                sourceObjectId: sampled.sample.sourceObjectId,
                pickedValue: sampled.sample.sourceValue,
                success: false,
                reason: 'Palette target object is unavailable.'
            });
            return;
        }
        if (!sampled.sample.success || !sampled.sample.sourceValue) {
            objectDiag('[ObjectColorPick:apply]', {
                mode,
                targetObjectId,
                sourceObjectId: sampled.sample.sourceObjectId,
                pickedValue: sampled.sample.sourceValue,
                success: false,
                reason: sampled.sample.reason ?? 'No color under cursor.'
            });
            return;
        }
        const committed = this.commitObjectBasicVisualPatch(targetObjectId, {
            [mode]: sampled.sample.sourceValue
        } as UpdateObjectVisualPatch);
        objectDiag('[ObjectColorPick:apply]', {
            mode,
            targetObjectId,
            sourceObjectId: sampled.sample.sourceObjectId,
            pickedValue: sampled.sample.sourceValue,
            colorSource: sampled.sample.colorSource,
            success: committed,
            reason: committed ? null : 'Failed to apply via updateObjectVisual.'
        });
        if (committed) {
            this.onUiChanged();
        }
    };

    private readonly handleCanvasPointerMoveForPalette = (event: PointerEvent): void => {
        if (!this.activeColorPaletteField) {
            return;
        }
        const sampled = this.sampleColorAtClientPointForPalette(event.clientX, event.clientY);
        this.latestColorPickSample = sampled.sample;
        this.updateColorPickPreviewAtClientPoint(event.clientX, event.clientY, sampled.sample);
        objectDiag('[ObjectColorPick:hover]', {
            mode: this.activeColorPaletteField,
            targetObjectId: this.colorPaletteObjectId,
            clientX: event.clientX,
            clientY: event.clientY,
            worldX: sampled.worldX,
            worldY: sampled.worldY,
            sourceObjectId: sampled.sample.sourceObjectId,
            colorSource: sampled.sample.colorSource,
            sourceValue: sampled.sample.sourceValue,
            projectStoreValue: sampled.sample.projectStoreValue,
            runtimeValue: sampled.sample.runtimeValue,
            isProjectStoreDefault: sampled.sample.isProjectStoreDefault,
            success: sampled.sample.success,
            reason: sampled.sample.reason ?? null
        });
    };

    private applyPaletteColor(field: EditableVisualColorField, rawColor: string): void {
        const committed = this.commitSelectedObjectVisualColorField(field, rawColor);
        if (committed) {
            this.onUiChanged();
        }
    }

    private positionColorPalette(): void {
        if (!this.colorPaletteRoot) {
            return;
        }
        const rect = this.colorPaletteAnchorRect;
        if (!rect) {
            return;
        }
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const paletteWidth = 244;
        const paletteHeight = 232;
        const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - paletteWidth - 8));
        const top = rect.bottom + 4 + paletteHeight > viewportHeight
            ? Math.max(8, rect.top - paletteHeight - 6)
            : rect.bottom + 4;
        this.colorPaletteRoot.style.left = `${left}px`;
        this.colorPaletteRoot.style.top = `${top}px`;
    }


    private isTransparentColorValue(rawValue: string): boolean {
        return rawValue.trim().toLowerCase() === TRANSPARENT_COLOR_VALUE;
    }

    private resolveSwatchBackground(rawValue: string): string {
        if (this.isTransparentColorValue(rawValue)) {
            return 'repeating-linear-gradient(45deg, #d8d8d8 0px, #d8d8d8 4px, #f4f4f4 4px, #f4f4f4 8px)';
        }
        return this.normalizeHexColorForPicker(rawValue);
    }

    private onColorPickerPointerMove: ((event: PointerEvent) => void) | null = null;
    private onColorPickerPointerUp: (() => void) | null = null;
    private readonly handleColorPickerPointerMove = (event: PointerEvent): void => {
        this.onColorPickerPointerMove?.(event);
    };
    private readonly handleColorPickerPointerUp = (): void => {
        this.onColorPickerPointerUp?.();
    };

    private readAnchorRect(anchor: HTMLElement): { left: number; top: number; width: number; height: number; bottom: number } {
        const rect = anchor.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom };
    }

    private ensureColorPickPreview(): void {
        if (this.colorPickPreviewRoot) {
            return;
        }
        const root = document.createElement('div');
        root.style.position = 'fixed';
        root.style.zIndex = '21000';
        root.style.pointerEvents = 'none';
        root.style.display = 'none';
        root.style.alignItems = 'center';
        root.style.gap = '6px';
        root.style.padding = '4px 6px';
        root.style.border = '1px solid rgba(0,0,0,0.45)';
        root.style.background = 'rgba(245,245,245,0.96)';
        root.style.borderRadius = '12px';

        const swatch = document.createElement('div');
        swatch.style.width = '18px';
        swatch.style.height = '18px';
        swatch.style.borderRadius = '50%';
        swatch.style.border = '1px solid rgba(0,0,0,0.5)';
        swatch.style.boxSizing = 'border-box';

        const hex = document.createElement('div');
        hex.style.fontSize = '11px';
        hex.style.fontFamily = 'monospace';
        hex.style.color = '#111';

        root.appendChild(swatch);
        root.appendChild(hex);
        document.body.appendChild(root);
        this.colorPickPreviewRoot = root;
        this.colorPickPreviewSwatch = swatch;
        this.colorPickPreviewHex = hex;
    }

    private destroyColorPickPreview(): void {
        if (this.colorPickPreviewRoot?.parentElement) {
            this.colorPickPreviewRoot.parentElement.removeChild(this.colorPickPreviewRoot);
        }
        this.colorPickPreviewRoot = null;
        this.colorPickPreviewSwatch = null;
        this.colorPickPreviewHex = null;
    }

    private updateColorPickPreview(worldX: number, worldY: number): void {
        if (!this.activeColorPaletteField) {
            this.destroyColorPickPreview();
            return;
        }
        this.ensureColorPickPreview();
        const pointer = this.scene.input.activePointer;
        const canvasRect = this.scene.game.canvas.getBoundingClientRect();
        const canvasX = pointer.x;
        const canvasY = pointer.y;
        const isOverCanvas = canvasX >= 0
            && canvasY >= 0
            && canvasX <= this.scene.scale.width
            && canvasY <= this.scene.scale.height;
        if (!this.colorPickPreviewRoot || !this.colorPickPreviewSwatch || !this.colorPickPreviewHex || !isOverCanvas) {
            if (this.colorPickPreviewRoot) {
                this.colorPickPreviewRoot.style.display = 'none';
            }
            return;
        }
        const sample = this.sampleColorForPaletteField(this.activeColorPaletteField, worldX, worldY);
        this.updateColorPickPreviewAtClientPoint(
            Math.round(canvasRect.left + canvasX),
            Math.round(canvasRect.top + canvasY),
            sample
        );
    }

    private sampleColorForPaletteField(
        field: EditableVisualColorField,
        worldX: number,
        worldY: number
    ): ObjectColorPickSample {
        const sampledObjectId = this.findObjectIdAtPoint(worldX, worldY);
        if (!sampledObjectId) {
            return {
                source: 'unavailable',
                colorSource: 'unavailable',
                sourceObjectId: null,
                sourceValue: null,
                runtimeValue: null,
                projectStoreValue: null,
                isProjectStoreDefault: false,
                success: false,
                reason: 'No object under cursor.'
            };
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const sampledObject = this.projectStore.getObject(activeLevel.id, sampledObjectId);
        if (!sampledObject) {
            return {
                source: 'unavailable',
                colorSource: 'unavailable',
                sourceObjectId: sampledObjectId,
                sourceValue: null,
                runtimeValue: null,
                projectStoreValue: null,
                isProjectStoreDefault: false,
                success: false,
                reason: 'Sampled object not found.'
            };
        }
        const projectStoreColor = field === 'fillColor'
            ? sampledObject.visual.fillColor
            : sampledObject.visual.strokeColor;
        const runtimeVisual = this.legacyObjectAdapter?.getRuntimeVisual(sampledObjectId) ?? null;
        const runtimeColorRaw = field === 'fillColor' ? runtimeVisual?.fillColor : runtimeVisual?.strokeColor;
        const runtimeColor = this.normalizePickerColorValue(runtimeColorRaw);
        const projectStoreNormalized = this.normalizePickerColorValue(projectStoreColor);
        const isProjectStoreDefault = this.isDefaultAuthoringColor(field, projectStoreNormalized);

        if (runtimeColor) {
            return {
                source: 'objectVisualFallback',
                colorSource: 'runtimeVisual',
                sourceObjectId: sampledObjectId,
                sourceValue: runtimeColor,
                runtimeValue: runtimeColor,
                projectStoreValue: projectStoreNormalized,
                isProjectStoreDefault,
                success: true
            };
        }
        if (projectStoreNormalized && !isProjectStoreDefault) {
            return {
                source: 'objectVisualFallback',
                colorSource: 'projectStoreEditedVisual',
                sourceObjectId: sampledObjectId,
                sourceValue: projectStoreNormalized,
                runtimeValue: null,
                projectStoreValue: projectStoreNormalized,
                isProjectStoreDefault,
                success: true
            };
        }
        return {
            source: 'unavailable',
            colorSource: 'unavailable',
            sourceObjectId: sampledObjectId,
            sourceValue: null,
            runtimeValue: null,
            projectStoreValue: projectStoreNormalized,
            isProjectStoreDefault,
            success: false,
            reason: runtimeVisual ? `No runtime color @${sampledObjectId}` : `No color @${sampledObjectId}`
        };
    }

    private sampleColorAtClientPointForPalette(clientX: number, clientY: number): { sample: ObjectColorPickSample; worldX: number | null; worldY: number | null } {
        if (!this.activeColorPaletteField) {
            return {
                sample: {
                    source: 'unavailable',
                    colorSource: 'unavailable',
                    sourceObjectId: null,
                    sourceValue: null,
                    runtimeValue: null,
                    projectStoreValue: null,
                    isProjectStoreDefault: false,
                    success: false,
                    reason: 'Palette is closed.'
                },
                worldX: null,
                worldY: null
            };
        }
        const canvas = this.scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return {
                sample: {
                    source: 'unavailable',
                    colorSource: 'unavailable',
                    sourceObjectId: null,
                    sourceValue: null,
                    runtimeValue: null,
                    projectStoreValue: null,
                    isProjectStoreDefault: false,
                    success: false,
                    reason: 'Canvas has invalid bounds.'
                },
                worldX: null,
                worldY: null
            };
        }
        const isInside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
        if (!isInside) {
            return {
                sample: {
                    source: 'unavailable',
                    colorSource: 'unavailable',
                    sourceObjectId: null,
                    sourceValue: null,
                    runtimeValue: null,
                    projectStoreValue: null,
                    isProjectStoreDefault: false,
                    success: false,
                    reason: 'Pointer is outside canvas.'
                },
                worldX: null,
                worldY: null
            };
        }
        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
        const worldPoint = this.scene.cameras.main.getWorldPoint(canvasX, canvasY);
        const sample = this.sampleColorForPaletteField(this.activeColorPaletteField, worldPoint.x, worldPoint.y);
        return { sample, worldX: worldPoint.x, worldY: worldPoint.y };
    }

    private updateColorPickPreviewAtClientPoint(clientX: number, clientY: number, sample: ObjectColorPickSample): void {
        if (!this.colorPickPreviewRoot || !this.colorPickPreviewSwatch || !this.colorPickPreviewHex) {
            return;
        }
        this.colorPickPreviewRoot.style.display = 'inline-flex';
        this.colorPickPreviewRoot.style.left = `${Math.round(clientX + 16)}px`;
        this.colorPickPreviewRoot.style.top = `${Math.round(clientY + 16)}px`;
        if (sample.success && sample.sourceValue) {
            this.colorPickPreviewSwatch.style.background = this.resolveSwatchBackground(sample.sourceValue);
            const sourceIdSuffix = sample.sourceObjectId ? ` @${sample.sourceObjectId}` : '';
            this.colorPickPreviewHex.textContent = `${sample.sourceValue}${sourceIdSuffix}`;
            return;
        }
        this.colorPickPreviewSwatch.style.background = 'repeating-linear-gradient(45deg, #d8d8d8 0px, #d8d8d8 4px, #f4f4f4 4px, #f4f4f4 8px)';
        this.colorPickPreviewHex.textContent = sample.reason ?? 'No color';
    }

    private normalizePickerColorValue(rawValue: string | undefined | null): string | null {
        if (!rawValue) {
            return null;
        }
        const trimmed = rawValue.trim().toLowerCase();
        if (trimmed === TRANSPARENT_COLOR_VALUE) {
            return TRANSPARENT_COLOR_VALUE;
        }
        return this.normalizeHexLikeColor(rawValue);
    }

    private isDefaultAuthoringColor(field: EditableVisualColorField, value: string | null): boolean {
        if (!value) {
            return false;
        }
        const normalized = value.trim().toLowerCase();
        if (field === 'fillColor') {
            return normalized === DEFAULT_AUTHORING_FILL_COLOR;
        }
        return normalized === DEFAULT_AUTHORING_STROKE_COLOR;
    }

    private hsvToHex(hsv: { h: number; s: number; v: number }): string {
        const h = ((hsv.h % 360) + 360) % 360;
        const s = Phaser.Math.Clamp(hsv.s, 0, 1);
        const v = Phaser.Math.Clamp(hsv.v, 0, 1);
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        let r = 0;
        let g = 0;
        let b = 0;
        if (h < 60) {
            r = c; g = x; b = 0;
        } else if (h < 120) {
            r = x; g = c; b = 0;
        } else if (h < 180) {
            r = 0; g = c; b = x;
        } else if (h < 240) {
            r = 0; g = x; b = c;
        } else if (h < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        const toHex = (value: number): string => {
            const intValue = Math.round((value + m) * 255);
            return intValue.toString(16).padStart(2, '0');
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    private hexToHsv(color: string): { h: number; s: number; v: number } {
        const normalized = this.normalizeHexLikeColor(color) ?? '#ffffff';
        const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
        const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
        const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        let h = 0;
        if (delta !== 0) {
            if (max === r) {
                h = 60 * (((g - b) / delta) % 6);
            } else if (max === g) {
                h = 60 * (((b - r) / delta) + 2);
            } else {
                h = 60 * (((r - g) / delta) + 4);
            }
        }
        if (h < 0) {
            h += 360;
        }
        const s = max === 0 ? 0 : delta / max;
        const v = max;
        return { h, s, v };
    }

    private commitSelectedObjectVisualTextField(field: EditableVisualTextField, rawValue: string): boolean {
        const trimmed = rawValue.trim();
        const nextValue = trimmed.length > 0 ? rawValue : null;
        return this.commitSelectedObjectVisualPatch({
            [field]: nextValue
        } as Partial<EditorObjectVisualData>);
    }

    private commitSelectedObjectVisualColorField(field: EditableVisualColorField, rawValue: string): boolean {
        const normalizedColor = this.normalizeVisualColorValue(rawValue);
        if (!normalizedColor) {
            return false;
        }
        return this.commitSelectedObjectBasicVisualPatch({
            [field]: normalizedColor
        } as UpdateObjectVisualPatch);
    }

    private commitSelectedObjectVisualAlpha(rawValue: string): boolean {
        const parsed = Number(rawValue.trim());
        if (!Number.isFinite(parsed)) {
            return false;
        }
        const clamped = Phaser.Math.Clamp(parsed, 0, 1);
        return this.commitSelectedObjectBasicVisualPatch({
            alpha: clamped
        });
    }

    private commitSelectedObjectVisualLayer(rawValue: string): boolean {
        const parsed = Number(rawValue.trim());
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
            return false;
        }
        if (!LAYER_OPTIONS.includes(parsed as (typeof LAYER_OPTIONS)[number])) {
            return false;
        }
        return this.commitSelectedObjectBasicVisualPatch({
            layer: parsed
        });
    }

    private commitSelectedObjectBasicVisualPatch(patch: UpdateObjectVisualPatch): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return false;
        }
        return this.commitObjectBasicVisualPatch(selectedId, patch);
    }

    private commitObjectBasicVisualPatch(objectId: string, patch: UpdateObjectVisualPatch): boolean {
        const updateResult = this.objectAuthoringService.updateObjectVisual(objectId, patch);
        if (!updateResult.success) {
            return false;
        }
        this.refreshLiveObjects('visual-update');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return true;
    }

    private commitSelectedObjectVisualOnlyDebugView(onlyDebugView: boolean): boolean {
        return this.commitSelectedObjectVisualPatch({ onlyDebugView });
    }

    private commitSelectedObjectVisualPatch(patch: Partial<EditorObjectVisualData>): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return false;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const current = this.projectStore.getObject(activeLevel.id, selectedId);
        if (!current) {
            return false;
        }

        let changed = false;
        const nextVisual: Partial<EditorObjectVisualData> = {};
        (Object.keys(patch) as Array<keyof EditorObjectVisualData>).forEach((field) => {
            const nextValue = patch[field];
            if (nextValue === undefined || current.visual[field] === nextValue) {
                return;
            }
            changed = true;
            (nextVisual as Record<string, unknown>)[field] = nextValue;
        });
        if (!changed) {
            return false;
        }

        const nextObject = this.projectStore.updateObject(activeLevel.id, selectedId, {
            visual: nextVisual
        });
        this.applyRuntimeVisualPatch(nextObject, nextVisual);
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return true;
    }

    private applyRuntimeVisualPatch(
        objectData: EditorObjectData,
        patch: Partial<EditorObjectVisualData>
    ): void {
        if (!this.legacyObjectAdapter?.hasRuntimeLink(objectData.id)) {
            return;
        }

        if (patch.fillColor !== undefined || patch.strokeColor !== undefined) {
            const colorsPatch: Record<string, unknown> = {};
            const fillColor = patch.fillColor !== undefined
                ? this.parseHexColorToRgbInt(patch.fillColor)
                : null;
            const strokeColor = patch.strokeColor !== undefined
                ? this.parseHexColorToRgbInt(patch.strokeColor)
                : null;

            if (fillColor !== null) {
                colorsPatch.fillColor = fillColor;
            }
            if (strokeColor !== null) {
                colorsPatch.strokeColor = strokeColor;
            }
            if (Object.keys(colorsPatch).length > 0) {
                this.legacyObjectAdapter.patchRuntimeObjectColors(objectData.id, colorsPatch);
            }
        }

        const fieldsPatch: Record<string, unknown> = {};
        if (patch.alpha !== undefined) {
            fieldsPatch.alpha = patch.alpha;
        }
        if (patch.layer !== undefined) {
            const runtimeVisualLayer = this.mapLayerToRuntimeVisualLayer(patch.layer);
            if (runtimeVisualLayer) {
                fieldsPatch.visualLayer = runtimeVisualLayer;
            }
        }
        if (Object.keys(fieldsPatch).length > 0) {
            this.legacyObjectAdapter.patchRuntimeObjectFields(objectData.id, fieldsPatch);
        }

        if (patch.onlyDebugView !== undefined) {
            this.legacyObjectAdapter.patchRuntimeObjectDebugVisibility(objectData.id, patch.onlyDebugView);
        }
        // TODO(authoring-step-4.2): legacy runtime bridge has no safe shader/texture sync path yet.
    }

    private normalizeHexLikeColor(rawValue: string): string | null {
        const trimmed = rawValue.trim();
        if (!HEX_COLOR_LIKE_PATTERN.test(trimmed)) {
            return null;
        }
        const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
        let rgbHex: string;
        if (normalized.length === 3 || normalized.length === 4) {
            rgbHex = `${normalized[0]}${normalized[0]}${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}`;
        } else {
            rgbHex = normalized.slice(0, 6);
        }
        return `#${rgbHex.toLowerCase()}`;
    }

    private normalizeVisualColorValue(rawValue: string): string | null {
        const trimmed = rawValue.trim().toLowerCase();
        if (trimmed === TRANSPARENT_COLOR_VALUE) {
            return TRANSPARENT_COLOR_VALUE;
        }
        return this.normalizeHexLikeColor(rawValue);
    }

    private parseHexColorToRgbInt(color: string): number | null {
        const normalized = this.normalizeHexLikeColor(color);
        if (!normalized) {
            return null;
        }
        return Number.parseInt(normalized.slice(1), 16);
    }

    private normalizeHexColorForPicker(rawValue: string): string {
        return this.normalizeHexLikeColor(rawValue) ?? '#000000';
    }

    private mapLayerToRuntimeVisualLayer(layer: number): string | null {
        if (Number.isInteger(layer) && layer >= 1 && layer <= 5) {
            return `layer_${layer}`;
        }
        // TODO(authoring-step-4.2): runtime layer mapping currently supports layer_1..layer_5 only.
        return null;
    }

    private formatNumber(value: number): string {
        return Number.isFinite(value) ? String(value) : '0';
    }

    private getSelectedVisualTextFieldValue(field: EditableVisualTextField): string | null {
        const selected = this.getSelectedObjectData();
        return selected ? selected.visual[field] : null;
    }

    private getSelectedVisualColorFieldValue(field: EditableVisualColorField): string {
        const selected = this.getSelectedObjectData();
        if (!selected) {
            return '#000000';
        }
        return selected.visual[field];
    }

    private getSelectedVisualNumericFieldValue(field: 'alpha' | 'layer'): number {
        const selected = this.getSelectedObjectData();
        if (!selected) {
            return field === 'alpha' ? 1 : 3;
        }
        return selected.visual[field];
    }

    private resolveInspectorLayerValue(rawLayer: number): number {
        if (!Number.isFinite(rawLayer) || !Number.isInteger(rawLayer)) {
            return 3;
        }
        if (!LAYER_OPTIONS.includes(rawLayer as (typeof LAYER_OPTIONS)[number])) {
            return 3;
        }
        return rawLayer;
    }

    private getSelectedVisualOnlyDebugViewValue(): boolean {
        return this.getSelectedObjectData()?.visual.onlyDebugView ?? false;
    }

    private getSelectedObjectData(): EditorObjectData | null {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return null;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        return this.projectStore.getObject(activeLevel.id, selectedId) ?? null;
    }

    private snap(value: number, gridSize: number): number {
        if (!this.context.grid.snapEnabled) {
            return value;
        }
        const size = Math.max(1, Math.round(gridSize));
        if (size <= 1) {
            return value;
        }
        return Math.round(value / size) * size;
    }

    private snapEdge(value: number, gridSize: number): number {
        return this.snap(value, gridSize);
    }

    private getActiveObjects(): EditorObjectData[] {
        return this.liveObjects;
    }

    private getObjectsInActiveCategory(objects: readonly EditorObjectData[]): EditorObjectData[] {
        return objects.filter((objectData) => objectData.settings.category === this.activeCatalogCategory);
    }

    private syncViewsFromStore(): void {
        const objects = this.getActiveObjects();
        const activeIds = new Set(
            objects
                .filter((item) => !this.legacyObjectAdapter?.hasRuntimeLink(item.id))
                .filter((item) => !this.isKnownRuntimeType(item.settings.type))
                .map((item) => item.id)
        );

        for (const [objectId, view] of this.objectViews.entries()) {
            if (!activeIds.has(objectId)) {
                view.destroy();
                this.objectViews.delete(objectId);
            }
        }

        objects.forEach((objectData) => {
            if (this.legacyObjectAdapter?.hasRuntimeLink(objectData.id)) {
                return;
            }
            if (this.isKnownRuntimeType(objectData.settings.type)) {
                return;
            }
            let view = this.objectViews.get(objectData.id);
            if (!view) {
                view = this.scene.add.rectangle(0, 0, 1, 1, 0x77aaff, 0.45);
                view.setOrigin(0, 0);
                view.setDepth(5100);
                this.objectViews.set(objectData.id, view);
            }
            const fillColor = this.parseHexColorToRgbInt(objectData.visual.fillColor) ?? 0x77aaff;
            const strokeColor = this.parseHexColorToRgbInt(objectData.visual.strokeColor) ?? 0x222222;
            const hasTransparentFill = objectData.visual.fillColor.trim().toLowerCase() === TRANSPARENT_COLOR_VALUE;
            const hasTransparentStroke = objectData.visual.strokeColor.trim().toLowerCase() === TRANSPARENT_COLOR_VALUE;
            view.setPosition(objectData.bounds.x, objectData.bounds.y);
            view.setSize(objectData.bounds.width, objectData.bounds.height);
            view.setFillStyle(fillColor, hasTransparentFill ? 0 : objectData.visual.alpha);
            view.setStrokeStyle(
                hasTransparentStroke ? 0 : 1,
                strokeColor,
                hasTransparentStroke ? 0 : Math.max(0.15, objectData.visual.alpha)
            );
            view.setRotation(Phaser.Math.DegToRad(objectData.bounds.rotation));
        });
    }

    private syncSelectionOutline(): void {
        this.selectionOutline.clear();
        if (!this.selectedObjectId) {
            this.selectionOutline.setVisible(false);
            return;
        }
        const selected = this.getActiveObjects().find((obj) => obj.id === this.selectedObjectId);
        if (!selected) {
            this.selectedObjectId = null;
            this.selectionOutline.setVisible(false);
            return;
        }
        const moveRuntimeDebug = this.getSurfaceMoveRuntimeDebugEntry(selected.id);
        const isLocked = this.isObjectLocked(selected);
        this.selectionOutline.setVisible(true);
        const runtimeActive = moveRuntimeDebug?.moverActive === true;
        const liveBounds = runtimeActive
            ? {
                x: moveRuntimeDebug.currentX - (selected.bounds.width * 0.5),
                y: moveRuntimeDebug.currentY - (selected.bounds.height * 0.5),
                width: selected.bounds.width,
                height: selected.bounds.height
            }
            : selected.bounds;
        this.selectionOutline.lineStyle(2, isLocked ? 0xff5555 : 0xffff00, 1);
        this.selectionOutline.strokeRect(
            liveBounds.x,
            liveBounds.y,
            liveBounds.width,
            liveBounds.height
        );
        if (runtimeActive) {
            this.selectionOutline.lineStyle(1, 0x00bcd4, 1);
            this.selectionOutline.strokeRect(
                selected.bounds.x,
                selected.bounds.y,
                selected.bounds.width,
                selected.bounds.height
            );
            const originX = moveRuntimeDebug.originX;
            const originY = moveRuntimeDebug.originY;
            this.selectionOutline.lineStyle(1, 0x00bcd4, 1);
            this.selectionOutline.strokeLineShape(new Phaser.Geom.Line(originX - 10, originY, originX + 10, originY));
            this.selectionOutline.strokeLineShape(new Phaser.Geom.Line(originX, originY - 10, originX, originY + 10));
            if (isLocked) {
                return;
            }
            this.selectionOutline.fillStyle(0x00bcd4, 1);
            for (const point of this.getResizeHandlePoints(selected.bounds)) {
                this.selectionOutline.fillRect(
                    point.x - (RESIZE_HANDLE_SIZE * 0.5),
                    point.y - (RESIZE_HANDLE_SIZE * 0.5),
                    RESIZE_HANDLE_SIZE,
                    RESIZE_HANDLE_SIZE
                );
            }
            return;
        }
        if (isLocked) {
            return;
        }
        this.selectionOutline.fillStyle(0xffff00, 1);
        for (const point of this.getResizeHandlePoints(selected.bounds)) {
            this.selectionOutline.fillRect(
                point.x - (RESIZE_HANDLE_SIZE * 0.5),
                point.y - (RESIZE_HANDLE_SIZE * 0.5),
                RESIZE_HANDLE_SIZE,
                RESIZE_HANDLE_SIZE
            );
        }
    }

    private findObjectIdAtPoint(worldX: number, worldY: number): string | null {
        this.refreshLiveObjects('hit-test');
        const objects = this.getActiveObjects();
        const bridgedObjectId = this.legacyObjectAdapter?.findObjectIdAtPoint(worldX, worldY) ?? null;
        if (bridgedObjectId) {
            if (objects.some((item) => item.id === bridgedObjectId)) {
                return bridgedObjectId;
            }
        }

        for (let i = objects.length - 1; i >= 0; i -= 1) {
            const object = objects[i];
            const withinX = worldX >= object.bounds.x && worldX <= object.bounds.x + object.bounds.width;
            const withinY = worldY >= object.bounds.y && worldY <= object.bounds.y + object.bounds.height;
            if (withinX && withinY) {
                return object.id;
            }
        }
        return null;
    }

    private syncFromLegacyBridge(reason: string): void {
        this.refreshLiveObjects(reason);
    }

    private refreshLiveObjects(reason: string): void {
        if (this.syncInProgress) {
            this.syncQueued = true;
            return;
        }
        this.syncInProgress = true;
        try {
            const beforeIds = new Set(this.liveObjects.map((item) => item.id));
            const nextObjects = this.objectAuthoringService.listObjects();
            const imported = nextObjects.filter((item) => !beforeIds.has(item.id));
            this.liveObjects = nextObjects;
            const activeLevelId = this.projectStore.getActiveLevel().id;
            const projectStoreObjects = this.projectStore.listObjects(activeLevelId);
            const serviceBreakWallCount = this.countBreakWalls(nextObjects);
            const storeBreakWallCount = this.countBreakWalls(projectStoreObjects);
            const breakWallSummaryPayload = {
                reason,
                totalBreakWallObjectsInServiceList: serviceBreakWallCount,
                totalBreakWallObjectsInProjectStore: storeBreakWallCount,
                totalDisplayedBreakWallObjects: serviceBreakWallCount
            };
            const nextBreakWallSummaryDiagKey = JSON.stringify(breakWallSummaryPayload);
            if (this.lastBreakWallSummaryDiagKey !== nextBreakWallSummaryDiagKey) {
                this.lastBreakWallSummaryDiagKey = nextBreakWallSummaryDiagKey;
                objectDiag('[BreakWall:summary]', breakWallSummaryPayload);
            }
            if (this.selectedObjectId && !nextObjects.some((item) => item.id === this.selectedObjectId)) {
                this.clearTransientStateForObject(this.selectedObjectId);
            }
            const liveIds = new Set(nextObjects.map((item) => item.id));
            this.objectViews.forEach((view, id) => {
                if (liveIds.has(id)) {
                    return;
                }
                view.destroy();
                this.objectViews.delete(id);
            });
            this.debugLog(
                `sync:end reason=${reason} live=${nextObjects.length} imported=[${imported.map((item) => `${item.id}:${item.settings.type}`).join(', ')}]`
            );
        } finally {
            this.syncInProgress = false;
            if (this.syncQueued) {
                this.syncQueued = false;
                this.refreshLiveObjects('queued');
            }
        }
    }

    private applyDebugVisibilityToRuntimeLinks(): void {
        if (!this.legacyObjectAdapter) {
            return;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const objects = this.projectStore.listObjects(activeLevel.id);
        const activeObjectIds = new Set(objects.map((entry) => entry.id));
        Array.from(this.lastAppliedRuntimeDebugVisibilityByObjectId.keys()).forEach((objectId) => {
            if (!activeObjectIds.has(objectId)) {
                this.lastAppliedRuntimeDebugVisibilityByObjectId.delete(objectId);
            }
        });
        objects.forEach((objectData) => {
            if (!this.legacyObjectAdapter?.hasRuntimeLink(objectData.id)) {
                return;
            }
            const nextOnlyDebugView = objectData.visual.onlyDebugView;
            const previousOnlyDebugView = this.lastAppliedRuntimeDebugVisibilityByObjectId.get(objectData.id);
            if (previousOnlyDebugView === nextOnlyDebugView) {
                return;
            }
            const applied = this.legacyObjectAdapter.patchRuntimeObjectDebugVisibility(
                objectData.id,
                nextOnlyDebugView
            );
            if (applied) {
                this.lastAppliedRuntimeDebugVisibilityByObjectId.set(objectData.id, nextOnlyDebugView);
            }
        });
    }

    private resolveObjectType(typeId: string): ObjectTypeDefinition | undefined {
        const resolvedTypeId = this.objectTypeRegistry.resolveId(typeId) ?? typeId;
        return this.objectTypeRegistry.getDefinition(resolvedTypeId);
    }

    private ensureSelectedTypeMatchesActiveCategory(): void {
        if (!this.selectedTypeId) {
            return;
        }
        const definition = this.resolveObjectType(this.selectedTypeId);
        if (!definition || definition.category !== this.activeCatalogCategory) {
            this.selectedTypeId = null;
        }
    }

    private isKnownRuntimeType(typeId: string): boolean {
        const resolved = this.objectTypeRegistry.resolveId(typeId) ?? typeId;
        return KNOWN_RUNTIME_OBJECT_TYPES.has(resolved);
    }

    private countBreakWalls(objects: readonly EditorObjectData[]): number {
        return objects.filter((item) => {
            const typeId = this.objectTypeRegistry.resolveId(item.settings.type) ?? item.settings.type;
            return typeId === 'break_wall' || typeId === 'breakable_wall';
        }).length;
    }

    private debugLog(message: string): void {
        if (!DEBUG_OBJECT_BRIDGE) {
            return;
        }
        console.info(`[ObjectsEditorMode] ${message}`);
    }

    private clearTransientStateForObject(objectId: string | null): void {
        if (!objectId) {
            return;
        }
        if (this.surfaceMoveEditObjectId === objectId) {
            this.endSurfaceMoveAuthoringEdit('clear-transient');
        }
        if (this.selectedObjectId === objectId) {
            this.selectedObjectId = null;
        }
        if (this.draggingObjectId === objectId) {
            this.draggingObjectId = null;
        }
        if (this.resizeDragState?.objectId === objectId) {
            this.resizeDragState = null;
        }
        if (this.colorPaletteObjectId === objectId) {
            this.closeColorPalette();
        }
        if (this.objectLogicBindingCreateFormObjectId === objectId) {
            this.resetObjectLogicBindingCreateForm();
        }
        this.activePointerButton = null;
    }

    private staleDeletedIdsCount(objects: readonly EditorObjectData[]): number {
        const liveIds = new Set(objects.map((item) => item.id));
        let staleCount = 0;
        this.objectViews.forEach((_, id) => {
            if (!liveIds.has(id)) {
                staleCount += 1;
            }
        });
        return staleCount;
    }

    private trySelectCreatedObject(createdObjectId: string, reason: 'create' | 'paste' | 'duplicate'): EditorObjectData | null {
        this.refreshLiveObjects(`${reason}:post-create-select`);
        const objects = this.getActiveObjects();
        const selected = objects.find((item) => item.id === createdObjectId) ?? null;
        if (!selected) {
            this.clearTransientStateForObject(createdObjectId);
            objectDiag('[ObjectCreate:postSelect]', {
                createdObjectId,
                selectedObjectId: null,
                selectedExistsInServiceList: false,
                hasRuntimeLink: false,
                staleDeletedIdsCount: this.staleDeletedIdsCount(objects),
                success: false,
                reason: 'created_id_not_found_in_service_list'
            });
            console.warn(`[ObjectsEditorMode] Created object "${createdObjectId}" was not found after create; selection cleared.`);
            return null;
        }
        const hasRuntimeLink = this.legacyObjectAdapter?.hasRuntimeLink(createdObjectId) ?? false;
        this.selectedObjectId = selected.id;
        this.selectedTypeId = null;
        this.draggingObjectId = null;
        this.resizeDragState = null;
        this.syncSelectionOutline();
        objectDiag('[ObjectCreate:postSelect]', {
            createdObjectId,
            selectedObjectId: this.selectedObjectId,
            selectedExistsInServiceList: true,
            hasRuntimeLink,
            staleDeletedIdsCount: this.staleDeletedIdsCount(objects),
            success: true,
            reason: null
        });
        return selected;
    }

    private getResizeHandlePoints(bounds: EditorObjectBoundsData): Array<{ handle: ResizeHandle; x: number; y: number }> {
        const left = bounds.x;
        const right = bounds.x + bounds.width;
        const top = bounds.y;
        const bottom = bounds.y + bounds.height;
        const centerX = bounds.x + (bounds.width * 0.5);
        const centerY = bounds.y + (bounds.height * 0.5);
        return [
            { handle: 'top-left', x: left, y: top },
            { handle: 'top', x: centerX, y: top },
            { handle: 'top-right', x: right, y: top },
            { handle: 'right', x: right, y: centerY },
            { handle: 'bottom-right', x: right, y: bottom },
            { handle: 'bottom', x: centerX, y: bottom },
            { handle: 'bottom-left', x: left, y: bottom },
            { handle: 'left', x: left, y: centerY }
        ];
    }

    private findResizeHandleAtPoint(worldX: number, worldY: number): { objectId: string; handle: ResizeHandle } | null {
        if (!this.selectedObjectId) {
            return null;
        }
        const selected = this.getActiveObjects().find((item) => item.id === this.selectedObjectId);
        if (!selected) {
            return null;
        }
        if (this.isObjectLocked(selected)) {
            return null;
        }
        const rotation = Number.isFinite(selected.bounds.rotation) ? selected.bounds.rotation : 0;
        if (Math.abs(rotation) > 0.0001) {
            return null;
        }
        const points = this.getResizeHandlePoints(selected.bounds);
        for (const point of points) {
            const withinX = Math.abs(worldX - point.x) <= RESIZE_HANDLE_HIT_RADIUS;
            const withinY = Math.abs(worldY - point.y) <= RESIZE_HANDLE_HIT_RADIUS;
            if (withinX && withinY) {
                return { objectId: selected.id, handle: point.handle };
            }
        }
        return null;
    }

    private applyResizeFromPointer(worldX: number, worldY: number, context: EditorModeRuntimeContext): void {
        const drag = this.resizeDragState;
        if (!drag) {
            return;
        }
        const current = this.getActiveObjects().find((item) => item.id === drag.objectId);
        if (!current) {
            this.endSurfaceMoveAuthoringEdit('resize-object-missing');
            this.resizeDragState = null;
            this.setSceneCursor('default');
            return;
        }
        if (this.isObjectLocked(current)) {
            this.endSurfaceMoveAuthoringEdit('resize-locked');
            this.resizeDragState = null;
            this.setSceneCursor('default');
            return;
        }
        const rotation = Number.isFinite(current.bounds.rotation) ? current.bounds.rotation : 0;
        if (Math.abs(rotation) > 0.0001) {
            objectDiag('[ObjectResize:update]', {
                objectId: current.id,
                handle: drag.handle,
                nextBounds: { ...current.bounds },
                success: false,
                reason: 'Rotated resize not implemented yet.'
            });
            return;
        }

        const startLeft = drag.startBounds.x;
        const startTop = drag.startBounds.y;
        const startRight = drag.startBounds.x + drag.startBounds.width;
        const startBottom = drag.startBounds.y + drag.startBounds.height;

        let left = startLeft;
        let right = startRight;
        let top = startTop;
        let bottom = startBottom;
        const size = context.grid.size;

        if (drag.handle.includes('left')) {
            left = this.snapEdge(worldX, size);
            if ((right - left) < MIN_RESIZE_SIZE) {
                left = right - MIN_RESIZE_SIZE;
            }
        }
        if (drag.handle.includes('right')) {
            right = this.snapEdge(worldX, size);
            if ((right - left) < MIN_RESIZE_SIZE) {
                right = left + MIN_RESIZE_SIZE;
            }
        }
        if (drag.handle.includes('top')) {
            top = this.snapEdge(worldY, size);
            if ((bottom - top) < MIN_RESIZE_SIZE) {
                top = bottom - MIN_RESIZE_SIZE;
            }
        }
        if (drag.handle.includes('bottom')) {
            bottom = this.snapEdge(worldY, size);
            if ((bottom - top) < MIN_RESIZE_SIZE) {
                bottom = top + MIN_RESIZE_SIZE;
            }
        }

        const nextBounds: EditorObjectBoundsData = {
            x: left,
            y: top,
            width: Math.max(MIN_RESIZE_SIZE, right - left),
            height: Math.max(MIN_RESIZE_SIZE, bottom - top),
            rotation: drag.startBounds.rotation
        };

        const updateResult = this.objectAuthoringService.updateObjectBounds(current.id, nextBounds);
        objectDiag('[ObjectResize:update]', {
            objectId: current.id,
            handle: drag.handle,
            nextBounds,
            success: updateResult.success,
            reason: updateResult.reason ?? null
        });
        if (!updateResult.success) {
            this.refreshLiveObjects('resize-failed');
            this.syncViewsFromStore();
            this.syncSelectionOutline();
            this.onUiChanged();
            return;
        }
        this.refreshLiveObjects('resize');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    private updateResizeCursor(worldX: number, worldY: number): void {
        const hit = this.findResizeHandleAtPoint(worldX, worldY);
        if (!hit) {
            this.setSceneCursor('default');
            return;
        }
        this.setSceneCursor(this.getHandleCursor(hit.handle));
    }

    private getHandleCursor(handle: ResizeHandle): string {
        if (handle === 'left' || handle === 'right') {
            return 'ew-resize';
        }
        if (handle === 'top' || handle === 'bottom') {
            return 'ns-resize';
        }
        if (handle === 'top-left' || handle === 'bottom-right') {
            return 'nwse-resize';
        }
        return 'nesw-resize';
    }

    private setSceneCursor(cursor: string): void {
        const canvas = this.scene.input.manager.canvas;
        if (canvas.style.cursor !== cursor) {
            canvas.style.cursor = cursor;
        }
    }

    private matchesSearch(objectData: EditorObjectData, searchValue: string): boolean {
        const query = searchValue.trim().toLowerCase();
        if (query.length === 0) {
            return true;
        }
        return objectData.name.toLowerCase().includes(query)
            || objectData.id.toLowerCase().includes(query)
            || objectData.settings.type.toLowerCase().includes(query);
    }

    private buildNearestObjectsForHitTest(
        worldX: number,
        worldY: number,
        limit = 5
    ): Array<{
        id: string;
        type: string;
        category: EditorObjectCategory;
        hasRuntimeLink: boolean;
        distanceToBounds: number;
        bounds: { x: number; y: number; width: number; height: number; rotation: number };
    }> {
        return this.getActiveObjects()
            .map((objectData) => {
                const { x, y, width, height, rotation } = objectData.bounds;
                const clampedX = Phaser.Math.Clamp(worldX, x, x + width);
                const clampedY = Phaser.Math.Clamp(worldY, y, y + height);
                const dx = worldX - clampedX;
                const dy = worldY - clampedY;
                return {
                    id: objectData.id,
                    type: objectData.settings.type,
                    category: objectData.settings.category,
                    hasRuntimeLink: this.legacyObjectAdapter?.hasRuntimeLink(objectData.id) ?? false,
                    distanceToBounds: Math.sqrt((dx * dx) + (dy * dy)),
                    bounds: { x, y, width, height, rotation }
                };
            })
            .sort((left, right) => left.distanceToBounds - right.distanceToBounds)
            .slice(0, Math.max(1, limit));
    }

    private makeObjectUtilityActionsRow(selectedObject: EditorObjectData): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexWrap = 'wrap';
        wrap.style.gap = '6px';
        wrap.style.marginBottom = '6px';

        const makeButton = (label: string, onClick: () => void): HTMLButtonElement => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.padding = '3px 6px';
            button.style.border = '1px solid #5f5f5f';
            button.style.background = '#d9d9d9';
            button.addEventListener('click', onClick);
            return button;
        };

        wrap.appendChild(makeButton('Focus', () => {
            this.focusObject(selectedObject);
            this.onUiChanged();
        }));
        wrap.appendChild(makeButton('Delete', () => {
            if (this.deleteSelectedObject()) {
                this.onUiChanged();
            }
        }));
        wrap.appendChild(makeButton(this.isObjectLocked(selectedObject) ? 'Unlock' : 'Lock', () => {
            if (this.toggleSelectedObjectLock()) {
                this.onUiChanged();
            }
        }));

        return wrap;
    }

    private makeBehaviorScriptsSection(selectedObject: EditorObjectData): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        wrap.style.minWidth = '0';

        const target = this.resolveBehaviorBindingTarget(selectedObject);
        if (!target) {
            wrap.appendChild(this.makeLabel('Behavior script assignment is available for default platforms/surfaces only in this XS. Moving platforms use legacy axis/travelDistance/speed runtime behavior and are not assignable here yet.'));
            return wrap;
        }

        wrap.appendChild(this.makeLabel('Move runtime v1: gameplay executes platform_move_ping_pong. Rotate/Default Action/Actions remain authoring-only in this XS.'));
        wrap.appendChild(this.makeLabel('Move runtime source: active runtime config (includes loaded Draft overrides, if any).'));

        const externalAssets = getAllLogicScriptAssets();
        const scriptById = new Map(externalAssets.map((entry) => [entry.id, entry] as const));
        const moveOptions = this.listBehaviorScriptOptions('platform.move');
        const rotateOptions = this.listBehaviorScriptOptions('platform.rotate');
        const defaultActionOptions = this.listBehaviorScriptOptions('platform.defaultAction');
        const behaviorScripts = target.behaviorScripts ?? {};
        wrap.appendChild(this.makeBehaviorScriptSelectRow(
            selectedObject,
            'Move',
            'move',
            behaviorScripts.move,
            moveOptions,
            scriptById
        ));
        wrap.appendChild(this.makeBehaviorScriptSelectRow(
            selectedObject,
            'Rotate',
            'rotate',
            behaviorScripts.rotate,
            rotateOptions,
            scriptById
        ));
        wrap.appendChild(this.makeBehaviorScriptSelectRow(
            selectedObject,
            'Default Action',
            'defaultAction',
            behaviorScripts.defaultAction,
            defaultActionOptions,
            scriptById
        ));

        const diagnostics: string[] = [];
        this.appendBehaviorScriptFieldDiagnostic(diagnostics, scriptById, behaviorScripts.move, 'Move', 'move');
        this.appendBehaviorScriptFieldDiagnostic(diagnostics, scriptById, behaviorScripts.rotate, 'Rotate', 'rotate');
        this.appendBehaviorScriptFieldDiagnostic(diagnostics, scriptById, behaviorScripts.defaultAction, 'Default Action', 'defaultAction');

        const actionsValues = Array.isArray(behaviorScripts.actions) ? behaviorScripts.actions : [];
        actionsValues.forEach((scriptId, index) => {
            const normalizedId = typeof scriptId === 'string' ? scriptId.trim() : '';
            if (normalizedId.length <= 0) {
                return;
            }
            const script = scriptById.get(normalizedId);
            if (!script) {
                diagnostics.push(`Actions[${index}] missing script asset: ${normalizedId}`);
                return;
            }
            if (script.category !== 'platform.action') {
                diagnostics.push(`Actions[${index}] category mismatch: expected platform.action, got ${script.category} (${normalizedId})`);
            }
        });

        if (diagnostics.length > 0) {
            const warning = this.makeLabel(`Behavior diagnostics: ${diagnostics.join(' | ')}`);
            warning.style.color = '#b00020';
            wrap.appendChild(warning);
        }

        const moveRuntimeDebug = this.getSurfaceMoveRuntimeDebugEntry(selectedObject.id);
        if (moveRuntimeDebug) {
            const statusLabel = this.makeLabel(this.formatSurfaceMoveRuntimeStatusLine(moveRuntimeDebug));
            const assignmentScopeLabel = this.makeLabel(this.formatSurfaceMoveRuntimeAssignmentScopeLine(selectedObject.id));
            const surfaceLabel = this.makeLabel(this.formatSurfaceMoveRuntimeSurfaceLine(moveRuntimeDebug));
            const poseLabel = this.makeLabel(this.formatSurfaceMoveRuntimePoseLine(moveRuntimeDebug));
            wrap.appendChild(statusLabel);
            wrap.appendChild(assignmentScopeLabel);
            wrap.appendChild(surfaceLabel);
            wrap.appendChild(poseLabel);
            if (moveRuntimeDebug.moverActive) {
                const note = this.makeLabel('Authoring edit note: drag/resize edits canonical authoring bounds. Move runtime is paused for this surface during the edit and resumes from the updated origin on release.');
                note.style.color = '#0d47a1';
                wrap.appendChild(note);
            }
            this.liveSurfaceMoveDebugLabels = {
                objectId: selectedObject.id,
                statusLabel,
                assignmentScopeLabel,
                surfaceLabel,
                poseLabel
            };
        }

        wrap.appendChild(this.makeLabel(`Actions list (read-only): ${actionsValues.length > 0 ? actionsValues.join(', ') : '-'}`));
        wrap.appendChild(this.makeLabel('Actions list editing is deferred in this XS to keep risk low.'));
        return wrap;
    }

    private makeBehaviorScriptSelectRow(
        selectedObject: EditorObjectData,
        label: BehaviorScriptFieldLabel,
        field: BehaviorScriptField,
        value: string | undefined,
        options: readonly BehaviorScriptOption[],
        scriptById: ReadonlyMap<string, TestWorldLogicScriptConfig>
    ): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gap = '6px';

        const text = document.createElement('div');
        text.textContent = `${label}:`;
        text.style.fontWeight = 'bold';
        text.style.overflowWrap = 'anywhere';
        text.style.wordBreak = 'break-word';
        row.appendChild(text);

        const controlsRow = document.createElement('div');
        controlsRow.style.display = 'flex';
        controlsRow.style.alignItems = 'center';
        controlsRow.style.gap = '6px';
        controlsRow.style.flexWrap = 'wrap';
        controlsRow.style.minWidth = '0';

        const select = document.createElement('select');
        select.style.flex = '1';
        select.style.minWidth = '0';
        select.style.boxSizing = 'border-box';
        select.style.border = '1px solid #5f5f5f';
        select.style.padding = '2px 4px';
        select.appendChild(new Option('(none)', ''));
        options.forEach((entry) => {
            select.appendChild(new Option(entry.label, entry.id));
        });
        if (value && !options.some((entry) => entry.id === value)) {
            const expectedCategory = BEHAVIOR_SCRIPT_CATEGORY_BY_FIELD[field];
            const script = scriptById.get(value);
            const optionLabel = !script
                ? `(missing) ${value}`
                : script.category !== expectedCategory
                    ? `(invalid category: expected ${expectedCategory}, got ${script.category}) ${value}`
                    : `(assigned) ${value}`;
            select.appendChild(new Option(optionLabel, value));
        }
        select.value = value ?? '';
        select.disabled = this.isObjectLocked(selectedObject);
        this.bindEditorInputKeyboardGuards(select);
        select.addEventListener('change', () => {
            const nextValue = select.value.trim();
            const committed = this.commitSelectedBehaviorScriptField(field, nextValue.length > 0 ? nextValue : null);
            if (!committed) {
                const refreshed = this.resolveBehaviorBindingTarget(selectedObject)?.behaviorScripts ?? {};
                select.value = (refreshed[field] ?? '');
                return;
            }
            this.onUiChanged();
        });
        controlsRow.appendChild(select);

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.textContent = 'Clear';
        clearButton.style.padding = '2px 6px';
        clearButton.style.border = '1px solid #5f5f5f';
        clearButton.style.background = '#d9d9d9';
        clearButton.disabled = this.isObjectLocked(selectedObject) || !value;
        this.bindEditorInputKeyboardGuards(clearButton);
        clearButton.addEventListener('click', () => {
            if (this.commitSelectedBehaviorScriptField(field, null)) {
                this.onUiChanged();
            }
        });
        controlsRow.appendChild(clearButton);
        row.appendChild(controlsRow);

        return row;
    }

    private listBehaviorScriptOptions(expectedCategory: BehaviorScriptCategory): BehaviorScriptOption[] {
        const externalAssets = getAllLogicScriptAssets();
        return externalAssets
            .filter((entry) => entry.category === expectedCategory)
            .map((entry) => ({
                id: entry.id,
                label: `${entry.name} (${entry.id})`
            }));
    }

    private appendBehaviorScriptFieldDiagnostic(
        diagnostics: string[],
        scriptById: ReadonlyMap<string, TestWorldLogicScriptConfig>,
        value: string | undefined,
        fieldLabel: BehaviorScriptFieldLabel,
        field: BehaviorScriptField
    ): void {
        const scriptId = value?.trim() ?? '';
        if (scriptId.length <= 0) {
            return;
        }
        const script = scriptById.get(scriptId);
        if (!script) {
            diagnostics.push(`${fieldLabel} missing script asset: ${scriptId}`);
            return;
        }
        const expectedCategory = BEHAVIOR_SCRIPT_CATEGORY_BY_FIELD[field];
        if (script.category !== expectedCategory) {
            diagnostics.push(`${fieldLabel} category mismatch: expected ${expectedCategory}, got ${script.category} (${scriptId})`);
            return;
        }

        if (field === 'move') {
            const summary = summarizePlatformMovePingPongContract(script.commands);
            if (summary.commandCount <= 0) {
                diagnostics.push(`${fieldLabel} assigned script is empty: expected exactly one ${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE} command (${scriptId})`);
                return;
            }
            if (!summary.hasExactlyOneValidCommand) {
                diagnostics.push(`${fieldLabel} script contract invalid: expected exactly one valid ${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE} command (${scriptId})`);
            }
            return;
        }

        if (field === 'rotate') {
            const summary = summarizePlatformRotateConstantContract(script.commands);
            if (summary.commandCount <= 0) {
                diagnostics.push(`${fieldLabel} assigned script is empty: expected exactly one ${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE} command (${scriptId})`);
                return;
            }
            if (!summary.hasExactlyOneValidCommand) {
                diagnostics.push(`${fieldLabel} script contract invalid: expected exactly one valid ${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE} command (${scriptId})`);
            }
        }
    }

    private resolveBehaviorBindingTarget(selectedObject: EditorObjectData): RuntimeBehaviorBindingTarget | null {
        const runtimeConfig = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!runtimeConfig) {
            return null;
        }
        const runtimeType = this.resolveObjectType(selectedObject.settings.type)?.runtimeType;
        if (runtimeType === 'surface') {
            const surface = runtimeConfig.surfaces.find((entry) => entry.id === selectedObject.id);
            return surface ? { runtimeType, behaviorScripts: surface.behaviorScripts ?? null } : null;
        }
        return null;
    }

    private getSurfaceMoveRuntimeDebugSnapshot(): SurfaceMoveRuntimeDebugSnapshot | null {
        const snapshot = this.legacyObjectAdapter?.getSurfaceMoveRuntimeDebugSnapshot() as SurfaceMoveRuntimeDebugSnapshot | null;
        if (!snapshot || typeof snapshot !== 'object') {
            return null;
        }
        if (!Array.isArray(snapshot.surfaces)) {
            return null;
        }
        return snapshot;
    }

    private formatSurfaceMoveRuntimeStatusLine(entry: {
        discoveredAssignments: number;
        resolvedAssignments: number;
        moverStateCount: number;
        moversVisitedThisFrame: number;
    }): string {
        return `Move runtime status: discovered=${entry.discoveredAssignments} resolved=${entry.resolvedAssignments} movers=${entry.moverStateCount} visitedThisFrame=${entry.moversVisitedThisFrame}`;
    }

    private formatSurfaceMoveRuntimeAssignmentScopeLine(selectedObjectId: string): string {
        const snapshot = this.getSurfaceMoveRuntimeDebugSnapshot();
        if (!snapshot) {
            return 'Move assignments in active runtime config: -';
        }
        const assignedSurfaceIds = snapshot.surfaces
            .filter((entry) => entry.assignedScriptId)
            .map((entry) => entry.surfaceId);
        const joined = assignedSurfaceIds.length > 0 ? assignedSurfaceIds.join(', ') : '-';
        const selectedMarked = assignedSurfaceIds.includes(selectedObjectId) ? '' : ` (selected ${selectedObjectId} not assigned)`;
        return `Move assignments in active runtime config: ${joined}${selectedMarked}`;
    }

    private formatSurfaceMoveRuntimeSurfaceLine(entry: SurfaceMoveRuntimeDebugEntryView): string {
        return `Move surface ${entry.surfaceId}: assigned=${entry.assignedScriptId ?? '-'} found=${entry.scriptFound ? 'yes' : 'no'} category=${entry.scriptCategory ?? '-'} command=${entry.commandType ?? '-'} paramsValid=${entry.paramsValid === null ? '-' : (entry.paramsValid ? 'yes' : 'no')} resolved=${entry.resolved ? 'yes' : 'no'} active=${entry.moverActive ? 'yes' : 'no'}`;
    }

    private formatSurfaceMoveRuntimePoseLine(entry: SurfaceMoveRuntimeDebugEntryView): string {
        return `Move pose: pos=(${entry.currentX.toFixed(2)}, ${entry.currentY.toFixed(2)}) origin=(${entry.originX.toFixed(2)}, ${entry.originY.toFixed(2)}) dir=${entry.direction} vel=(${entry.velocityX.toFixed(2)}, ${entry.velocityY.toFixed(2)}) delta=(${entry.lastDeltaX.toFixed(2)}, ${entry.lastDeltaY.toFixed(2)}) carry=(${entry.lastCarryDeltaX.toFixed(2)}, ${entry.lastCarryDeltaY.toFixed(2)}) visits=${entry.updateVisitCount} visitedThisFrame=${entry.visitedThisFrame ? 'yes' : 'no'} blocked=${entry.blockedReason ?? '-'}`;
    }

    private refreshSurfaceMoveRuntimeDebugLabels(): void {
        const labels = this.liveSurfaceMoveDebugLabels;
        if (!labels) {
            return;
        }
        if (
            !labels.statusLabel.isConnected
            || !labels.assignmentScopeLabel.isConnected
            || !labels.surfaceLabel.isConnected
            || !labels.poseLabel.isConnected
        ) {
            this.liveSurfaceMoveDebugLabels = null;
            return;
        }
        if (this.selectedObjectId !== labels.objectId) {
            return;
        }
        const entry = this.getSurfaceMoveRuntimeDebugEntry(labels.objectId);
        if (!entry) {
            return;
        }
        labels.statusLabel.textContent = this.formatSurfaceMoveRuntimeStatusLine(entry);
        labels.assignmentScopeLabel.textContent = this.formatSurfaceMoveRuntimeAssignmentScopeLine(labels.objectId);
        labels.surfaceLabel.textContent = this.formatSurfaceMoveRuntimeSurfaceLine(entry);
        labels.poseLabel.textContent = this.formatSurfaceMoveRuntimePoseLine(entry);
    }

    private isActiveRuntimeMovingSurface(objectId: string): boolean {
        const entry = this.getSurfaceMoveRuntimeDebugEntry(objectId);
        return entry?.moverActive === true;
    }

    private shouldUseSurfaceMoveEditSession(objectId: string): boolean {
        const entry = this.getSurfaceMoveRuntimeDebugEntry(objectId);
        return !!entry?.assignedScriptId;
    }

    private beginSurfaceMoveAuthoringEdit(objectId: string): boolean {
        if (!this.shouldUseSurfaceMoveEditSession(objectId)) {
            return true;
        }
        if (this.surfaceMoveEditObjectId === objectId) {
            return true;
        }
        if (this.surfaceMoveEditObjectId && this.surfaceMoveEditObjectId !== objectId) {
            this.endSurfaceMoveAuthoringEdit('switch-object');
        }
        if (!this.legacyObjectAdapter?.hasRuntimeLink(objectId)) {
            return true;
        }
        const wasActive = this.isActiveRuntimeMovingSurface(objectId);
        const applied = this.legacyObjectAdapter.setSurfaceMoveRuntimeEditingActive(objectId, true);
        if (!applied) {
            return !wasActive;
        }
        this.surfaceMoveEditObjectId = objectId;
        this.refreshLiveObjects('surface-move-edit-start');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.refreshSurfaceMoveRuntimeDebugLabels();
        return true;
    }

    private endSurfaceMoveAuthoringEdit(reason: string): void {
        const objectId = this.surfaceMoveEditObjectId;
        if (!objectId) {
            return;
        }
        this.surfaceMoveEditObjectId = null;
        this.legacyObjectAdapter?.setSurfaceMoveRuntimeEditingActive(objectId, false);
        this.refreshLiveObjects(`surface-move-edit-end:${reason}`);
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.refreshSurfaceMoveRuntimeDebugLabels();
    }

    private getSurfaceMoveRuntimeDebugEntry(selectedObjectId: string): (SurfaceMoveRuntimeDebugEntryView & {
        discoveredAssignments: number;
        resolvedAssignments: number;
        moverStateCount: number;
        moversVisitedThisFrame: number;
    }) | null {
        const snapshot = this.getSurfaceMoveRuntimeDebugSnapshot();
        if (!snapshot) {
            return null;
        }
        const entry = snapshot.surfaces.find((candidate) => candidate.surfaceId === selectedObjectId);
        if (!entry) {
            return null;
        }
        return {
            ...entry,
            discoveredAssignments: snapshot.discoveredAssignments,
            resolvedAssignments: snapshot.resolvedAssignments,
            moverStateCount: snapshot.moverStateCount,
            moversVisitedThisFrame: snapshot.moversVisitedThisFrame
        };
    }

    private commitSelectedBehaviorScriptField(
        field: BehaviorScriptField,
        nextValue: string | null
    ): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId || !this.legacyObjectAdapter?.hasRuntimeLink(selectedId)) {
            return false;
        }
        const patchKeyByField: Record<BehaviorScriptField, 'behaviorScriptsMove' | 'behaviorScriptsRotate' | 'behaviorScriptsDefaultAction'> = {
            move: 'behaviorScriptsMove',
            rotate: 'behaviorScriptsRotate',
            defaultAction: 'behaviorScriptsDefaultAction'
        };
        const applied = this.legacyObjectAdapter.patchRuntimeObjectFields(selectedId, {
            [patchKeyByField[field]]: nextValue
        });
        if (!applied) {
            return false;
        }
        this.refreshLiveObjects('behavior-scripts-update');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return true;
    }

    private makeObjectLogicActionsView(
        selectedObject: EditorObjectData,
        bindings: TestWorldLogicBindingConfig[]
    ): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.appendChild(this.makeSectionTitle('Object Interaction Trace'));
        wrap.appendChild(this.makeLabel('Runtime execution: press I in gameplay to trigger nearest object onInteract binding.'));
        wrap.appendChild(this.makeObjectInteractionTraceView(selectedObject.id));
        wrap.appendChild(this.makeSpacer());
        this.syncObjectLogicBindingTransientState(bindings);
        wrap.appendChild(this.makeLogicActionsAuthoringView(bindings));

        const scriptRefs = this.logicAuthoringService.listScriptRefs();
        this.syncObjectLogicBindingCreateState(selectedObject.id, scriptRefs);
        const hasOnInteractBinding = bindings.some((entry) => entry.slot === OBJECT_LOGIC_BINDING_DEFAULT_SLOT);
        const isCreateOpen = this.objectLogicBindingCreateFormObjectId === selectedObject.id;

        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.textContent = 'Add Object Binding';
        addButton.style.marginTop = '4px';
        addButton.disabled = hasOnInteractBinding;
        this.bindEditorInputKeyboardGuards(addButton);
        addButton.addEventListener('click', () => {
            if (hasOnInteractBinding) {
                return;
            }
            this.startObjectLogicBindingCreateForm(selectedObject.id, scriptRefs);
            this.onUiChanged();
        });
        wrap.appendChild(addButton);

        if (hasOnInteractBinding) {
            wrap.appendChild(this.makeLabel('This object already has an onInteract binding.'));
        }

        if (!isCreateOpen) {
            return wrap;
        }

        const form = document.createElement('div');
        form.style.border = '1px solid #8b8b8b';
        form.style.background = '#ececec';
        form.style.padding = '6px';
        form.style.marginTop = '6px';
        form.style.minWidth = '0';
        form.style.overflowWrap = 'anywhere';
        form.style.wordBreak = 'break-word';

        const slotLabel = this.makeLabel('Slot');
        slotLabel.style.marginBottom = '2px';
        form.appendChild(slotLabel);

        const slotSelect = document.createElement('select');
        slotSelect.style.display = 'block';
        slotSelect.style.width = '100%';
        slotSelect.style.boxSizing = 'border-box';
        slotSelect.style.marginBottom = '6px';
        slotSelect.appendChild(new Option(OBJECT_LOGIC_BINDING_DEFAULT_SLOT, OBJECT_LOGIC_BINDING_DEFAULT_SLOT));
        slotSelect.value = this.objectLogicBindingCreateSlotDraft;
        this.bindEditorInputKeyboardGuards(slotSelect);
        slotSelect.addEventListener('change', () => {
            this.objectLogicBindingCreateSlotDraft = slotSelect.value;
            this.objectLogicBindingCreateError = null;
        });
        form.appendChild(slotSelect);

        const scriptLabel = this.makeLabel('Script');
        scriptLabel.style.marginBottom = '2px';
        form.appendChild(scriptLabel);

        const scriptSelect = document.createElement('select');
        scriptSelect.style.display = 'block';
        scriptSelect.style.width = '100%';
        scriptSelect.style.boxSizing = 'border-box';
        scriptSelect.style.marginBottom = '6px';
        scriptSelect.disabled = scriptRefs.length <= 0;
        scriptRefs.forEach((scriptRef) => {
            scriptSelect.appendChild(new Option(this.formatObjectLogicScriptRefOptionLabel(scriptRef), scriptRef.id));
        });
        const resolvedScriptRefId = this.resolveObjectLogicBindingSelectedScriptRefId(scriptRefs);
        if (resolvedScriptRefId) {
            scriptSelect.value = resolvedScriptRefId;
        }
        this.bindEditorInputKeyboardGuards(scriptSelect);
        scriptSelect.addEventListener('change', () => {
            this.objectLogicBindingCreateScriptRefId = scriptSelect.value.trim() || null;
            this.objectLogicBindingCreateError = null;
        });
        form.appendChild(scriptSelect);

        const enabledRow = document.createElement('label');
        enabledRow.style.display = 'flex';
        enabledRow.style.alignItems = 'center';
        enabledRow.style.gap = '6px';
        enabledRow.style.marginBottom = '6px';

        const enabledCheckbox = document.createElement('input');
        enabledCheckbox.type = 'checkbox';
        enabledCheckbox.checked = this.objectLogicBindingCreateEnabledDraft;
        this.bindEditorInputKeyboardGuards(enabledCheckbox);
        enabledCheckbox.addEventListener('change', () => {
            this.objectLogicBindingCreateEnabledDraft = enabledCheckbox.checked;
            this.objectLogicBindingCreateError = null;
        });
        enabledRow.appendChild(enabledCheckbox);

        const enabledText = document.createElement('span');
        enabledText.textContent = 'Enabled';
        enabledRow.appendChild(enabledText);
        form.appendChild(enabledRow);

        if (scriptRefs.length <= 0) {
            form.appendChild(this.makeLabel('Add a script ref in Logic tab first.'));
        }

        if (this.objectLogicBindingCreateError) {
            const errorLine = this.makeLabel(this.objectLogicBindingCreateError);
            errorLine.style.color = '#b00020';
            errorLine.style.marginBottom = '6px';
            form.appendChild(errorLine);
        }

        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.gap = '6px';
        actionRow.style.flexWrap = 'wrap';
        actionRow.style.minWidth = '0';

        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.textContent = 'Create';
        createButton.disabled = hasOnInteractBinding || scriptRefs.length <= 0 || !resolvedScriptRefId;
        this.bindEditorInputKeyboardGuards(createButton);
        createButton.addEventListener('click', () => {
            this.createObjectLogicBinding(selectedObject.id);
        });
        actionRow.appendChild(createButton);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        this.bindEditorInputKeyboardGuards(cancelButton);
        cancelButton.addEventListener('click', () => {
            this.resetObjectLogicBindingCreateForm();
            this.onUiChanged();
        });
        actionRow.appendChild(cancelButton);

        form.appendChild(actionRow);
        wrap.appendChild(form);
        return wrap;
    }

    private makeLogicActionsAuthoringView(bindings: TestWorldLogicBindingConfig[]): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.minWidth = '0';
        if (bindings.length <= 0) {
            wrap.appendChild(this.makeLabel('No logic bindings for this object.'));
            return wrap;
        }

        wrap.appendChild(this.makeLabel('Runtime support: object/onInteract executes by I key (nearest interaction target).'));

        bindings.forEach((binding) => {
            const bindingEnabledDraft = this.objectLogicBindingEnabledDrafts.get(binding.id) ?? (binding.enabled !== false);
            const hasEnabledChanged = bindingEnabledDraft !== (binding.enabled !== false);
            const bindingError = this.objectLogicBindingMutationErrors.get(binding.id);
            const bindingBox = document.createElement('div');
            bindingBox.style.border = '1px solid #8b8b8b';
            bindingBox.style.background = '#d9d9d9';
            bindingBox.style.padding = '6px';
            bindingBox.style.marginBottom = '6px';
            bindingBox.style.wordBreak = 'break-word';
            bindingBox.appendChild(this.makeLabel(`id: ${binding.id}`));
            bindingBox.appendChild(this.makeLabel(`slot: ${binding.slot}`));
            bindingBox.appendChild(this.makeLabel(`scriptId: ${binding.scriptId}`));
            bindingBox.appendChild(this.makeLabel(`status: ${binding.enabled === false ? 'disabled' : 'enabled'}`));
            const normalizedSlot = binding.slot.trim();
            bindingBox.appendChild(this.makeLabel(
                normalizedSlot === OBJECT_LOGIC_BINDING_DEFAULT_SLOT
                    ? 'runtime support: object/onInteract (I key) is enabled for this slot'
                    : 'runtime support: unsupported slot (supported: object/onInteract only)'
            ));

            const enabledRow = document.createElement('label');
            enabledRow.style.display = 'flex';
            enabledRow.style.alignItems = 'center';
            enabledRow.style.gap = '6px';
            enabledRow.style.marginBottom = '6px';

            const enabledCheckbox = document.createElement('input');
            enabledCheckbox.type = 'checkbox';
            enabledCheckbox.checked = bindingEnabledDraft;
            this.bindEditorInputKeyboardGuards(enabledCheckbox);
            enabledCheckbox.addEventListener('change', () => {
                this.objectLogicBindingEnabledDrafts.set(binding.id, enabledCheckbox.checked);
                this.objectLogicBindingMutationErrors.delete(binding.id);
                this.onUiChanged();
            });
            enabledRow.appendChild(enabledCheckbox);

            const enabledText = document.createElement('span');
            enabledText.textContent = 'Enabled';
            enabledRow.appendChild(enabledText);
            bindingBox.appendChild(enabledRow);

            if (bindingError) {
                const errorLine = this.makeLabel(bindingError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                bindingBox.appendChild(errorLine);
            }

            const actionRow = document.createElement('div');
            actionRow.style.display = 'flex';
            actionRow.style.gap = '6px';
            actionRow.style.flexWrap = 'wrap';
            actionRow.style.minWidth = '0';

            const applyButton = document.createElement('button');
            applyButton.type = 'button';
            applyButton.textContent = 'Apply';
            applyButton.disabled = !hasEnabledChanged;
            this.bindEditorInputKeyboardGuards(applyButton);
            applyButton.addEventListener('click', () => {
                this.updateObjectLogicBindingEnabled(binding.id);
            });
            actionRow.appendChild(applyButton);

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete';
            this.bindEditorInputKeyboardGuards(deleteButton);
            deleteButton.addEventListener('click', () => {
                this.deleteObjectLogicBinding(binding.id);
            });
            actionRow.appendChild(deleteButton);
            bindingBox.appendChild(actionRow);
            wrap.appendChild(bindingBox);
        });
        return wrap;
    }

    private getRuntimeObjectInteractionTrace(): ObjectInteractionTrace | null {
        const trace = this.legacyObjectAdapter?.getLastObjectInteractionTrace() as ObjectInteractionTrace | null;
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        if (typeof trace.status !== 'string') {
            return null;
        }
        return trace;
    }

    private makeObjectInteractionTraceView(selectedObjectId: string): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.border = '1px solid #8b8b8b';
        wrap.style.background = '#ececec';
        wrap.style.padding = '6px';
        wrap.style.marginBottom = '6px';
        wrap.style.minWidth = '0';
        wrap.style.overflowWrap = 'anywhere';
        wrap.style.wordBreak = 'break-word';

        const trace = this.getRuntimeObjectInteractionTrace();
        if (!trace || !trace.attempted || trace.status === 'idle') {
            wrap.appendChild(this.makeLabel('No interaction attempted yet.'));
            return wrap;
        }

        const attemptText = Number.isFinite(trace.attemptId) ? `#${trace.attemptId}` : '(unknown)';
        const selectedTargetId = typeof trace.selectedTargetId === 'string' ? trace.selectedTargetId : null;
        const selectedDistancePx = Number.isFinite(trace.selectedDistancePx)
            ? Number(trace.selectedDistancePx)
            : null;
        const radiusPx = Number.isFinite(trace.radiusPx)
            ? Number(trace.radiusPx)
            : null;
        const candidateCount = Number.isFinite(trace.candidateCount)
            ? Number(trace.candidateCount)
            : (Array.isArray(trace.candidates) ? trace.candidates.length : 0);
        const candidateList = Array.isArray(trace.candidates) ? trace.candidates : [];
        const nearestCandidate = candidateList
            .filter((candidate): candidate is { targetId: string; distancePx: number; hasFocusPoint: boolean; inRange: boolean } => (
                typeof candidate?.targetId === 'string'
                && Number.isFinite(candidate?.distancePx)
            ))
            .sort((left, right) => left.distancePx - right.distancePx)[0] ?? null;

        if (trace.status === 'no_target_in_range') {
            const nearestText = nearestCandidate
                ? `, nearest ${nearestCandidate.targetId} distance ${nearestCandidate.distancePx}px`
                : '';
            const radiusText = radiusPx === null ? '' : `, radius ${radiusPx}px`;
            wrap.appendChild(this.makeLabel(
                `Last attempt ${attemptText}: no target in range. candidates: ${candidateCount}${nearestText}${radiusText}.`
            ));
        } else if (trace.status === 'executed') {
            const targetText = selectedTargetId ?? '(unknown target)';
            const distanceText = selectedDistancePx === null ? '' : ` at ${selectedDistancePx}px`;
            wrap.appendChild(this.makeLabel(
                `Last attempt ${attemptText}: executed ${targetText} onInteract${distanceText}, status success.`
            ));
        } else if (trace.status === 'error') {
            const errorReason = trace.bindingTrace?.bindings.find((entry) => entry.status === 'error')?.reason
                ?? trace.message
                ?? 'runtime error';
            wrap.appendChild(this.makeLabel(`Last attempt ${attemptText}: error ${errorReason}.`));
        } else if (trace.status === 'skipped') {
            const skipReason = trace.bindingTrace?.bindings.find((entry) => entry.status === 'skipped')?.reason
                ?? trace.message
                ?? 'skipped';
            wrap.appendChild(this.makeLabel(`Last attempt ${attemptText}: skipped ${skipReason}.`));
        } else if (trace.status === 'no_bindings') {
            wrap.appendChild(this.makeLabel(`Last attempt ${attemptText}: no onInteract object bindings found.`));
        } else if (trace.status === 'no_player') {
            wrap.appendChild(this.makeLabel(`Last attempt ${attemptText}: player position unavailable.`));
        } else {
            wrap.appendChild(this.makeLabel(`Last attempt ${attemptText}: ${trace.message}`));
        }

        if (selectedTargetId && selectedTargetId !== selectedObjectId) {
            wrap.appendChild(this.makeLabel(`Last target id: ${selectedTargetId} (different from selected object).`));
        }
        if (trace.message && trace.message.trim().length > 0) {
            wrap.appendChild(this.makeLabel(`Trace: ${trace.message}`));
        }

        const candidateSummary = candidateList
            .slice(0, 4)
            .map((candidate) => {
                const targetId = typeof candidate?.targetId === 'string' ? candidate.targetId : '(unknown)';
                const distance = Number.isFinite(candidate?.distancePx) ? `${candidate.distancePx}px` : '?';
                const inRangeText = candidate?.inRange ? 'in-range' : 'out-of-range';
                return `${targetId} ${distance} ${inRangeText}`;
            });
        if (candidateSummary.length > 0) {
            wrap.appendChild(this.makeLabel(`Candidates: ${candidateSummary.join(', ')}`));
        }

        if (trace.bindingTrace && Array.isArray(trace.bindingTrace.bindings)) {
            wrap.appendChild(this.makeLabel('Binding results:'));
            trace.bindingTrace.bindings.forEach((binding) => {
                wrap.appendChild(this.makeLabel(`- binding id: ${binding.bindingId}`));
                wrap.appendChild(this.makeLabel(`  scriptId: ${binding.scriptId}`));
                wrap.appendChild(this.makeLabel(`  status: ${binding.status}`));
                if (typeof binding.reason === 'string' && binding.reason.trim().length > 0) {
                    wrap.appendChild(this.makeLabel(`  reason: ${binding.reason}`));
                }
                if (!Array.isArray(binding.commands) || binding.commands.length <= 0) {
                    wrap.appendChild(this.makeLabel('  Command results: none'));
                    return;
                }
                binding.commands.forEach((command) => {
                    wrap.appendChild(this.makeLabel(`  command id: ${command.commandId}`));
                    wrap.appendChild(this.makeLabel(`  type: ${command.type}`));
                    wrap.appendChild(this.makeLabel(`  status: ${command.status}`));
                    wrap.appendChild(this.makeLabel(`  message: ${command.message}`));
                });
            });
        }

        return wrap;
    }

    private syncObjectLogicBindingTransientState(bindings: readonly TestWorldLogicBindingConfig[]): void {
        const activeBindingIds = new Set<string>();
        bindings.forEach((binding) => {
            activeBindingIds.add(binding.id);
            if (!this.objectLogicBindingEnabledDrafts.has(binding.id)) {
                this.objectLogicBindingEnabledDrafts.set(binding.id, binding.enabled !== false);
            }
        });
        Array.from(this.objectLogicBindingEnabledDrafts.keys()).forEach((bindingId) => {
            if (!activeBindingIds.has(bindingId)) {
                this.objectLogicBindingEnabledDrafts.delete(bindingId);
                this.objectLogicBindingMutationErrors.delete(bindingId);
            }
        });
    }

    private startObjectLogicBindingCreateForm(
        objectId: string,
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): void {
        this.objectLogicBindingCreateFormObjectId = objectId;
        this.objectLogicBindingCreateSlotDraft = OBJECT_LOGIC_BINDING_DEFAULT_SLOT;
        this.objectLogicBindingCreateScriptRefId = scriptRefs[0]?.id ?? null;
        this.objectLogicBindingCreateEnabledDraft = true;
        this.objectLogicBindingCreateError = null;
    }

    private resetObjectLogicBindingCreateForm(): void {
        this.objectLogicBindingCreateFormObjectId = null;
        this.objectLogicBindingCreateSlotDraft = OBJECT_LOGIC_BINDING_DEFAULT_SLOT;
        this.objectLogicBindingCreateScriptRefId = null;
        this.objectLogicBindingCreateEnabledDraft = true;
        this.objectLogicBindingCreateError = null;
    }

    private syncObjectLogicBindingCreateState(
        selectedObjectId: string,
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): void {
        if (this.objectLogicBindingCreateFormObjectId && this.objectLogicBindingCreateFormObjectId !== selectedObjectId) {
            this.resetObjectLogicBindingCreateForm();
            return;
        }
        if (this.objectLogicBindingCreateFormObjectId !== selectedObjectId) {
            return;
        }
        this.objectLogicBindingCreateSlotDraft = OBJECT_LOGIC_BINDING_DEFAULT_SLOT;
        this.objectLogicBindingCreateScriptRefId = this.resolveObjectLogicBindingSelectedScriptRefId(scriptRefs);
    }

    private resolveObjectLogicBindingSelectedScriptRefId(
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): string | null {
        const current = this.objectLogicBindingCreateScriptRefId?.trim() ?? '';
        if (current && scriptRefs.some((entry) => entry.id === current)) {
            return current;
        }
        return scriptRefs[0]?.id ?? null;
    }

    private formatObjectLogicScriptRefOptionLabel(scriptRef: TestWorldLogicScriptRefConfig): string {
        const displayName = scriptRef.displayName?.trim();
        if (displayName) {
            return `${displayName} (${scriptRef.id})`;
        }
        const path = scriptRef.path?.trim();
        if (path) {
            return `${scriptRef.id} (${path})`;
        }
        return scriptRef.id;
    }

    private createObjectLogicBinding(objectId: string): void {
        const slot = this.objectLogicBindingCreateSlotDraft.trim() || OBJECT_LOGIC_BINDING_DEFAULT_SLOT;
        const selectedBindings = this.logicAuthoringService.listBindingsForTarget('object', objectId);
        const hasOnInteractBinding = selectedBindings.some((entry) => entry.slot === slot);
        if (hasOnInteractBinding) {
            this.objectLogicBindingCreateError = 'This object already has an onInteract binding.';
            this.onUiChanged();
            return;
        }

        const scriptRefs = this.logicAuthoringService.listScriptRefs();
        if (scriptRefs.length <= 0) {
            this.objectLogicBindingCreateError = 'Add a script ref in Logic tab first.';
            this.onUiChanged();
            return;
        }

        const scriptRefId = this.resolveObjectLogicBindingSelectedScriptRefId(scriptRefs);
        if (!scriptRefId) {
            this.objectLogicBindingCreateError = 'Select a script ref.';
            this.onUiChanged();
            return;
        }

        const result = this.logicAuthoringService.createBinding({
            targetType: 'object',
            targetId: objectId,
            slot,
            scriptId: scriptRefId,
            enabled: this.objectLogicBindingCreateEnabledDraft
        });
        if (!result.success) {
            this.objectLogicBindingCreateError = result.reason ?? 'Failed to create logic binding.';
            this.onUiChanged();
            return;
        }

        this.resetObjectLogicBindingCreateForm();
        this.onUiChanged();
    }

    private updateObjectLogicBindingEnabled(bindingId: string): void {
        const enabled = this.objectLogicBindingEnabledDrafts.get(bindingId);
        if (typeof enabled !== 'boolean') {
            this.objectLogicBindingMutationErrors.set(bindingId, 'Binding state unavailable.');
            this.onUiChanged();
            return;
        }
        this.objectLogicBindingMutationErrors.delete(bindingId);
        const result = this.logicAuthoringService.updateBinding(bindingId, { enabled });
        if (!result.success) {
            this.objectLogicBindingMutationErrors.set(bindingId, result.reason ?? 'Failed to update logic binding.');
            this.onUiChanged();
            return;
        }
        this.onUiChanged();
    }

    private deleteObjectLogicBinding(bindingId: string): void {
        this.objectLogicBindingMutationErrors.delete(bindingId);
        const result = this.logicAuthoringService.deleteBinding(bindingId);
        if (!result.success) {
            this.objectLogicBindingMutationErrors.set(bindingId, result.reason ?? 'Failed to delete logic binding.');
            this.onUiChanged();
            return;
        }
        this.objectLogicBindingEnabledDrafts.delete(bindingId);
        this.objectLogicBindingMutationErrors.delete(bindingId);
        this.onUiChanged();
    }

    private isObjectLocked(objectData: EditorObjectData): boolean {
        return objectData.editor?.locked ?? false;
    }

    private focusObject(objectData: EditorObjectData): void {
        const centerX = objectData.bounds.x + (objectData.bounds.width * 0.5);
        const centerY = objectData.bounds.y + (objectData.bounds.height * 0.5);
        this.scene.cameras.main.centerOn(centerX, centerY);
    }

    private toggleSelectedObjectLock(): boolean {
        const selected = this.getSelectedObjectData();
        if (!selected) {
            return false;
        }
        const nextLocked = !this.isObjectLocked(selected);
        const activeLevelId = this.projectStore.getActiveLevel().id;
        this.projectStore.updateObject(activeLevelId, selected.id, {
            editor: {
                locked: nextLocked
            }
        });
        if (this.legacyObjectAdapter?.hasRuntimeLink(selected.id)) {
            this.legacyObjectAdapter.setRuntimeObjectLocked(selected.id, nextLocked);
        }
        this.refreshLiveObjects('lock-toggle');
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return true;
    }

    private copySelectedObject(): boolean {
        const selected = this.getSelectedObjectData();
        if (!selected) {
            return false;
        }
        this.objectClipboard = {
            type: selected.settings.type,
            category: selected.settings.category,
            bounds: { ...selected.bounds },
            visual: { ...selected.visual },
            settings: { ...selected.settings },
            actions: { ...selected.actions, actionScriptIds: [...selected.actions.actionScriptIds] }
        };
        objectDiag('[ObjectClipboard:copy]', {
            sourceObjectId: selected.id,
            copiedType: selected.settings.type,
            copiedVisual: { ...this.objectClipboard.visual },
            copiedBounds: { ...this.objectClipboard.bounds }
        });
        return true;
    }

    private pasteClipboardObject(): boolean {
        if (!this.objectClipboard) {
            return false;
        }
        return this.createDuplicateFromSource(this.objectClipboard, 'paste');
    }

    private duplicateSelectedObject(): boolean {
        const selected = this.getSelectedObjectData();
        if (!selected) {
            return false;
        }
        return this.createDuplicateFromSource({
            type: selected.settings.type,
            category: selected.settings.category,
            bounds: { ...selected.bounds },
            visual: { ...selected.visual },
            settings: { ...selected.settings },
            actions: { ...selected.actions, actionScriptIds: [...selected.actions.actionScriptIds] },
            editor: selected.editor ? { ...selected.editor } : undefined
        }, 'duplicate');
    }

    private createDuplicateFromSource(source: ObjectClipboardData, reason: 'duplicate' | 'paste'): boolean {
        const creation = this.objectAuthoringService.createObject(source.type, source.bounds.x + 32, source.bounds.y + 32);
        if (!creation.success || !creation.objectId) {
            objectDiag('[ObjectClipboard:paste]', {
                createdObjectId: null,
                sourceType: source.type,
                appliedBoundsSuccess: false,
                appliedVisualSuccess: false,
                finalVisual: null,
                success: false,
                reason: creation.reason ?? 'create_failed'
            });
            return false;
        }
        const created = this.trySelectCreatedObject(creation.objectId, reason);
        if (!created) {
            objectDiag('[ObjectClipboard:paste]', {
                createdObjectId: creation.objectId,
                sourceType: source.type,
                appliedBoundsSuccess: false,
                appliedVisualSuccess: false,
                finalVisual: null,
                success: false,
                reason: 'created_object_not_selectable'
            });
            return false;
        }

        const boundsResult = this.objectAuthoringService.updateObjectBounds(created.id, {
            x: source.bounds.x + 32,
            y: source.bounds.y + 32,
            width: source.bounds.width,
            height: source.bounds.height,
            rotation: source.bounds.rotation
        });
        const visualResult = this.objectAuthoringService.updateObjectVisual(created.id, {
            fillColor: source.visual.fillColor,
            strokeColor: source.visual.strokeColor,
            alpha: source.visual.alpha,
            layer: source.visual.layer
        });
        const activeLevelId = this.projectStore.getActiveLevel().id;
        this.projectStore.updateObject(activeLevelId, created.id, {
            visual: {
                shaderKey: source.visual.shaderKey,
                textureKey: source.visual.textureKey,
                onlyDebugView: source.visual.onlyDebugView
            },
            settings: { ...source.settings, type: created.settings.type, category: source.category },
            actions: { ...source.actions, actionScriptIds: [...source.actions.actionScriptIds] },
            editor: {
                locked: false
            }
        });

        this.refreshLiveObjects(`${reason}:patched`);
        const finalSelected = this.trySelectCreatedObject(created.id, reason);
        objectDiag('[ObjectClipboard:paste]', {
            createdObjectId: created.id,
            sourceType: source.type,
            appliedBoundsSuccess: boundsResult.success,
            appliedVisualSuccess: visualResult.success,
            finalVisual: finalSelected?.visual ?? null,
            success: !!finalSelected && boundsResult.success && (visualResult.success || visualResult.reason === 'No visual changes.'),
            reason: !boundsResult.success
                ? (boundsResult.reason ?? 'bounds_update_failed')
                : (!visualResult.success && visualResult.reason !== 'No visual changes.'
                    ? (visualResult.reason ?? 'visual_update_failed')
                    : null)
        });
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        return !!finalSelected && boundsResult.success && (visualResult.success || visualResult.reason === 'No visual changes.');
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const title = document.createElement('div');
        title.textContent = text;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        return title;
    }

    private makeLabel(text: string): HTMLDivElement {
        const label = document.createElement('div');
        label.textContent = text;
        label.style.marginBottom = '4px';
        label.style.minWidth = '0';
        label.style.overflowWrap = 'anywhere';
        label.style.wordBreak = 'break-word';
        return label;
    }

    private makeSpacer(): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = '8px';
        return spacer;
    }
}

