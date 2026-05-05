import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { LogicSnapshot } from '../logic-authoring/LogicAuthoringTypes';
import type { EditorPanel } from '../ui/EditorPanel';
import type { TestWorldLogicScriptCategory } from '../../game/world/runtime/test_world_config';

interface LogicEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

export class LogicEditorMode implements EditorMode {
    public readonly id = 'logic';
    public readonly label = 'Logic';

    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private lastSnapshotSignature: string | null = null;
    private isCreateScriptFormOpen = false;
    private createScriptError: string | null = null;

    private readonly scriptCategoryOptions: TestWorldLogicScriptCategory[] = [
        'object.move',
        'object.rotate',
        'object.action',
        'npc.patrol',
        'npc.action',
        'npc.altAction',
        'cutscene.npc',
        'cutscene.camera',
        'cutscene.player',
        'cutscene.other',
        'trigger.action',
        'world.rule'
    ];

    public constructor(options: LogicEditorModeOptions) {
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
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();

        panel.setCustomContent('Logic', (container) => {
            container.appendChild(this.makeInfoLine('Runtime-backed authoring overview'));
            container.appendChild(this.makeSpacer(8));

            if (!snapshot) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Summary'));
            container.appendChild(this.makeInfoLine(`Scripts: ${snapshot.scripts.length}`));
            container.appendChild(this.makeInfoLine(`Bindings: ${snapshot.bindings.length}`));
            container.appendChild(this.makeSpacer(8));

            container.appendChild(this.makeSectionTitle('Scripts'));
            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.textContent = '+ New Script';
            createButton.style.display = 'inline-block';
            createButton.style.border = '1px solid #5f5f5f';
            createButton.style.background = '#d9d9d9';
            createButton.style.color = '#202020';
            createButton.style.padding = '4px 6px';
            createButton.style.cursor = 'pointer';
            createButton.style.marginBottom = '6px';
            createButton.addEventListener('click', () => {
                this.isCreateScriptFormOpen = true;
                this.createScriptError = null;
                this.onUiChanged();
            });
            container.appendChild(createButton);

            if (this.createScriptError) {
                const errorLine = this.makeInfoLine(this.createScriptError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                container.appendChild(errorLine);
            }

            if (this.isCreateScriptFormOpen) {
                const formBox = document.createElement('div');
                formBox.style.border = '1px solid #8b8b8b';
                formBox.style.background = '#d9d9d9';
                formBox.style.padding = '6px';
                formBox.style.marginBottom = '6px';

                const nameLabel = this.makeInfoLine('Name');
                nameLabel.style.marginBottom = '2px';
                formBox.appendChild(nameLabel);

                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.value = 'New Logic Script';
                nameInput.style.display = 'block';
                nameInput.style.width = '100%';
                nameInput.style.boxSizing = 'border-box';
                nameInput.style.marginBottom = '6px';
                this.bindEditorInputKeyboardGuards(nameInput);
                formBox.appendChild(nameInput);

                const categoryLabel = this.makeInfoLine('Category');
                categoryLabel.style.marginBottom = '2px';
                formBox.appendChild(categoryLabel);

                const categorySelect = document.createElement('select');
                categorySelect.style.display = 'block';
                categorySelect.style.width = '100%';
                categorySelect.style.boxSizing = 'border-box';
                categorySelect.style.marginBottom = '6px';
                this.bindEditorInputKeyboardGuards(categorySelect);
                this.scriptCategoryOptions.forEach((category) => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    if (category === 'world.rule') {
                        option.selected = true;
                    }
                    categorySelect.appendChild(option);
                });
                formBox.appendChild(categorySelect);

                const actionsRow = document.createElement('div');
                actionsRow.style.display = 'flex';
                actionsRow.style.gap = '6px';

                const createFormButton = document.createElement('button');
                createFormButton.type = 'button';
                createFormButton.textContent = 'Create';
                createFormButton.addEventListener('click', () => {
                    try {
                        const result = this.logicAuthoringService.createScript({
                            name: nameInput.value,
                            category: categorySelect.value,
                            commands: [],
                            editor: { rawLines: [] }
                        });
                        if (!result.success) {
                            this.createScriptError = result.reason ?? 'Failed to create script.';
                            this.onUiChanged();
                            return;
                        }
                        this.isCreateScriptFormOpen = false;
                        this.createScriptError = null;
                        this.onUiChanged();
                    } catch (error) {
                        this.createScriptError = error instanceof Error
                            ? error.message
                            : 'Failed to create script.';
                        this.onUiChanged();
                    }
                });
                actionsRow.appendChild(createFormButton);

                const cancelFormButton = document.createElement('button');
                cancelFormButton.type = 'button';
                cancelFormButton.textContent = 'Cancel';
                cancelFormButton.addEventListener('click', () => {
                    this.isCreateScriptFormOpen = false;
                    this.createScriptError = null;
                    this.onUiChanged();
                });
                actionsRow.appendChild(cancelFormButton);

                formBox.appendChild(actionsRow);
                container.appendChild(formBox);
            }

            if (snapshot.scripts.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic scripts yet.'));
            } else {
                snapshot.scripts.forEach((script) => {
                    const scriptBox = document.createElement('div');
                    scriptBox.style.border = '1px solid #8b8b8b';
                    scriptBox.style.background = '#d9d9d9';
                    scriptBox.style.padding = '6px';
                    scriptBox.style.marginBottom = '6px';
                    scriptBox.style.wordBreak = 'break-word';
                    const lockedMarker = script.editor?.locked ? ' [locked]' : '';
                    scriptBox.appendChild(this.makeInfoLine(`name: ${script.name}${lockedMarker}`));
                    scriptBox.appendChild(this.makeInfoLine(`id: ${script.id}`));
                    scriptBox.appendChild(this.makeInfoLine(`category: ${script.category}`));
                    scriptBox.appendChild(this.makeInfoLine(`command count: ${script.commands.length}`));
                    if (script.editor?.locked) {
                        scriptBox.appendChild(this.makeInfoLine('locked: true'));
                    }
                    container.appendChild(scriptBox);
                });
            }
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();

        panel.setCustomContent('Logic Bindings', (container) => {
            if (!snapshot) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Bindings'));
            if (snapshot.bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings yet.'));
                return;
            }

            snapshot.bindings.forEach((binding) => {
                const bindingBox = document.createElement('div');
                bindingBox.style.border = '1px solid #8b8b8b';
                bindingBox.style.background = '#d9d9d9';
                bindingBox.style.padding = '6px';
                bindingBox.style.marginBottom = '6px';
                bindingBox.style.wordBreak = 'break-word';
                bindingBox.appendChild(this.makeInfoLine(`id: ${binding.id}`));
                bindingBox.appendChild(this.makeInfoLine(`targetType: ${binding.targetType}`));
                bindingBox.appendChild(this.makeInfoLine(`targetId: ${binding.targetId ?? '-'}`));
                bindingBox.appendChild(this.makeInfoLine(`slot: ${binding.slot}`));
                bindingBox.appendChild(this.makeInfoLine(`scriptId: ${binding.scriptId}`));
                bindingBox.appendChild(this.makeInfoLine(`status: ${binding.enabled ? 'enabled' : 'disabled'}`));
                container.appendChild(bindingBox);
            });
        });
    }

    private readSnapshotSignature(): string | null {
        const snapshot = this.logicAuthoringService.getSnapshot();
        return this.buildSnapshotSignature(snapshot);
    }

    private buildSnapshotSignature(snapshot: LogicSnapshot | null): string | null {
        if (!snapshot) {
            return null;
        }
        try {
            return JSON.stringify({
                scripts: snapshot.scripts,
                bindings: snapshot.bindings
            });
        } catch {
            return `${snapshot.scripts.length}|${snapshot.bindings.length}`;
        }
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const title = document.createElement('div');
        title.textContent = text;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        return title;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const line = document.createElement('div');
        line.textContent = text;
        return line;
    }

    private makeSpacer(heightPx: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = `${heightPx}px`;
        return spacer;
    }

    private bindEditorInputKeyboardGuards(input: HTMLElement): void {
        const stopKeyboardEvent = (event: Event): void => {
            event.stopPropagation();
        };
        input.addEventListener('keydown', stopKeyboardEvent);
        input.addEventListener('keyup', stopKeyboardEvent);
        input.addEventListener('keypress', stopKeyboardEvent);
    }
}
