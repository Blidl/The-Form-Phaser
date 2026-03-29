import { GameObjects, Physics } from 'phaser';
import { isPlatformSurfaceGameObject } from '../world/world_surface_tags';

export function resolveBallWallContactReboundDirection(
    body: Physics.Arcade.Body,
    selfGameObject: GameObjects.GameObject,
    previousWallNormalX: -1 | 1
): -1 | 1 | null {
    const hasLeftContact = body.blocked.left || body.touching.left;
    const hasRightContact = body.blocked.right || body.touching.right;
    const probedContactDirection = resolveBallWallProbeContactDirection(body, selfGameObject, previousWallNormalX);
    const hasProbedLeftContact = probedContactDirection === 1;
    const hasProbedRightContact = probedContactDirection === -1;
    const effectiveLeftContact = hasLeftContact || hasProbedLeftContact;
    const effectiveRightContact = hasRightContact || hasProbedRightContact;

    if (effectiveLeftContact && !effectiveRightContact) {
        return 1;
    }

    if (effectiveRightContact && !effectiveLeftContact) {
        return -1;
    }

    if (!effectiveLeftContact && !effectiveRightContact) {
        return null;
    }

    if (body.velocity.x > 0) {
        return -1;
    }

    if (body.velocity.x < 0) {
        return 1;
    }

    return previousWallNormalX;
}

export function tryApplyBallReflectionRebound(
    body: Physics.Arcade.Body,
    normalX: number,
    normalY: number
): boolean {
    const velocityX = body.velocity.x;
    const velocityY = body.velocity.y;
    const velocityDotNormal = (velocityX * normalX) + (velocityY * normalY);
    if (velocityDotNormal >= -0.0001) {
        return false;
    }

    const reflectionScale = 2 * velocityDotNormal;
    body.setVelocity(
        velocityX - (reflectionScale * normalX),
        velocityY - (reflectionScale * normalY)
    );
    return true;
}

export function applyMinimumReboundSpeed(
    body: Physics.Arcade.Body,
    minimumExitSpeed: number,
    fallbackDirectionX: number,
    fallbackDirectionY: number
): void {
    const velocityX = body.velocity.x;
    const velocityY = body.velocity.y;
    const speed = Math.hypot(velocityX, velocityY);
    if (speed >= minimumExitSpeed) {
        return;
    }

    if (speed > 0.0001) {
        const scale = minimumExitSpeed / speed;
        body.setVelocity(velocityX * scale, velocityY * scale);
        return;
    }

    const fallbackLength = Math.hypot(fallbackDirectionX, fallbackDirectionY);
    if (fallbackLength <= 0.0001) {
        return;
    }

    body.setVelocity(
        (fallbackDirectionX / fallbackLength) * minimumExitSpeed,
        (fallbackDirectionY / fallbackLength) * minimumExitSpeed
    );
}

export function applyMinimumCeilingReboundDownwardSpeed(
    body: Physics.Arcade.Body,
    minimumDownwardSpeed: number
): void {
    if (body.velocity.y >= minimumDownwardSpeed) {
        return;
    }

    body.setVelocityY(minimumDownwardSpeed);
}

function resolveBallWallProbeContactDirection(
    body: Physics.Arcade.Body,
    selfGameObject: GameObjects.GameObject,
    previousWallNormalX: -1 | 1
): -1 | 1 | null {
    const bodyX = body.x;
    const bodyY = body.y;
    const bodyWidth = body.width;
    const bodyHeight = body.height;
    const sideProbeWidth = 3;
    const verticalInset = 3;
    const probeHeight = Math.max(1, bodyHeight - (verticalInset * 2));
    const probeY = bodyY + verticalInset;

    const leftProbeBodies = selfGameObject.scene.physics.overlapRect(
        bodyX - sideProbeWidth,
        probeY,
        sideProbeWidth,
        probeHeight,
        true,
        true
    ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;
    const rightProbeBodies = selfGameObject.scene.physics.overlapRect(
        bodyX + bodyWidth,
        probeY,
        sideProbeWidth,
        probeHeight,
        true,
        true
    ) as Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>;

    const hasLeftProbeHit = hasBallWallProbeHit(leftProbeBodies, body, selfGameObject);
    const hasRightProbeHit = hasBallWallProbeHit(rightProbeBodies, body, selfGameObject);

    if (hasLeftProbeHit && !hasRightProbeHit) {
        return 1;
    }

    if (hasRightProbeHit && !hasLeftProbeHit) {
        return -1;
    }

    if (!hasLeftProbeHit && !hasRightProbeHit) {
        return null;
    }

    return previousWallNormalX;
}

function hasBallWallProbeHit(
    bodies: Array<Physics.Arcade.Body | Physics.Arcade.StaticBody>,
    selfBody: Physics.Arcade.Body,
    selfGameObject: GameObjects.GameObject
): boolean {
    for (const body of bodies) {
        if (body === selfBody) {
            continue;
        }

        const candidate = body as Physics.Arcade.Body;
        if (candidate.enable === false) {
            continue;
        }

        const gameObject = (body as { gameObject?: GameObjects.GameObject }).gameObject;
        if (gameObject === selfGameObject) {
            continue;
        }

        if (!isPlatformSurfaceGameObject(gameObject)) {
            continue;
        }

        return true;
    }

    return false;
}
