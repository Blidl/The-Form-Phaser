import { Scene } from 'phaser';
import { GAME_BACKGROUND_COLOR } from '../config/game/gameConfigValues';
import { PfCameraController } from '../game/camera';
import { PfPlayer } from '../game/player';
import { PfCheckpoint, PfHazard, PfMovingPlatform, PfTriggerPlatform } from '../game/world';
import { buildTestSceneLayout, getTestSceneSpawnPoint, TEST_SCENE_LAYOUT } from './testScene/testSceneLayout';
import { SCENE_KEYS, type SceneKey } from '../shared/types/sceneTypes';
import { PfUiRoot } from '../ui';

export class TestScene extends Scene {
    public static readonly KEY: SceneKey = SCENE_KEYS.test;

    private pfPlayer!: PfPlayer;
    private uiRoot!: PfUiRoot;
    private movingPlatforms: PfMovingPlatform[] = [];

    public constructor() {
        super(TestScene.KEY);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor(GAME_BACKGROUND_COLOR);
        this.physics.world.setBounds(0, 0, TEST_SCENE_LAYOUT.worldWidth, TEST_SCENE_LAYOUT.worldHeight);

        const { staticBodies } = buildTestSceneLayout(this);
        const spawnPoint = getTestSceneSpawnPoint('spawn_baseline');

        this.pfPlayer = new PfPlayer({
            scene: this,
            spawnPoint
        });
        this.uiRoot = new PfUiRoot(this);

        new PfCameraController({
            camera: this.cameras.main,
            followTarget: this.pfPlayer.getGameObject(),
            worldBounds: {
                width: TEST_SCENE_LAYOUT.worldWidth,
                height: TEST_SCENE_LAYOUT.worldHeight
            }
        });

        for (const staticBody of staticBodies) {
            this.physics.add.collider(this.pfPlayer.getGameObject(), staticBody);
        }

        const hazards = TEST_SCENE_LAYOUT.hazards.map((hazardConfig) => {
            return new PfHazard(this, hazardConfig);
        });
        for (const hazard of hazards) {
            this.physics.add.overlap(this.pfPlayer.getGameObject(), hazard.getGameObject(), () => {
                hazard.handlePlayerOverlap(this.pfPlayer);
            });
        }

        const checkpoints = TEST_SCENE_LAYOUT.checkpoints.map((checkpointConfig) => {
            return new PfCheckpoint(this, checkpointConfig);
        });
        for (const checkpoint of checkpoints) {
            this.physics.add.overlap(this.pfPlayer.getGameObject(), checkpoint.getGameObject(), () => {
                checkpoint.handlePlayerOverlap(this.pfPlayer);
            });
        }

        this.movingPlatforms = TEST_SCENE_LAYOUT.movingPlatforms.map((movingPlatformConfig) => {
            const movingPlatform = new PfMovingPlatform(this, movingPlatformConfig);
            this.physics.add.collider(this.pfPlayer.getGameObject(), movingPlatform.getGameObject());
            return movingPlatform;
        });

        const triggerPlatforms = TEST_SCENE_LAYOUT.triggerPlatforms.map((triggerPlatformConfig) => {
            const triggerPlatform = new PfTriggerPlatform(this, triggerPlatformConfig);

            this.physics.add.collider(this.pfPlayer.getGameObject(), triggerPlatform.getPlatformGameObject());
            this.physics.add.overlap(this.pfPlayer.getGameObject(), triggerPlatform.getTriggerGameObject(), () => {
                triggerPlatform.activate();
            });

            return triggerPlatform;
        });

        this.add.text(16, 16, 'sc_test | harness layout', {
            color: '#f8fafc',
            fontFamily: 'monospace',
            fontSize: '14px'
        }).setScrollFactor(0);

        if (triggerPlatforms.length > 0) {
            this.add.text(16, 34, 'Yellow trigger activates green platform', {
                color: '#fde68a',
                fontFamily: 'monospace',
                fontSize: '12px'
            }).setScrollFactor(0);
        }
    }

    public update(_time: number, delta: number): void {
        for (const movingPlatform of this.movingPlatforms) {
            movingPlatform.update(delta);
        }

        this.pfPlayer.update(delta);

        const timerState = this.pfPlayer.getTimerState();
        this.uiRoot.updateFormStatus(this.pfPlayer.getCurrentFormId(), timerState.transformLockMs);
    }
}
