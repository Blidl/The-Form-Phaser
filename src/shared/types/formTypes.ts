export const PLAYER_FORM_IDS = {
    ball: 'ball',
    triangle: 'triangle',
    square: 'square'
} as const;

export type PlayerFormId = (typeof PLAYER_FORM_IDS)[keyof typeof PLAYER_FORM_IDS];

export const PLAYER_FORM_ID_LIST: readonly PlayerFormId[] = [
    PLAYER_FORM_IDS.ball,
    PLAYER_FORM_IDS.triangle,
    PLAYER_FORM_IDS.square
];
