import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { EditorPanel } from '../ui/EditorPanel';
import type { TestCutsceneDefinition, TestCutsceneStep } from '../../game/cutscene/cutscene_types';
import { getTestCutsceneDefinitions } from '../../game/cutscene/test_cutscene_registry';

interface CutscenesEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

export class CutscenesEditorMode implements EditorMode {
    public readonly id = 'cutscenes';
    public readonly label = 'Cutscenes';

    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private selectedCutsceneId: string | null = null;
    private lastSnapshotSignature: string | null = null;

    public constructor(options: CutscenesEditorModeOptions) {
        this.logicAuthoringService = new LogicAuthoringService(options.legacyObjectAdapter);
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
        this.syncSelectedCutscene(this.getCutsceneDefinitions());
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const cutscenes = this.getCutsceneDefinitions();
        this.syncSelectedCutscene(cutscenes);

        panel.setCustomContent('Cutscenes', (container) => {
            container.appendChild(this.makeInfoLine(`Count: ${cutscenes.length}`));
            if (cutscenes.length <= 0) {
                container.appendChild(this.makeSpacer(8));
                container.appendChild(this.makeInfoLine('No cutscenes available.'));
                return;
            }

            container.appendChild(this.makeSpacer(8));
            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '6px';

            cutscenes.forEach((cutscene) => {
                const card = document.createElement('div');
                card.style.border = '1px solid #7a7a7a';
                card.style.background = cutscene.id === this.selectedCutsceneId ? '#9ec9ff' : '#e8e8e8';
                card.style.padding = '6px';
                card.style.display = 'grid';
                card.style.gap = '6px';

                const idLine = document.createElement('div');
                idLine.style.fontWeight = 'bold';
                idLine.textContent = cutscene.id;
                card.appendChild(idLine);

                card.appendChild(this.makeInfoLine(`mode: ${cutscene.mode}`));
                card.appendChild(this.makeInfoLine(`steps: ${cutscene.steps.length}`));

                const selectButton = document.createElement('button');
                selectButton.type = 'button';
                selectButton.textContent = 'Select';
                selectButton.style.width = '100%';
                selectButton.style.cursor = 'pointer';
                selectButton.addEventListener('click', () => {
                    this.selectCutscene(cutscene.id);
                });
                card.appendChild(selectButton);

                card.addEventListener('click', () => {
                    this.selectCutscene(cutscene.id);
                });

                list.appendChild(card);
            });

            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const cutscenes = this.getCutsceneDefinitions();
        const selectedCutscene = this.syncSelectedCutscene(cutscenes);

        panel.setCustomContent('Cutscene Inspector', (container) => {
            if (cutscenes.length <= 0) {
                container.appendChild(this.makeInfoLine('No cutscenes available.'));
                return;
            }

            if (!selectedCutscene) {
                container.appendChild(this.makeInfoLine('Select a cutscene to inspect.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Selected Cutscene'));
            container.appendChild(this.makeKeyValueLine('id', selectedCutscene.id));
            container.appendChild(this.makeKeyValueLine('mode', selectedCutscene.mode));
            container.appendChild(this.makeKeyValueLine('step count', String(selectedCutscene.steps.length)));

            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Steps'));
            selectedCutscene.steps.forEach((step, index) => {
                container.appendChild(this.makeInfoLine(this.formatCutsceneStepSummary(step, index)));
            });

            container.appendChild(this.makeSpacer(10));
            container.appendChild(this.makeSectionTitle('Logic Actions'));

            const bindings = this.logicAuthoringService.listBindingsForTarget('cutscene', selectedCutscene.id);
            if (bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings for this cutscene.'));
                return;
            }

            const bindingsList = document.createElement('div');
            bindingsList.style.display = 'grid';
            bindingsList.style.gap = '8px';

            bindings.forEach((binding) => {
                const card = document.createElement('div');
                card.style.border = '1px solid #7a7a7a';
                card.style.background = '#e8e8e8';
                card.style.padding = '6px';
                card.appendChild(this.makeKeyValueLine('id', binding.id));
                card.appendChild(this.makeKeyValueLine('slot', binding.slot));
                card.appendChild(this.makeKeyValueLine('scriptId', binding.scriptId));
                card.appendChild(this.makeKeyValueLine('status', binding.enabled === false ? 'disabled' : 'enabled'));
                card.appendChild(this.makeKeyValueLine('runtime', 'not supported for cutscene slots yet'));
                bindingsList.appendChild(card);
            });

            container.appendChild(bindingsList);
        });
    }

    private selectCutscene(cutsceneId: string): void {
        if (this.selectedCutsceneId === cutsceneId) {
            return;
        }
        this.selectedCutsceneId = cutsceneId;
        this.onUiChanged();
    }

    private getCutsceneDefinitions(): readonly TestCutsceneDefinition[] {
        return getTestCutsceneDefinitions();
    }

    private syncSelectedCutscene(
        cutscenes: readonly TestCutsceneDefinition[]
    ): TestCutsceneDefinition | null {
        if (!this.selectedCutsceneId) {
            return null;
        }
        const selectedCutscene = cutscenes.find((entry) => entry.id === this.selectedCutsceneId) ?? null;
        if (selectedCutscene) {
            return selectedCutscene;
        }
        this.selectedCutsceneId = null;
        return null;
    }

    private readSnapshotSignature(): string | null {
        const cutscenes = this.getCutsceneDefinitions();
        const cutsceneBindings = this.logicAuthoringService.listBindingsForTarget('cutscene');
        try {
            return JSON.stringify({
                cutscenes,
                cutsceneBindings
            });
        } catch {
            return `${cutscenes.length}|${cutsceneBindings.length}`;
        }
    }

    private formatCutsceneStepSummary(step: TestCutsceneStep, index: number): string {
        const refSuffix = typeof step.ref === 'string' && step.ref.trim().length > 0
            ? ` [ref: ${step.ref.trim()}]`
            : '';
        return `${index + 1}. ${step.kind}${refSuffix}`;
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const element = document.createElement('div');
        element.style.fontWeight = 'bold';
        element.style.marginBottom = '6px';
        element.textContent = text;
        return element;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const element = document.createElement('div');
        element.textContent = text;
        return element;
    }

    private makeKeyValueLine(key: string, value: string): HTMLDivElement {
        const element = document.createElement('div');
        element.style.display = 'flex';
        element.style.gap = '6px';

        const keyNode = document.createElement('span');
        keyNode.style.fontWeight = 'bold';
        keyNode.textContent = `${key}:`;

        const valueNode = document.createElement('span');
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
