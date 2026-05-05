import type { LogicSnapshot } from '../../logic-authoring/LogicAuthoringTypes';
import type { TestWorldLogicScriptConfig } from '../../../game/world/runtime/test_world_config';
import type { LogicEditorDomHelpers } from './LogicEditorDom';

export interface RenderExternalScriptsContext {
    dom: LogicEditorDomHelpers;
    levelScriptRefs: LogicSnapshot['scriptRefs'];
    externalAssets: TestWorldLogicScriptConfig[];
    referencedScriptRefIds: Set<string>;
    diagnostics: { code: string; message: string }[];
    selectedExternalScriptId: string | null;
    addScriptRefError: string | null;
    createBindingRefId: string | null;
    createBindingSlotDraft: string;
    createBindingEnabledDraft: boolean;
    createBindingError: string | null;
    onStartCreateBindingForRef: (scriptRefId: string) => void;
    onCreateBindingSlotDraftChanged: (value: string) => void;
    onCreateBindingEnabledDraftChanged: (enabled: boolean) => void;
    onCreateBindingForRef: (scriptRefId: string) => void;
    onCancelCreateBindingForRef: () => void;
    onSelectExternalScript: (scriptId: string) => void;
    onAddScriptRefToLevel: (script: TestWorldLogicScriptConfig) => void;
}

export function renderExternalScriptsSection(
    container: HTMLElement,
    context: RenderExternalScriptsContext
): void {
    const {
        dom,
        levelScriptRefs,
        externalAssets,
        referencedScriptRefIds,
        diagnostics,
        selectedExternalScriptId,
        addScriptRefError,
        createBindingRefId,
        createBindingSlotDraft,
        createBindingEnabledDraft,
        createBindingError,
        onStartCreateBindingForRef,
        onCreateBindingSlotDraftChanged,
        onCreateBindingEnabledDraftChanged,
        onCreateBindingForRef,
        onCancelCreateBindingForRef,
        onSelectExternalScript,
        onAddScriptRefToLevel
    } = context;

    container.appendChild(dom.makeSectionTitle('Level Script Refs'));
    if (levelScriptRefs.length <= 0) {
        container.appendChild(dom.makeInfoLine('No external script refs added to this level yet.'));
    } else {
        container.appendChild(dom.makeInfoLine(`Count: ${levelScriptRefs.length}`));
        levelScriptRefs.forEach((scriptRef) => {
            const displayName = scriptRef.displayName ?? '-';
            const path = scriptRef.path ?? '-';
            const scriptRefBox = document.createElement('div');
            scriptRefBox.style.border = '1px solid #8b8b8b';
            scriptRefBox.style.background = '#d9d9d9';
            scriptRefBox.style.padding = '6px';
            scriptRefBox.style.marginBottom = '6px';
            scriptRefBox.style.wordBreak = 'break-word';
            scriptRefBox.appendChild(dom.makeInfoLine(`id: ${scriptRef.id}`));
            scriptRefBox.appendChild(dom.makeInfoLine(`displayName: ${displayName}`));
            scriptRefBox.appendChild(dom.makeInfoLine(`path: ${path}`));

            const addBindingButton = document.createElement('button');
            addBindingButton.type = 'button';
            addBindingButton.textContent = 'Add World Binding';
            addBindingButton.style.marginTop = '4px';
            addBindingButton.addEventListener('click', () => {
                onStartCreateBindingForRef(scriptRef.id);
            });
            scriptRefBox.appendChild(addBindingButton);

            if (createBindingRefId === scriptRef.id) {
                const bindingForm = document.createElement('div');
                bindingForm.style.border = '1px solid #8b8b8b';
                bindingForm.style.background = '#ececec';
                bindingForm.style.padding = '6px';
                bindingForm.style.marginTop = '6px';

                const slotLabel = dom.makeInfoLine('Slot');
                slotLabel.style.marginBottom = '2px';
                bindingForm.appendChild(slotLabel);

                const slotInput = document.createElement('input');
                slotInput.type = 'text';
                slotInput.value = createBindingSlotDraft;
                slotInput.style.display = 'block';
                slotInput.style.width = '100%';
                slotInput.style.boxSizing = 'border-box';
                slotInput.style.marginBottom = '6px';
                dom.bindEditorInputKeyboardGuards(slotInput);
                slotInput.addEventListener('input', () => {
                    onCreateBindingSlotDraftChanged(slotInput.value);
                });
                bindingForm.appendChild(slotInput);

                const enabledRow = document.createElement('label');
                enabledRow.style.display = 'flex';
                enabledRow.style.alignItems = 'center';
                enabledRow.style.gap = '6px';
                enabledRow.style.marginBottom = '6px';

                const enabledCheckbox = document.createElement('input');
                enabledCheckbox.type = 'checkbox';
                enabledCheckbox.checked = createBindingEnabledDraft;
                dom.bindEditorInputKeyboardGuards(enabledCheckbox);
                enabledCheckbox.addEventListener('change', () => {
                    onCreateBindingEnabledDraftChanged(enabledCheckbox.checked);
                });
                enabledRow.appendChild(enabledCheckbox);

                const enabledText = document.createElement('span');
                enabledText.textContent = 'Enabled';
                enabledRow.appendChild(enabledText);
                bindingForm.appendChild(enabledRow);

                if (createBindingError) {
                    const errorLine = dom.makeInfoLine(createBindingError);
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
                    onCreateBindingForRef(scriptRef.id);
                });
                actionRow.appendChild(createBindingButton);

                const cancelBindingButton = document.createElement('button');
                cancelBindingButton.type = 'button';
                cancelBindingButton.textContent = 'Cancel';
                cancelBindingButton.addEventListener('click', () => {
                    onCancelCreateBindingForRef();
                });
                actionRow.appendChild(cancelBindingButton);

                bindingForm.appendChild(actionRow);
                scriptRefBox.appendChild(bindingForm);
            }

            container.appendChild(scriptRefBox);
        });
    }
    container.appendChild(dom.makeSpacer(8));

    container.appendChild(dom.makeSectionTitle('External Script Assets'));
    container.appendChild(dom.makeInfoLine('External scripts are authored in IDE/source files. This editor only references them.'));
    container.appendChild(dom.makeInfoLine(`External assets: ${externalAssets.length}`));
    container.appendChild(dom.makeSpacer(4));

    if (addScriptRefError) {
        const errorLine = dom.makeInfoLine(addScriptRefError);
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
        warningBox.appendChild(dom.makeInfoLine(`Diagnostics: ${diagnostics.length}`));
        diagnostics.forEach((diagnostic) => {
            warningBox.appendChild(dom.makeInfoLine(`[${diagnostic.code}] ${diagnostic.message}`));
        });
        container.appendChild(warningBox);
    }

    if (externalAssets.length <= 0) {
        container.appendChild(dom.makeInfoLine('No external script assets found.'));
        container.appendChild(dom.makeInfoLine('Add scripts in src/game/world/runtime/data/logic_scripts.json and reload.'));
    } else {
        externalAssets.forEach((script) => {
            const scriptBox = document.createElement('div');
            const isSelectedExternalScript = script.id === selectedExternalScriptId;
            scriptBox.style.border = isSelectedExternalScript ? '1px solid #53759b' : '1px solid #8b8b8b';
            scriptBox.style.background = isSelectedExternalScript ? '#c9dbf1' : '#d9d9d9';
            scriptBox.style.padding = '6px';
            scriptBox.style.marginBottom = '6px';
            scriptBox.style.wordBreak = 'break-word';
            scriptBox.style.cursor = 'pointer';
            scriptBox.addEventListener('click', () => {
                onSelectExternalScript(script.id);
            });
            const lockedMarker = script.editor?.locked ? ' [locked]' : '';
            scriptBox.appendChild(dom.makeInfoLine(`name: ${script.name}${lockedMarker}`));
            scriptBox.appendChild(dom.makeInfoLine(`id: ${script.id}`));
            scriptBox.appendChild(dom.makeInfoLine(`category: ${script.category}`));
            scriptBox.appendChild(dom.makeInfoLine(`command count: ${script.commands.length}`));
            if (script.editor?.locked) {
                scriptBox.appendChild(dom.makeInfoLine('locked: true'));
            }
            const isReferenced = referencedScriptRefIds.has(script.id);
            if (isReferenced) {
                const referencedLine = dom.makeInfoLine('Referenced');
                referencedLine.style.color = '#146614';
                scriptBox.appendChild(referencedLine);
            } else {
                const addRefButton = document.createElement('button');
                addRefButton.type = 'button';
                addRefButton.textContent = 'Add Ref To Level';
                addRefButton.style.marginTop = '4px';
                addRefButton.addEventListener('click', () => {
                    onAddScriptRefToLevel(script);
                });
                scriptBox.appendChild(addRefButton);
            }
            container.appendChild(scriptBox);
        });
    }
}
