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
    update: (deltaMs: number) => void;
    destroy: () => void;
}

type MovingPlatformMatterBody = MatterJS.BodyType & {
    pfCarryDeltaX?: number;
    pfCarryDeltaY?: number;
};

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
    const matterBody = scene.matter.add.rectangle(platform.x, platform.y, config.width, config.height, { isStatic: true }) as MovingPlatformMatterBody;
    markMatterBodyAsPlatformSurface(matterBody);
    matterBody.pfCarryDeltaX = 0;
    matterBody.pfCarryDeltaY = 0;

    const startX = config.x;
    const startY = config.y;
    let direction = 1;

    const update = (deltaMs: number): void => {
        const previousX = platform.x;
        const previousY = platform.y;
        const safeDeltaMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
        const deltaSec = safeDeltaMs / 1000;

        // Invariant:
        // - Platform position owner is Arcade integration (body velocity).
        // - Manual writes in this function are boundary clamps only, used to avoid overshoot
        //   when direction flips at travel limits.
        // - Matter pfCarryDelta is metadata for triangle carry and is derived exactly once from
        //   realized frame displacement (post-clamp), so carry speed matches actual platform motion.
        if (deltaSec <= 0) {
            body.setVelocity(0, 0);
            matterBody.pfCarryDeltaX = 0;
            matterBody.pfCarryDeltaY = 0;
            scene.matter.body.setPosition(matterBody, { x: platform.x, y: platform.y });
            return;
        }

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
            const realizedDeltaX = platform.x - previousX;
            matterBody.pfCarryDeltaX = Math.abs(realizedDeltaX) > 0 ? realizedDeltaX : (body.velocity.x * deltaSec);
            matterBody.pfCarryDeltaY = 0;
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
        const realizedDeltaY = platform.y - previousY;
        matterBody.pfCarryDeltaX = 0;
        matterBody.pfCarryDeltaY = Math.abs(realizedDeltaY) > 0 ? realizedDeltaY : (body.velocity.y * deltaSec);
        scene.matter.body.setPosition(matterBody, { x: platform.x, y: platform.y });
    };

    update(0);

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
