
import type { EditorMode, EditorModeRuntimeContext } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { BackgroundAuthoringService } from '../background-authoring/BackgroundAuthoringService';
import {
    BackgroundObjectAuthoringService,
    type BackgroundObjectLayerId,
    type BackgroundObjectMutationResult,
    type BackgroundObjectSnapshot
} from '../background-authoring/BackgroundObjectAuthoringService';
import type {
    TestWorldBackgroundImageConfig,
    TestWorldBackgroundObjectConfig,
    TestWorldParallaxLayerConfig
} from '../../game/world/runtime/test_world_config';

type BackgroundTarget = 'static' | 'parallax_1' | 'parallax_2';

interface BackgroundEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

interface CommitResult {
    success: boolean;
    error?: string;
}

const COLOR_HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;
const COLOR_NUMBER_PATTERN = /^(0x)?([0-9a-fA-F]{1,6})$/;
const DEFAULT_SOLID_FILL_COLOR = 0x1f2a30;
const DEFAULT_DEMO_TEXTURE_ASSET = 'assets/bg.png';

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

const layerToLegacyTarget = (layer: BackgroundObjectLayerId): BackgroundTarget => {
    if (layer === 'parallax1') {
        return 'parallax_1';
    }
    if (layer === 'parallax2') {
        return 'parallax_2';
    }
    return 'static';
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

const isRenderableBackgroundImage = (image: {
    textureKey?: string;
    textureAsset?: string;
    fillColor?: number;
}): boolean => {
    const hasTexture = (image.textureKey?.trim().length ?? 0)
        || (image.textureAsset?.trim().length ?? 0);
    return hasTexture > 0 || typeof image.fillColor === 'number';
};

export class BackgroundEditorMode implements EditorMode {
    public readonly id = 'background';
    public readonly label = 'Background';

    private readonly onUiChanged: () => void;
    private readonly backgroundAuthoringService: BackgroundAuthoringService;
    private readonly backgroundObjectAuthoringService: BackgroundObjectAuthoringService;
    private selectedObjectLayer: BackgroundObjectLayerId = 'static';
    private selectedObjectId: string | null = null;
    private fieldErrors = new Map<string, string>();
    private statusMessage: string | null = null;
    private lastBackgroundSignature: string | null = null;

    public constructor(options: BackgroundEditorModeOptions) {
        this.onUiChanged = options.onUiChanged;
        this.backgroundAuthoringService = new BackgroundAuthoringService(options.legacyObjectAdapter);
        this.backgroundObjectAuthoringService = new BackgroundObjectAuthoringService(options.legacyObjectAdapter);
    }

    public enter(): void {
        this.captureSignature();
        this.syncSelectedObject();
    }

    public update(_context: EditorModeRuntimeContext): void {
        const nextSignature = this.readBackgroundSignature();
        if (nextSignature !== this.lastBackgroundSignature) {
            this.lastBackgroundSignature = nextSignature;
            this.syncSelectedObject();
            this.onUiChanged();
        }
    }

    public onRuntimeConfigImported(): void {
        this.captureSignature();
        this.fieldErrors.clear();
        this.statusMessage = null;
        this.syncSelectedObject();
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const legacySnapshot = this.backgroundAuthoringService.getSnapshot();
        const objectSnapshot = this.backgroundObjectAuthoringService.getSnapshot();
        panel.setCustomContent('Background', (container) => {
            if (!legacySnapshot && !objectSnapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            const levelId = objectSnapshot?.levelId ?? legacySnapshot?.levelId;
            const levelName = objectSnapshot?.levelName ?? legacySnapshot?.levelName;
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
        const legacySnapshot = this.backgroundAuthoringService.getSnapshot();
        this.syncSelectedObject(objectSnapshot);
        const selectedObject = this.getSelectedObject(objectSnapshot);

        panel.setCustomContent('Background Properties', (container) => {
            if (!objectSnapshot && !legacySnapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            if (this.statusMessage) {
                container.appendChild(this.makeErrorLine(this.statusMessage));
                container.appendChild(this.makeSpacer(6));
            }

            this.renderLayerSettings(container, objectSnapshot);
            container.appendChild(this.makeSpacer(8));
            this.renderSelectedObjectInspector(container, selectedObject);
            container.appendChild(this.makeSpacer(10));
            this.renderLegacyPreviewInspector(container, legacySnapshot);
        });
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

    private renderLegacyPreviewInspector(
        container: HTMLDivElement,
        snapshot: ReturnType<BackgroundAuthoringService['getSnapshot']>
    ): void {
        container.appendChild(this.makeSectionTitle('Legacy Preview Background'));
        container.appendChild(this.makeInfoLine(
            'Temporary renderer-backed background config. Object-based background items are saved/exported but not rendered yet.'
        ));

        if (!snapshot) {
            container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
            return;
        }

        const backgroundColor = snapshot.background?.color;
        container.appendChild(this.makeSpacer(6));
        container.appendChild(this.makeTextField({
            label: 'Background color',
            value: colorToText(backgroundColor),
            fieldKey: 'legacy.background.color',
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                if (parsed.value === null) {
                    return { success: false, error: 'Background color cannot be empty.' };
                }
                return this.commitLegacy(() => this.backgroundAuthoringService.patchBackgroundColor(parsed.value));
            }
        }));

        const legacyTarget = layerToLegacyTarget(this.selectedObjectLayer);
        container.appendChild(this.makeSectionTitle(
            legacyTarget === 'static'
                ? 'Legacy Target: Static'
                : legacyTarget === 'parallax_1'
                    ? 'Legacy Target: Parallax 1'
                    : 'Legacy Target: Parallax 2'
        ));

        if (legacyTarget === 'static') {
            if (!snapshot.staticImage) {
                container.appendChild(this.makeMissingTargetState(
                    'Static image is missing.',
                    'Ensure Static',
                    () => this.commitLegacy(() => this.backgroundAuthoringService.ensureStatic())
                ));
                return;
            }
            container.appendChild(this.makeLifecycleActionsRow([
                this.makeConfirmedActionButton(
                    'Remove Static',
                    'Remove Static background?',
                    () => {
                        this.commitLegacy(() => this.backgroundAuthoringService.removeStatic());
                    }
                ),
                this.makeConfirmedActionButton(
                    'Reset Static',
                    'Reset Static background to defaults?',
                    () => {
                        this.commitLegacy(() => this.backgroundAuthoringService.resetStatic());
                    }
                )
            ]));
            this.renderLegacyImageFields(container, snapshot.staticImage, 'static');
            return;
        }

        const layer = legacyTarget === 'parallax_1' ? snapshot.parallax1 : snapshot.parallax2;
        const slot = legacyTarget === 'parallax_1' ? 1 : 2;
        if (!layer) {
            container.appendChild(this.makeMissingTargetState(
                `Parallax ${slot} is missing.`,
                `Ensure Parallax ${slot}`,
                () => this.commitLegacy(() => this.backgroundAuthoringService.ensureParallax(slot))
            ));
            return;
        }
        container.appendChild(this.makeLifecycleActionsRow([
            this.makeConfirmedActionButton(
                `Remove Parallax ${slot}`,
                `Remove Parallax ${slot}?`,
                () => {
                    this.commitLegacy(() => this.backgroundAuthoringService.removeParallaxSlot(slot));
                }
            ),
            this.makeConfirmedActionButton(
                `Reset Parallax ${slot}`,
                `Reset Parallax ${slot} to defaults?`,
                () => {
                    this.commitLegacy(() => this.backgroundAuthoringService.resetParallaxSlot(slot));
                }
            )
        ]));
        this.renderLegacyParallaxFields(container, layer, slot);
    }

    private renderLegacyImageFields(
        container: HTMLDivElement,
        image: TestWorldBackgroundImageConfig,
        kind: 'static' | 1 | 2
    ): void {
        const kindKey = kind === 'static' ? 'legacy.static' : `legacy.parallax_${kind}`;
        const patchImage = (patch: Partial<TestWorldBackgroundImageConfig>) => {
            if (kind === 'static') {
                return this.backgroundAuthoringService.patchStaticImage(patch);
            }
            return this.backgroundAuthoringService.patchParallaxLayer(kind, patch);
        };
        const ensureRenderablePatch = (
            nextTextureKey: string | undefined,
            nextTextureAsset: string | undefined,
            nextFillColor: number | undefined
        ): CommitResult => {
            if (!isRenderableBackgroundImage({
                textureKey: nextTextureKey,
                textureAsset: nextTextureAsset,
                fillColor: nextFillColor
            })) {
                return {
                    success: false,
                    error: 'Texture key/asset can both be empty only when fillColor exists.'
                };
            }
            return { success: true };
        };

        container.appendChild(this.makeTextField({
            label: 'textureKey',
            value: image.textureKey ?? '',
            fieldKey: `${kindKey}.textureKey`,
            onCommit: (value) => {
                const nextTextureKey = value.trim();
                const guard = ensureRenderablePatch(nextTextureKey, image.textureAsset, image.fillColor);
                if (!guard.success) {
                    return guard;
                }
                return this.commitLegacy(() => patchImage({ textureKey: nextTextureKey }));
            }
        }));
        container.appendChild(this.makeTextField({
            label: 'textureAsset',
            value: image.textureAsset ?? '',
            fieldKey: `${kindKey}.textureAsset`,
            onCommit: (value) => {
                const nextTextureAsset = value.trim();
                const guard = ensureRenderablePatch(image.textureKey, nextTextureAsset, image.fillColor);
                if (!guard.success) {
                    return guard;
                }
                return this.commitLegacy(() => patchImage({ textureAsset: nextTextureAsset || undefined }));
            }
        }));
        container.appendChild(this.makeTextField({
            label: 'fillColor',
            value: colorToText(image.fillColor),
            fieldKey: `${kindKey}.fillColor`,
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                const guard = ensureRenderablePatch(image.textureKey, image.textureAsset, parsed.value ?? undefined);
                if (!guard.success) {
                    return guard;
                }
                return this.commitLegacy(() => patchImage({ fillColor: parsed.value ?? undefined }));
            }
        }));
        container.appendChild(this.makeTextField({
            label: 'tintColor',
            value: colorToText(image.tintColor),
            fieldKey: `${kindKey}.tintColor`,
            onCommit: (value) => {
                const parsed = parseColorInput(value);
                if (parsed.error) {
                    return { success: false, error: parsed.error };
                }
                return this.commitLegacy(() => patchImage({ tintColor: parsed.value ?? undefined }));
            }
        }));
        container.appendChild(this.makeNumberField({
            label: 'alpha',
            value: image.alpha ?? 1,
            fieldKey: `${kindKey}.alpha`,
            onCommit: (value) => this.commitLegacy(() => patchImage({ alpha: clamp(value, 0, 1) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'scale',
            value: image.scale ?? 1,
            fieldKey: `${kindKey}.scale`,
            onCommit: (value) => this.commitLegacy(() => patchImage({ scale: Math.max(0.1, value) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'width',
            value: image.width ?? 0,
            fieldKey: `${kindKey}.width`,
            integer: true,
            onCommit: (value) => this.commitLegacy(() => patchImage({ width: Math.max(8, Math.round(value)) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'height',
            value: image.height ?? 0,
            fieldKey: `${kindKey}.height`,
            integer: true,
            onCommit: (value) => this.commitLegacy(() => patchImage({ height: Math.max(8, Math.round(value)) }))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'repeat',
            checked: image.repeat ?? false,
            fieldKey: `${kindKey}.repeat`,
            onCommit: (checked) => this.commitLegacy(() => patchImage({ repeat: checked }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'x',
            value: image.x ?? 0,
            fieldKey: `${kindKey}.x`,
            onCommit: (value) => this.commitLegacy(() => patchImage({ x: value }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'y',
            value: image.y ?? 0,
            fieldKey: `${kindKey}.y`,
            onCommit: (value) => this.commitLegacy(() => patchImage({ y: value }))
        }));
    }

    private renderLegacyParallaxFields(container: HTMLDivElement, layer: TestWorldParallaxLayerConfig, slot: 1 | 2): void {
        container.appendChild(this.makeTextField({
            label: 'id',
            value: layer.id,
            fieldKey: `legacy.parallax_${slot}.id`,
            onCommit: (value) => {
                const id = value.trim();
                if (!id) {
                    return { success: false, error: 'id cannot be empty.' };
                }
                return this.commitLegacy(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { id }));
            }
        }));
        this.renderLegacyImageFields(container, layer, slot);
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorX',
            value: layer.scrollFactorX,
            fieldKey: `legacy.parallax_${slot}.scrollFactorX`,
            onCommit: (value) => this.commitLegacy(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { scrollFactorX: clamp(value, 0, 2) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorY',
            value: layer.scrollFactorY ?? layer.scrollFactorX,
            fieldKey: `legacy.parallax_${slot}.scrollFactorY`,
            onCommit: (value) => this.commitLegacy(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { scrollFactorY: clamp(value, 0, 2) }))
        }));
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
            this.statusMessage = null;
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

    private makeLifecycleActionsRow(buttons: HTMLButtonElement[]): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexWrap = 'wrap';
        row.style.gap = '4px';
        row.style.marginBottom = '8px';
        buttons.forEach((button) => row.appendChild(button));
        return row;
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

    private makeMissingTargetState(
        message: string,
        actionLabel: string,
        onEnsure: () => void
    ): HTMLDivElement {
        const root = document.createElement('div');
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        root.style.gap = '6px';
        root.style.marginBottom = '8px';
        root.appendChild(this.makeInfoLine(message));
        root.appendChild(this.makeActionButton(actionLabel, onEnsure));
        return root;
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
        this.statusMessage = null;
        this.syncSelectedObject();
        this.onUiChanged();
    }

    private commitLegacy(action: () => { success: boolean; reason?: string }): CommitResult {
        const result = action();
        if (!result.success) {
            this.statusMessage = result.reason ?? 'Failed to apply background config.';
            return { success: false, error: this.statusMessage };
        }
        this.statusMessage = null;
        this.captureSignature();
        this.syncSelectedObject();
        this.onUiChanged();
        return { success: true };
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
        const snapshot = this.backgroundAuthoringService.getSnapshot();
        if (!snapshot) {
            return null;
        }
        try {
            return JSON.stringify(snapshot.runtimeConfig.background);
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

    private syncSelectedObject(
        snapshotInput?: BackgroundObjectSnapshot | null,
        preferredObjectId?: string | null
    ): void {
        const snapshot = snapshotInput ?? this.backgroundObjectAuthoringService.getSnapshot();
        if (!snapshot) {
            this.selectedObjectId = null;
            return;
        }

        if (preferredObjectId) {
            const preferred = snapshot.objects.find((entry) => entry.id === preferredObjectId);
            if (preferred && normalizeLayer(preferred.layer) === this.selectedObjectLayer) {
                this.selectedObjectId = preferred.id;
                return;
            }
        }

        const selected = this.selectedObjectId
            ? snapshot.objects.find((entry) => entry.id === this.selectedObjectId)
            : null;
        if (selected) {
            if (normalizeLayer(selected.layer) === this.selectedObjectLayer) {
                return;
            }
            const inLayer = snapshot.objects.find((entry) => normalizeLayer(entry.layer) === this.selectedObjectLayer);
            this.selectedObjectId = inLayer?.id ?? null;
            return;
        }

        const fallback = snapshot.objects.find((entry) => normalizeLayer(entry.layer) === this.selectedObjectLayer);
        this.selectedObjectId = fallback?.id ?? null;
    }
}
