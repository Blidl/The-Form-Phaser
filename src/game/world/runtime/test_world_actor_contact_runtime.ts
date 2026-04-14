import { GameObjects, Physics, Scene, Scenes } from 'phaser';

export const TEST_WORLD_PLAYER_ACTOR_ID = 'player';

export type TestWorldActorKind = 'player' | 'npc';

export interface TestWorldRegisteredActor {
    actorId: string;
    kind: TestWorldActorKind;
    bodyObject: GameObjects.GameObject;
    body: Physics.Arcade.Body;
    worldCollisionEnabled?: boolean;
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
    touchingPlayer: boolean;
    touchingOtherActor: boolean;
}

interface OwnedColliderEntry {
    actorId: string;
    collider: Physics.Arcade.Collider;
}

const buildContactSnapshot = (actor: RegisteredActorEntry): TestWorldActorContactSnapshot => {
    const grounded = actor.body.blocked.down || actor.body.touching.down || actor.body.onFloor();
    return {
        grounded,
        locomotion: grounded ? 'grounded' : 'airborne',
        blockedLeft: actor.body.blocked.left,
        blockedRight: actor.body.blocked.right,
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
    const actorPairColliders: Physics.Arcade.Collider[] = [];

    const destroyWorldColliders = (): void => {
        worldColliders.splice(0, worldColliders.length).forEach(({ collider }) => collider.destroy());
    };

    const destroyActorPairColliders = (): void => {
        actorPairColliders.splice(0, actorPairColliders.length).forEach((collider) => collider.destroy());
    };

    const clearPairContacts = (): void => {
        actors.forEach((actor) => {
            actor.touchingPlayer = false;
            actor.touchingOtherActor = false;
        });
    };

    const refreshOwnedColliderStates = (): void => {
        worldColliders.forEach(({ actorId, collider }) => {
            collider.active = actors.get(actorId)?.worldCollisionEnabled ?? false;
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
                actorPairColliders.push(scene.physics.add.collider(
                    firstActor.bodyObject,
                    secondActor.bodyObject,
                    () => {
                        markActorPairContact(firstActor.actorId, secondActor.actorId);
                    }
                ));
            }
        }

        refreshOwnedColliderStates();
    };

    scene.events.on(Scenes.Events.PRE_UPDATE, clearPairContacts);

    return {
        registerActor: (actor) => {
            actors.set(actor.actorId, {
                actorId: actor.actorId,
                kind: actor.kind,
                bodyObject: actor.bodyObject,
                body: actor.body,
                worldCollisionEnabled: actor.worldCollisionEnabled ?? true,
                touchingPlayer: false,
                touchingOtherActor: false
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
            scene.events.off(Scenes.Events.PRE_UPDATE, clearPairContacts);
            destroyWorldColliders();
            destroyActorPairColliders();
            actors.clear();
        }
    };
};
