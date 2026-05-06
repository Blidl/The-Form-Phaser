import type { LogicSnapshot } from '../../logic-authoring/LogicAuthoringTypes';
import type { TestWorldLogicScriptConfig } from '../../../game/world/runtime/test_world_config';
import type {
    LogicScriptExecutionResult,
    LogicWorldOnStartTrace
} from '../../../game/world/runtime/logic_script_runtime';
import type { LogicEditorDomHelpers } from './LogicEditorDom';

export interface RenderScriptDetailsContext {
    dom: LogicEditorDomHelpers;
    selectedExternalScript: TestWorldLogicScriptConfig | null;
    bindings: LogicSnapshot['bindings'];
    selectedScriptDiagnostics: {
        code: string;
        message: string;
        scriptId?: string;
        commandId?: string;
        path?: string;
        cutsceneId?: string;
        missingParticipantId?: string;
    }[];
    previewResult: LogicScriptExecutionResult | null;
    runtimeWorldOnStartTrace: LogicWorldOnStartTrace | null;
    runtimeWorldFlagsSnapshot: Record<string, boolean>;
    onPlayPreview: () => void;
    onStopPreview: () => void;
}

export function renderScriptDetailsSection(
    container: HTMLElement,
    context: RenderScriptDetailsContext
): void {
    const {
        dom,
        selectedExternalScript,
        bindings,
        selectedScriptDiagnostics,
        previewResult,
        runtimeWorldOnStartTrace,
        runtimeWorldFlagsSnapshot,
        onPlayPreview,
        onStopPreview
    } = context;

    const renderPreviewSection = (): void => {
        container.appendChild(dom.makeSectionTitle('Preview Sandbox'));

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

        const createControlButton = (
            label: string,
            options: {
                disabled: boolean;
                onClick?: () => void;
            }
        ): HTMLButtonElement => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.disabled = options.disabled;
            if (options.disabled) {
                button.style.opacity = '0.65';
                button.style.cursor = 'not-allowed';
            }
            if (!options.disabled && options.onClick) {
                button.addEventListener('click', () => {
                    options.onClick?.();
                });
            }
            return button;
        };

        controlsRow.appendChild(createControlButton('Play', {
            disabled: !selectedExternalScript,
            onClick: onPlayPreview
        }));
        controlsRow.appendChild(createControlButton('Pause', { disabled: true }));
        controlsRow.appendChild(createControlButton('Stop', {
            disabled: !previewResult,
            onClick: onStopPreview
        }));
        controlsRow.appendChild(createControlButton('Focus', { disabled: true }));

        previewBox.appendChild(controlsRow);
        previewBox.appendChild(dom.makeInfoLine('Preview runs in a sandbox. It does not execute in live gameplay runtime.'));
        if (selectedExternalScript) {
            previewBox.appendChild(dom.makeInfoLine(`Selected script: ${selectedExternalScript.id}`));
        } else {
            previewBox.appendChild(dom.makeInfoLine('Select a script to preview later.'));
        }

        if (previewResult) {
            previewBox.appendChild(dom.makeSpacer(4));
            previewBox.appendChild(dom.makeInfoLine(`Trace script id: ${previewResult.scriptId}`));
            previewBox.appendChild(dom.makeInfoLine(`Trace status: ${previewResult.status}`));
            previewBox.appendChild(dom.makeInfoLine('Command results:'));
            if (previewResult.commands.length <= 0) {
                previewBox.appendChild(dom.makeInfoLine('- skipped/empty: no commands to trace'));
            } else {
                previewResult.commands.forEach((command) => {
                    previewBox.appendChild(dom.makeInfoLine(`- command id: ${command.commandId}`));
                    previewBox.appendChild(dom.makeInfoLine(`  type: ${command.type}`));
                    previewBox.appendChild(dom.makeInfoLine(`  status: ${command.status}`));
                    previewBox.appendChild(dom.makeInfoLine(`  message: ${command.message}`));
                });
            }

            if (previewResult.stateChanges && previewResult.stateChanges.length > 0) {
                previewBox.appendChild(dom.makeInfoLine('Preview State Changes:'));
                previewResult.stateChanges.forEach((change) => {
                    const fromText = change.from === undefined ? 'unset' : String(change.from);
                    previewBox.appendChild(dom.makeInfoLine(`- ${change.key}: ${fromText} -> ${String(change.to)}`));
                });
            }

            if (previewResult.worldFlags) {
                const previewFlagEntries = Object.entries(previewResult.worldFlags);
                previewBox.appendChild(dom.makeInfoLine('Preview World Flags:'));
                if (previewFlagEntries.length <= 0) {
                    previewBox.appendChild(dom.makeInfoLine('- (none)'));
                } else {
                    previewFlagEntries.forEach(([key, value]) => {
                        previewBox.appendChild(dom.makeInfoLine(`- ${key}: ${String(value)}`));
                    });
                }
            }
        }

        container.appendChild(previewBox);
    };

    const renderRuntimeOnStartTraceSection = (): void => {
        container.appendChild(dom.makeSectionTitle('Runtime world/onStart Trace'));

        const traceBox = document.createElement('div');
        traceBox.style.border = '1px solid #8b8b8b';
        traceBox.style.background = '#ececec';
        traceBox.style.padding = '6px';
        traceBox.style.marginBottom = '8px';

        traceBox.appendChild(dom.makeInfoLine('Runtime support: world/onStart executes once after world runtime init.'));

        if (!runtimeWorldOnStartTrace) {
            traceBox.appendChild(dom.makeInfoLine('No runtime world/onStart trace recorded.'));
            container.appendChild(traceBox);
            return;
        }

        traceBox.appendChild(dom.makeInfoLine(`Overall status: ${runtimeWorldOnStartTrace.status}`));
        if (runtimeWorldOnStartTrace.bindings.length <= 0) {
            traceBox.appendChild(dom.makeInfoLine('Bindings: (none)'));
            container.appendChild(traceBox);
            return;
        }

        runtimeWorldOnStartTrace.bindings.forEach((bindingTrace) => {
            const bindingBox = document.createElement('div');
            bindingBox.style.border = '1px solid #8b8b8b';
            bindingBox.style.background = '#d9d9d9';
            bindingBox.style.padding = '4px';
            bindingBox.style.marginTop = '4px';
            bindingBox.style.wordBreak = 'break-word';
            bindingBox.appendChild(dom.makeInfoLine(`binding id: ${bindingTrace.bindingId}`));
            bindingBox.appendChild(dom.makeInfoLine(`script id: ${bindingTrace.scriptId}`));
            bindingBox.appendChild(dom.makeInfoLine(`targetType: ${bindingTrace.targetType}`));
            bindingBox.appendChild(dom.makeInfoLine(`slot: ${bindingTrace.slot}`));
            bindingBox.appendChild(dom.makeInfoLine(`status: ${bindingTrace.status}`));
            if (bindingTrace.reason) {
                bindingBox.appendChild(dom.makeInfoLine(`reason: ${bindingTrace.reason}`));
            }

            if (bindingTrace.scriptResult) {
                bindingBox.appendChild(dom.makeInfoLine('Command results:'));
                if (bindingTrace.scriptResult.commands.length <= 0) {
                    bindingBox.appendChild(dom.makeInfoLine('- skipped/empty: no commands to trace'));
                } else {
                    bindingTrace.scriptResult.commands.forEach((command) => {
                        bindingBox.appendChild(dom.makeInfoLine(`- command id: ${command.commandId}`));
                        bindingBox.appendChild(dom.makeInfoLine(`  type: ${command.type}`));
                        bindingBox.appendChild(dom.makeInfoLine(`  status: ${command.status}`));
                        bindingBox.appendChild(dom.makeInfoLine(`  message: ${command.message}`));
                    });
                }
            }

            traceBox.appendChild(bindingBox);
        });

        container.appendChild(traceBox);
    };

    const renderRuntimeWorldFlagsSection = (): void => {
        container.appendChild(dom.makeSectionTitle('Runtime World Flags'));

        const flagsBox = document.createElement('div');
        flagsBox.style.border = '1px solid #8b8b8b';
        flagsBox.style.background = '#ececec';
        flagsBox.style.padding = '6px';
        flagsBox.style.marginBottom = '8px';

        const flagEntries = Object.entries(runtimeWorldFlagsSnapshot);
        if (flagEntries.length <= 0) {
            flagsBox.appendChild(dom.makeInfoLine('No runtime world flags set.'));
        } else {
            flagEntries.forEach(([key, value]) => {
                flagsBox.appendChild(dom.makeInfoLine(`${key}: ${String(value)}`));
            });
        }
        flagsBox.appendChild(dom.makeInfoLine('Runtime flags are live state and are not saved/exported.'));
        container.appendChild(flagsBox);
    };

    const renderScriptDiagnosticsSection = (): void => {
        container.appendChild(dom.makeSectionTitle('Script Diagnostics'));

        if (!selectedExternalScript) {
            container.appendChild(dom.makeInfoLine('Select an external script asset to inspect diagnostics.'));
            return;
        }

        const diagnosticsBox = document.createElement('div');
        diagnosticsBox.style.border = '1px solid #c98a00';
        diagnosticsBox.style.background = '#fff4d1';
        diagnosticsBox.style.padding = '6px';
        diagnosticsBox.style.marginBottom = '8px';
        diagnosticsBox.style.wordBreak = 'break-word';

        if (selectedScriptDiagnostics.length <= 0) {
            diagnosticsBox.appendChild(dom.makeInfoLine('No diagnostics for selected script.'));
            container.appendChild(diagnosticsBox);
            return;
        }

        diagnosticsBox.appendChild(dom.makeInfoLine(`Diagnostics: ${selectedScriptDiagnostics.length}`));
        selectedScriptDiagnostics.forEach((diagnostic) => {
            diagnosticsBox.appendChild(dom.makeInfoLine(`[${diagnostic.code}] ${diagnostic.message}`));
            if (diagnostic.commandId) {
                diagnosticsBox.appendChild(dom.makeInfoLine(`command: ${diagnostic.commandId}`));
            }
            if (diagnostic.cutsceneId) {
                diagnosticsBox.appendChild(dom.makeInfoLine(`cutsceneId: ${diagnostic.cutsceneId}`));
            }
            if (diagnostic.missingParticipantId) {
                diagnosticsBox.appendChild(dom.makeInfoLine(`missingParticipantId: ${diagnostic.missingParticipantId}`));
            }
            if (diagnostic.path) {
                diagnosticsBox.appendChild(dom.makeInfoLine(`path: ${diagnostic.path}`));
            }
        });
        container.appendChild(diagnosticsBox);
    };

    container.appendChild(dom.makeSectionTitle('Script Edit'));
    if (!selectedExternalScript) {
        container.appendChild(dom.makeInfoLine('Select an external script asset to inspect.'));
        renderScriptDiagnosticsSection();
        renderPreviewSection();
        renderRuntimeOnStartTraceSection();
        renderRuntimeWorldFlagsSection();
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

    renderScriptDiagnosticsSection();

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
    renderRuntimeOnStartTraceSection();
    renderRuntimeWorldFlagsSection();
    container.appendChild(dom.makeSpacer(8));
}
