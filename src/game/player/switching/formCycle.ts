import { PLAYER_FORM_IDS, type PlayerFormId } from '../../../shared/types/formTypes';

const FORM_CYCLE: readonly PlayerFormId[] = [
    PLAYER_FORM_IDS.ball,
    PLAYER_FORM_IDS.triangle,
    PLAYER_FORM_IDS.square
];

export function getNextFormId(currentFormId: PlayerFormId): PlayerFormId {
    const currentIndex = FORM_CYCLE.indexOf(currentFormId);
    if (currentIndex < 0) {
        return FORM_CYCLE[0];
    }

    return FORM_CYCLE[(currentIndex + 1) % FORM_CYCLE.length];
}

export function getPreviousFormId(currentFormId: PlayerFormId): PlayerFormId {
    const currentIndex = FORM_CYCLE.indexOf(currentFormId);
    if (currentIndex < 0) {
        return FORM_CYCLE[0];
    }

    return FORM_CYCLE[(currentIndex - 1 + FORM_CYCLE.length) % FORM_CYCLE.length];
}
