import type { GameObjects, Physics, Scene } from 'phaser';
import { PLAYER_FORM_TRIANGLE_HEIGHT, PLAYER_FORM_TRIANGLE_WIDTH, PLAYER_GRAVITY_Y } from '../player_constants';
import type { PlayerShellState, TriangleEdgeIndex } from '../player_types';
import { isPlatformSurfaceMatterBody } from '../../world/world_surface_tags';

const CONTACT_EPSILON = 0.35;
const MAX_FALL_SPEED = 1200;
const MAX_STEP_LENGTH_PX = 8;
const POSITION_EPSILON = 0.0001;
const SUPPORT_EDGE_SWITCH_TOLERANCE_PX = 1.5;
const RESTING_CONTACT_GAP_PX = 2;

export const createTriangleCollisionState = () => {
    return {
        hasGroundContact: false,
        hasCeilingContact: false,
        hasLeftWallContact: false,
        hasRightWallContact: false,
        groundSupportEdgeIndex: null
    };
};

export const resetTriangleCollisionState = (triangleCollision: PlayerShellState['triangleCollision']): void => {
    triangleCollision.hasGroundContact = false;
    triangleCollision.hasCeilingContact = false;
    triangleCollision.hasLeftWallContact = false;
    triangleCollision.hasRightWallContact = false;
};

export interface PlayerTriangleMatterRuntime {
    readonly body: MatterJS.BodyType;
    readonly debugPoints: Array<{ x: number; y: number }>;
    readonly bodyOffsetFromAnchorLocal: { x: number; y: number };
}

export const createTriangleMatterRuntime = (
    scene: Scene,
    x: number,
    y: number
): PlayerTriangleMatterRuntime => {
    const halfWidth = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
    const halfHeight = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
    const body = scene.matter.add.fromVertices(
        x,
        y,
        [
            { x: -halfWidth, y: halfHeight },
            { x: 0, y: -halfHeight },
            { x: halfWidth, y: halfHeight }
        ],
        {
            isStatic: true,
            friction: 0,
            frictionStatic: 0,
            frictionAir: 0,
            restitution: 0,
            ignoreGravity: true,
            inertia: Infinity
        }
    );
    scene.matter.world.remove(body);

    return {
        body,
        debugPoints: [],
        bodyOffsetFromAnchorLocal: resolveTriangleCentroidOffset()
    };
};

export const destroyTriangleMatterRuntime = (
    _scene: Scene,
    _runtime: PlayerTriangleMatterRuntime
): void => {
    // Body is kept out of the Matter world and used as a geometry carrier for kinematic collision.
};

export const syncTriangleArcadeBodyMode = (
    state: PlayerShellState,
    physicsBody: Physics.Arcade.Body,
    frozenForRespawn: boolean
): void => {
    const usesArcadeIntegration = state.currentForm !== 'triangle';
    const usesArcadeCollisions = usesArcadeIntegration && !frozenForRespawn;
    physicsBody.moves = usesArcadeIntegration;
    physicsBody.setAllowGravity(usesArcadeIntegration && !frozenForRespawn);
    physicsBody.setCollideWorldBounds(usesArcadeCollisions);
};

export const syncTriangleMatterMode = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    state: PlayerShellState,
    physicsSprite: GameObjects.Arc,
    _physicsBody: Physics.Arcade.Body,
    _frozenForRespawn: boolean
): void => {
    if (state.currentForm !== 'triangle') {
        const bodyOffset = rotateOffset(runtime.bodyOffsetFromAnchorLocal, 0);
        scene.matter.body.setPosition(runtime.body, {
            x: physicsSprite.x + bodyOffset.x,
            y: physicsSprite.y + bodyOffset.y
        });
        scene.matter.body.setAngle(runtime.body, 0);
        refreshTriangleMatterContacts(runtime, state.triangleCollision);
        return;
    }

    const bodyOffset = rotateOffset(runtime.bodyOffsetFromAnchorLocal, state.triangleShell.orientationRad);
    scene.matter.body.setPosition(runtime.body, {
        x: physicsSprite.x + bodyOffset.x,
        y: physicsSprite.y + bodyOffset.y
    });
    scene.matter.body.setAngle(runtime.body, state.triangleShell.orientationRad);
    refreshTriangleMatterContacts(runtime, state.triangleCollision);
};

export const refreshTriangleMatterContacts = (
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision']
): void => {
    runtime.debugPoints.length = 0;

    runtime.body.vertices.forEach((vertex) => {
        runtime.debugPoints.push({ x: vertex.x, y: vertex.y });
    });
};

export const stepTriangleMatterKinematicRuntime = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsSprite: GameObjects.Arc,
    physicsBody: Physics.Arcade.Body,
    deltaSec: number
): void => {
    resetTriangleCollisionState(triangleCollision);
    resolveTrianglePenetration(scene, runtime, triangleCollision, physicsBody);
    clampTriangleToWorldBounds(scene, runtime, triangleCollision, physicsBody);

    if (physicsBody.allowGravity) {
        physicsBody.setVelocityY(Math.min(MAX_FALL_SPEED, physicsBody.velocity.y + (PLAYER_GRAVITY_Y * deltaSec)));
    }

    const totalDeltaX = physicsBody.velocity.x * deltaSec;
    const totalDeltaY = physicsBody.velocity.y * deltaSec;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(totalDeltaX), Math.abs(totalDeltaY)) / MAX_STEP_LENGTH_PX));
    const stepDeltaX = totalDeltaX / steps;
    const stepDeltaY = totalDeltaY / steps;

    for (let index = 0; index < steps; index += 1) {
        moveTriangleAlongAxis(scene, runtime, triangleCollision, physicsBody, stepDeltaX, 0);
        moveTriangleAlongAxis(scene, runtime, triangleCollision, physicsBody, 0, stepDeltaY);
        clampTriangleToWorldBounds(scene, runtime, triangleCollision, physicsBody);
    }

    syncTriangleProxyFromMatter(runtime, physicsSprite, physicsBody);
    applyTriangleRestingContacts(scene, runtime, triangleCollision, physicsBody);
    updateTriangleSupportEdge(runtime, triangleCollision);
    refreshTriangleMatterContacts(runtime, triangleCollision);
};

export const primeTriangleMatterKinematicState = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsSprite: GameObjects.Arc,
    physicsBody: Physics.Arcade.Body
): void => {
    resetTriangleCollisionState(triangleCollision);
    resolveTrianglePenetration(scene, runtime, triangleCollision, physicsBody);
    clampTriangleToWorldBounds(scene, runtime, triangleCollision, physicsBody);
    syncTriangleProxyFromMatter(runtime, physicsSprite, physicsBody);
    applyTriangleRestingContacts(scene, runtime, triangleCollision, physicsBody);
    updateTriangleSupportEdge(runtime, triangleCollision);
    refreshTriangleMatterContacts(runtime, triangleCollision);
};

export const syncTriangleProxyFromMatter = (
    runtime: PlayerTriangleMatterRuntime,
    physicsSprite: GameObjects.Arc,
    physicsBody: Physics.Arcade.Body
): void => {
    const anchorOffset = rotateOffset(runtime.bodyOffsetFromAnchorLocal, runtime.body.angle);
    const velocityX = physicsBody.velocity.x;
    const velocityY = physicsBody.velocity.y;
    physicsBody.reset(
        runtime.body.position.x - anchorOffset.x,
        runtime.body.position.y - anchorOffset.y
    );
    physicsBody.setVelocity(velocityX, velocityY);
    physicsBody.setAcceleration(0, 0);
    physicsSprite.x = runtime.body.position.x - anchorOffset.x;
    physicsSprite.y = runtime.body.position.y - anchorOffset.y;
};

const moveTriangleAlongAxis = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsBody: Physics.Arcade.Body,
    deltaX: number,
    deltaY: number
): void => {
    if (Math.abs(deltaX) <= POSITION_EPSILON && Math.abs(deltaY) <= POSITION_EPSILON) {
        return;
    }

    scene.matter.body.translate(runtime.body, { x: deltaX, y: deltaY });
    resolveTrianglePenetration(scene, runtime, triangleCollision, physicsBody);
};

const resolveTrianglePenetration = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsBody: Physics.Arcade.Body
): void => {
    const surfaceBodies = scene.matter.world.getAllBodies().filter((body) => {
        return isPlatformSurfaceMatterBody(body);
    });

    for (let passIndex = 0; passIndex < 4; passIndex += 1) {
        let resolvedAnyCollision = false;

        for (const surfaceBody of surfaceBodies) {
            const collision = scene.matter.collision.collides(runtime.body, surfaceBody);
            if (!collision || collision.depth <= POSITION_EPSILON) {
                continue;
            }

            const normal = resolveTriangleCollisionNormal(runtime.body, collision);
            const orthogonalResolution = resolveTrianglePlatformSeparation(runtime.body, surfaceBody, normal);
            resolvedAnyCollision = true;
            registerCollisionContact(triangleCollision, orthogonalResolution.normalX, orthogonalResolution.normalY);
            scene.matter.body.translate(runtime.body, {
                x: orthogonalResolution.deltaX,
                y: orthogonalResolution.deltaY
            });
            cancelVelocityIntoSurface(physicsBody, orthogonalResolution.normalX, orthogonalResolution.normalY);
        }

        if (!resolvedAnyCollision) {
            break;
        }
    }
}

const clampTriangleToWorldBounds = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsBody: Physics.Arcade.Body
): void => {
    const worldBounds = scene.physics.world.bounds;
    let deltaX = 0;
    let deltaY = 0;

    runtime.body.vertices.forEach((vertex) => {
        if (vertex.x < worldBounds.x) {
            deltaX = Math.max(deltaX, worldBounds.x - vertex.x);
        } else if (vertex.x > worldBounds.right) {
            deltaX = Math.min(deltaX, worldBounds.right - vertex.x);
        }

        if (vertex.y < worldBounds.y) {
            deltaY = Math.max(deltaY, worldBounds.y - vertex.y);
        } else if (vertex.y > worldBounds.bottom) {
            deltaY = Math.min(deltaY, worldBounds.bottom - vertex.y);
        }
    });

    if (Math.abs(deltaX) > POSITION_EPSILON) {
        scene.matter.body.translate(runtime.body, { x: deltaX, y: 0 });
        registerCollisionContact(triangleCollision, deltaX > 0 ? 1 : -1, 0);
        physicsBody.setVelocityX(0);
    }

    if (Math.abs(deltaY) > POSITION_EPSILON) {
        scene.matter.body.translate(runtime.body, { x: 0, y: deltaY });
        registerCollisionContact(triangleCollision, 0, deltaY > 0 ? -1 : 1);
        physicsBody.setVelocityY(0);
    }
};

const cancelVelocityIntoSurface = (
    physicsBody: Physics.Arcade.Body,
    normalX: number,
    normalY: number
): void => {
    const inwardSpeed = (physicsBody.velocity.x * normalX) + (physicsBody.velocity.y * normalY);
    if (inwardSpeed >= 0) {
        return;
    }

    physicsBody.setVelocity(
        physicsBody.velocity.x - (normalX * inwardSpeed),
        physicsBody.velocity.y - (normalY * inwardSpeed)
    );
};

const registerCollisionContact = (
    triangleCollision: PlayerShellState['triangleCollision'],
    normalX: number,
    normalY: number
): void => {
    if (normalY < -CONTACT_EPSILON) {
        triangleCollision.hasGroundContact = true;
    }
    if (normalY > CONTACT_EPSILON) {
        triangleCollision.hasCeilingContact = true;
    }
    if (normalX > CONTACT_EPSILON) {
        triangleCollision.hasLeftWallContact = true;
    }
    if (normalX < -CONTACT_EPSILON) {
        triangleCollision.hasRightWallContact = true;
    }
};

const updateTriangleSupportEdge = (
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision']
): void => {
    if (!triangleCollision.hasGroundContact) {
        triangleCollision.groundSupportEdgeIndex = null;
        return;
    }

    const previousEdgeIndex = triangleCollision.groundSupportEdgeIndex;
    if (
        previousEdgeIndex !== null &&
        isSupportEdgeStable(runtime.body.vertices, previousEdgeIndex)
    ) {
        triangleCollision.groundSupportEdgeIndex = previousEdgeIndex;
        return;
    }

    triangleCollision.groundSupportEdgeIndex = resolveBottomSupportEdgeIndex(runtime.body.vertices);
};

const applyTriangleRestingContacts = (
    scene: Scene,
    runtime: PlayerTriangleMatterRuntime,
    triangleCollision: PlayerShellState['triangleCollision'],
    physicsBody: Physics.Arcade.Body
): void => {
    const surfaceBodies = scene.matter.world.getAllBodies().filter((body) => {
        return isPlatformSurfaceMatterBody(body);
    });
    const triangleBounds = runtime.body.bounds;

    for (const surfaceBody of surfaceBodies) {
        const platformBounds = surfaceBody.bounds;
        const overlapX = Math.min(triangleBounds.max.x, platformBounds.max.x) - Math.max(triangleBounds.min.x, platformBounds.min.x);
        if (overlapX <= POSITION_EPSILON) {
            continue;
        }

        const floorGap = platformBounds.min.y - triangleBounds.max.y;
        if (floorGap >= -POSITION_EPSILON && floorGap <= RESTING_CONTACT_GAP_PX) {
            if (floorGap > POSITION_EPSILON) {
                scene.matter.body.translate(runtime.body, { x: 0, y: floorGap });
            }
            triangleCollision.hasGroundContact = true;
            physicsBody.setVelocityY(Math.min(physicsBody.velocity.y, 0));
            continue;
        }

        const ceilingGap = triangleBounds.min.y - platformBounds.max.y;
        if (ceilingGap >= -POSITION_EPSILON && ceilingGap <= RESTING_CONTACT_GAP_PX) {
            if (ceilingGap > POSITION_EPSILON) {
                scene.matter.body.translate(runtime.body, { x: 0, y: -ceilingGap });
            }
            triangleCollision.hasCeilingContact = true;
            physicsBody.setVelocityY(Math.max(physicsBody.velocity.y, 0));
        }
    }
};

const resolveTriangleCollisionNormal = (
    triangleBody: MatterJS.BodyType,
    collision: MatterJS.ICollisionData
): { x: number; y: number } => {
    const pointsAwayFromTriangle = collision.parentA === triangleBody || collision.bodyA === triangleBody;

    return pointsAwayFromTriangle
        ? { x: collision.normal.x, y: collision.normal.y }
        : { x: -collision.normal.x, y: -collision.normal.y };
};

const resolveTrianglePlatformSeparation = (
    triangleBody: MatterJS.BodyType,
    platformBody: MatterJS.BodyType,
    normal: { x: number; y: number }
): { deltaX: number; deltaY: number; normalX: number; normalY: number } => {
    const triangleBounds = triangleBody.bounds;
    const platformBounds = platformBody.bounds;

    if (Math.abs(normal.y) >= Math.abs(normal.x)) {
        if (normal.y < 0) {
            return {
                deltaX: 0,
                deltaY: platformBounds.min.y - triangleBounds.max.y,
                normalX: 0,
                normalY: -1
            };
        }

        return {
            deltaX: 0,
            deltaY: platformBounds.max.y - triangleBounds.min.y,
            normalX: 0,
            normalY: 1
        };
    }

    if (normal.x > 0) {
        return {
            deltaX: platformBounds.max.x - triangleBounds.min.x,
            deltaY: 0,
            normalX: 1,
            normalY: 0
        };
    }

    return {
        deltaX: platformBounds.min.x - triangleBounds.max.x,
        deltaY: 0,
        normalX: -1,
        normalY: 0
    };
};

const resolveTriangleCentroidOffset = (): { x: number; y: number } => {
    const halfWidth = PLAYER_FORM_TRIANGLE_WIDTH * 0.5;
    const halfHeight = PLAYER_FORM_TRIANGLE_HEIGHT * 0.5;
    const localVertices = [
        { x: -halfWidth, y: halfHeight },
        { x: 0, y: -halfHeight },
        { x: halfWidth, y: halfHeight }
    ];

    return {
        x: (localVertices[0].x + localVertices[1].x + localVertices[2].x) / 3,
        y: (localVertices[0].y + localVertices[1].y + localVertices[2].y) / 3
    };
};

const rotateOffset = (
    offset: { x: number; y: number },
    angleRad: number
): { x: number; y: number } => {
    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);

    return {
        x: (offset.x * cos) - (offset.y * sin),
        y: (offset.x * sin) + (offset.y * cos)
    };
};

const resolveBottomSupportEdgeIndex = (
    vertices: MatterJS.Vertex[]
): TriangleEdgeIndex => {
    const edgeIndices: TriangleEdgeIndex[] = [0, 1, 2];
    let selectedEdgeIndex: TriangleEdgeIndex = 2;
    let selectedMidY = Number.NEGATIVE_INFINITY;

    edgeIndices.forEach((edgeIndex) => {
        const start = vertices[edgeIndex];
        const end = vertices[(edgeIndex + 1) % vertices.length];
        const midpointY = (start.y + end.y) * 0.5;

        if (midpointY > selectedMidY) {
            selectedMidY = midpointY;
            selectedEdgeIndex = edgeIndex;
        }
    });

    return selectedEdgeIndex;
};

const isSupportEdgeStable = (
    vertices: MatterJS.Vertex[],
    edgeIndex: TriangleEdgeIndex
): boolean => {
    const currentMidpointY = resolveEdgeMidpointY(vertices, edgeIndex);
    const bottomEdgeIndex = resolveBottomSupportEdgeIndex(vertices);
    const bottomMidpointY = resolveEdgeMidpointY(vertices, bottomEdgeIndex);

    return currentMidpointY >= bottomMidpointY - SUPPORT_EDGE_SWITCH_TOLERANCE_PX;
};

const resolveEdgeMidpointY = (
    vertices: MatterJS.Vertex[],
    edgeIndex: TriangleEdgeIndex
): number => {
    const start = vertices[edgeIndex];
    const end = vertices[(edgeIndex + 1) % vertices.length];
    return (start.y + end.y) * 0.5;
};
