import type { Scene } from 'phaser';
import { getInitialCampaignLevelId } from '../game/world/runtime/test_campaign_registry';
import { type TestSceneStartData } from './TestScene';

export const TEST_SCENE_KEY = 'sc_test';
export const MAIN_MENU_SCENE_KEY = 'sc_main_menu';
export const PAUSE_MENU_SCENE_KEY = 'sc_pause_menu';
export const END_SCREEN_SCENE_KEY = 'sc_end_screen';

export interface BootRoute {
    levelStart: TestSceneStartData | null;
}

export const resolveBootRoute = (data: TestSceneStartData = {}): BootRoute => {
    if (data.levelId) {
        return {
            levelStart: {
                levelId: data.levelId,
                editorOpen: data.editorOpen
            }
        };
    }

    if (typeof window === 'undefined') {
        return { levelStart: null };
    }

    const search = new URLSearchParams(window.location.search);
    const levelId = search.get('levelId')?.trim() ?? '';
    if (!levelId) {
        return { levelStart: null };
    }

    return {
        levelStart: {
            levelId,
            editorOpen: parseBooleanFlag(search.get('editorOpen'))
        }
    };
};

export const startDemoFromMainMenu = (scene: Scene): void => {
    scene.scene.start(TEST_SCENE_KEY, {
        levelId: getInitialCampaignLevelId()
    });
};

export const startLevelScene = (
    scene: Scene,
    data: TestSceneStartData
): void => {
    scene.scene.start(TEST_SCENE_KEY, data);
};

export const openMainMenu = (scene: Scene): void => {
    scene.scene.start(MAIN_MENU_SCENE_KEY);
};

export const openEndScreen = (scene: Scene): void => {
    scene.scene.start(END_SCREEN_SCENE_KEY);
};

export const openPauseMenu = (scene: Scene, data: PauseMenuSceneStartData): void => {
    scene.scene.launch(PAUSE_MENU_SCENE_KEY, data);
    scene.scene.pause(TEST_SCENE_KEY);
};

export interface PauseMenuSceneStartData {
    levelId: string;
}

const parseBooleanFlag = (value: string | null): boolean => {
    if (!value) {
        return false;
    }

    return value === '1' || value.toLowerCase() === 'true';
};
