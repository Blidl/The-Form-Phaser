
import Phaser from 'phaser';
import type { EditorMode, EditorModeRuntimeContext, EditorPointerEvent } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import {
    BackgroundObjectAuthoringService,
    type BackgroundObjectLayerId,
    type BackgroundObjectMutationResult,
    type BackgroundObjectSnapshot
} from '../background-authoring/BackgroundObjectAuthoringService';
import type {
    TestWorldBackgroundObjectConfig
} from '../../game/world/runtime/test_world_config';

interface BackgroundEditorModeOptions {
    scene: Phaser.Scene;
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

interface CommitResult {
    success: boolean;
    error?: string;
}

interface BackgroundObjectDragState {
    objectId: string;
    pointerOffsetX: number;
    pointerOffsetY: number;
}

type BackgroundResizeHandle =
    | 'top-left'
    | 'top-right'
    | 'bottom-right'
    | 'bottom-left';

interface BackgroundObjectResizeState {
    objectId: string;
    handle: BackgroundResizeHandle;
    startBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
    };
}

const COLOR_HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;
const COLOR_NUMBER_PATTERN = /^(0x)?([0-9a-fA-F]{1,6})$/;
const DEFAULT_SOLID_FILL_COLOR = 0x1f2a30;
const DEFAULT_DEMO_TEXTURE_ASSET = 'assets/bg.png';
const BACKGROUND_SELECTION_OUTLINE_DEPTH = 5102;
const BACKGROUND_SELECTION_OUTLINE_COLOR = 0x79d7ff;
const BACKGROUND_SELECTION_OUTLINE_LOCKED_COLOR = 0xff5555;
const BACKGROUND_RESIZE_HANDLE_SIZE = 8;
const BACKGROUND_RESIZE_HANDLE_HIT_RADIUS = 6;
const BACKGROUND_MIN_RESIZE_SIZE = 8;

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};

const layerToLabel = (layer: BackgroundObjectLayerId): string => {
    if (layer === 'parallax1') {
        return 'Parallax 1';
    }
    if (layer === 'parallax2') {
        return 'Parallax 2';
    }
    return 'Static';
};

const layerToDemoTextureKey = (layer: BackgroundObjectLayerId): string => {
    if (layer === 'parallax1') {
        return 'demo_bg_layer_far';
    }
    if (layer === 'parallax2') {
        return 'demo_bg_layer_near';
    }
    return 'demo_bg_static';
};

const normalizeLayer = (value: unknown): BackgroundObjectLayerId => {
    if (value === 'parallax1' || value === 'parallax2' || value === 'static') {
        return value;
    }
    return 'static';
};

const parseColorInput = (raw: string): { value: number | null; error: string | null } => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { value: null, error: null };
    }
    const hex = COLOR_HEX_PATTERN.exec(trimmed);
    if (hex) {
        return { value: Number.parseInt(hex[1], 16), error: null };
    }
    const numericHex = COLOR_NUMBER_PATTERN.exec(trimmed);
    if (numericHex) {
        return { value: Number.parseInt(numericHex[2], 16), error: null };
    }
    const maybeNumber = Number(trimmed);
    if (Number.isFinite(maybeNumber)) {
        return {
            value: clamp(Math.round(maybeNumber), 0, 0xffffff),
            error: null
        };
    }
    return {
        value: null,
        error: 'Invalid color. Use #rrggbb, rrggbb, 0xrrggbb, or decimal.'
    };
};

const colorToText = (value: number | undefined): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '';
    }
    return `#${Math.round(clamp(value, 0, 0xffffff)).toString(16).padStart(6, '0')}`;
};

export class BackgroundEditorMode implements EditorMode {
    public readonly id = 'background';
    public readonly label = 'Background';

    private readonly scene: Phaser.Scene;
    private readonly onUiChanged: () => void;
    private readonly backgroundObjectAuthoringService: BackgroundObjectAuthoringService;
    private readonly selectionOutline: Phaser.GameObjects.Graphics;
    private selectedObjectLayer: BackgroundObjectLayerId = 'static';
    private selectedObjectId: string | null = null;
    private fieldErrors = new Map<string, string>();
    private statusMessage: string | null = null;
    private lastBackgroundSignature: string | null = null;
    private lastSelectionOutlineSignature: string | null = null;
    private dragState: BackgroundObjectDragState | null = null;
    private resizeState: BackgroundObjectResizeState | null = null;

    public constructor(options: BackgroundEditorModeOptions) {
        this.scene = options.scene;
        this.onUiChanged = options.onUiChanged;
        this.backgroundObjectAuthoringService = new BackgroundObjectAuthoringService(options.legacyObjectAdapter);
        this.selectionOutline = this.scene.add.graphics();
        this.selectionOutline.setDepth(BACKGROUND_SELECTION_OUTLINE_DEPTH);
        this.selectionOutline.setVisible(false);
    }

    public enter(): void {
        this.clearDragState();
        this.clearResizeState();
        this.setSceneCursor('default');
        this.captureSignature();
        this.syncSelectedObject();
        this.syncSelectionOutline(true);
    }

    public exit(): void {
        this.clearDragState();
        this.clearResizeState();
        this.setSceneCursor('default');
        this.clearSelectionOutline();
    }

    public update(_context: EditorModeRuntimeContext): void {
        const nextSignature = this.readBackgroundSignature();
        if (nextSignature !== this.lastBackgroundSignature) {
            this.lastBackgroundSignature = nextSignature;
            this.syncSelectedObject();
            this.syncSelectionOutline(true);
            this.onUiChanged();
            return;
        }
        this.syncSelectionOutline();
    }

    public onRuntimeConfigImported(): void {
        this.clearDragState();
        this.clearResizeState();
        this.setSceneCursor('default');
        this.captureSignature();
        this.fieldErrors.clear();
        this.statusMessage = null;
        this.syncSelectedObject();
        this.syncSelectionOutline(true);
        this.onUiChanged();
    }

    public onPointerDown(event: EditorPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.selectedObjectId = null;
            this.clearDragState();
            this.clearResizeState();
            this.syncSelectionOutline(true);
            this.onUiChanged();
            return;
        }

        const resizeHit = this.findResizeHandleAtPoint(snapshot, event.worldX, event.worldY);
        if (resizeHit) {
            const resizeTarget = snapshot.objects.find((entry) => entry.id === resizeHit.objectId) ?? null;
            this.selectedObjectId = resizeHit.objectId;
            this.clearDragState();
            if (!resizeTarget || resizeTarget.editor?.locked) {
                this.clearResizeState();
            } else {
                this.resizeState = {
                    objectId: resizeTarget.id,
                    handle: resizeHit.handle,
                    startBounds: {
                        x: Number.isFinite(resizeTarget.bounds.x) ? resizeTarget.bounds.x : 0,
                        y: Number.isFinite(resizeTarget.bounds.y) ? resizeTarget.bounds.y : 0,
                        width: Math.max(BACKGROUND_MIN_RESIZE_SIZE, Number.isFinite(resizeTarget.bounds.width) ? resizeTarget.bounds.width : 0),
                        height: Math.max(BACKGROUND_MIN_RESIZE_SIZE, Number.isFinite(resizeTarget.bounds.height) ? resizeTarget.bounds.height : 0),
                        rotation: Number.isFinite(resizeTarget.bounds.rotation) ? resizeTarget.bounds.rotation ?? 0 : 0
                    }
                };
                this.setSceneCursor(this.getResizeHandleCursor(resizeHit.handle));
            }
            this.statusMessage = null;
            this.syncSelectionOutline(true);
            this.onUiChanged();
            return;
        }

        const hitObject = this.findTopmostObjectAtPoint(snapshot, event.worldX, event.worldY);
        if (!hitObject) {
            this.selectedObjectId = null;
            this.clearDragState();
            this.clearResizeState();
            this.setSceneCursor('default');
            this.syncSelectionOutline(true);
            this.onUiChanged();
            return;
        }

        this.selectedObjectId = hitObject.id;
        this.clearResizeState();
        if (hitObject.editor?.locked) {
            this.clearDragState();
        } else {
            this.dragState = {
                objectId: hitObject.id,
                pointerOffsetX: event.worldX - hitObject.bounds.x,
                pointerOffsetY: event.worldY - hitObject.bounds.y
            };
        }
        this.statusMessage = null;
        this.syncSelectionOutline(true);
        this.onUiChanged();
    }

    public onPointerMove(event: EditorPointerEvent): void {
        const resizeState = this.resizeState;
        if (resizeState) {
            this.setSceneCursor(this.getResizeHandleCursor(resizeState.handle));
            this.applyResizeFromPointer(event.worldX, event.worldY);
            return;
        }

        const dragState = this.dragState;
        if (!dragState) {
            this.updateResizeCursor(event.worldX, event.worldY);
            return;
        }

        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.clearDragState();
            this.setSceneCursor('default');
            return;
        }
        const draggedObject = snapshot.objects.find((entry) => entry.id === dragState.objectId);
        if (!draggedObject) {
            this.clearDragState();
            this.setSceneCursor('default');
            return;
        }
        if (normalizeLayer(draggedObject.layer) !== this.selectedObjectLayer || draggedObject.editor?.hidden || draggedObject.editor?.locked) {
            this.clearDragState();
            this.setSceneCursor('default');
            return;
        }

        const nextX = Math.round(event.worldX - dragState.pointerOffsetX);
        const nextY = Math.round(event.worldY - dragState.pointerOffsetY);
        const changedX = Math.abs(nextX - draggedObject.bounds.x) >= 1;
        const changedY = Math.abs(nextY - draggedObject.bounds.y) >= 1;
        if (!changedX && !changedY) {
            return;
        }

        const result = this.backgroundObjectAuthoringService.updateObjectBounds(draggedObject.id, {
            x: nextX,
            y: nextY
        });
        const handled = this.handleObjectMutationResult(result, draggedObject.id);
        if (!handled.success) {
            this.clearDragState();
        }
    }

    public onPointerUp(event: EditorPointerEvent): void {
        if (event.button !== 0) {
            return;
        }
        this.clearDragState();
        this.clearResizeState();
        this.setSceneCursor('default');
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const objectSnapshot = this.backgroundObjectAuthoringService.getSnapshot();
        panel.setCustomContent('Background', (container) => {
            if (!objectSnapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            const levelId = objectSnapshot.levelId;
            const levelName = objectSnapshot.levelName;
            if (levelId) {
                container.appendChild(this.makeLine(`Level ID: ${levelId}`));
                container.appendChild(this.makeLine(`Level: ${levelName || levelId}`));
                container.appendChild(this.makeSpacer(8));
            }

            container.appendChild(this.makeSectionTitle('Layers'));
            const layerRow = document.createElement('div');
            layerRow.style.display = 'flex';
            layerRow.style.gap = '4px';
            layerRow.style.marginBottom = '8px';
            layerRow.append(
                this.makeLayerButton('Static', 'static'),
                this.makeLayerButton('Parallax 1', 'parallax1'),
                this.makeLayerButton('Parallax 2', 'parallax2')
            );
            container.appendChild(layerRow);

            container.appendChild(this.makeSectionTitle('Background Objects'));
            const layerObjects = this.getObjectsForSelectedLayer(objectSnapshot);
            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '4px';
            list.style.marginBottom = '8px';

            if (layerObjects.length === 0) {
                list.appendChild(this.makeInfoLine('No background objects in this layer.'));
                list.appendChild(this.makeCreateButtonsRow());
            } else {
                layerObjects.forEach((entry) => {
                    list.appendChild(this.makeObjectRow(entry));
                });
            }
            container.appendChild(list);

            container.appendChild(this.makeSectionTitle('Create'));
            container.appendChild(this.makeCreateButtonsRow());
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const objectSnapshot = this.backgroundObjectAuthoringService.getSnapshot();
        this.syncSelectedObject(objectSnapshot);
        const selectedObject = this.getSelectedObject(objectSnapshot);

        panel.setCustomContent('Background Properties', (container) => {
            if (!objectSnapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            if (this.statusMessage) {
                container.appendChild(this.makeErrorLine(this.statusMessage));
                container.appendChild(this.makeSpacer(6));
            }

            this.renderGlobalBackground(container, objectSnapshot);
            container.appendChild(this.makeSpacer(8));
            this.renderLayerSettings(container, objectSnapshot);
            container.appendChild(this.makeSpacer(8));
            this.renderSelectedObjectInspector(container, selectedObject);
        });
    }

    private renderGlobalBackground(container: HTMLDivElement, snapshot: BackgroundObjectSnapshot | null): void {
        container.appendChild(this.makeSectionTitle('Global Background'));
        if (!snapshot) {
            container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
            return;
        }

        container.appendChild(this.makeTextField({
            label: 'Color',
            value: colorToText(snapshot.backgroundColor ?? this.backgroundObjectAuthoringService.getBackgroundColor()),
            fieldKey: 'global.background.color',
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                if (parsed.value === null) {
                    return { success: false, error: 'Color cannot be empty.' };
                }
                return this.commitObject(() => this.backgroundObjectAuthoringService.updateBackgroundColor(parsed.value));
            }
        }));
    }

    private renderLayerSettings(container: HTMLDivElement, snapshot: BackgroundObjectSnapshot | null): void {
        container.appendChild(this.makeSectionTitle(`Layer Settings: ${layerToLabel(this.selectedObjectLayer)}`));
        if (!snapshot) {
            container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
            return;
        }
        if (this.selectedObjectLayer === 'static') {
            container.appendChild(this.makeInfoLine('Static layer has no parallax scroll.'));
            return;
        }

        const layerSettings = snapshot.layerSettings[this.selectedObjectLayer];
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorX',
            value: layerSettings.scrollFactorX,
            fieldKey: `layer.${this.selectedObjectLayer}.scrollFactorX`,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateLayerSettings(
                this.selectedObjectLayer,
                { scrollFactorX: value }
            ))
        }));
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorY',
            value: layerSettings.scrollFactorY,
            fieldKey: `layer.${this.selectedObjectLayer}.scrollFactorY`,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateLayerSettings(
                this.selectedObjectLayer,
                { scrollFactorY: value }
            ))
        }));
    }

    private renderSelectedObjectInspector(
        container: HTMLDivElement,
        selectedObject: TestWorldBackgroundObjectConfig | null
    ): void {
        container.appendChild(this.makeSectionTitle('Editing Background Object'));
        if (!selectedObject) {
            container.appendChild(this.makeInfoLine('Select a background object from the list.'));
            return;
        }

        const selectedLayer = normalizeLayer(selectedObject.layer);
        const isLocked = selectedObject.editor?.locked ?? false;

        container.appendChild(this.makeLine(selectedObject.name?.trim() || selectedObject.id));
        container.appendChild(this.makeInfoLine(`ID: ${selectedObject.id}`));
        container.appendChild(this.makeInfoLine(`Layer: ${layerToLabel(selectedLayer)}`));
        container.appendChild(this.makeSpacer(6));

        container.appendChild(this.makeSectionTitle('Meta'));
        container.appendChild(this.makeTextField({
            label: 'name',
            value: selectedObject.name ?? '',
            fieldKey: `object.${selectedObject.id}.meta.name`,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectMeta(
                selectedObject.id,
                { name: value }
            ))
        }));
        container.appendChild(this.makeSelectField({
            label: 'layer',
            value: selectedLayer,
            fieldKey: `object.${selectedObject.id}.meta.layer`,
            options: [
                { value: 'static', label: 'Static' },
                { value: 'parallax1', label: 'Parallax 1' },
                { value: 'parallax2', label: 'Parallax 2' }
            ],
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectMeta(
                selectedObject.id,
                { layer: normalizeLayer(value) }
            ))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'locked',
            checked: isLocked,
            fieldKey: `object.${selectedObject.id}.meta.locked`,
            onCommit: (checked) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectMeta(
                selectedObject.id,
                { editor: { locked: checked } }
            ))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'hidden',
            checked: selectedObject.editor?.hidden ?? false,
            fieldKey: `object.${selectedObject.id}.meta.hidden`,
            onCommit: (checked) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectMeta(
                selectedObject.id,
                { editor: { hidden: checked } }
            ))
        }));

        container.appendChild(this.makeSpacer(6));
        container.appendChild(this.makeSectionTitle('Bounds'));
        if (isLocked) {
            container.appendChild(this.makeInfoLine('Locked object: bounds and visual edits are disabled.'));
        }
        container.appendChild(this.makeNumberField({
            label: 'x',
            value: selectedObject.bounds.x,
            fieldKey: `object.${selectedObject.id}.bounds.x`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectBounds(
                selectedObject.id,
                { x: value }
            ))
        }));
        container.appendChild(this.makeNumberField({
            label: 'y',
            value: selectedObject.bounds.y,
            fieldKey: `object.${selectedObject.id}.bounds.y`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectBounds(
                selectedObject.id,
                { y: value }
            ))
        }));
        container.appendChild(this.makeNumberField({
            label: 'width',
            value: selectedObject.bounds.width,
            fieldKey: `object.${selectedObject.id}.bounds.width`,
            integer: true,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectBounds(
                selectedObject.id,
                { width: value }
            ))
        }));
        container.appendChild(this.makeNumberField({
            label: 'height',
            value: selectedObject.bounds.height,
            fieldKey: `object.${selectedObject.id}.bounds.height`,
            integer: true,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectBounds(
                selectedObject.id,
                { height: value }
            ))
        }));
        container.appendChild(this.makeNumberField({
            label: 'rotation',
            value: selectedObject.bounds.rotation ?? 0,
            fieldKey: `object.${selectedObject.id}.bounds.rotation`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectBounds(
                selectedObject.id,
                { rotation: value }
            ))
        }));

        container.appendChild(this.makeSpacer(6));
        container.appendChild(this.makeSectionTitle('Visual'));
        container.appendChild(this.makeTextField({
            label: 'shaderKey',
            value: selectedObject.visual.shaderKey ?? '',
            fieldKey: `object.${selectedObject.id}.visual.shaderKey`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { shaderKey: value }
            ))
        }));
        container.appendChild(this.makeTextField({
            label: 'textureKey',
            value: selectedObject.visual.textureKey ?? '',
            fieldKey: `object.${selectedObject.id}.visual.textureKey`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { textureKey: value }
            ))
        }));
        container.appendChild(this.makeTextField({
            label: 'textureAsset',
            value: selectedObject.visual.textureAsset ?? '',
            fieldKey: `object.${selectedObject.id}.visual.textureAsset`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { textureAsset: value }
            ))
        }));
        container.appendChild(this.makeTextField({
            label: 'fillColor',
            value: colorToText(selectedObject.visual.fillColor),
            fieldKey: `object.${selectedObject.id}.visual.fillColor`,
            disabled: isLocked,
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                return this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                    selectedObject.id,
                    { fillColor: parsed.value ?? undefined }
                ));
            }
        }));
        container.appendChild(this.makeTextField({
            label: 'strokeColor',
            value: colorToText(selectedObject.visual.strokeColor),
            fieldKey: `object.${selectedObject.id}.visual.strokeColor`,
            disabled: isLocked,
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                return this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                    selectedObject.id,
                    { strokeColor: parsed.value ?? undefined }
                ));
            }
        }));
        container.appendChild(this.makeNumberField({
            label: 'alpha',
            value: selectedObject.visual.alpha ?? 1,
            fieldKey: `object.${selectedObject.id}.visual.alpha`,
            disabled: isLocked,
            onCommit: (value) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { alpha: clamp(value, 0, 1) }
            ))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'tileHorizontalRepeat',
            checked: selectedObject.visual.tileHorizontalRepeat ?? false,
            fieldKey: `object.${selectedObject.id}.visual.tileHorizontalRepeat`,
            disabled: isLocked,
            onCommit: (checked) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { tileHorizontalRepeat: checked }
            ))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'tileVerticalRepeat',
            checked: selectedObject.visual.tileVerticalRepeat ?? false,
            fieldKey: `object.${selectedObject.id}.visual.tileVerticalRepeat`,
            disabled: isLocked,
            onCommit: (checked) => this.commitObject(() => this.backgroundObjectAuthoringService.updateObjectVisual(
                selectedObject.id,
                { tileVerticalRepeat: checked }
            ))
        }));

        container.appendChild(this.makeSpacer(6));
        container.appendChild(this.makeSectionTitle('Actions'));
        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.gap = '4px';
        actionsRow.style.flexWrap = 'wrap';
        actionsRow.style.marginBottom = '8px';
        actionsRow.appendChild(this.makeActionButton('Duplicate', () => {
            this.commitObject(() => this.backgroundObjectAuthoringService.duplicateObject(selectedObject.id));
        }));
        actionsRow.appendChild(this.makeConfirmedActionButton(
            'Delete',
            'Delete selected background object?',
            () => {
                this.commitObject(() => this.backgroundObjectAuthoringService.deleteObject(selectedObject.id));
            }
        ));
        container.appendChild(actionsRow);
    }

    private makeLayerButton(label: string, layer: BackgroundObjectLayerId): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.padding = '4px 6px';
        button.style.border = '1px solid #5f5f5f';
        button.style.cursor = 'pointer';
        button.style.background = this.selectedObjectLayer === layer ? '#8acb88' : '#d9d9d9';
        button.addEventListener('click', () => {
            this.setSelectedLayer(layer);
        });
        return button;
    }

    private makeObjectRow(entry: TestWorldBackgroundObjectConfig): HTMLButtonElement {
        const row = document.createElement('button');
        row.type = 'button';
        row.style.width = '100%';
        row.style.textAlign = 'left';
        row.style.padding = '4px 6px';
        row.style.border = '1px solid #7a7a7a';
        row.style.cursor = 'pointer';
        row.style.background = this.selectedObjectId === entry.id ? '#8acb88' : '#f2f2f2';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '2px';

        const title = document.createElement('div');
        title.textContent = entry.name?.trim() || entry.id;
        row.appendChild(title);

        const detail = document.createElement('div');
        detail.style.fontSize = '11px';
        detail.style.color = '#555';
        const markers: string[] = [];
        if (entry.editor?.locked) {
            markers.push('Locked');
        }
        if (entry.editor?.hidden) {
            markers.push('Hidden');
        }
        const markerText = markers.length > 0 ? ` - ${markers.join(', ')}` : '';
        detail.textContent = `${layerToLabel(normalizeLayer(entry.layer))}${markerText}`;
        row.appendChild(detail);

        row.addEventListener('click', () => {
            this.selectedObjectId = entry.id;
            this.clearDragState();
            this.clearResizeState();
            this.statusMessage = null;
            this.syncSelectionOutline(true);
            this.onUiChanged();
        });
        return row;
    }

    private makeCreateButtonsRow(): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '4px';
        row.style.flexWrap = 'wrap';

        row.appendChild(this.makeActionButton('Add Solid', () => {
            const result = this.backgroundObjectAuthoringService.createObject({
                layer: this.selectedObjectLayer,
                fillColor: DEFAULT_SOLID_FILL_COLOR
            });
            this.handleObjectMutationResult(result, result.object?.id ?? null);
        }));
        row.appendChild(this.makeActionButton('Add Demo Texture', () => {
            const result = this.backgroundObjectAuthoringService.createObject({
                layer: this.selectedObjectLayer,
                textureKey: layerToDemoTextureKey(this.selectedObjectLayer),
                textureAsset: DEFAULT_DEMO_TEXTURE_ASSET
            });
            this.handleObjectMutationResult(result, result.object?.id ?? null);
        }));

        return row;
    }

    private makeActionButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.padding = '4px 6px';
        button.style.border = '1px solid #5f5f5f';
        button.style.background = '#d9d9d9';
        button.style.cursor = 'pointer';
        button.addEventListener('click', onClick);
        return button;
    }

    private makeConfirmedActionButton(
        label: string,
        confirmMessage: string,
        onConfirm: () => void
    ): HTMLButtonElement {
        return this.makeActionButton(label, () => {
            if (!this.confirmAction(confirmMessage)) {
                return;
            }
            onConfirm();
        });
    }

    private makeTextField(options: {
        label: string;
        value: string;
        fieldKey: string;
        disabled?: boolean;
        onCommit: (value: string) => CommitResult;
    }): HTMLDivElement {
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        const label = this.makeLine(options.label);
        label.style.marginBottom = '2px';
        row.appendChild(label);
        const input = document.createElement('input');
        input.type = 'text';
        input.value = options.value;
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        input.style.border = '1px solid #777';
        input.style.padding = '2px 4px';
        input.disabled = options.disabled ?? false;
        let lastCommittedValue = options.value;

        const commit = (): void => {
            if (input.disabled) {
                return;
            }
            const nextValue = input.value;
            if (nextValue === lastCommittedValue) {
                if (this.fieldErrors.has(options.fieldKey)) {
                    this.clearFieldError(options.fieldKey);
                    this.onUiChanged();
                }
                return;
            }
            const result = options.onCommit(nextValue);
            if (!result.success) {
                this.setFieldError(options.fieldKey, result.error ?? 'Failed to apply value.');
                this.onUiChanged();
                return;
            }
            lastCommittedValue = nextValue;
            this.clearFieldError(options.fieldKey);
        };

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            }
        });
        input.addEventListener('change', commit);
        input.addEventListener('blur', commit);
        row.appendChild(input);
        const error = this.fieldErrors.get(options.fieldKey);
        if (error) {
            row.appendChild(this.makeErrorLine(error));
        }
        return row;
    }

    private makeSelectField(options: {
        label: string;
        value: string;
        fieldKey: string;
        disabled?: boolean;
        options: Array<{ value: string; label: string }>;
        onCommit: (value: string) => CommitResult;
    }): HTMLDivElement {
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        const label = this.makeLine(options.label);
        label.style.marginBottom = '2px';
        row.appendChild(label);

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.boxSizing = 'border-box';
        select.style.border = '1px solid #777';
        select.style.padding = '2px 4px';
        select.disabled = options.disabled ?? false;
        options.options.forEach((choice) => {
            const option = document.createElement('option');
            option.value = choice.value;
            option.textContent = choice.label;
            select.appendChild(option);
        });
        select.value = options.value;

        select.addEventListener('change', () => {
            if (select.disabled) {
                return;
            }
            const result = options.onCommit(select.value);
            if (!result.success) {
                this.setFieldError(options.fieldKey, result.error ?? 'Failed to apply value.');
                this.onUiChanged();
                return;
            }
            this.clearFieldError(options.fieldKey);
        });

        row.appendChild(select);
        const error = this.fieldErrors.get(options.fieldKey);
        if (error) {
            row.appendChild(this.makeErrorLine(error));
        }
        return row;
    }

    private makeNumberField(options: {
        label: string;
        value: number;
        fieldKey: string;
        integer?: boolean;
        disabled?: boolean;
        onCommit: (value: number) => CommitResult;
    }): HTMLDivElement {
        return this.makeTextField({
            label: options.label,
            value: Number.isFinite(options.value) ? String(options.value) : '',
            fieldKey: options.fieldKey,
            disabled: options.disabled,
            onCommit: (raw) => {
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) {
                    return { success: false, error: 'Expected a number.' };
                }
                const value = options.integer ? Math.round(parsed) : parsed;
                return options.onCommit(value);
            }
        });
    }

    private makeBooleanField(options: {
        label: string;
        checked: boolean;
        fieldKey: string;
        disabled?: boolean;
        onCommit: (value: boolean) => CommitResult;
    }): HTMLDivElement {
        const row = document.createElement('div');
        row.style.marginBottom = '8px';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.appendChild(this.makeLine(options.label));
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = options.checked;
        input.disabled = options.disabled ?? false;
        input.addEventListener('change', () => {
            if (input.disabled) {
                return;
            }
            const result = options.onCommit(input.checked);
            if (!result.success) {
                this.setFieldError(options.fieldKey, result.error ?? 'Failed to apply value.');
                this.onUiChanged();
                return;
            }
            this.clearFieldError(options.fieldKey);
        });
        row.appendChild(input);
        const error = this.fieldErrors.get(options.fieldKey);
        if (error) {
            row.appendChild(this.makeErrorLine(error));
        }
        return row;
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const title = document.createElement('div');
        title.textContent = text;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        return title;
    }

    private makeLine(text: string): HTMLDivElement {
        const line = document.createElement('div');
        line.textContent = text;
        return line;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const line = this.makeLine(text);
        line.style.color = '#333';
        line.style.fontStyle = 'italic';
        return line;
    }

    private makeErrorLine(text: string): HTMLDivElement {
        const line = this.makeLine(text);
        line.style.color = '#a71818';
        line.style.fontSize = '11px';
        line.style.marginTop = '2px';
        return line;
    }

    private makeSpacer(height: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = `${height}px`;
        return spacer;
    }

    private confirmAction(message: string): boolean {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            return window.confirm(message);
        }
        return true;
    }

    private setSelectedLayer(layer: BackgroundObjectLayerId): void {
        if (this.selectedObjectLayer === layer) {
            return;
        }
        this.selectedObjectLayer = layer;
        this.clearDragState();
        this.clearResizeState();
        this.setSceneCursor('default');
        this.statusMessage = null;
        this.syncSelectedObject();
        this.syncSelectionOutline(true);
        this.onUiChanged();
    }

    private commitObject(action: () => BackgroundObjectMutationResult): CommitResult {
        const result = action();
        return this.handleObjectMutationResult(result, result.object?.id ?? null);
    }

    private handleObjectMutationResult(
        result: BackgroundObjectMutationResult,
        preferredObjectId: string | null
    ): CommitResult {
        if (!result.success) {
            this.statusMessage = result.reason ?? 'Failed to apply background object edit.';
            return {
                success: false,
                error: this.statusMessage
            };
        }

        this.statusMessage = null;
        this.captureSignature();
        this.syncSelectedObject(result.snapshot ?? null, preferredObjectId);
        this.syncSelectionOutline(true);
        this.onUiChanged();
        return { success: true };
    }

    private setFieldError(fieldKey: string, message: string): void {
        this.fieldErrors.set(fieldKey, message);
    }

    private clearFieldError(fieldKey: string): void {
        this.fieldErrors.delete(fieldKey);
    }

    private readBackgroundSignature(): string | null {
        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            return null;
        }
        try {
            return JSON.stringify({
                backgroundColor: snapshot.backgroundColor,
                objects: snapshot.objects,
                layerSettings: snapshot.layerSettings
            });
        } catch {
            return null;
        }
    }

    private captureSignature(): void {
        this.lastBackgroundSignature = this.readBackgroundSignature();
    }

    private getObjectsForSelectedLayer(snapshot: BackgroundObjectSnapshot | null): TestWorldBackgroundObjectConfig[] {
        if (!snapshot) {
            return [];
        }
        return snapshot.objects.filter((entry) => normalizeLayer(entry.layer) === this.selectedObjectLayer);
    }

    private getSelectedObject(snapshot: BackgroundObjectSnapshot | null): TestWorldBackgroundObjectConfig | null {
        if (!snapshot || !this.selectedObjectId) {
            return null;
        }
        return snapshot.objects.find((entry) => entry.id === this.selectedObjectId) ?? null;
    }

    private findTopmostObjectAtPoint(
        snapshot: BackgroundObjectSnapshot,
        worldX: number,
        worldY: number
    ): TestWorldBackgroundObjectConfig | null {
        for (let index = snapshot.objects.length - 1; index >= 0; index -= 1) {
            const entry = snapshot.objects[index];
            if (normalizeLayer(entry.layer) !== this.selectedObjectLayer) {
                continue;
            }
            if (entry.editor?.hidden) {
                continue;
            }
            if (this.isPointInsideObjectBounds(entry, worldX, worldY)) {
                return entry;
            }
        }
        return null;
    }

    private isPointInsideObjectBounds(
        entry: TestWorldBackgroundObjectConfig,
        worldX: number,
        worldY: number
    ): boolean {
        const width = Number.isFinite(entry.bounds.width) ? Math.max(0, entry.bounds.width) : 0;
        const height = Number.isFinite(entry.bounds.height) ? Math.max(0, entry.bounds.height) : 0;
        const centerX = Number.isFinite(entry.bounds.x) ? entry.bounds.x : 0;
        const centerY = Number.isFinite(entry.bounds.y) ? entry.bounds.y : 0;
        if (width <= 0 || height <= 0) {
            return false;
        }

        const rotationDeg = Number.isFinite(entry.bounds.rotation) ? entry.bounds.rotation ?? 0 : 0;
        const rotationRad = (rotationDeg * Math.PI) / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        const localX = (dx * cos) + (dy * sin);
        const localY = (-dx * sin) + (dy * cos);
        return Math.abs(localX) <= (width * 0.5) && Math.abs(localY) <= (height * 0.5);
    }

    private clearSelectionOutline(): void {
        this.lastSelectionOutlineSignature = null;
        this.selectionOutline.clear();
        this.selectionOutline.setVisible(false);
    }

    private getResizeHandlePoints(
        object: TestWorldBackgroundObjectConfig
    ): Array<{ handle: BackgroundResizeHandle; x: number; y: number }> {
        const width = Number.isFinite(object.bounds.width) ? Math.max(0, object.bounds.width) : 0;
        const height = Number.isFinite(object.bounds.height) ? Math.max(0, object.bounds.height) : 0;
        const centerX = Number.isFinite(object.bounds.x) ? object.bounds.x : 0;
        const centerY = Number.isFinite(object.bounds.y) ? object.bounds.y : 0;
        const rotationDeg = Number.isFinite(object.bounds.rotation) ? object.bounds.rotation ?? 0 : 0;
        const rotationRad = (rotationDeg * Math.PI) / 180;
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const toWorld = (localX: number, localY: number): { x: number; y: number } => ({
            x: centerX + (localX * cos) - (localY * sin),
            y: centerY + (localX * sin) + (localY * cos)
        });
        const topLeft = toWorld(-halfWidth, -halfHeight);
        const topRight = toWorld(halfWidth, -halfHeight);
        const bottomRight = toWorld(halfWidth, halfHeight);
        const bottomLeft = toWorld(-halfWidth, halfHeight);
        return [
            { handle: 'top-left', x: topLeft.x, y: topLeft.y },
            { handle: 'top-right', x: topRight.x, y: topRight.y },
            { handle: 'bottom-right', x: bottomRight.x, y: bottomRight.y },
            { handle: 'bottom-left', x: bottomLeft.x, y: bottomLeft.y }
        ];
    }

    private findResizeHandleAtPoint(
        snapshot: BackgroundObjectSnapshot,
        worldX: number,
        worldY: number
    ): { objectId: string; handle: BackgroundResizeHandle } | null {
        const selectedObject = this.getSelectedObject(snapshot);
        if (!selectedObject) {
            return null;
        }
        if (normalizeLayer(selectedObject.layer) !== this.selectedObjectLayer) {
            return null;
        }
        if (selectedObject.editor?.hidden) {
            return null;
        }
        const points = this.getResizeHandlePoints(selectedObject);
        for (const point of points) {
            const withinX = Math.abs(worldX - point.x) <= BACKGROUND_RESIZE_HANDLE_HIT_RADIUS;
            const withinY = Math.abs(worldY - point.y) <= BACKGROUND_RESIZE_HANDLE_HIT_RADIUS;
            if (withinX && withinY) {
                return {
                    objectId: selectedObject.id,
                    handle: point.handle
                };
            }
        }
        return null;
    }

    private applyResizeFromPointer(worldX: number, worldY: number): void {
        const resizeState = this.resizeState;
        if (!resizeState) {
            return;
        }
        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.clearResizeState();
            this.setSceneCursor('default');
            return;
        }
        const selected = snapshot.objects.find((entry) => entry.id === resizeState.objectId) ?? null;
        if (!selected) {
            this.clearResizeState();
            this.setSceneCursor('default');
            return;
        }
        if (normalizeLayer(selected.layer) !== this.selectedObjectLayer || selected.editor?.hidden || selected.editor?.locked) {
            this.clearResizeState();
            this.setSceneCursor('default');
            return;
        }

        const start = resizeState.startBounds;
        const startHalfWidth = start.width * 0.5;
        const startHalfHeight = start.height * 0.5;
        const startLeft = start.x - startHalfWidth;
        const startRight = start.x + startHalfWidth;
        const startTop = start.y - startHalfHeight;
        const startBottom = start.y + startHalfHeight;
        let left = startLeft;
        let right = startRight;
        let top = startTop;
        let bottom = startBottom;

        if (resizeState.handle === 'top-left' || resizeState.handle === 'bottom-left') {
            left = Math.round(worldX);
            if ((right - left) < BACKGROUND_MIN_RESIZE_SIZE) {
                left = right - BACKGROUND_MIN_RESIZE_SIZE;
            }
        }
        if (resizeState.handle === 'top-right' || resizeState.handle === 'bottom-right') {
            right = Math.round(worldX);
            if ((right - left) < BACKGROUND_MIN_RESIZE_SIZE) {
                right = left + BACKGROUND_MIN_RESIZE_SIZE;
            }
        }
        if (resizeState.handle === 'top-left' || resizeState.handle === 'top-right') {
            top = Math.round(worldY);
            if ((bottom - top) < BACKGROUND_MIN_RESIZE_SIZE) {
                top = bottom - BACKGROUND_MIN_RESIZE_SIZE;
            }
        }
        if (resizeState.handle === 'bottom-left' || resizeState.handle === 'bottom-right') {
            bottom = Math.round(worldY);
            if ((bottom - top) < BACKGROUND_MIN_RESIZE_SIZE) {
                bottom = top + BACKGROUND_MIN_RESIZE_SIZE;
            }
        }

        const nextX = Math.round((left + right) * 0.5);
        const nextY = Math.round((top + bottom) * 0.5);
        const nextWidth = Math.max(BACKGROUND_MIN_RESIZE_SIZE, Math.round(right - left));
        const nextHeight = Math.max(BACKGROUND_MIN_RESIZE_SIZE, Math.round(bottom - top));
        const changed = nextX !== selected.bounds.x
            || nextY !== selected.bounds.y
            || nextWidth !== selected.bounds.width
            || nextHeight !== selected.bounds.height;
        if (!changed) {
            return;
        }

        const result = this.backgroundObjectAuthoringService.updateObjectBounds(selected.id, {
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
            rotation: start.rotation
        });
        const handled = this.handleObjectMutationResult(result, selected.id);
        if (!handled.success) {
            this.clearResizeState();
            this.setSceneCursor('default');
        }
    }

    private updateResizeCursor(worldX: number, worldY: number): void {
        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.setSceneCursor('default');
            return;
        }
        const resizeHit = this.findResizeHandleAtPoint(snapshot, worldX, worldY);
        if (!resizeHit) {
            this.setSceneCursor('default');
            return;
        }
        const target = snapshot.objects.find((entry) => entry.id === resizeHit.objectId) ?? null;
        if (target?.editor?.locked) {
            this.setSceneCursor('not-allowed');
            return;
        }
        this.setSceneCursor(this.getResizeHandleCursor(resizeHit.handle));
    }

    private getResizeHandleCursor(handle: BackgroundResizeHandle): string {
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

    private syncSelectionOutline(forceRedraw = false): void {
        const snapshot = this.backgroundObjectAuthoringService.getSnapshot();
        const selectedObject = this.getSelectedObject(snapshot);
        const nextSignature = this.buildSelectionOutlineSignature(selectedObject);
        if (!forceRedraw && this.lastSelectionOutlineSignature === nextSignature) {
            return;
        }
        this.lastSelectionOutlineSignature = nextSignature;

        this.selectionOutline.clear();
        if (!selectedObject) {
            this.selectionOutline.setVisible(false);
            return;
        }
        if (normalizeLayer(selectedObject.layer) !== this.selectedObjectLayer) {
            this.selectionOutline.setVisible(false);
            return;
        }
        if (selectedObject.editor?.hidden) {
            this.selectionOutline.setVisible(false);
            return;
        }

        const width = Number.isFinite(selectedObject.bounds.width) ? Math.max(0, selectedObject.bounds.width) : 0;
        const height = Number.isFinite(selectedObject.bounds.height) ? Math.max(0, selectedObject.bounds.height) : 0;
        const centerX = Number.isFinite(selectedObject.bounds.x) ? selectedObject.bounds.x : 0;
        const centerY = Number.isFinite(selectedObject.bounds.y) ? selectedObject.bounds.y : 0;
        if (width <= 0 || height <= 0) {
            this.selectionOutline.setVisible(false);
            return;
        }

        const rotationDeg = Number.isFinite(selectedObject.bounds.rotation) ? selectedObject.bounds.rotation ?? 0 : 0;
        const rotationRad = (rotationDeg * Math.PI) / 180;
        const halfWidth = width * 0.5;
        const halfHeight = height * 0.5;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        const toWorld = (localX: number, localY: number): { x: number; y: number } => ({
            x: centerX + (localX * cos) - (localY * sin),
            y: centerY + (localX * sin) + (localY * cos)
        });

        const topLeft = toWorld(-halfWidth, -halfHeight);
        const topRight = toWorld(halfWidth, -halfHeight);
        const bottomRight = toWorld(halfWidth, halfHeight);
        const bottomLeft = toWorld(-halfWidth, halfHeight);
        const handlePoints = this.getResizeHandlePoints(selectedObject);
        this.selectionOutline.setVisible(true);
        this.selectionOutline.lineStyle(
            2,
            selectedObject.editor?.locked ? BACKGROUND_SELECTION_OUTLINE_LOCKED_COLOR : BACKGROUND_SELECTION_OUTLINE_COLOR,
            1
        );
        this.selectionOutline.beginPath();
        this.selectionOutline.moveTo(topLeft.x, topLeft.y);
        this.selectionOutline.lineTo(topRight.x, topRight.y);
        this.selectionOutline.lineTo(bottomRight.x, bottomRight.y);
        this.selectionOutline.lineTo(bottomLeft.x, bottomLeft.y);
        this.selectionOutline.closePath();
        this.selectionOutline.strokePath();
        this.selectionOutline.fillStyle(
            selectedObject.editor?.locked ? BACKGROUND_SELECTION_OUTLINE_LOCKED_COLOR : BACKGROUND_SELECTION_OUTLINE_COLOR,
            selectedObject.editor?.locked ? 0.8 : 1
        );
        for (const handle of handlePoints) {
            this.selectionOutline.fillRect(
                handle.x - (BACKGROUND_RESIZE_HANDLE_SIZE * 0.5),
                handle.y - (BACKGROUND_RESIZE_HANDLE_SIZE * 0.5),
                BACKGROUND_RESIZE_HANDLE_SIZE,
                BACKGROUND_RESIZE_HANDLE_SIZE
            );
        }
    }

    private buildSelectionOutlineSignature(selectedObject: TestWorldBackgroundObjectConfig | null): string {
        if (!selectedObject) {
            return `none|${this.selectedObjectLayer}`;
        }
        return [
            this.selectedObjectLayer,
            normalizeLayer(selectedObject.layer),
            selectedObject.id,
            selectedObject.editor?.hidden ? 'hidden' : 'visible',
            selectedObject.editor?.locked ? 'locked' : 'unlocked',
            Number.isFinite(selectedObject.bounds.x) ? selectedObject.bounds.x : 0,
            Number.isFinite(selectedObject.bounds.y) ? selectedObject.bounds.y : 0,
            Number.isFinite(selectedObject.bounds.width) ? selectedObject.bounds.width : 0,
            Number.isFinite(selectedObject.bounds.height) ? selectedObject.bounds.height : 0,
            Number.isFinite(selectedObject.bounds.rotation) ? selectedObject.bounds.rotation ?? 0 : 0
        ].join('|');
    }

    private clearDragState(keepObjectId?: string): void {
        if (!this.dragState) {
            return;
        }
        if (keepObjectId && this.dragState.objectId === keepObjectId) {
            return;
        }
        this.dragState = null;
    }

    private clearResizeState(keepObjectId?: string): void {
        if (!this.resizeState) {
            return;
        }
        if (keepObjectId && this.resizeState.objectId === keepObjectId) {
            return;
        }
        this.resizeState = null;
    }

    private syncDragState(snapshot: BackgroundObjectSnapshot | null): void {
        const dragState = this.dragState;
        if (!dragState || !snapshot) {
            this.dragState = null;
            return;
        }
        if (this.selectedObjectId !== dragState.objectId) {
            this.dragState = null;
            return;
        }
        const selected = snapshot.objects.find((entry) => entry.id === dragState.objectId);
        if (!selected) {
            this.dragState = null;
            return;
        }
        if (normalizeLayer(selected.layer) !== this.selectedObjectLayer || selected.editor?.hidden || selected.editor?.locked) {
            this.dragState = null;
        }
    }

    private syncResizeState(snapshot: BackgroundObjectSnapshot | null): void {
        const resizeState = this.resizeState;
        if (!resizeState || !snapshot) {
            this.resizeState = null;
            return;
        }
        if (this.selectedObjectId !== resizeState.objectId) {
            this.resizeState = null;
            return;
        }
        const selected = snapshot.objects.find((entry) => entry.id === resizeState.objectId);
        if (!selected) {
            this.resizeState = null;
            return;
        }
        if (normalizeLayer(selected.layer) !== this.selectedObjectLayer || selected.editor?.hidden || selected.editor?.locked) {
            this.resizeState = null;
        }
    }

    private syncSelectedObject(
        snapshotInput?: BackgroundObjectSnapshot | null,
        preferredObjectId?: string | null
    ): void {
        const snapshot = snapshotInput ?? this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.selectedObjectId = null;
            this.syncDragState(snapshot);
            this.syncResizeState(snapshot);
            return;
        }

        let nextSelectedObjectId = this.selectedObjectId;
        if (preferredObjectId) {
            const preferred = snapshot.objects.find((entry) => entry.id === preferredObjectId);
            if (preferred && normalizeLayer(preferred.layer) === this.selectedObjectLayer) {
                nextSelectedObjectId = preferred.id;
            } else {
                nextSelectedObjectId = null;
            }
        } else if (nextSelectedObjectId) {
            const selected = snapshot.objects.find((entry) => entry.id === nextSelectedObjectId);
            if (!selected || normalizeLayer(selected.layer) !== this.selectedObjectLayer) {
                nextSelectedObjectId = null;
            }
        }

        this.selectedObjectId = nextSelectedObjectId;
        this.syncDragState(snapshot);
        this.syncResizeState(snapshot);
    }
}
