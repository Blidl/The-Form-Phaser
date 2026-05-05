import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { LogicSnapshot } from '../logic-authoring/LogicAuthoringTypes';
import type { EditorPanel } from '../ui/EditorPanel';
import type {
    TestWorldLogicBindingConfig,
    TestWorldConfig,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptConfig
} from '../../game/world/runtime/test_world_config';
import {
    collectTestWorldLogicDiagnosticsWithRegistry,
    getAllLogicScriptAssets
} from '../../game/world/runtime/logic_script_registry';

interface LogicEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

interface ScriptMetadataDraft {
    name: string;
    category: TestWorldLogicScriptCategory;
    locked: boolean;
}

interface BindingMetadataDraft {
    slot: string;
    enabled: boolean;
}

export class LogicEditorMode implements EditorMode {
    public readonly id = 'logic';
    public readonly label = 'Logic';

    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly onUiChanged: () => void;
    private lastSnapshotSignature: string | null = null;
    private isCreateScriptFormOpen = false;
    private createScriptError: string | null = null;
    private selectedScriptId: string | null = null;
    private selectedScriptDraft: ScriptMetadataDraft | null = null;
    private updateScriptError: string | null = null;
    private addScriptRefError: string | null = null;
    private createBindingRefId: string | null = null;
    private createBindingSlotDraft = 'onStart';
    private createBindingEnabledDraft = true;
    private createBindingError: string | null = null;
    private selectedBindingId: string | null = null;
    private selectedBindingDraft: BindingMetadataDraft | null = null;
    private updateBindingError: string | null = null;

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
        this.legacyObjectAdapter = options.legacyObjectAdapter;
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
        const selectedScript = this.syncSelectedScript(snapshot);

        panel.setCustomContent('Logic', (container) => {
            container.appendChild(this.makeInfoLine('Runtime-backed authoring overview'));
            container.appendChild(this.makeSpacer(8));

            if (!snapshot) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Summary'));
            container.appendChild(this.makeInfoLine(`Scripts: ${snapshot.scripts.length}`));
            container.appendChild(this.makeInfoLine(`Script refs: ${snapshot.scriptRefs.length}`));
            container.appendChild(this.makeInfoLine(`Bindings: ${snapshot.bindings.length}`));
            container.appendChild(this.makeSpacer(8));

            const externalAssets = getAllLogicScriptAssets();
            const levelScriptRefs = snapshot.scriptRefs;
            const referencedScriptRefIds = new Set(levelScriptRefs.map((entry) => entry.id));
            const diagnostics = this.collectRegistryDiagnostics();
            container.appendChild(this.makeSectionTitle('Level Script Refs'));
            if (levelScriptRefs.length <= 0) {
                container.appendChild(this.makeInfoLine('No external script refs added to this level yet.'));
            } else {
                container.appendChild(this.makeInfoLine(`Count: ${levelScriptRefs.length}`));
                levelScriptRefs.forEach((scriptRef) => {
                    const displayName = scriptRef.displayName ?? '-';
                    const path = scriptRef.path ?? '-';
                    const scriptRefBox = document.createElement('div');
                    scriptRefBox.style.border = '1px solid #8b8b8b';
                    scriptRefBox.style.background = '#d9d9d9';
                    scriptRefBox.style.padding = '6px';
                    scriptRefBox.style.marginBottom = '6px';
                    scriptRefBox.style.wordBreak = 'break-word';
                    scriptRefBox.appendChild(this.makeInfoLine(`id: ${scriptRef.id}`));
                    scriptRefBox.appendChild(this.makeInfoLine(`displayName: ${displayName}`));
                    scriptRefBox.appendChild(this.makeInfoLine(`path: ${path}`));

                    const addBindingButton = document.createElement('button');
                    addBindingButton.type = 'button';
                    addBindingButton.textContent = 'Add World Binding';
                    addBindingButton.style.marginTop = '4px';
                    addBindingButton.addEventListener('click', () => {
                        this.createBindingRefId = scriptRef.id;
                        this.createBindingSlotDraft = 'onStart';
                        this.createBindingEnabledDraft = true;
                        this.createBindingError = null;
                        this.onUiChanged();
                    });
                    scriptRefBox.appendChild(addBindingButton);

                    if (this.createBindingRefId === scriptRef.id) {
                        const bindingForm = document.createElement('div');
                        bindingForm.style.border = '1px solid #8b8b8b';
                        bindingForm.style.background = '#ececec';
                        bindingForm.style.padding = '6px';
                        bindingForm.style.marginTop = '6px';

                        const slotLabel = this.makeInfoLine('Slot');
                        slotLabel.style.marginBottom = '2px';
                        bindingForm.appendChild(slotLabel);

                        const slotInput = document.createElement('input');
                        slotInput.type = 'text';
                        slotInput.value = this.createBindingSlotDraft;
                        slotInput.style.display = 'block';
                        slotInput.style.width = '100%';
                        slotInput.style.boxSizing = 'border-box';
                        slotInput.style.marginBottom = '6px';
                        this.bindEditorInputKeyboardGuards(slotInput);
                        slotInput.addEventListener('input', () => {
                            this.createBindingSlotDraft = slotInput.value;
                        });
                        bindingForm.appendChild(slotInput);

                        const enabledRow = document.createElement('label');
                        enabledRow.style.display = 'flex';
                        enabledRow.style.alignItems = 'center';
                        enabledRow.style.gap = '6px';
                        enabledRow.style.marginBottom = '6px';

                        const enabledCheckbox = document.createElement('input');
                        enabledCheckbox.type = 'checkbox';
                        enabledCheckbox.checked = this.createBindingEnabledDraft;
                        this.bindEditorInputKeyboardGuards(enabledCheckbox);
                        enabledCheckbox.addEventListener('change', () => {
                            this.createBindingEnabledDraft = enabledCheckbox.checked;
                        });
                        enabledRow.appendChild(enabledCheckbox);

                        const enabledText = document.createElement('span');
                        enabledText.textContent = 'Enabled';
                        enabledRow.appendChild(enabledText);
                        bindingForm.appendChild(enabledRow);

                        if (this.createBindingError) {
                            const errorLine = this.makeInfoLine(this.createBindingError);
                            errorLine.style.color = '#b00020';
                            errorLine.style.marginBottom = '6px';
                            bindingForm.appendChild(errorLine);
                        }

                        const actionRow = document.createElement('div');
                        actionRow.style.display = 'flex';
                        actionRow.style.gap = '6px';

                        const createBindingButton = document.createElement('button');
                        createBindingButton.type = 'button';
                        createBindingButton.textContent = 'Create Binding';
                        createBindingButton.addEventListener('click', () => {
                            try {
                                const result = this.logicAuthoringService.createBinding({
                                    targetType: 'world',
                                    slot: this.createBindingSlotDraft,
                                    scriptId: scriptRef.id,
                                    enabled: this.createBindingEnabledDraft
                                });
                                if (!result.success) {
                                    this.createBindingError = result.reason ?? 'Failed to create binding.';
                                    this.onUiChanged();
                                    return;
                                }
                                this.createBindingRefId = null;
                                this.createBindingSlotDraft = 'onStart';
                                this.createBindingEnabledDraft = true;
                                this.createBindingError = null;
                                this.onUiChanged();
                            } catch (error) {
                                this.createBindingError = error instanceof Error
                                    ? error.message
                                    : 'Failed to create binding.';
                                this.onUiChanged();
                            }
                        });
                        actionRow.appendChild(createBindingButton);

                        const cancelBindingButton = document.createElement('button');
                        cancelBindingButton.type = 'button';
                        cancelBindingButton.textContent = 'Cancel';
                        cancelBindingButton.addEventListener('click', () => {
                            this.createBindingRefId = null;
                            this.createBindingSlotDraft = 'onStart';
                            this.createBindingEnabledDraft = true;
                            this.createBindingError = null;
                            this.onUiChanged();
                        });
                        actionRow.appendChild(cancelBindingButton);

                        bindingForm.appendChild(actionRow);
                        scriptRefBox.appendChild(bindingForm);
                    }

                    container.appendChild(scriptRefBox);
                });
            }
            container.appendChild(this.makeSpacer(8));

            container.appendChild(this.makeSectionTitle('External Script Assets'));
            container.appendChild(this.makeInfoLine('External scripts are authored in IDE/source files. This editor only references them.'));
            container.appendChild(this.makeInfoLine(`External assets: ${externalAssets.length}`));
            container.appendChild(this.makeSpacer(4));

            if (this.addScriptRefError) {
                const errorLine = this.makeInfoLine(this.addScriptRefError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                container.appendChild(errorLine);
            }

            if (diagnostics.length > 0) {
                const warningBox = document.createElement('div');
                warningBox.style.border = '1px solid #c98a00';
                warningBox.style.background = '#fff4d1';
                warningBox.style.padding = '6px';
                warningBox.style.marginBottom = '6px';
                warningBox.style.wordBreak = 'break-word';
                warningBox.appendChild(this.makeInfoLine(`Diagnostics: ${diagnostics.length}`));
                diagnostics.forEach((diagnostic) => {
                    warningBox.appendChild(this.makeInfoLine(`[${diagnostic.code}] ${diagnostic.message}`));
                });
                container.appendChild(warningBox);
            }

            if (externalAssets.length <= 0) {
                container.appendChild(this.makeInfoLine('No external script assets found.'));
                container.appendChild(this.makeInfoLine('Add scripts in src/game/world/runtime/data/logic_scripts.json and reload.'));
            } else {
                externalAssets.forEach((script) => {
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
                    const isReferenced = referencedScriptRefIds.has(script.id);
                    if (isReferenced) {
                        const referencedLine = this.makeInfoLine('Referenced');
                        referencedLine.style.color = '#146614';
                        scriptBox.appendChild(referencedLine);
                    } else {
                        const addRefButton = document.createElement('button');
                        addRefButton.type = 'button';
                        addRefButton.textContent = 'Add Ref To Level';
                        addRefButton.style.marginTop = '4px';
                        addRefButton.addEventListener('click', () => {
                            try {
                                const result = this.logicAuthoringService.addScriptRef({
                                    id: script.id,
                                    path: 'logic_scripts.json',
                                    displayName: script.name
                                });
                                if (!result.success) {
                                    this.addScriptRefError = result.reason ?? 'Failed to add script ref to level.';
                                    this.onUiChanged();
                                    return;
                                }
                                this.addScriptRefError = null;
                                this.onUiChanged();
                            } catch (error) {
                                this.addScriptRefError = error instanceof Error
                                    ? error.message
                                    : 'Failed to add script ref to level.';
                                this.onUiChanged();
                            }
                        });
                        scriptBox.appendChild(addRefButton);
                    }
                    container.appendChild(scriptBox);
                });
            }

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
                        if (result.script) {
                            this.selectedScriptId = result.script.id;
                            this.loadSelectedScriptDraft(result.script);
                            this.updateScriptError = null;
                        }
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
                    scriptBox.style.background = script.id === this.selectedScriptId ? '#c9dbf1' : '#d9d9d9';
                    scriptBox.style.padding = '6px';
                    scriptBox.style.marginBottom = '6px';
                    scriptBox.style.wordBreak = 'break-word';
                    scriptBox.style.cursor = 'pointer';
                    if (script.id === this.selectedScriptId) {
                        scriptBox.style.border = '1px solid #53759b';
                    }
                    scriptBox.addEventListener('click', () => {
                        if (this.selectedScriptId === script.id) {
                            return;
                        }
                        this.selectedScriptId = script.id;
                        this.loadSelectedScriptDraft(script);
                        this.updateScriptError = null;
                        this.onUiChanged();
                    });
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

            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Script Details'));
            if (!selectedScript || !this.selectedScriptDraft) {
                container.appendChild(this.makeInfoLine('Select a script to edit metadata.'));
                return;
            }

            const detailsBox = document.createElement('div');
            detailsBox.style.border = '1px solid #8b8b8b';
            detailsBox.style.background = '#d9d9d9';
            detailsBox.style.padding = '6px';

            detailsBox.appendChild(this.makeInfoLine(`id: ${selectedScript.id}`));
            detailsBox.appendChild(this.makeInfoLine(`command count: ${selectedScript.commands.length}`));

            const nameLabel = this.makeInfoLine('Name');
            nameLabel.style.marginTop = '6px';
            nameLabel.style.marginBottom = '2px';
            detailsBox.appendChild(nameLabel);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = this.selectedScriptDraft.name;
            nameInput.style.display = 'block';
            nameInput.style.width = '100%';
            nameInput.style.boxSizing = 'border-box';
            nameInput.style.marginBottom = '6px';
            this.bindEditorInputKeyboardGuards(nameInput);
            nameInput.addEventListener('input', () => {
                if (!this.selectedScriptDraft) {
                    return;
                }
                this.selectedScriptDraft.name = nameInput.value;
            });
            detailsBox.appendChild(nameInput);

            const categoryLabel = this.makeInfoLine('Category');
            categoryLabel.style.marginBottom = '2px';
            detailsBox.appendChild(categoryLabel);

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
                option.selected = category === this.selectedScriptDraft?.category;
                categorySelect.appendChild(option);
            });
            categorySelect.addEventListener('change', () => {
                if (!this.selectedScriptDraft) {
                    return;
                }
                const nextCategory = categorySelect.value as TestWorldLogicScriptCategory;
                this.selectedScriptDraft.category = nextCategory;
            });
            detailsBox.appendChild(categorySelect);

            const lockedRow = document.createElement('label');
            lockedRow.style.display = 'flex';
            lockedRow.style.alignItems = 'center';
            lockedRow.style.gap = '6px';
            lockedRow.style.marginBottom = '6px';

            const lockedCheckbox = document.createElement('input');
            lockedCheckbox.type = 'checkbox';
            lockedCheckbox.checked = this.selectedScriptDraft.locked;
            this.bindEditorInputKeyboardGuards(lockedCheckbox);
            lockedCheckbox.addEventListener('change', () => {
                if (!this.selectedScriptDraft) {
                    return;
                }
                this.selectedScriptDraft.locked = lockedCheckbox.checked;
            });
            lockedRow.appendChild(lockedCheckbox);

            const lockedLabelText = document.createElement('span');
            lockedLabelText.textContent = 'Locked';
            lockedRow.appendChild(lockedLabelText);
            detailsBox.appendChild(lockedRow);

            if (this.updateScriptError) {
                const errorLine = this.makeInfoLine(this.updateScriptError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                detailsBox.appendChild(errorLine);
            }

            const actionsRow = document.createElement('div');
            actionsRow.style.display = 'flex';
            actionsRow.style.gap = '6px';

            const applyButton = document.createElement('button');
            applyButton.type = 'button';
            applyButton.textContent = 'Apply';
            applyButton.addEventListener('click', () => {
                if (!this.selectedScriptId || !this.selectedScriptDraft) {
                    return;
                }
                try {
                    const result = this.logicAuthoringService.updateScript(this.selectedScriptId, {
                        name: this.selectedScriptDraft.name,
                        category: this.selectedScriptDraft.category,
                        editor: { locked: this.selectedScriptDraft.locked }
                    });
                    if (!result.success) {
                        this.updateScriptError = result.reason ?? 'Failed to update script.';
                        this.onUiChanged();
                        return;
                    }
                    const nextScript = result.script ?? this.logicAuthoringService.getScript(this.selectedScriptId);
                    if (nextScript) {
                        this.selectedScriptId = nextScript.id;
                        this.loadSelectedScriptDraft(nextScript);
                    }
                    this.updateScriptError = null;
                    this.onUiChanged();
                } catch (error) {
                    this.updateScriptError = error instanceof Error
                        ? error.message
                        : 'Failed to update script.';
                    this.onUiChanged();
                }
            });
            actionsRow.appendChild(applyButton);

            const resetButton = document.createElement('button');
            resetButton.type = 'button';
            resetButton.textContent = 'Revert Changes';
            resetButton.title = 'Reverts unsaved form edits. Does not delete the script.';
            resetButton.addEventListener('click', () => {
                const currentSnapshot = this.logicAuthoringService.getSnapshot();
                if (!currentSnapshot || !this.selectedScriptId) {
                    this.clearSelectedScriptSelection();
                    this.onUiChanged();
                    return;
                }
                const currentScript = currentSnapshot.scripts.find(
                    (entry) => entry.id === this.selectedScriptId
                );
                if (!currentScript) {
                    this.clearSelectedScriptSelection();
                    this.onUiChanged();
                    return;
                }
                this.loadSelectedScriptDraft(currentScript);
                this.updateScriptError = null;
                this.onUiChanged();
            });
            actionsRow.appendChild(resetButton);

            detailsBox.appendChild(actionsRow);
            container.appendChild(detailsBox);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();
        const selectedBinding = this.syncSelectedBinding(snapshot);

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
                const isSelected = binding.id === this.selectedBindingId;
                bindingBox.style.border = isSelected ? '1px solid #4f6f91' : '1px solid #8b8b8b';
                bindingBox.style.background = isSelected ? '#c9dbf1' : '#d9d9d9';
                bindingBox.style.padding = '6px';
                bindingBox.style.marginBottom = '6px';
                bindingBox.style.wordBreak = 'break-word';
                bindingBox.style.cursor = 'pointer';
                bindingBox.addEventListener('click', () => {
                    if (this.selectedBindingId === binding.id) {
                        return;
                    }
                    this.selectedBindingId = binding.id;
                    this.loadSelectedBindingDraft(binding);
                    this.updateBindingError = null;
                    this.onUiChanged();
                });
                bindingBox.appendChild(this.makeInfoLine(`id: ${binding.id}`));
                bindingBox.appendChild(this.makeInfoLine(`targetType: ${binding.targetType}`));
                bindingBox.appendChild(this.makeInfoLine(`targetId: ${binding.targetId ?? '-'}`));
                bindingBox.appendChild(this.makeInfoLine(`slot: ${binding.slot}`));
                bindingBox.appendChild(this.makeInfoLine(`scriptId: ${binding.scriptId}`));
                bindingBox.appendChild(this.makeInfoLine(`status: ${binding.enabled ? 'enabled' : 'disabled'}`));
                container.appendChild(bindingBox);
            });

            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Selected Binding'));
            if (!selectedBinding || !this.selectedBindingDraft) {
                container.appendChild(this.makeInfoLine('Select a binding to edit.'));
                return;
            }

            const detailsBox = document.createElement('div');
            detailsBox.style.border = '1px solid #8b8b8b';
            detailsBox.style.background = '#ececec';
            detailsBox.style.padding = '6px';

            detailsBox.appendChild(this.makeInfoLine(`id: ${selectedBinding.id}`));
            detailsBox.appendChild(this.makeInfoLine(`targetType: ${selectedBinding.targetType}`));
            detailsBox.appendChild(this.makeInfoLine(`targetId: ${selectedBinding.targetId ?? '-'}`));
            detailsBox.appendChild(this.makeInfoLine(`scriptId: ${selectedBinding.scriptId}`));
            detailsBox.appendChild(this.makeSpacer(6));

            const slotLabel = this.makeInfoLine('Slot');
            slotLabel.style.marginBottom = '2px';
            detailsBox.appendChild(slotLabel);

            const slotInput = document.createElement('input');
            slotInput.type = 'text';
            slotInput.value = this.selectedBindingDraft.slot;
            slotInput.style.display = 'block';
            slotInput.style.width = '100%';
            slotInput.style.boxSizing = 'border-box';
            slotInput.style.marginBottom = '6px';
            this.bindEditorInputKeyboardGuards(slotInput);
            slotInput.addEventListener('input', () => {
                if (!this.selectedBindingDraft) {
                    return;
                }
                this.selectedBindingDraft.slot = slotInput.value;
            });
            detailsBox.appendChild(slotInput);

            const enabledRow = document.createElement('label');
            enabledRow.style.display = 'flex';
            enabledRow.style.alignItems = 'center';
            enabledRow.style.gap = '6px';
            enabledRow.style.marginBottom = '6px';

            const enabledCheckbox = document.createElement('input');
            enabledCheckbox.type = 'checkbox';
            enabledCheckbox.checked = this.selectedBindingDraft.enabled;
            this.bindEditorInputKeyboardGuards(enabledCheckbox);
            enabledCheckbox.addEventListener('change', () => {
                if (!this.selectedBindingDraft) {
                    return;
                }
                this.selectedBindingDraft.enabled = enabledCheckbox.checked;
            });
            enabledRow.appendChild(enabledCheckbox);

            const enabledText = document.createElement('span');
            enabledText.textContent = 'Enabled';
            enabledRow.appendChild(enabledText);
            detailsBox.appendChild(enabledRow);

            if (this.updateBindingError) {
                const errorLine = this.makeInfoLine(this.updateBindingError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                detailsBox.appendChild(errorLine);
            }

            const actionsRow = document.createElement('div');
            actionsRow.style.display = 'flex';
            actionsRow.style.gap = '6px';

            const applyButton = document.createElement('button');
            applyButton.type = 'button';
            applyButton.textContent = 'Apply';
            applyButton.addEventListener('click', () => {
                if (!this.selectedBindingId || !this.selectedBindingDraft) {
                    return;
                }
                try {
                    const result = this.logicAuthoringService.updateBinding(this.selectedBindingId, {
                        slot: this.selectedBindingDraft.slot,
                        enabled: this.selectedBindingDraft.enabled
                    });
                    if (!result.success) {
                        this.updateBindingError = result.reason ?? 'Failed to update binding.';
                        this.onUiChanged();
                        return;
                    }
                    const nextBinding = result.binding ?? this.logicAuthoringService.getBinding(this.selectedBindingId);
                    if (nextBinding) {
                        this.selectedBindingId = nextBinding.id;
                        this.loadSelectedBindingDraft(nextBinding);
                    }
                    this.updateBindingError = null;
                    this.onUiChanged();
                } catch (error) {
                    this.updateBindingError = error instanceof Error
                        ? error.message
                        : 'Failed to update binding.';
                    this.onUiChanged();
                }
            });
            actionsRow.appendChild(applyButton);

            const revertButton = document.createElement('button');
            revertButton.type = 'button';
            revertButton.textContent = 'Revert Changes';
            revertButton.addEventListener('click', () => {
                const currentSnapshot = this.logicAuthoringService.getSnapshot();
                if (!currentSnapshot || !this.selectedBindingId) {
                    this.clearSelectedBindingSelection();
                    this.onUiChanged();
                    return;
                }
                const currentBinding = currentSnapshot.bindings.find(
                    (entry) => entry.id === this.selectedBindingId
                );
                if (!currentBinding) {
                    this.clearSelectedBindingSelection();
                    this.onUiChanged();
                    return;
                }
                this.loadSelectedBindingDraft(currentBinding);
                this.updateBindingError = null;
                this.onUiChanged();
            });
            actionsRow.appendChild(revertButton);

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                if (!this.selectedBindingId) {
                    return;
                }
                const shouldDelete = confirm('Delete selected logic binding?');
                if (!shouldDelete) {
                    return;
                }
                try {
                    const result = this.logicAuthoringService.deleteBinding(this.selectedBindingId);
                    if (!result.success) {
                        this.updateBindingError = result.reason ?? 'Failed to delete binding.';
                        this.onUiChanged();
                        return;
                    }
                    this.clearSelectedBindingSelection();
                    this.onUiChanged();
                } catch (error) {
                    this.updateBindingError = error instanceof Error
                        ? error.message
                        : 'Failed to delete binding.';
                    this.onUiChanged();
                }
            });
            actionsRow.appendChild(deleteButton);

            detailsBox.appendChild(actionsRow);
            container.appendChild(detailsBox);
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
            const runtimeConfig = this.getCurrentRuntimeConfig();
            return JSON.stringify({
                scripts: snapshot.scripts,
                bindings: snapshot.bindings,
                scriptRefs: runtimeConfig?.logic?.scriptRefs ?? []
            });
        } catch {
            return `${snapshot.scripts.length}|${snapshot.bindings.length}`;
        }
    }

    private collectRegistryDiagnostics(): { code: string; message: string }[] {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig) {
            return [];
        }
        return collectTestWorldLogicDiagnosticsWithRegistry(runtimeConfig).map((entry) => ({
            code: entry.code,
            message: entry.message
        }));
    }

    private getCurrentRuntimeConfig(): TestWorldConfig | null {
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds) {
            return null;
        }
        return config;
    }

    private syncSelectedScript(snapshot: LogicSnapshot | null): TestWorldLogicScriptConfig | null {
        if (!snapshot) {
            this.clearSelectedScriptSelection();
            return null;
        }
        if (!this.selectedScriptId) {
            return null;
        }
        const selectedScript = snapshot.scripts.find((entry) => entry.id === this.selectedScriptId);
        if (!selectedScript) {
            this.clearSelectedScriptSelection();
            return null;
        }
        if (!this.selectedScriptDraft) {
            this.loadSelectedScriptDraft(selectedScript);
        }
        return selectedScript;
    }

    private syncSelectedBinding(snapshot: LogicSnapshot | null): TestWorldLogicBindingConfig | null {
        if (!snapshot) {
            this.clearSelectedBindingSelection();
            return null;
        }
        if (!this.selectedBindingId) {
            return null;
        }
        const selectedBinding = snapshot.bindings.find((entry) => entry.id === this.selectedBindingId);
        if (!selectedBinding) {
            this.clearSelectedBindingSelection();
            return null;
        }
        if (!this.selectedBindingDraft) {
            this.loadSelectedBindingDraft(selectedBinding);
        }
        return selectedBinding;
    }

    private loadSelectedScriptDraft(script: TestWorldLogicScriptConfig): void {
        this.selectedScriptDraft = {
            name: script.name,
            category: script.category,
            locked: Boolean(script.editor?.locked)
        };
    }

    private loadSelectedBindingDraft(binding: TestWorldLogicBindingConfig): void {
        this.selectedBindingDraft = {
            slot: binding.slot,
            enabled: Boolean(binding.enabled)
        };
    }

    private clearSelectedScriptSelection(): void {
        this.selectedScriptId = null;
        this.selectedScriptDraft = null;
        this.updateScriptError = null;
    }

    private clearSelectedBindingSelection(): void {
        this.selectedBindingId = null;
        this.selectedBindingDraft = null;
        this.updateBindingError = null;
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
