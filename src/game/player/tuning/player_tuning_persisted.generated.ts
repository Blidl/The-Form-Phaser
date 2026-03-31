import type { PlayerTuningSnapshot } from './player_tuning_types';
import { createPlayerTuningDefaultsSnapshot } from './player_tuning_defaults';

export const PLAYER_TUNING_PERSISTED_SNAPSHOT: PlayerTuningSnapshot = createPlayerTuningDefaultsSnapshot();
