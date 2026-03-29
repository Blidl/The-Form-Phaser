import { PLAYER_FORM_IDS, type PlayerFormId } from '../../shared/types/formTypes';

export interface PlayerConfig {
    readonly spawnFormId: PlayerFormId;
    readonly placeholderBodyWidth: number;
    readonly placeholderBodyHeight: number;
}

export const PLAYER_CONFIG: PlayerConfig = {
    spawnFormId: PLAYER_FORM_IDS.ball,
    placeholderBodyWidth: 32,
    placeholderBodyHeight: 32
};
