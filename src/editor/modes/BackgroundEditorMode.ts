import type { EditorMode, EditorModeRuntimeContext } from '../core/EditorMode';
import type { EditorPanel } from '../ui/EditorPanel';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { BackgroundAuthoringService } from '../background-authoring/BackgroundAuthoringService';
import type {
    TestWorldBackgroundImageConfig,
    TestWorldParallaxLayerConfig
} from '../../game/world/runtime/test_world_config';

type BackgroundTarget = 'static' | 'parallax_1' | 'parallax_2';

interface BackgroundEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

const COLOR_HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;
const COLOR_NUMBER_PATTERN = /^(0x)?([0-9a-fA-F]{1,6})$/;

const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
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
    const hasTexture = (image.textureKey?.trim().length ?? 0) > 0
        || (image.textureAsset?.trim().length ?? 0) > 0;
    return hasTexture || typeof image.fillColor === 'number';
};

export class BackgroundEditorMode implements EditorMode {
    public readonly id = 'background';
    public readonly label = 'Background';

    private readonly onUiChanged: () => void;
    private readonly backgroundAuthoringService: BackgroundAuthoringService;
    private selectedTarget: BackgroundTarget = 'static';
    private fieldErrors = new Map<string, string>();
    private lastBackgroundSignature: string | null = null;

    public constructor(options: BackgroundEditorModeOptions) {
        this.onUiChanged = options.onUiChanged;
        this.backgroundAuthoringService = new BackgroundAuthoringService(options.legacyObjectAdapter);
    }

    public enter(): void {
        this.captureSignature();
    }

    public update(_context: EditorModeRuntimeContext): void {
        const nextSignature = this.readBackgroundSignature();
        if (nextSignature !== this.lastBackgroundSignature) {
            this.lastBackgroundSignature = nextSignature;
            this.onUiChanged();
        }
    }

    public onRuntimeConfigImported(): void {
        this.captureSignature();
        this.fieldErrors.clear();
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const snapshot = this.backgroundAuthoringService.getSnapshot();
        panel.setCustomContent('Background', (container) => {
            if (!snapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            container.appendChild(this.makeLine(`Level ID: ${snapshot.levelId}`));
            container.appendChild(this.makeLine(`Level: ${snapshot.levelName || snapshot.levelId}`));
            container.appendChild(this.makeSpacer(8));

            container.appendChild(this.makeSectionTitle('Target'));
            const targetRow = document.createElement('div');
            targetRow.style.display = 'flex';
            targetRow.style.gap = '4px';
            targetRow.style.marginBottom = '8px';
            targetRow.append(
                this.makeTargetButton('Static', 'static'),
                this.makeTargetButton('Parallax 1', 'parallax_1'),
                this.makeTargetButton('Parallax 2', 'parallax_2')
            );
            container.appendChild(targetRow);

            container.appendChild(this.makeSectionTitle('Background Targets'));
            const list = document.createElement('div');
            list.style.marginBottom = '8px';
            list.appendChild(this.makeTargetListRow({
                label: 'Static',
                target: 'static',
                present: !!snapshot.staticImage,
                value: snapshot.staticImage
                    ? `${snapshot.staticImage.textureKey || '(fill only)'}`
                    : '(missing)'
            }));
            list.appendChild(this.makeTargetListRow({
                label: 'Parallax 1',
                target: 'parallax_1',
                present: !!snapshot.parallax1,
                value: snapshot.parallax1
                    ? `${snapshot.parallax1.id} (${snapshot.parallax1.textureKey || 'fill only'})`
                    : '(missing)'
            }));
            list.appendChild(this.makeTargetListRow({
                label: 'Parallax 2',
                target: 'parallax_2',
                present: !!snapshot.parallax2,
                value: snapshot.parallax2
                    ? `${snapshot.parallax2.id} (${snapshot.parallax2.textureKey || 'fill only'})`
                    : '(missing)'
            }));
            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const snapshot = this.backgroundAuthoringService.getSnapshot();
        panel.setCustomContent('Background Properties', (container) => {
            if (!snapshot) {
                const unavailable = document.createElement('div');
                unavailable.textContent = 'Runtime config unavailable.';
                container.appendChild(unavailable);
                return;
            }

            const backgroundColor = snapshot.background?.color;
            container.appendChild(this.makeSectionTitle('Global'));
            container.appendChild(this.makeTextField({
                label: 'Background color',
                value: colorToText(backgroundColor),
                fieldKey: 'background.color',
                onCommit: (value) => {
                    const parsed = parseColorInput(value);
                    if (parsed.error) {
                        return { success: false, error: parsed.error };
                    }
                    if (parsed.value === null) {
                        return { success: false, error: 'Background color cannot be empty.' };
                    }
                    return this.commit(() => this.backgroundAuthoringService.patchBackgroundColor(parsed.value));
                }
            }));

            container.appendChild(this.makeSpacer(10));
            container.appendChild(this.makeSectionTitle(
                this.selectedTarget === 'static'
                    ? 'Editing: Static'
                    : this.selectedTarget === 'parallax_1'
                        ? 'Editing: Parallax 1'
                        : 'Editing: Parallax 2'
            ));

            if (this.selectedTarget === 'static') {
                if (!snapshot.staticImage) {
                    container.appendChild(this.makeMissingTargetState(
                        'Static image is missing.',
                        'Ensure Static',
                        () => this.commit(() => this.backgroundAuthoringService.ensureStatic())
                    ));
                    return;
                }
                container.appendChild(this.makeLifecycleActionsRow([
                    this.makeConfirmedActionButton(
                        'Remove Static',
                        'Remove Static background?',
                        () => {
                            this.commit(() => this.backgroundAuthoringService.removeStatic());
                        }
                    ),
                    this.makeConfirmedActionButton(
                        'Reset Static',
                        'Reset Static background to defaults?',
                        () => {
                            this.commit(() => this.backgroundAuthoringService.resetStatic());
                        }
                    )
                ]));
                this.renderImageFields(container, snapshot.staticImage, 'static');
                return;
            }

            const layer = this.selectedTarget === 'parallax_1' ? snapshot.parallax1 : snapshot.parallax2;
            const slot = this.selectedTarget === 'parallax_1' ? 1 : 2;
            if (!layer) {
                container.appendChild(this.makeMissingTargetState(
                    `Parallax ${slot} is missing.`,
                    `Ensure Parallax ${slot}`,
                    () => this.commit(() => this.backgroundAuthoringService.ensureParallax(slot))
                ));
                return;
            }
            container.appendChild(this.makeLifecycleActionsRow([
                this.makeConfirmedActionButton(
                    `Remove Parallax ${slot}`,
                    `Remove Parallax ${slot}?`,
                    () => {
                        this.commit(() => this.backgroundAuthoringService.removeParallaxSlot(slot));
                    }
                ),
                this.makeConfirmedActionButton(
                    `Reset Parallax ${slot}`,
                    `Reset Parallax ${slot} to defaults?`,
                    () => {
                        this.commit(() => this.backgroundAuthoringService.resetParallaxSlot(slot));
                    }
                )
            ]));
            this.renderParallaxFields(container, layer, slot);
        });
    }

    private renderImageFields(
        container: HTMLDivElement,
        image: TestWorldBackgroundImageConfig,
        kind: 'static' | 1 | 2
    ): void {
        const kindKey = kind === 'static' ? 'static' : `parallax_${kind}`;
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
        ): { success: boolean; error?: string } => {
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
                return this.commit(() => patchImage({ textureKey: nextTextureKey }));
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
                return this.commit(() => patchImage({ textureAsset: nextTextureAsset || undefined }));
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
                return this.commit(() => patchImage({ fillColor: parsed.value ?? undefined }));
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
                return this.commit(() => patchImage({ tintColor: parsed.value ?? undefined }));
            }
        }));
        container.appendChild(this.makeNumberField({
            label: 'alpha',
            value: image.alpha ?? 1,
            fieldKey: `${kindKey}.alpha`,
            onCommit: (value) => this.commit(() => patchImage({ alpha: clamp(value, 0, 1) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'scale',
            value: image.scale ?? 1,
            fieldKey: `${kindKey}.scale`,
            onCommit: (value) => this.commit(() => patchImage({ scale: Math.max(0.1, value) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'width',
            value: image.width ?? 0,
            fieldKey: `${kindKey}.width`,
            integer: true,
            onCommit: (value) => this.commit(() => patchImage({ width: Math.max(8, Math.round(value)) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'height',
            value: image.height ?? 0,
            fieldKey: `${kindKey}.height`,
            integer: true,
            onCommit: (value) => this.commit(() => patchImage({ height: Math.max(8, Math.round(value)) }))
        }));
        container.appendChild(this.makeBooleanField({
            label: 'repeat',
            checked: image.repeat ?? false,
            fieldKey: `${kindKey}.repeat`,
            onCommit: (checked) => this.commit(() => patchImage({ repeat: checked }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'x',
            value: image.x ?? 0,
            fieldKey: `${kindKey}.x`,
            onCommit: (value) => this.commit(() => patchImage({ x: value }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'y',
            value: image.y ?? 0,
            fieldKey: `${kindKey}.y`,
            onCommit: (value) => this.commit(() => patchImage({ y: value }))
        }));
    }

    private renderParallaxFields(container: HTMLDivElement, layer: TestWorldParallaxLayerConfig, slot: 1 | 2): void {
        container.appendChild(this.makeTextField({
            label: 'id',
            value: layer.id,
            fieldKey: `parallax_${slot}.id`,
            onCommit: (value) => {
                const id = value.trim();
                if (!id) {
                    return { success: false, error: 'id cannot be empty.' };
                }
                return this.commit(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { id }));
            }
        }));
        this.renderImageFields(container, layer, slot);
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorX',
            value: layer.scrollFactorX,
            fieldKey: `parallax_${slot}.scrollFactorX`,
            onCommit: (value) => this.commit(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { scrollFactorX: clamp(value, 0, 2) }))
        }));
        container.appendChild(this.makeNumberField({
            label: 'scrollFactorY',
            value: layer.scrollFactorY ?? layer.scrollFactorX,
            fieldKey: `parallax_${slot}.scrollFactorY`,
            onCommit: (value) => this.commit(() => this.backgroundAuthoringService.patchParallaxLayer(slot, { scrollFactorY: clamp(value, 0, 2) }))
        }));
    }

    private makeTargetButton(label: string, target: BackgroundTarget): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.padding = '4px 6px';
        button.style.border = '1px solid #5f5f5f';
        button.style.cursor = 'pointer';
        button.style.background = this.selectedTarget === target ? '#8acb88' : '#d9d9d9';
        button.addEventListener('click', () => {
            this.setSelectedTarget(target);
        });
        return button;
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

    private makeTargetListRow(options: {
        label: string;
        target: BackgroundTarget;
        present: boolean;
        value: string;
    }): HTMLDivElement {
        const row = document.createElement('div');
        row.style.padding = '4px 6px';
        row.style.marginBottom = '4px';
        row.style.border = '1px solid #7a7a7a';
        row.style.cursor = 'pointer';
        row.style.userSelect = 'none';
        row.style.background = this.selectedTarget === options.target ? '#8acb88' : '#f2f2f2';
        row.textContent = `${options.label}: ${options.value}`;
        if (!options.present) {
            row.style.color = '#6f6f6f';
        }
        row.addEventListener('click', () => {
            this.setSelectedTarget(options.target);
        });
        return row;
    }

    private makeTextField(options: {
        label: string;
        value: string;
        fieldKey: string;
        onCommit: (value: string) => { success: boolean; error?: string };
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
        let lastCommittedValue = options.value;

        const commit = (): void => {
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
        onCommit: (value: number) => { success: boolean; error?: string };
    }): HTMLDivElement {
        return this.makeTextField({
            label: options.label,
            value: Number.isFinite(options.value) ? String(options.value) : '',
            fieldKey: options.fieldKey,
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
        onCommit: (value: boolean) => { success: boolean; error?: string };
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
        input.addEventListener('change', () => {
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

    private setSelectedTarget(target: BackgroundTarget): void {
        if (this.selectedTarget === target) {
            return;
        }
        this.selectedTarget = target;
        this.onUiChanged();
    }

    private commit(action: () => { success: boolean; reason?: string }): { success: boolean; error?: string } {
        const result = action();
        if (!result.success) {
            return { success: false, error: result.reason ?? 'Failed to apply background config.' };
        }
        this.captureSignature();
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
}
