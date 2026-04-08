import { GameObjects, Physics, Scene } from 'phaser';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface, setPlatformSurfaceAttachPriority } from './world_surface_tags';
import type { PlayerWorldActor } from '../player/player_runtime_contracts';

export interface DraggableBoxConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    gravityY?: number;
    mass?: number;
    pullAcceleration?: number;
    pullMaxSpeed?: number;
    dragX?: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface DraggableBoxObject {
    bodyObject: GameObjects.Rectangle;
    body: Physics.Arcade.Body;
    matterBody: MatterJS.BodyType;
    update: (player: PlayerWorldActor) => void;
    destroy: () => void;
}

const DEFAULT_GRAVITY_Y = 2200;
const DEFAULT_MASS = 8;
const DEFAULT_PULL_ACCELERATION = 1600;
const DEFAULT_PULL_MAX_SPEED = 170;
const DEFAULT_DRAG_X = 700;
const ACTIVE_PULL_DISTANCE_EPSILON = 2;

export const createDraggableBox = (scene: Scene, config: DraggableBoxConfig): DraggableBoxObject => {
    const box = scene.add.rectangle(
        config.x,
        config.y,
        config.width,
        config.height,
        config.fillColor ?? 0xfff59d
    )
        .setStrokeStyle(2, config.strokeColor ?? 0xf9a825)
        .setDepth(4204);

    scene.physics.add.existing(box);
    markAsPlatformSurface(box);
    setPlatformSurfaceAttachPriority(box, 10);
    const matterBody = scene.matter.add.rectangle(box.x, box.y, config.width, config.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(matterBody);

    const body = box.body as Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setGravityY(config.gravityY ?? DEFAULT_GRAVITY_Y);
    body.setImmovable(false);
    body.setMass(config.mass ?? DEFAULT_MASS);
    body.setBounce(0);
    body.setCollideWorldBounds(true);
    body.pushable = false;
    body.setDrag(config.dragX ?? DEFAULT_DRAG_X, 0);
    body.setMaxVelocity(config.pullMaxSpeed ?? DEFAULT_PULL_MAX_SPEED, 1200);

    return {
        bodyObject: box,
        body,
        matterBody,
        update: (player: PlayerWorldActor): void => {
            const tetherSupportBody = player.squareAttachJumpPullBody;
            if (tetherSupportBody !== body) {
                body.setAcceleration(0, 0);
                if (Math.abs(body.velocity.x) <= ACTIVE_PULL_DISTANCE_EPSILON) {
                    body.setVelocityX(0);
                }
                scene.matter.body.setPosition(matterBody, { x: box.x, y: box.y });
                return;
            }

            const playerBody = player.arcadeBodyObject.body as Physics.Arcade.Body;
            const targetPoint = resolveDragBoxPullTarget(
                box.x,
                box.y,
                body.width,
                body.height,
                playerBody
            );
            const targetX = targetPoint.x;
            const targetY = targetPoint.y;
            const deltaX = targetX - box.x;
            const deltaY = targetY - box.y;
            const distance = Math.hypot(deltaX, deltaY);
            if (distance <= ACTIVE_PULL_DISTANCE_EPSILON) {
                body.setVelocity(0, 0);
                body.setAcceleration(0, 0);
                return;
            }

            const pullAcceleration = config.pullAcceleration ?? DEFAULT_PULL_ACCELERATION;
            body.setAcceleration(
                (deltaX / distance) * pullAcceleration,
                (deltaY / distance) * pullAcceleration
            );
            scene.matter.body.setPosition(matterBody, { x: box.x, y: box.y });
        },
        destroy: (): void => {
            scene.matter.world.remove(matterBody);
            box.destroy();
        }
    };
};

const resolveDragBoxPullTarget = (
    boxCenterX: number,
    boxCenterY: number,
    boxWidth: number,
    boxHeight: number,
    playerBody: Physics.Arcade.Body
): { x: number; y: number } => {
    const playerCenterX = playerBody.x + (playerBody.width * 0.5);
    const playerCenterY = playerBody.y + (playerBody.height * 0.5);
    const separationX = (playerBody.width + boxWidth) * 0.5;
    const separationY = (playerBody.height + boxHeight) * 0.5;
    let deltaX = boxCenterX - playerCenterX;
    let deltaY = boxCenterY - playerCenterY;

    if (Math.abs(deltaX) <= 0.001 && Math.abs(deltaY) <= 0.001) {
        deltaY = -1;
    }

    const scale = 1 / Math.max(
        Math.abs(deltaX) / Math.max(separationX, 0.001),
        Math.abs(deltaY) / Math.max(separationY, 0.001),
        1
    );

    return {
        x: playerCenterX + (deltaX * scale),
        y: playerCenterY + (deltaY * scale)
    };
};
