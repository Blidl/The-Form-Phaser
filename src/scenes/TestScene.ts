import { Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../game/camera/follow_camera';
import { PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS } from '../game/player/player_constants';
import { PfPlayer } from '../game/player/PfPlayer';
import { createPlayerInputKeys, pollPlayerInputSnapshot, type PlayerInputKeys } from '../game/player/player_input';
import { createCheckpoint, type CheckpointObject } from '../game/world/checkpoint';
import { createHazard } from '../game/world/hazard';
import { createMovingPlatform, type MovingPlatformObject } from '../game/world/moving_platform';
import { createTriggerPlatform } from '../game/world/trigger_platform';
import { createWindZone, type WindZoneObject } from '../game/world/wind_zone';

const TEST_WORLD_WIDTH = 2200;
const TEST_WORLD_HEIGHT = 900;

interface RespawnPoint {
    x: number;
    y: number;
}

export class TestScene extends Scene {
    public static readonly KEY = 'sc_test';
    private player!: PfPlayer;
    private playerInputKeys!: PlayerInputKeys;
    private checkpoints: CheckpointObject[] = [];
    private movingPlatforms: MovingPlatformObject[] = [];
    private windZones: WindZoneObject[] = [];
    private currentRespawnPoint: RespawnPoint = { x: 220, y: 620 };
    private respawnInProgress: boolean = false;

    public constructor() {
        super(TestScene.KEY);
    }

    public create(): void {
        this.cameras.main.setBackgroundColor('#263238');
        this.physics.world.setBounds(0, 0, TEST_WORLD_WIDTH, TEST_WORLD_HEIGHT);

        const ground = this.add.rectangle(TEST_WORLD_WIDTH * 0.5, 760, TEST_WORLD_WIDTH - 120, 56, 0x90a4ae)
            .setStrokeStyle(2, 0xcfd8dc)
            .setDepth(4200);
        const lowPlatform = this.add.rectangle(760, 610, 280, 24, 0xb0bec5)
            .setStrokeStyle(2, 0xeceff1)
            .setDepth(4200);
        const highPlatform = this.add.rectangle(1380, 500, 240, 24, 0xb0bec5)
            .setStrokeStyle(2, 0xeceff1)
            .setDepth(4200);

        this.physics.add.existing(ground, true);
        this.physics.add.existing(lowPlatform, true);
        this.physics.add.existing(highPlatform, true);

        this.player = new PfPlayer(this, this.currentRespawnPoint.x, this.currentRespawnPoint.y);
        this.playerInputKeys = createPlayerInputKeys(this);

        this.physics.add.collider(this.player.arcadeBodyObject, ground);
        this.physics.add.collider(this.player.arcadeBodyObject, lowPlatform);
        this.physics.add.collider(this.player.arcadeBodyObject, highPlatform);

        this.setupWorldInteractionBaseline();

        setupBaselineFollowCamera(this, this.player.arcadeBodyObject, {
            width: TEST_WORLD_WIDTH,
            height: TEST_WORLD_HEIGHT
        });

        this.add.text(24, 24, 'sc_test', {
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '24px'
        }).setDepth(5000).setScrollFactor(0);
    }

    public update(_time: number, delta: number): void {
        this.movingPlatforms.forEach((platform) => {
            platform.update();
        });

        const input = pollPlayerInputSnapshot(this.playerInputKeys);
        const windInfluenceX = this.resolveWindInfluenceX();
        this.player.tick(delta, input, windInfluenceX);
    }

    private setupWorldInteractionBaseline(): void {
        const startCheckpoint = createCheckpoint(this, {
            x: 260,
            y: 676,
            respawnX: 220,
            respawnY: 620
        });
        const midCheckpoint = createCheckpoint(this, {
            x: 1320,
            y: 676,
            respawnX: 1320,
            respawnY: 620
        });

        this.checkpoints = [startCheckpoint, midCheckpoint];
        this.activateCheckpoint(0);

        this.checkpoints.forEach((checkpoint, index) => {
            this.physics.add.overlap(this.player.arcadeBodyObject, checkpoint.trigger, () => {
                this.activateCheckpoint(index);
            });
        });

        const hazard = createHazard(this, {
            x: 980,
            y: 720,
            width: 180,
            height: 20
        });

        this.physics.add.overlap(this.player.arcadeBodyObject, hazard.trigger, () => {
            this.handlePlayerDefeat();
        });

        const movingPlatform = createMovingPlatform(this, {
            x: 980,
            y: 555,
            width: 180,
            height: 20,
            axis: 'horizontal',
            travelDistance: 200,
            speed: 120
        });
        this.movingPlatforms = [movingPlatform];

        this.physics.add.collider(this.player.arcadeBodyObject, movingPlatform.bodyObject);

        const triggerPlatform = createTriggerPlatform(this, {
            triggerX: 560,
            triggerY: 692,
            triggerWidth: 110,
            triggerHeight: 84,
            platformX: 760,
            platformY: 470,
            platformWidth: 180,
            platformHeight: 22
        });

        this.physics.add.collider(this.player.arcadeBodyObject, triggerPlatform.platformBodyObject);
        this.physics.add.overlap(this.player.arcadeBodyObject, triggerPlatform.triggerZone, () => {
            if (!triggerPlatform.isActivated()) {
                triggerPlatform.activate();
            }
        });

        const windZone = createWindZone(this, {
            x: 1080,
            y: 640,
            width: 260,
            height: 170,
            directionX: 1,
            force: 160
        });
        this.windZones = [windZone];
    }

    private activateCheckpoint(index: number): void {
        const checkpoint = this.checkpoints[index];
        if (!checkpoint) {
            return;
        }

        this.currentRespawnPoint = {
            x: checkpoint.respawnX,
            y: checkpoint.respawnY
        };

        this.checkpoints.forEach((entry, entryIndex) => {
            entry.setActive(entryIndex === index);
        });
    }

    private handlePlayerDefeat(): void {
        if (this.respawnInProgress) {
            return;
        }

        this.respawnInProgress = true;
        this.player.freezeForRespawn();

        this.time.delayedCall(PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS, () => {
            this.player.respawnAt(this.currentRespawnPoint.x, this.currentRespawnPoint.y);
            this.respawnInProgress = false;
        });
    }

    private resolveWindInfluenceX(): number {
        if (this.windZones.length === 0) {
            return 0;
        }

        const playerObject = this.player.arcadeBodyObject;
        let horizontalInfluenceX = 0;

        this.windZones.forEach((zone) => {
            if (this.physics.overlap(playerObject, zone.trigger)) {
                horizontalInfluenceX += zone.force * zone.directionX;
            }
        });

        return horizontalInfluenceX;
    }
}
