import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { LogicSnapshot } from '../logic-authoring/LogicAuthoringTypes';
import type { EditorPanel } from '../ui/EditorPanel';

interface LogicEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

export class LogicEditorMode implements EditorMode {
    public readonly id = 'logic';
    public readonly label = 'Logic';

    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private lastSnapshotSignature: string | null = null;

    public constructor(options: LogicEditorModeOptions) {
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
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();

        panel.setCustomContent('Logic', (container) => {
            container.appendChild(this.makeInfoLine('Runtime-backed authoring overview'));
            container.appendChild(this.makeSpacer(8));

            if (!snapshot) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Summary'));
            container.appendChild(this.makeInfoLine(`Scripts: ${snapshot.scripts.length}`));
            container.appendChild(this.makeInfoLine(`Bindings: ${snapshot.bindings.length}`));
            container.appendChild(this.makeSpacer(8));

            container.appendChild(this.makeSectionTitle('Scripts'));
            if (snapshot.scripts.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic scripts yet.'));
                return;
            }

            snapshot.scripts.forEach((script) => {
                const scriptBox = document.createElement('div');
                scriptBox.style.border = '1px solid #8b8b8b';
                scriptBox.style.background = '#d9d9d9';
                scriptBox.style.padding = '6px';
                scriptBox.style.marginBottom = '6px';
                scriptBox.style.wordBreak = 'break-word';
                const lockedMarker = script.editor?.locked ? ' [locked]' : '';
                scriptBox.appendChild(this.makeInfoLine(`name: ${script.name}${lockedMarker}`));
                scriptBox.appendChild(this.makeInfoLine(`id: ${script.id}`));
                scriptBox.appendChild(this.makeInfoLine(`category: ${script.category}`));
                scriptBox.appendChild(this.makeInfoLine(`command count: ${script.commands.length}`));
                if (script.editor?.locked) {
                    scriptBox.appendChild(this.makeInfoLine('locked: true'));
                }
                container.appendChild(scriptBox);
            });
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const snapshot = this.logicAuthoringService.getSnapshot();

        panel.setCustomContent('Logic Bindings', (container) => {
            if (!snapshot) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Bindings'));
            if (snapshot.bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings yet.'));
                return;
            }

            snapshot.bindings.forEach((binding) => {
                const bindingBox = document.createElement('div');
                bindingBox.style.border = '1px solid #8b8b8b';
                bindingBox.style.background = '#d9d9d9';
                bindingBox.style.padding = '6px';
                bindingBox.style.marginBottom = '6px';
                bindingBox.style.wordBreak = 'break-word';
                bindingBox.appendChild(this.makeInfoLine(`id: ${binding.id}`));
                bindingBox.appendChild(this.makeInfoLine(`targetType: ${binding.targetType}`));
                bindingBox.appendChild(this.makeInfoLine(`targetId: ${binding.targetId ?? '-'}`));
                bindingBox.appendChild(this.makeInfoLine(`slot: ${binding.slot}`));
                bindingBox.appendChild(this.makeInfoLine(`scriptId: ${binding.scriptId}`));
                bindingBox.appendChild(this.makeInfoLine(`status: ${binding.enabled ? 'enabled' : 'disabled'}`));
                container.appendChild(bindingBox);
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
            return JSON.stringify({
                scripts: snapshot.scripts,
                bindings: snapshot.bindings
            });
        } catch {
            return `${snapshot.scripts.length}|${snapshot.bindings.length}`;
        }
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const title = document.createElement('div');
        title.textContent = text;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';
        return title;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const line = document.createElement('div');
        line.textContent = text;
        return line;
    }

    private makeSpacer(heightPx: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = `${heightPx}px`;
        return spacer;
    }
}
