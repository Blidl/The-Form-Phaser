import type { GameObjects, Scene } from 'phaser';
import { createWindZone, type WindZoneObject } from '../wind_zone';

export interface TestWorldWindRuntime {
    resolveWindInfluenceX: (playerObject: GameObjects.GameObject) => number;
}

export const createTestWorldWindRuntime = (scene: Scene): TestWorldWindRuntime => {
    const windZones: WindZoneObject[] = [
        createWindZone(scene, {
            x: 1080,
            y: 640,
            width: 260,
            height: 170,
            directionX: 1,
            force: 160
        })
    ];

    return {
        resolveWindInfluenceX: (playerObject: GameObjects.GameObject): number => {
            let horizontalInfluenceX = 0;

            windZones.forEach((zone) => {
                if (scene.physics.overlap(playerObject, zone.trigger)) {
                    horizontalInfluenceX += zone.force * zone.directionX;
                }
            });

            return horizontalInfluenceX;
        }
    };
};
