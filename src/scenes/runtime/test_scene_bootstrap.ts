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
import { getCampaignLevelConfig, getInitialCampaignLevelId } from '../../game/world/runtime/test_campaign_registry';
import { createTestSceneBackgroundRuntime } from './test_scene_background_runtime';

export interface TestSceneBootstrapRuntime {
    player: PfPlayer;
    playerInputKeys: PlayerInputKeys;
    worldRuntime: TestWorldRuntime;
    respawnRuntime: PlayerRespawnRuntime;
    hudRuntime: TestHudRuntime;
    debugRuntime: TestDebugRuntime;
    editorRuntime: TestWorldEditorRuntime;
    devHelperRuntime: TestDevHelperRuntime;
    tuningRuntime: PlayerTuningRuntime;
    tuningPanelRuntime: PlayerTuningPanelRuntime;
}

export const createTestSceneBootstrapRuntime = (scene: Scene, levelId?: string, editorOpen: boolean = false): TestSceneBootstrapRuntime => {
    bootstrapPersistedPlayerTuning();

    const resolvedLevelId = levelId ?? getInitialCampaignLevelId();
    const defaultConfig = getCampaignLevelConfig(resolvedLevelId);
    const initialWorldLoad = loadTestWorldEditorDraft(resolvedLevelId, defaultConfig);
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

    const debugRuntime = createTestDebugRuntime({
        scene,
        player: debugModel,
        setPlayerDebugVisualsVisible: (visible) => {
            player.setDebugVisualsVisible(visible);
        },
        getHazards: () => worldRuntime.hazards
    });
    const editorRuntime = createTestWorldEditorRuntime(
        scene,
        worldRuntime,
        player,
        resolvedLevelId,
        defaultConfig,
        editorOpen,
        initialWorldLoad.source === 'draft'
            ? 'loaded saved draft'
            : initialWorldLoad.error
                ? 'draft invalid, loaded default'
                : null,
        (config) => {
            backgroundRuntime.applyConfig(config);
        }
    );
    const devHelperRuntime = createTestDevHelperRuntime({
        scene,
        player: worldActor,
        worldRuntime,
        respawnRuntime,
        isEditorActive: () => editorRuntime.isActive()
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

    return {
        player,
        playerInputKeys,
        worldRuntime,
        respawnRuntime,
        hudRuntime,
        debugRuntime,
        editorRuntime,
        devHelperRuntime,
        tuningRuntime,
        tuningPanelRuntime
    };
};
