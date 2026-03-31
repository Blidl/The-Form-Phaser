import { Input, Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../../camera/follow_camera';
import type { PfPlayer } from '../../player/PfPlayer';
import type { TestWorldConfig } from './test_world_config';
import { createDefaultTestWorldConfig, parseTestWorldConfigJson } from './test_world_config_validation';
import { TEST_WORLD_EDITOR_PALETTE, type TestWorldEditorBounds, type TestWorldEditorObjectType } from './test_world_editor_adapters';
import { TestWorldEditorSidebar, type TestWorldEditorSidebarSection, type TestWorldEditorSidebarState } from './test_world_editor_sidebar';
import { clearTestWorldEditorDraft, saveTestWorldEditorDraft } from './test_world_editor_storage';
import { TEST_WORLD_HEIGHT, TEST_WORLD_WIDTH, type TestWorldEditorHandle, type TestWorldRuntime } from './test_world_runtime';

export interface TestWorldEditorRuntime {
    update: (deltaMs: number) => void;
    isActive: () => boolean;
    close: () => void;
}

type DragMode = 'move' | 'resize' | 'pan';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface PointerDragState {
    pointerId: number;
    mode: DragMode;
    handle?: ResizeHandle;
    startWorldX: number;
    startWorldY: number;
    startScrollX: number;
    startScrollY: number;
    initialBounds?: TestWorldEditorBounds;
}

const GRID_SIZES = [1, 8, 16, 32] as const;
const RESIZE_HANDLE_SIZE = 10;
const CAMERA_PAN_SPEED = 480;
const ZOOM_STEP = 0.08;
const DRAFT_AUTOSAVE_DELAY_MS = 500;

export const createTestWorldEditorRuntime = (
    scene: Scene,
    worldRuntime: TestWorldRuntime,
    player: PfPlayer,
    initialStatus: string | null = null
): TestWorldEditorRuntime => {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.F2);
    const deleteKey = keyboard.addKey(Input.Keyboard.KeyCodes.DELETE);
    const backspaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.BACKSPACE);
    const duplicateKey = keyboard.addKey(Input.Keyboard.KeyCodes.D);
    const undoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Z);
    const redoKey = keyboard.addKey(Input.Keyboard.KeyCodes.Y);
    const gridKey = keyboard.addKey(Input.Keyboard.KeyCodes.G);
    const focusKey = keyboard.addKey(Input.Keyboard.KeyCodes.F);
    const focusSpawnKey = keyboard.addKey(Input.Keyboard.KeyCodes.P);
    const spaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.SPACE);
    const ctrlKey = keyboard.addKey(Input.Keyboard.KeyCodes.CTRL);
    const leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
    const rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
    const upKey = keyboard.addKey(Input.Keyboard.KeyCodes.UP);
    const downKey = keyboard.addKey(Input.Keyboard.KeyCodes.DOWN);
    const digitKeys = [
        keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Input.Keyboard.KeyCodes.FOUR)
    ];

    const selectionGraphics = scene.add.graphics().setDepth(4990);
    const gridGraphics = scene.add.graphics().setDepth(4985);
    const overlayText = scene.add.text(18, 18, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.45)'
    })
        .setDepth(4995)
        .setScrollFactor(0)
        .setVisible(false);

    const appRoot = document.getElementById('app');
    if (!appRoot) {
        throw new Error('#app was not found.');
    }

    let active = false;
    let selectedHandleId: string | null = null;
    let searchTerm = '';
    let gridEnabled = true;
    let gridSize = 16;
    let status = initialStatus ?? '';
    let autosaveTimer: number | null = null;
    let pointerDragState: PointerDragState | null = null;
    const undoStack: TestWorldConfig[] = [];
    const redoStack: TestWorldConfig[] = [];
    const inspectorColorKeys = new Set<string>([
        'fillColor',
        'strokeColor',
        'triggerFillColor',
        'triggerStrokeColor',
        'deactivateTriggerFillColor',
        'deactivateTriggerStrokeColor',
        'platformFillColor',
        'platformStrokeColor'
    ]);

    const getHandles = (): readonly TestWorldEditorHandle[] => worldRuntime.getEditorHandles();
    const getSelectedHandle = (): TestWorldEditorHandle | null => {
        if (!selectedHandleId) {
            return null;
        }
        return worldRuntime.getEditorHandle(selectedHandleId);
    };
    const getSelectedRootId = (): string | null => getSelectedHandle()?.rootId ?? null;

    const buildSidebarState = (): TestWorldEditorSidebarState => {
        const config = worldRuntime.getConfig();
        const selectedRootId = getSelectedRootId();
        const selectedType = worldRuntime.getEditorObjects().find((entry) => entry.id === selectedRootId)?.type ?? null;
        return {
            visible: active,
            search: searchTerm,
            status,
            canUndo: undoStack.length > 0,
            canRedo: redoStack.length > 0,
            palette: TEST_WORLD_EDITOR_PALETTE,
            objectItems: worldRuntime.getEditorObjects()
                .filter((entry) => {
                    const haystack = `${entry.label} ${entry.type}`.toLowerCase();
                    return searchTerm.trim().length === 0 || haystack.includes(searchTerm.trim().toLowerCase());
                })
                .map((entry) => ({
                    id: entry.id,
                    label: entry.label,
                    type: entry.type,
                    locked: entry.locked,
                    selected: entry.id === selectedRootId
                })),
            inspectorId: selectedRootId,
            inspectorType: selectedType,
            inspectorSections: buildInspectorSections(config, selectedRootId, selectedType),
            selectedLocked: getSelectedHandle()?.isLocked() ?? false
        };
    };

    const sidebar = new TestWorldEditorSidebar(appRoot, {
        onSaveDraft: () => {
            saveDraftNow();
            setStatus('draft saved');
        },
        onExportJson: () => {
            const blob = new Blob([JSON.stringify(worldRuntime.getConfig(), null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'test-world-config.json';
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('exported json');
        },
        onImportJson: (jsonText) => {
            const parsed = parseTestWorldConfigJson(jsonText);
            if (parsed.config === null) {
                setStatus(`import failed: ${parsed.error ?? 'invalid json'}`);
                return;
            }
            pushUndoSnapshot();
            worldRuntime.setConfig(parsed.config);
            redoStack.length = 0;
            selectRoot('player_spawn');
            markConfigDirty();
            setStatus('imported json');
        },
        onResetDefault: () => {
            pushUndoSnapshot();
            worldRuntime.setConfig(createDefaultTestWorldConfig());
            redoStack.length = 0;
            selectRoot('player_spawn');
            markConfigDirty();
            setStatus('reset to default');
        },
        onClearSavedDraft: () => {
            clearTestWorldEditorDraft();
            setStatus('saved draft cleared');
        },
        onCreateObject: (type) => {
            pushUndoSnapshot();
            const center = getCameraCenter();
            const createdId = worldRuntime.createObject(type, center.x, center.y);
            redoStack.length = 0;
            selectRoot(createdId);
            markConfigDirty();
            if (createdId) {
                setStatus(`created ${createdId}`);
            }
        },
        onSearchChange: (search) => {
            searchTerm = search;
            syncSidebar();
        },
        onSelectObject: (id) => {
            selectRoot(id);
        },
        onDuplicateSelected: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            pushUndoSnapshot();
            const duplicatedId = worldRuntime.duplicateObject(rootId);
            redoStack.length = 0;
            selectRoot(duplicatedId);
            markConfigDirty();
        },
        onDeleteSelected: () => {
            deleteSelected();
        },
        onToggleSelectedLock: () => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            const nextLocked = !(getSelectedHandle()?.isLocked() ?? false);
            worldRuntime.setObjectLocked(rootId, nextLocked);
            markConfigDirty();
            setStatus(nextLocked ? 'locked' : 'unlocked');
        },
        onInspectorFieldChange: (key, value) => {
            const rootId = getSelectedRootId();
            if (!rootId) {
                return;
            }
            if (key === 'directionX') {
                value = Number(value);
            }
            if (inspectorColorKeys.has(key)) {
                worldRuntime.patchObjectColors(rootId, { [key]: value });
            } else {
                worldRuntime.patchObjectFields(rootId, { [key]: value });
            }
            markConfigDirty();
        }
    });

    const syncSidebar = (): void => {
        sidebar.setState(buildSidebarState());
    };

    const pushUndoSnapshot = (): void => {
        undoStack.push(worldRuntime.getConfig());
        if (undoStack.length > 100) {
            undoStack.shift();
        }
    };

    const scheduleAutosave = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
        }
        autosaveTimer = window.setTimeout(() => {
            saveDraftNow();
        }, DRAFT_AUTOSAVE_DELAY_MS);
    };

    const saveDraftNow = (): void => {
        if (autosaveTimer !== null) {
            window.clearTimeout(autosaveTimer);
            autosaveTimer = null;
        }
        saveTestWorldEditorDraft(worldRuntime.getConfig());
    };

    const markConfigDirty = (): void => {
        scheduleAutosave();
        syncSidebar();
    };

    const setStatus = (message: string): void => {
        status = message;
        syncSidebar();
    };

    const selectRoot = (rootId: string | null): void => {
        if (!rootId) {
            selectedHandleId = null;
        } else {
            const nextHandle = getHandles().find((entry) => entry.rootId === rootId && entry.part === 'main')
                ?? getHandles().find((entry) => entry.rootId === rootId)
                ?? null;
            selectedHandleId = nextHandle?.id ?? null;
        }
        syncSidebar();
    };

    const snapValue = (value: number): number => {
        if (!gridEnabled || gridSize <= 1) {
            return value;
        }
        return Math.round(value / gridSize) * gridSize;
    };

    const snapBounds = (bounds: TestWorldEditorBounds): TestWorldEditorBounds => ({
        x: snapValue(bounds.x),
        y: snapValue(bounds.y),
        width: Math.max(4, snapValue(bounds.width)),
        height: Math.max(4, snapValue(bounds.height))
    });

    const getCameraCenter = (): { x: number; y: number } => {
        const camera = scene.cameras.main;
        return {
            x: camera.scrollX + (camera.width * 0.5 / camera.zoom),
            y: camera.scrollY + (camera.height * 0.5 / camera.zoom)
        };
    };

    const getResizeHandleAtPointer = (handle: TestWorldEditorHandle, worldX: number, worldY: number): ResizeHandle | null => {
        const bounds = handle.getBounds();
        const points: Array<{ kind: ResizeHandle; x: number; y: number }> = [
            { kind: 'nw', x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'ne', x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
            { kind: 'sw', x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
            { kind: 'se', x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
        ];
        return points.find((point) => Math.abs(worldX - point.x) <= RESIZE_HANDLE_SIZE && Math.abs(worldY - point.y) <= RESIZE_HANDLE_SIZE)?.kind ?? null;
    };

    const beginCameraPan = (pointer: Input.Pointer): void => {
        pointerDragState = {
            pointerId: pointer.id,
            mode: 'pan',
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            startScrollX: scene.cameras.main.scrollX,
            startScrollY: scene.cameras.main.scrollY
        };
    };

    const beginObjectInteraction = (pointer: Input.Pointer): void => {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const selectedHandle = getSelectedHandle();
        if (selectedHandle && !selectedHandle.isLocked()) {
            const resizeHandle = getResizeHandleAtPointer(selectedHandle, worldX, worldY);
            if (resizeHandle) {
                pushUndoSnapshot();
                pointerDragState = {
                    pointerId: pointer.id,
                    mode: 'resize',
                    handle: resizeHandle,
                    startWorldX: worldX,
                    startWorldY: worldY,
                    startScrollX: 0,
                    startScrollY: 0,
                    initialBounds: selectedHandle.getBounds()
                };
                return;
            }
        }

        const hit = [...getHandles()].reverse().find((entry) => entry.containsPoint(worldX, worldY)) ?? null;
        if (!hit) {
            selectedHandleId = null;
            syncSidebar();
            return;
        }

        selectedHandleId = hit.id;
        syncSidebar();
        if (hit.isLocked()) {
            return;
        }
        pushUndoSnapshot();
        pointerDragState = {
            pointerId: pointer.id,
            mode: 'move',
            startWorldX: worldX,
            startWorldY: worldY,
            startScrollX: 0,
            startScrollY: 0,
            initialBounds: hit.getBounds()
        };
    };

    const applyPointerDrag = (): void => {
        if (!pointerDragState) {
            return;
        }
        const pointer = scene.input.activePointer;
        if (!pointer.isDown || pointer.id !== pointerDragState.pointerId) {
            return;
        }
        if (pointerDragState.mode === 'pan') {
            scene.cameras.main.scrollX = pointerDragState.startScrollX - (pointer.worldX - pointerDragState.startWorldX);
            scene.cameras.main.scrollY = pointerDragState.startScrollY - (pointer.worldY - pointerDragState.startWorldY);
            return;
        }

        const selectedHandle = getSelectedHandle();
        if (!selectedHandle || !pointerDragState.initialBounds) {
            return;
        }
        const dx = pointer.worldX - pointerDragState.startWorldX;
        const dy = pointer.worldY - pointerDragState.startWorldY;
        const nextBounds = { ...pointerDragState.initialBounds };
        if (pointerDragState.mode === 'move') {
            nextBounds.x += dx;
            nextBounds.y += dy;
        } else {
            const signX = pointerDragState.handle === 'ne' || pointerDragState.handle === 'se' ? 1 : -1;
            const signY = pointerDragState.handle === 'sw' || pointerDragState.handle === 'se' ? 1 : -1;
            nextBounds.width = Math.max(4, pointerDragState.initialBounds.width + (dx * signX));
            nextBounds.height = Math.max(4, pointerDragState.initialBounds.height + (dy * signY));
            nextBounds.x = pointerDragState.initialBounds.x + ((dx * 0.5) * signX);
            nextBounds.y = pointerDragState.initialBounds.y + ((dy * 0.5) * signY);
        }
        worldRuntime.patchObjectBounds(selectedHandle.id, snapBounds(nextBounds));
        markConfigDirty();
    };

    const deleteSelected = (): void => {
        const rootId = getSelectedRootId();
        if (!rootId || rootId === 'player_spawn') {
            return;
        }
        pushUndoSnapshot();
        worldRuntime.removeObject(rootId);
        redoStack.length = 0;
        selectedHandleId = null;
        markConfigDirty();
        setStatus(`deleted ${rootId}`);
    };

    const focusTarget = (id: string): void => {
        const point = worldRuntime.focusObjectPoint(id);
        if (!point) {
            return;
        }
        scene.cameras.main.centerOn(point.x, point.y);
    };

    const toggleEditor = (): void => {
        active = !active;
        overlayText.setVisible(active);
        if (active) {
            scene.cameras.main.stopFollow();
            setStatus('editor mode on');
        } else {
            pointerDragState = null;
            setupBaselineFollowCamera(scene, player.arcadeBodyObject, {
                width: TEST_WORLD_WIDTH,
                height: TEST_WORLD_HEIGHT
            });
            setStatus('editor mode off');
        }
        syncSidebar();
    };

    scene.input.on('pointerdown', (pointer: Input.Pointer) => {
        if (!active) {
            return;
        }
        if (pointer.middleButtonDown() || (pointer.button === 0 && spaceKey.isDown)) {
            beginCameraPan(pointer);
            return;
        }
        if (pointer.button === 0) {
            beginObjectInteraction(pointer);
        }
    });

    scene.input.on('pointerup', () => {
        pointerDragState = null;
    });

    scene.input.on('wheel', (_pointer: Input.Pointer, _gameObjects: unknown, _dx: number, dy: number) => {
        if (!active) {
            return;
        }
        const camera = scene.cameras.main;
        camera.setZoom(Math.max(0.25, Math.min(2.5, camera.zoom - (Math.sign(dy) * ZOOM_STEP))));
    });

    syncSidebar();

    return {
        update: (deltaMs: number): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleEditor();
            }
            if (!active) {
                selectionGraphics.clear();
                gridGraphics.clear();
                overlayText.setVisible(false);
                return;
            }

            overlayText.setText([
                'F2 toggle  Del delete  Ctrl+D duplicate  Ctrl+Z/Y undo redo',
                `LMB select/move  drag corners resize  wheel zoom  middle or Space+drag pan`,
                `Arrows pan camera  G grid  1/2/3/4 = ${GRID_SIZES.join('/')}  F focus  P spawn`
            ].join('\n'));

            digitKeys.forEach((key, index) => {
                if (Input.Keyboard.JustDown(key)) {
                    gridSize = GRID_SIZES[index] ?? gridSize;
                    setStatus(`grid ${gridSize}`);
                }
            });
            if (Input.Keyboard.JustDown(gridKey)) {
                gridEnabled = !gridEnabled;
                setStatus(gridEnabled ? 'grid on' : 'grid off');
            }
            if (Input.Keyboard.JustDown(deleteKey) || Input.Keyboard.JustDown(backspaceKey)) {
                deleteSelected();
            }
            if (ctrlKey.isDown && Input.Keyboard.JustDown(duplicateKey)) {
                const rootId = getSelectedRootId();
                if (rootId) {
                    pushUndoSnapshot();
                    const duplicatedId = worldRuntime.duplicateObject(rootId);
                    redoStack.length = 0;
                    selectRoot(duplicatedId);
                    markConfigDirty();
                }
            }
            if (ctrlKey.isDown && Input.Keyboard.JustDown(undoKey) && undoStack.length > 0) {
                const previous = undoStack.pop();
                if (previous) {
                    redoStack.push(worldRuntime.getConfig());
                    worldRuntime.setConfig(previous);
                    syncSidebar();
                }
            }
            if (ctrlKey.isDown && Input.Keyboard.JustDown(redoKey) && redoStack.length > 0) {
                const next = redoStack.pop();
                if (next) {
                    undoStack.push(worldRuntime.getConfig());
                    worldRuntime.setConfig(next);
                    syncSidebar();
                }
            }
            if (Input.Keyboard.JustDown(focusKey)) {
                const rootId = getSelectedRootId();
                if (rootId) {
                    focusTarget(rootId);
                }
            }
            if (Input.Keyboard.JustDown(focusSpawnKey)) {
                focusTarget('player_spawn');
            }

            const camera = scene.cameras.main;
            const panStep = (CAMERA_PAN_SPEED * deltaMs) / 1000;
            if (leftKey.isDown) {
                camera.scrollX -= panStep;
            }
            if (rightKey.isDown) {
                camera.scrollX += panStep;
            }
            if (upKey.isDown) {
                camera.scrollY -= panStep;
            }
            if (downKey.isDown) {
                camera.scrollY += panStep;
            }

            applyPointerDrag();
            drawGrid(gridGraphics, camera, gridEnabled ? gridSize : 0);
            drawSelection(selectionGraphics, getSelectedHandle());
        },
        isActive: (): boolean => active,
        close: (): void => {
            if (!active) {
                return;
            }
            toggleEditor();
        }
    };
};

const drawSelection = (graphics: Phaser.GameObjects.Graphics, handle: TestWorldEditorHandle | null): void => {
    graphics.clear();
    if (!handle) {
        return;
    }
    const bounds = handle.getBounds();
    graphics.lineStyle(2, 0xffeb3b, 1);
    graphics.strokeRect(bounds.x - (bounds.width * 0.5), bounds.y - (bounds.height * 0.5), bounds.width, bounds.height);
    const points = [
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y - (bounds.height * 0.5) },
        { x: bounds.x - (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) },
        { x: bounds.x + (bounds.width * 0.5), y: bounds.y + (bounds.height * 0.5) }
    ];
    points.forEach((point) => {
        graphics.fillStyle(0xffeb3b, 1);
        graphics.fillRect(point.x - 4, point.y - 4, 8, 8);
    });
};

const drawGrid = (graphics: Phaser.GameObjects.Graphics, camera: Phaser.Cameras.Scene2D.Camera, gridSize: number): void => {
    graphics.clear();
    if (gridSize <= 1) {
        return;
    }
    const left = Math.floor(camera.worldView.left / gridSize) * gridSize;
    const right = Math.ceil(camera.worldView.right / gridSize) * gridSize;
    const top = Math.floor(camera.worldView.top / gridSize) * gridSize;
    const bottom = Math.ceil(camera.worldView.bottom / gridSize) * gridSize;
    graphics.lineStyle(1, 0xffffff, 0.08);
    for (let x = left; x <= right; x += gridSize) {
        graphics.moveTo(x, top);
        graphics.lineTo(x, bottom);
    }
    for (let y = top; y <= bottom; y += gridSize) {
        graphics.moveTo(left, y);
        graphics.lineTo(right, y);
    }
    graphics.strokePath();
};

const buildInspectorSections = (
    config: TestWorldConfig,
    rootId: string | null,
    type: TestWorldEditorObjectType | null
): TestWorldEditorSidebarSection[] => {
    if (!rootId || !type) {
        return [];
    }

    if (type === 'playerSpawn') {
        return [{
            title: 'Transform',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: config.playerSpawn.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: config.playerSpawn.y, step: 1 },
                { key: 'width', label: 'Width', input: 'number', value: config.playerSpawn.width, min: 8, step: 1 },
                { key: 'height', label: 'Height', input: 'number', value: config.playerSpawn.height, min: 8, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: config.playerSpawn.fillColor ?? 0x81d4fa },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: config.playerSpawn.strokeColor ?? 0x0277bd }
            ]
        }];
    }

    const findById = <T extends { id: string }>(items: readonly T[]): T | null => items.find((entry) => entry.id === rootId) ?? null;
    const rectSection = (entry: { x: number; y: number; width: number; height: number; fillColor?: number; strokeColor?: number }): TestWorldEditorSidebarSection => ({
        title: 'Bounds',
        fields: [
            { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
            { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
            { key: 'width', label: 'Width', input: 'number', value: entry.width, min: 8, step: 1 },
            { key: 'height', label: 'Height', input: 'number', value: entry.height, min: 8, step: 1 },
            { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0x999999 },
            { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffffff }
        ]
    });

    if (type === 'surface') {
        const entry = findById(config.surfaces);
        return entry ? [rectSection(entry)] : [];
    }
    if (type === 'hazard') {
        const entry = findById(config.hazards);
        return entry ? [rectSection(entry)] : [];
    }
    if (type === 'checkpoint') {
        const entry = findById(config.checkpoints);
        return entry ? [rectSection(entry), {
            title: 'Checkpoint',
            fields: [
                { key: 'respawnX', label: 'Respawn X', input: 'number', value: entry.respawnX, step: 1 },
                { key: 'respawnY', label: 'Respawn Y', input: 'number', value: entry.respawnY, step: 1 }
            ]
        }] : [];
    }
    if (type === 'movingPlatform') {
        const entry = findById(config.movingPlatforms);
        return entry ? [rectSection(entry), {
            title: 'Platform',
            fields: [
                { key: 'axis', label: 'Axis', input: 'select', value: entry.axis, options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }] },
                { key: 'travelDistance', label: 'Travel', input: 'number', value: entry.travelDistance, min: 0, step: 1 },
                { key: 'speed', label: 'Speed', input: 'number', value: entry.speed, min: 0, step: 1 }
            ]
        }] : [];
    }
    if (type === 'dragBox') {
        const entry = findById(config.dragBoxes);
        return entry ? [rectSection(entry), {
            title: 'Drag Box',
            fields: [
                { key: 'targetTriggerPlatformId', label: 'Target Trigger', input: 'text', value: entry.targetTriggerPlatformId ?? '' },
                { key: 'gravityY', label: 'Gravity Y', input: 'number', value: entry.gravityY ?? 2200, min: 0, step: 1 },
                { key: 'mass', label: 'Mass', input: 'number', value: entry.mass ?? 10, min: 1, step: 1 },
                { key: 'pullAcceleration', label: 'Pull Accel', input: 'number', value: entry.pullAcceleration ?? 1400, min: 0, step: 1 },
                { key: 'pullMaxSpeed', label: 'Pull Max Speed', input: 'number', value: entry.pullMaxSpeed ?? 150, min: 0, step: 1 },
                { key: 'dragX', label: 'Drag X', input: 'number', value: entry.dragX ?? 900, min: 0, step: 1 }
            ]
        }] : [];
    }
    if (type === 'windZone') {
        const entry = findById(config.windZones);
        return entry ? [rectSection(entry), {
            title: 'Wind',
            fields: [
                { key: 'directionX', label: 'Direction', input: 'select', value: String(entry.directionX), options: [{ value: '1', label: 'Right' }, { value: '-1', label: 'Left' }] },
                { key: 'force', label: 'Force', input: 'number', value: entry.force, min: 0, step: 1 }
            ]
        }] : [];
    }
    if (type === 'triangleFlightBreakWall') {
        const entry = findById(config.triangleFlightBreakWalls);
        return entry ? [rectSection(entry)] : [];
    }
    if (type === 'trianglePickup') {
        const entry = findById(config.trianglePickups);
        return entry ? [{
            title: 'Pickup',
            fields: [
                { key: 'x', label: 'X', input: 'number', value: entry.x, step: 1 },
                { key: 'y', label: 'Y', input: 'number', value: entry.y, step: 1 },
                { key: 'radius', label: 'Radius', input: 'number', value: entry.radius, min: 4, step: 1 },
                { key: 'fillColor', label: 'Fill', input: 'color', value: entry.fillColor ?? 0xfff59d },
                { key: 'strokeColor', label: 'Stroke', input: 'color', value: entry.strokeColor ?? 0xffca28 }
            ]
        }] : [];
    }
    if (type === 'triggerPlatform') {
        const entry = findById(config.triggerPlatforms);
        return entry ? [
            {
                title: 'Trigger',
                fields: [
                    { key: 'triggerX', label: 'X', input: 'number', value: entry.triggerX, step: 1 },
                    { key: 'triggerY', label: 'Y', input: 'number', value: entry.triggerY, step: 1 },
                    { key: 'triggerWidth', label: 'Width', input: 'number', value: entry.triggerWidth, min: 8, step: 1 },
                    { key: 'triggerHeight', label: 'Height', input: 'number', value: entry.triggerHeight, min: 8, step: 1 },
                    { key: 'triggerFillColor', label: 'Fill', input: 'color', value: entry.triggerFillColor ?? 0xfff59d },
                    { key: 'triggerStrokeColor', label: 'Stroke', input: 'color', value: entry.triggerStrokeColor ?? 0xf9a825 }
                ]
            },
            {
                title: 'Deactivate Trigger',
                fields: [
                    { key: 'deactivateTriggerX', label: 'X', input: 'number', value: entry.deactivateTriggerX ?? 0, step: 1 },
                    { key: 'deactivateTriggerY', label: 'Y', input: 'number', value: entry.deactivateTriggerY ?? 0, step: 1 },
                    { key: 'deactivateTriggerWidth', label: 'Width', input: 'number', value: entry.deactivateTriggerWidth ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerHeight', label: 'Height', input: 'number', value: entry.deactivateTriggerHeight ?? 8, min: 8, step: 1 },
                    { key: 'deactivateTriggerFillColor', label: 'Fill', input: 'color', value: entry.deactivateTriggerFillColor ?? 0xffccbc },
                    { key: 'deactivateTriggerStrokeColor', label: 'Stroke', input: 'color', value: entry.deactivateTriggerStrokeColor ?? 0xe64a19 }
                ]
            },
            {
                title: 'Platform',
                fields: [
                    { key: 'platformX', label: 'X', input: 'number', value: entry.platformX, step: 1 },
                    { key: 'platformY', label: 'Y', input: 'number', value: entry.platformY, step: 1 },
                    { key: 'platformWidth', label: 'Width', input: 'number', value: entry.platformWidth, min: 8, step: 1 },
                    { key: 'platformHeight', label: 'Height', input: 'number', value: entry.platformHeight, min: 8, step: 1 },
                    { key: 'platformFillColor', label: 'Fill', input: 'color', value: entry.platformFillColor ?? 0x616161 },
                    { key: 'platformStrokeColor', label: 'Stroke', input: 'color', value: entry.platformStrokeColor ?? 0xb0bec5 },
                    { key: 'activator', label: 'Activator', input: 'select', value: entry.activator ?? 'player', options: [{ value: 'player', label: 'Player' }, { value: 'drag_box', label: 'Drag Box' }] }
                ]
            }
        ] : [];
    }
    return [];
};
