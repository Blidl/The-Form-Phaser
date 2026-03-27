import { GameObjects, Physics, Scene } from 'phaser';
import { setupBaselineFollowCamera } from '../game/camera/follow_camera';
import {
    PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
    PLAYER_SQUARE_TRAIL_BAR_SCREEN_X,
    PLAYER_SQUARE_TRAIL_BAR_SCREEN_Y,
    PLAYER_SQUARE_TRAIL_BAR_WIDTH,
    PLAYER_TIMER_DEFAULT_DEATH_PAUSE_MS
} from '../game/player/player_constants';
import { PfPlayer } from '../game/player/PfPlayer';
import type { PlayerHazardHitShape } from '../game/player/player_form_collision_shapes';
import { createPlayerInputKeys, pollPlayerInputSnapshot, type PlayerInputKeys } from '../game/player/player_input';
import { createCheckpoint, type CheckpointObject } from '../game/world/checkpoint';
import { createHazard, doesHazardOverlapPlayerShape, type HazardObject } from '../game/world/hazard';
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
    private hazards: HazardObject[] = [];
    private currentRespawnPoint: RespawnPoint = { x: 220, y: 620 };
    private respawnInProgress: boolean = false;
    private debugOverlay!: GameObjects.Graphics;
    private squareTrailBarTrack!: GameObjects.Rectangle;
    private squareTrailBarFill!: GameObjects.Rectangle;
    private squareTrailBarLabel!: GameObjects.Text;

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
        this.debugOverlay = this.add.graphics().setDepth(6000);

        setupBaselineFollowCamera(this, this.player.arcadeBodyObject, {
            width: TEST_WORLD_WIDTH,
            height: TEST_WORLD_HEIGHT
        });

        this.add.text(24, 24, 'sc_test', {
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '24px'
        }).setDepth(5000).setScrollFactor(0);
        this.createSquareTrailResourceBar();
    }

    public update(_time: number, delta: number): void {
        this.movingPlatforms.forEach((platform) => {
            platform.update();
        });

        const input = pollPlayerInputSnapshot(this.playerInputKeys);
        const windInfluenceX = this.resolveWindInfluenceX();
        this.player.tick(delta, input, windInfluenceX);
        this.evaluateHazardOverlap();
        this.renderCollisionDebugOverlay();
        this.updateSquareTrailResourceBar();
    }

    private createSquareTrailResourceBar(): void {
        this.squareTrailBarLabel = this.add.text(
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_X,
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_Y - 18,
            'Square trail',
            {
                color: '#d9f2ff',
                fontFamily: 'monospace',
                fontSize: '14px'
            }
        ).setDepth(5000).setScrollFactor(0);

        this.squareTrailBarTrack = this.add.rectangle(
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_X,
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_Y,
            PLAYER_SQUARE_TRAIL_BAR_WIDTH,
            PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
            0x122026,
            0.92
        )
            .setStrokeStyle(1, 0xd9f2ff, 0.85)
            .setOrigin(0, 0)
            .setDepth(5000)
            .setScrollFactor(0);

        this.squareTrailBarFill = this.add.rectangle(
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_X,
            PLAYER_SQUARE_TRAIL_BAR_SCREEN_Y,
            PLAYER_SQUARE_TRAIL_BAR_WIDTH,
            PLAYER_SQUARE_TRAIL_BAR_HEIGHT,
            0x7dd3fc,
            1
        )
            .setOrigin(0, 0)
            .setDepth(5001)
            .setScrollFactor(0);

        this.updateSquareTrailResourceBar();
    }

    private updateSquareTrailResourceBar(): void {
        if (!this.squareTrailBarFill || !this.squareTrailBarTrack || !this.squareTrailBarLabel) {
            return;
        }

        const ratio = this.player.squareTrailResourceRatio;
        const current = Math.max(0, this.player.squareTrailResourceCurrent);
        const max = Math.max(0, this.player.squareTrailResourceMax);
        this.squareTrailBarFill.width = PLAYER_SQUARE_TRAIL_BAR_WIDTH * ratio;
        const isSquareForm = this.player.currentForm === 'square';
        const activeAlpha = isSquareForm ? 1 : 0.55;
        this.squareTrailBarFill.setAlpha(activeAlpha);
        this.squareTrailBarTrack.setAlpha(activeAlpha);
        this.squareTrailBarLabel.setAlpha(activeAlpha);
        this.squareTrailBarLabel.setText(`Square trail ${Math.round(current)}/${Math.round(max)}`);
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
        this.hazards = [hazard];

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

    private evaluateHazardOverlap(): void {
        if (this.respawnInProgress) {
            return;
        }

        const playerHazardShape = this.player.hazardHitShape;
        const isTouchingHazard = this.hazards.some((hazard) => {
            return doesHazardOverlapPlayerShape(hazard, playerHazardShape);
        });

        if (isTouchingHazard) {
            this.handlePlayerDefeat();
        }
    }

    private renderCollisionDebugOverlay(): void {
        this.debugOverlay.clear();

        if (this.player.currentForm !== 'triangle') {
            this.drawBodyOutline(this.player.arcadeBodyObject.body as Physics.Arcade.Body, 0x4fc3f7);
        }
        this.drawHazardHitShape(this.player.hazardHitShape, 0xffd54f);
        if (this.player.currentForm !== 'triangle') {
            this.drawPlayerAnchor(this.player.formAnchor.x, this.player.formAnchor.y, 0xffffff);
        }

        this.hazards.forEach((hazard) => {
            const hazardBody = hazard.trigger.body as Physics.Arcade.StaticBody;
            this.debugOverlay.lineStyle(2, 0xef5350, 1);
            this.debugOverlay.strokeRect(hazardBody.x, hazardBody.y, hazardBody.width, hazardBody.height);
        });
    }

    private drawHazardHitShape(shape: PlayerHazardHitShape, color: number): void {
        this.debugOverlay.lineStyle(2, color, 1);

        if (shape.kind === 'circle') {
            this.debugOverlay.strokeCircle(shape.centerX, shape.centerY, shape.radius);
            return;
        }

        if (shape.kind === 'box') {
            this.debugOverlay.strokeRect(
                shape.centerX - (shape.width * 0.5),
                shape.centerY - (shape.height * 0.5),
                shape.width,
                shape.height
            );
            return;
        }

        const points = shape.points;
        this.debugOverlay.beginPath();
        this.debugOverlay.moveTo(points[0].x, points[0].y);
        this.debugOverlay.lineTo(points[1].x, points[1].y);
        this.debugOverlay.lineTo(points[2].x, points[2].y);
        this.debugOverlay.closePath();
        this.debugOverlay.strokePath();
    }

    private drawBodyOutline(body: Physics.Arcade.Body, color: number): void {
        this.debugOverlay.lineStyle(2, color, 1);

        if (body.isCircle) {
            const radius = body.width * 0.5;
            this.debugOverlay.strokeCircle(body.x + radius, body.y + radius, radius);
            return;
        }

        this.debugOverlay.strokeRect(body.x, body.y, body.width, body.height);
    }

    private drawPlayerAnchor(x: number, y: number, color: number): void {
        const markerHalfSize = 4;
        this.debugOverlay.lineStyle(2, color, 1);
        this.debugOverlay.beginPath();
        this.debugOverlay.moveTo(x - markerHalfSize, y);
        this.debugOverlay.lineTo(x + markerHalfSize, y);
        this.debugOverlay.moveTo(x, y - markerHalfSize);
        this.debugOverlay.lineTo(x, y + markerHalfSize);
        this.debugOverlay.strokePath();
    }
}
