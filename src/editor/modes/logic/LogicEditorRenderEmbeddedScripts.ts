import type { TestWorldLogicScriptCategory, TestWorldLogicScriptConfig } from '../../../game/world/runtime/test_world_config';
import type { LogicEditorDomHelpers } from './LogicEditorDom';

export interface ScriptMetadataDraftView {
    name: string;
    category: TestWorldLogicScriptCategory;
    locked: boolean;
}

export interface RenderEmbeddedScriptsContext {
    dom: LogicEditorDomHelpers;
    scripts: TestWorldLogicScriptConfig[];
    selectedScript: TestWorldLogicScriptConfig | null;
    selectedScriptId: string | null;
    selectedScriptDraft: ScriptMetadataDraftView | null;
    scriptCategoryOptions: TestWorldLogicScriptCategory[];
    isCreateScriptFormOpen: boolean;
    createScriptError: string | null;
    updateScriptError: string | null;
    onOpenCreateScriptForm: () => void;
    onCreateScript: (name: string, category: string) => void;
    onCancelCreateScriptForm: () => void;
    onSelectScript: (script: TestWorldLogicScriptConfig) => void;
    onSelectedScriptNameChanged: (value: string) => void;
    onSelectedScriptCategoryChanged: (value: TestWorldLogicScriptCategory) => void;
    onSelectedScriptLockedChanged: (value: boolean) => void;
    onApplySelectedScriptChanges: () => void;
    onRevertSelectedScriptChanges: () => void;
}

export function renderEmbeddedScriptsSection(
    container: HTMLElement,
    context: RenderEmbeddedScriptsContext
): void {
    const {
        dom,
        scripts,
        selectedScript,
        selectedScriptId,
        selectedScriptDraft,
        scriptCategoryOptions,
        isCreateScriptFormOpen,
        createScriptError,
        updateScriptError,
        onOpenCreateScriptForm,
        onCreateScript,
        onCancelCreateScriptForm,
        onSelectScript,
        onSelectedScriptNameChanged,
        onSelectedScriptCategoryChanged,
        onSelectedScriptLockedChanged,
        onApplySelectedScriptChanges,
        onRevertSelectedScriptChanges
    } = context;

    container.appendChild(dom.makeSpacer(8));
    container.appendChild(dom.makeSectionTitle('Scripts'));
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
        onOpenCreateScriptForm();
    });
    container.appendChild(createButton);

    if (createScriptError) {
        const errorLine = dom.makeInfoLine(createScriptError);
        errorLine.style.color = '#b00020';
        errorLine.style.marginBottom = '6px';
        container.appendChild(errorLine);
    }

    if (isCreateScriptFormOpen) {
        const formBox = document.createElement('div');
        formBox.style.border = '1px solid #8b8b8b';
        formBox.style.background = '#d9d9d9';
        formBox.style.padding = '6px';
        formBox.style.marginBottom = '6px';

        const nameLabel = dom.makeInfoLine('Name');
        nameLabel.style.marginBottom = '2px';
        formBox.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = 'New Logic Script';
        nameInput.style.display = 'block';
        nameInput.style.width = '100%';
        nameInput.style.boxSizing = 'border-box';
        nameInput.style.marginBottom = '6px';
        dom.bindEditorInputKeyboardGuards(nameInput);
        formBox.appendChild(nameInput);

        const categoryLabel = dom.makeInfoLine('Category');
        categoryLabel.style.marginBottom = '2px';
        formBox.appendChild(categoryLabel);

        const categorySelect = document.createElement('select');
        categorySelect.style.display = 'block';
        categorySelect.style.width = '100%';
        categorySelect.style.boxSizing = 'border-box';
        categorySelect.style.marginBottom = '6px';
        dom.bindEditorInputKeyboardGuards(categorySelect);
        scriptCategoryOptions.forEach((category) => {
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
            onCreateScript(nameInput.value, categorySelect.value);
        });
        actionsRow.appendChild(createFormButton);

        const cancelFormButton = document.createElement('button');
        cancelFormButton.type = 'button';
        cancelFormButton.textContent = 'Cancel';
        cancelFormButton.addEventListener('click', () => {
            onCancelCreateScriptForm();
        });
        actionsRow.appendChild(cancelFormButton);

        formBox.appendChild(actionsRow);
        container.appendChild(formBox);
    }

    if (scripts.length <= 0) {
        container.appendChild(dom.makeInfoLine('No logic scripts yet.'));
    } else {
        scripts.forEach((script) => {
            const scriptBox = document.createElement('div');
            scriptBox.style.border = '1px solid #8b8b8b';
            scriptBox.style.background = script.id === selectedScriptId ? '#c9dbf1' : '#d9d9d9';
            scriptBox.style.padding = '6px';
            scriptBox.style.marginBottom = '6px';
            scriptBox.style.wordBreak = 'break-word';
            scriptBox.style.cursor = 'pointer';
            if (script.id === selectedScriptId) {
                scriptBox.style.border = '1px solid #53759b';
            }
            scriptBox.addEventListener('click', () => {
                onSelectScript(script);
            });
            const lockedMarker = script.editor?.locked ? ' [locked]' : '';
            scriptBox.appendChild(dom.makeInfoLine(`name: ${script.name}${lockedMarker}`));
            scriptBox.appendChild(dom.makeInfoLine(`id: ${script.id}`));
            scriptBox.appendChild(dom.makeInfoLine(`category: ${script.category}`));
            scriptBox.appendChild(dom.makeInfoLine(`command count: ${script.commands.length}`));
            if (script.editor?.locked) {
                scriptBox.appendChild(dom.makeInfoLine('locked: true'));
            }
            container.appendChild(scriptBox);
        });
    }

    container.appendChild(dom.makeSpacer(8));
    container.appendChild(dom.makeSectionTitle('Script Details'));
    if (!selectedScript || !selectedScriptDraft) {
        container.appendChild(dom.makeInfoLine('Select a script to edit metadata.'));
        return;
    }

    const detailsBox = document.createElement('div');
    detailsBox.style.border = '1px solid #8b8b8b';
    detailsBox.style.background = '#d9d9d9';
    detailsBox.style.padding = '6px';

    detailsBox.appendChild(dom.makeInfoLine(`id: ${selectedScript.id}`));
    detailsBox.appendChild(dom.makeInfoLine(`command count: ${selectedScript.commands.length}`));

    const nameLabel = dom.makeInfoLine('Name');
    nameLabel.style.marginTop = '6px';
    nameLabel.style.marginBottom = '2px';
    detailsBox.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = selectedScriptDraft.name;
    nameInput.style.display = 'block';
    nameInput.style.width = '100%';
    nameInput.style.boxSizing = 'border-box';
    nameInput.style.marginBottom = '6px';
    dom.bindEditorInputKeyboardGuards(nameInput);
    nameInput.addEventListener('input', () => {
        onSelectedScriptNameChanged(nameInput.value);
    });
    detailsBox.appendChild(nameInput);

    const categoryLabel = dom.makeInfoLine('Category');
    categoryLabel.style.marginBottom = '2px';
    detailsBox.appendChild(categoryLabel);

    const categorySelect = document.createElement('select');
    categorySelect.style.display = 'block';
    categorySelect.style.width = '100%';
    categorySelect.style.boxSizing = 'border-box';
    categorySelect.style.marginBottom = '6px';
    dom.bindEditorInputKeyboardGuards(categorySelect);
    scriptCategoryOptions.forEach((category) => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        option.selected = category === selectedScriptDraft.category;
        categorySelect.appendChild(option);
    });
    categorySelect.addEventListener('change', () => {
        onSelectedScriptCategoryChanged(categorySelect.value as TestWorldLogicScriptCategory);
    });
    detailsBox.appendChild(categorySelect);

    const lockedRow = document.createElement('label');
    lockedRow.style.display = 'flex';
    lockedRow.style.alignItems = 'center';
    lockedRow.style.gap = '6px';
    lockedRow.style.marginBottom = '6px';

    const lockedCheckbox = document.createElement('input');
    lockedCheckbox.type = 'checkbox';
    lockedCheckbox.checked = selectedScriptDraft.locked;
    dom.bindEditorInputKeyboardGuards(lockedCheckbox);
    lockedCheckbox.addEventListener('change', () => {
        onSelectedScriptLockedChanged(lockedCheckbox.checked);
    });
    lockedRow.appendChild(lockedCheckbox);

    const lockedLabelText = document.createElement('span');
    lockedLabelText.textContent = 'Locked';
    lockedRow.appendChild(lockedLabelText);
    detailsBox.appendChild(lockedRow);

    if (updateScriptError) {
        const errorLine = dom.makeInfoLine(updateScriptError);
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
        onApplySelectedScriptChanges();
    });
    actionsRow.appendChild(applyButton);

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = 'Revert Changes';
    resetButton.title = 'Reverts unsaved form edits. Does not delete the script.';
    resetButton.addEventListener('click', () => {
        onRevertSelectedScriptChanges();
    });
    actionsRow.appendChild(resetButton);

    detailsBox.appendChild(actionsRow);
    container.appendChild(detailsBox);
}
