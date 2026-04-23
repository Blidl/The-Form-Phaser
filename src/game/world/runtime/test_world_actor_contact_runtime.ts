import { GameObjects, Physics, Scene, Scenes } from 'phaser';
import {
    createArcadeBodyContactShapeSnapshot,
    doesActorContactShapeOverlap,
    type TestWorldActorContactShapeSnapshot,
    type TestWorldActorWorldContactSnapshot
} from './test_world_actor_contact_shapes';

export const TEST_WORLD_PLAYER_ACTOR_ID = 'player';

export type TestWorldActorKind = 'player' | 'npc';
export type TestWorldActorPairContactMode = 'block' | 'overlap' | 'ignore';

export interface TestWorldRegisteredActor {
    actorId: string;
    kind: TestWorldActorKind;
    bodyObject: GameObjects.GameObject;
    body: Physics.Arcade.Body;
    worldCollisionEnabled?: boolean;
    getContactShapeSnapshot?: () => TestWorldActorContactShapeSnapshot;
    getWorldContactSnapshot?: () => TestWorldActorWorldContactSnapshot;
    applyContactPush?: (deltaX: number, deltaY: number) => { appliedDeltaX: number; appliedDeltaY: number };
    getPairContactMode?: (
        otherActorKind: TestWorldActorKind,
        otherActorId: string
    ) => TestWorldActorPairContactMode;
}

export interface TestWorldActorContactSnapshot {
    grounded: boolean;
    locomotion: 'grounded' | 'airborne';
    blockedLeft: boolean;
    blockedRight: boolean;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
}

export interface TestWorldActorContactRuntime {
    registerActor: (actor: TestWorldRegisteredActor) => () => void;
    getActor: (actorId: string) => Readonly<TestWorldRegisteredActor> | null;
    getActors: () => readonly Readonly<TestWorldRegisteredActor>[];
    getContactSnapshot: (actorId: string) => TestWorldActorContactSnapshot | null;
    rebuildColliders: () => void;
    setActorWorldCollisionEnabled: (actorId: string, enabled: boolean) => void;
    destroy: () => void;
}

interface CreateTestWorldActorContactRuntimeParams {
    scene: Scene;
    getSolidSurfaces: () => readonly GameObjects.GameObject[];
    getMovingPlatformBodies: () => readonly GameObjects.GameObject[];
    getTriggerPlatformBodies: () => readonly GameObjects.GameObject[];
    getBreakWallBodies: () => readonly GameObjects.GameObject[];
}

interface RegisteredActorEntry {
    actorId: string;
    kind: TestWorldActorKind;
    bodyObject: GameObjects.GameObject;
    body: Physics.Arcade.Body;
    worldCollisionEnabled: boolean;
    getContactShapeSnapshot: () => TestWorldActorContactShapeSnapshot;
    getWorldContactSnapshot: (() => TestWorldActorWorldContactSnapshot) | null;
    applyContactPush: ((deltaX: number, deltaY: number) => { appliedDeltaX: number; appliedDeltaY: number }) | null;
    getPairContactMode: (
        otherActorKind: TestWorldActorKind,
        otherActorId: string
    ) => TestWorldActorPairContactMode;
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
    frameStartX: number;
    frameStartY: number;
}

interface OwnedColliderEntry {
    actorId: string;
    collider: Physics.Arcade.Collider;
}

interface ActorPairColliderEntry {
    firstActorId: string;
    secondActorId: string;
    pairContactMode: TestWorldActorPairContactMode;
    collider: Physics.Arcade.Collider;
}

const PLAYER_NPC_CARRY_TOP_TOLERANCE_PX = 8;
const PLAYER_NPC_CARRY_MIN_OVERLAP_X_PX = 8;
const PLAYER_NPC_CARRY_SIDE_MARGIN_PX = 4;

const isPlayerNpcPair = (
    firstActor: RegisteredActorEntry,
    secondActor: RegisteredActorEntry
): boolean => (
    (firstActor.kind === 'player' && secondActor.kind === 'npc')
    || (firstActor.kind === 'npc' && secondActor.kind === 'player')
);

const tryApplyPlayerNpcTopCarry = (
    firstActor: RegisteredActorEntry,
    secondActor: RegisteredActorEntry
): boolean => {
    if (!isPlayerNpcPair(firstActor, secondActor)) {
        return false;
    }

    const playerActor = firstActor.kind === 'player' ? firstActor : secondActor;
    const npcActor = firstActor.kind === 'npc' ? firstActor : secondActor;
    if (!playerActor.applyContactPush) {
        return false;
    }

    const npcDeltaX = npcActor.bodyObject.x - npcActor.frameStartX;
    const npcDeltaY = npcActor.bodyObject.y - npcActor.frameStartY;
    if (Math.abs(npcDeltaX) <= 0.0001 && Math.abs(npcDeltaY) <= 0.0001) {
        return false;
    }

    const playerShape = playerActor.getContactShapeSnapshot();
    const npcShape = npcActor.getContactShapeSnapshot();
    if (playerShape.kind !== 'arcade_body' || npcShape.kind !== 'arcade_body') {
        return false;
    }

    const playerBounds = playerShape.bounds;
    const npcBounds = npcShape.bounds;
    const overlapX = Math.min(playerBounds.right, npcBounds.right) - Math.max(playerBounds.left, npcBounds.left);
    if (overlapX < PLAYER_NPC_CARRY_MIN_OVERLAP_X_PX) {
        return false;
    }

    const playerCenterWithinNpcTop = playerBounds.centerX >= (npcBounds.left - PLAYER_NPC_CARRY_SIDE_MARGIN_PX)
        && playerBounds.centerX <= (npcBounds.right + PLAYER_NPC_CARRY_SIDE_MARGIN_PX);
    if (!playerCenterWithinNpcTop) {
        return false;
    }

    const topGap = npcBounds.top - playerBounds.bottom;
    const playerIsOnTop = playerBounds.top < npcBounds.top
        && topGap >= -PLAYER_NPC_CARRY_TOP_TOLERANCE_PX
        && topGap <= PLAYER_NPC_CARRY_TOP_TOLERANCE_PX
        && playerActor.body.velocity.y >= -0.001;
    if (!playerIsOnTop) {
        return false;
    }

    playerActor.applyContactPush(npcDeltaX, topGap + npcDeltaY);
    if (playerActor.body.velocity.y > 0) {
        playerActor.body.setVelocityY(0);
    }
    return true;
};

const resolveEffectivePairContactMode = (
    firstActor: RegisteredActorEntry,
    secondActor: RegisteredActorEntry
): TestWorldActorPairContactMode => {
    const firstMode = firstActor.getPairContactMode(secondActor.kind, secondActor.actorId);
    const secondMode = secondActor.getPairContactMode(firstActor.kind, firstActor.actorId);
    if (firstMode === 'ignore' || secondMode === 'ignore') {
        return 'ignore';
    }
    if (firstMode === 'overlap' || secondMode === 'overlap') {
        return 'overlap';
    }
    return 'block';
};

const buildContactSnapshot = (actor: RegisteredActorEntry): TestWorldActorContactSnapshot => {
    const worldContactSnapshot = actor.getWorldContactSnapshot?.() ?? {
        mode: 'arcade',
        grounded: actor.body.blocked.down || actor.body.touching.down || actor.body.onFloor(),
        blockedLeft: actor.body.blocked.left,
        blockedRight: actor.body.blocked.right
    };

    return {
        grounded: worldContactSnapshot.grounded,
        locomotion: worldContactSnapshot.grounded ? 'grounded' : 'airborne',
        blockedLeft: worldContactSnapshot.blockedLeft,
        blockedRight: worldContactSnapshot.blockedRight,
        touchingPlayer: actor.touchingPlayer,
        touchingOtherActor: actor.touchingOtherActor
    };
};

export const createTestWorldActorContactRuntime = (
    params: CreateTestWorldActorContactRuntimeParams
): TestWorldActorContactRuntime => {
    const { scene, getSolidSurfaces, getMovingPlatformBodies, getTriggerPlatformBodies, getBreakWallBodies } = params;
    const actors = new Map<string, RegisteredActorEntry>();
    const worldColliders: OwnedColliderEntry[] = [];
    const actorPairColliders: ActorPairColliderEntry[] = [];

    const destroyWorldColliders = (): void => {
        worldColliders.splice(0, worldColliders.length).forEach(({ collider }) => collider.destroy());
    };

    const destroyActorPairColliders = (): void => {
        actorPairColliders.splice(0, actorPairColliders.length).forEach(({ collider }) => collider.destroy());
    };

    const clearPairContacts = (): void => {
        actors.forEach((actor) => {
            actor.touchingPlayer = false;
            actor.touchingOtherActor = false;
            actor.frameStartX = actor.bodyObject.x;
            actor.frameStartY = actor.bodyObject.y;
        });
    };

    const refreshOwnedColliderStates = (): void => {
        worldColliders.forEach(({ actorId, collider }) => {
            collider.active = actors.get(actorId)?.worldCollisionEnabled ?? false;
        });
    };

    const refreshActorPairColliderStates = (): void => {
        actorPairColliders.forEach((entry) => {
            const firstActor = actors.get(entry.firstActorId);
            const secondActor = actors.get(entry.secondActorId);
            if (!firstActor || !secondActor) {
                entry.collider.active = false;
                return;
            }
            if (entry.pairContactMode === 'ignore') {
                entry.collider.active = false;
                return;
            }

            const firstShape = firstActor.getContactShapeSnapshot();
            const secondShape = secondActor.getContactShapeSnapshot();
            entry.collider.active = firstShape.kind === 'arcade_body' && secondShape.kind === 'arcade_body';
        });
    };

    const markActorPairContact = (firstActorId: string, secondActorId: string): void => {
        const firstActor = actors.get(firstActorId);
        const secondActor = actors.get(secondActorId);
        if (!firstActor || !secondActor) {
            return;
        }

        if (secondActor.kind === 'player') {
            firstActor.touchingPlayer = true;
        } else {
            firstActor.touchingOtherActor = true;
        }

        if (firstActor.kind === 'player') {
            secondActor.touchingPlayer = true;
        } else {
            secondActor.touchingOtherActor = true;
        }
    };

    const detectSpecialPairContacts = (): void => {
        actorPairColliders.forEach((entry) => {
            if (entry.collider.active) {
                return;
            }

            const firstActor = actors.get(entry.firstActorId);
            const secondActor = actors.get(entry.secondActorId);
            if (!firstActor || !secondActor) {
                return;
            }
            if (entry.pairContactMode === 'ignore') {
                return;
            }

            if (tryApplyPlayerNpcTopCarry(firstActor, secondActor)) {
                markActorPairContact(firstActor.actorId, secondActor.actorId);
            }

            const firstShape = firstActor.getContactShapeSnapshot();
            const secondShape = secondActor.getContactShapeSnapshot();
            if (firstShape.kind === 'arcade_body' && secondShape.kind === 'arcade_body') {
                return;
            }

            // TEMPORARY: polygon-aware actor contacts are a detection-only bridge for
            // Triangle player vs Arcade actor bounds. Physical pair resolution stays on
            // the existing Arcade path until a broader actor-contact model exists.
            if (doesActorContactShapeOverlap(firstShape, secondShape)) {
                markActorPairContact(firstActor.actorId, secondActor.actorId);
            }
        });
    };

    const addOwnedWorldCollider = (actor: RegisteredActorEntry, target: GameObjects.GameObject): void => {
        const collider = scene.physics.add.collider(actor.bodyObject, target);
        worldColliders.push({
            actorId: actor.actorId,
            collider
        });
    };

    const rebuildColliders = (): void => {
        destroyWorldColliders();
        destroyActorPairColliders();

        const actorList = [...actors.values()];
        actorList.forEach((actor) => {
            getSolidSurfaces().forEach((surface) => {
                addOwnedWorldCollider(actor, surface);
            });
            getMovingPlatformBodies().forEach((platformBody) => {
                addOwnedWorldCollider(actor, platformBody);
            });
            getTriggerPlatformBodies().forEach((platformBody) => {
                addOwnedWorldCollider(actor, platformBody);
            });
            getBreakWallBodies().forEach((wallBody) => {
                addOwnedWorldCollider(actor, wallBody);
            });
        });

        for (let index = 0; index < actorList.length; index += 1) {
            const firstActor = actorList[index];
            for (let nextIndex = index + 1; nextIndex < actorList.length; nextIndex += 1) {
                const secondActor = actorList[nextIndex];
                const pairContactMode = resolveEffectivePairContactMode(firstActor, secondActor);
                if (pairContactMode === 'ignore') {
                    continue;
                }

                actorPairColliders.push({
                    firstActorId: firstActor.actorId,
                    secondActorId: secondActor.actorId,
                    pairContactMode,
                    collider: pairContactMode === 'overlap'
                        ? scene.physics.add.overlap(
                            firstActor.bodyObject,
                            secondActor.bodyObject,
                            () => {
                                markActorPairContact(firstActor.actorId, secondActor.actorId);
                            }
                        )
                        : scene.physics.add.collider(
                            firstActor.bodyObject,
                            secondActor.bodyObject,
                            () => {
                                markActorPairContact(firstActor.actorId, secondActor.actorId);
                            }
                        )
                });
            }
        }

        refreshOwnedColliderStates();
        refreshActorPairColliderStates();
    };

    const handlePreUpdate = (): void => {
        clearPairContacts();
        refreshActorPairColliderStates();
    };
    scene.events.on(Scenes.Events.PRE_UPDATE, handlePreUpdate);
    scene.events.on(Scenes.Events.POST_UPDATE, detectSpecialPairContacts);

    return {
        registerActor: (actor) => {
            actors.set(actor.actorId, {
                actorId: actor.actorId,
                kind: actor.kind,
                bodyObject: actor.bodyObject,
                body: actor.body,
                worldCollisionEnabled: actor.worldCollisionEnabled ?? true,
                getContactShapeSnapshot: actor.getContactShapeSnapshot ?? (() => createArcadeBodyContactShapeSnapshot(actor.bodyObject, actor.body)),
                getWorldContactSnapshot: actor.getWorldContactSnapshot ?? null,
                applyContactPush: actor.applyContactPush ?? null,
                getPairContactMode: actor.getPairContactMode ?? (() => 'block'),
                touchingPlayer: false,
                touchingOtherActor: false,
                frameStartX: actor.bodyObject.x,
                frameStartY: actor.bodyObject.y
            });
            rebuildColliders();

            return () => {
                actors.delete(actor.actorId);
                rebuildColliders();
            };
        },
        getActor: (actorId) => {
            const actor = actors.get(actorId);
            if (!actor) {
                return null;
            }

            return {
                actorId: actor.actorId,
                kind: actor.kind,
                bodyObject: actor.bodyObject,
                body: actor.body,
                worldCollisionEnabled: actor.worldCollisionEnabled
            };
        },
        getActors: () => {
            return [...actors.values()].map((actor) => ({
                actorId: actor.actorId,
                kind: actor.kind,
                bodyObject: actor.bodyObject,
                body: actor.body,
                worldCollisionEnabled: actor.worldCollisionEnabled
            }));
        },
        getContactSnapshot: (actorId) => {
            const actor = actors.get(actorId);
            return actor ? buildContactSnapshot(actor) : null;
        },
        rebuildColliders,
        setActorWorldCollisionEnabled: (actorId, enabled) => {
            const actor = actors.get(actorId);
            if (!actor) {
                return;
            }

            actor.worldCollisionEnabled = enabled;
            refreshOwnedColliderStates();
        },
        destroy: () => {
            scene.events.off(Scenes.Events.PRE_UPDATE, handlePreUpdate);
            scene.events.off(Scenes.Events.POST_UPDATE, detectSpecialPairContacts);
            destroyWorldColliders();
            destroyActorPairColliders();
            actors.clear();
        }
    };
};
