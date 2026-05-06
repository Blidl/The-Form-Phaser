import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { EditorPanel } from '../ui/EditorPanel';
import type { TestCutsceneDefinition, TestCutsceneStep } from '../../game/cutscene/cutscene_types';
import type { TestWorldLogicBindingConfig } from '../../game/world/runtime/test_world_config';
import type { LogicBindingEventTrace } from '../../game/world/runtime/logic_script_runtime';
import { getTestCutsceneDefinitions } from '../../game/cutscene/test_cutscene_registry';
import { bindEditorInputKeyboardGuards } from './logic/LogicEditorDom';

interface CutscenesEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

interface RuntimeCutsceneLogicTrace {
    attemptId: number;
    cutsceneId: string;
    slot: string;
    status: string;
    bindingTrace: LogicBindingEventTrace;
    message: string;
}

export class CutscenesEditorMode implements EditorMode {
    public readonly id = 'cutscenes';
    public readonly label = 'Cutscenes';

    private static readonly CUTSCENE_BINDING_SLOT = 'onFinish';

    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private selectedCutsceneId: string | null = null;
    private lastSnapshotSignature: string | null = null;
    private isCreateBindingFormOpen = false;
    private createBindingScriptRefId: string | null = null;
    private createBindingEnabledDraft = true;
    private createBindingError: string | null = null;
    private readonly bindingEnabledDraftById = new Map<string, boolean>();
    private readonly bindingErrorById = new Map<string, string>();

    public constructor(options: CutscenesEditorModeOptions) {
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
            const scriptRefs = this.logicAuthoringService.listScriptRefs();
            const hasOnFinishBinding = bindings.some((binding) => binding.slot === CutscenesEditorMode.CUTSCENE_BINDING_SLOT);

            if (bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings for this cutscene.'));
            } else {
                const bindingsList = document.createElement('div');
                bindingsList.style.display = 'grid';
                bindingsList.style.gap = '8px';

                bindings.forEach((binding) => {
                    const card = document.createElement('div');
                    card.style.border = '1px solid #7a7a7a';
                    card.style.background = '#e8e8e8';
                    card.style.padding = '6px';
                    card.style.display = 'grid';
                    card.style.gap = '6px';
                    card.appendChild(this.makeKeyValueLine('id', binding.id));
                    card.appendChild(this.makeKeyValueLine('slot', binding.slot));
                    card.appendChild(this.makeKeyValueLine('scriptId', binding.scriptId));
                    card.appendChild(this.makeKeyValueLine('status', binding.enabled === false ? 'disabled' : 'enabled'));
                    card.appendChild(this.makeKeyValueLine(
                        'runtime',
                        this.getCutsceneBindingRuntimeSupportText(binding)
                    ));

                    const enabledDraft = this.getBindingEnabledDraft(binding);
                    const enabledRow = document.createElement('label');
                    enabledRow.style.display = 'flex';
                    enabledRow.style.alignItems = 'center';
                    enabledRow.style.gap = '6px';

                    const enabledCheckbox = document.createElement('input');
                    enabledCheckbox.type = 'checkbox';
                    enabledCheckbox.checked = enabledDraft;
                    bindEditorInputKeyboardGuards(enabledCheckbox);
                    enabledCheckbox.addEventListener('change', () => {
                        this.bindingEnabledDraftById.set(binding.id, enabledCheckbox.checked);
                        this.bindingErrorById.delete(binding.id);
                        this.onUiChanged();
                    });
                    enabledRow.appendChild(enabledCheckbox);

                    const enabledText = document.createElement('span');
                    enabledText.textContent = 'Enabled';
                    enabledRow.appendChild(enabledText);
                    card.appendChild(enabledRow);

                    const actionsRow = document.createElement('div');
                    actionsRow.style.display = 'flex';
                    actionsRow.style.gap = '6px';
                    actionsRow.style.flexWrap = 'wrap';

                    const applyButton = document.createElement('button');
                    applyButton.type = 'button';
                    applyButton.textContent = 'Apply';
                    applyButton.disabled = enabledDraft === this.isBindingEnabled(binding);
                    bindEditorInputKeyboardGuards(applyButton);
                    applyButton.addEventListener('click', () => {
                        try {
                            const result = this.logicAuthoringService.updateBinding(binding.id, {
                                enabled: this.getBindingEnabledDraft(binding)
                            });
                            if (!result.success) {
                                this.bindingErrorById.set(binding.id, result.reason ?? 'Failed to update binding.');
                                this.onUiChanged();
                                return;
                            }
                            this.bindingEnabledDraftById.delete(binding.id);
                            this.bindingErrorById.delete(binding.id);
                            this.onUiChanged();
                        } catch (error) {
                            this.bindingErrorById.set(
                                binding.id,
                                error instanceof Error ? error.message : 'Failed to update binding.'
                            );
                            this.onUiChanged();
                        }
                    });
                    actionsRow.appendChild(applyButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.textContent = 'Delete';
                    bindEditorInputKeyboardGuards(deleteButton);
                    deleteButton.addEventListener('click', () => {
                        try {
                            const result = this.logicAuthoringService.deleteBinding(binding.id);
                            if (!result.success) {
                                this.bindingErrorById.set(binding.id, result.reason ?? 'Failed to delete binding.');
                                this.onUiChanged();
                                return;
                            }
                            this.bindingEnabledDraftById.delete(binding.id);
                            this.bindingErrorById.delete(binding.id);
                            this.onUiChanged();
                        } catch (error) {
                            this.bindingErrorById.set(
                                binding.id,
                                error instanceof Error ? error.message : 'Failed to delete binding.'
                            );
                            this.onUiChanged();
                        }
                    });
                    actionsRow.appendChild(deleteButton);
                    card.appendChild(actionsRow);

                    const bindingError = this.bindingErrorById.get(binding.id);
                    if (bindingError) {
                        const errorLine = this.makeInfoLine(bindingError);
                        errorLine.style.color = '#b00020';
                        card.appendChild(errorLine);
                    }

                    bindingsList.appendChild(card);
                });

                container.appendChild(bindingsList);
            }

            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Cutscene Logic Trace'));
            container.appendChild(this.makeCutsceneLogicTraceView(selectedCutscene.id));

            container.appendChild(this.makeSpacer(8));
            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.textContent = 'Add Cutscene Binding';
            addButton.disabled = this.isCreateBindingFormOpen
                || hasOnFinishBinding;
            bindEditorInputKeyboardGuards(addButton);
            addButton.addEventListener('click', () => {
                this.isCreateBindingFormOpen = true;
                this.createBindingScriptRefId = scriptRefs[0]?.id ?? null;
                this.createBindingEnabledDraft = true;
                this.createBindingError = null;
                this.onUiChanged();
            });
            container.appendChild(addButton);

            if (hasOnFinishBinding) {
                container.appendChild(
                    this.makeInfoLine('This cutscene already has an onFinish binding.')
                );
            }
            if (scriptRefs.length <= 0) {
                container.appendChild(this.makeInfoLine('Add a script ref in Logic tab first.'));
            }

            if (this.isCreateBindingFormOpen) {
                if (!this.createBindingScriptRefId || !scriptRefs.some((entry) => entry.id === this.createBindingScriptRefId)) {
                    this.createBindingScriptRefId = scriptRefs[0]?.id ?? null;
                }

                const form = document.createElement('div');
                form.style.border = '1px solid #7a7a7a';
                form.style.background = '#efefef';
                form.style.padding = '6px';
                form.style.marginTop = '6px';
                form.style.display = 'grid';
                form.style.gap = '6px';

                form.appendChild(this.makeKeyValueLine('slot', CutscenesEditorMode.CUTSCENE_BINDING_SLOT));

                const scriptLabel = this.makeInfoLine('Script ref');
                form.appendChild(scriptLabel);

                const scriptSelect = document.createElement('select');
                scriptSelect.style.width = '100%';
                scriptSelect.disabled = scriptRefs.length <= 0;
                bindEditorInputKeyboardGuards(scriptSelect);
                scriptRefs.forEach((scriptRef) => {
                    const option = document.createElement('option');
                    option.value = scriptRef.id;
                    option.textContent = scriptRef.displayName && scriptRef.displayName.trim().length > 0
                        ? `${scriptRef.displayName} (${scriptRef.id})`
                        : scriptRef.id;
                    scriptSelect.appendChild(option);
                });
                if (this.createBindingScriptRefId) {
                    scriptSelect.value = this.createBindingScriptRefId;
                }
                scriptSelect.addEventListener('change', () => {
                    this.createBindingScriptRefId = scriptSelect.value.trim() || null;
                });
                form.appendChild(scriptSelect);

                const enabledRow = document.createElement('label');
                enabledRow.style.display = 'flex';
                enabledRow.style.alignItems = 'center';
                enabledRow.style.gap = '6px';

                const enabledCheckbox = document.createElement('input');
                enabledCheckbox.type = 'checkbox';
                enabledCheckbox.checked = this.createBindingEnabledDraft;
                bindEditorInputKeyboardGuards(enabledCheckbox);
                enabledCheckbox.addEventListener('change', () => {
                    this.createBindingEnabledDraft = enabledCheckbox.checked;
                });
                enabledRow.appendChild(enabledCheckbox);

                const enabledText = document.createElement('span');
                enabledText.textContent = 'Enabled';
                enabledRow.appendChild(enabledText);
                form.appendChild(enabledRow);

                if (scriptRefs.length <= 0) {
                    form.appendChild(this.makeInfoLine('Add a script ref in Logic tab first.'));
                }
                if (hasOnFinishBinding) {
                    form.appendChild(this.makeInfoLine('This cutscene already has an onFinish binding.'));
                }

                if (this.createBindingError) {
                    const errorLine = this.makeInfoLine(this.createBindingError);
                    errorLine.style.color = '#b00020';
                    form.appendChild(errorLine);
                }

                const actionsRow = document.createElement('div');
                actionsRow.style.display = 'flex';
                actionsRow.style.gap = '6px';
                actionsRow.style.flexWrap = 'wrap';

                const createButton = document.createElement('button');
                createButton.type = 'button';
                createButton.textContent = 'Create';
                createButton.disabled = scriptRefs.length <= 0
                    || hasOnFinishBinding
                    || !this.createBindingScriptRefId;
                bindEditorInputKeyboardGuards(createButton);
                createButton.addEventListener('click', () => {
                    try {
                        if (!this.createBindingScriptRefId) {
                            this.createBindingError = 'Select a script ref.';
                            this.onUiChanged();
                            return;
                        }
                        const result = this.logicAuthoringService.createBinding({
                            targetType: 'cutscene',
                            targetId: selectedCutscene.id,
                            slot: CutscenesEditorMode.CUTSCENE_BINDING_SLOT,
                            scriptId: this.createBindingScriptRefId,
                            enabled: this.createBindingEnabledDraft
                        });
                        if (!result.success) {
                            this.createBindingError = result.reason ?? 'Failed to create binding.';
                            this.onUiChanged();
                            return;
                        }
                        this.resetCreateBindingForm();
                        this.onUiChanged();
                    } catch (error) {
                        this.createBindingError = error instanceof Error
                            ? error.message
                            : 'Failed to create binding.';
                        this.onUiChanged();
                    }
                });
                actionsRow.appendChild(createButton);

                const cancelButton = document.createElement('button');
                cancelButton.type = 'button';
                cancelButton.textContent = 'Cancel';
                bindEditorInputKeyboardGuards(cancelButton);
                cancelButton.addEventListener('click', () => {
                    this.resetCreateBindingForm();
                    this.onUiChanged();
                });
                actionsRow.appendChild(cancelButton);
                form.appendChild(actionsRow);

                container.appendChild(form);
            }
        });
    }

    private selectCutscene(cutsceneId: string): void {
        if (this.selectedCutsceneId === cutsceneId) {
            return;
        }
        this.selectedCutsceneId = cutsceneId;
        this.resetCreateBindingForm();
        this.clearBindingCardState();
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
        this.resetCreateBindingForm();
        this.clearBindingCardState();
        return null;
    }

    private readSnapshotSignature(): string | null {
        const cutscenes = this.getCutsceneDefinitions();
        const cutsceneBindings = this.logicAuthoringService.listBindingsForTarget('cutscene');
        const runtimeCutsceneLogicTrace = this.getRuntimeCutsceneLogicTrace();
        try {
            return JSON.stringify({
                cutscenes,
                cutsceneBindings,
                runtimeCutsceneLogicTrace
            });
        } catch {
            return `${cutscenes.length}|${cutsceneBindings.length}|${runtimeCutsceneLogicTrace ? 1 : 0}`;
        }
    }

    private formatCutsceneStepSummary(step: TestCutsceneStep, index: number): string {
        const refSuffix = typeof step.ref === 'string' && step.ref.trim().length > 0
            ? ` [ref: ${step.ref.trim()}]`
            : '';
        return `${index + 1}. ${step.kind}${refSuffix}`;
    }

    private isBindingEnabled(binding: TestWorldLogicBindingConfig): boolean {
        return binding.enabled !== false;
    }

    private getBindingEnabledDraft(binding: TestWorldLogicBindingConfig): boolean {
        return this.bindingEnabledDraftById.get(binding.id) ?? this.isBindingEnabled(binding);
    }

    private getCutsceneBindingRuntimeSupportText(binding: TestWorldLogicBindingConfig): string {
        const slot = binding.slot.trim();
        if (slot === CutscenesEditorMode.CUTSCENE_BINDING_SLOT) {
            return 'supported on cutscene finish';
        }
        return 'not supported for this cutscene slot yet';
    }

    private getRuntimeCutsceneLogicTrace(): RuntimeCutsceneLogicTrace | null {
        const trace = this.legacyObjectAdapter?.getLastCutsceneLogicTrace() as RuntimeCutsceneLogicTrace | null;
        if (!trace || typeof trace !== 'object') {
            return null;
        }
        if (typeof trace.cutsceneId !== 'string' || typeof trace.slot !== 'string' || typeof trace.status !== 'string') {
            return null;
        }
        if (!trace.bindingTrace || typeof trace.bindingTrace !== 'object' || !Array.isArray(trace.bindingTrace.bindings)) {
            return null;
        }
        return trace;
    }

    private makeCutsceneLogicTraceView(selectedCutsceneId: string): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.border = '1px solid #8b8b8b';
        wrap.style.background = '#ececec';
        wrap.style.padding = '6px';
        wrap.style.display = 'grid';
        wrap.style.gap = '4px';

        const trace = this.getRuntimeCutsceneLogicTrace();
        if (!trace) {
            wrap.appendChild(this.makeInfoLine('No cutscene Logic trace recorded.'));
            return wrap;
        }
        if (trace.cutsceneId !== selectedCutsceneId) {
            wrap.appendChild(this.makeInfoLine('No trace recorded for selected cutscene.'));
            return wrap;
        }

        wrap.appendChild(this.makeKeyValueLine('cutscene id', trace.cutsceneId));
        wrap.appendChild(this.makeKeyValueLine('slot', trace.slot));
        wrap.appendChild(this.makeKeyValueLine('status', trace.status));
        wrap.appendChild(this.makeKeyValueLine('message', trace.message || '-'));
        if (Number.isFinite(trace.attemptId)) {
            wrap.appendChild(this.makeKeyValueLine('attempt', String(trace.attemptId)));
        }

        if (!Array.isArray(trace.bindingTrace.bindings) || trace.bindingTrace.bindings.length <= 0) {
            wrap.appendChild(this.makeInfoLine('Binding results: none'));
            return wrap;
        }

        wrap.appendChild(this.makeInfoLine('Binding results:'));
        trace.bindingTrace.bindings.forEach((binding) => {
            wrap.appendChild(this.makeInfoLine(`- binding id: ${binding.bindingId}`));
            wrap.appendChild(this.makeInfoLine(`  scriptId: ${binding.scriptId}`));
            wrap.appendChild(this.makeInfoLine(`  status: ${binding.status}`));
            if (typeof binding.reason === 'string' && binding.reason.trim().length > 0) {
                wrap.appendChild(this.makeInfoLine(`  reason: ${binding.reason}`));
            }
            if (!Array.isArray(binding.commands) || binding.commands.length <= 0) {
                wrap.appendChild(this.makeInfoLine('  Command results: none'));
                return;
            }
            binding.commands.forEach((command) => {
                wrap.appendChild(this.makeInfoLine(`  command id: ${command.commandId}`));
                wrap.appendChild(this.makeInfoLine(`  type: ${command.type}`));
                wrap.appendChild(this.makeInfoLine(`  status: ${command.status}`));
                wrap.appendChild(this.makeInfoLine(`  message: ${command.message}`));
            });
        });

        return wrap;
    }

    private resetCreateBindingForm(): void {
        this.isCreateBindingFormOpen = false;
        this.createBindingScriptRefId = null;
        this.createBindingEnabledDraft = true;
        this.createBindingError = null;
    }

    private clearBindingCardState(): void {
        this.bindingEnabledDraftById.clear();
        this.bindingErrorById.clear();
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
