import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import type { EditorPanel } from '../ui/EditorPanel';
import type { TestWorldConfig, TestWorldCutsceneConfig } from '../../game/world/runtime/test_world_config';
import { bindEditorInputKeyboardGuards } from './logic/LogicEditorDom';

interface CutscenesEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

export class CutscenesEditorMode implements EditorMode {
    public readonly id = 'cutscenes';
    public readonly label = 'Cutscenes';

    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly onUiChanged: () => void;
    private selectedCutsceneId: string | null = null;
    private lastSnapshotSignature: string | null = null;

    public constructor(options: CutscenesEditorModeOptions) {
        this.legacyObjectAdapter = options.legacyObjectAdapter;
        this.onUiChanged = options.onUiChanged;
    }

    public enter(): void {
        this.lastSnapshotSignature = this.readSnapshotSignature();
    }

    public update(): void {
        const nextSignature = this.readSnapshotSignature();
        if (nextSignature === this.lastSnapshotSignature) {
            return;
        }
        this.lastSnapshotSignature = nextSignature;
        this.syncSelectedCutscene(this.getCutscenes());
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getRuntimeConfig();
        const cutscenes = this.getCutscenes();
        const selected = this.syncSelectedCutscene(cutscenes);

        panel.setCustomContent('Cutscenes', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeModeTabs());
            container.appendChild(this.makeSpacer(8));

            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.textContent = 'Create Cutscene';
            createButton.style.width = '100%';
            bindEditorInputKeyboardGuards(createButton);
            createButton.addEventListener('click', () => {
                const created = this.createCutscene();
                if (created) {
                    this.selectCutscene(created.id);
                }
            });
            container.appendChild(createButton);

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete Selected';
            deleteButton.style.width = '100%';
            deleteButton.style.marginTop = '6px';
            deleteButton.disabled = !selected;
            bindEditorInputKeyboardGuards(deleteButton);
            deleteButton.addEventListener('click', () => {
                if (selected) {
                    this.deleteCutscene(selected.id);
                }
            });
            container.appendChild(deleteButton);

            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeInfoLine(`Count: ${cutscenes.length}`));

            if (cutscenes.length <= 0) {
                container.appendChild(this.makeSpacer(8));
                container.appendChild(this.makeInfoLine('No cutscenes yet.'));
                return;
            }

            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '6px';
            list.style.marginTop = '8px';

            cutscenes.forEach((cutscene) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.style.textAlign = 'left';
                card.style.border = '1px solid #7a7a7a';
                card.style.background = cutscene.id === this.selectedCutsceneId ? '#9ec9ff' : '#e8e8e8';
                card.style.padding = '6px';
                card.style.cursor = 'pointer';
                bindEditorInputKeyboardGuards(card);
                card.addEventListener('click', () => {
                    this.selectCutscene(cutscene.id);
                });

                card.appendChild(this.makeInfoLine(cutscene.name));
                card.appendChild(this.makeInfoLine(`${cutscene.id} | ${cutscene.type} | ${cutscene.durationMs}ms`));
                list.appendChild(card);
            });

            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getRuntimeConfig();
        const cutscenes = this.getCutscenes();
        const selected = this.syncSelectedCutscene(cutscenes);

        panel.setCustomContent('Cutscene Inspector', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }
            if (!selected) {
                container.appendChild(this.makeInfoLine('Select a cutscene.'));
                return;
            }

            container.appendChild(this.makeModeTabs());
            container.appendChild(this.makeSpacer(10));

            container.appendChild(this.makeKeyValueLine('id', selected.id));
            container.appendChild(this.makeKeyValueLine('type', selected.type));
            container.appendChild(this.makeKeyValueLine('startCondition', selected.startCondition ? 'configured (deferred)' : 'none'));

            container.appendChild(this.makeSpacer(8));

            const nameLabel = this.makeInfoLine('Name');
            container.appendChild(nameLabel);
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = selected.name;
            nameInput.style.width = '100%';
            bindEditorInputKeyboardGuards(nameInput);
            nameInput.addEventListener('change', () => {
                const nextName = nameInput.value.trim();
                this.updateCutscene(selected.id, {
                    name: nextName.length > 0 ? nextName : selected.name
                });
            });
            container.appendChild(nameInput);

            container.appendChild(this.makeSpacer(8));
            const durationLabel = this.makeInfoLine('Duration (ms)');
            container.appendChild(durationLabel);
            const durationInput = document.createElement('input');
            durationInput.type = 'number';
            durationInput.min = '0';
            durationInput.step = '100';
            durationInput.value = String(selected.durationMs);
            durationInput.style.width = '100%';
            bindEditorInputKeyboardGuards(durationInput);
            durationInput.addEventListener('change', () => {
                const parsed = Number(durationInput.value);
                if (!Number.isFinite(parsed)) {
                    return;
                }
                this.updateCutscene(selected.id, {
                    durationMs: Math.max(0, Math.round(parsed))
                });
            });
            container.appendChild(durationInput);
        });
    }

    private getRuntimeConfig(): TestWorldConfig | null {
        const runtimeConfig = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!runtimeConfig || typeof runtimeConfig !== 'object') {
            return null;
        }
        return runtimeConfig;
    }

    private getCutscenes(): TestWorldCutsceneConfig[] {
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig || !Array.isArray(runtimeConfig.cutscenes)) {
            return [];
        }
        return runtimeConfig.cutscenes;
    }

    private applyCutscenes(cutscenes: TestWorldCutsceneConfig[]): boolean {
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return false;
        }
        const nextConfig: TestWorldConfig = {
            ...runtimeConfig,
            cutscenes
        };
        const result = this.legacyObjectAdapter?.importRuntimeConfig(nextConfig, {
            mode: 'full_import'
        });
        if (!result?.success) {
            return false;
        }
        this.lastSnapshotSignature = this.readSnapshotSignature();
        this.onUiChanged();
        return true;
    }

    private createCutscene(): TestWorldCutsceneConfig | null {
        const cutscenes = this.getCutscenes();
        const nextId = this.generateNextCutsceneId(cutscenes);
        const created: TestWorldCutsceneConfig = {
            id: nextId,
            name: `Cutscene ${cutscenes.length + 1}`,
            type: 'interactive',
            durationMs: 1000,
            actors: [],
            timeline: []
        };
        const next = [...cutscenes, created];
        if (!this.applyCutscenes(next)) {
            return null;
        }
        return created;
    }

    private deleteCutscene(id: string): void {
        const cutscenes = this.getCutscenes();
        const next = cutscenes.filter((entry) => entry.id !== id);
        if (next.length === cutscenes.length) {
            return;
        }
        if (!this.applyCutscenes(next)) {
            return;
        }
        if (this.selectedCutsceneId === id) {
            this.selectedCutsceneId = null;
            this.syncSelectedCutscene(next);
        }
    }

    private updateCutscene(id: string, patch: Partial<Pick<TestWorldCutsceneConfig, 'name' | 'durationMs'>>): void {
        const cutscenes = this.getCutscenes();
        const next = cutscenes.map((entry) => {
            if (entry.id !== id) {
                return entry;
            }
            return {
                ...entry,
                ...patch
            };
        });
        this.applyCutscenes(next);
    }

    private generateNextCutsceneId(cutscenes: readonly TestWorldCutsceneConfig[]): string {
        const ids = new Set(cutscenes.map((entry) => entry.id));
        let index = cutscenes.length + 1;
        while (ids.has(`cutscene_${index}`)) {
            index += 1;
        }
        return `cutscene_${index}`;
    }

    private selectCutscene(cutsceneId: string): void {
        if (this.selectedCutsceneId === cutsceneId) {
            return;
        }
        this.selectedCutsceneId = cutsceneId;
        this.onUiChanged();
    }

    private syncSelectedCutscene(cutscenes: readonly TestWorldCutsceneConfig[]): TestWorldCutsceneConfig | null {
        if (!this.selectedCutsceneId) {
            return null;
        }
        const selected = cutscenes.find((entry) => entry.id === this.selectedCutsceneId) ?? null;
        if (selected) {
            return selected;
        }
        this.selectedCutsceneId = null;
        return null;
    }

    private readSnapshotSignature(): string | null {
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return null;
        }
        try {
            return JSON.stringify(runtimeConfig.cutscenes ?? []);
        } catch {
            return null;
        }
    }

    private makeModeTabs(): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '6px';

        const interactive = document.createElement('button');
        interactive.type = 'button';
        interactive.textContent = 'Interactive';
        interactive.disabled = true;
        row.appendChild(interactive);

        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.textContent = 'Overlay (Deferred)';
        overlay.disabled = true;
        row.appendChild(overlay);

        return row;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const element = document.createElement('div');
        element.textContent = text;
        element.style.minWidth = '0';
        element.style.overflowWrap = 'anywhere';
        element.style.wordBreak = 'break-word';
        return element;
    }

    private makeKeyValueLine(key: string, value: string): HTMLDivElement {
        const element = document.createElement('div');
        element.style.display = 'flex';
        element.style.gap = '6px';
        element.style.flexWrap = 'wrap';
        element.style.minWidth = '0';

        const keyNode = document.createElement('span');
        keyNode.style.fontWeight = 'bold';
        keyNode.style.flexShrink = '0';
        keyNode.textContent = `${key}:`;

        const valueNode = document.createElement('span');
        valueNode.style.flex = '1 1 120px';
        valueNode.style.minWidth = '0';
        valueNode.style.overflowWrap = 'anywhere';
        valueNode.style.wordBreak = 'break-word';
        valueNode.textContent = value;

        element.append(keyNode, valueNode);
        return element;
    }

    private makeSpacer(heightPx: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = `${heightPx}px`;
        return spacer;
    }
}
