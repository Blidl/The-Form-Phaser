import type { TestWorldEditorObjectType } from './test_world_editor_adapters';
import { applyDomAnchorLayout, TEST_EDITOR_SIDEBAR_LAYOUT } from '../../../ui/runtime/test_hud_layout';

export interface TestWorldEditorSidebarObjectItem {
    id: string;
    label: string;
    type: string;
    locked: boolean;
    selected: boolean;
}

export interface TestWorldEditorSidebarSequenceItem {
    id: string;
    actionCount: number;
    selected: boolean;
}

export interface TestWorldEditorSidebarSequenceActionItem {
    index: number;
    label: string;
    selected: boolean;
}

export interface TestWorldEditorSidebarCutsceneItem {
    id: string;
    mode: 'in_level' | 'overlay';
    stepCount: number;
    selected: boolean;
}

export interface TestWorldEditorSidebarCutsceneStepItem {
    index: number;
    label: string;
    selected: boolean;
}

export interface TestWorldEditorSidebarTriggerItem {
    id: string;
    label: string;
    selected: boolean;
}

export interface TestWorldEditorSidebarRuleItem {
    id: string;
    label: string;
    selected: boolean;
}

export interface TestWorldEditorSidebarFieldOption {
    value: string;
    label: string;
}

export interface TestWorldEditorSidebarField {
    key: string;
    label: string;
    input: 'number' | 'text' | 'textarea' | 'color' | 'select' | 'checkbox';
    value: string | number | boolean;
    min?: number;
    step?: number;
    options?: TestWorldEditorSidebarFieldOption[];
}

export interface TestWorldEditorSidebarSection {
    title: string;
    fields: TestWorldEditorSidebarField[];
    actions?: ReadonlyArray<{
        id: string;
        label: string;
    }>;
}

export interface TestWorldEditorSidebarState {
    visible: boolean;
    search: string;
    status: string;
    canUndo: boolean;
    canRedo: boolean;
    levelId: string;
    pendingPlacementType: TestWorldEditorObjectType | null;
    levelSections: TestWorldEditorSidebarSection[];
    backgroundSections: TestWorldEditorSidebarSection[];
    palette: ReadonlyArray<{ type: TestWorldEditorObjectType; label: string }>;
    objectItems: TestWorldEditorSidebarObjectItem[];
    npcItems: TestWorldEditorSidebarObjectItem[];
    inspectorId: string | null;
    inspectorType: string | null;
    inspectorSections: TestWorldEditorSidebarSection[];
    npcInspectorId: string | null;
    npcInspectorSections: TestWorldEditorSidebarSection[];
    sequenceItems: TestWorldEditorSidebarSequenceItem[];
    sequenceInspectorId: string | null;
    sequenceSections: TestWorldEditorSidebarSection[];
    sequenceActionItems: TestWorldEditorSidebarSequenceActionItem[];
    sequenceActionIndex: number;
    sequenceActionSections: TestWorldEditorSidebarSection[];
    cutsceneItems: TestWorldEditorSidebarCutsceneItem[];
    cutsceneInspectorId: string | null;
    cutsceneSections: TestWorldEditorSidebarSection[];
    cutsceneStepItems: TestWorldEditorSidebarCutsceneStepItem[];
    cutsceneStepIndex: number;
    cutsceneStepSections: TestWorldEditorSidebarSection[];
    logicTab: TestWorldEditorLogicTabId;
    logicTriggerItems: TestWorldEditorSidebarTriggerItem[];
    logicTriggerId: string | null;
    logicTriggerSections: TestWorldEditorSidebarSection[];
    logicRuleItems: TestWorldEditorSidebarRuleItem[];
    logicRuleId: string | null;
    logicRuleSections: TestWorldEditorSidebarSection[];
    logicFlagsSections: TestWorldEditorSidebarSection[];
    selectedLocked: boolean;
}

export interface TestWorldEditorSidebarCallbacks {
    onSaveDraft: () => void;
    onCreateLevel: () => void;
    onDeleteLevel: () => void;
    onExportJson: () => void;
    onImportJson: (jsonText: string) => void;
    onResetDefault: () => void;
    onClearSavedDraft: () => void;
    onSaveSequenceDraft: () => void;
    onExportSequencesJson: () => void;
    onImportSequencesJson: (jsonText: string) => void;
    onResetSequencesDefault: () => void;
    onClearSavedSequenceDraft: () => void;
    onSaveCutsceneDraft: () => void;
    onExportCutscenesJson: () => void;
    onImportCutscenesJson: (jsonText: string) => void;
    onResetCutscenesDefault: () => void;
    onClearSavedCutsceneDraft: () => void;
    onCreateObject: (type: TestWorldEditorObjectType) => void;
    onSearchChange: (search: string) => void;
    onSelectObject: (id: string) => void;
    onDuplicateSelected: () => void;
    onDeleteSelected: () => void;
    onCreateSequence: () => void;
    onSelectSequence: (id: string) => void;
    onDeleteSelectedSequence: () => void;
    onCreateSequenceAction: () => void;
    onSelectSequenceAction: (index: number) => void;
    onDeleteSelectedSequenceAction: () => void;
    onMoveSelectedSequenceAction: (direction: -1 | 1) => void;
    onCreateCutscene: () => void;
    onSelectCutscene: (id: string) => void;
    onDeleteSelectedCutscene: () => void;
    onCreateCutsceneStep: () => void;
    onSelectCutsceneStep: (index: number) => void;
    onDeleteSelectedCutsceneStep: () => void;
    onMoveSelectedCutsceneStep: (direction: -1 | 1) => void;
    onToggleSelectedLock: () => void;
    onLevelFieldChange: (key: string, value: string | number | boolean) => void;
    onInspectorFieldChange: (key: string, value: string | number | boolean) => void;
    onInspectorAction: (actionId: string) => void;
    onSequenceFieldChange: (key: string, value: string | number | boolean) => void;
    onSequenceActionFieldChange: (key: string, value: string | number | boolean) => void;
    onCutsceneFieldChange: (key: string, value: string | number | boolean) => void;
    onCutsceneStepFieldChange: (key: string, value: string | number | boolean) => void;
    onTabChanged: (tabId: TestWorldEditorTabId) => void;
    onLogicTabChanged: (tabId: TestWorldEditorLogicTabId) => void;
    onSelectLogicTrigger: (id: string) => void;
    onSelectLogicRule: (id: string) => void;
}

type TestWorldEditorTabId = 'level' | 'background' | 'objects' | 'npc' | 'sequences' | 'cutscenes' | 'inspector' | 'logic';
type TestWorldEditorLogicTabId = 'triggers' | 'rules' | 'cutscenes' | 'npc_behavior' | 'flags';
export type { TestWorldEditorTabId };
export type { TestWorldEditorLogicTabId };

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const toColorInputValue = (value: string | number | boolean): string => {
    const numericValue = typeof value === 'number' ? Math.max(0, Math.min(0xffffff, Math.round(value))) : 0;
    return `#${numericValue.toString(16).padStart(6, '0')}`;
};

const buildFieldMarkup = (field: TestWorldEditorSidebarField, attributeName: string): string => {
    const baseAttributes = `${attributeName}="${escapeHtml(field.key)}"`;
    if (field.input === 'checkbox') {
        return `
            <label class="test-world-editor__field test-world-editor__field--checkbox">
                <span>${escapeHtml(field.label)}</span>
                <input type="checkbox" ${baseAttributes} ${field.value ? 'checked' : ''} />
            </label>
        `;
    }

    if (field.input === 'select') {
        const optionsMarkup = (field.options ?? []).map((option) => {
            const selected = String(field.value) === option.value ? 'selected' : '';
            return `<option value="${escapeHtml(option.value)}" ${selected}>${escapeHtml(option.label)}</option>`;
        }).join('');

        return `
            <label class="test-world-editor__field">
                <span>${escapeHtml(field.label)}</span>
                <select ${baseAttributes}>${optionsMarkup}</select>
            </label>
        `;
    }

    if (field.input === 'color') {
        return `
            <label class="test-world-editor__field">
                <span>${escapeHtml(field.label)}</span>
                <input type="color" value="${toColorInputValue(field.value)}" ${baseAttributes} />
            </label>
        `;
    }

    if (field.input === 'textarea') {
        const value = escapeHtml(String(field.value));
        return `
            <label class="test-world-editor__field">
                <span>${escapeHtml(field.label)}</span>
                <textarea ${baseAttributes} rows="4">${value}</textarea>
            </label>
        `;
    }

    const type = field.input === 'number' ? 'number' : 'text';
    const min = typeof field.min === 'number' ? `min="${field.min}"` : '';
    const step = typeof field.step === 'number' ? `step="${field.step}"` : '';
    const value = escapeHtml(String(field.value));
    return `
        <label class="test-world-editor__field">
            <span>${escapeHtml(field.label)}</span>
            <input type="${type}" value="${value}" ${baseAttributes} ${min} ${step} />
        </label>
    `;
};

export class TestWorldEditorSidebar {
    private readonly root: HTMLDivElement;
    private readonly fileInput: HTMLInputElement;
    private state: TestWorldEditorSidebarState;
    private readonly collapsedSectionKeys = new Set<string>();
    private activeTab: TestWorldEditorTabId = 'level';
    private activeLogicTab: TestWorldEditorLogicTabId = 'triggers';
    private lastLogicConsoleMarkerKey: string | null = null;
    private pendingImportMode: 'world' | 'sequence' | 'cutscene' = 'world';
    private pendingScrollRestore: { inner: number; list: number } | null = null;
    private pendingFocusRestore: { selector: string; selectionStart: number | null; selectionEnd: number | null } | null = null;

    public constructor(
        parent: HTMLElement,
        private readonly callbacks: TestWorldEditorSidebarCallbacks
    ) {
        this.root = document.createElement('div');
        this.root.id = 'test-world-editor-sidebar';
        this.root.className = 'test-world-editor test-world-editor--hidden';
        this.root.style.position = 'absolute';
        applyDomAnchorLayout(this.root, TEST_EDITOR_SIDEBAR_LAYOUT);
        parent.appendChild(this.root);

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'application/json,.json';
        this.fileInput.hidden = true;
        this.fileInput.addEventListener('change', () => {
            const file = this.fileInput.files?.[0];
            if (!file) {
                return;
            }

            void file.text().then((jsonText) => {
                if (this.pendingImportMode === 'sequence') {
                    this.callbacks.onImportSequencesJson(jsonText);
                } else if (this.pendingImportMode === 'cutscene') {
                    this.callbacks.onImportCutscenesJson(jsonText);
                } else {
                    this.callbacks.onImportJson(jsonText);
                }
                this.fileInput.value = '';
                this.pendingImportMode = 'world';
            });
        });
        this.root.appendChild(this.fileInput);

        this.state = {
            visible: false,
            search: '',
            status: '',
            canUndo: false,
            canRedo: false,
            levelId: '',
            pendingPlacementType: null,
            levelSections: [],
            backgroundSections: [],
            palette: [],
            objectItems: [],
            npcItems: [],
            inspectorId: null,
            inspectorType: null,
            inspectorSections: [],
            npcInspectorId: null,
            npcInspectorSections: [],
            sequenceItems: [],
            sequenceInspectorId: null,
            sequenceSections: [],
            sequenceActionItems: [],
            sequenceActionIndex: -1,
            sequenceActionSections: [],
            cutsceneItems: [],
            cutsceneInspectorId: null,
            cutsceneSections: [],
            cutsceneStepItems: [],
            cutsceneStepIndex: -1,
            cutsceneStepSections: [],
            logicTab: 'triggers',
            logicTriggerItems: [],
            logicTriggerId: null,
            logicTriggerSections: [],
            logicRuleItems: [],
            logicRuleId: null,
            logicRuleSections: [],
            logicFlagsSections: [],
            selectedLocked: false
        };
        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('change', this.handleChange);
        this.root.addEventListener('input', this.handleInput);
        this.root.addEventListener('keydown', this.handleKeyboardEvent, true);
        this.root.addEventListener('keyup', this.handleKeyboardEvent, true);
        this.root.addEventListener('keypress', this.handleKeyboardEvent, true);
        this.render();
    }

    public setState(nextState: TestWorldEditorSidebarState): void {
        this.captureScrollPosition();
        this.captureFocusedField();
        this.state = nextState;
        this.activeLogicTab = nextState.logicTab;
        applyDomAnchorLayout(this.root, TEST_EDITOR_SIDEBAR_LAYOUT);
        this.render();
    }

    public destroy(): void {
        this.root.removeEventListener('click', this.handleClick);
        this.root.removeEventListener('change', this.handleChange);
        this.root.removeEventListener('input', this.handleInput);
        this.root.removeEventListener('keydown', this.handleKeyboardEvent, true);
        this.root.removeEventListener('keyup', this.handleKeyboardEvent, true);
        this.root.removeEventListener('keypress', this.handleKeyboardEvent, true);
        this.root.remove();
    }

    private readonly handleClick = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        const toggleSectionKey = target?.closest<HTMLElement>('[data-editor-toggle-section]')?.dataset.editorToggleSection;
        if (toggleSectionKey) {
            this.captureScrollPosition();
            this.captureFocusedField();
            if (this.collapsedSectionKeys.has(toggleSectionKey)) {
                this.collapsedSectionKeys.delete(toggleSectionKey);
            } else {
                this.collapsedSectionKeys.add(toggleSectionKey);
            }
            this.render();
            return;
        }

        const action = target?.closest<HTMLElement>('[data-editor-action]')?.dataset.editorAction;
        if (action) {
            if (action === 'save-draft') {
                this.callbacks.onSaveDraft();
                return;
            }
            if (action === 'create-level') {
                this.callbacks.onCreateLevel();
                return;
            }
            if (action === 'delete-level') {
                this.callbacks.onDeleteLevel();
                return;
            }
            if (action === 'export-json') {
                this.callbacks.onExportJson();
                return;
            }
            if (action === 'import-json') {
                this.pendingImportMode = 'world';
                this.fileInput.click();
                return;
            }
            if (action === 'save-sequence-draft') {
                this.callbacks.onSaveSequenceDraft();
                return;
            }
            if (action === 'export-sequences-json') {
                this.callbacks.onExportSequencesJson();
                return;
            }
            if (action === 'import-sequences-json') {
                this.pendingImportMode = 'sequence';
                this.fileInput.click();
                return;
            }
            if (action === 'reset-sequences-default') {
                this.callbacks.onResetSequencesDefault();
                return;
            }
            if (action === 'clear-sequence-draft') {
                this.callbacks.onClearSavedSequenceDraft();
                return;
            }
            if (action === 'save-cutscene-draft') {
                this.callbacks.onSaveCutsceneDraft();
                return;
            }
            if (action === 'export-cutscenes-json') {
                this.callbacks.onExportCutscenesJson();
                return;
            }
            if (action === 'import-cutscenes-json') {
                this.pendingImportMode = 'cutscene';
                this.fileInput.click();
                return;
            }
            if (action === 'reset-cutscenes-default') {
                this.callbacks.onResetCutscenesDefault();
                return;
            }
            if (action === 'clear-cutscene-draft') {
                this.callbacks.onClearSavedCutsceneDraft();
                return;
            }
            if (action === 'reset-default') {
                this.callbacks.onResetDefault();
                return;
            }
            if (action === 'clear-draft') {
                this.callbacks.onClearSavedDraft();
                return;
            }
            if (action === 'duplicate-selected') {
                this.callbacks.onDuplicateSelected();
                return;
            }
            if (action === 'delete-selected') {
                this.callbacks.onDeleteSelected();
                return;
            }
            if (action === 'create-sequence') {
                this.callbacks.onCreateSequence();
                return;
            }
            if (action === 'delete-selected-sequence') {
                this.callbacks.onDeleteSelectedSequence();
                return;
            }
            if (action === 'create-sequence-action') {
                this.callbacks.onCreateSequenceAction();
                return;
            }
            if (action === 'delete-selected-sequence-action') {
                this.callbacks.onDeleteSelectedSequenceAction();
                return;
            }
            if (action === 'move-sequence-action-up') {
                this.callbacks.onMoveSelectedSequenceAction(-1);
                return;
            }
            if (action === 'move-sequence-action-down') {
                this.callbacks.onMoveSelectedSequenceAction(1);
                return;
            }
            if (action === 'create-cutscene') {
                this.callbacks.onCreateCutscene();
                return;
            }
            if (action === 'delete-selected-cutscene') {
                this.callbacks.onDeleteSelectedCutscene();
                return;
            }
            if (action === 'create-cutscene-step') {
                this.callbacks.onCreateCutsceneStep();
                return;
            }
            if (action === 'move-cutscene-step-up') {
                this.callbacks.onMoveSelectedCutsceneStep(-1);
                return;
            }
            if (action === 'move-cutscene-step-down') {
                this.callbacks.onMoveSelectedCutsceneStep(1);
                return;
            }
            if (action === 'delete-selected-cutscene-step') {
                this.callbacks.onDeleteSelectedCutsceneStep();
                return;
            }
            if (action === 'toggle-selected-lock') {
                this.callbacks.onToggleSelectedLock();
                return;
            }
        }

        const inspectorAction = target?.closest<HTMLElement>('[data-editor-inspector-action]')?.dataset.editorInspectorAction;
        if (inspectorAction) {
            this.callbacks.onInspectorAction(inspectorAction);
            return;
        }

        const paletteType = target?.closest<HTMLElement>('[data-editor-palette-type]')?.dataset.editorPaletteType;
        if (paletteType) {
            this.activeTab = 'objects';
            this.callbacks.onTabChanged(this.activeTab);
            this.callbacks.onCreateObject(paletteType as TestWorldEditorObjectType);
            return;
        }

        const objectId = target?.closest<HTMLElement>('[data-editor-object-id]')?.dataset.editorObjectId;
        if (objectId) {
            this.callbacks.onSelectObject(objectId);
            return;
        }

        const sequenceId = target?.closest<HTMLElement>('[data-editor-sequence-id]')?.dataset.editorSequenceId;
        if (sequenceId) {
            this.callbacks.onSelectSequence(sequenceId);
            return;
        }

        const sequenceActionIndexValue = target?.closest<HTMLElement>('[data-editor-sequence-action-index]')?.dataset.editorSequenceActionIndex;
        if (sequenceActionIndexValue !== undefined) {
            this.callbacks.onSelectSequenceAction(Number(sequenceActionIndexValue));
            return;
        }

        const cutsceneId = target?.closest<HTMLElement>('[data-editor-cutscene-id]')?.dataset.editorCutsceneId;
        if (cutsceneId) {
            this.callbacks.onSelectCutscene(cutsceneId);
            return;
        }

        const cutsceneStepIndexValue = target?.closest<HTMLElement>('[data-editor-cutscene-step-index]')?.dataset.editorCutsceneStepIndex;
        if (cutsceneStepIndexValue !== undefined) {
            this.callbacks.onSelectCutsceneStep(Number(cutsceneStepIndexValue));
            return;
        }

        const logicTriggerId = target?.closest<HTMLElement>('[data-editor-logic-trigger-id]')?.dataset.editorLogicTriggerId;
        if (logicTriggerId) {
            this.activeTab = 'logic';
            this.activeLogicTab = 'triggers';
            this.callbacks.onTabChanged(this.activeTab);
            this.callbacks.onLogicTabChanged(this.activeLogicTab);
            this.callbacks.onSelectLogicTrigger(logicTriggerId);
            return;
        }

        const logicRuleId = target?.closest<HTMLElement>('[data-editor-logic-rule-id]')?.dataset.editorLogicRuleId;
        if (logicRuleId) {
            this.activeTab = 'logic';
            this.activeLogicTab = 'rules';
            this.callbacks.onTabChanged(this.activeTab);
            this.callbacks.onLogicTabChanged(this.activeLogicTab);
            this.callbacks.onSelectLogicRule(logicRuleId);
            return;
        }

        const logicTabId = target?.closest<HTMLElement>('[data-editor-logic-tab]')?.dataset.editorLogicTab as TestWorldEditorLogicTabId | undefined;
        if (logicTabId) {
            const nextLogicTab = logicTabId;
            console.info(`[editor] Logic subtab clicked: ${nextLogicTab}`);
            this.activeTab = 'logic';
            this.activeLogicTab = nextLogicTab;
            this.callbacks.onTabChanged(this.activeTab);
            this.callbacks.onLogicTabChanged(nextLogicTab);
            this.render();
            return;
        }

        const tabId = target?.closest<HTMLElement>('[data-editor-tab]')?.dataset.editorTab as TestWorldEditorTabId | undefined;
        if (tabId) {
            this.activeTab = tabId;
            this.callbacks.onTabChanged(this.activeTab);
            this.render();
        }
    };

    private readonly handleChange = (event: Event): void => {
        this.handleFieldEvent(event, false);
    };

    private readonly handleInput = (event: Event): void => {
        this.handleFieldEvent(event, true);
    };

    private readonly handleKeyboardEvent = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }

        const isEditorTextInput = target instanceof HTMLInputElement
            || target instanceof HTMLTextAreaElement
            || target instanceof HTMLSelectElement
            || target.isContentEditable;
        if (!isEditorTextInput) {
            return;
        }

        event.stopPropagation();
    };

    private handleFieldEvent(event: Event, fromInput: boolean): void {
        const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!target) {
            return;
        }

        if (target.matches('[data-editor-search]')) {
            if (!fromInput && !(target instanceof HTMLInputElement)) {
                return;
            }
            this.callbacks.onSearchChange(target.value);
            return;
        }

        const fieldKey = target.dataset.editorField;
        const levelFieldKey = target.dataset.editorLevelField;
        const sequenceFieldKey = target.dataset.editorSequenceField;
        const sequenceActionFieldKey = target.dataset.editorSequenceActionField;
        const cutsceneFieldKey = target.dataset.editorCutsceneField;
        const cutsceneStepFieldKey = target.dataset.editorCutsceneStepField;

        if (!fieldKey && !levelFieldKey && !sequenceFieldKey && !sequenceActionFieldKey && !cutsceneFieldKey && !cutsceneStepFieldKey) {
            return;
        }

        if (fromInput && target instanceof HTMLSelectElement) {
            return;
        }
        if (fromInput && target instanceof HTMLInputElement && target.type === 'checkbox') {
            return;
        }
        if (
            fromInput
            && (sequenceFieldKey || sequenceActionFieldKey || cutsceneFieldKey || cutsceneStepFieldKey)
            && (
                target instanceof HTMLTextAreaElement
                || (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number'))
            )
        ) {
            return;
        }

        const callback = levelFieldKey
            ? this.callbacks.onLevelFieldChange
            : (sequenceFieldKey
                ? this.callbacks.onSequenceFieldChange
                : (sequenceActionFieldKey
                    ? this.callbacks.onSequenceActionFieldChange
                    : (cutsceneFieldKey
                        ? this.callbacks.onCutsceneFieldChange
                        : (cutsceneStepFieldKey
                            ? this.callbacks.onCutsceneStepFieldChange
                            : this.callbacks.onInspectorFieldChange))));
        const resolvedFieldKey = levelFieldKey ?? sequenceFieldKey ?? sequenceActionFieldKey ?? cutsceneFieldKey ?? cutsceneStepFieldKey ?? fieldKey;

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            callback(resolvedFieldKey, target.checked);
            return;
        }
        if (target instanceof HTMLInputElement && target.type === 'color') {
            callback(resolvedFieldKey, Number.parseInt(target.value.slice(1), 16));
            return;
        }
        if (target instanceof HTMLInputElement && target.type === 'number') {
            callback(resolvedFieldKey, Number(target.value));
            return;
        }

        callback(resolvedFieldKey, target.value);
    }

    private captureScrollPosition(): void {
        const inner = this.root.querySelector<HTMLElement>('.test-world-editor__inner');
        const list = this.root.querySelector<HTMLElement>('.test-world-editor__list');
        this.pendingScrollRestore = {
            inner: inner?.scrollTop ?? 0,
            list: list?.scrollTop ?? 0
        };
    }

    private captureFocusedField(): void {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement) || !this.root.contains(activeElement)) {
            this.pendingFocusRestore = null;
            return;
        }

        if (activeElement.matches('[data-editor-search]')) {
            this.pendingFocusRestore = {
                selector: '[data-editor-search]',
                selectionStart: activeElement instanceof HTMLInputElement ? activeElement.selectionStart : null,
                selectionEnd: activeElement instanceof HTMLInputElement ? activeElement.selectionEnd : null
            };
            return;
        }

        const inputElement = activeElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const fieldKey = inputElement.dataset.editorField;
        if (fieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-field="${fieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        const levelFieldKey = inputElement.dataset.editorLevelField;
        if (levelFieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-level-field="${levelFieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        const sequenceFieldKey = inputElement.dataset.editorSequenceField;
        if (sequenceFieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-sequence-field="${sequenceFieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        const sequenceActionFieldKey = inputElement.dataset.editorSequenceActionField;
        if (sequenceActionFieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-sequence-action-field="${sequenceActionFieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        const cutsceneFieldKey = inputElement.dataset.editorCutsceneField;
        if (cutsceneFieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-cutscene-field="${cutsceneFieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        const cutsceneStepFieldKey = inputElement.dataset.editorCutsceneStepField;
        if (cutsceneStepFieldKey) {
            this.pendingFocusRestore = {
                selector: `[data-editor-cutscene-step-field="${cutsceneStepFieldKey}"]`,
                selectionStart: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionStart
                    : null,
                selectionEnd: activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
                    ? activeElement.selectionEnd
                    : null
            };
            return;
        }

        this.pendingFocusRestore = null;
    }

    private restoreScrollPosition(): void {
        if (!this.pendingScrollRestore) {
            return;
        }

        const inner = this.root.querySelector<HTMLElement>('.test-world-editor__inner');
        if (inner) {
            inner.scrollTop = this.pendingScrollRestore.inner;
        }

        const list = this.root.querySelector<HTMLElement>('.test-world-editor__list');
        if (list) {
            list.scrollTop = this.pendingScrollRestore.list;
        }

        this.pendingScrollRestore = null;
    }

    private restoreFocusedField(): void {
        if (!this.pendingFocusRestore) {
            return;
        }

        const target = this.root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(this.pendingFocusRestore.selector);
        if (target) {
            target.focus({ preventScroll: true });
            if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
                && this.pendingFocusRestore.selectionStart !== null
                && this.pendingFocusRestore.selectionEnd !== null) {
                target.setSelectionRange(this.pendingFocusRestore.selectionStart, this.pendingFocusRestore.selectionEnd);
            }
        }

        this.pendingFocusRestore = null;
    }

    private render(): void {
        const state = this.state;
        this.root.classList.toggle('test-world-editor--hidden', !state.visible);
        if (this.activeTab === 'background' && state.backgroundSections.length === 0) {
            this.activeTab = 'level';
            this.callbacks.onTabChanged(this.activeTab);
        }
        const buildTabButton = (tabId: TestWorldEditorTabId, label: string): string => {
            const className = tabId === this.activeTab
                ? 'test-world-editor__button is-active'
                : 'test-world-editor__button';
            return `<button type="button" class="${className}" data-editor-tab="${tabId}">${escapeHtml(label)}</button>`;
        };

        const renderCollapsibleSections = (
            sections: TestWorldEditorSidebarSection[],
            attributeName: string,
            groupKey: string
        ): string => {
            return sections.map((section, sectionIndex) => {
                const sectionKey = `${this.activeTab}:${groupKey}:${sectionIndex}:${section.title}`;
                const collapsed = this.collapsedSectionKeys.has(sectionKey);
                return `
                    <section class="test-world-editor__section">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                            <h3 style="margin:0;">${escapeHtml(section.title)}</h3>
                            <button type="button" class="test-world-editor__button" data-editor-toggle-section="${escapeHtml(sectionKey)}">
                                ${collapsed ? 'Expand' : 'Collapse'}
                            </button>
                        </div>
                        ${collapsed ? '' : `
                            <div class="test-world-editor__fields">
                                ${section.fields.map((field) => buildFieldMarkup(field, attributeName)).join('')}
                            </div>
                            ${(section.actions && section.actions.length > 0) ? `
                                <div class="test-world-editor__toolbar">
                                    ${section.actions.map((action) => (
                                        `<button type="button" class="test-world-editor__button" data-editor-inspector-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`
                                    )).join('')}
                                </div>
                            ` : ''}
                        `}
                    </section>
                `;
            }).join('');
        };

        const paletteMarkup = state.palette.map((entry) => {
            const className = entry.type === state.pendingPlacementType
                ? 'test-world-editor__button is-active'
                : 'test-world-editor__button';
            return `<button type="button" class="${className}" data-editor-palette-type="${entry.type}">${escapeHtml(entry.label)}</button>`;
        }).join('');

        const objectMarkup = state.objectItems.map((entry) => {
            const classes = [
                'test-world-editor__list-item',
                entry.selected ? 'is-selected' : '',
                entry.locked ? 'is-locked' : ''
            ].filter(Boolean).join(' ');
            return `
                <button type="button" class="${classes}" data-editor-object-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>${escapeHtml(entry.type)}${entry.locked ? ' locked' : ''}</small>
                </button>
            `;
        }).join('');
        const npcObjectMarkup = state.npcItems.map((entry) => {
            const classes = [
                'test-world-editor__list-item',
                entry.selected ? 'is-selected' : '',
                entry.locked ? 'is-locked' : ''
            ].filter(Boolean).join(' ');
            return `
                <button type="button" class="${classes}" data-editor-object-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>${escapeHtml(entry.type)}${entry.locked ? ' locked' : ''}</small>
                </button>
            `;
        }).join('');

        const inspectorMarkup = renderCollapsibleSections(state.inspectorSections, 'data-editor-field', 'inspector');
        const npcInspectorMarkup = renderCollapsibleSections(state.npcInspectorSections, 'data-editor-field', 'npc-inspector');
        const sequenceMarkup = renderCollapsibleSections(state.sequenceSections, 'data-editor-sequence-field', 'sequence');
        const sequenceActionMarkup = renderCollapsibleSections(state.sequenceActionSections, 'data-editor-sequence-action-field', 'sequence-action');
        const cutsceneMarkup = renderCollapsibleSections(state.cutsceneSections, 'data-editor-cutscene-field', 'cutscene');
        const cutsceneStepMarkup = renderCollapsibleSections(state.cutsceneStepSections, 'data-editor-cutscene-step-field', 'cutscene-step');
        const logicTriggerMarkup = renderCollapsibleSections(state.logicTriggerSections, 'data-editor-field', 'logic-trigger');
        const logicRuleMarkup = renderCollapsibleSections(state.logicRuleSections, 'data-editor-field', 'logic-rule');
        const logicFlagsMarkup = renderCollapsibleSections(state.logicFlagsSections, 'data-editor-field', 'logic-flags');
        const levelMarkup = renderCollapsibleSections(state.levelSections, 'data-editor-level-field', 'level');
        const backgroundMarkup = renderCollapsibleSections(state.backgroundSections, 'data-editor-level-field', 'background');
        const tabBarMarkup = `
            <div class="test-world-editor__toolbar">
                ${buildTabButton('level', 'Level')}
                ${buildTabButton('background', 'Background')}
                ${buildTabButton('objects', 'Objects')}
                ${buildTabButton('npc', 'NPC')}
                ${buildTabButton('sequences', 'Sequences')}
                ${buildTabButton('cutscenes', 'Cutscenes')}
                ${buildTabButton('inspector', 'Inspector')}
                ${buildTabButton('logic', 'Logic')}
            </div>
        `;
        const levelPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Level</h3>
                <div class="test-world-editor__meta">
                    <div><strong>Current Level</strong> ${escapeHtml(state.levelId || 'None')}</div>
                </div>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="create-level">Create Level</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-level">Delete Level</button>
                </div>
                ${levelMarkup}
            </section>
        `;
        const backgroundPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Background</h3>
                ${backgroundMarkup || '<div class="test-world-editor__empty">No background settings</div>'}
            </section>
        `;
        const objectsPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Object Palette</h3>
                <div class="test-world-editor__palette">${paletteMarkup}</div>
            </section>

            <section class="test-world-editor__section">
                <h3>Objects</h3>
                <label class="test-world-editor__field">
                    <span>Search</span>
                    <input type="text" value="${escapeHtml(state.search)}" data-editor-search="true" />
                </label>
                <div class="test-world-editor__list">${objectMarkup || '<div class="test-world-editor__empty">No objects</div>'}</div>
            </section>

            <section class="test-world-editor__section">
                <h3>Actions</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="duplicate-selected">Duplicate</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected">Delete</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="toggle-selected-lock">${state.selectedLocked ? 'Unlock' : 'Lock'}</button>
                </div>
            </section>
        `;
        const inspectorPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Inspector</h3>
                <div class="test-world-editor__meta">
                    <div><strong>ID</strong> ${escapeHtml(state.inspectorId ?? 'None')}</div>
                    <div><strong>Type</strong> ${escapeHtml(state.inspectorType ?? 'None')}</div>
                </div>
                ${inspectorMarkup || '<div class="test-world-editor__empty">Nothing selected</div>'}
            </section>
        `;
        const npcPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>NPCs</h3>
                <div class="test-world-editor__meta">
                    <div><strong>ID</strong> ${escapeHtml(state.npcInspectorId ?? 'None')}</div>
                    <div><strong>Type</strong> ${escapeHtml(state.npcInspectorId ? 'npc' : 'None')}</div>
                </div>
                <div class="test-world-editor__list">${npcObjectMarkup || '<div class="test-world-editor__empty">No NPCs</div>'}</div>
                ${npcInspectorMarkup || '<div class="test-world-editor__empty">Select an NPC</div>'}
            </section>
        `;
        const sequenceItemsMarkup = state.sequenceItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-sequence-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.id)}</span>
                    <small>${entry.actionCount} action${entry.actionCount === 1 ? '' : 's'}</small>
                </button>
            `;
        }).join('');
        const sequenceActionItemsMarkup = state.sequenceActionItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-sequence-action-index="${entry.index}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>step ${entry.index + 1}</small>
                </button>
            `;
        }).join('');
        const sequencesPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Registry</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="save-sequence-draft">Save Draft</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="export-sequences-json">Export JSON</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="import-sequences-json">Import JSON</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="reset-sequences-default">Reset Default</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="clear-sequence-draft">Clear Draft</button>
                </div>
            </section>
            <section class="test-world-editor__section">
                <h3>Sequences</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="create-sequence">Create</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected-sequence">Delete</button>
                </div>
                <div class="test-world-editor__list">${sequenceItemsMarkup || '<div class="test-world-editor__empty">No sequences</div>'}</div>
                <div class="test-world-editor__meta">
                    <div><strong>ID</strong> ${escapeHtml(state.sequenceInspectorId ?? 'None')}</div>
                </div>
                ${sequenceMarkup || '<div class="test-world-editor__empty">Select a sequence</div>'}
            </section>
            <section class="test-world-editor__section">
                <h3>Actions</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="create-sequence-action">Add Action</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="move-sequence-action-up">Move Up</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="move-sequence-action-down">Move Down</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected-sequence-action">Delete Action</button>
                </div>
                <div class="test-world-editor__list">${sequenceActionItemsMarkup || '<div class="test-world-editor__empty">No actions</div>'}</div>
                <div class="test-world-editor__meta">
                    <div><strong>Selected Action</strong> ${state.sequenceActionIndex >= 0 ? String(state.sequenceActionIndex + 1) : 'None'}</div>
                </div>
                ${sequenceActionMarkup || '<div class="test-world-editor__empty">Select an action</div>'}
            </section>
        `;
        const cutsceneItemsMarkup = state.cutsceneItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-cutscene-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.id)}</span>
                    <small>${escapeHtml(entry.mode)} | ${entry.stepCount} step${entry.stepCount === 1 ? '' : 's'}</small>
                </button>
            `;
        }).join('');
        const cutsceneStepItemsMarkup = state.cutsceneStepItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-cutscene-step-index="${entry.index}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>step ${entry.index + 1}</small>
                </button>
            `;
        }).join('');
        const cutscenesPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Registry</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="save-cutscene-draft">Save Draft</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="export-cutscenes-json">Export JSON</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="import-cutscenes-json">Import JSON</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="reset-cutscenes-default">Reset Default</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="clear-cutscene-draft">Clear Draft</button>
                </div>
            </section>
            <section class="test-world-editor__section">
                <h3>Cutscenes</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="create-cutscene">Create</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected-cutscene">Delete</button>
                </div>
                <div class="test-world-editor__list">${cutsceneItemsMarkup || '<div class="test-world-editor__empty">No cutscenes</div>'}</div>
                <div class="test-world-editor__meta">
                    <div><strong>ID</strong> ${escapeHtml(state.cutsceneInspectorId ?? 'None')}</div>
                </div>
                ${cutsceneMarkup || '<div class="test-world-editor__empty">Select a cutscene</div>'}
            </section>
            <section class="test-world-editor__section">
                <h3>Steps</h3>
                <div class="test-world-editor__toolbar">
                    <button type="button" class="test-world-editor__button" data-editor-action="create-cutscene-step">Add Step</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="move-cutscene-step-up">Move Up</button>
                    <button type="button" class="test-world-editor__button" data-editor-action="move-cutscene-step-down">Move Down</button>
                    <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected-cutscene-step">Delete Step</button>
                </div>
                <div class="test-world-editor__list">${cutsceneStepItemsMarkup || '<div class="test-world-editor__empty">No steps</div>'}</div>
                <div class="test-world-editor__meta">
                    <div><strong>Selected Step</strong> ${state.cutsceneStepIndex >= 0 ? String(state.cutsceneStepIndex + 1) : 'None'}</div>
                </div>
                ${cutsceneStepMarkup || '<div class="test-world-editor__empty">Select a step</div>'}
            </section>
        `;
        const logicTriggerItemsMarkup = state.logicTriggerItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-logic-trigger-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>${escapeHtml(entry.id)}</small>
                </button>
            `;
        }).join('');
        const logicRuleItemsMarkup = state.logicRuleItems.map((entry) => {
            const className = entry.selected
                ? 'test-world-editor__list-item is-selected'
                : 'test-world-editor__list-item';
            return `
                <button type="button" class="${className}" data-editor-logic-rule-id="${escapeHtml(entry.id)}">
                    <span>${escapeHtml(entry.label)}</span>
                    <small>${escapeHtml(entry.id)}</small>
                </button>
            `;
        }).join('');
        const buildLogicTabButton = (tabId: TestWorldEditorLogicTabId, label: string): string => {
            const className = tabId === this.activeLogicTab
                ? 'test-world-editor__button is-active'
                : 'test-world-editor__button';
            return `<button type="button" class="${className}" data-editor-logic-tab="${tabId}">${escapeHtml(label)}</button>`;
        };
        const logicTriggersPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Editor / Triggers</h3>
                <div class="test-world-editor__meta">
                    <div><strong>Selected Trigger</strong> ${escapeHtml(state.logicTriggerId ?? 'None')}</div>
                </div>
            </section>
            <section class="test-world-editor__section">
                <h3>Trigger Volumes</h3>
                <div class="test-world-editor__list">${logicTriggerItemsMarkup || '<div class="test-world-editor__empty">No trigger volumes in this level</div>'}</div>
            </section>
            <section class="test-world-editor__section">
                ${logicTriggerMarkup || '<div class="test-world-editor__empty">No trigger selected. Select a trigger volume from the list.</div>'}
            </section>
        `;
        const logicCutscenesPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Editor / Cutscenes</h3>
                <div class="test-world-editor__empty">Cutscene 2.0 pending</div>
            </section>
        `;
        const logicRulesPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Editor / Rules</h3>
                <div class="test-world-editor__meta">
                    <div><strong>Selected Rule</strong> ${escapeHtml(state.logicRuleId ?? 'None')}</div>
                </div>
            </section>
            <section class="test-world-editor__section">
                <h3>World Rules</h3>
                <div class="test-world-editor__list">${logicRuleItemsMarkup || '<div class="test-world-editor__empty">No world rules in this level</div>'}</div>
            </section>
            <section class="test-world-editor__section">
                ${logicRuleMarkup || '<div class="test-world-editor__empty">No rule selected. Select a world rule from the list.</div>'}
            </section>
        `;
        const logicNpcBehaviorPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Editor / NPC Behavior</h3>
                <div class="test-world-editor__empty">NPC Behavior Pages pending</div>
            </section>
        `;
        const logicFlagsPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Editor / Flags</h3>
                ${logicFlagsMarkup || '<div class="test-world-editor__empty">Flags editor pending. Runtime flags are available through Event Actions.</div>'}
            </section>
        `;
        let logicInnerPanelMarkup = logicTriggersPanelMarkup;
        if (this.activeLogicTab === 'cutscenes') {
            logicInnerPanelMarkup = logicCutscenesPanelMarkup;
        } else if (this.activeLogicTab === 'rules') {
            logicInnerPanelMarkup = logicRulesPanelMarkup;
        } else if (this.activeLogicTab === 'npc_behavior') {
            logicInnerPanelMarkup = logicNpcBehaviorPanelMarkup;
        } else if (this.activeLogicTab === 'flags') {
            logicInnerPanelMarkup = logicFlagsPanelMarkup;
        }
        const logicPanelMarkup = `
            <section class="test-world-editor__section">
                <h3>Logic Workspace</h3>
                <div class="test-world-editor__toolbar">
                    ${buildLogicTabButton('triggers', 'Triggers')}
                    ${buildLogicTabButton('rules', 'Rules')}
                    ${buildLogicTabButton('cutscenes', 'Cutscenes')}
                    ${buildLogicTabButton('npc_behavior', 'NPC Behavior')}
                    ${buildLogicTabButton('flags', 'Flags')}
                </div>
            </section>
            ${logicInnerPanelMarkup}
        `;

        let activePanelMarkup = levelPanelMarkup;
        if (this.activeTab === 'background') {
            activePanelMarkup = backgroundPanelMarkup;
        } else if (this.activeTab === 'objects') {
            activePanelMarkup = objectsPanelMarkup;
        } else if (this.activeTab === 'npc') {
            activePanelMarkup = npcPanelMarkup;
        } else if (this.activeTab === 'sequences') {
            activePanelMarkup = sequencesPanelMarkup;
        } else if (this.activeTab === 'cutscenes') {
            activePanelMarkup = cutscenesPanelMarkup;
        } else if (this.activeTab === 'inspector') {
            activePanelMarkup = inspectorPanelMarkup;
        } else if (this.activeTab === 'logic') {
            activePanelMarkup = logicPanelMarkup;
            const markerKey = `logic:${this.activeLogicTab}`;
            if (this.lastLogicConsoleMarkerKey !== markerKey) {
                console.info(`[editor] Logic subtab rendered: ${this.activeLogicTab}`);
            }
            this.lastLogicConsoleMarkerKey = markerKey;
        } else {
            this.lastLogicConsoleMarkerKey = null;
        }

        this.root.innerHTML = `
            <div class="test-world-editor__inner">
                <section class="test-world-editor__section">
                    <h2>Editor</h2>
                    <div class="test-world-editor__toolbar">
                        <button type="button" class="test-world-editor__button" data-editor-action="save-draft">Save Draft</button>
                        <button type="button" class="test-world-editor__button" data-editor-action="export-json">Export JSON</button>
                        <button type="button" class="test-world-editor__button" data-editor-action="import-json">Import JSON</button>
                        <button type="button" class="test-world-editor__button" data-editor-action="reset-default">Reset Default</button>
                        <button type="button" class="test-world-editor__button" data-editor-action="clear-draft">Clear Saved Draft</button>
                    </div>
                    <div class="test-world-editor__status-row">
                        <span class="test-world-editor__status">${escapeHtml(state.status || 'Editor ready')}</span>
                        <span class="test-world-editor__status">Undo ${state.canUndo ? 'yes' : 'no'} / Redo ${state.canRedo ? 'yes' : 'no'}</span>
                    </div>
                </section>
                ${tabBarMarkup}
                ${activePanelMarkup}
            </div>
        `;
        this.root.appendChild(this.fileInput);
        this.restoreFocusedField();
        this.restoreScrollPosition();
    }
}
