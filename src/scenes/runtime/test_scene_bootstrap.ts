import type { Scene } from 'phaser';
import { PfPlayer } from '../../game/player/PfPlayer';
import { createPlayerInputKeys, type PlayerInputKeys } from '../../game/player/player_input';
import type {
    PlayerDebugModel,
    PlayerHudModel,
    PlayerWorldActor
} from '../../game/player/player_runtime_contracts';
import {
    createPlayerRespawnRuntime,
    type PlayerRespawnRuntime
} from '../../game/world/runtime/player_respawn_runtime';
import {
    createTestWorldEditorRuntime,
    type TestWorldEditorRuntime
} from '../../game/world/runtime/test_world_editor_runtime';
import {
    bootstrapPersistedPlayerTuning,
    createPlayerTuningRuntime,
    type PlayerTuningRuntime
} from '../../game/player/tuning/player_tuning_runtime';
import { loadTestWorldEditorDraft } from '../../game/world/runtime/test_world_editor_storage';
import {
    loadTestNpcScriptedSequenceDraft
} from '../../game/npc/npc_scripted_sequence_storage';
import {
    setTestNpcScriptedSequenceDefinitions
} from '../../game/npc/npc_scripted_sequences';
import {
    loadTestCutsceneDraft
} from '../../game/cutscene/cutscene_storage';
import {
    setTestCutsceneDefinitions
} from '../../game/cutscene/test_cutscene_registry';
import {
    createTestWorldRuntime,
    type TestWorldRuntime
} from '../../game/world/runtime/test_world_runtime';
import type { RespawnPoint } from '../../game/world/runtime/world_runtime_types';
import {
    refreshBaselineFollowCameraLerp,
    setupBaselineFollowCamera
} from '../../game/camera/follow_camera';
import { createTestDebugRuntime, type TestDebugRuntime } from '../../ui/runtime/test_debug_runtime';
import { createTestHudRuntime, type TestHudRuntime } from '../../ui/runtime/test_hud_runtime';
import {
    createPlayerTuningPanelRuntime,
    type PlayerTuningPanelRuntime
} from '../../ui/runtime/player_tuning_panel_runtime';
import {
    createTestDevHelperRuntime,
    type TestDevHelperRuntime
} from '../../ui/runtime/test_dev_helper_runtime';
import {
    getBundledCampaignLevelConfig,
    getCampaignLevelConfig,
    getCampaignLevelConfigSource,
    getInitialCampaignLevelId
} from '../../game/world/runtime/test_campaign_registry';
import { createTestSceneBackgroundRuntime } from './test_scene_background_runtime';
import {
    createTestCutsceneRuntime,
    type TestCutsceneRuntime
} from './test_cutscene_runtime';
import { createEditorPlugin, type EditorPlugin } from '../../editor/EditorPlugin';
import { createAuthoringObjectBridgeSource } from '../../editor/bridge/AuthoringObjectBridge';

export interface TestSceneBootstrapRuntime {
    player: PfPlayer;
    playerInputKeys: PlayerInputKeys;
    worldRuntime: TestWorldRuntime;
    respawnRuntime: PlayerRespawnRuntime;
    hudRuntime: TestHudRuntime;
    debugRuntime: TestDebugRuntime;
    cutsceneRuntime: TestCutsceneRuntime;
    editorRuntime: TestWorldEditorRuntime;
    devHelperRuntime: TestDevHelperRuntime;
    tuningRuntime: PlayerTuningRuntime;
    tuningPanelRuntime: PlayerTuningPanelRuntime;
    editorPlugin: EditorPlugin;
}

export const createTestSceneBootstrapRuntime = (scene: Scene, levelId?: string, editorOpen: boolean = false): TestSceneBootstrapRuntime => {
    bootstrapPersistedPlayerTuning();

    const initialSequenceLoad = loadTestNpcScriptedSequenceDraft();
    setTestNpcScriptedSequenceDefinitions(
        initialSequenceLoad.definitions,
        initialSequenceLoad.source === 'draft'
            ? 'bootstrap_draft'
            : 'bootstrap_default'
    );
    const initialCutsceneLoad = loadTestCutsceneDraft();
    setTestCutsceneDefinitions(
        initialCutsceneLoad.definitions,
        initialCutsceneLoad.source === 'draft'
            ? 'bootstrap_draft'
            : 'bootstrap_default'
    );

    const resolvedLevelId = levelId ?? getInitialCampaignLevelId();
    const defaultConfig = getCampaignLevelConfig(resolvedLevelId);
    const bundledConfig = getBundledCampaignLevelConfig(resolvedLevelId);
    const campaignConfigSource = getCampaignLevelConfigSource(resolvedLevelId);
    const defaultReferenceConfig = bundledConfig ?? defaultConfig;
    const initialWorldLoad = loadTestWorldEditorDraft(resolvedLevelId, defaultConfig);
    if (
        initialWorldLoad.source === 'draft'
        && initialWorldLoad.config.npcs.length === 0
        && defaultReferenceConfig.npcs.length > 0
    ) {
        initialWorldLoad.config = {
            ...initialWorldLoad.config,
            npcs: defaultReferenceConfig.npcs.map((entry) => ({
                ...entry,
                scriptedLoopRef: entry.scriptedLoopRef,
                interactionOverride: entry.interactionOverride
                    ? {
                        ...entry.interactionOverride,
                        outcome: entry.interactionOverride.outcome
                            ? { ...entry.interactionOverride.outcome }
                            : entry.interactionOverride.outcome
                    }
                    : undefined,
                behavior: entry.behavior ? { ...entry.behavior } : undefined
            }))
        };
    }
    const backgroundRuntime = createTestSceneBackgroundRuntime(scene, initialWorldLoad.config);
    const initialRespawnPoint: RespawnPoint = {
        x: initialWorldLoad.config.playerSpawn.x,
        y: initialWorldLoad.config.playerSpawn.y
    };
    const player = new PfPlayer(scene, initialRespawnPoint.x, initialRespawnPoint.y);
    const playerInputKeys = createPlayerInputKeys(scene);
    const worldActor: PlayerWorldActor = player;
    const hudModel: PlayerHudModel = player;
    const debugModel: PlayerDebugModel = player;

    const respawnRuntime = createPlayerRespawnRuntime({
        scene,
        player: worldActor,
        initialRespawnPoint
    });

    const worldRuntime = createTestWorldRuntime({
        scene,
        player: worldActor,
        initialConfig: initialWorldLoad.config,
        onCheckpointActivated: (point) => {
            respawnRuntime.setRespawnPoint(point);
        }
    });
    respawnRuntime.setOnPlayerRespawned(() => {
        worldRuntime.resetRespawnObjects();
    });

    const camera = setupBaselineFollowCamera(scene, player.arcadeBodyObject, {
        width: initialWorldLoad.config.worldBounds.width,
        height: initialWorldLoad.config.worldBounds.height
    });

    const hudRuntime = createTestHudRuntime({
        scene,
        player: hudModel
    });

    const cutsceneRuntime = createTestCutsceneRuntime({
        scene,
        player: worldActor,
        worldRuntime
    });
    const debugRuntime = createTestDebugRuntime({
        scene,
        player: debugModel,
        setPlayerDebugVisualsVisible: (visible) => {
            player.setDebugVisualsVisible(visible);
        },
        getHazards: () => worldRuntime.hazards,
        getNpcDebugEntries: () => worldRuntime.getNpcDebugEntries(),
        getNpcInteractionDebugState: () => worldRuntime.getNpcInteractionDebugState(),
        getCutsceneDebugState: () => cutsceneRuntime.getDebugState()
    });
    const editorRuntime = createTestWorldEditorRuntime(
        scene,
        worldRuntime,
        player,
        resolvedLevelId,
        defaultConfig,
        editorOpen,
        [
            initialWorldLoad.source === 'draft'
                ? 'loaded world draft'
                : (initialWorldLoad.error ? 'world draft invalid, loaded default' : null),
            `campaign source: ${campaignConfigSource}`,
            initialSequenceLoad.source === 'draft'
                ? 'loaded sequence draft'
                : (initialSequenceLoad.error ? 'sequence draft invalid, loaded default' : null),
            initialCutsceneLoad.source === 'draft'
                ? 'loaded cutscene draft'
                : (initialCutsceneLoad.error ? 'cutscene draft invalid, loaded default' : null)
        ].filter((entry): entry is string => entry !== null).join(' | ') || null,
        {
            bundledDefaultConfig: defaultReferenceConfig,
            campaignDefaultConfig: defaultConfig,
            campaignConfigSource,
            initialWorldLoadSource: initialWorldLoad.source,
            initialDraftPresent: initialWorldLoad.draftPresent,
            initialWorldLoadError: initialWorldLoad.error
        },
        (config) => {
            backgroundRuntime.applyConfig(config);
        },
        (basis) => {
            backgroundRuntime.setEditorPreviewCameraBasis(basis);
        },
        (source) => cutsceneRuntime.requestNormalCameraOwnership(source)
    );
    const editorPlugin = createEditorPlugin({
        scene,
        followTarget: player.arcadeBodyObject,
        legacyObjectSource: createAuthoringObjectBridgeSource(worldRuntime)
    });
    const devHelperRuntime = createTestDevHelperRuntime({
        scene,
        player: worldActor,
        worldRuntime,
        respawnRuntime,
        isEditorActive: () => editorRuntime.isActive() || editorPlugin.isOpen()
    });
    const tuningRuntime = createPlayerTuningRuntime();
    tuningRuntime.subscribe(() => {
        refreshBaselineFollowCameraLerp(camera);
    });
    const tuningPanelRuntime = createPlayerTuningPanelRuntime({
        scene,
        tuningRuntime,
        onOpened: () => {
            editorRuntime.close();
        }
    });

    if (import.meta.env.DEV && typeof window !== 'undefined') {
        const debugBridge = {
            getLevelId: (): string => worldRuntime.getLevelId(),
            getPlayerSnapshot: () => ({
                x: player.arcadeBodyObject.x,
                y: player.arcadeBodyObject.y,
                form: player.currentForm
            }),
            getPlayerVisualSnapshot: () => player.presentationDebugState,
            getDeathDebugSnapshot: () => player.deathDebugSnapshot,
            setDeathDebugOverlay: (enabled: boolean, progressOverride: number | null = null): void => {
                player.setDeathDebugOverlay(Boolean(enabled), progressOverride);
            },
            teleportPlayer: (x: number, y: number): void => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return;
                }
                respawnRuntime.setRespawnPoint({ x, y });
                player.respawnAt(x, y);
            },
            getNpcDebugEntries: () => worldRuntime.getNpcDebugEntries(),
            getNpcInteractionDebugState: () => worldRuntime.getNpcInteractionDebugState(),
            getCutsceneDebugState: () => cutsceneRuntime.getDebugState(),
            tryTriggerNpcInteraction: (): void => {
                worldRuntime.updateNpcInteractionTarget();
                worldRuntime.tryTriggerNpcInteraction();
            },
            tryStartCutsceneRef: (cutsceneRef: string): boolean => {
                const normalizedRef = typeof cutsceneRef === 'string' ? cutsceneRef.trim() : '';
                return normalizedRef.length > 0
                    ? cutsceneRuntime.tryStartCutsceneRef(normalizedRef, 'debug_bridge')
                    : false;
            }
        };
        (window as Window & {
            __THE_FORM_DEBUG__?: typeof debugBridge;
        }).__THE_FORM_DEBUG__ = debugBridge;
    }

    return {
        player,
        playerInputKeys,
        worldRuntime,
        respawnRuntime,
        hudRuntime,
        debugRuntime,
        cutsceneRuntime,
        editorRuntime,
        devHelperRuntime,
        tuningRuntime,
        tuningPanelRuntime,
        editorPlugin
    };
};
