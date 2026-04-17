import { Input, type Scene } from 'phaser';
import type { PlayerWorldActor } from '../../game/player/player_runtime_contracts';
import type { PlayerRespawnRuntime } from '../../game/world/runtime/player_respawn_runtime';
import { getAdjacentCampaignLevelId } from '../../game/world/runtime/test_campaign_registry';
import type { TestWorldRuntime } from '../../game/world/runtime/test_world_runtime';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';
import { startLevelScene } from '../../scenes/demo_flow';
import { applyDomAnchorLayout, TEST_DEV_HELPER_LAYOUT } from './test_hud_layout';

export interface TestDevHelperRuntime {
    update: () => boolean;
    destroy: () => void;
}

interface CreateTestDevHelperRuntimeParams {
    scene: Scene;
    player: PlayerWorldActor;
    worldRuntime: TestWorldRuntime;
    respawnRuntime: PlayerRespawnRuntime;
    isEditorActive: () => boolean;
}

export const createTestDevHelperRuntime = (
    params: CreateTestDevHelperRuntimeParams
): TestDevHelperRuntime => {
    const { scene, player, worldRuntime, respawnRuntime, isEditorActive } = params;
    if (!import.meta.env.DEV) {
        return {
            update: () => false,
            destroy: () => {
                // No-op in production builds.
            }
        };
    }

    const keyboard = scene.input.keyboard;
    const appRoot = document.getElementById('app');
    if (!keyboard || !appRoot) {
        return {
            update: () => false,
            destroy: () => {
                // Missing dev-only dependencies, keep runtime inert.
            }
        };
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.NUMPAD_ADD);
    relaxKeyboardCapture(keyboard, [Input.Keyboard.KeyCodes.NUMPAD_ADD]);

    const overlay = document.createElement('div');
    overlay.setAttribute('data-dev-helper-overlay', 'true');
    overlay.style.position = 'absolute';
    applyDomAnchorLayout(overlay, TEST_DEV_HELPER_LAYOUT);
    overlay.style.zIndex = '30';
    overlay.style.display = 'none';
    overlay.style.minWidth = '240px';
    overlay.style.padding = '12px';
    overlay.style.border = '1px solid rgba(255,255,255,0.18)';
    overlay.style.borderRadius = '12px';
    overlay.style.background = 'rgba(7, 14, 18, 0.88)';
    overlay.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.28)';
    overlay.style.color = '#f3fbff';
    overlay.style.fontFamily = 'monospace';
    overlay.style.fontSize = '12px';
    overlay.style.pointerEvents = 'auto';

    const title = document.createElement('div');
    title.textContent = 'Dev Helper';
    title.style.marginBottom = '10px';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '0.06em';
    title.style.textTransform = 'uppercase';

    const levelMeta = document.createElement('div');
    levelMeta.style.marginBottom = '10px';
    levelMeta.style.whiteSpace = 'pre-line';

    const actions = document.createElement('div');
    actions.style.display = 'grid';
    actions.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    actions.style.gap = '8px';
    actions.style.marginBottom = '10px';

    const previousButton = createOverlayButton('Prev Level');
    const nextButton = createOverlayButton('Next Level');
    const clickSpawnButton = createOverlayButton('Click Spawn: Off');
    clickSpawnButton.style.gridColumn = '1 / -1';

    actions.append(previousButton, nextButton, clickSpawnButton);

    const hint = document.createElement('div');
    hint.style.opacity = '0.8';
    hint.style.lineHeight = '1.45';
    hint.textContent = 'Numpad + toggle\nCanvas click teleports only while Click Spawn is on';

    overlay.append(title, levelMeta, actions, hint);
    appRoot.appendChild(overlay);

    let visible = false;
    let clickSpawnEnabled = false;
    let destroyed = false;
    let queuedLevelId: string | null = null;
    let statusMessage = 'overlay ready';

    const syncOverlay = (): void => {
        const currentLevelId = worldRuntime.getLevelId();
        const previousLevelId = getAdjacentCampaignLevelId(currentLevelId, -1);
        const nextLevelId = getAdjacentCampaignLevelId(currentLevelId, 1);
        applyDomAnchorLayout(overlay, TEST_DEV_HELPER_LAYOUT);
        overlay.style.display = visible ? 'block' : 'none';
        levelMeta.textContent = [
            `Level: ${currentLevelId}`,
            `Click Spawn: ${clickSpawnEnabled ? 'armed' : 'off'}`,
            `Status: ${statusMessage}`
        ].join('\n');
        previousButton.disabled = previousLevelId === null;
        nextButton.disabled = nextLevelId === null;
        clickSpawnButton.textContent = clickSpawnEnabled ? 'Click Spawn: On' : 'Click Spawn: Off';
    };

    const setVisible = (nextVisible: boolean): void => {
        visible = nextVisible;
        if (!visible) {
            clickSpawnEnabled = false;
            statusMessage = 'overlay hidden';
        } else {
            statusMessage = 'overlay visible';
        }
        syncOverlay();
    };

    const queueLevelJump = (direction: -1 | 1): void => {
        const targetLevelId = getAdjacentCampaignLevelId(worldRuntime.getLevelId(), direction);
        if (!targetLevelId) {
            statusMessage = direction < 0 ? 'no previous level' : 'no next level';
            syncOverlay();
            return;
        }

        queuedLevelId = targetLevelId;
        statusMessage = `queued ${targetLevelId}`;
        syncOverlay();
    };

    const toggleClickSpawn = (): void => {
        clickSpawnEnabled = !clickSpawnEnabled;
        statusMessage = clickSpawnEnabled ? 'click-spawn armed' : 'click-spawn off';
        syncOverlay();
    };

    const getWorldPointFromClientPosition = (clientX: number, clientY: number): { x: number; y: number } | null => {
        const canvas = scene.game.canvas;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        const canvasX = (clientX - rect.left) * (canvas.width / rect.width);
        const canvasY = (clientY - rect.top) * (canvas.height / rect.height);
        return scene.cameras.main.getWorldPoint(canvasX, canvasY);
    };

    const handleCanvasPointerDown = (event: PointerEvent): void => {
        if (
            destroyed
            || !visible
            || !clickSpawnEnabled
            || event.button !== 0
            || scene.scene.isPaused(scene.scene.key)
            || isEditorActive()
            || isDomTextInputFocused()
            || respawnRuntime.isRespawnInProgress()
        ) {
            return;
        }

        const worldPoint = getWorldPointFromClientPosition(event.clientX, event.clientY);
        if (!worldPoint) {
            return;
        }

        respawnRuntime.setRespawnPoint(worldPoint);
        player.respawnAt(worldPoint.x, worldPoint.y);
        statusMessage = `teleported to ${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)}`;
        syncOverlay();
    };

    previousButton.addEventListener('click', () => {
        queueLevelJump(-1);
    });
    nextButton.addEventListener('click', () => {
        queueLevelJump(1);
    });
    clickSpawnButton.addEventListener('click', () => {
        toggleClickSpawn();
    });
    scene.game.canvas.addEventListener('pointerdown', handleCanvasPointerDown);

    const destroy = (): void => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        scene.game.canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
        overlay.remove();
    };

    scene.events.once('shutdown', destroy);
    scene.events.once('destroy', destroy);
    syncOverlay();

    return {
        update: (): boolean => {
            if (!isDomTextInputFocused() && Input.Keyboard.JustDown(toggleKey)) {
                setVisible(!visible);
            }

            if (queuedLevelId) {
                const nextLevelId = queuedLevelId;
                queuedLevelId = null;
                startLevelScene(scene, {
                    levelId: nextLevelId,
                    editorOpen: isEditorActive()
                });
                return true;
            }

            return false;
        },
        destroy
    };
};

const createOverlayButton = (label: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.padding = '8px 10px';
    button.style.border = '1px solid rgba(155, 227, 255, 0.28)';
    button.style.borderRadius = '8px';
    button.style.background = 'rgba(117, 210, 255, 0.12)';
    button.style.color = '#f3fbff';
    button.style.cursor = 'pointer';
    button.style.font = 'inherit';
    return button;
};
