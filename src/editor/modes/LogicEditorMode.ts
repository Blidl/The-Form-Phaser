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
    getAllLogicScriptAssets,
    getLogicScriptRegistryVersion,
    reloadExternalLogicScripts
} from '../../game/world/runtime/logic_script_registry';
import {
    bindEditorInputKeyboardGuards,
    makeInfoLine,
    makeSectionTitle,
    makeSpacer,
    type LogicEditorDomHelpers
} from './logic/LogicEditorDom';
import {
    renderExternalScriptsSection
} from './logic/LogicEditorRenderExternalScripts';
import {
    renderEmbeddedScriptsSection
} from './logic/LogicEditorRenderEmbeddedScripts';
import {
    renderScriptDetailsSection
} from './logic/LogicEditorRenderDetails';
import {
    renderBindingsSection
} from './logic/LogicEditorRenderBindings';

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
    private readonly dom: LogicEditorDomHelpers = {
        makeSectionTitle,
        makeInfoLine,
        makeSpacer,
        bindEditorInputKeyboardGuards
    };
    private lastSnapshotSignature: string | null = null;
    private isCreateScriptFormOpen = false;
    private createScriptError: string | null = null;
    private selectedScriptId: string | null = null;
    private selectedScriptDraft: ScriptMetadataDraft | null = null;
    private selectedExternalScriptId: string | null = null;
    private updateScriptError: string | null = null;
    private addScriptRefError: string | null = null;
    private createBindingRefId: string | null = null;
    private createBindingSlotDraft = 'onStart';
    private createBindingEnabledDraft = true;
    private createBindingError: string | null = null;
    private reloadScriptsStatus: { success: boolean; message: string } | null = null;
    private logicScriptRegistryVersion = 0;
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
        this.logicScriptRegistryVersion = getLogicScriptRegistryVersion();
    }

    public enter(): void {
        this.lastSnapshotSignature = this.readSnapshotSignature();
        this.logicScriptRegistryVersion = getLogicScriptRegistryVersion();
    }

    public update(): void {
        let shouldRefreshUi = false;
        const nextSignature = this.readSnapshotSignature();
        if (nextSignature !== this.lastSnapshotSignature) {
            this.lastSnapshotSignature = nextSignature;
            shouldRefreshUi = true;
        }
        const nextRegistryVersion = getLogicScriptRegistryVersion();
        if (nextRegistryVersion !== this.logicScriptRegistryVersion) {
            this.logicScriptRegistryVersion = nextRegistryVersion;
            shouldRefreshUi = true;
        }
        if (shouldRefreshUi) {
            this.onUiChanged();
        }
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();
        const selectedScript = this.syncSelectedScript(snapshot);

        panel.setCustomContent('Logic', (container) => {
            container.appendChild(this.dom.makeInfoLine('Runtime-backed authoring overview'));
            container.appendChild(this.dom.makeSpacer(8));

            if (!snapshot) {
                container.appendChild(this.dom.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.dom.makeSectionTitle('Summary'));
            container.appendChild(this.dom.makeInfoLine(`Scripts: ${snapshot.scripts.length}`));
            container.appendChild(this.dom.makeInfoLine(`Script refs: ${snapshot.scriptRefs.length}`));
            container.appendChild(this.dom.makeInfoLine(`Bindings: ${snapshot.bindings.length}`));
            container.appendChild(this.dom.makeSpacer(8));

            const externalAssets = getAllLogicScriptAssets();
            this.syncSelectedExternalScript(externalAssets);
            const referencedScriptRefIds = new Set(snapshot.scriptRefs.map((entry) => entry.id));
            const diagnostics = this.collectRegistryDiagnostics();

            renderExternalScriptsSection(container, {
                dom: this.dom,
                levelScriptRefs: snapshot.scriptRefs,
                externalAssets,
                referencedScriptRefIds,
                diagnostics,
                selectedExternalScriptId: this.selectedExternalScriptId,
                reloadScriptsStatus: this.reloadScriptsStatus,
                addScriptRefError: this.addScriptRefError,
                createBindingRefId: this.createBindingRefId,
                createBindingSlotDraft: this.createBindingSlotDraft,
                createBindingEnabledDraft: this.createBindingEnabledDraft,
                createBindingError: this.createBindingError,
                onStartCreateBindingForRef: (scriptRefId) => {
                    this.createBindingRefId = scriptRefId;
                    this.createBindingSlotDraft = 'onStart';
                    this.createBindingEnabledDraft = true;
                    this.createBindingError = null;
                    this.onUiChanged();
                },
                onCreateBindingSlotDraftChanged: (value) => {
                    this.createBindingSlotDraft = value;
                },
                onCreateBindingEnabledDraftChanged: (enabled) => {
                    this.createBindingEnabledDraft = enabled;
                },
                onCreateBindingForRef: (scriptRefId) => {
                    try {
                        const result = this.logicAuthoringService.createBinding({
                            targetType: 'world',
                            slot: this.createBindingSlotDraft,
                            scriptId: scriptRefId,
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
                },
                onCancelCreateBindingForRef: () => {
                    this.createBindingRefId = null;
                    this.createBindingSlotDraft = 'onStart';
                    this.createBindingEnabledDraft = true;
                    this.createBindingError = null;
                    this.onUiChanged();
                },
                onSelectExternalScript: (scriptId) => {
                    if (this.selectedExternalScriptId === scriptId) {
                        return;
                    }
                    this.selectedExternalScriptId = scriptId;
                    this.onUiChanged();
                },
                onAddScriptRefToLevel: (script) => {
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
                },
                onReloadScripts: () => {
                    void reloadExternalLogicScripts()
                        .then((result) => {
                            this.logicScriptRegistryVersion = getLogicScriptRegistryVersion();
                            this.reloadScriptsStatus = {
                                success: result.success,
                                message: result.message
                            };
                            this.onUiChanged();
                        })
                        .catch((error) => {
                            this.reloadScriptsStatus = {
                                success: false,
                                message: error instanceof Error
                                    ? error.message
                                    : 'Failed to reload external scripts.'
                            };
                            this.onUiChanged();
                        });
                }
            });

            renderEmbeddedScriptsSection(container, {
                dom: this.dom,
                scripts: snapshot.scripts,
                selectedScript,
                selectedScriptId: this.selectedScriptId,
                selectedScriptDraft: this.selectedScriptDraft,
                scriptCategoryOptions: this.scriptCategoryOptions,
                isCreateScriptFormOpen: this.isCreateScriptFormOpen,
                createScriptError: this.createScriptError,
                updateScriptError: this.updateScriptError,
                onOpenCreateScriptForm: () => {
                    this.isCreateScriptFormOpen = true;
                    this.createScriptError = null;
                    this.onUiChanged();
                },
                onCreateScript: (name, category) => {
                    try {
                        const result = this.logicAuthoringService.createScript({
                            name,
                            category,
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
                },
                onCancelCreateScriptForm: () => {
                    this.isCreateScriptFormOpen = false;
                    this.createScriptError = null;
                    this.onUiChanged();
                },
                onSelectScript: (script) => {
                    if (this.selectedScriptId === script.id) {
                        return;
                    }
                    this.selectedScriptId = script.id;
                    this.loadSelectedScriptDraft(script);
                    this.updateScriptError = null;
                    this.onUiChanged();
                },
                onSelectedScriptNameChanged: (value) => {
                    if (!this.selectedScriptDraft) {
                        return;
                    }
                    this.selectedScriptDraft.name = value;
                },
                onSelectedScriptCategoryChanged: (value) => {
                    if (!this.selectedScriptDraft) {
                        return;
                    }
                    this.selectedScriptDraft.category = value;
                },
                onSelectedScriptLockedChanged: (value) => {
                    if (!this.selectedScriptDraft) {
                        return;
                    }
                    this.selectedScriptDraft.locked = value;
                },
                onApplySelectedScriptChanges: () => {
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
                },
                onRevertSelectedScriptChanges: () => {
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
                }
            });
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();
        const selectedBinding = this.syncSelectedBinding(snapshot);
        const selectedExternalScript = this.syncSelectedExternalScript(getAllLogicScriptAssets());

        panel.setCustomContent('Logic Bindings', (container) => {
            if (!snapshot) {
                container.appendChild(this.dom.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            renderScriptDetailsSection(container, {
                dom: this.dom,
                selectedExternalScript,
                bindings: snapshot.bindings
            });

            renderBindingsSection(container, {
                dom: this.dom,
                bindings: snapshot.bindings,
                selectedBinding,
                selectedBindingId: this.selectedBindingId,
                selectedBindingDraft: this.selectedBindingDraft,
                updateBindingError: this.updateBindingError,
                onSelectBinding: (binding) => {
                    if (this.selectedBindingId === binding.id) {
                        return;
                    }
                    this.selectedBindingId = binding.id;
                    this.loadSelectedBindingDraft(binding);
                    this.updateBindingError = null;
                    this.onUiChanged();
                },
                onSelectedBindingSlotChanged: (value) => {
                    if (!this.selectedBindingDraft) {
                        return;
                    }
                    this.selectedBindingDraft.slot = value;
                },
                onSelectedBindingEnabledChanged: (value) => {
                    if (!this.selectedBindingDraft) {
                        return;
                    }
                    this.selectedBindingDraft.enabled = value;
                },
                onApplySelectedBindingChanges: () => {
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
                },
                onRevertSelectedBindingChanges: () => {
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
                },
                onDeleteSelectedBinding: () => {
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
                }
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

    private collectRegistryDiagnostics(): {
        code: string;
        message: string;
        scriptId?: string;
        commandId?: string;
        path?: string;
    }[] {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig) {
            return [];
        }
        return collectTestWorldLogicDiagnosticsWithRegistry(runtimeConfig).map((entry) => ({
            code: entry.code,
            message: entry.message,
            scriptId: entry.scriptId,
            commandId: entry.commandId,
            path: entry.path
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

    private syncSelectedExternalScript(externalAssets: TestWorldLogicScriptConfig[]): TestWorldLogicScriptConfig | null {
        if (!this.selectedExternalScriptId) {
            return null;
        }
        const selectedScript = externalAssets.find((entry) => entry.id === this.selectedExternalScriptId);
        if (!selectedScript) {
            this.selectedExternalScriptId = null;
            return null;
        }
        return selectedScript;
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
}
