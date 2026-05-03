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
            }
        });

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
        this.renderActiveModeInspectors();
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
}
