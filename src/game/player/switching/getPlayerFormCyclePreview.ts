import type { PlayerFormId } from '../../../shared/types/formTypes';
import { getNextFormId, getPreviousFormId } from './formCycle';

export interface PlayerFormCyclePreview {
    readonly current: PlayerFormId;
    readonly previous: PlayerFormId;
    readonly next: PlayerFormId;
}

export function getPlayerFormCyclePreview(currentFormId: PlayerFormId): PlayerFormCyclePreview {
    return {
        current: currentFormId,
        previous: getPreviousFormId(currentFormId),
        next: getNextFormId(currentFormId)
    };
}
