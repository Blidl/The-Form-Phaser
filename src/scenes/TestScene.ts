import { Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../game/camera/follow_camera';
import { PfPlayer } from '../game/player/PfPlayer';
import { createPlayerInputKeys, pollPlayerInputSnapshot, type PlayerInputKeys } from '../game/player/player_input';
import {
    createPlayerRespawnRuntime,
    type PlayerRespawnRuntime
} from '../game/world/runtime/player_respawn_runtime';
import {
    createTestWorldRuntime,
    TEST_WORLD_HEIGHT,
    TEST_WORLD_WIDTH,
    type TestWorldRuntime
} from '../game/world/runtime/test_world_runtime';
import type { RespawnPoint } from '../game/world/runtime/world_runtime_types';
import { createTestDebugRuntime, type TestDebugRuntime } from '../ui/runtime/test_debug_runtime';
import { createTestHudRuntime, type TestHudRuntime } from '../ui/runtime/test_hud_runtime';

export class TestScene extends Scene {
    public static readonly KEY = 'sc_test';
    private player!: PfPlayer;
    private playerInputKeys!: PlayerInputKeys;
    private worldRuntime!: TestWorldRuntime;
    private respawnRuntime!: PlayerRespawnRuntime;
    private hudRuntime!: TestHudRuntime;
    private debugRuntime!: TestDebugRuntime;

    public constructor() {
        super(TestScene.KEY);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor('#263238');

        const initialRespawnPoint: RespawnPoint = { x: 220, y: 620 };
        this.player = new PfPlayer(this, initialRespawnPoint.x, initialRespawnPoint.y);
        this.playerInputKeys = createPlayerInputKeys(this);

        this.respawnRuntime = createPlayerRespawnRuntime({
            scene: this,
            player: this.player,
            initialRespawnPoint
        });

        this.worldRuntime = createTestWorldRuntime({
            scene: this,
            player: this.player,
            onCheckpointActivated: (point) => {
                this.respawnRuntime.setRespawnPoint(point);
            }
        });

        setupBaselineFollowCamera(this, this.player.arcadeBodyObject, {
            width: TEST_WORLD_WIDTH,
            height: TEST_WORLD_HEIGHT
        });

        this.hudRuntime = createTestHudRuntime({
            scene: this,
            player: this.player
        });
        this.debugRuntime = createTestDebugRuntime({
            scene: this,
            player: this.player,
            hazards: this.worldRuntime.hazards
        });
    }

    public update(_time: number, delta: number): void {
        this.worldRuntime.updateMovingPlatforms();

        const input = pollPlayerInputSnapshot(this.playerInputKeys);
        const windInfluenceX = this.worldRuntime.resolveWindInfluenceX(this.player.arcadeBodyObject);
        this.player.tick(delta, input, windInfluenceX);
        this.respawnRuntime.evaluateHazardOverlap(this.worldRuntime.hazards);
        this.debugRuntime.update();
        this.hudRuntime.update();
    }
}
