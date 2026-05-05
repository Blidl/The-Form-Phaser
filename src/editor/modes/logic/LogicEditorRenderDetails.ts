import type { LogicSnapshot } from '../../logic-authoring/LogicAuthoringTypes';
import type { TestWorldLogicScriptConfig } from '../../../game/world/runtime/test_world_config';
import type { LogicEditorDomHelpers } from './LogicEditorDom';

export interface RenderScriptDetailsContext {
    dom: LogicEditorDomHelpers;
    selectedExternalScript: TestWorldLogicScriptConfig | null;
    bindings: LogicSnapshot['bindings'];
}

export function renderScriptDetailsSection(
    container: HTMLElement,
    context: RenderScriptDetailsContext
): void {
    const { dom, selectedExternalScript, bindings } = context;

    const renderPreviewSection = (): void => {
        container.appendChild(dom.makeSectionTitle('Preview'));

        const previewBox = document.createElement('div');
        previewBox.style.border = '1px solid #8b8b8b';
        previewBox.style.background = '#ececec';
        previewBox.style.padding = '6px';
        previewBox.style.marginBottom = '8px';

        const controlsRow = document.createElement('div');
        controlsRow.style.display = 'flex';
        controlsRow.style.flexWrap = 'wrap';
        controlsRow.style.gap = '6px';
        controlsRow.style.marginBottom = '6px';

        ['Play', 'Pause', 'Stop', 'Focus'].forEach((label) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.disabled = true;
            button.style.opacity = '0.65';
            button.style.cursor = 'not-allowed';
            controlsRow.appendChild(button);
        });

        previewBox.appendChild(controlsRow);
        previewBox.appendChild(dom.makeInfoLine('Preview execution is deferred.'));
        if (selectedExternalScript) {
            previewBox.appendChild(dom.makeInfoLine(`Selected script: ${selectedExternalScript.id}`));
        } else {
            previewBox.appendChild(dom.makeInfoLine('Select a script to preview later.'));
        }

        container.appendChild(previewBox);
    };

    container.appendChild(dom.makeSectionTitle('Script Edit'));
    if (!selectedExternalScript) {
        container.appendChild(dom.makeInfoLine('Select an external script asset to inspect.'));
        renderPreviewSection();
        container.appendChild(dom.makeSpacer(8));
        return;
    }

    const scriptEditBox = document.createElement('div');
    scriptEditBox.style.border = '1px solid #8b8b8b';
    scriptEditBox.style.background = '#ececec';
    scriptEditBox.style.padding = '6px';
    scriptEditBox.style.marginBottom = '8px';
    scriptEditBox.appendChild(dom.makeInfoLine(`Name: ${selectedExternalScript.name}`));
    scriptEditBox.appendChild(dom.makeInfoLine(`ID: ${selectedExternalScript.id}`));
    scriptEditBox.appendChild(dom.makeInfoLine(`Category: ${selectedExternalScript.category}`));
    if (selectedExternalScript.editor?.locked) {
        scriptEditBox.appendChild(dom.makeInfoLine('Locked: true'));
    }
    scriptEditBox.appendChild(dom.makeInfoLine('IDE/source file: logic_scripts.json'));
    container.appendChild(scriptEditBox);

    container.appendChild(dom.makeSectionTitle('Instructions'));
    const instructionsBox = document.createElement('div');
    instructionsBox.style.border = '1px solid #8b8b8b';
    instructionsBox.style.background = '#ececec';
    instructionsBox.style.padding = '6px';
    instructionsBox.style.marginBottom = '8px';
    if (selectedExternalScript.commands.length <= 0) {
        instructionsBox.appendChild(dom.makeInfoLine('No instructions/commands in this script.'));
    } else {
        selectedExternalScript.commands.forEach((command, index) => {
            const commandParams = command.params ?? {};
            instructionsBox.appendChild(dom.makeInfoLine(
                `${index + 1}. ${command.type} ${JSON.stringify(commandParams)}`
            ));
        });
    }
    container.appendChild(instructionsBox);

    container.appendChild(dom.makeSectionTitle('Script Users'));
    const usersBox = document.createElement('div');
    usersBox.style.border = '1px solid #8b8b8b';
    usersBox.style.background = '#ececec';
    usersBox.style.padding = '6px';
    usersBox.style.marginBottom = '8px';
    const scriptUsers = bindings.filter(
        (binding) => binding.scriptId === selectedExternalScript.id
    );
    if (scriptUsers.length <= 0) {
        usersBox.appendChild(dom.makeInfoLine('No level bindings use this script yet.'));
    } else {
        scriptUsers.forEach((binding) => {
            const bindingUserBox = document.createElement('div');
            bindingUserBox.style.border = '1px solid #8b8b8b';
            bindingUserBox.style.background = '#d9d9d9';
            bindingUserBox.style.padding = '4px';
            bindingUserBox.style.marginBottom = '4px';
            bindingUserBox.style.wordBreak = 'break-word';
            bindingUserBox.appendChild(dom.makeInfoLine(`binding id: ${binding.id}`));
            bindingUserBox.appendChild(dom.makeInfoLine(`targetType: ${binding.targetType}`));
            bindingUserBox.appendChild(dom.makeInfoLine(`targetId: ${binding.targetId ?? '-'}`));
            bindingUserBox.appendChild(dom.makeInfoLine(`slot: ${binding.slot}`));
            bindingUserBox.appendChild(dom.makeInfoLine(`status: ${binding.enabled ? 'enabled' : 'disabled'}`));
            usersBox.appendChild(bindingUserBox);
        });
    }
    container.appendChild(usersBox);

    renderPreviewSection();
    container.appendChild(dom.makeSpacer(8));
}
