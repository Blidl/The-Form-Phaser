import { GameObjects, Physics, Scene } from 'phaser';
import { markAsPlatformSurface, markMatterBodyAsPlatformSurface } from './world_surface_tags';

export interface MovingPlatformConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    axis: 'horizontal' | 'vertical';
    travelDistance: number;
    speed: number;
    fillColor?: number;
    strokeColor?: number;
}

export interface MovingPlatformObject {
    bodyObject: GameObjects.Rectangle;
    matterBody: MatterJS.BodyType;
    update: () => void;
    destroy: () => void;
}

export const createMovingPlatform = (scene: Scene, config: MovingPlatformConfig): MovingPlatformObject => {
    const platform = scene.add.rectangle(
        config.x,
        config.y,
        config.width,
        config.height,
        config.fillColor ?? 0xffcc80
    )
        .setStrokeStyle(2, config.strokeColor ?? 0xef6c00)
        .setDepth(4205);

    scene.physics.add.existing(platform);
    markAsPlatformSurface(platform);
    const body = platform.body as Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.pushable = false;
    const matterBody = scene.matter.add.rectangle(platform.x, platform.y, config.width, config.height, { isStatic: true });
    markMatterBodyAsPlatformSurface(matterBody);

    const startX = config.x;
    const startY = config.y;
    let direction = 1;

    const update = (): void => {
        const velocity = config.speed * direction;

        if (config.axis === 'horizontal') {
            body.setVelocity(velocity, 0);

            const offset = platform.x - startX;
            if (offset >= config.travelDistance && direction > 0) {
                platform.x = startX + config.travelDistance;
                direction = -1;
                body.setVelocity(-config.speed, 0);
            } else if (offset <= -config.travelDistance && direction < 0) {
                platform.x = startX - config.travelDistance;
                direction = 1;
                body.setVelocity(config.speed, 0);
            }
            scene.matter.body.setPosition(matterBody, { x: platform.x, y: platform.y });
            return;
        }

        body.setVelocity(0, velocity);

        const offset = platform.y - startY;
        if (offset >= config.travelDistance && direction > 0) {
            platform.y = startY + config.travelDistance;
            direction = -1;
            body.setVelocity(0, -config.speed);
        } else if (offset <= -config.travelDistance && direction < 0) {
            platform.y = startY - config.travelDistance;
            direction = 1;
            body.setVelocity(0, config.speed);
        }
        scene.matter.body.setPosition(matterBody, { x: platform.x, y: platform.y });
    };

    update();

    return {
        bodyObject: platform,
        matterBody,
        update,
        destroy: (): void => {
            scene.matter.world.remove(matterBody);
            platform.destroy();
        }
    };
};
