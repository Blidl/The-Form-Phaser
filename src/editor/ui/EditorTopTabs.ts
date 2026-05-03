import type { EditorModeId } from '../core/EditorMode';

interface EditorTopTabsOptions {
    parent: HTMLElement;
    tabs: ReadonlyArray<{ id: EditorModeId; label: string }>;
    onTabSelected: (modeId: EditorModeId) => void;
    onDiagnosticsToggle?: () => void;
    zIndex?: number;
}

export class EditorTopTabs {
    private readonly root: HTMLDivElement;
    private readonly tabButtons: Map<EditorModeId, HTMLButtonElement>;
    private readonly mouseCoordsLabel: HTMLDivElement;
    private readonly diagnosticsToggleButton: HTMLButtonElement;

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
        const stopCheckbox = document.createElement('input');
        stopCheckbox.type = 'checkbox';
        stopCheckbox.disabled = true;
        stopLabel.append(stopCheckbox, document.createTextNode('Stop game'));

        const speedInput = document.createElement('input');
        speedInput.type = 'text';
        speedInput.value = '1.0';
        speedInput.disabled = true;
        speedInput.style.width = '36px';
        speedInput.style.height = '20px';
        speedInput.style.border = '1px solid #707070';
        speedInput.style.background = '#dcdcdc';

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

        controls.append(stopLabel, speedInput, speedLabel, this.mouseCoordsLabel, this.diagnosticsToggleButton);

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

    public destroy(): void {
        this.root.remove();
    }
}
