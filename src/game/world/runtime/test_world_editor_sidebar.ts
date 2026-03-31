import type { TestWorldEditorObjectType } from './test_world_editor_adapters';

export interface TestWorldEditorSidebarObjectItem {
    id: string;
    label: string;
    type: string;
    locked: boolean;
    selected: boolean;
}

export interface TestWorldEditorSidebarFieldOption {
    value: string;
    label: string;
}

export interface TestWorldEditorSidebarField {
    key: string;
    label: string;
    input: 'number' | 'text' | 'color' | 'select' | 'checkbox';
    value: string | number | boolean;
    min?: number;
    step?: number;
    options?: TestWorldEditorSidebarFieldOption[];
}

export interface TestWorldEditorSidebarSection {
    title: string;
    fields: TestWorldEditorSidebarField[];
}

export interface TestWorldEditorSidebarState {
    visible: boolean;
    search: string;
    status: string;
    canUndo: boolean;
    canRedo: boolean;
    palette: ReadonlyArray<{ type: TestWorldEditorObjectType; label: string }>;
    objectItems: TestWorldEditorSidebarObjectItem[];
    inspectorId: string | null;
    inspectorType: string | null;
    inspectorSections: TestWorldEditorSidebarSection[];
    selectedLocked: boolean;
}

export interface TestWorldEditorSidebarCallbacks {
    onSaveDraft: () => void;
    onExportJson: () => void;
    onImportJson: (jsonText: string) => void;
    onResetDefault: () => void;
    onClearSavedDraft: () => void;
    onCreateObject: (type: TestWorldEditorObjectType) => void;
    onSearchChange: (search: string) => void;
    onSelectObject: (id: string) => void;
    onDuplicateSelected: () => void;
    onDeleteSelected: () => void;
    onToggleSelectedLock: () => void;
    onInspectorFieldChange: (key: string, value: string | number | boolean) => void;
}

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

const buildFieldMarkup = (field: TestWorldEditorSidebarField): string => {
    const baseAttributes = `data-editor-field="${escapeHtml(field.key)}"`;
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

    public constructor(
        parent: HTMLElement,
        private readonly callbacks: TestWorldEditorSidebarCallbacks
    ) {
        this.root = document.createElement('div');
        this.root.id = 'test-world-editor-sidebar';
        this.root.className = 'test-world-editor test-world-editor--hidden';
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
                this.callbacks.onImportJson(jsonText);
                this.fileInput.value = '';
            });
        });
        this.root.appendChild(this.fileInput);

        this.state = {
            visible: false,
            search: '',
            status: '',
            canUndo: false,
            canRedo: false,
            palette: [],
            objectItems: [],
            inspectorId: null,
            inspectorType: null,
            inspectorSections: [],
            selectedLocked: false
        };
        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('change', this.handleChange);
        this.render();
    }

    public setState(nextState: TestWorldEditorSidebarState): void {
        this.state = nextState;
        this.render();
    }

    public destroy(): void {
        this.root.removeEventListener('click', this.handleClick);
        this.root.removeEventListener('change', this.handleChange);
        this.root.remove();
    }

    private readonly handleClick = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        const action = target?.closest<HTMLElement>('[data-editor-action]')?.dataset.editorAction;
        if (!action) {
            return;
        }

        if (action === 'save-draft') {
            this.callbacks.onSaveDraft();
            return;
        }
        if (action === 'export-json') {
            this.callbacks.onExportJson();
            return;
        }
        if (action === 'import-json') {
            this.fileInput.click();
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
        if (action === 'toggle-selected-lock') {
            this.callbacks.onToggleSelectedLock();
            return;
        }

        const paletteType = target?.closest<HTMLElement>('[data-editor-palette-type]')?.dataset.editorPaletteType;
        if (paletteType) {
            this.callbacks.onCreateObject(paletteType as TestWorldEditorObjectType);
            return;
        }

        const objectId = target?.closest<HTMLElement>('[data-editor-object-id]')?.dataset.editorObjectId;
        if (objectId) {
            this.callbacks.onSelectObject(objectId);
        }
    };

    private readonly handleChange = (event: Event): void => {
        const target = event.target as HTMLInputElement | HTMLSelectElement | null;
        if (!target) {
            return;
        }

        if (target.matches('[data-editor-search]')) {
            this.callbacks.onSearchChange(target.value);
            return;
        }

        const fieldKey = target.dataset.editorField;
        if (!fieldKey) {
            return;
        }

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
            this.callbacks.onInspectorFieldChange(fieldKey, target.checked);
            return;
        }
        if (target instanceof HTMLInputElement && target.type === 'color') {
            this.callbacks.onInspectorFieldChange(fieldKey, Number.parseInt(target.value.slice(1), 16));
            return;
        }
        if (target instanceof HTMLInputElement && target.type === 'number') {
            this.callbacks.onInspectorFieldChange(fieldKey, Number(target.value));
            return;
        }

        this.callbacks.onInspectorFieldChange(fieldKey, target.value);
    };

    private render(): void {
        const state = this.state;
        this.root.classList.toggle('test-world-editor--hidden', !state.visible);

        const paletteMarkup = state.palette.map((entry) => {
            return `<button type="button" class="test-world-editor__button" data-editor-palette-type="${entry.type}">${escapeHtml(entry.label)}</button>`;
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

        const inspectorMarkup = state.inspectorSections.map((section) => {
            return `
                <section class="test-world-editor__section">
                    <h3>${escapeHtml(section.title)}</h3>
                    <div class="test-world-editor__fields">
                        ${section.fields.map(buildFieldMarkup).join('')}
                    </div>
                </section>
            `;
        }).join('');

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
                    <h3>Inspector</h3>
                    <div class="test-world-editor__meta">
                        <div><strong>ID</strong> ${escapeHtml(state.inspectorId ?? 'None')}</div>
                        <div><strong>Type</strong> ${escapeHtml(state.inspectorType ?? 'None')}</div>
                    </div>
                    ${inspectorMarkup || '<div class="test-world-editor__empty">Nothing selected</div>'}
                </section>

                <section class="test-world-editor__section">
                    <h3>Actions</h3>
                    <div class="test-world-editor__toolbar">
                        <button type="button" class="test-world-editor__button" data-editor-action="duplicate-selected">Duplicate</button>
                        <button type="button" class="test-world-editor__button test-world-editor__button--danger" data-editor-action="delete-selected">Delete</button>
                        <button type="button" class="test-world-editor__button" data-editor-action="toggle-selected-lock">${state.selectedLocked ? 'Unlock' : 'Lock'}</button>
                    </div>
                </section>
            </div>
        `;
        this.root.appendChild(this.fileInput);
    }
}
