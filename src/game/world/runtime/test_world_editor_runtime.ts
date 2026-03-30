import { Input, Scene, type GameObjects } from 'phaser';
import type {
    TestWorldEditableBounds,
    TestWorldEditableElement,
    TestWorldEditableElementKind,
    TestWorldRuntime
} from './test_world_runtime';

export interface TestWorldEditorRuntime {
    update: (deltaMs: number) => void;
    isActive: () => boolean;
}

const BRUSH_TYPES: TestWorldEditableElementKind[] = [
    'surface',
    'hazard',
    'checkpoint',
    'moving_platform',
    'trigger_platform_trigger',
    'wind_zone',
    'triangle_pickup'
];

export const createTestWorldEditorRuntime = (
    scene: Scene,
    worldRuntime: TestWorldRuntime
): TestWorldEditorRuntime => {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.F2);
    const exportKey = keyboard.addKey(Input.Keyboard.KeyCodes.F3);
    const addKey = keyboard.addKey(Input.Keyboard.KeyCodes.N);
    const deleteKey = keyboard.addKey(Input.Keyboard.KeyCodes.DELETE);
    const backspaceKey = keyboard.addKey(Input.Keyboard.KeyCodes.BACKSPACE);
    const leftKey = keyboard.addKey(Input.Keyboard.KeyCodes.LEFT);
    const rightKey = keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT);
    const upKey = keyboard.addKey(Input.Keyboard.KeyCodes.UP);
    const downKey = keyboard.addKey(Input.Keyboard.KeyCodes.DOWN);
    const shiftKey = keyboard.addKey(Input.Keyboard.KeyCodes.SHIFT);
    const ctrlKey = keyboard.addKey(Input.Keyboard.KeyCodes.CTRL);
    const digitKeys = [
        keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Input.Keyboard.KeyCodes.FOUR),
        keyboard.addKey(Input.Keyboard.KeyCodes.FIVE),
        keyboard.addKey(Input.Keyboard.KeyCodes.SIX),
        keyboard.addKey(Input.Keyboard.KeyCodes.SEVEN)
    ];
    const selectionGraphics = scene.add.graphics().setDepth(4990);
    const overlayText = scene.add.text(18, 18, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.45)'
    })
        .setDepth(4995)
        .setScrollFactor(0)
        .setVisible(false);
    const statusText = scene.add.text(18, 118, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffe082',
        backgroundColor: 'rgba(0, 0, 0, 0.35)'
    })
        .setDepth(4995)
        .setScrollFactor(0)
        .setVisible(false);

    let active = false;
    let selectedId: string | null = null;
    let brushKind: TestWorldEditableElementKind = 'surface';
    let dragState: {
        pointerId: number;
        offsetX: number;
        offsetY: number;
    } | null = null;
    let statusMessage = '';
    let statusMessageMs = 0;

    const getEditableElements = (): readonly TestWorldEditableElement[] => {
        return worldRuntime.getEditableElements();
    };

    const getSelectedElement = (): TestWorldEditableElement | null => {
        if (selectedId === null) {
            return null;
        }

        return getEditableElements().find((entry) => entry.id === selectedId) ?? null;
    };

    const setStatus = (message: string, durationMs: number = 1800): void => {
        statusMessage = message;
        statusMessageMs = durationMs;
        statusText.setText(message);
        statusText.setVisible(active && message.length > 0);
    };

    const selectTopmostAtPointer = (): void => {
        const pointer = scene.input.activePointer;
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const hit = [...getEditableElements()].reverse().find((entry) => entry.containsPoint(worldX, worldY)) ?? null;
        selectedId = hit?.id ?? null;
        if (hit !== null) {
            const bounds = hit.getBounds();
            dragState = {
                pointerId: pointer.id,
                offsetX: worldX - bounds.x,
                offsetY: worldY - bounds.y
            };
            return;
        }

        dragState = null;
    };

    const toggleEditor = (): void => {
        active = !active;
        overlayText.setVisible(active);
        statusText.setVisible(active && statusMessage.length > 0);
        if (!active) {
            dragState = null;
            worldRuntime.rebuildFromCurrentConfig();
            return;
        }

        setStatus('edit mode on');
    };

    scene.input.on('pointerdown', (pointer: Input.Pointer) => {
        if (!active || pointer.button !== 0) {
            return;
        }

        selectTopmostAtPointer();
    });

    scene.input.on('pointerup', (pointer: Input.Pointer) => {
        if (!active || dragState?.pointerId !== pointer.id) {
            return;
        }

        dragState = null;
    });

    const applyMoveOrResize = (
        element: TestWorldEditableElement,
        deltaX: number,
        deltaY: number,
        resize: boolean
    ): void => {
        const bounds = element.getBounds();
        const nextBounds: TestWorldEditableBounds = resize
            ? {
                x: bounds.x,
                y: bounds.y,
                width: Math.max(8, bounds.width + deltaX),
                height: Math.max(8, bounds.height + deltaY)
            }
            : {
                x: bounds.x + deltaX,
                y: bounds.y + deltaY,
                width: bounds.width,
                height: bounds.height
            };
        element.setBounds(nextBounds);
    };

    const exportConfig = async (): Promise<void> => {
        const configText = JSON.stringify(worldRuntime.getConfig(), null, 2);
        try {
            await navigator.clipboard.writeText(configText);
            setStatus('world config copied to clipboard');
        } catch {
            setStatus('clipboard export failed');
        }
    };

    return {
        update: (_deltaMs: number): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleEditor();
            }

            if (!active) {
                selectionGraphics.clear();
                overlayText.setVisible(false);
                statusText.setVisible(false);
                return;
            }

            overlayText.setText([
                `EDITOR F2 exit/apply  F3 copy-config`,
                `LMB select+drag  Arrows move  Ctrl+Arrows resize`,
                `N add  Del remove  Brush: ${brushKind}`,
                `1 surface 2 hazard 3 checkpoint 4 moving 5 trigger 6 wind 7 pickup`
            ].join('\n'));

            digitKeys.forEach((key, index) => {
                if (Input.Keyboard.JustDown(key)) {
                    brushKind = BRUSH_TYPES[index] ?? brushKind;
                    setStatus(`brush: ${brushKind}`);
                }
            });

            if (Input.Keyboard.JustDown(exportKey)) {
                void exportConfig();
            }

            if (Input.Keyboard.JustDown(addKey)) {
                const newId = worldRuntime.addElement(brushKind, scene.input.activePointer.worldX, scene.input.activePointer.worldY);
                if (newId !== null) {
                    selectedId = newId;
                    setStatus(`added: ${newId}`);
                }
            }

            if (Input.Keyboard.JustDown(deleteKey) || Input.Keyboard.JustDown(backspaceKey)) {
                if (selectedId !== null) {
                    worldRuntime.removeElement(selectedId);
                    setStatus(`removed: ${selectedId}`);
                    selectedId = null;
                    dragState = null;
                }
            }

            const selectedElement = getSelectedElement();
            if (dragState !== null && selectedElement !== null && scene.input.activePointer.isDown) {
                const currentBounds = selectedElement.getBounds();
                selectedElement.setBounds({
                    x: scene.input.activePointer.worldX - dragState.offsetX,
                    y: scene.input.activePointer.worldY - dragState.offsetY,
                    width: currentBounds.width,
                    height: currentBounds.height
                });
            }

            if (selectedElement !== null) {
                const pointerStep = shiftKey.isDown ? 8 : 1;
                const resize = ctrlKey.isDown;
                if (keyboard.checkDown(leftKey, 0)) {
                    applyMoveOrResize(selectedElement, -pointerStep, 0, resize);
                }
                if (keyboard.checkDown(rightKey, 0)) {
                    applyMoveOrResize(selectedElement, pointerStep, 0, resize);
                }
                if (keyboard.checkDown(upKey, 0)) {
                    applyMoveOrResize(selectedElement, 0, -pointerStep, resize);
                }
                if (keyboard.checkDown(downKey, 0)) {
                    applyMoveOrResize(selectedElement, 0, pointerStep, resize);
                }
            }

            selectionGraphics.clear();
            if (selectedElement !== null) {
                const bounds = selectedElement.getBounds();
                selectionGraphics.lineStyle(2, 0xffeb3b, 1);
                selectionGraphics.strokeRect(
                    bounds.x - (bounds.width * 0.5),
                    bounds.y - (bounds.height * 0.5),
                    bounds.width,
                    bounds.height
                );
            }

            if (statusMessageMs > 0) {
                statusMessageMs = Math.max(0, statusMessageMs - _deltaMs);
            } else if (statusMessage.length > 0) {
                statusMessage = '';
                statusText.setText('');
                statusText.setVisible(false);
            }
        },
        isActive: (): boolean => {
            return active;
        }
    };
};
