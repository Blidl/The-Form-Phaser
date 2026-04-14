import { Input, type Scene } from 'phaser';
import type { PlayerDebugModel } from '../../game/player/player_runtime_contracts';
import type { HazardObject } from '../../game/world/hazard';
import type { TestDebugRuntime } from './ui_runtime_types';
import { createTestDebugDrawRuntime } from './test_debug_draw_runtime';
import { isDomTextInputFocused, relaxKeyboardCapture } from '../../shared/dom_input_focus';
import type { TestNpcDebugEntry } from '../../game/npc/npc_types';

interface CreateTestDebugRuntimeParams {
    scene: Scene;
    player: PlayerDebugModel;
    setPlayerDebugVisualsVisible: (visible: boolean) => void;
    getHazards: () => readonly HazardObject[];
    getNpcDebugEntries: () => readonly TestNpcDebugEntry[];
}

export const createTestDebugRuntime = (params: CreateTestDebugRuntimeParams): TestDebugRuntime => {
    const { scene, player, setPlayerDebugVisualsVisible, getHazards, getNpcDebugEntries } = params;
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
        throw new Error('KeyboardPlugin is not available in this scene.');
    }

    const toggleKey = keyboard.addKey(Input.Keyboard.KeyCodes.NINE);
    relaxKeyboardCapture(keyboard, [Input.Keyboard.KeyCodes.NINE]);
    const debugDrawRuntime = createTestDebugDrawRuntime({
        scene,
        player,
        getHazards
    });
    const runtimeStateText = scene.add.text(18, 96, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#d7fff2',
        backgroundColor: 'rgba(5, 18, 22, 0.72)',
        padding: {
            left: 8,
            right: 8,
            top: 6,
            bottom: 6
        }
    })
        .setDepth(6002)
        .setScrollFactor(0)
        .setVisible(false);

    let visible = false;

    const applyVisibility = (nextVisible: boolean): void => {
        visible = nextVisible;
        debugDrawRuntime.setVisible(visible);
        setPlayerDebugVisualsVisible(visible);
        runtimeStateText.setVisible(visible);
        if (!visible) {
            debugDrawRuntime.reset();
            runtimeStateText.setText('');
        }
    };

    const toggleVisibility = (): void => {
        if (isDomTextInputFocused()) {
            return;
        }
        applyVisibility(!visible);
    };

    applyVisibility(false);

    return {
        update: (): void => {
            if (Input.Keyboard.JustDown(toggleKey)) {
                toggleVisibility();
            }

            if (!visible) {
                debugDrawRuntime.reset();
                runtimeStateText.setText('');
                return;
            }

            debugDrawRuntime.render();
            const npcEntries = getNpcDebugEntries();
            const playerRuntimeLine = `Player runtime | form:${player.currentForm} | contact:${player.contactMode === 'arcade' ? 'arcade' : 'triangle polygon'}`;
            if (npcEntries.length === 0) {
                runtimeStateText.setText([
                    playerRuntimeLine,
                    'NPC runtime: none'
                ]);
                return;
            }
            runtimeStateText.setText([
                playerRuntimeLine,
                'NPC runtime',
                ...npcEntries.map((entry) => {
                    const actionLabel = entry.activeActionKind
                        ? `${entry.activeActionKind}#${Math.max(0, entry.activeActionIndex)}:${entry.activeActionStatus ?? 'running'}`
                        : `none:${entry.actionSequenceStatus ?? 'idle'}`;
                    const targetLabel = entry.actionTargetDescription ?? entry.actionTargetRef ?? '-';
                    const refLabel = entry.actionTargetRef ?? entry.actionSequenceTargetRef ?? '-';
                    const sequenceLabel = entry.actionSequenceId
                        ? `${entry.actionSequenceId}@${entry.actionSequenceSource ?? 'unknown'}`
                        : '-';
                    const scriptedLabel = entry.scriptedLoopRef ?? '-';
                    const scriptedOverrideLabel = entry.scriptedLoopInstanceOverride === undefined
                        ? 'profile_default'
                        : (entry.scriptedLoopInstanceOverride ?? 'none');
                    const scriptedProfileLabel = entry.profileScriptedLoopRef ?? '-';
                    const activeScriptedLabel = entry.activeScriptedSequenceRef ?? '-';
                    const failureLabel = entry.actionFailureReason ?? '-';
                    const presentationLabel = `anim:${entry.presentationAnimation ?? '-'} emotion:${entry.presentationEmotion ?? '-'}`;
                    return `${entry.id} | ${entry.archetype} | ${entry.state} | ${entry.locomotion} | scriptedLoop:${scriptedLabel} | scriptedSource:${entry.scriptedLoopSource} | scriptedProfile:${scriptedProfileLabel} | scriptedOverride:${scriptedOverrideLabel} | activeScripted:${activeScriptedLabel} | action:${actionLabel} | seq:${entry.actionSequenceStatus ?? 'none'} | seqRef:${sequenceLabel} | target:${targetLabel} | ref:${refLabel} | fail:${failureLabel} | ${presentationLabel} | playerBodyContactMode:${entry.playerBodyContactMode} | triangleSupport:${entry.exportsTriangleSupportSurface ? '1' : '0'} | blocked L:${entry.blockedLeft ? '1' : '0'} R:${entry.blockedRight ? '1' : '0'} | player:${entry.touchingPlayer ? '1' : '0'} actor:${entry.touchingOtherActor ? '1' : '0'}`;
                })
            ]);
        },
        setVisible: (nextVisible: boolean): void => {
            applyVisibility(nextVisible);
        },
        reset: (): void => {
            debugDrawRuntime.reset();
            runtimeStateText.setText('');
        },
        destroy: (): void => {
            applyVisibility(false);
            debugDrawRuntime.destroy();
            runtimeStateText.destroy();
        }
    };
};

export type { TestDebugRuntime } from './ui_runtime_types';
