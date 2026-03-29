import { PLAYER_FORM_IDS, type PlayerFormId } from '../../shared/types/formTypes';

export type PlayerFormDisplayShapeKind = 'circle' | 'triangle' | 'square';

export interface PlayerFormProfile {
    readonly bodyWidth: number;
    readonly bodyHeight: number;
    readonly displayColor: number;
    readonly displayShapeKind?: PlayerFormDisplayShapeKind;
}

export const FORM_PROFILE_CONFIG: Readonly<Record<PlayerFormId, PlayerFormProfile>> = {
    [PLAYER_FORM_IDS.ball]: {
        bodyWidth: 32,
        bodyHeight: 32,
        displayColor: 0x5eead4,
        displayShapeKind: 'circle'
    },
    [PLAYER_FORM_IDS.triangle]: {
        bodyWidth: 30,
        bodyHeight: 34,
        displayColor: 0xfde047,
        displayShapeKind: 'triangle'
    },
    [PLAYER_FORM_IDS.square]: {
        bodyWidth: 36,
        bodyHeight: 36,
        displayColor: 0x86efac,
        displayShapeKind: 'square'
    }
};

export function getFormProfile(formId: PlayerFormId): PlayerFormProfile {
    return FORM_PROFILE_CONFIG[formId];
}
