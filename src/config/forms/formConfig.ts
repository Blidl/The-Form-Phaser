import { PLAYER_FORM_ID_LIST, PLAYER_FORM_IDS, type PlayerFormId } from '../../shared/types/formTypes';

export const FORM_IDS = PLAYER_FORM_IDS;

export interface FormConfig {
    readonly ids: typeof FORM_IDS;
    readonly order: readonly PlayerFormId[];
    readonly cycle: readonly PlayerFormId[];
}

export const FORM_CONFIG: FormConfig = {
    ids: FORM_IDS,
    order: PLAYER_FORM_ID_LIST,
    cycle: PLAYER_FORM_ID_LIST
};
