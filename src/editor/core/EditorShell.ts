import type { Scene } from 'phaser';
import { createInitialEditorState, type EditorState } from '../EditorState';
import {
    EDITOR_MODE_ORDER,
    type EditorMode,
    type EditorModeId
} from './EditorMode';
import { EditorCameraController } from './EditorCameraController';
import { EditorGrid } from './EditorGrid';
import { EditorMouseWorldInfo } from './EditorMouseWorldInfo';
import { EditorPanel } from '../ui/EditorPanel';
import { EditorTopTabs } from '../ui/EditorTopTabs';
import { LevelEditorMode } from '../modes/LevelEditorMode';
import { PlayerEditorMode } from '../modes/PlayerEditorMode';
import { ObjectsEditorMode } from '../modes/ObjectsEditorMode';
import { BackgroundEditorMode } from '../modes/BackgroundEditorMode';
import { NpcEditorMode } from '../modes/NpcEditorMode';
import { CutscenesEditorMode } from '../modes/CutscenesEditorMode';
import { LogicEditorMode } from '../modes/LogicEditorMode';
import { ProjectStore } from '../data/ProjectStore';
import type { LegacyObjectSource } from '../bridge/LegacyObjectAdapter';
import { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import {
    clearObjectDiagBuffer,
    copyObjectDiagBufferToClipboard,
    getLatestObjectDiagSummary,
    isObjectEditorDiagnosticsEnabled,
    objectDiag,
    toggleObjectEditorDiagnostics
} from '../debug/ObjectEditorDiagnostics';
import { isEditorTextInputFocused } from '../../shared/dom_input_focus';

interface EditorShellOptions {
    scene: Scene;
    camera: Phaser.Cameras.Scene2D.Camera;
    followTarget: Phaser.GameObjects.GameObject;
    hostElement?: HTMLElement;
    legacyObjectSource?: LegacyObjectSource;
}

const TOP_BAR_HEIGHT = 36;

const createModes = (
    scene: Scene,
    projectStore: ProjectStore,
    onUiChanged: () => void,
    legacyObjectAdapter: LegacyObjectAdapter | null
): Record<EditorModeId, EditorMode> => {
    const level = new LevelEditorMode(projectStore);
    const player = new PlayerEditorMode();
    const objects = new ObjectsEditorMode({
        scene,
        projectStore,
        objectTypeRegistry: projectStore.getObjectTypeRegistry(),
        onUiChanged,
        legacyObjectAdapter
    });
    const background = new BackgroundEditorMode();
    const npc = new NpcEditorMode();
    const cutscenes = new CutscenesEditorMode();
    const logic = new LogicEditorMode();

    return {
        level,
        player,
        objects,
        background,
        npc,
        cutscenes,
        logic
    };
};

const resolveHostElement = (providedHost?: HTMLElement): HTMLElement => {
    if (providedHost) {
        return providedHost;
    }

    return document.getElementById('app') ?? document.body;
};

export class EditorShell {
    private readonly scene: Scene;
    private readonly camera: Phaser.Cameras.Scene2D.Camera;
    private readonly rootElement: HTMLDivElement;
    private readonly state: EditorState;
    private readonly modes: Record<EditorModeId, EditorMode>;
    private readonly topTabs: EditorTopTabs;
    private readonly leftPanel: EditorPanel;
    private readonly rightPanel: EditorPanel;
    private readonly cameraController: EditorCameraController;
    private readonly grid: EditorGrid;
    private readonly mouseWorldInfo: EditorMouseWorldInfo;
    private readonly projectStore: ProjectStore;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly diagToggleKey: Phaser.Input.Keyboard.Key | null;
    private readonly diagPanelRoot: HTMLDivElement;
    private readonly diagPanelStatus: HTMLDivElement;
    private readonly diagPanelCounts: HTMLDivElement;
    private readonly diagPanelSelected: HTMLDivElement;
    private readonly diagPanelLastEvent: HTMLDivElement;
    private diagPanelClosedTemporarily = false;
    private lastDiagEvent = '-';

    public constructor(options: EditorShellOptions) {
        this.scene = options.scene;
        this.camera = options.camera;
        this.state = createInitialEditorState();
        this.projectStore = new ProjectStore();
        const legacyObjectAdapter = options.legacyObjectSource
            ? new LegacyObjectAdapter(options.legacyObjectSource, this.projectStore.getObjectTypeRegistry())
            : null;
        this.legacyObjectAdapter = legacyObjectAdapter;
        this.modes = createModes(this.scene, this.projectStore, () => {
            this.renderActiveModeInspectors();
        }, legacyObjectAdapter);

        this.rootElement = document.createElement('div');
        this.rootElement.setAttribute('data-editor-shell', 'true');
        this.rootElement.style.position = 'fixed';
        this.rootElement.style.inset = '0';
        this.rootElement.style.pointerEvents = 'none';
        this.rootElement.style.zIndex = '4000';
        this.rootElement.style.display = 'none';

        resolveHostElement(options.hostElement).appendChild(this.rootElement);

        this.topTabs = new EditorTopTabs({
            parent: this.rootElement,
            tabs: EDITOR_MODE_ORDER.map((modeId) => ({
                id: modeId,
                label: this.modes[modeId].label
            })),
            onTabSelected: (modeId) => {
                this.setMode(modeId);
            },
            onDiagnosticsToggle: () => {
                const enabled = toggleObjectEditorDiagnostics();
                this.lastDiagEvent = enabled ? 'Diagnostics enabled from UI' : 'Diagnostics disabled from UI';
                this.diagPanelClosedTemporarily = false;
                this.refreshDiagnosticsUi();
            }
        });
        this.topTabs.setDiagnosticsEnabled(isObjectEditorDiagnosticsEnabled());

        this.leftPanel = new EditorPanel({
            parent: this.rootElement,
            side: 'left',
            topOffsetPx: TOP_BAR_HEIGHT
        });

        this.rightPanel = new EditorPanel({
            parent: this.rootElement,
            side: 'right',
            topOffsetPx: TOP_BAR_HEIGHT
        });

        this.cameraController = new EditorCameraController({
            scene: this.scene,
            camera: this.camera,
            followTarget: options.followTarget
        });
        this.grid = new EditorGrid(this.scene);
        this.grid.setGridSize(32);
        this.mouseWorldInfo = new EditorMouseWorldInfo(this.scene, this.camera);
        this.scene.input.on('pointerdown', this.handlePointerDown, this);
        this.scene.input.on('pointermove', this.handlePointerMove, this);
        this.scene.input.on('pointerup', this.handlePointerUp, this);
        this.scene.game.canvas.addEventListener('contextmenu', this.handleCanvasContextMenu);
        this.legacyObjectAdapter?.setEditorDebugViewActive(false);
        this.diagToggleKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D) ?? null;
        this.diagPanelRoot = document.createElement('div');
        this.diagPanelRoot.style.position = 'fixed';
        this.diagPanelRoot.style.right = '10px';
        this.diagPanelRoot.style.bottom = '10px';
        this.diagPanelRoot.style.width = '320px';
        this.diagPanelRoot.style.background = 'rgba(20, 20, 20, 0.92)';
        this.diagPanelRoot.style.border = '1px solid #5f5f5f';
        this.diagPanelRoot.style.color = '#f2f2f2';
        this.diagPanelRoot.style.fontFamily = 'Tahoma, Verdana, sans-serif';
        this.diagPanelRoot.style.fontSize = '12px';
        this.diagPanelRoot.style.pointerEvents = 'auto';
        this.diagPanelRoot.style.padding = '8px';
        this.diagPanelRoot.style.zIndex = '4300';

        const title = document.createElement('div');
        title.textContent = 'Object Diagnostics';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '6px';
        this.diagPanelStatus = document.createElement('div');
        this.diagPanelCounts = document.createElement('div');
        this.diagPanelSelected = document.createElement('div');
        this.diagPanelLastEvent = document.createElement('div');
        this.diagPanelLastEvent.style.wordBreak = 'break-word';
        const instructions = document.createElement('div');
        instructions.textContent = 'Run scenario, then click Copy and paste logs into chat.';
        instructions.style.marginTop = '6px';
        const consoleHint = document.createElement('div');
        consoleHint.textContent = 'Open browser console with F12 to see live logs.';
        consoleHint.style.marginBottom = '8px';

        const buttons = document.createElement('div');
        buttons.style.display = 'flex';
        buttons.style.gap = '6px';
        const makeBtn = (label: string): HTMLButtonElement => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.border = '1px solid #6f6f6f';
            button.style.background = '#d9d9d9';
            button.style.padding = '2px 8px';
            button.style.cursor = 'pointer';
            return button;
        };
        const clearButton = makeBtn('Clear');
        clearButton.addEventListener('click', () => {
            clearObjectDiagBuffer();
            this.lastDiagEvent = 'Diagnostics buffer cleared';
            this.refreshDiagnosticsUi();
        });
        const copyButton = makeBtn('Copy');
        copyButton.addEventListener('click', async () => {
            this.emitDiagnosticsSnapshot('copy_button');
            const result = await copyObjectDiagBufferToClipboard();
            this.lastDiagEvent = result.message;
            this.refreshDiagnosticsUi();
        });
        const snapshotButton = makeBtn('Snapshot');
        snapshotButton.addEventListener('click', () => {
            this.emitDiagnosticsSnapshot('manual_snapshot_button');
            this.lastDiagEvent = 'Diagnostics snapshot captured';
            this.refreshDiagnosticsUi();
        });
        const closeButton = makeBtn('Close');
        closeButton.title = 'Hide panel (Diag remains ON)';
        closeButton.addEventListener('click', () => {
            this.diagPanelClosedTemporarily = true;
            this.lastDiagEvent = 'Diagnostics panel hidden';
            this.refreshDiagnosticsUi();
        });
        buttons.append(clearButton, copyButton, snapshotButton, closeButton);
        this.diagPanelRoot.append(
            title,
            this.diagPanelStatus,
            this.diagPanelCounts,
            this.diagPanelSelected,
            this.diagPanelLastEvent,
            instructions,
            consoleHint,
            buttons
        );
        this.rootElement.appendChild(this.diagPanelRoot);
        this.refreshDiagnosticsUi();

        this.topTabs.setActiveTab(this.state.activeModeId);
        this.renderActiveModeInspectors();
    }

    public isOpen(): boolean {
        return this.state.isOpen;
    }

    public getProjectStore(): ProjectStore {
        return this.projectStore;
    }

    public toggle(): void {
        if (this.state.isOpen) {
            this.close();
            return;
        }
        this.open();
    }

    public open(): void {
        if (this.state.isOpen) {
            return;
        }

        this.state.isOpen = true;
        this.rootElement.style.display = 'block';
        this.topTabs.setVisible(true);
        this.leftPanel.setVisible(true);
        this.rightPanel.setVisible(true);
        const gridSettings = this.projectStore.getGridSettings();
        this.grid.setGridSize(gridSettings.size);
        this.grid.setVisible(gridSettings.enabled);
        this.cameraController.open();
        this.legacyObjectAdapter?.setEditorDebugViewActive(true);
        objectDiag('[EditorActive]', {
            layer: 'src/editor EditorShell',
            editorOpen: true,
            activeMode: this.state.activeModeId,
            hasProjectStore: true,
            hasObjectAuthoringService: true
        });
        this.renderActiveModeInspectors();
        this.refreshDiagnosticsUi();
    }

    public close(): void {
        if (!this.state.isOpen) {
            return;
        }

        this.state.isOpen = false;
        this.state.mouseWorldX = null;
        this.state.mouseWorldY = null;

        this.topTabs.setMouseWorldPosition(null, null);
        this.grid.setVisible(false);
        this.cameraController.close();
        this.legacyObjectAdapter?.setEditorDebugViewActive(false);

        this.leftPanel.setVisible(false);
        this.rightPanel.setVisible(false);
        this.topTabs.setVisible(false);
        this.rootElement.style.display = 'none';
        this.refreshDiagnosticsUi();
    }

    public setMode(modeId: EditorModeId): void {
        if (this.state.activeModeId === modeId) {
            return;
        }

        this.modes[this.state.activeModeId].exit?.();
        this.state.activeModeId = modeId;
        this.modes[this.state.activeModeId].enter?.();

        this.topTabs.setActiveTab(modeId);
        this.renderActiveModeInspectors();
    }

    public update(): void {
        if (!this.state.isOpen) {
            return;
        }
        this.handleDiagnosticsToggleShortcut();

        const gridSettings = this.projectStore.getGridSettings();
        this.grid.setGridSize(gridSettings.size);
        this.grid.setVisible(gridSettings.enabled);
        this.grid.update(this.camera);

        const mouseWorld = this.mouseWorldInfo.read();
        if (!mouseWorld) {
            this.state.mouseWorldX = null;
            this.state.mouseWorldY = null;
            this.topTabs.setMouseWorldPosition(null, null);
            return;
        }

        this.state.mouseWorldX = mouseWorld.x;
        this.state.mouseWorldY = mouseWorld.y;
        this.topTabs.setMouseWorldPosition(mouseWorld.x, mouseWorld.y);
        this.modes[this.state.activeModeId].update?.(this.createModeContext());
        this.refreshDiagnosticsUi();
    }

    public destroy(): void {
        this.close();
        this.cameraController.destroy();
        this.grid.destroy();
        this.scene.input.off('pointerdown', this.handlePointerDown, this);
        this.scene.input.off('pointermove', this.handlePointerMove, this);
        this.scene.input.off('pointerup', this.handlePointerUp, this);
        this.scene.game.canvas.removeEventListener('contextmenu', this.handleCanvasContextMenu);
        this.topTabs.destroy();
        this.leftPanel.destroy();
        this.rightPanel.destroy();
        this.diagPanelRoot.remove();
        this.rootElement.remove();
    }

    private renderActiveModeInspectors(): void {
        const mode = this.modes[this.state.activeModeId];
        mode.renderLeftInspector(this.leftPanel);
        mode.renderRightInspector(this.rightPanel);
    }

    private createModeContext() {
        return {
            mouseWorldX: this.state.mouseWorldX,
            mouseWorldY: this.state.mouseWorldY,
            grid: this.projectStore.getGridSettings()
        };
    }

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        if (!this.state.isOpen) {
            return;
        }
        this.modes[this.state.activeModeId].onPointerDown?.(
            {
                button: pointer.button,
                worldX: pointer.worldX,
                worldY: pointer.worldY,
                shiftKey: pointer.event.shiftKey
            },
            this.createModeContext()
        );
    }

    private handlePointerMove(pointer: Phaser.Input.Pointer): void {
        if (!this.state.isOpen) {
            return;
        }
        this.modes[this.state.activeModeId].onPointerMove?.(
            {
                button: pointer.button,
                worldX: pointer.worldX,
                worldY: pointer.worldY,
                shiftKey: pointer.event.shiftKey
            },
            this.createModeContext()
        );
    }

    private handlePointerUp(pointer: Phaser.Input.Pointer): void {
        if (!this.state.isOpen) {
            return;
        }
        this.modes[this.state.activeModeId].onPointerUp?.(
            {
                button: pointer.button,
                worldX: pointer.worldX,
                worldY: pointer.worldY,
                shiftKey: pointer.event.shiftKey
            },
            this.createModeContext()
        );
    }

    private readonly handleCanvasContextMenu = (event: Event): void => {
        if (!this.state.isOpen) {
            return;
        }
        event.preventDefault();
    };

    private handleDiagnosticsToggleShortcut(): void {
        if (!this.diagToggleKey) {
            return;
        }
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) {
            return;
        }
        if (!Phaser.Input.Keyboard.JustDown(this.diagToggleKey)) {
            return;
        }
        if (!keyboard.ctrlKey || !keyboard.shiftKey) {
            return;
        }
        if (isEditorTextInputFocused()) {
            return;
        }
        const enabled = toggleObjectEditorDiagnostics();
        this.lastDiagEvent = enabled ? 'Diagnostics enabled from Ctrl+Shift+D' : 'Diagnostics disabled from Ctrl+Shift+D';
        this.diagPanelClosedTemporarily = false;
        this.refreshDiagnosticsUi();
    }

    private refreshDiagnosticsUi(): void {
        const enabled = isObjectEditorDiagnosticsEnabled();
        this.topTabs.setDiagnosticsEnabled(enabled);
        const showPanel = this.state.isOpen && enabled && !this.diagPanelClosedTemporarily;
        this.diagPanelRoot.style.display = showPanel ? 'block' : 'none';
        if (!showPanel) {
            return;
        }
        const activeLevel = this.projectStore.getActiveLevel();
        let serviceCount = 0;
        let storeCount = this.projectStore.listObjects(activeLevel.id).length;
        let selected: string | null = null;
        if (this.state.activeModeId === 'objects') {
            const objectsMode = this.modes.objects as unknown as {
                getDiagnosticsSnapshot?: () => {
                    serviceObjects: number;
                    projectStoreObjects: number;
                    selectedObjectId: string | null;
                };
            };
            const snapshot = objectsMode.getDiagnosticsSnapshot?.();
            if (snapshot) {
                serviceCount = snapshot.serviceObjects;
                storeCount = snapshot.projectStoreObjects;
                selected = snapshot.selectedObjectId;
            }
        }
        this.diagPanelStatus.textContent = `- Active editor: src/editor EditorShell`;
        this.diagPanelCounts.textContent = `- Active mode: ${this.state.activeModeId} | Service objects: ${serviceCount} | ProjectStore objects: ${storeCount}`;
        this.diagPanelSelected.textContent = `- Selected: ${selected ?? 'none'}`;
        this.diagPanelLastEvent.textContent = `- Last event: ${getLatestObjectDiagSummary() || this.lastDiagEvent}`;
    }

    private emitDiagnosticsSnapshot(reason: string): void {
        const activeLevel = this.projectStore.getActiveLevel();
        const snapshotBase = {
            activeEditor: 'src/editor EditorShell',
            activeMode: this.state.activeModeId,
            projectStoreObjectCount: this.projectStore.listObjects(activeLevel.id).length
        };
        if (this.state.activeModeId !== 'objects') {
            objectDiag('[DiagSnapshot]', {
                ...snapshotBase,
                serviceObjectCount: 0,
                displayedObjectCount: 0,
                selectedObject: null,
                breakWallSummary: null,
                reason
            });
            return;
        }
        const objectsMode = this.modes.objects as unknown as {
            getDiagnosticsSnapshot?: () => {
                serviceObjects: number;
                projectStoreObjects: number;
                selectedObjectId: string | null;
                displayedObjects: number;
                breakWallSummary: {
                    service: number;
                    projectStore: number;
                    displayed: number;
                };
            };
            emitDiagnosticsSnapshot?: (source: string) => void;
        };
        const snapshot = objectsMode.getDiagnosticsSnapshot?.();
        objectsMode.emitDiagnosticsSnapshot?.('snapshot');
        objectDiag('[DiagSnapshot]', {
            ...snapshotBase,
            serviceObjectCount: snapshot?.serviceObjects ?? 0,
            displayedObjectCount: snapshot?.displayedObjects ?? 0,
            selectedObject: snapshot?.selectedObjectId ?? null,
            breakWallSummary: snapshot?.breakWallSummary ?? null,
            reason
        });
    }
}
