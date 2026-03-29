export const SCENE_KEYS = {
    boot: 'sc_bootstrap',
    test: 'sc_test'
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
