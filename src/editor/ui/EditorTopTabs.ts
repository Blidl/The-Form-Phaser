import type { EditorModeId } from '../core/EditorMode';

interface EditorTopTabsOptions {
    parent: HTMLElement;
    tabs: ReadonlyArray<{ id: EditorModeId; label: string }>;
    onTabSelected: (modeId: EditorModeId) => void;
    onDiagnosticsToggle?: () => void;
    onSaveRequested?: () => void;
    onClearDraftRequested?: () => void;
    onExportJsonRequested?: () => void;
    onImportJsonRequested?: () => void;
    onReloadRequested?: () => void;
    onStopToggled?: (stopped: boolean) => void;
    onSpeedChanged?: (speed: number) => void;
    zIndex?: number;
}

export class EditorTopTabs {
    private readonly root: HTMLDivElement;
    private readonly tabButtons: Map<EditorModeId, HTMLButtonElement>;
    private readonly mouseCoordsLabel: HTMLDivElement;
    private readonly diagnosticsToggleButton: HTMLButtonElement;
    private readonly saveButton: HTMLButtonElement;
    private readonly clearDraftButton: HTMLButtonElement;
    private readonly exportJsonButton: HTMLButtonElement;
    private readonly importJsonButton: HTMLButtonElement;
    private readonly reloadButton: HTMLButtonElement;
    private readonly saveStateLabel: HTMLDivElement;
    private readonly saveStatusLabel: HTMLDivElement;
    private readonly saveNoteLabel: HTMLDivElement;
    private readonly stopCheckbox: HTMLInputElement;
    private readonly speedInput: HTMLInputElement;
    private speedInputFocused = false;
    private gameplaySpeedValue = 1;

    public constructor(options: EditorTopTabsOptions) {
        this.root = document.createElement('div');
        this.root.style.position = 'fixed';
        this.root.style.left = '0';
        this.root.style.right = '0';
        this.root.style.top = '0';
        this.root.style.height = '36px';
        this.root.style.display = 'flex';
        this.root.style.alignItems = 'stretch';
        this.root.style.background = '#cdcdcd';
        this.root.style.borderBottom = '1px solid #6a6a6a';
        this.root.style.fontFamily = 'Tahoma, Verdana, sans-serif';
        this.root.style.pointerEvents = 'auto';
        this.root.style.zIndex = `${options.zIndex ?? 4200}`;

        this.tabButtons = new Map<EditorModeId, HTMLButtonElement>();
        const tabsContainer = document.createElement('div');
        tabsContainer.style.display = 'flex';
        tabsContainer.style.flex = '1 1 auto';

        options.tabs.forEach((tab) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = tab.label;
            button.style.border = '0';
            button.style.borderRight = '1px solid #6a6a6a';
            button.style.background = '#cdcdcd';
            button.style.color = '#222';
            button.style.cursor = 'pointer';
            button.style.fontFamily = 'inherit';
            button.style.fontSize = '12px';
            button.style.height = '100%';
            button.style.padding = '0 16px';
            button.addEventListener('click', () => {
                options.onTabSelected(tab.id);
            });
            this.tabButtons.set(tab.id, button);
            tabsContainer.appendChild(button);
        });

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.alignItems = 'center';
        controls.style.gap = '8px';
        controls.style.padding = '0 10px';
        controls.style.borderLeft = '1px solid #6a6a6a';
        controls.style.color = '#222';
        controls.style.fontSize = '12px';

        const stopLabel = document.createElement('label');
        stopLabel.style.display = 'inline-flex';
        stopLabel.style.alignItems = 'center';
        stopLabel.style.gap = '4px';
        this.stopCheckbox = document.createElement('input');
        this.stopCheckbox.type = 'checkbox';
        this.stopCheckbox.addEventListener('change', () => {
            options.onStopToggled?.(this.stopCheckbox.checked);
        });
        stopLabel.append(this.stopCheckbox, document.createTextNode('Stop game'));

        this.speedInput = document.createElement('input');
        this.speedInput.type = 'text';
        this.speedInput.value = '1.0';
        this.speedInput.style.width = '36px';
        this.speedInput.style.height = '20px';
        this.speedInput.style.border = '1px solid #707070';
        this.speedInput.style.background = '#dcdcdc';
        const stopKeyboardEvent = (event: Event): void => {
            event.stopPropagation();
        };
        this.speedInput.addEventListener('keydown', stopKeyboardEvent);
        this.speedInput.addEventListener('keyup', stopKeyboardEvent);
        this.speedInput.addEventListener('keypress', stopKeyboardEvent);
        this.speedInput.addEventListener('focus', () => {
            this.speedInputFocused = true;
        });
        const commitSpeed = (): void => {
            const parsed = Number.parseFloat(this.speedInput.value.trim());
            if (!Number.isFinite(parsed)) {
                this.speedInput.value = this.formatSpeedValue(this.gameplaySpeedValue);
                return;
            }
            options.onSpeedChanged?.(parsed);
        };
        this.speedInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commitSpeed();
                this.speedInput.blur();
            }
        });
        this.speedInput.addEventListener('change', commitSpeed);
        this.speedInput.addEventListener('blur', () => {
            this.speedInputFocused = false;
            commitSpeed();
        });

        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Game speed';

        this.mouseCoordsLabel = document.createElement('div');
        this.mouseCoordsLabel.style.marginLeft = '8px';
        this.mouseCoordsLabel.style.minWidth = '130px';
        this.mouseCoordsLabel.textContent = 'x: -, y: -';
        this.diagnosticsToggleButton = document.createElement('button');
        this.diagnosticsToggleButton.type = 'button';
        this.diagnosticsToggleButton.style.height = '24px';
        this.diagnosticsToggleButton.style.border = '1px solid #707070';
        this.diagnosticsToggleButton.style.background = '#dcdcdc';
        this.diagnosticsToggleButton.style.cursor = 'pointer';
        this.diagnosticsToggleButton.style.padding = '0 8px';
        this.diagnosticsToggleButton.style.fontSize = '12px';
        this.diagnosticsToggleButton.addEventListener('click', () => {
            options.onDiagnosticsToggle?.();
        });
        this.setDiagnosticsEnabled(false);
        this.saveButton = document.createElement('button');
        this.saveButton.type = 'button';
        this.saveButton.textContent = 'Save';
        this.saveButton.style.height = '24px';
        this.saveButton.style.border = '1px solid #707070';
        this.saveButton.style.background = '#dcdcdc';
        this.saveButton.style.cursor = 'pointer';
        this.saveButton.style.padding = '0 10px';
        this.saveButton.style.fontSize = '12px';
        this.saveButton.addEventListener('click', () => {
            options.onSaveRequested?.();
        });
        this.clearDraftButton = document.createElement('button');
        this.clearDraftButton.type = 'button';
        this.clearDraftButton.textContent = 'Clear Draft';
        this.clearDraftButton.style.height = '24px';
        this.clearDraftButton.style.border = '1px solid #707070';
        this.clearDraftButton.style.background = '#dcdcdc';
        this.clearDraftButton.style.cursor = 'pointer';
        this.clearDraftButton.style.padding = '0 10px';
        this.clearDraftButton.style.fontSize = '12px';
        this.clearDraftButton.addEventListener('click', () => {
            options.onClearDraftRequested?.();
        });
        this.exportJsonButton = document.createElement('button');
        this.exportJsonButton.type = 'button';
        this.exportJsonButton.textContent = 'Export JSON';
        this.exportJsonButton.style.height = '24px';
        this.exportJsonButton.style.border = '1px solid #707070';
        this.exportJsonButton.style.background = '#dcdcdc';
        this.exportJsonButton.style.cursor = 'pointer';
        this.exportJsonButton.style.padding = '0 10px';
        this.exportJsonButton.style.fontSize = '12px';
        this.exportJsonButton.addEventListener('click', () => {
            options.onExportJsonRequested?.();
        });
        this.exportJsonButton.title = 'Export downloads current runtime config. To use it in project files, replace/import manually.';
        this.importJsonButton = document.createElement('button');
        this.importJsonButton.type = 'button';
        this.importJsonButton.textContent = 'Import JSON';
        this.importJsonButton.style.height = '24px';
        this.importJsonButton.style.border = '1px solid #707070';
        this.importJsonButton.style.background = '#dcdcdc';
        this.importJsonButton.style.cursor = 'pointer';
        this.importJsonButton.style.padding = '0 10px';
        this.importJsonButton.style.fontSize = '12px';
        this.importJsonButton.addEventListener('click', () => {
            options.onImportJsonRequested?.();
        });
        this.reloadButton = document.createElement('button');
        this.reloadButton.type = 'button';
        this.reloadButton.textContent = 'Reload Page';
        this.reloadButton.style.height = '24px';
        this.reloadButton.style.border = '1px solid #707070';
        this.reloadButton.style.background = '#dcdcdc';
        this.reloadButton.style.cursor = 'pointer';
        this.reloadButton.style.padding = '0 10px';
        this.reloadButton.style.fontSize = '12px';
        this.reloadButton.addEventListener('click', () => {
            options.onReloadRequested?.();
        });
        this.saveStateLabel = document.createElement('div');
        this.saveStateLabel.style.minWidth = '80px';
        this.saveStateLabel.textContent = 'Saved';
        this.saveStatusLabel = document.createElement('div');
        this.saveStatusLabel.style.minWidth = '72px';
        this.saveStatusLabel.textContent = '';
        this.saveNoteLabel = document.createElement('div');
        this.saveNoteLabel.style.minWidth = '180px';
        this.saveNoteLabel.textContent = '';

        controls.append(
            stopLabel,
            this.speedInput,
            speedLabel,
            this.mouseCoordsLabel,
            this.saveStateLabel,
            this.saveStatusLabel,
            this.saveNoteLabel,
            this.saveButton,
            this.clearDraftButton,
            this.exportJsonButton,
            this.importJsonButton,
            this.reloadButton,
            this.diagnosticsToggleButton
        );

        this.root.append(tabsContainer, controls);
        options.parent.appendChild(this.root);
    }

    public setVisible(visible: boolean): void {
        this.root.style.display = visible ? 'flex' : 'none';
    }

    public setActiveTab(activeModeId: EditorModeId): void {
        this.tabButtons.forEach((button, modeId) => {
            const isActive = modeId === activeModeId;
            button.style.background = isActive ? '#70de63' : '#cdcdcd';
        });
    }

    public setMouseWorldPosition(x: number | null, y: number | null): void {
        if (x === null || y === null) {
            this.mouseCoordsLabel.textContent = 'x: -, y: -';
            return;
        }
        this.mouseCoordsLabel.textContent = `x: ${Math.round(x)}, y: ${Math.round(y)}`;
    }

    public setDiagnosticsEnabled(enabled: boolean): void {
        this.diagnosticsToggleButton.textContent = enabled ? 'Diag ON' : 'Diag OFF';
        this.diagnosticsToggleButton.style.background = enabled ? '#70de63' : '#dcdcdc';
    }

    public setSaveState(isDirty: boolean, statusMessage: string | null, noteMessage: string | null = null): void {
        this.saveStateLabel.textContent = isDirty ? 'Unsaved' : 'Saved';
        this.saveStateLabel.style.color = isDirty ? '#9c5a00' : '#145800';
        this.saveStatusLabel.textContent = statusMessage ?? '';
        this.saveNoteLabel.textContent = noteMessage ?? '';
    }

    public setGameplayTimeState(stopped: boolean, speed: number): void {
        this.stopCheckbox.checked = stopped;
        this.gameplaySpeedValue = speed;
        if (!this.speedInputFocused) {
            this.speedInput.value = this.formatSpeedValue(speed);
        }
    }

    public destroy(): void {
        this.root.remove();
    }

    private formatSpeedValue(speed: number): string {
        return speed.toFixed(2).replace(/\.?0+$/, '');
    }
}
