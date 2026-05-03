import type { ProjectData } from './ProjectData';
import { createDefaultLevelData } from './LevelData';
import { createNextLevelId } from './idFactory';

export const createDefaultProjectData = (): ProjectData => {
    const firstLevelId = createNextLevelId([]);
    const firstLevel = createDefaultLevelData({
        id: firstLevelId,
        name: 'Level 1'
    });

    return {
        schemaVersion: 1,
        gameId: 'the-form-phaser',
        activeLevelId: firstLevelId,
        levels: [firstLevel],
        levelSequence: {
            startLevelId: firstLevelId,
            transitions: []
        },
        grid: {
            enabled: true,
            snapEnabled: true,
            size: 32
        }
    };
};
