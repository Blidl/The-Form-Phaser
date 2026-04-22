import { Input, type Scene } from 'phaser';
import type { PlayerDebugModel } from '../../game/player/player_runtime_contracts';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';
import { createTestDebugDrawRuntime } from './test_debug_draw_runtime';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';
import type { TestNpcDebugEntry, TestNpcInteractionDebugState } from '../../game/npc/npc_types';
import type { TestCutsceneDebugState } from '../../game/cutscene/cutscene_types';
import type { TestCutsceneRequestResult } from '../../game/cutscene/cutscene_types';

type DebugDockTabId = 'interaction' | 'npc' | 'player' | 'log';

interface CreateTestDebugRuntimeParams {
    scene: Scene;
    player: PlayerDebugModel;
    setPlayerDebugVisualsVisible: (visible: boolean) => void;
    getHazards: () => readonly HazardObject[];
    getNpcDebugEntries: () => readonly TestNpcDebugEntry[];
    getNpcInteractionDebugState: () => TestNpcInteractionDebugState;
    getCutsceneDebugState: () => TestCutsceneDebugState;
}

const DEBUG_DOCK_TABS: readonly { id: DebugDockTabId; label: string }[] = [
    { id: 'interaction', label: 'Interaction' },
    { id: 'npc', label: 'NPC' },
    { id: 'player', label: 'Player' },
    { id: 'log', label: 'Log' }
] as const;
const DEBUG_LOG_MAX_ENTRIES = 8;
const DEBUG_DOCK_MIN_WIDTH = 220;
const DEBUG_DOCK_TARGET_WIDTH = 360;
const DEBUG_DOCK_MAX_WIDTH = 420;
const DEBUG_DOCK_VIEWPORT_MARGIN = 12;
const DEBUG_DOCK_TOP_OFFSET = 110;
const DEBUG_DOCK_BOTTOM_MARGIN = 18;
const CUTSCENE_TOAST_DURATION_MS = 1800;

interface CutsceneDebugFeedbackPayload {
    result?: unknown;
    cutsceneRef?: unknown;
    sourceDetail?: unknown;
    failureReason?: unknown;
}

export const createTestDebugRuntime = (params: CreateTestDebugRuntimeParams): TestDebugRuntime => {
    const { scene, player, setPlayerDebugVisualsVisible, getHazards, getNpcDebugEntries, getNpcInteractionDebugState, getCutsceneDebugState } = params;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.NINE);
    const tabKeys = [
        keyboard.addKey(Input.Keyboard.KeyCodes.ONE),
        keyboard.addKey(Input.Keyboard.KeyCodes.TWO),
        keyboard.addKey(Input.Keyboard.KeyCodes.THREE),
        keyboard.addKey(Input.Keyboard.KeyCodes.FOUR)
    ];
    relaxKeyboardCapture(keyboard, [
        Input.Keyboard.KeyCodes.NINE,
        Input.Keyboard.KeyCodes.ONE,
        Input.Keyboard.KeyCodes.TWO,
        Input.Keyboard.KeyCodes.THREE,
        Input.Keyboard.KeyCodes.FOUR
    ]);

    const debugDrawRuntime = createTestDebugDrawRuntime({
        scene,
        player,
        getHazards
    });

    const root = document.createElement('div');
    root.id = 'test-debug-dock';
    root.style.position = 'fixed';
    root.style.zIndex = '6002';
    root.style.display = 'none';
    root.style.pointerEvents = 'auto';
    root.style.background = 'rgba(4, 17, 22, 0.92)';
    root.style.border = '1px solid rgba(42, 91, 99, 0.95)';
    root.style.borderRadius = '8px';
    root.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.24)';
    root.style.color = '#d7fff2';
    root.style.fontFamily = 'monospace';
    root.style.padding = '10px';
    root.style.overflow = 'hidden';
    root.style.backdropFilter = 'blur(2px)';

    const title = document.createElement('div');
    title.textContent = 'Debug Dock';
    title.style.fontSize = '13px';
    title.style.fontWeight = '700';
    title.style.color = '#f4fff8';
    title.style.marginBottom = '8px';

    const tabs = document.createElement('div');
    tabs.style.display = 'grid';
    tabs.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    tabs.style.gap = '6px';
    tabs.style.marginBottom = '10px';

    const status = document.createElement('div');
    status.style.whiteSpace = 'pre-wrap';
    status.style.fontSize = '12px';
    status.style.lineHeight = '1.35';
    status.style.padding = '8px';
    status.style.background = 'rgba(18, 35, 24, 0.88)';
    status.style.border = '1px solid rgba(71, 98, 68, 0.7)';
    status.style.borderRadius = '6px';
    status.style.marginBottom = '10px';
    status.textContent = 'No interaction attempts yet.';

    const body = document.createElement('div');
    body.style.whiteSpace = 'pre-wrap';
    body.style.fontSize = '12px';
    body.style.lineHeight = '1.4';
    body.style.overflow = 'auto';
    body.style.paddingRight = '4px';

    root.appendChild(title);
    root.appendChild(tabs);
    root.appendChild(status);
    root.appendChild(body);
    document.body.appendChild(root);

    const cutsceneToast = document.createElement('div');
    cutsceneToast.id = 'test-cutscene-toast';
    cutsceneToast.style.position = 'fixed';
    cutsceneToast.style.right = '20px';
    cutsceneToast.style.bottom = '24px';
    cutsceneToast.style.zIndex = '6004';
    cutsceneToast.style.minWidth = '220px';
    cutsceneToast.style.maxWidth = '460px';
    cutsceneToast.style.padding = '10px 12px';
    cutsceneToast.style.borderRadius = '8px';
    cutsceneToast.style.border = '1px solid rgba(90, 140, 150, 0.95)';
    cutsceneToast.style.background = 'rgba(5, 19, 24, 0.94)';
    cutsceneToast.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.34)';
    cutsceneToast.style.color = '#ecfff8';
    cutsceneToast.style.fontFamily = 'monospace';
    cutsceneToast.style.fontSize = '12px';
    cutsceneToast.style.lineHeight = '1.45';
    cutsceneToast.style.pointerEvents = 'none';
    cutsceneToast.style.display = 'none';
    document.body.appendChild(cutsceneToast);

    let visible = false;
    let activeTab: DebugDockTabId = 'interaction';
    let lastSeenInteractionAttemptNonce = 0;
    let statusLines: string[] = ['No interaction attempts yet.'];
    let logEntries: string[] = [];
    let cutsceneToastTimeoutId: number | null = null;

    const restoreGameFocus = (): void => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && activeElement !== document.body) {
            activeElement.blur();
        }

        const canvas = scene.game.canvas;
        if (canvas.tabIndex < 0) {
            canvas.tabIndex = 0;
        }
        canvas.focus({ preventScroll: true });
    };

    const stopDomKeyPropagation = (event: Event): void => {
        event.stopPropagation();
    };
    root.addEventListener('keydown', stopDomKeyPropagation, true);
    root.addEventListener('keyup', stopDomKeyPropagation, true);
    root.addEventListener('keypress', stopDomKeyPropagation, true);

    const tabButtons = new Map<DebugDockTabId, HTMLButtonElement>();
    DEBUG_DOCK_TABS.forEach((tab, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${index + 1} ${tab.label}`;
        button.tabIndex = -1;
        button.style.background = 'rgba(16, 22, 30, 0.92)';
        button.style.border = '1px solid rgba(65, 75, 88, 0.9)';
        button.style.borderRadius = '6px';
        button.style.color = '#d7fff2';
        button.style.fontFamily = 'monospace';
        button.style.fontSize = '12px';
        button.style.padding = '8px 10px';
        button.style.cursor = 'pointer';
        button.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });
        button.addEventListener('click', () => {
            activeTab = tab.id;
            renderTabs();
            restoreGameFocus();
        });
        tabs.appendChild(button);
        tabButtons.set(tab.id, button);
    });

    const pushLogEntry = (line: string): void => {
        logEntries = [line, ...logEntries].slice(0, DEBUG_LOG_MAX_ENTRIES);
    };

    const showCutsceneToast = (line: string, level: 'neutral' | 'success' | 'error'): void => {
        if (!import.meta.env.DEV) {
            return;
        }
        cutsceneToast.textContent = line;
        cutsceneToast.style.display = 'block';
        cutsceneToast.style.borderColor = level === 'error'
            ? 'rgba(196, 98, 98, 0.95)'
            : (level === 'success'
                ? 'rgba(95, 165, 102, 0.95)'
                : 'rgba(90, 140, 150, 0.95)');
        cutsceneToast.style.background = level === 'error'
            ? 'rgba(44, 12, 14, 0.94)'
            : (level === 'success'
                ? 'rgba(10, 31, 16, 0.94)'
                : 'rgba(5, 19, 24, 0.94)');
        if (cutsceneToastTimeoutId !== null) {
            window.clearTimeout(cutsceneToastTimeoutId);
        }
        cutsceneToastTimeoutId = window.setTimeout(() => {
            cutsceneToast.style.display = 'none';
            cutsceneToastTimeoutId = null;
        }, CUTSCENE_TOAST_DURATION_MS);
    };

    const toCutsceneResult = (value: unknown): TestCutsceneRequestResult | null => {
        if (typeof value !== 'string') {
            return null;
        }
        if (
            value === 'accepted'
            || value === 'rejected'
            || value === 'missing_ref'
            || value === 'already_running'
            || value === 'completed'
            || value === 'failed'
        ) {
            return value;
        }
        return null;
    };

    const onCutsceneDebugFeedback = (payload: unknown): void => {
        if (typeof payload !== 'object' || payload === null) {
            return;
        }
        const raw = payload as CutsceneDebugFeedbackPayload;
        const result = toCutsceneResult(raw.result);
        if (!result) {
            return;
        }
        const cutsceneRef = typeof raw.cutsceneRef === 'string' && raw.cutsceneRef.trim().length > 0
            ? raw.cutsceneRef.trim()
            : '-';
        const sourceDetail = typeof raw.sourceDetail === 'string' && raw.sourceDetail.trim().length > 0
            ? raw.sourceDetail.trim()
            : '-';
        const failureReason = typeof raw.failureReason === 'string' && raw.failureReason.trim().length > 0
            ? raw.failureReason.trim()
            : null;
        const line = `CUTSCENE ${result} | ref:${cutsceneRef} | src:${sourceDetail}${failureReason ? ` | ${failureReason}` : ''}`;
        pushLogEntry(line);
        const level: 'neutral' | 'success' | 'error' = result === 'accepted' || result === 'completed'
            ? 'success'
            : ((result === 'failed' || result === 'missing_ref' || result === 'rejected')
                ? 'error'
                : 'neutral');
        showCutsceneToast(line, level);
    };

    scene.events.on('pf:cutscene_debug_feedback', onCutsceneDebugFeedback);

    const formatScriptedOverride = (value: string | null | undefined): string => {
        if (value === undefined) {
            return 'profile_default';
        }
        return value ?? 'none';
    };

    const renderTabs = (): void => {
        tabButtons.forEach((button, id) => {
            const isActive = id === activeTab;
            button.style.background = isActive ? 'rgba(36, 55, 66, 0.95)' : 'rgba(16, 22, 30, 0.92)';
            button.style.borderColor = isActive ? 'rgba(115, 170, 182, 0.95)' : 'rgba(65, 75, 88, 0.9)';
            button.style.color = isActive ? '#ffffff' : '#d7fff2';
        });
    };

    const updateDockLayout = (): void => {
        const canvas = scene.game.canvas;
        const canvasRect = canvas.getBoundingClientRect();
        const leftGutterWidth = Math.max(0, Math.floor(canvasRect.left) - (DEBUG_DOCK_VIEWPORT_MARGIN * 2));
        const fallbackWidth = Math.max(
            DEBUG_DOCK_MIN_WIDTH,
            Math.min(DEBUG_DOCK_TARGET_WIDTH, Math.floor(window.innerWidth * 0.26))
        );
        const width = leftGutterWidth >= DEBUG_DOCK_MIN_WIDTH
            ? Math.min(DEBUG_DOCK_MAX_WIDTH, leftGutterWidth)
            : fallbackWidth;
        const left = leftGutterWidth >= DEBUG_DOCK_MIN_WIDTH
            ? DEBUG_DOCK_VIEWPORT_MARGIN
            : Math.max(DEBUG_DOCK_VIEWPORT_MARGIN, Math.floor(canvasRect.left + 18));
        const top = Math.max(DEBUG_DOCK_VIEWPORT_MARGIN, Math.floor(canvasRect.top + DEBUG_DOCK_TOP_OFFSET));
        const bottomLimit = Math.min(window.innerHeight - DEBUG_DOCK_BOTTOM_MARGIN, Math.floor(canvasRect.bottom - DEBUG_DOCK_BOTTOM_MARGIN));
        const height = Math.max(240, bottomLimit - top);

        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
        root.style.width = `${width}px`;
        root.style.height = `${height}px`;
        body.style.height = `${Math.max(120, height - 156)}px`;
    };

    const formatInteractionBody = (
        interactionState: TestNpcInteractionDebugState,
        cutsceneState: TestCutsceneDebugState
    ): string[] => {
        const target = interactionState.target;
        const attempt = interactionState.lastInputAttempt;
        const dispatch = interactionState.lastDispatchResult;
        return [
            'Interaction',
            `target: ${target ? `${target.actorId} (${target.displayName})` : '-'}`,
            `distance: ${target ? `${Math.round(target.distancePx)} / ${Math.round(target.maxDistancePx)}` : '-'}`,
            `available: ${target ? (target.availability === 'available' ? 'yes' : 'no') : 'no_target'}`,
            `reason: ${target?.unavailableReason ?? 'ready'}`,
            `outcome: ${target ? `${target.outcomeKind}:${target.outcomeRef}` : '-'}`,
            `outcome source: ${target?.outcomeSource ?? '-'}`,
            `effective cutscene ref: ${target?.effectiveCutsceneRef ?? '-'}`,
            `cutscene ref source: ${target?.cutsceneRefSource ?? '-'}`,
            `cutscene ref status: ${target?.cutsceneRefStatus ?? '-'}`,
            `cutscene ref issue: ${target?.cutsceneRefIssue ?? '-'}`,
            `arbitration: ${interactionState.arbitrationSource}${interactionState.arbitrationDetail ? ` (${interactionState.arbitrationDetail})` : ''}`,
            `attempt: ${attempt ? `#${attempt.attemptNonce} ${attempt.observableResult}` : '-'}`,
            `attempt detail: ${attempt?.detail ?? '-'}`,
            `dispatch: ${dispatch ? `${dispatch.result} | ${dispatch.detail}` : '-'}`,
            `key: ${interactionState.temporaryManualTriggerKey}`,
            '',
            'Cutscene',
            `last request ref: ${cutsceneState.lastCutsceneRequestRef ?? '-'}`,
            `last request result: ${cutsceneState.lastCutsceneRequestResult ?? '-'}`,
            `ref: ${cutsceneState.activeCutsceneRef ?? '-'}`,
            `step index: ${cutsceneState.activeStepIndex >= 0 ? cutsceneState.activeStepIndex : '-'}`,
            `step kind: ${cutsceneState.activeStepKind ?? '-'}`,
            `status: ${cutsceneState.status ?? '-'}`,
            `block reason: ${cutsceneState.blockReason ?? '-'}`,
            `failure: ${cutsceneState.failureReason ?? '-'}`,
            `detail: ${cutsceneState.detail ?? '-'}`,
            `camera owner: ${cutsceneState.cameraOwner}`,
            `camera focus actor: ${cutsceneState.cameraFocusActorId ?? '-'}`,
            `camera transition: ${cutsceneState.cameraTransitionMode}`,
            `camera target: ${
                cutsceneState.cameraTargetX !== null && cutsceneState.cameraTargetY !== null
                    ? `${cutsceneState.cameraTargetX.toFixed(2)}, ${cutsceneState.cameraTargetY.toFixed(2)}`
                    : '-'
            }`,
            `camera delta: ${
                cutsceneState.cameraRemainingDeltaX !== null && cutsceneState.cameraRemainingDeltaY !== null
                    ? `${cutsceneState.cameraRemainingDeltaX.toFixed(2)}, ${cutsceneState.cameraRemainingDeltaY.toFixed(2)}`
                    : '-'
            }`,
            `camera remaining: ${
                cutsceneState.cameraRemainingDistancePx !== null
                    ? `${cutsceneState.cameraRemainingDistancePx.toFixed(2)}px`
                    : '-'
            }`,
            `actor seq actor: ${cutsceneState.activeActorSequenceActorId ?? '-'}`,
            `actor seq ref: ${cutsceneState.activeActorSequenceRef ?? '-'}`,
            `actor seq id: ${cutsceneState.activeActorSequenceId ?? '-'}`,
            `actor seq status: ${cutsceneState.activeActorSequenceStatus ?? '-'}`,
            `cutscene active: ${cutsceneState.cutsceneActive ? 'yes' : 'no'}`,
            `normal camera path: ${cutsceneState.normalCameraPathStatus}`,
            `normal camera source: ${cutsceneState.normalCameraPathSource ?? '-'}`,
            `normal camera reason: ${cutsceneState.normalCameraPathReason ?? '-'}`
        ];
    };

    const formatNpcCardLines = (entry: TestNpcDebugEntry): string[] => {
        const actionLabel = entry.activeActionKind
            ? `${entry.activeActionKind}#${Math.max(0, entry.activeActionIndex)}:${entry.activeActionStatus ?? 'running'}`
            : `none:${entry.actionSequenceStatus ?? 'idle'}`;
        const targetLabel = entry.actionTargetDescription ?? entry.actionTargetRef ?? '-';
        const hookLabel = entry.activeHookId ?? '-';
        return [
            `${entry.id} | ${entry.archetype} | ${entry.state} | ${entry.locomotion}`,
            `  loop:${entry.scriptedLoopRef ?? '-'} | src:${entry.scriptedLoopSource} | hook:${hookLabel} | override:${formatScriptedOverride(entry.scriptedLoopInstanceOverride)}`,
            `  seq:${entry.actionSequenceStatus ?? 'none'} | action:${actionLabel} | target:${targetLabel}`,
            `  body:${entry.playerBodyContactMode} tri:${entry.exportsTriangleSupportSurface ? '1' : '0'} touch:P${entry.touchingPlayer ? '1' : '0'} A:${entry.touchingOtherActor ? '1' : '0'}`
        ];
    };

    const formatNpcBody = (
        npcEntries: readonly TestNpcDebugEntry[],
        interactionState: TestNpcInteractionDebugState
    ): string[] => {
        const targetActorId = interactionState.target?.actorId ?? null;
        const orderedNpcEntries = [...npcEntries].sort((left, right) => {
            if (left.id === targetActorId) {
                return -1;
            }
            if (right.id === targetActorId) {
                return 1;
            }
            return left.id.localeCompare(right.id);
        });
        const visibleNpcEntries = orderedNpcEntries.slice(0, 4);
        const hiddenNpcCount = Math.max(0, orderedNpcEntries.length - visibleNpcEntries.length);

        return [
            `NPC runtime (${npcEntries.length})`,
            ...visibleNpcEntries.flatMap((entry) => formatNpcCardLines(entry)),
            ...(hiddenNpcCount > 0 ? [`... +${hiddenNpcCount} more NPC entries`] : [])
        ];
    };

    const formatPlayerBody = (): string[] => {
        const bodyX = Math.round(player.arcadeBodyObject.x);
        const bodyY = Math.round(player.arcadeBodyObject.y);
        const anchorX = Math.round(player.formAnchor.x);
        const anchorY = Math.round(player.formAnchor.y);
        const squareDebug = player.squareDebugView;
        return [
            'Player',
            `form: ${player.currentForm}`,
            `contact: ${player.contactMode === 'arcade' ? 'arcade' : 'triangle polygon'}`,
            `body: ${bodyX}, ${bodyY}`,
            `anchor: ${anchorX}, ${anchorY}`,
            `hazard shape: ${player.hazardHitShape.kind}`,
            `triangle points: ${player.trianglePhysicsPoints?.length ?? 0}`,
            `square attached: ${squareDebug?.isAttached ? 'yes' : 'no'}`,
            `square normal: ${squareDebug ? `${squareDebug.attachNormalX},${squareDebug.attachNormalY}` : '-'}`,
            `square zones: ${squareDebug?.attachedZoneIds.join(', ') || '-'}`
        ];
    };

    const formatLogBody = (): string[] => {
        return [
            'Interaction Log',
            ...(logEntries.length > 0 ? logEntries : ['No events yet.'])
        ];
    };

    const setDomVisible = (nextVisible: boolean): void => {
        root.style.display = nextVisible ? 'block' : 'none';
    };

    const applyVisibility = (nextVisible: boolean): void => {
        visible = nextVisible;
        debugDrawRuntime.setVisible(visible);
        setPlayerDebugVisualsVisible(visible);
        setDomVisible(visible);
        if (!visible) {
            debugDrawRuntime.reset();
            body.textContent = '';
        }
    };

    const toggleVisibility = (): void => {
        if (isDomTextInputFocused()) {
            return;
        }
        applyVisibility(!visible);
    };

    renderTabs();
    applyVisibility(false);

    return {
        update: (): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleVisibility();
            }

            if (Input.Keyboard.JustDown(tabKeys[0])) {
                activeTab = 'interaction';
                renderTabs();
            } else if (Input.Keyboard.JustDown(tabKeys[1])) {
                activeTab = 'npc';
                renderTabs();
            } else if (Input.Keyboard.JustDown(tabKeys[2])) {
                activeTab = 'player';
                renderTabs();
            } else if (Input.Keyboard.JustDown(tabKeys[3])) {
                activeTab = 'log';
                renderTabs();
            }

            const interactionState = getNpcInteractionDebugState();
            const cutsceneState = getCutsceneDebugState();
            const latestAttempt = interactionState.lastInputAttempt;
            if (latestAttempt && latestAttempt.attemptNonce !== lastSeenInteractionAttemptNonce) {
                lastSeenInteractionAttemptNonce = latestAttempt.attemptNonce;
                statusLines = [
                    `I -> ${latestAttempt.observableResult}`,
                    `actor:${latestAttempt.actorId ?? '-'} | outcome:${latestAttempt.outcomeKind ?? '-'}:${latestAttempt.outcomeRef ?? '-'} | src:${latestAttempt.outcomeSource ?? '-'}`,
                    `cutscene:${latestAttempt.effectiveCutsceneRef ?? '-'} | ${latestAttempt.cutsceneRefStatus}${latestAttempt.cutsceneRefIssue ? ` | ${latestAttempt.cutsceneRefIssue}` : ''}`,
                    latestAttempt.detail
                ];
                const isSuccess = latestAttempt.observableResult === 'dispatched_sequence'
                    || latestAttempt.observableResult === 'dispatched_event'
                    || latestAttempt.observableResult === 'requested_cutscene';
                status.style.background = isSuccess
                    ? 'rgba(18, 35, 24, 0.88)'
                    : 'rgba(48, 18, 18, 0.9)';
                status.style.borderColor = isSuccess
                    ? 'rgba(71, 98, 68, 0.7)'
                    : 'rgba(128, 70, 70, 0.75)';
                pushLogEntry(
                    `#${latestAttempt.attemptNonce} ${latestAttempt.observableResult} | actor:${latestAttempt.actorId ?? '-'} | ${latestAttempt.detail}`
                );
            }

            updateDockLayout();
            status.textContent = statusLines.join('\n');

            if (!visible) {
                debugDrawRuntime.reset();
                body.textContent = '';
                return;
            }

            debugDrawRuntime.render();
            const npcEntries = getNpcDebugEntries();
            const bodyLines = activeTab === 'interaction'
                ? formatInteractionBody(interactionState, cutsceneState)
                : (activeTab === 'npc'
                    ? formatNpcBody(npcEntries, interactionState)
                    : (activeTab === 'player'
                        ? formatPlayerBody()
                        : formatLogBody()));
            body.textContent = bodyLines.join('\n');
        },
        setVisible: (nextVisible: boolean): void => {
            applyVisibility(nextVisible);
        },
        reset: (): void => {
            debugDrawRuntime.reset();
            body.textContent = '';
        },
        destroy: (): void => {
            applyVisibility(false);
            debugDrawRuntime.destroy();
            scene.events.off('pf:cutscene_debug_feedback', onCutsceneDebugFeedback);
            root.removeEventListener('keydown', stopDomKeyPropagation, true);
            root.removeEventListener('keyup', stopDomKeyPropagation, true);
            root.removeEventListener('keypress', stopDomKeyPropagation, true);
            if (cutsceneToastTimeoutId !== null) {
                window.clearTimeout(cutsceneToastTimeoutId);
                cutsceneToastTimeoutId = null;
            }
            cutsceneToast.remove();
            root.remove();
        }
    };
};

export type { TestDebugRuntime } from './ui_runtime_types';
