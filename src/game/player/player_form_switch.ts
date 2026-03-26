import type { PlayerFormId } from './player_types';

const FORM_CYCLE: PlayerFormId[] = ['ball', 'triangle', 'square'];

export const getNextPlayerForm = (form: PlayerFormId): PlayerFormId => {
    const index = FORM_CYCLE.indexOf(form);
    if (index < 0) {
        return FORM_CYCLE[0];
    }

    return FORM_CYCLE[(index + 1) % FORM_CYCLE.length];
};

export const getPrevPlayerForm = (form: PlayerFormId): PlayerFormId => {
    const index = FORM_CYCLE.indexOf(form);
    if (index < 0) {
        return FORM_CYCLE[0];
    }

    return FORM_CYCLE[(index - 1 + FORM_CYCLE.length) % FORM_CYCLE.length];
};
