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
const DEFAULT_SIZE = 64;
const EDITABLE_BOUNDS_FIELDS = ['x', 'y', 'width', 'height', 'rotation'] as const;
type EditableBoundsField = (typeof EDITABLE_BOUNDS_FIELDS)[number];
const EDITABLE_VISUAL_TEXT_FIELDS = ['shaderKey', 'textureKey'] as const;
type EditableVisualTextField = (typeof EDITABLE_VISUAL_TEXT_FIELDS)[number];
const EDITABLE_VISUAL_COLOR_FIELDS = ['fillColor', 'strokeColor'] as const;
type EditableVisualColorField = (typeof EDITABLE_VISUAL_COLOR_FIELDS)[number];
const HEX_COLOR_LIKE_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const REQUIRED_RUNTIME_CREATION_TYPES = new Set<string>([
    'platform_default',
    'drag_box',
    'wind_zone',
    'checkpoint',
    'player_spawn',
    'finish',
    'trigger_volume',
    'triangle_pickup'
]);
type EyedropperTarget = EditableVisualColorField | null;

export class ObjectsEditorMode implements EditorMode {
    public readonly id = 'objects';
    public readonly label = 'Objects';

    private readonly scene: Phaser.Scene;
    private readonly projectStore: ProjectStore;
    private readonly objectTypeRegistry: ObjectTypeRegistry;
    private readonly onUiChanged: () => void;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly objectViews = new Map<string, Phaser.GameObjects.Rectangle>();
    private readonly selectionOutline: Phaser.GameObjects.Graphics;
    private readonly deleteKey: Phaser.Input.Keyboard.Key | null;
    private readonly escapeKey: Phaser.Input.Keyboard.Key | null;

    private activeCatalogCategory: EditorObjectCategory = 'platforms';
    private selectedTypeId: string | null = null;
    private selectedObjectId: string | null = null;
    private draggingObjectId: string | null = null;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private searchValue = '';
    private objectsListScrollTop = 0;
    private eyedropperTarget: EyedropperTarget = null;
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

        this.selectionOutline = this.scene.add.graphics();
        this.selectionOutline.setDepth(5101);
        this.selectionOutline.setVisible(false);
        this.deleteKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE) ?? null;
        this.escapeKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;
    }

    public enter(): void {
        this.syncFromLegacyBridge();
        this.applyDebugVisibilityToRuntimeLinks();
        this.ensureSelectedTypeMatchesActiveCategory();
        this.syncViewsFromStore();
        this.syncSelectionOutline();
    }

    public exit(): void {
        this.draggingObjectId = null;
        this.eyedropperTarget = null;
        this.selectionOutline.setVisible(false);
    }

    public update(context: EditorModeRuntimeContext): void {
        this.context = context;
        this.syncFromLegacyBridge();
        this.applyDebugVisibilityToRuntimeLinks();
        this.handleDeleteShortcut();
        this.handleEyedropperCancelShortcut();
        this.syncViewsFromStore();
        this.syncSelectionOutline();
    }

    public onPointerDown(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;

        if (event.button !== 0) {
            return;
        }

        if (this.selectedTypeId) {
            const created = this.createObjectAt(event.worldX, event.worldY);
            if (created) {
                this.selectedObjectId = created.id;
                this.draggingObjectId = null;
                this.syncSelectionOutline();
            }
            this.onUiChanged();
            return;
        }

        if (this.eyedropperTarget) {
            this.handleEyedropperSample(event.worldX, event.worldY);
            return;
        }

        const hitObjectId = this.findObjectIdAtPoint(event.worldX, event.worldY);
        if (hitObjectId) {
            this.selectedObjectId = hitObjectId;
            this.selectedTypeId = null;
            const object = this.getActiveObjects().find((item) => item.id === hitObjectId);
            if (object) {
                this.draggingObjectId = hitObjectId;
                this.dragOffsetX = event.worldX - object.bounds.x;
                this.dragOffsetY = event.worldY - object.bounds.y;
            }
            this.syncSelectionOutline();
            this.onUiChanged();
            return;
        }

        this.selectedObjectId = null;
        this.draggingObjectId = null;
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerMove(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;
        if (!this.draggingObjectId) {
            return;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const current = this.projectStore.getObject(activeLevel.id, this.draggingObjectId);
        if (!current) {
            this.draggingObjectId = null;
            return;
        }
        const snappedX = this.snap(event.worldX - this.dragOffsetX, context.grid.size);
        const snappedY = this.snap(event.worldY - this.dragOffsetY, context.grid.size);
        const nextObject = this.projectStore.updateObject(activeLevel.id, current.id, {
            bounds: {
                x: snappedX,
                y: snappedY
            }
        });
        this.legacyObjectAdapter?.moveRuntimeObject(nextObject.id, nextObject.bounds);
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerUp(event: EditorPointerEvent): void {
        if (event.button === 0) {
            this.draggingObjectId = null;
        }
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
                    this.eyedropperTarget = null;
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
                objectsListTitle.textContent = `Objects list (${activeLevel.name}) ${rows.length} / ${totalInCategory}`;
                rows.forEach((obj) => {
                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.gap = '4px';
                    row.style.marginBottom = '4px';

                    const selectButton = document.createElement('button');
                    selectButton.type = 'button';
                    selectButton.textContent = `${obj.name} (${obj.id})`;
                    selectButton.style.flex = '1';
                    selectButton.style.textAlign = 'left';
                    selectButton.style.padding = '4px 6px';
                    selectButton.style.border = '1px solid #5f5f5f';
                    selectButton.style.background = this.selectedObjectId === obj.id ? '#70de63' : '#d9d9d9';
                    selectButton.addEventListener('click', () => {
                        this.objectsListScrollTop = listContainer.scrollTop;
                        this.selectedObjectId = obj.id;
                        this.selectedTypeId = null;
                        this.syncSelectionOutline();
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
        const activeLevel = this.projectStore.getActiveLevel();
        const objects = this.getActiveObjects();
        const selectedObject = this.selectedObjectId
            ? this.projectStore.getObject(activeLevel.id, this.selectedObjectId)
            : undefined;

        panel.setCustomContent('Object Properties', (container) => {
            if (!selectedObject) {
                container.appendChild(this.makeLabel(`Active level: ${activeLevel.name} (${activeLevel.id})`));
                container.appendChild(this.makeLabel(`Object count: ${objects.length}`));
                return;
            }

            container.appendChild(this.makeSectionTitle('Bounds'));
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

            container.appendChild(this.makeSectionTitle('Actions'));
            container.appendChild(this.makeLabel(`Move: ${selectedObject.actions.moveScriptId ?? '-'}`));
            container.appendChild(this.makeLabel(`Rotate: ${selectedObject.actions.rotateScriptId ?? '-'}`));
            container.appendChild(this.makeLabel(`Default Action: ${selectedObject.actions.defaultActionId ?? '-'}`));
            container.appendChild(
                this.makeLabel(`Action 1: ${selectedObject.actions.actionScriptIds[0] ?? '-'}`)
            );
        });
    }

    private handleDeleteShortcut(): void {
        if (!this.deleteKey) {
            return;
        }
        if (!Phaser.Input.Keyboard.JustDown(this.deleteKey)) {
            return;
        }
        if (isEditorTextInputFocused()) {
            return;
        }
        this.deleteSelectedObject();
    }

    private handleEyedropperCancelShortcut(): void {
        if (!this.eyedropperTarget || !this.escapeKey) {
            return;
        }
        if (!Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
            return;
        }
        if (isEditorTextInputFocused()) {
            return;
        }
        this.eyedropperTarget = null;
        this.onUiChanged();
    }

    private handleEyedropperSample(worldX: number, worldY: number): void {
        const targetField = this.eyedropperTarget;
        this.eyedropperTarget = null;
        if (!targetField) {
            this.onUiChanged();
            return;
        }

        const sampledObjectId = this.findObjectIdAtPoint(worldX, worldY);
        if (!sampledObjectId) {
            this.onUiChanged();
            return;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const sampledObject = this.projectStore.getObject(activeLevel.id, sampledObjectId);
        if (!sampledObject) {
            this.onUiChanged();
            return;
        }
        const sampledColor = targetField === 'fillColor'
            ? sampledObject.visual.fillColor
            : sampledObject.visual.strokeColor;
        const normalized = this.normalizeHexLikeColor(sampledColor);
        if (normalized) {
            this.commitSelectedObjectVisualColorField(targetField, normalized);
        }
        this.onUiChanged();
    }

    private deleteSelectedObject(): boolean {
        const selectedId = this.selectedObjectId;
        if (!selectedId) {
            return false;
        }

        const activeLevel = this.projectStore.getActiveLevel();
        if (!this.projectStore.getObject(activeLevel.id, selectedId)) {
            this.selectedObjectId = null;
            this.syncSelectionOutline();
            this.onUiChanged();
            return false;
        }

        const isRuntimeLinked = this.legacyObjectAdapter?.hasRuntimeLink(selectedId) ?? false;
        if (isRuntimeLinked) {
            const runtimeRemoved = this.legacyObjectAdapter?.removeRuntimeObject(selectedId) ?? false;
            if (!runtimeRemoved) {
                return false;
            }
        }

        if (this.projectStore.getObject(activeLevel.id, selectedId)) {
            this.projectStore.deleteObject(activeLevel.id, selectedId);
        }
        this.objectViews.get(selectedId)?.destroy();
        this.objectViews.delete(selectedId);
        this.selectedObjectId = null;
        this.draggingObjectId = null;
        this.syncFromLegacyBridge();
        this.syncViewsFromStore();
        this.syncSelectionOutline();
        this.onUiChanged();
        return true;
    }

    private createObjectAt(worldX: number, worldY: number): EditorObjectData | null {
        const activeLevel = this.projectStore.getActiveLevel();
        const typeId = this.selectedTypeId ?? 'platform_default';
        const definition = this.resolveObjectType(typeId);
        const resolvedTypeId = definition?.id ?? typeId;
        const requiresRuntimeCreation = REQUIRED_RUNTIME_CREATION_TYPES.has(resolvedTypeId);
        const x = this.snap(worldX, this.context.grid.size);
        const y = this.snap(worldY, this.context.grid.size);

        if (this.legacyObjectAdapter) {
            this.syncFromLegacyBridge();
            const beforeActiveLevel = this.projectStore.getActiveLevel();
            const beforeRuntimeObjectIds = new Set(
                this.projectStore
                    .listObjects(beforeActiveLevel.id)
                    .filter((item) => this.legacyObjectAdapter?.hasRuntimeLink(item.id))
                    .map((item) => item.id)
            );

            const creation = this.legacyObjectAdapter.createRuntimeObjectFromCatalog(typeId, x, y);
            this.syncFromLegacyBridge();
            const syncedActiveLevel = this.projectStore.getActiveLevel();

            const byExactId = creation.legacyId
                ? this.projectStore.getObject(syncedActiveLevel.id, creation.legacyId)
                : undefined;
            if (byExactId && this.legacyObjectAdapter.hasRuntimeLink(byExactId.id)) {
                return byExactId;
            }

            const createdRuntimeObject = this.findNewRuntimeCreatedObject(
                syncedActiveLevel.id,
                resolvedTypeId,
                x,
                y,
                beforeRuntimeObjectIds
            );
            if (createdRuntimeObject) {
                return createdRuntimeObject;
            }

            if (requiresRuntimeCreation) {
                const reason = creation.error ?? 'runtime bridge sync did not surface created object';
                console.warn(`[ObjectsEditorMode] Runtime creation failed for required type "${resolvedTypeId}": ${reason}`);
                return null;
            }

            const levelIdForFallback = this.projectStore.getActiveLevel().id || activeLevel.id;
            return this.createFallbackAuthoringRectangle(levelIdForFallback, resolvedTypeId, x, y, creation.legacyId ?? undefined);
        }

        if (requiresRuntimeCreation) {
            console.warn(`[ObjectsEditorMode] Runtime bridge unavailable for required type "${resolvedTypeId}".`);
            return null;
        }

        const currentLevelId = this.projectStore.getActiveLevel().id || activeLevel.id;
        return this.createFallbackAuthoringRectangle(currentLevelId, resolvedTypeId, x, y);
    }

    private findNewRuntimeCreatedObject(
        levelId: string,
        resolvedTypeId: string,
        worldX: number,
        worldY: number,
        beforeRuntimeObjectIds: ReadonlySet<string>
    ): EditorObjectData | null {
        const candidates = this.projectStore
            .listObjects(levelId)
            .filter((item) => this.legacyObjectAdapter?.hasRuntimeLink(item.id))
            .filter((item) => !beforeRuntimeObjectIds.has(item.id))
            .filter((item) => item.settings.type === resolvedTypeId);
        if (candidates.length <= 0) {
            return null;
        }
        candidates.sort((left, right) => {
            const leftDx = (left.bounds.x + (left.bounds.width * 0.5)) - worldX;
            const leftDy = (left.bounds.y + (left.bounds.height * 0.5)) - worldY;
            const rightDx = (right.bounds.x + (right.bounds.width * 0.5)) - worldX;
            const rightDy = (right.bounds.y + (right.bounds.height * 0.5)) - worldY;
            const leftDistance = (leftDx * leftDx) + (leftDy * leftDy);
            const rightDistance = (rightDx * rightDx) + (rightDy * rightDy);
            return leftDistance - rightDistance;
        });
        return candidates[0] ?? null;
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

        const activeLevel = this.projectStore.getActiveLevel();
        const current = this.projectStore.getObject(activeLevel.id, selectedId);
        if (!current) {
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

        const nextObject = this.projectStore.updateObject(activeLevel.id, selectedId, {
            bounds: {
                [field]: nextValue
            } as Partial<EditorObjectBoundsData>
        });
        this.legacyObjectAdapter?.moveRuntimeObject(nextObject.id, nextObject.bounds);
        this.syncFromLegacyBridge();
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

        const swatch = document.createElement('input');
        swatch.type = 'color';
        swatch.value = this.normalizeHexColorForPicker(selectedObject.visual[field]);
        swatch.style.width = '28px';
        swatch.style.height = '24px';
        swatch.style.padding = '0';
        swatch.style.border = '1px solid #5f5f5f';
        swatch.style.background = 'transparent';
        this.bindEditorInputKeyboardGuards(swatch);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = selectedObject.visual[field];
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.flex = '1';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        this.bindEditorInputKeyboardGuards(input);

        const pickButton = document.createElement('button');
        pickButton.type = 'button';
        pickButton.textContent = field === 'fillColor' ? 'Pick Fill' : 'Pick Stroke';
        pickButton.style.padding = '3px 6px';
        pickButton.style.border = '1px solid #5f5f5f';
        pickButton.style.background = this.eyedropperTarget === field ? '#70de63' : '#d9d9d9';
        pickButton.addEventListener('click', () => {
            this.eyedropperTarget = this.eyedropperTarget === field ? null : field;
            this.onUiChanged();
        });

        const commitField = (): void => {
            const committed = this.commitSelectedObjectVisualColorField(field, input.value);
            input.value = this.getSelectedVisualColorFieldValue(field);
            swatch.value = this.normalizeHexColorForPicker(input.value);
            if (committed) {
                this.onUiChanged();
            }
        };

        swatch.addEventListener('input', () => {
            const normalized = this.normalizeHexColorForPicker(swatch.value);
            const committed = this.commitSelectedObjectVisualColorField(field, normalized);
            input.value = this.getSelectedVisualColorFieldValue(field);
            swatch.value = this.normalizeHexColorForPicker(input.value);
            if (committed) {
                this.onUiChanged();
            }
        });

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
        controlsRow.appendChild(pickButton);
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
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.formatNumber(selectedObject.visual.layer);
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.style.width = '100%';
        input.style.padding = '2px 4px';
        input.style.border = '1px solid #5f5f5f';
        input.style.boxSizing = 'border-box';
        this.bindEditorInputKeyboardGuards(input);

        const datalistId = `objects-layer-options-${selectedObject.id}`;
        input.setAttribute('list', datalistId);
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        const layerValues = new Set<number>(LAYER_OPTIONS);
        layerValues.add(selectedObject.visual.layer);
        [...layerValues].sort((a, b) => a - b).forEach((value) => {
            const option = document.createElement('option');
            option.value = String(value);
            datalist.appendChild(option);
        });

        const commitField = (): void => {
            const committed = this.commitSelectedObjectVisualLayer(input.value);
            input.value = this.formatNumber(this.getSelectedVisualNumericFieldValue('layer'));
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

        const row = this.makeSingleFieldInputRow('Layer', input);
        row.appendChild(datalist);
        return row;
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

    private commitSelectedObjectVisualTextField(field: EditableVisualTextField, rawValue: string): boolean {
        const trimmed = rawValue.trim();
        const nextValue = trimmed.length > 0 ? rawValue : null;
        return this.commitSelectedObjectVisualPatch({
            [field]: nextValue
        } as Partial<EditorObjectVisualData>);
    }

    private commitSelectedObjectVisualColorField(field: EditableVisualColorField, rawValue: string): boolean {
        const normalizedColor = this.normalizeHexLikeColor(rawValue);
        if (!normalizedColor) {
            return false;
        }
        return this.commitSelectedObjectVisualPatch({
            [field]: normalizedColor
        } as Partial<EditorObjectVisualData>);
    }

    private commitSelectedObjectVisualAlpha(rawValue: string): boolean {
        const parsed = Number(rawValue.trim());
        if (!Number.isFinite(parsed)) {
            return false;
        }
        const clamped = Phaser.Math.Clamp(parsed, 0, 1);
        return this.commitSelectedObjectVisualPatch({
            alpha: clamped
        });
    }

    private commitSelectedObjectVisualLayer(rawValue: string): boolean {
        const parsed = Number(rawValue.trim());
        if (!Number.isFinite(parsed)) {
            return false;
        }
        const layer = Math.round(parsed);
        return this.commitSelectedObjectVisualPatch({
            layer
        });
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

    private getActiveObjects(): EditorObjectData[] {
        const activeLevel = this.projectStore.getActiveLevel();
        return this.projectStore.listObjects(activeLevel.id);
    }

    private getObjectsInActiveCategory(objects: readonly EditorObjectData[]): EditorObjectData[] {
        return objects.filter((objectData) => objectData.settings.category === this.activeCatalogCategory);
    }

    private syncViewsFromStore(): void {
        const objects = this.getActiveObjects();
        const activeIds = new Set(
            objects
                .filter((item) => !this.legacyObjectAdapter?.hasRuntimeLink(item.id))
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
            let view = this.objectViews.get(objectData.id);
            if (!view) {
                view = this.scene.add.rectangle(0, 0, 1, 1, 0x77aaff, 0.45);
                view.setOrigin(0, 0);
                view.setDepth(5100);
                this.objectViews.set(objectData.id, view);
            }
            const fillColor = this.parseHexColorToRgbInt(objectData.visual.fillColor) ?? 0x77aaff;
            const strokeColor = this.parseHexColorToRgbInt(objectData.visual.strokeColor) ?? 0x222222;
            view.setPosition(objectData.bounds.x, objectData.bounds.y);
            view.setSize(objectData.bounds.width, objectData.bounds.height);
            view.setFillStyle(fillColor, objectData.visual.alpha);
            view.setStrokeStyle(1, strokeColor, Math.max(0.15, objectData.visual.alpha));
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
        this.selectionOutline.setVisible(true);
        this.selectionOutline.lineStyle(2, 0xffff00, 1);
        this.selectionOutline.strokeRect(
            selected.bounds.x,
            selected.bounds.y,
            selected.bounds.width,
            selected.bounds.height
        );
    }

    private findObjectIdAtPoint(worldX: number, worldY: number): string | null {
        const bridgedObjectId = this.legacyObjectAdapter?.findObjectIdAtPoint(worldX, worldY) ?? null;
        if (bridgedObjectId) {
            return bridgedObjectId;
        }

        const objects = this.getActiveObjects();
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

    private syncFromLegacyBridge(): void {
        this.legacyObjectAdapter?.syncIntoProjectStore(this.projectStore);
    }

    private applyDebugVisibilityToRuntimeLinks(): void {
        if (!this.legacyObjectAdapter) {
            return;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        const objects = this.projectStore.listObjects(activeLevel.id);
        objects.forEach((objectData) => {
            if (!this.legacyObjectAdapter?.hasRuntimeLink(objectData.id)) {
                return;
            }
            this.legacyObjectAdapter.patchRuntimeObjectDebugVisibility(
                objectData.id,
                objectData.visual.onlyDebugView
            );
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

    private createFallbackAuthoringRectangle(
        levelId: string,
        typeId: string,
        x: number,
        y: number,
        objectId?: string
    ): EditorObjectData {
        const definition = this.resolveObjectType(typeId);
        const width = DEFAULT_SIZE;
        const height = DEFAULT_SIZE;

        if (objectId && this.projectStore.hasObject(levelId, objectId)) {
            const existing = this.projectStore.getObject(levelId, objectId);
            if (existing) {
                return existing;
            }
        }

        // TODO(authoring-step-3.1): fallback is for unknown/dev types only.
        // Required production catalog types must be created through runtime factory/bridge.
        return this.projectStore.addObject(levelId, {
            id: objectId,
            bounds: { x, y, width, height, rotation: 0 },
            visual: {
                fillColor: '#ffffff',
                strokeColor: '#000000',
                alpha: 1,
                onlyDebugView: false
            },
            settings: {
                type: definition?.id ?? typeId,
                category: definition?.category ?? 'objects'
            }
        });
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
        return label;
    }

    private makeSpacer(): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = '8px';
        return spacer;
    }
}
