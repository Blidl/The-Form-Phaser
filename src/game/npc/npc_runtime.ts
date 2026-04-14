import { GameObjects, Physics, type Scene } from 'phaser';
import type { PlayerWorldActor } from '../player/player_runtime_contracts';
import { resolveTestNpcConfig } from './npc_profiles';
import type { TestWorldActorContactRuntime } from '../world/runtime/test_world_actor_contact_runtime';
import type {
    TestNpcDebugEntry,
    TestNpcEnemyResolvedBehavior,
    TestNpcFacing,
    TestNpcInstanceConfig,
    TestNpcPassiveResolvedBehavior,
    TestNpcResolvedConfig,
    TestNpcState
} from './npc_types';
import { createTestNpcVisualRuntime, type TestNpcVisualRuntime } from './npc_visuals';

const NPC_GRAVITY_Y = 2200;
const NPC_MAX_FALL_SPEED = 1600;
const NPC_GROUND_TOLERANCE_PX = 2;

interface TestNpcActorRuntime {
    id: string;
    archetype: TestNpcResolvedConfig['profile']['archetype'];
    bodyObject: GameObjects.Rectangle;
    body: Physics.Arcade.Body;
    postX: number;
    facing: -1 | 1;
    state: TestNpcState;
    stateElapsedMs: number;
    patrolDirection: -1 | 1;
    waitMsRemaining: number;
    visual: TestNpcVisualRuntime;
    passiveBehavior: TestNpcPassiveResolvedBehavior | null;
    enemyBehavior: TestNpcEnemyResolvedBehavior | null;
    unregisterWorldActor: (() => void) | null;
}

export type TestNpcWorldCollisionRuntime = Pick<TestWorldActorContactRuntime, 'registerActor' | 'getContactSnapshot'>;

export interface TestNpcRuntime {
    update: (deltaMs: number) => void;
    getDebugEntries: () => readonly TestNpcDebugEntry[];
    getActorBounds: (id: string) => { x: number; y: number; width: number; height: number } | null;
    getVisualObject: (id: string) => GameObjects.Container | null;
    destroy: () => void;
}

const clampDeltaMs = (deltaMs: number): number => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }

    return Math.min(deltaMs, 64);
};

const playerDistanceTo = (player: PlayerWorldActor, x: number, y: number): number => {
    return Math.hypot(player.arcadeBodyObject.x - x, player.arcadeBodyObject.y - y);
};

const toFacing = (facing: TestNpcFacing | undefined): -1 | 1 => {
    return facing === 'left' ? -1 : 1;
};

const getActorX = (actor: TestNpcActorRuntime): number => actor.bodyObject.x;
const getActorY = (actor: TestNpcActorRuntime): number => actor.bodyObject.y;

const isActorGrounded = (actor: TestNpcActorRuntime): boolean => {
    return actor.body.blocked.down || actor.body.touching.down || actor.body.onFloor();
};

const isBlockedInDirection = (actor: TestNpcActorRuntime, direction: -1 | 1): boolean => {
    return direction < 0 ? actor.body.blocked.left : actor.body.blocked.right;
};

const setActorState = (actor: TestNpcActorRuntime, nextState: TestNpcState): void => {
    if (actor.state === nextState) {
        return;
    }

    actor.state = nextState;
    actor.stateElapsedMs = 0;
};

const setHorizontalVelocity = (actor: TestNpcActorRuntime, velocityX: number): void => {
    actor.body.setVelocityX(velocityX);
};

const stopHorizontalMovement = (actor: TestNpcActorRuntime): void => {
    setHorizontalVelocity(actor, 0);
};

const updatePassiveActor = (actor: TestNpcActorRuntime, deltaMs: number): void => {
    const behavior = actor.passiveBehavior;
    if (!behavior) {
        setActorState(actor, 'idle');
        stopHorizontalMovement(actor);
        actor.waitMsRemaining = 0;
        return;
    }

    if (behavior.mode === 'idle' || behavior.patrolDistance <= 0 || behavior.moveSpeed <= 0) {
        setActorState(actor, 'idle');
        stopHorizontalMovement(actor);
        actor.waitMsRemaining = 0;
        return;
    }

    setActorState(actor, 'idle_patrol');
    if (actor.waitMsRemaining > 0) {
        actor.waitMsRemaining = Math.max(0, actor.waitMsRemaining - deltaMs);
        stopHorizontalMovement(actor);
        return;
    }

    const patrolExtent = behavior.patrolDistance * 0.5;
    const targetX = actor.postX + (patrolExtent * actor.patrolDirection);
    const reachedTarget = Math.abs(getActorX(actor) - targetX) <= NPC_GROUND_TOLERANCE_PX;
    const blocked = isBlockedInDirection(actor, actor.patrolDirection);
    if (reachedTarget || blocked) {
        stopHorizontalMovement(actor);
        actor.patrolDirection = actor.patrolDirection === 1 ? -1 : 1;
        actor.waitMsRemaining = behavior.patrolPauseMs > 0 ? behavior.patrolPauseMs : behavior.idleDurationMs;
        return;
    }

    setHorizontalVelocity(actor, behavior.moveSpeed * actor.patrolDirection);
};

const updateEnemyPatrol = (actor: TestNpcActorRuntime, behavior: TestNpcEnemyResolvedBehavior): void => {
    const patrolExtent = behavior.patrolDistance * 0.5;
    const targetX = actor.postX + (patrolExtent * actor.patrolDirection);
    const reachedTarget = Math.abs(getActorX(actor) - targetX) <= NPC_GROUND_TOLERANCE_PX;
    const blocked = isBlockedInDirection(actor, actor.patrolDirection);
    if (reachedTarget || blocked) {
        stopHorizontalMovement(actor);
        actor.patrolDirection = actor.patrolDirection === 1 ? -1 : 1;
        return;
    }

    setHorizontalVelocity(actor, behavior.patrolSpeed * actor.patrolDirection);
};

const updateEnemyActor = (
    actor: TestNpcActorRuntime,
    player: PlayerWorldActor
): void => {
    const behavior = actor.enemyBehavior;
    if (!behavior) {
        setActorState(actor, 'patrol');
        stopHorizontalMovement(actor);
        return;
    }

    const actorX = getActorX(actor);
    const playerDistance = playerDistanceTo(player, actorX, getActorY(actor));
    const playerWithinSense = playerDistance <= behavior.senseRadius;
    const playerWithinRelease = playerDistance <= behavior.chaseReleaseRadius;

    if (actor.state === 'patrol') {
        updateEnemyPatrol(actor, behavior);
        if (playerWithinSense) {
            setActorState(actor, 'alert');
            stopHorizontalMovement(actor);
        }
        return;
    }

    if (actor.state === 'alert') {
        stopHorizontalMovement(actor);
        if (!playerWithinSense) {
            setActorState(actor, 'return_to_post');
            return;
        }
        if (actor.stateElapsedMs >= behavior.alertDurationMs) {
            setActorState(actor, 'chase');
        }
        return;
    }

    if (actor.state === 'chase') {
        if (!playerWithinRelease) {
            setActorState(actor, 'return_to_post');
            stopHorizontalMovement(actor);
            return;
        }

        const deltaX = player.arcadeBodyObject.x - actorX;
        if (Math.abs(deltaX) <= behavior.postTolerance) {
            stopHorizontalMovement(actor);
            return;
        }

        const chaseDirection: -1 | 1 = deltaX < 0 ? -1 : 1;
        if (isBlockedInDirection(actor, chaseDirection)) {
            stopHorizontalMovement(actor);
            return;
        }

        setHorizontalVelocity(actor, behavior.chaseSpeed * chaseDirection);
        return;
    }

    if (playerWithinSense) {
        setActorState(actor, 'alert');
        stopHorizontalMovement(actor);
        return;
    }

    const deltaToPost = actor.postX - actorX;
    if (Math.abs(deltaToPost) <= behavior.postTolerance) {
        setActorState(actor, 'patrol');
        stopHorizontalMovement(actor);
        return;
    }

    const returnDirection: -1 | 1 = deltaToPost < 0 ? -1 : 1;
    if (isBlockedInDirection(actor, returnDirection)) {
        stopHorizontalMovement(actor);
        actor.patrolDirection = returnDirection === 1 ? -1 : 1;
        setActorState(actor, 'patrol');
        return;
    }

    setActorState(actor, 'return_to_post');
    setHorizontalVelocity(actor, behavior.returnSpeed * returnDirection);
};

const refreshActorVisual = (actor: TestNpcActorRuntime): void => {
    actor.visual.setPosition(getActorX(actor), getActorY(actor));
    actor.visual.setFacing(actor.facing);
    actor.visual.setState(actor.state);
};

const destroyActor = (actor: TestNpcActorRuntime): void => {
    actor.unregisterWorldActor?.();
    actor.visual.destroy();
    actor.bodyObject.destroy();
};

export const createTestNpcRuntime = (
    scene: Scene,
    player: PlayerWorldActor,
    worldCollisionRuntime: TestNpcWorldCollisionRuntime,
    instances: readonly TestNpcInstanceConfig[]
): TestNpcRuntime => {
    const actors = instances
        .map((instance) => {
            const resolved = resolveTestNpcConfig(instance);
            if (!resolved) {
                return null;
            }

            const facing = toFacing(resolved.facing);
            const bodyObject = scene.add.rectangle(
                resolved.instance.x,
                resolved.instance.y,
                resolved.profile.visual.bodyWidth,
                resolved.profile.visual.bodyHeight,
                0xffffff,
                0
            )
                .setVisible(false)
                .setActive(true);
            scene.physics.add.existing(bodyObject);
            const body = bodyObject.body as Physics.Arcade.Body;
            body.setSize(resolved.profile.visual.bodyWidth, resolved.profile.visual.bodyHeight, true);
            body.setCollideWorldBounds(true);
            body.setAllowGravity(true);
            body.setGravityY(NPC_GRAVITY_Y);
            body.setMaxVelocity(
                Math.max(
                    resolved.passiveBehavior?.moveSpeed ?? 0,
                    resolved.enemyBehavior?.chaseSpeed ?? 0,
                    resolved.enemyBehavior?.returnSpeed ?? 0,
                    resolved.enemyBehavior?.patrolSpeed ?? 0,
                    120
                ) + 40,
                NPC_MAX_FALL_SPEED
            );
            body.pushable = false;

            const initialState: TestNpcState = resolved.profile.archetype === 'enemy'
                ? 'patrol'
                : (resolved.passiveBehavior?.mode === 'idle_patrol' ? 'idle_patrol' : 'idle');
            const actor: TestNpcActorRuntime = {
                id: resolved.instance.id,
                archetype: resolved.profile.archetype,
                bodyObject,
                body,
                postX: resolved.instance.x,
                facing,
                state: initialState,
                stateElapsedMs: 0,
                patrolDirection: facing,
                waitMsRemaining: resolved.passiveBehavior?.idleDurationMs ?? 0,
                visual: createTestNpcVisualRuntime(
                    scene,
                    resolved.instance.x,
                    resolved.instance.y,
                    resolved.profile.archetype,
                    resolved.profile.visual
                ),
                passiveBehavior: resolved.passiveBehavior,
                enemyBehavior: resolved.enemyBehavior,
                unregisterWorldActor: worldCollisionRuntime.registerActor({
                    actorId: resolved.instance.id,
                    kind: 'npc',
                    bodyObject,
                    body
                })
            };
            refreshActorVisual(actor);
            return actor;
        })
        .filter((entry): entry is TestNpcActorRuntime => entry !== null);

    return {
        update: (deltaMs: number): void => {
            const safeDeltaMs = clampDeltaMs(deltaMs);
            if (safeDeltaMs <= 0) {
                return;
            }

            actors.forEach((actor) => {
                actor.stateElapsedMs += safeDeltaMs;
                if (actor.archetype === 'enemy') {
                    updateEnemyActor(actor, player);
                } else {
                    updatePassiveActor(actor, safeDeltaMs);
                }

                if (Math.abs(actor.body.velocity.x) > 1) {
                    actor.facing = actor.body.velocity.x < 0 ? -1 : 1;
                } else if (actor.state === 'alert') {
                    actor.facing = player.arcadeBodyObject.x < getActorX(actor) ? -1 : 1;
                }

                refreshActorVisual(actor);
            });
        },
        getDebugEntries: (): readonly TestNpcDebugEntry[] => {
            return actors.map((actor) => {
                const contactSnapshot = worldCollisionRuntime.getContactSnapshot(actor.id);
                return {
                    id: actor.id,
                    archetype: actor.archetype,
                    state: actor.state,
                    locomotion: contactSnapshot?.locomotion ?? (isActorGrounded(actor) ? 'grounded' : 'airborne'),
                    blockedLeft: contactSnapshot?.blockedLeft ?? actor.body.blocked.left,
                    blockedRight: contactSnapshot?.blockedRight ?? actor.body.blocked.right,
                    touchingPlayer: contactSnapshot?.touchingPlayer ?? false,
                    touchingOtherActor: contactSnapshot?.touchingOtherActor ?? false
                };
            });
        },
        getActorBounds: (id: string): { x: number; y: number; width: number; height: number } | null => {
            const actor = actors.find((entry) => entry.id === id) ?? null;
            if (!actor) {
                return null;
            }

            return {
                x: actor.bodyObject.x,
                y: actor.bodyObject.y,
                width: actor.body.width,
                height: actor.body.height
            };
        },
        getVisualObject: (id: string): GameObjects.Container | null => {
            const actor = actors.find((entry) => entry.id === id) ?? null;
            return actor?.visual.rootObject ?? null;
        },
        destroy: (): void => {
            actors.forEach((actor) => {
                destroyActor(actor);
            });
        }
    };
};
