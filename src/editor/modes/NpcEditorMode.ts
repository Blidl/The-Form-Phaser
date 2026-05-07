import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { EditorPanel } from '../ui/EditorPanel';
import type {
    TestWorldConfig,
    TestWorldLogicBindingConfig,
    TestWorldLogicScriptRefConfig
} from '../../game/world/runtime/test_world_config';
import type { TestNpcInstanceConfig } from '../../game/npc/npc_types';
import type { NpcInteractionTrace } from '../../game/world/runtime/test_world_runtime';

interface NpcEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

const NPC_LOGIC_BINDING_DEFAULT_SLOT = 'onInteract';

export class NpcEditorMode implements EditorMode {
    public readonly id = 'npc';
    public readonly label = 'NPC';

    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private selectedNpcId: string | null = null;
    private lastSnapshotSignature: string | null = null;
    private npcLogicBindingCreateFormNpcId: string | null = null;
    private npcLogicBindingCreateSlotDraft = NPC_LOGIC_BINDING_DEFAULT_SLOT;
    private npcLogicBindingCreateScriptRefId: string | null = null;
    private npcLogicBindingCreateEnabledDraft = true;
    private npcLogicBindingCreateError: string | null = null;
    private readonly npcLogicBindingEnabledDraftById = new Map<string, boolean>();
    private readonly npcLogicBindingErrorById = new Map<string, string>();

    public constructor(options: NpcEditorModeOptions) {
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
        this.syncSelectedNpc(this.getCurrentNpcs());
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const npcs = runtimeConfig?.npcs ?? [];
        this.syncSelectedNpc(npcs);

        panel.setCustomContent('NPCs', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeInfoLine(`Count: ${npcs.length}`));
            if (npcs.length <= 0) {
                container.appendChild(this.makeSpacer(8));
                container.appendChild(this.makeInfoLine('No NPCs in this level.'));
                return;
            }

            container.appendChild(this.makeSpacer(8));
            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '6px';

            npcs.forEach((npc) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.style.width = '100%';
                button.style.textAlign = 'left';
                button.style.border = '1px solid #7a7a7a';
                button.style.padding = '6px';
                button.style.cursor = 'pointer';
                button.style.background = npc.id === this.selectedNpcId ? '#9ec9ff' : '#e8e8e8';
                button.style.fontFamily = 'inherit';
                button.style.fontSize = '12px';

                const idLine = document.createElement('div');
                idLine.style.fontWeight = 'bold';
                idLine.textContent = npc.id;

                const profileLine = document.createElement('div');
                profileLine.textContent = `profile: ${npc.profileId}`;

                button.append(idLine, profileLine);
                button.addEventListener('click', () => {
                    if (this.selectedNpcId === npc.id) {
                        return;
                    }
                    this.selectedNpcId = npc.id;
                    this.onUiChanged();
                });

                list.appendChild(button);
            });

            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const npcs = runtimeConfig?.npcs ?? [];
        const selectedNpc = this.syncSelectedNpc(npcs);

        panel.setCustomContent('NPC Inspector', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            if (!selectedNpc) {
                container.appendChild(this.makeInfoLine('Select an NPC to inspect.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Selected NPC'));
            container.appendChild(this.makeKeyValueLine('id', selectedNpc.id));
            container.appendChild(this.makeKeyValueLine('profileId', selectedNpc.profileId));
            container.appendChild(this.makeKeyValueLine('position', `${selectedNpc.x}, ${selectedNpc.y}`));
            container.appendChild(this.makeKeyValueLine('facing', selectedNpc.facing ?? '-'));
            container.appendChild(this.makeKeyValueLine('initialManpuEmotionId', this.formatNullableString(selectedNpc.initialManpuEmotionId)));
            container.appendChild(this.makeKeyValueLine('scriptedLoopRef', this.formatNullableString(selectedNpc.scriptedLoopRef)));
            container.appendChild(this.makeKeyValueLine('playerBodyContactMode', selectedNpc.playerBodyContactMode ?? '-'));
            container.appendChild(this.makeKeyValueLine('visualLayer', selectedNpc.visualLayer ?? '-'));
            container.appendChild(this.makeKeyValueLine(
                'renderOrder',
                Number.isFinite(selectedNpc.renderOrder) ? String(selectedNpc.renderOrder) : '-'
            ));

            if (selectedNpc.behavior) {
                container.appendChild(this.makeKeyValueLine(
                    'behavior overrides',
                    String(Object.keys(selectedNpc.behavior).length)
                ));
            }

            container.appendChild(this.makeSpacer(10));
            container.appendChild(this.makeSectionTitle('Logic Actions'));
            container.appendChild(this.makeInfoLine('Runtime execution: press I in gameplay to trigger npc/onInteract when no closer object binding handled input.'));
            container.appendChild(this.makeNpcInteractionTraceView(selectedNpc.id));
            container.appendChild(this.makeSpacer(8));

            const bindings = this.listNpcBindings(selectedNpc.id);
            const scriptRefs = this.logicAuthoringService.listScriptRefs();
            this.syncNpcLogicBindingEditState(bindings);
            this.syncNpcLogicBindingCreateState(selectedNpc.id, scriptRefs);
            const hasOnInteractBinding = bindings.some((entry) => entry.slot === NPC_LOGIC_BINDING_DEFAULT_SLOT);
            const isCreateOpen = this.npcLogicBindingCreateFormNpcId === selectedNpc.id;

            if (bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings for this NPC.'));
            } else {
                const bindingsList = document.createElement('div');
                bindingsList.style.display = 'grid';
                bindingsList.style.gap = '8px';

                bindings.forEach((binding) => {
                    const currentEnabled = binding.enabled !== false;
                    const enabledDraft = this.npcLogicBindingEnabledDraftById.get(binding.id) ?? currentEnabled;
                    const canApplyEnabled = enabledDraft !== currentEnabled;
                    const inlineError = this.npcLogicBindingErrorById.get(binding.id);

                    const card = document.createElement('div');
                    card.style.border = '1px solid #7a7a7a';
                    card.style.background = '#e8e8e8';
                    card.style.padding = '6px';
                    card.appendChild(this.makeKeyValueLine('id', binding.id));
                    card.appendChild(this.makeKeyValueLine('slot', binding.slot));
                    card.appendChild(this.makeKeyValueLine('scriptId', binding.scriptId));
                    card.appendChild(this.makeKeyValueLine('status', binding.enabled === false ? 'disabled' : 'enabled'));
                    card.appendChild(this.makeKeyValueLine(
                        'runtime',
                        binding.slot.trim() === NPC_LOGIC_BINDING_DEFAULT_SLOT
                            ? 'npc/onInteract (I key) is runtime-supported'
                            : 'unsupported runtime slot (supported: npc/onInteract only)'
                    ));

                    const enabledRow = document.createElement('label');
                    enabledRow.style.display = 'flex';
                    enabledRow.style.alignItems = 'center';
                    enabledRow.style.gap = '6px';
                    enabledRow.style.marginTop = '6px';
                    enabledRow.style.marginBottom = '6px';

                    const enabledCheckbox = document.createElement('input');
                    enabledCheckbox.type = 'checkbox';
                    enabledCheckbox.checked = enabledDraft;
                    this.bindEditorInputKeyboardGuards(enabledCheckbox);
                    enabledCheckbox.addEventListener('change', () => {
                        this.npcLogicBindingEnabledDraftById.set(binding.id, enabledCheckbox.checked);
                        this.npcLogicBindingErrorById.delete(binding.id);
                        this.onUiChanged();
                    });
                    enabledRow.appendChild(enabledCheckbox);

                    const enabledText = document.createElement('span');
                    enabledText.textContent = 'Enabled';
                    enabledRow.appendChild(enabledText);
                    card.appendChild(enabledRow);

                    if (inlineError) {
                        const errorLine = this.makeInfoLine(inlineError);
                        errorLine.style.color = '#b00020';
                        errorLine.style.marginBottom = '6px';
                        card.appendChild(errorLine);
                    }

                    const actionsRow = document.createElement('div');
                    actionsRow.style.display = 'flex';
                    actionsRow.style.gap = '6px';

                    const applyButton = document.createElement('button');
                    applyButton.type = 'button';
                    applyButton.textContent = 'Apply';
                    applyButton.disabled = !canApplyEnabled;
                    this.bindEditorInputKeyboardGuards(applyButton);
                    applyButton.addEventListener('click', () => {
                        this.updateNpcBindingEnabled(binding.id);
                    });
                    actionsRow.appendChild(applyButton);

                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.textContent = 'Delete';
                    this.bindEditorInputKeyboardGuards(deleteButton);
                    deleteButton.addEventListener('click', () => {
                        this.deleteNpcBinding(binding.id);
                    });
                    actionsRow.appendChild(deleteButton);

                    card.appendChild(actionsRow);
                    bindingsList.appendChild(card);
                });

                container.appendChild(bindingsList);
            }

            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.textContent = 'Add NPC Binding';
            addButton.style.marginTop = '4px';
            addButton.disabled = hasOnInteractBinding;
            this.bindEditorInputKeyboardGuards(addButton);
            addButton.addEventListener('click', () => {
                if (hasOnInteractBinding) {
                    return;
                }
                this.startNpcLogicBindingCreateForm(selectedNpc.id, scriptRefs);
                this.onUiChanged();
            });
            container.appendChild(addButton);

            if (hasOnInteractBinding) {
                container.appendChild(this.makeInfoLine('This NPC already has an onInteract binding.'));
            }

            if (!isCreateOpen) {
                return;
            }

            const form = document.createElement('div');
            form.style.border = '1px solid #8b8b8b';
            form.style.background = '#ececec';
            form.style.padding = '6px';
            form.style.marginTop = '6px';

            const slotLabel = this.makeInfoLine('Slot');
            slotLabel.style.marginBottom = '2px';
            form.appendChild(slotLabel);

            const slotSelect = document.createElement('select');
            slotSelect.style.display = 'block';
            slotSelect.style.width = '100%';
            slotSelect.style.boxSizing = 'border-box';
            slotSelect.style.marginBottom = '6px';
            slotSelect.appendChild(new Option(NPC_LOGIC_BINDING_DEFAULT_SLOT, NPC_LOGIC_BINDING_DEFAULT_SLOT));
            slotSelect.value = this.npcLogicBindingCreateSlotDraft;
            this.bindEditorInputKeyboardGuards(slotSelect);
            slotSelect.addEventListener('change', () => {
                this.npcLogicBindingCreateSlotDraft = slotSelect.value;
                this.npcLogicBindingCreateError = null;
            });
            form.appendChild(slotSelect);

            const scriptLabel = this.makeInfoLine('Script');
            scriptLabel.style.marginBottom = '2px';
            form.appendChild(scriptLabel);

            const scriptSelect = document.createElement('select');
            scriptSelect.style.display = 'block';
            scriptSelect.style.width = '100%';
            scriptSelect.style.boxSizing = 'border-box';
            scriptSelect.style.marginBottom = '6px';
            scriptSelect.disabled = scriptRefs.length <= 0;
            scriptRefs.forEach((scriptRef) => {
                scriptSelect.appendChild(new Option(this.formatNpcLogicScriptRefOptionLabel(scriptRef), scriptRef.id));
            });
            const resolvedScriptRefId = this.resolveNpcLogicBindingSelectedScriptRefId(scriptRefs);
            if (resolvedScriptRefId) {
                scriptSelect.value = resolvedScriptRefId;
            }
            this.bindEditorInputKeyboardGuards(scriptSelect);
            scriptSelect.addEventListener('change', () => {
                this.npcLogicBindingCreateScriptRefId = scriptSelect.value.trim() || null;
                this.npcLogicBindingCreateError = null;
            });
            form.appendChild(scriptSelect);

            const enabledRow = document.createElement('label');
            enabledRow.style.display = 'flex';
            enabledRow.style.alignItems = 'center';
            enabledRow.style.gap = '6px';
            enabledRow.style.marginBottom = '6px';

            const enabledCheckbox = document.createElement('input');
            enabledCheckbox.type = 'checkbox';
            enabledCheckbox.checked = this.npcLogicBindingCreateEnabledDraft;
            this.bindEditorInputKeyboardGuards(enabledCheckbox);
            enabledCheckbox.addEventListener('change', () => {
                this.npcLogicBindingCreateEnabledDraft = enabledCheckbox.checked;
                this.npcLogicBindingCreateError = null;
            });
            enabledRow.appendChild(enabledCheckbox);

            const enabledText = document.createElement('span');
            enabledText.textContent = 'Enabled';
            enabledRow.appendChild(enabledText);
            form.appendChild(enabledRow);

            if (scriptRefs.length <= 0) {
                form.appendChild(this.makeInfoLine('Add a script ref in Logic tab first.'));
            }

            if (this.npcLogicBindingCreateError) {
                const errorLine = this.makeInfoLine(this.npcLogicBindingCreateError);
                errorLine.style.color = '#b00020';
                errorLine.style.marginBottom = '6px';
                form.appendChild(errorLine);
            }

            const actionRow = document.createElement('div');
            actionRow.style.display = 'flex';
            actionRow.style.gap = '6px';

            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.textContent = 'Create';
            createButton.disabled = hasOnInteractBinding || scriptRefs.length <= 0 || !resolvedScriptRefId;
            this.bindEditorInputKeyboardGuards(createButton);
            createButton.addEventListener('click', () => {
                this.createNpcLogicBinding(selectedNpc.id);
            });
            actionRow.appendChild(createButton);

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.textContent = 'Cancel';
            this.bindEditorInputKeyboardGuards(cancelButton);
            cancelButton.addEventListener('click', () => {
                this.resetNpcLogicBindingCreateForm();
                this.onUiChanged();
            });
            actionRow.appendChild(cancelButton);

            form.appendChild(actionRow);
            container.appendChild(form);
        });
    }

    private getCurrentRuntimeConfig(): TestWorldConfig | null {
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds || !Array.isArray(config.npcs)) {
            return null;
        }
        return config;
    }

    private getCurrentNpcs(): TestNpcInstanceConfig[] {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        return runtimeConfig?.npcs ?? [];
    }

    private listNpcBindings(npcId: string): TestWorldLogicBindingConfig[] {
        return this.logicAuthoringService.listBindingsForTarget('npc', npcId);
    }

    private getRuntimeNpcInteractionTrace(): NpcInteractionTrace | null {
        const trace = this.legacyObjectAdapter?.getLastNpcInteractionTrace() as NpcInteractionTrace | null;
        if (!trace || typeof trace !== 'object' || typeof trace.status !== 'string') {
            return null;
        }
        return trace;
    }

    private makeNpcInteractionTraceView(selectedNpcId: string): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.border = '1px solid #8b8b8b';
        wrap.style.background = '#ececec';
        wrap.style.padding = '6px';
        wrap.style.marginBottom = '6px';
        const trace = this.getRuntimeNpcInteractionTrace();
        if (!trace || !trace.attempted || trace.status === 'idle') {
            wrap.appendChild(this.makeInfoLine('No NPC logic interaction attempted yet.'));
            return wrap;
        }
        const attemptText = Number.isFinite(trace.attemptId) ? `#${trace.attemptId}` : '(unknown)';
        const selectedTargetId = typeof trace.selectedTargetId === 'string' ? trace.selectedTargetId : null;
        wrap.appendChild(this.makeInfoLine(`Last attempt ${attemptText}: status ${trace.status}.`));
        if (selectedTargetId) {
            wrap.appendChild(this.makeInfoLine(`targetType: npc`));
            wrap.appendChild(this.makeInfoLine(`targetId: ${selectedTargetId}`));
            wrap.appendChild(this.makeInfoLine(`slot: onInteract`));
            if (selectedTargetId !== selectedNpcId) {
                wrap.appendChild(this.makeInfoLine(`Last target differs from selected NPC (${selectedNpcId}).`));
            }
        }
        if (trace.message?.trim()) {
            wrap.appendChild(this.makeInfoLine(`Trace: ${trace.message}`));
        }
        if (trace.bindingTrace && Array.isArray(trace.bindingTrace.bindings)) {
            wrap.appendChild(this.makeInfoLine('Binding results:'));
            trace.bindingTrace.bindings.forEach((binding) => {
                wrap.appendChild(this.makeInfoLine(`- binding id: ${binding.bindingId}`));
                wrap.appendChild(this.makeInfoLine(`  scriptId: ${binding.scriptId}`));
                wrap.appendChild(this.makeInfoLine(`  status: ${binding.status}`));
                if (binding.reason?.trim()) {
                    wrap.appendChild(this.makeInfoLine(`  reason: ${binding.reason}`));
                }
                const commandCount = Array.isArray(binding.commands) ? binding.commands.length : 0;
                if (commandCount <= 0) {
                    wrap.appendChild(this.makeInfoLine('  Command results: none'));
                    return;
                }
                binding.commands.forEach((command) => {
                    wrap.appendChild(this.makeInfoLine(`  - command id: ${command.commandId}`));
                    wrap.appendChild(this.makeInfoLine(`    type: ${command.type}`));
                    wrap.appendChild(this.makeInfoLine(`    status: ${command.status}`));
                    if (command.message?.trim()) {
                        wrap.appendChild(this.makeInfoLine(`    message: ${command.message}`));
                    }
                });
            });
        }
        return wrap;
    }

    private syncSelectedNpc(npcs: TestNpcInstanceConfig[]): TestNpcInstanceConfig | null {
        if (!this.selectedNpcId) {
            return null;
        }
        const selectedNpc = npcs.find((entry) => entry.id === this.selectedNpcId) ?? null;
        if (selectedNpc) {
            return selectedNpc;
        }
        this.selectedNpcId = null;
        return null;
    }

    private readSnapshotSignature(): string | null {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig) {
            return null;
        }
        try {
            return JSON.stringify({
                npcs: runtimeConfig.npcs,
                logicBindings: runtimeConfig.logic?.bindings ?? [],
                logicScriptRefs: runtimeConfig.logic?.scriptRefs ?? []
            });
        } catch {
            return String(runtimeConfig.npcs.length);
        }
    }

    private startNpcLogicBindingCreateForm(
        npcId: string,
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): void {
        this.npcLogicBindingCreateFormNpcId = npcId;
        this.npcLogicBindingCreateSlotDraft = NPC_LOGIC_BINDING_DEFAULT_SLOT;
        this.npcLogicBindingCreateScriptRefId = scriptRefs[0]?.id ?? null;
        this.npcLogicBindingCreateEnabledDraft = true;
        this.npcLogicBindingCreateError = null;
    }

    private resetNpcLogicBindingCreateForm(): void {
        this.npcLogicBindingCreateFormNpcId = null;
        this.npcLogicBindingCreateSlotDraft = NPC_LOGIC_BINDING_DEFAULT_SLOT;
        this.npcLogicBindingCreateScriptRefId = null;
        this.npcLogicBindingCreateEnabledDraft = true;
        this.npcLogicBindingCreateError = null;
    }

    private syncNpcLogicBindingEditState(bindings: readonly TestWorldLogicBindingConfig[]): void {
        const bindingIds = new Set(bindings.map((entry) => entry.id));
        for (const bindingId of this.npcLogicBindingEnabledDraftById.keys()) {
            if (!bindingIds.has(bindingId)) {
                this.npcLogicBindingEnabledDraftById.delete(bindingId);
            }
        }
        for (const bindingId of this.npcLogicBindingErrorById.keys()) {
            if (!bindingIds.has(bindingId)) {
                this.npcLogicBindingErrorById.delete(bindingId);
            }
        }
        bindings.forEach((binding) => {
            if (!this.npcLogicBindingEnabledDraftById.has(binding.id)) {
                this.npcLogicBindingEnabledDraftById.set(binding.id, binding.enabled !== false);
            }
        });
    }

    private syncNpcLogicBindingCreateState(
        selectedNpcId: string,
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): void {
        if (this.npcLogicBindingCreateFormNpcId && this.npcLogicBindingCreateFormNpcId !== selectedNpcId) {
            this.resetNpcLogicBindingCreateForm();
            return;
        }
        if (this.npcLogicBindingCreateFormNpcId !== selectedNpcId) {
            return;
        }
        this.npcLogicBindingCreateSlotDraft = NPC_LOGIC_BINDING_DEFAULT_SLOT;
        this.npcLogicBindingCreateScriptRefId = this.resolveNpcLogicBindingSelectedScriptRefId(scriptRefs);
    }

    private resolveNpcLogicBindingSelectedScriptRefId(
        scriptRefs: readonly TestWorldLogicScriptRefConfig[]
    ): string | null {
        const current = this.npcLogicBindingCreateScriptRefId?.trim() ?? '';
        if (current && scriptRefs.some((entry) => entry.id === current)) {
            return current;
        }
        return scriptRefs[0]?.id ?? null;
    }

    private formatNpcLogicScriptRefOptionLabel(scriptRef: TestWorldLogicScriptRefConfig): string {
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

    private createNpcLogicBinding(npcId: string): void {
        const slot = this.npcLogicBindingCreateSlotDraft.trim() || NPC_LOGIC_BINDING_DEFAULT_SLOT;
        const selectedBindings = this.logicAuthoringService.listBindingsForTarget('npc', npcId);
        const hasOnInteractBinding = selectedBindings.some((entry) => entry.slot === slot);
        if (hasOnInteractBinding) {
            this.npcLogicBindingCreateError = 'This NPC already has an onInteract binding.';
            this.onUiChanged();
            return;
        }

        const scriptRefs = this.logicAuthoringService.listScriptRefs();
        if (scriptRefs.length <= 0) {
            this.npcLogicBindingCreateError = 'Add a script ref in Logic tab first.';
            this.onUiChanged();
            return;
        }

        const scriptRefId = this.resolveNpcLogicBindingSelectedScriptRefId(scriptRefs);
        if (!scriptRefId) {
            this.npcLogicBindingCreateError = 'Select a script ref.';
            this.onUiChanged();
            return;
        }

        try {
            const result = this.logicAuthoringService.createBinding({
                targetType: 'npc',
                targetId: npcId,
                slot,
                scriptId: scriptRefId,
                enabled: this.npcLogicBindingCreateEnabledDraft
            });
            if (!result.success) {
                this.npcLogicBindingCreateError = result.reason ?? 'Failed to create logic binding.';
                this.onUiChanged();
                return;
            }
        } catch (error) {
            this.npcLogicBindingCreateError = error instanceof Error
                ? error.message
                : 'Failed to create logic binding.';
            this.onUiChanged();
            return;
        }

        this.resetNpcLogicBindingCreateForm();
        this.onUiChanged();
    }

    private updateNpcBindingEnabled(bindingId: string): void {
        const binding = this.logicAuthoringService.getBinding(bindingId);
        if (!binding) {
            this.npcLogicBindingErrorById.set(bindingId, 'Logic binding not found.');
            this.onUiChanged();
            return;
        }

        const nextEnabled = this.npcLogicBindingEnabledDraftById.get(bindingId) ?? (binding.enabled !== false);
        const result = this.logicAuthoringService.updateBinding(bindingId, { enabled: nextEnabled });
        if (!result.success) {
            this.npcLogicBindingErrorById.set(bindingId, result.reason ?? 'Failed to update logic binding.');
            this.onUiChanged();
            return;
        }

        this.npcLogicBindingErrorById.delete(bindingId);
        this.npcLogicBindingEnabledDraftById.set(bindingId, nextEnabled);
        this.onUiChanged();
    }

    private deleteNpcBinding(bindingId: string): void {
        const result = this.logicAuthoringService.deleteBinding(bindingId);
        if (!result.success) {
            this.npcLogicBindingErrorById.set(bindingId, result.reason ?? 'Failed to delete logic binding.');
            this.onUiChanged();
            return;
        }

        this.npcLogicBindingEnabledDraftById.delete(bindingId);
        this.npcLogicBindingErrorById.delete(bindingId);
        this.onUiChanged();
    }

    private bindEditorInputKeyboardGuards(input: HTMLElement): void {
        const stopKeyboardEvent = (event: Event): void => {
            event.stopPropagation();
        };
        input.addEventListener('keydown', stopKeyboardEvent);
        input.addEventListener('keyup', stopKeyboardEvent);
        input.addEventListener('keypress', stopKeyboardEvent);
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

    private formatNullableString(value: string | null | undefined): string {
        if (value === null) {
            return 'null';
        }
        return value?.trim().length ? value : '-';
    }
}
