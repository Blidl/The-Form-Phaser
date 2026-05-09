import Phaser from 'phaser';
import type { EditorMode, EditorModeRuntimeContext, EditorPointerEvent } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { EditorPanel } from '../ui/EditorPanel';
import type {
    TestWorldConfig,
    TestWorldLogicBindingConfig,
    TestWorldLogicScriptRefConfig,
    TestWorldLogicScriptConfig
} from '../../game/world/runtime/test_world_config';
import type { TestNpcInstanceConfig } from '../../game/npc/npc_types';
import type { NpcInteractionTrace, NpcPatrolRuntimeDebugSnapshot } from '../../game/world/runtime/test_world_runtime';
import { getAllLogicScriptAssets } from '../../game/world/runtime/logic_script_registry';
import { isEditorTextInputFocused } from '../../shared/dom_input_focus';
import { getTestNpcProfile } from '../../game/npc/npc_profiles';

interface NpcEditorModeOptions {
    scene: Phaser.Scene;
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

const NPC_LOGIC_BINDING_DEFAULT_SLOT = 'onInteract';

interface NpcGroundSnapResult {
    x: number;
    y: number;
    surfaceId: string;
    surfaceTopY: number;
}

export class NpcEditorMode implements EditorMode {
    public readonly id = 'npc';
    public readonly label = 'NPC';

    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private readonly scene: Phaser.Scene;
    private readonly selectionOutline: Phaser.GameObjects.Graphics;
    private readonly escapeKey: Phaser.Input.Keyboard.Key | null;
    private readonly handleShortcutKeyDown: (event: KeyboardEvent) => void;
    private shortcutsAttached = false;
    private selectedNpcId: string | null = null;
    private lastSnapshotSignature: string | null = null;
    private npcLogicBindingCreateFormNpcId: string | null = null;
    private npcLogicBindingCreateSlotDraft = NPC_LOGIC_BINDING_DEFAULT_SLOT;
    private npcLogicBindingCreateScriptRefId: string | null = null;
    private npcLogicBindingCreateEnabledDraft = true;
    private npcLogicBindingCreateError: string | null = null;
    private readonly npcLogicBindingEnabledDraftById = new Map<string, boolean>();
    private readonly npcLogicBindingErrorById = new Map<string, string>();
    private readonly npcPositionDraftById = new Map<string, { xText: string; yText: string; error: string | null }>();
    private placementModeActive = false;
    private draggingNpcId: string | null = null;
    private dragCandidateNpcId: string | null = null;
    private dragCandidatePointerWorldX = 0;
    private dragCandidatePointerWorldY = 0;
    private dragThresholdPx = 3;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private isNpcPointerDown = false;
    private lastPointerDownWorldX: number | null = null;
    private lastPointerDownWorldY: number | null = null;
    private lastPointerDownHitNpcId: string | null = null;
    private lastPointerDownUsedRuntimeBounds = false;
    private pointerDownNpcId: string | null = null;
    private dragLastDeltaX = 0;
    private dragLastDeltaY = 0;
    private lastMoveWorldX: number | null = null;
    private lastMoveWorldY: number | null = null;
    private lastPointerScreenX: number | null = null;
    private lastPointerScreenY: number | null = null;
    private lastMovePointerButton: number | null = null;
    private lastRawPointerIsDown = false;
    private lastPatchX: number | null = null;
    private lastPatchY: number | null = null;
    private lastPatchResult: 'ok' | 'fail' | '-' = '-';
    private context: EditorModeRuntimeContext = {
        mouseWorldX: null,
        mouseWorldY: null,
        grid: { enabled: true, snapEnabled: true, size: 32 }
    };

    public constructor(options: NpcEditorModeOptions) {
        this.scene = options.scene;
        this.selectionOutline = this.scene.add.graphics();
        this.selectionOutline.setDepth(40000);
        this.selectionOutline.setVisible(false);
        this.escapeKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC) ?? null;
        this.legacyObjectAdapter = options.legacyObjectAdapter;
        this.logicAuthoringService = new LogicAuthoringService(options.legacyObjectAdapter);
        this.onUiChanged = options.onUiChanged;
        this.handleShortcutKeyDown = (event: KeyboardEvent) => {
            this.handleKeyboardShortcuts(event);
        };
    }

    public enter(): void {
        this.attachShortcutListener();
        this.lastSnapshotSignature = this.readSnapshotSignature();
        this.draggingNpcId = null;
        this.dragCandidateNpcId = null;
        this.isNpcPointerDown = false;
        this.syncSelectionOutline();
    }

    public exit(): void {
        this.detachShortcutListener();
        this.draggingNpcId = null;
        this.dragCandidateNpcId = null;
        this.isNpcPointerDown = false;
        this.selectionOutline.clear();
        this.selectionOutline.setVisible(false);
    }

    public update(context: EditorModeRuntimeContext): void {
        this.context = context;
        if (this.isNpcPointerDown && this.scene.input.activePointer.isDown && context.mouseWorldX !== null && context.mouseWorldY !== null) {
            this.advanceNpcDrag(context.mouseWorldX, context.mouseWorldY);
        }
        if (
            this.placementModeActive
            && this.escapeKey
            && Phaser.Input.Keyboard.JustDown(this.escapeKey)
            && !isEditorTextInputFocused()
        ) {
            this.placementModeActive = false;
            this.onUiChanged();
        }
        const nextSignature = this.readSnapshotSignature();
        if (nextSignature === this.lastSnapshotSignature) {
            this.syncSelectionOutline();
            return;
        }
        this.lastSnapshotSignature = nextSignature;
        this.syncSelectedNpc(this.getCurrentNpcs());
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const npcs = runtimeConfig?.npcs ?? [];
        const selectedNpc = this.syncSelectedNpc(npcs);

        panel.setCustomContent('NPCs', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeInfoLine(`Count: ${npcs.length}`));
            const createButton = document.createElement('button');
            createButton.type = 'button';
            createButton.textContent = this.placementModeActive ? 'Cancel Add NPC' : 'Add NPC';
            createButton.style.marginTop = '6px';
            this.bindEditorInputKeyboardGuards(createButton);
            createButton.addEventListener('click', () => {
                this.placementModeActive = !this.placementModeActive;
                this.draggingNpcId = null;
                this.dragCandidateNpcId = null;
                this.onUiChanged();
            });
            container.appendChild(createButton);
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Delete Selected NPC';
            deleteButton.style.marginTop = '6px';
            deleteButton.disabled = !selectedNpc;
            this.bindEditorInputKeyboardGuards(deleteButton);
            deleteButton.addEventListener('click', () => {
                this.deleteSelectedNpc();
            });
            container.appendChild(deleteButton);
            if (this.placementModeActive) {
                container.appendChild(this.makeInfoLine('Click level to place NPC.'));
            }
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
                button.style.whiteSpace = 'normal';
                button.style.overflowWrap = 'anywhere';
                button.style.wordBreak = 'break-word';

                const idLine = document.createElement('div');
                idLine.style.fontWeight = 'bold';
                idLine.style.overflowWrap = 'anywhere';
                idLine.style.wordBreak = 'break-word';
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

    public onPointerDown(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;
        if (event.button !== 0) {
            return;
        }
        this.lastPointerDownWorldX = event.worldX;
        this.lastPointerDownWorldY = event.worldY;
        this.lastPointerDownHitNpcId = null;
        this.lastPointerDownUsedRuntimeBounds = false;
        this.pointerDownNpcId = null;
        this.dragLastDeltaX = 0;
        this.dragLastDeltaY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.isNpcPointerDown = false;
        if (this.placementModeActive) {
            const createdId = this.createNpcAt(event.worldX, event.worldY);
            if (createdId) {
                this.selectedNpcId = createdId;
                this.placementModeActive = false;
                this.draggingNpcId = null;
                this.dragCandidateNpcId = null;
                this.syncSelectionOutline();
                this.onUiChanged();
            }
            return;
        }
        const hitNpc = this.findNpcAt(event.worldX, event.worldY, true);
        if (!hitNpc) {
            this.draggingNpcId = null;
            this.dragCandidateNpcId = null;
            this.pointerDownNpcId = null;
            this.isNpcPointerDown = false;
            this.selectedNpcId = null;
            this.syncSelectionOutline();
            this.onUiChanged();
            return;
        }
        this.selectedNpcId = hitNpc.id;
        this.lastPointerDownHitNpcId = hitNpc.id;
        this.draggingNpcId = null;
        this.dragCandidateNpcId = hitNpc.id;
        this.dragCandidatePointerWorldX = event.worldX;
        this.dragCandidatePointerWorldY = event.worldY;
        this.pointerDownNpcId = hitNpc.id;
        this.isNpcPointerDown = true;
        const runtimeBounds = this.legacyObjectAdapter?.getNpcActorBounds(hitNpc.id) ?? null;
        this.lastPointerDownUsedRuntimeBounds = !!runtimeBounds;
        const anchorX = runtimeBounds?.x ?? hitNpc.x;
        const anchorY = runtimeBounds?.y ?? hitNpc.y;
        this.dragOffsetX = event.worldX - anchorX;
        this.dragOffsetY = event.worldY - anchorY;
        this.syncSelectionOutline();
        this.onUiChanged();
    }

    public onPointerMove(event: EditorPointerEvent, context: EditorModeRuntimeContext): void {
        this.context = context;
        this.lastMoveWorldX = event.worldX;
        this.lastMoveWorldY = event.worldY;
        this.lastPointerScreenX = this.scene.input.activePointer.x;
        this.lastPointerScreenY = this.scene.input.activePointer.y;
        this.lastMovePointerButton = event.button;
        this.lastRawPointerIsDown = this.scene.input.activePointer.isDown;
        if (!this.isNpcPointerDown || !this.scene.input.activePointer.isDown) {
            return;
        }
        this.advanceNpcDrag(event.worldX, event.worldY);
    }

    public onPointerUp(_event: EditorPointerEvent): void {
        this.draggingNpcId = null;
        this.dragCandidateNpcId = null;
        this.pointerDownNpcId = null;
        this.isNpcPointerDown = false;
        this.syncSelectionOutline();
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
            container.appendChild(this.makeKeyValueLine('selection debug', this.getSelectionDebugLine()));
            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Settings'));
            container.appendChild(this.makeNpcSettingsEditor(selectedNpc));
            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeSectionTitle('Visual'));
            container.appendChild(this.makeNpcVisualEditor(selectedNpc));
            container.appendChild(this.makeInfoLine('Drag NPC in scene or apply exact x/y below.'));
            container.appendChild(this.makeNpcPositionEditor(selectedNpc));
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
            container.appendChild(this.makeSectionTitle('NPC Behavior Scripts'));
            container.appendChild(this.makeNpcBehaviorScriptsSection(selectedNpc));
            container.appendChild(this.makeSpacer(8));
            container.appendChild(this.makeNpcPatrolRuntimeStatusSection(selectedNpc.id));

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
                    card.style.minWidth = '0';
                    card.style.overflowWrap = 'anywhere';
                    card.style.wordBreak = 'break-word';
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
                    actionsRow.style.flexWrap = 'wrap';
                    actionsRow.style.minWidth = '0';

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
            form.style.minWidth = '0';
            form.style.overflowWrap = 'anywhere';
            form.style.wordBreak = 'break-word';

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
            actionRow.style.flexWrap = 'wrap';
            actionRow.style.minWidth = '0';

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

    private getNpcPatrolRuntimeDebugSnapshot(): NpcPatrolRuntimeDebugSnapshot | null {
        const snapshot = this.legacyObjectAdapter?.getNpcPatrolRuntimeDebugSnapshot() as NpcPatrolRuntimeDebugSnapshot | null;
        if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.npcs)) {
            return null;
        }
        return snapshot;
    }

    private makeNpcBehaviorScriptsSection(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        const scripts = getAllLogicScriptAssets();
        const patrolScripts = scripts.filter((entry) => entry.category === 'npc.patrol');
        const actionScripts = scripts.filter((entry) => entry.category === 'npc.action');
        wrap.appendChild(this.makeBehaviorScriptSelectRow(selectedNpc, 'Patrol', 'patrol', patrolScripts, selectedNpc.behaviorScripts?.patrol ?? null));
        wrap.appendChild(this.makeBehaviorScriptSelectRow(selectedNpc, 'Default Action', 'defaultAction', actionScripts, selectedNpc.behaviorScripts?.defaultAction ?? null));
        const altActions = selectedNpc.behaviorScripts?.altActions ?? [];
        wrap.appendChild(this.makeKeyValueLine('Alt Actions', altActions.length > 0 ? altActions.join(', ') : '(deferred read-only)'));
        return wrap;
    }

    private makeBehaviorScriptSelectRow(
        selectedNpc: TestNpcInstanceConfig,
        label: string,
        field: 'patrol' | 'defaultAction',
        scripts: TestWorldLogicScriptConfig[],
        currentValue: string | null
    ): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gap = '2px';
        row.appendChild(this.makeInfoLine(label));
        const select = document.createElement('select');
        select.style.width = '100%';
        select.appendChild(new Option('(none)', ''));
        scripts.forEach((script) => {
            select.appendChild(new Option(`${script.name} (${script.id})`, script.id));
        });
        const normalizedCurrent = currentValue?.trim() ?? '';
        select.value = scripts.some((entry) => entry.id === normalizedCurrent) ? normalizedCurrent : '';
        this.bindEditorInputKeyboardGuards(select);
        select.addEventListener('change', () => {
            this.updateNpcBehaviorScriptField(selectedNpc.id, field, select.value.trim() || null);
        });
        row.appendChild(select);
        return row;
    }

    private updateNpcBehaviorScriptField(
        npcId: string,
        field: 'patrol' | 'defaultAction',
        value: string | null
    ): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return;
        }
        const npcIndex = runtimeConfig.npcs.findIndex((entry) => entry.id === npcId);
        if (npcIndex < 0) {
            return;
        }
        const nextConfig = JSON.parse(JSON.stringify(runtimeConfig)) as TestWorldConfig;
        const npc = nextConfig.npcs[npcIndex];
        if (!npc) {
            return;
        }
        const behaviorScripts = npc.behaviorScripts
            ? {
                patrol: npc.behaviorScripts.patrol,
                defaultAction: npc.behaviorScripts.defaultAction,
                altActions: npc.behaviorScripts.altActions ? [...npc.behaviorScripts.altActions] : undefined
            }
            : {};
        if (field === 'patrol') {
            behaviorScripts.patrol = value ?? undefined;
        } else {
            behaviorScripts.defaultAction = value ?? undefined;
        }
        if (!behaviorScripts.patrol && !behaviorScripts.defaultAction && (!behaviorScripts.altActions || behaviorScripts.altActions.length <= 0)) {
            npc.behaviorScripts = undefined;
        } else {
            npc.behaviorScripts = behaviorScripts;
        }
        this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        this.onUiChanged();
    }

    private makeNpcPatrolRuntimeStatusSection(selectedNpcId: string): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.border = '1px solid #8b8b8b';
        wrap.style.background = '#ececec';
        wrap.style.padding = '6px';
        const snapshot = this.getNpcPatrolRuntimeDebugSnapshot();
        const entry = snapshot?.npcs.find((item) => item.npcId === selectedNpcId);
        if (!entry) {
            wrap.appendChild(this.makeInfoLine('Patrol runtime: no debug data.'));
            return wrap;
        }
        wrap.appendChild(this.makeInfoLine(`controlMode: ${entry.controlMode ?? 'behavior'}`));
        wrap.appendChild(this.makeInfoLine(`controlledBy: ${entry.controlledBy ?? '-'}`));
        wrap.appendChild(this.makeInfoLine(`assigned script: ${entry.assignedScriptId ?? '-'}`));
        wrap.appendChild(this.makeInfoLine(`resolved: ${entry.resolved ? 'yes' : 'no'}`));
        wrap.appendChild(this.makeInfoLine(`active: ${entry.active ? 'yes' : 'no'}`));
        wrap.appendChild(this.makeInfoLine(`axis/dir: ${entry.axis ?? '-'} / ${entry.direction ?? 0}`));
        wrap.appendChild(this.makeInfoLine(`patrol velocity: ${entry.velocityX.toFixed(2)}, ${entry.velocityY.toFixed(2)}`));
        wrap.appendChild(this.makeInfoLine(`current position: ${entry.currentX.toFixed(2)}, ${entry.currentY.toFixed(2)}`));
        wrap.appendChild(this.makeInfoLine(`origin: ${entry.originX.toFixed(2)}, ${entry.originY.toFixed(2)}`));
        wrap.appendChild(this.makeInfoLine(`blocked reason: ${entry.blockedReason ?? '-'}`));
        return wrap;
    }

    private makeNpcSettingsEditor(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = selectedNpc.displayName ?? '';
        this.bindEditorInputKeyboardGuards(nameInput);
        nameInput.addEventListener('change', () => {
            this.patchNpcConfigFields(selectedNpc.id, { displayName: nameInput.value });
        });
        wrap.appendChild(this.makeLabeledInput('Name', nameInput));

        const shapeSelect = document.createElement('select');
        shapeSelect.appendChild(new Option('Profile Default', ''));
        ['ball', 'circle', 'square', 'triangle', 'rectangle'].forEach((value) => {
            shapeSelect.appendChild(new Option(value, value));
        });
        shapeSelect.value = selectedNpc.visualOverrides?.shape ?? '';
        this.bindEditorInputKeyboardGuards(shapeSelect);
        shapeSelect.addEventListener('change', () => {
            this.patchNpcConfigFields(selectedNpc.id, { shape: shapeSelect.value });
        });
        wrap.appendChild(this.makeLabeledInput('Type / Shape', shapeSelect));

        const contactSelect = document.createElement('select');
        contactSelect.appendChild(new Option('Profile Default', ''));
        contactSelect.appendChild(new Option('Block', 'block'));
        contactSelect.appendChild(new Option('Overlap', 'overlap'));
        contactSelect.appendChild(new Option('Ignore', 'ignore'));
        contactSelect.value = selectedNpc.playerBodyContactMode ?? '';
        this.bindEditorInputKeyboardGuards(contactSelect);
        contactSelect.addEventListener('change', () => {
            this.patchNpcConfigFields(selectedNpc.id, { playerBodyContactMode: contactSelect.value });
        });
        wrap.appendChild(this.makeLabeledInput('Player Contact', contactSelect));
        return wrap;
    }

    private makeNpcVisualEditor(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        const visual = selectedNpc.visualOverrides ?? {};
        wrap.appendChild(this.makeNpcHexField(selectedNpc.id, 'Fill Color', visual.fillColor, 'fillColor'));
        wrap.appendChild(this.makeNpcHexField(selectedNpc.id, 'Stroke Color', visual.strokeColor, 'strokeColor'));
        wrap.appendChild(this.makeNpcNumberField(selectedNpc.id, 'Stroke Width', visual.strokeWidth, 'strokeWidth', 0.25));
        wrap.appendChild(this.makeNpcNumberField(selectedNpc.id, 'Alpha', visual.alpha, 'alpha', 0.05));
        wrap.appendChild(this.makeNpcNumberField(selectedNpc.id, 'Scale X', visual.scaleX, 'scaleX', 0.1));
        wrap.appendChild(this.makeNpcNumberField(selectedNpc.id, 'Scale Y', visual.scaleY, 'scaleY', 0.1));
        wrap.appendChild(this.makeNpcTextField(selectedNpc.id, 'Texture Key', visual.textureKey ?? '', 'textureKey'));
        wrap.appendChild(this.makeNpcTextField(selectedNpc.id, 'Frame', visual.frame ?? '', 'frame'));
        wrap.appendChild(this.makeNpcFacingField(selectedNpc));
        wrap.appendChild(this.makeNpcVisualLayerField(selectedNpc));
        wrap.appendChild(this.makeNpcRenderOrderField(selectedNpc));
        return wrap;
    }

    private makeNpcFacingField(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const select = document.createElement('select');
        select.appendChild(new Option('Right', 'right'));
        select.appendChild(new Option('Left', 'left'));
        select.value = selectedNpc.facing ?? 'right';
        this.bindEditorInputKeyboardGuards(select);
        select.addEventListener('change', () => this.patchNpcConfigFields(selectedNpc.id, { facing: select.value }));
        return this.makeLabeledInput('Facing', select);
    }

    private makeNpcVisualLayerField(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const select = document.createElement('select');
        select.appendChild(new Option('Default', ''));
        ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'].forEach((layer) => select.appendChild(new Option(layer, layer)));
        select.value = selectedNpc.visualLayer ?? '';
        this.bindEditorInputKeyboardGuards(select);
        select.addEventListener('change', () => this.patchNpcConfigFields(selectedNpc.id, { visualLayer: select.value }));
        return this.makeLabeledInput('Visual Layer', select);
    }

    private makeNpcRenderOrderField(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '1';
        input.value = Number.isFinite(selectedNpc.renderOrder) ? String(selectedNpc.renderOrder) : '';
        this.bindEditorInputKeyboardGuards(input);
        input.addEventListener('change', () => {
            this.patchNpcConfigFields(selectedNpc.id, {
                renderOrder: input.value.trim().length > 0 ? Number(input.value) : undefined
            });
        });
        return this.makeLabeledInput('Render Order', input);
    }

    private makeNpcNumberField(
        npcId: string,
        label: string,
        value: number | undefined,
        patchKey: string,
        step: number
    ): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = String(step);
        input.value = Number.isFinite(value) ? String(value) : '';
        this.bindEditorInputKeyboardGuards(input);
        input.addEventListener('change', () => {
            this.patchNpcConfigFields(npcId, {
                [patchKey]: input.value.trim().length > 0 ? Number(input.value) : undefined
            });
        });
        return this.makeLabeledInput(label, input);
    }

    private makeNpcTextField(npcId: string, label: string, value: string, patchKey: string): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        this.bindEditorInputKeyboardGuards(input);
        input.addEventListener('change', () => this.patchNpcConfigFields(npcId, { [patchKey]: input.value }));
        return this.makeLabeledInput(label, input);
    }

    private makeNpcHexField(
        npcId: string,
        label: string,
        value: number | undefined,
        patchKey: string
    ): HTMLDivElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = Number.isFinite(value) ? `#${Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, '0')}` : '';
        this.bindEditorInputKeyboardGuards(input);
        input.addEventListener('change', () => {
            const raw = input.value.trim();
            const parsed = raw.startsWith('#') ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 16);
            if (!Number.isFinite(parsed)) {
                return;
            }
            this.patchNpcConfigFields(npcId, { [patchKey]: Math.max(0, Math.min(0xffffff, Math.round(parsed))) });
        });
        return this.makeLabeledInput(label, input);
    }

    private patchNpcConfigFields(npcId: string, patch: Record<string, unknown>): void {
        if (!this.legacyObjectAdapter) {
            return;
        }
        this.legacyObjectAdapter.patchRuntimeNpcFields(npcId, patch);
        this.onUiChanged();
    }

    private makeNpcPositionEditor(selectedNpc: TestNpcInstanceConfig): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.display = 'grid';
        wrap.style.gap = '6px';
        wrap.style.border = '1px solid #8b8b8b';
        wrap.style.background = '#ececec';
        wrap.style.padding = '6px';
        const draft = this.getNpcPositionDraft(selectedNpc);
        wrap.appendChild(this.makeInfoLine('Position'));

        const xInput = document.createElement('input');
        xInput.type = 'number';
        xInput.step = '1';
        xInput.value = draft.xText;
        this.bindEditorInputKeyboardGuards(xInput);
        xInput.addEventListener('input', () => {
            draft.xText = xInput.value;
            draft.error = null;
        });
        wrap.appendChild(this.makeLabeledInput('x', xInput));

        const yInput = document.createElement('input');
        yInput.type = 'number';
        yInput.step = '1';
        yInput.value = draft.yText;
        this.bindEditorInputKeyboardGuards(yInput);
        yInput.addEventListener('input', () => {
            draft.yText = yInput.value;
            draft.error = null;
        });
        wrap.appendChild(this.makeLabeledInput('y', yInput));

        const applyButton = document.createElement('button');
        applyButton.type = 'button';
        applyButton.textContent = 'Apply Position';
        this.bindEditorInputKeyboardGuards(applyButton);
        applyButton.addEventListener('click', () => {
            this.applyNpcPosition(selectedNpc.id);
        });
        wrap.appendChild(applyButton);

        const snapButton = document.createElement('button');
        snapButton.type = 'button';
        snapButton.textContent = 'Snap to Ground';
        this.bindEditorInputKeyboardGuards(snapButton);
        snapButton.addEventListener('click', () => {
            this.snapNpcToGround(selectedNpc.id);
        });
        wrap.appendChild(snapButton);

        if (draft.error) {
            const error = this.makeInfoLine(draft.error);
            error.style.color = '#b00020';
            wrap.appendChild(error);
        }
        return wrap;
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
        wrap.style.minWidth = '0';
        wrap.style.overflowWrap = 'anywhere';
        wrap.style.wordBreak = 'break-word';
        const trace = this.getRuntimeNpcInteractionTrace();
        if (!trace || !trace.attempted || trace.status === 'idle') {
            wrap.appendChild(this.makeInfoLine('No NPC logic interaction attempted yet.'));
            return wrap;
        }
        const attemptText = Number.isFinite(trace.attemptId) ? `#${trace.attemptId}` : '(unknown)';
        const selectedTargetId = typeof trace.selectedTargetId === 'string' ? trace.selectedTargetId : null;
        if (!selectedTargetId) {
            wrap.appendChild(this.makeInfoLine('No interaction attempted for this NPC.'));
            wrap.appendChild(this.makeInfoLine(`selectedNpcId: ${selectedNpcId}`));
            wrap.appendChild(this.makeInfoLine('lastTraceTargetId: -'));
            wrap.appendChild(this.makeInfoLine('traceShownForSelected: no'));
            return wrap;
        }
        if (selectedTargetId !== selectedNpcId) {
            wrap.appendChild(this.makeInfoLine(`Last interaction was for ${selectedTargetId}, not selected ${selectedNpcId}.`));
            wrap.appendChild(this.makeInfoLine(`selectedNpcId: ${selectedNpcId}`));
            wrap.appendChild(this.makeInfoLine(`lastTraceTargetId: ${selectedTargetId}`));
            wrap.appendChild(this.makeInfoLine('traceShownForSelected: no'));
            return wrap;
        }
        wrap.appendChild(this.makeInfoLine(`Last attempt ${attemptText}: status ${trace.status}.`));
        wrap.appendChild(this.makeInfoLine(`targetType: npc`));
        wrap.appendChild(this.makeInfoLine(`targetId: ${selectedTargetId}`));
        wrap.appendChild(this.makeInfoLine(`slot: onInteract`));
        wrap.appendChild(this.makeInfoLine(`selectedNpcId: ${selectedNpcId}`));
        wrap.appendChild(this.makeInfoLine(`lastTraceTargetId: ${selectedTargetId}`));
        wrap.appendChild(this.makeInfoLine('traceShownForSelected: yes'));
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
        if (trace.defaultActionTrace) {
            wrap.appendChild(this.makeInfoLine('Default Action result:'));
            wrap.appendChild(this.makeInfoLine(`  scriptId: ${trace.defaultActionTrace.scriptId ?? '-'}`));
            wrap.appendChild(this.makeInfoLine(`  status: ${trace.defaultActionTrace.status}`));
            if (trace.defaultActionTrace.reason?.trim()) {
                wrap.appendChild(this.makeInfoLine(`  reason: ${trace.defaultActionTrace.reason}`));
            }
            if (trace.defaultActionTrace.commands.length <= 0) {
                wrap.appendChild(this.makeInfoLine('  Command results: none'));
            } else {
                trace.defaultActionTrace.commands.forEach((command) => {
                    wrap.appendChild(this.makeInfoLine(`  - command id: ${command.commandId}`));
                    wrap.appendChild(this.makeInfoLine(`    type: ${command.type}`));
                    wrap.appendChild(this.makeInfoLine(`    status: ${command.status}`));
                    if (command.message?.trim()) {
                        wrap.appendChild(this.makeInfoLine(`    message: ${command.message}`));
                    }
                });
            }
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
        this.syncSelectionOutline();
        return null;
    }

    private getNpcPositionDraft(selectedNpc: TestNpcInstanceConfig): { xText: string; yText: string; error: string | null } {
        const existing = this.npcPositionDraftById.get(selectedNpc.id);
        if (existing) {
            return existing;
        }
        const next = {
            xText: String(selectedNpc.x),
            yText: String(selectedNpc.y),
            error: null
        };
        this.npcPositionDraftById.set(selectedNpc.id, next);
        return next;
    }

    private applyNpcPosition(npcId: string): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return;
        }
        const selectedNpc = runtimeConfig.npcs.find((entry) => entry.id === npcId);
        if (!selectedNpc) {
            return;
        }
        const draft = this.getNpcPositionDraft(selectedNpc);
        const nextX = Number(draft.xText);
        const nextY = Number(draft.yText);
        if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
            draft.error = 'x/y must be finite numbers.';
            this.onUiChanged();
            return;
        }
        draft.error = null;
        this.patchNpcPosition(npcId, nextX, nextY);
    }

    private createNpc(): void {
        const worldX = this.context.mouseWorldX ?? 0;
        const worldY = this.context.mouseWorldY ?? 0;
        this.createNpcAt(worldX, worldY);
    }

    private createNpcAt(worldX: number, worldY: number): string | null {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return null;
        }
        const ids = new Set(runtimeConfig.npcs.map((entry) => entry.id));
        let index = 1;
        let npcId = `npc_${index}`;
        while (ids.has(npcId)) {
            index += 1;
            npcId = `npc_${index}`;
        }
        const spawnX = this.snap(worldX, this.context.grid);
        const rawSpawnY = this.snap(worldY, this.context.grid);
        const snappedSpawn = this.resolveNpcGroundSnap('passive_observer', spawnX, rawSpawnY, runtimeConfig);
        const spawnY = snappedSpawn?.y ?? rawSpawnY;
        const nextNpc: TestNpcInstanceConfig = {
            id: npcId,
            profileId: 'passive_observer',
            x: spawnX,
            y: spawnY,
            facing: 'right',
            scriptedLoopRef: null,
            sequenceHookOverrides: {
                onSpawnSequenceRef: null,
                onPlayerNearSequenceRef: null,
                onPlayerFarSequenceRef: null
            },
            interactionOverride: {
                outcome: null
            },
            behavior: {
                passiveMode: 'idle',
                patrolDistance: 0,
                moveSpeed: 0,
                patrolPauseMs: 0
            },
            behaviorScripts: undefined,
            playerBodyContactMode: 'block'
        };
        const nextConfig = JSON.parse(JSON.stringify(runtimeConfig)) as TestWorldConfig;
        nextConfig.npcs.push(nextNpc);
        this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        this.selectedNpcId = npcId;
        this.npcPositionDraftById.set(npcId, { xText: String(spawnX), yText: String(spawnY), error: null });
        this.onUiChanged();
        return npcId;
    }

    private snapNpcToGround(npcId: string): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return;
        }
        const npc = runtimeConfig.npcs.find((entry) => entry.id === npcId);
        if (!npc) {
            return;
        }
        const runtimeBounds = this.legacyObjectAdapter.getNpcActorBounds(npcId);
        const sourceX = runtimeBounds?.x ?? npc.x;
        const sourceY = runtimeBounds?.y ?? npc.y;
        const draft = this.getNpcPositionDraft(npc);
        const snapResult = this.resolveNpcGroundSnap(npc.profileId, sourceX, sourceY, runtimeConfig);
        if (!snapResult) {
            draft.error = 'No solid static surface found below this NPC.';
            this.onUiChanged();
            return;
        }
        draft.error = null;
        if (!this.patchNpcPosition(npcId, snapResult.x, snapResult.y)) {
            draft.error = `Failed to snap NPC to ${snapResult.surfaceId}.`;
            this.onUiChanged();
        }
    }

    private resolveNpcGroundSnap(
        profileId: string,
        x: number,
        y: number,
        runtimeConfig: TestWorldConfig
    ): NpcGroundSnapResult | null {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        const bodyHeight = this.getNpcBodyDimensions(profileId).height;
        let best: NpcGroundSnapResult | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        runtimeConfig.surfaces.forEach((surface) => {
            if (surface.collisionMode === 'visual_only') {
                return;
            }
            if (
                !Number.isFinite(surface.x)
                || !Number.isFinite(surface.y)
                || !Number.isFinite(surface.width)
                || !Number.isFinite(surface.height)
                || surface.width <= 0
                || surface.height <= 0
            ) {
                return;
            }
            const left = surface.x - (surface.width * 0.5);
            const right = surface.x + (surface.width * 0.5);
            if (x < left || x > right) {
                return;
            }
            const top = surface.y - (surface.height * 0.5);
            const bottom = surface.y + (surface.height * 0.5);
            const isBelowOrContainingPoint = top >= y || (y >= top && y <= bottom);
            if (!isBelowOrContainingPoint) {
                return;
            }
            const distance = top >= y ? top - y : 0;
            if (distance >= bestDistance) {
                return;
            }
            bestDistance = distance;
            best = {
                x,
                y: top - (bodyHeight * 0.5),
                surfaceId: surface.id,
                surfaceTopY: top
            };
        });
        return best;
    }

    private getNpcBodyDimensions(profileId: string): { width: number; height: number } {
        const profile = getTestNpcProfile(profileId);
        return {
            width: profile?.visual.bodyWidth ?? 28,
            height: profile?.visual.bodyHeight ?? 40
        };
    }

    private patchNpcPosition(npcId: string, x: number, y: number): boolean {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return false;
        }
        const currentNpc = runtimeConfig.npcs.find((entry) => entry.id === npcId);
        if (!currentNpc) {
            return false;
        }
        if (currentNpc.x === x && currentNpc.y === y) {
            return true;
        }
        let patched = this.legacyObjectAdapter.patchRuntimeNpcFields(npcId, { x, y });
        if (!patched) {
            const nextConfig = JSON.parse(JSON.stringify(runtimeConfig)) as TestWorldConfig;
            const npc = nextConfig.npcs.find((entry) => entry.id === npcId);
            if (npc) {
                npc.x = x;
                npc.y = y;
                const result = this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
                patched = !!result?.success;
            }
        }
        if (!patched) {
            this.lastPatchX = x;
            this.lastPatchY = y;
            this.lastPatchResult = 'fail';
            return false;
        }
        this.lastPatchX = x;
        this.lastPatchY = y;
        this.lastPatchResult = 'ok';
        const draft = this.npcPositionDraftById.get(npcId);
        if (draft) {
            draft.xText = String(x);
            draft.yText = String(y);
            draft.error = null;
        }
        this.selectedNpcId = npcId;
        this.syncSelectionOutline();
        this.onUiChanged();
        return true;
    }

    private advanceNpcDrag(worldX: number, worldY: number): void {
        const candidateId = this.draggingNpcId ?? this.dragCandidateNpcId;
        if (!candidateId) {
            return;
        }
        if (this.draggingNpcId === null) {
            const distance = Math.hypot(worldX - this.dragCandidatePointerWorldX, worldY - this.dragCandidatePointerWorldY);
            if (distance < this.dragThresholdPx) {
                return;
            }
            this.draggingNpcId = candidateId;
        }
        const nextX = worldX - this.dragOffsetX;
        const nextY = worldY - this.dragOffsetY;
        this.dragLastDeltaX = worldX - this.dragCandidatePointerWorldX;
        this.dragLastDeltaY = worldY - this.dragCandidatePointerWorldY;
        this.patchNpcPosition(candidateId, nextX, nextY);
    }

    private findNpcAt(worldX: number, worldY: number, trackRuntimeUsage = false): TestNpcInstanceConfig | null {
        const npcs = this.getCurrentNpcs();
        for (let i = npcs.length - 1; i >= 0; i -= 1) {
            const npc = npcs[i];
            const runtimeBounds = this.legacyObjectAdapter?.getNpcActorBounds(npc.id) ?? null;
            const containsPoint = (
                centerX: number,
                centerY: number,
                width: number,
                height: number
            ): boolean => {
                const halfWidth = Math.max(12, width * 0.5);
                const halfHeight = Math.max(16, height * 0.5);
                return Math.abs(worldX - centerX) <= halfWidth && Math.abs(worldY - centerY) <= halfHeight;
            };
            const fallbackWidth = Math.max(28, runtimeBounds?.width ?? 32);
            const fallbackHeight = Math.max(40, runtimeBounds?.height ?? 52);
            if (runtimeBounds) {
                if (containsPoint(runtimeBounds.x, runtimeBounds.y, runtimeBounds.width, runtimeBounds.height)) {
                    if (trackRuntimeUsage) {
                        this.lastPointerDownUsedRuntimeBounds = true;
                    }
                    return npc;
                }
            }
            if (containsPoint(npc.x, npc.y, fallbackWidth, fallbackHeight)) {
                return npc;
            }
            const configFootAnchorY = npc.y - (fallbackHeight * 0.5);
            if (containsPoint(npc.x, configFootAnchorY, fallbackWidth, fallbackHeight)) {
                return npc;
            }
            if (runtimeBounds) {
                const midpointY = (runtimeBounds.y + npc.y) * 0.5;
                if (containsPoint(npc.x, midpointY, fallbackWidth, fallbackHeight)) {
                    return npc;
                }
            }
            const runtimeDebug = this.getNpcPatrolRuntimeDebugSnapshot()?.npcs.find((entry) => entry.npcId === npc.id) ?? null;
            if (runtimeDebug && containsPoint(runtimeDebug.currentX, runtimeDebug.currentY, fallbackWidth, fallbackHeight)) {
                return npc;
            }
        }
        return null;
    }

    private syncSelectionOutline(): void {
        this.selectionOutline.clear();
        const selectedNpc = this.getCurrentNpcs().find((entry) => entry.id === this.selectedNpcId) ?? null;
        if (!selectedNpc) {
            this.selectionOutline.setVisible(false);
            return;
        }
        const bounds = this.resolveNpcSelectionBounds(selectedNpc);
        if (!bounds) {
            this.selectionOutline.setVisible(false);
            return;
        }
        this.selectionOutline.setVisible(true);
        const left = bounds.x - (bounds.width * 0.5);
        const top = bounds.y - (bounds.height * 0.5);
        this.selectionOutline.lineStyle(2, 0x00e5ff, 0.95);
        this.selectionOutline.strokeRect(left, top, bounds.width, bounds.height);
        this.selectionOutline.lineStyle(1, 0xffffff, 0.95);
        this.selectionOutline.strokeRect(left - 1, top - 1, bounds.width + 2, bounds.height + 2);
    }

    private resolveNpcSelectionBounds(npc: TestNpcInstanceConfig): { x: number; y: number; width: number; height: number } | null {
        const runtimeBounds = this.legacyObjectAdapter?.getNpcActorBounds(npc.id) ?? null;
        if (
            runtimeBounds
            && Number.isFinite(runtimeBounds.x)
            && Number.isFinite(runtimeBounds.y)
            && Number.isFinite(runtimeBounds.width)
            && Number.isFinite(runtimeBounds.height)
        ) {
            return runtimeBounds;
        }
        const dimensions = this.getNpcBodyDimensions(npc.profileId);
        return {
            x: npc.x,
            y: npc.y,
            width: dimensions.width,
            height: dimensions.height
        };
    }

    private getSelectionDebugLine(): string {
        const xText = this.lastPointerDownWorldX === null ? '-' : this.lastPointerDownWorldX.toFixed(1);
        const yText = this.lastPointerDownWorldY === null ? '-' : this.lastPointerDownWorldY.toFixed(1);
        const hitId = this.lastPointerDownHitNpcId ?? '-';
        const selectedId = this.selectedNpcId ?? '-';
        const runtimeUsed = this.lastPointerDownUsedRuntimeBounds ? 'yes' : 'no';
        const pointerDownId = this.pointerDownNpcId ?? '-';
        const pointerDownWorldX = this.lastPointerDownWorldX === null ? '-' : this.lastPointerDownWorldX.toFixed(1);
        const pointerDownWorldY = this.lastPointerDownWorldY === null ? '-' : this.lastPointerDownWorldY.toFixed(1);
        const moveWorldX = this.lastMoveWorldX === null ? '-' : this.lastMoveWorldX.toFixed(1);
        const moveWorldY = this.lastMoveWorldY === null ? '-' : this.lastMoveWorldY.toFixed(1);
        const screenX = this.lastPointerScreenX === null ? '-' : this.lastPointerScreenX.toFixed(1);
        const screenY = this.lastPointerScreenY === null ? '-' : this.lastPointerScreenY.toFixed(1);
        const dragging = this.draggingNpcId ? 'yes' : 'no';
        const internalDown = this.isNpcPointerDown ? 'yes' : 'no';
        const rawDown = this.lastRawPointerIsDown ? 'yes' : 'no';
        const dragDelta = `${this.dragLastDeltaX.toFixed(1)}, ${this.dragLastDeltaY.toFixed(1)}`;
        const patchX = this.lastPatchX === null ? '-' : this.lastPatchX.toFixed(1);
        const patchY = this.lastPatchY === null ? '-' : this.lastPatchY.toFixed(1);
        return `click: ${xText}, ${yText} | hit: ${hitId} | selected: ${selectedId} | pointerDownNpc: ${pointerDownId} | pointerDownWorld: ${pointerDownWorldX}, ${pointerDownWorldY} | lastMoveWorld: ${moveWorldX}, ${moveWorldY} | pointerScreen: ${screenX}, ${screenY} | rawIsDown: ${rawDown} | internalPointerDown: ${internalDown} | dragging: ${dragging} | dragDelta: ${dragDelta} | lastPatch: ${patchX}, ${patchY} (${this.lastPatchResult}) | runtimeBounds: ${runtimeUsed}`;
    }

    private snap(value: number, grid: EditorModeRuntimeContext['grid']): number {
        if (!grid.enabled || !grid.snapEnabled || grid.size <= 0) {
            return value;
        }
        return Math.round(value / grid.size) * grid.size;
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

    private handleKeyboardShortcuts(event: KeyboardEvent): void {
        if (isEditorTextInputFocused()) {
            return;
        }
        if (event.repeat) {
            return;
        }
        if (event.key !== 'Delete' && event.key !== 'Del') {
            return;
        }
        if (this.deleteSelectedNpc()) {
            event.preventDefault();
        }
    }

    private attachShortcutListener(): void {
        if (this.shortcutsAttached || typeof document === 'undefined') {
            return;
        }
        document.addEventListener('keydown', this.handleShortcutKeyDown, { capture: true });
        this.shortcutsAttached = true;
    }

    private detachShortcutListener(): void {
        if (!this.shortcutsAttached || typeof document === 'undefined') {
            return;
        }
        document.removeEventListener('keydown', this.handleShortcutKeyDown, { capture: true });
        this.shortcutsAttached = false;
    }

    private deleteSelectedNpc(): boolean {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const selectedNpcId = this.selectedNpcId?.trim() ?? '';
        if (!runtimeConfig || !this.legacyObjectAdapter || !selectedNpcId) {
            return false;
        }
        const deletedIndex = runtimeConfig.npcs.findIndex((entry) => entry.id === selectedNpcId);
        if (deletedIndex < 0) {
            return false;
        }
        const nextConfig = JSON.parse(JSON.stringify(runtimeConfig)) as TestWorldConfig;
        nextConfig.npcs = nextConfig.npcs.filter((entry) => entry.id !== selectedNpcId);
        if (nextConfig.logic?.bindings) {
            nextConfig.logic.bindings = nextConfig.logic.bindings.filter((binding) => {
                return !(binding.targetType === 'npc' && binding.targetId === selectedNpcId);
            });
        }
        const importResult = this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        if (!importResult?.success) {
            return false;
        }
        this.npcPositionDraftById.delete(selectedNpcId);
        this.npcLogicBindingCreateError = null;
        this.resetNpcLogicBindingCreateForm();
        const nextNpcs = nextConfig.npcs;
        const nextIndex = deletedIndex >= nextNpcs.length ? nextNpcs.length - 1 : deletedIndex;
        this.selectedNpcId = nextIndex >= 0 ? nextNpcs[nextIndex]?.id ?? null : null;
        this.syncSelectionOutline();
        this.onUiChanged();
        return true;
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

    private makeLabeledInput(label: string, input: HTMLElement): HTMLDivElement {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gap = '2px';
        row.appendChild(this.makeInfoLine(label));
        input.style.width = '100%';
        row.appendChild(input);
        return row;
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
