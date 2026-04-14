import { GameObjects, Physics, type Scene } from 'phaser';
import type { PlayerWorldActor } from '../player/player_runtime_contracts';
import { resolveTestNpcConfig } from './npc_profiles';
import type { TestWorldActorContactRuntime } from '../world/runtime/test_world_actor_contact_runtime';
import {
    createArcadeBodyBoundsContactShapeSnapshot,
    doesActorContactShapeOverlap,
    resolvePolygonRectSeparationDelta
} from '../world/runtime/test_world_actor_contact_shapes';
import {
    createActorActionSequenceRuntime,
    type ActorActionSequenceRuntime
} from '../actor_actions/actor_action_runtime';
import type {
    ActorActionExecutionSnapshot,
    ActorActionSequence
} from '../actor_actions/actor_action_types';
import { describeActorActionTarget } from '../actor_actions/actor_action_types';
import type {
    TestNpcDebugEntry,
    TestNpcEnemyResolvedBehavior,
    TestNpcFacing,
    TestNpcInstanceConfig,
    TestNpcPlayerBodyContactMode,
    TestNpcPassiveResolvedBehavior,
    TestNpcPresentationAnimation,
    TestNpcPresentationEmotion,
    TestNpcResolvedConfig,
    TestNpcState
} from './npc_types';
import { createTestNpcVisualRuntime, type TestNpcVisualRuntime } from './npc_visuals';
import { createTestNpcActorActionAdapter } from './npc_actor_action_adapter';
import {
    NPC_SCRIPTED_SEQUENCE_SOURCE,
    resolveTestNpcScriptedSequence
} from './npc_scripted_sequences';

const NPC_GRAVITY_Y = 2200;
const NPC_MAX_FALL_SPEED = 1600;
const NPC_GROUND_TOLERANCE_PX = 2;

interface TestNpcActorRuntime {
    id: string;
    archetype: TestNpcResolvedConfig['profile']['archetype'];
    playerBodyContactMode: TestNpcPlayerBodyContactMode;
    bodyObject: GameObjects.Rectangle;
    body: Physics.Arcade.Body;
    supportMatterBody: MatterJS.BodyType;
    exportsTriangleSupportSurface: boolean;
    postX: number;
    facing: -1 | 1;
    state: TestNpcState;
    stateElapsedMs: number;
    patrolDirection: -1 | 1;
    waitMsRemaining: number;
    visual: TestNpcVisualRuntime;
    presentationAnimation: TestNpcPresentationAnimation | null;
    presentationEmotion: TestNpcPresentationEmotion | null;
    lastTriggeredEventId: string | null;
    passiveBehavior: TestNpcPassiveResolvedBehavior | null;
    enemyBehavior: TestNpcEnemyResolvedBehavior | null;
    unregisterWorldActor: (() => void) | null;
    trianglePushLockDirection: -1 | 0 | 1;
    profileScriptedLoopRef: string | null;
    scriptedLoopInstanceOverride: string | null | undefined;
    scriptedLoopRef: string | null;
    actionRuntime: ActorActionSequenceRuntime;
}

export type TestNpcWorldCollisionRuntime = Pick<TestWorldActorContactRuntime, 'registerActor' | 'getContactSnapshot'>;

export interface TestNpcRuntime {
    update: (deltaMs: number) => void;
    syncTriangleSupportSurfaces: () => void;
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
const shouldNpcBlockPlayerBody = (mode: TestNpcPlayerBodyContactMode): boolean => mode === 'block';
const shouldNpcExportTriangleSupportSurface = (mode: TestNpcPlayerBodyContactMode): boolean => mode === 'block';

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

const stopHorizontalMovement = (actor: TestNpcActorRuntime): void => {
    actor.body.setVelocityX(0);
};

const setPresentationAnimationStub = (
    actor: TestNpcActorRuntime,
    animationId: TestNpcPresentationAnimation | null
): void => {
    actor.presentationAnimation = animationId;
    actor.visual.setPresentationStubState(actor.presentationAnimation, actor.presentationEmotion);
};

const setPresentationEmotionStub = (
    actor: TestNpcActorRuntime,
    emotionId: TestNpcPresentationEmotion | null
): void => {
    actor.presentationEmotion = emotionId;
    actor.visual.setPresentationStubState(actor.presentationAnimation, actor.presentationEmotion);
};

const updateTrianglePushLock = (
    actor: TestNpcActorRuntime,
    player: PlayerWorldActor
): void => {
    if (actor.trianglePushLockDirection === 0) {
        return;
    }

    if (player.contactMode !== 'triangle_polygon') {
        actor.trianglePushLockDirection = 0;
        return;
    }

    const playerShape = player.contactShapeSnapshot;
    if (playerShape.kind !== 'polygon_snapshot') {
        actor.trianglePushLockDirection = 0;
        return;
    }

    const actorShape = createArcadeBodyBoundsContactShapeSnapshot(
        actor.bodyObject,
        actor.body,
        actor.body.x,
        actor.body.y
    );
    if (!doesActorContactShapeOverlap(playerShape, actorShape)) {
        actor.trianglePushLockDirection = 0;
    }
};

const isTrianglePushLocked = (
    actor: TestNpcActorRuntime,
    direction: -1 | 1
): boolean => actor.trianglePushLockDirection === direction;

const tryApplyActorHorizontalMovement = (
    actor: TestNpcActorRuntime,
    player: PlayerWorldActor,
    velocityX: number,
    deltaMs: number
): 'applied' | 'blocked_left' | 'blocked_right' | 'triangle_push_locked' => {
    if (Math.abs(velocityX) <= 0.0001) {
        stopHorizontalMovement(actor);
        actor.trianglePushLockDirection = 0;
        return 'applied';
    }

    const direction: -1 | 1 = velocityX < 0 ? -1 : 1;
    if (isBlockedInDirection(actor, direction)) {
        stopHorizontalMovement(actor);
        return direction < 0 ? 'blocked_left' : 'blocked_right';
    }

    if (!shouldNpcBlockPlayerBody(actor.playerBodyContactMode)) {
        actor.trianglePushLockDirection = 0;
        actor.body.setVelocityX(velocityX);
        return 'applied';
    }

    updateTrianglePushLock(actor, player);
    if (player.contactMode !== 'triangle_polygon') {
        actor.trianglePushLockDirection = 0;
        actor.body.setVelocityX(velocityX);
        return 'applied';
    }

    const playerShape = player.contactShapeSnapshot;
    if (playerShape.kind !== 'polygon_snapshot') {
        actor.trianglePushLockDirection = 0;
        actor.body.setVelocityX(velocityX);
        return 'applied';
    }

    const currentActorShape = createArcadeBodyBoundsContactShapeSnapshot(
        actor.bodyObject,
        actor.body,
        actor.body.x,
        actor.body.y
    );
    if (doesActorContactShapeOverlap(playerShape, currentActorShape)) {
        const currentSeparationDelta = resolvePolygonRectSeparationDelta(playerShape, currentActorShape);
        if (currentSeparationDelta !== null && Math.abs(currentSeparationDelta.x) > 0.0001) {
            player.applyActorContactPush(-currentSeparationDelta.x, 0);
        }

        const refreshedPlayerShape = player.contactShapeSnapshot;
        if (refreshedPlayerShape.kind !== 'polygon_snapshot') {
            actor.trianglePushLockDirection = 0;
            return;
        }

        const refreshedActorShape = createArcadeBodyBoundsContactShapeSnapshot(
            actor.bodyObject,
            actor.body,
            actor.body.x,
            actor.body.y
        );
        if (doesActorContactShapeOverlap(refreshedPlayerShape, refreshedActorShape) && currentSeparationDelta !== null) {
            actor.body.reset(actor.body.x + currentSeparationDelta.x, actor.body.y);
            stopHorizontalMovement(actor);
        }
    }

    if (isTrianglePushLocked(actor, direction)) {
        stopHorizontalMovement(actor);
        return 'triangle_push_locked';
    }

    const predictedBodyX = actor.body.x + (velocityX * (deltaMs / 1000));
    const predictedActorShape = createArcadeBodyBoundsContactShapeSnapshot(
        actor.bodyObject,
        actor.body,
        predictedBodyX,
        actor.body.y
    );
    if (!doesActorContactShapeOverlap(playerShape, predictedActorShape)) {
        actor.trianglePushLockDirection = 0;
        actor.body.setVelocityX(velocityX);
        return 'applied';
    }

    const predictedSeparationDelta = resolvePolygonRectSeparationDelta(playerShape, predictedActorShape);
    if (predictedSeparationDelta !== null && Math.abs(predictedSeparationDelta.x) > 0.0001) {
        const appliedPush = player.applyActorContactPush(-predictedSeparationDelta.x, 0);
        const pushedPlayerShape = player.contactShapeSnapshot;
        if (pushedPlayerShape.kind === 'polygon_snapshot') {
            const refreshedPredictedActorShape = createArcadeBodyBoundsContactShapeSnapshot(
                actor.bodyObject,
                actor.body,
                predictedBodyX,
                actor.body.y
            );
            if (!doesActorContactShapeOverlap(pushedPlayerShape, refreshedPredictedActorShape)) {
                actor.trianglePushLockDirection = 0;
                actor.body.setVelocityX(velocityX);
                return 'applied';
            }
        }

        actor.trianglePushLockDirection = direction;
        if (Math.abs(appliedPush.appliedDeltaX) < 0.0001) {
            stopHorizontalMovement(actor);
            return 'triangle_push_locked';
        }
    }

    actor.trianglePushLockDirection = direction;
    stopHorizontalMovement(actor);
    return 'triangle_push_locked';
};

const syncNpcSupportSurfaceMode = (actor: TestNpcActorRuntime): void => {
    actor.supportMatterBody.label = actor.exportsTriangleSupportSurface
        ? 'pf_platform_surface'
        : 'pf_npc_support_surface_disabled';
};

const updateScriptedLoopActor = (actor: TestNpcActorRuntime): ActorActionSequence | null => {
    if (!actor.scriptedLoopRef) {
        return null;
    }

    setActorState(actor, 'scripted_loop');
    actor.waitMsRemaining = 0;
    return resolveTestNpcScriptedSequence(actor.id, actor.scriptedLoopRef);
};

const updatePassiveActor = (
    actor: TestNpcActorRuntime,
    deltaMs: number
): ActorActionSequence | null => {
    const behavior = actor.passiveBehavior;
    if (!behavior) {
        setActorState(actor, 'idle');
        actor.waitMsRemaining = 0;
        return null;
    }

    if (behavior.mode === 'idle' || behavior.patrolDistance <= 0 || behavior.moveSpeed <= 0) {
        setActorState(actor, 'idle');
        actor.waitMsRemaining = 0;
        return null;
    }

    setActorState(actor, 'idle_patrol');
    if (actor.waitMsRemaining > 0) {
        actor.waitMsRemaining = Math.max(0, actor.waitMsRemaining - deltaMs);
        return null;
    }

    const patrolExtent = behavior.patrolDistance * 0.5;
    const targetX = actor.postX + (patrolExtent * actor.patrolDirection);
    const reachedTarget = Math.abs(getActorX(actor) - targetX) <= NPC_GROUND_TOLERANCE_PX;
    const blocked = isBlockedInDirection(actor, actor.patrolDirection);
    if (reachedTarget || blocked) {
        actor.patrolDirection = actor.patrolDirection === 1 ? -1 : 1;
        actor.waitMsRemaining = behavior.patrolPauseMs > 0 ? behavior.patrolPauseMs : behavior.idleDurationMs;
        return null;
    }

    if (isTrianglePushLocked(actor, actor.patrolDirection)) {
        return null;
    }

    return {
        id: `${actor.id}:passive_patrol_walk`,
        source: 'npc_runtime',
        targetRef: 'patrol_post',
        actions: [{
            kind: 'walk_to_x',
            ref: actor.patrolDirection < 0 ? 'patrol_left_extent' : 'patrol_right_extent',
            targetX,
            moveSpeed: behavior.moveSpeed,
            tolerancePx: NPC_GROUND_TOLERANCE_PX
        }]
    };
};

const updateEnemyPatrol = (
    actor: TestNpcActorRuntime,
    behavior: TestNpcEnemyResolvedBehavior
): ActorActionSequence | null => {
    const patrolExtent = behavior.patrolDistance * 0.5;
    const targetX = actor.postX + (patrolExtent * actor.patrolDirection);
    const reachedTarget = Math.abs(getActorX(actor) - targetX) <= NPC_GROUND_TOLERANCE_PX;
    const blocked = isBlockedInDirection(actor, actor.patrolDirection);
    if (reachedTarget || blocked) {
        actor.patrolDirection = actor.patrolDirection === 1 ? -1 : 1;
        return null;
    }

    if (isTrianglePushLocked(actor, actor.patrolDirection)) {
        return null;
    }

    return {
        id: `${actor.id}:enemy_patrol_walk`,
        source: 'npc_runtime',
        targetRef: 'patrol_post',
        actions: [{
            kind: 'walk_to_x',
            ref: actor.patrolDirection < 0 ? 'patrol_left_extent' : 'patrol_right_extent',
            targetX,
            moveSpeed: behavior.patrolSpeed,
            tolerancePx: NPC_GROUND_TOLERANCE_PX
        }]
    };
};

const updateEnemyActor = (
    actor: TestNpcActorRuntime,
    player: PlayerWorldActor
): ActorActionSequence | null => {
    const behavior = actor.enemyBehavior;
    if (!behavior) {
        setActorState(actor, 'patrol');
        return null;
    }

    const actorX = getActorX(actor);
    const playerDistance = playerDistanceTo(player, actorX, getActorY(actor));
    const playerWithinSense = playerDistance <= behavior.senseRadius;
    const playerWithinRelease = playerDistance <= behavior.chaseReleaseRadius;

    if (actor.state === 'patrol') {
        if (playerWithinSense) {
            setActorState(actor, 'alert');
            return {
                id: `${actor.id}:enemy_alert_face`,
                source: 'npc_runtime',
                targetRef: 'player',
                actions: [{
                    kind: 'face',
                    ref: 'player_x',
                    facing: player.arcadeBodyObject.x < actorX ? -1 : 1
                }]
            };
        }
        return updateEnemyPatrol(actor, behavior);
    }

    if (actor.state === 'alert') {
        if (!playerWithinSense) {
            setActorState(actor, 'return_to_post');
            return null;
        }
        if (actor.stateElapsedMs >= behavior.alertDurationMs) {
            setActorState(actor, 'chase');
        }
        return {
            id: `${actor.id}:enemy_alert_face`,
            source: 'npc_runtime',
            targetRef: 'player',
            actions: [{
                kind: 'face',
                ref: 'player_x',
                facing: player.arcadeBodyObject.x < actorX ? -1 : 1
            }]
        };
    }

    if (actor.state === 'chase') {
        if (!playerWithinRelease) {
            setActorState(actor, 'return_to_post');
            return null;
        }

        const deltaX = player.arcadeBodyObject.x - actorX;
        if (Math.abs(deltaX) <= behavior.postTolerance) {
            return null;
        }

        const chaseDirection: -1 | 1 = deltaX < 0 ? -1 : 1;
        if (isBlockedInDirection(actor, chaseDirection) || isTrianglePushLocked(actor, chaseDirection)) {
            return null;
        }

        return {
            id: `${actor.id}:enemy_chase_walk`,
            source: 'npc_runtime',
            targetRef: 'player',
            actions: [{
                kind: 'walk_to_x',
                ref: 'player_x',
                targetX: player.arcadeBodyObject.x,
                moveSpeed: behavior.chaseSpeed,
                tolerancePx: behavior.postTolerance
            }]
        };
    }

    if (playerWithinSense) {
        setActorState(actor, 'alert');
        return {
            id: `${actor.id}:enemy_alert_face`,
            source: 'npc_runtime',
            targetRef: 'player',
            actions: [{
                kind: 'face',
                ref: 'player_x',
                facing: player.arcadeBodyObject.x < actorX ? -1 : 1
            }]
        };
    }

    const deltaToPost = actor.postX - actorX;
    if (Math.abs(deltaToPost) <= behavior.postTolerance) {
        setActorState(actor, 'patrol');
        return null;
    }

    const returnDirection: -1 | 1 = deltaToPost < 0 ? -1 : 1;
    if (isBlockedInDirection(actor, returnDirection) || isTrianglePushLocked(actor, returnDirection)) {
        actor.patrolDirection = returnDirection === 1 ? -1 : 1;
        setActorState(actor, 'patrol');
        return null;
    }

    setActorState(actor, 'return_to_post');
    return {
        id: `${actor.id}:enemy_return_walk`,
        source: 'npc_runtime',
        targetRef: 'post',
        actions: [{
            kind: 'walk_to_x',
            ref: 'post_x',
            targetX: actor.postX,
            moveSpeed: behavior.returnSpeed,
            tolerancePx: behavior.postTolerance
        }]
    };
};

const refreshActorVisual = (actor: TestNpcActorRuntime): void => {
    actor.visual.setPosition(getActorX(actor), getActorY(actor));
    actor.visual.setFacing(actor.facing);
    actor.visual.setState(actor.state);
};

const destroyActor = (actor: TestNpcActorRuntime): void => {
    actor.actionRuntime.cancelActiveSequence();
    actor.unregisterWorldActor?.();
    actor.supportMatterBody.gameObject = undefined;
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
            const supportMatterBody = scene.matter.add.rectangle(
                resolved.instance.x,
                resolved.instance.y,
                resolved.profile.visual.bodyWidth,
                resolved.profile.visual.bodyHeight,
                { isStatic: true }
            );
            (supportMatterBody as MatterJS.BodyType & { pfCarryDeltaX?: number; pfCarryDeltaY?: number }).pfCarryDeltaX = 0;
            (supportMatterBody as MatterJS.BodyType & { pfCarryDeltaX?: number; pfCarryDeltaY?: number }).pfCarryDeltaY = 0;

            const initialState: TestNpcState = resolved.scriptedLoopRef
                ? 'scripted_loop'
                : (resolved.profile.archetype === 'enemy'
                    ? 'patrol'
                    : (resolved.passiveBehavior?.mode === 'idle_patrol' ? 'idle_patrol' : 'idle'));
            const exportsTriangleSupportSurface = shouldNpcExportTriangleSupportSurface(resolved.playerBodyContactMode);
            let actor!: TestNpcActorRuntime;
            actor = {
                id: resolved.instance.id,
                archetype: resolved.profile.archetype,
                playerBodyContactMode: resolved.playerBodyContactMode,
                bodyObject,
                body,
                supportMatterBody,
                exportsTriangleSupportSurface,
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
                presentationAnimation: null,
                presentationEmotion: null,
                lastTriggeredEventId: null,
                passiveBehavior: resolved.passiveBehavior,
                enemyBehavior: resolved.enemyBehavior,
                unregisterWorldActor: worldCollisionRuntime.registerActor({
                    actorId: resolved.instance.id,
                    kind: 'npc',
                    bodyObject,
                    body,
                    getPairContactMode: (otherActorKind) => {
                        if (otherActorKind === 'player') {
                            return resolved.playerBodyContactMode;
                        }

                        return 'block';
                    }
                }),
                trianglePushLockDirection: 0,
                profileScriptedLoopRef: resolved.profile.scriptedLoopRef ?? null,
                scriptedLoopInstanceOverride: resolved.instance.scriptedLoopRef,
                scriptedLoopRef: resolved.scriptedLoopRef,
                actionRuntime: null as unknown as ActorActionSequenceRuntime
            };
            actor.actionRuntime = createActorActionSequenceRuntime(createTestNpcActorActionAdapter({
                getX: () => getActorX(actor),
                stopHorizontalMovement: () => {
                    stopHorizontalMovement(actor);
                },
                tryApplyHorizontalMovement: (velocityX, deltaMs) => (
                    tryApplyActorHorizontalMovement(actor, player, velocityX, deltaMs)
                ),
                setFacing: (nextFacing) => {
                    actor.facing = nextFacing;
                },
                setPresentationAnimationStub: (animationId) => {
                    setPresentationAnimationStub(actor, animationId);
                },
                setPresentationEmotionStub: (emotionId) => {
                    setPresentationEmotionStub(actor, emotionId);
                },
                emitActorActionEvent: (eventId, payload) => {
                    actor.lastTriggeredEventId = eventId;
                    scene.events.emit('pf:npc_actor_action_event', {
                        actorId: actor.id,
                        eventId,
                        payload
                    });
                }
            }));
            syncNpcSupportSurfaceMode(actor);
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
                const desiredSequence = actor.scriptedLoopRef
                    ? updateScriptedLoopActor(actor)
                    : (actor.archetype === 'enemy'
                        ? updateEnemyActor(actor, player)
                        : updatePassiveActor(actor, safeDeltaMs));
                actor.actionRuntime.ensureSequence(desiredSequence);
                actor.actionRuntime.update(safeDeltaMs);

                refreshActorVisual(actor);
            });
        },
        syncTriangleSupportSurfaces: (): void => {
            actors.forEach((actor) => {
                syncNpcSupportSurfaceMode(actor);
                const previousX = actor.supportMatterBody.position.x;
                const previousY = actor.supportMatterBody.position.y;
                scene.matter.body.setPosition(actor.supportMatterBody, {
                    x: actor.bodyObject.x,
                    y: actor.bodyObject.y
                });
                const typedSupportBody = actor.supportMatterBody as MatterJS.BodyType & {
                    pfCarryDeltaX?: number;
                    pfCarryDeltaY?: number;
                };
                if (actor.exportsTriangleSupportSurface) {
                    typedSupportBody.pfCarryDeltaX = actor.supportMatterBody.position.x - previousX;
                    typedSupportBody.pfCarryDeltaY = actor.supportMatterBody.position.y - previousY;
                } else {
                    typedSupportBody.pfCarryDeltaX = 0;
                    typedSupportBody.pfCarryDeltaY = 0;
                }
            });
        },
        getDebugEntries: (): readonly TestNpcDebugEntry[] => {
            return actors.map((actor) => {
                const contactSnapshot = worldCollisionRuntime.getContactSnapshot(actor.id);
                const actionSnapshot: Readonly<ActorActionExecutionSnapshot> = actor.actionRuntime.getSnapshot();
                return {
                    id: actor.id,
                    archetype: actor.archetype,
                    state: actor.state,
                    playerBodyContactMode: actor.playerBodyContactMode,
                    exportsTriangleSupportSurface: actor.exportsTriangleSupportSurface,
                    locomotion: contactSnapshot?.locomotion ?? (isActorGrounded(actor) ? 'grounded' : 'airborne'),
                    blockedLeft: contactSnapshot?.blockedLeft ?? actor.body.blocked.left,
                    blockedRight: contactSnapshot?.blockedRight ?? actor.body.blocked.right,
                    touchingPlayer: contactSnapshot?.touchingPlayer ?? false,
                    touchingOtherActor: contactSnapshot?.touchingOtherActor ?? false,
                    profileScriptedLoopRef: actor.profileScriptedLoopRef,
                    scriptedLoopInstanceOverride: actor.scriptedLoopInstanceOverride,
                    scriptedLoopRef: actor.scriptedLoopRef,
                    scriptedLoopSource: actor.scriptedLoopInstanceOverride === null
                        ? 'instance_none'
                        : (typeof actor.scriptedLoopInstanceOverride === 'string'
                            ? 'instance_override'
                            : 'profile_default'),
                    activeScriptedSequenceRef: actionSnapshot.sequenceSource === NPC_SCRIPTED_SEQUENCE_SOURCE
                        ? actor.scriptedLoopRef
                        : null,
                    actionSequenceId: actionSnapshot.sequenceId,
                    actionSequenceSource: actionSnapshot.sequenceSource,
                    actionSequenceTargetRef: actionSnapshot.sequenceTargetRef,
                    actionSequenceStatus: actionSnapshot.sequenceStatus,
                    activeActionIndex: actionSnapshot.activeActionIndex,
                    activeActionKind: actionSnapshot.activeAction?.kind ?? null,
                    activeActionStatus: actionSnapshot.activeActionStatus,
                    actionTargetRef: actionSnapshot.activeActionRef,
                    actionTargetDescription: describeActorActionTarget(actionSnapshot.activeAction),
                    actionFailureReason: actionSnapshot.failureReason,
                    presentationAnimation: actor.presentationAnimation,
                    presentationEmotion: actor.presentationEmotion
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
                scene.matter.world.remove(actor.supportMatterBody);
                destroyActor(actor);
            });
        }
    };
};
