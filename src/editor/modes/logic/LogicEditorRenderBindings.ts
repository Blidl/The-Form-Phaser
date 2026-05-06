import type { TestWorldLogicBindingConfig } from '../../../game/world/runtime/test_world_config';
import type { LogicEditorDomHelpers } from './LogicEditorDom';

export interface BindingMetadataDraftView {
    slot: string;
    enabled: boolean;
}

export interface RenderBindingsContext {
    dom: LogicEditorDomHelpers;
    bindings: TestWorldLogicBindingConfig[];
    selectedBinding: TestWorldLogicBindingConfig | null;
    selectedBindingId: string | null;
    selectedBindingDraft: BindingMetadataDraftView | null;
    updateBindingError: string | null;
    onSelectBinding: (binding: TestWorldLogicBindingConfig) => void;
    onSelectedBindingSlotChanged: (value: string) => void;
    onSelectedBindingEnabledChanged: (value: boolean) => void;
    onApplySelectedBindingChanges: () => void;
    onRevertSelectedBindingChanges: () => void;
    onDeleteSelectedBinding: () => void;
}

export function renderBindingsSection(
    container: HTMLElement,
    context: RenderBindingsContext
): void {
    const {
        dom,
        bindings,
        selectedBinding,
        selectedBindingId,
        selectedBindingDraft,
        updateBindingError,
        onSelectBinding,
        onSelectedBindingSlotChanged,
        onSelectedBindingEnabledChanged,
        onApplySelectedBindingChanges,
        onRevertSelectedBindingChanges,
        onDeleteSelectedBinding
    } = context;

    container.appendChild(dom.makeSectionTitle('Bindings'));
    container.appendChild(dom.makeInfoLine('Runtime-supported slots: world/onStart and object/onInteract.'));
    if (bindings.length <= 0) {
        container.appendChild(dom.makeInfoLine('No logic bindings yet.'));
        return;
    }

    bindings.forEach((binding) => {
        const bindingBox = document.createElement('div');
        const isSelected = binding.id === selectedBindingId;
        bindingBox.style.border = isSelected ? '1px solid #4f6f91' : '1px solid #8b8b8b';
        bindingBox.style.background = isSelected ? '#c9dbf1' : '#d9d9d9';
        bindingBox.style.padding = '6px';
        bindingBox.style.marginBottom = '6px';
        bindingBox.style.wordBreak = 'break-word';
        bindingBox.style.cursor = 'pointer';
        bindingBox.addEventListener('click', () => {
            onSelectBinding(binding);
        });
        bindingBox.appendChild(dom.makeInfoLine(`id: ${binding.id}`));
        bindingBox.appendChild(dom.makeInfoLine(`targetType: ${binding.targetType}`));
        bindingBox.appendChild(dom.makeInfoLine(`targetId: ${binding.targetId ?? '-'}`));
        bindingBox.appendChild(dom.makeInfoLine(`slot: ${binding.slot}`));
        bindingBox.appendChild(dom.makeInfoLine(`scriptId: ${binding.scriptId}`));
        bindingBox.appendChild(dom.makeInfoLine(`status: ${binding.enabled ? 'enabled' : 'disabled'}`));
        const isRuntimeSupported = (
            (binding.targetType === 'world' && binding.slot.trim() === 'onStart')
            || (binding.targetType === 'object' && binding.slot.trim() === 'onInteract')
        );
        bindingBox.appendChild(dom.makeInfoLine(
            isRuntimeSupported
                ? 'runtime support: supported'
                : 'runtime support: unsupported slot (see diagnostics)'
        ));
        container.appendChild(bindingBox);
    });

    container.appendChild(dom.makeSpacer(8));
    container.appendChild(dom.makeSectionTitle('Selected Binding'));
    if (!selectedBinding || !selectedBindingDraft) {
        container.appendChild(dom.makeInfoLine('Select a binding to edit.'));
        return;
    }

    const detailsBox = document.createElement('div');
    detailsBox.style.border = '1px solid #8b8b8b';
    detailsBox.style.background = '#ececec';
    detailsBox.style.padding = '6px';

    detailsBox.appendChild(dom.makeInfoLine(`id: ${selectedBinding.id}`));
    detailsBox.appendChild(dom.makeInfoLine(`targetType: ${selectedBinding.targetType}`));
    detailsBox.appendChild(dom.makeInfoLine(`targetId: ${selectedBinding.targetId ?? '-'}`));
    detailsBox.appendChild(dom.makeInfoLine(`scriptId: ${selectedBinding.scriptId}`));
    detailsBox.appendChild(dom.makeSpacer(6));

    const slotLabel = dom.makeInfoLine('Slot');
    slotLabel.style.marginBottom = '2px';
    detailsBox.appendChild(slotLabel);

    const slotInput = document.createElement('input');
    slotInput.type = 'text';
    slotInput.value = selectedBindingDraft.slot;
    slotInput.style.display = 'block';
    slotInput.style.width = '100%';
    slotInput.style.boxSizing = 'border-box';
    slotInput.style.marginBottom = '6px';
    dom.bindEditorInputKeyboardGuards(slotInput);
    slotInput.addEventListener('input', () => {
        onSelectedBindingSlotChanged(slotInput.value);
    });
    detailsBox.appendChild(slotInput);

    const enabledRow = document.createElement('label');
    enabledRow.style.display = 'flex';
    enabledRow.style.alignItems = 'center';
    enabledRow.style.gap = '6px';
    enabledRow.style.marginBottom = '6px';

    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = selectedBindingDraft.enabled;
    dom.bindEditorInputKeyboardGuards(enabledCheckbox);
    enabledCheckbox.addEventListener('change', () => {
        onSelectedBindingEnabledChanged(enabledCheckbox.checked);
    });
    enabledRow.appendChild(enabledCheckbox);

    const enabledText = document.createElement('span');
    enabledText.textContent = 'Enabled';
    enabledRow.appendChild(enabledText);
    detailsBox.appendChild(enabledRow);

    if (updateBindingError) {
        const errorLine = dom.makeInfoLine(updateBindingError);
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
        onApplySelectedBindingChanges();
    });
    actionsRow.appendChild(applyButton);

    const revertButton = document.createElement('button');
    revertButton.type = 'button';
    revertButton.textContent = 'Revert Changes';
    revertButton.addEventListener('click', () => {
        onRevertSelectedBindingChanges();
    });
    actionsRow.appendChild(revertButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => {
        onDeleteSelectedBinding();
    });
    actionsRow.appendChild(deleteButton);

    detailsBox.appendChild(actionsRow);
    container.appendChild(detailsBox);
}
