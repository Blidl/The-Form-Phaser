import {
    applyPlayerTuningRawSnapshot,
    capturePlayerTuningRawSnapshot
} from '../player_constants';
import { createPlayerTuningDefaultsSnapshot } from './player_tuning_defaults';
import { PLAYER_TUNING_PERSISTED_SNAPSHOT } from './player_tuning_persisted.generated';
import {
    clonePlayerTuningSnapshot,
    type PlayerTuningRawSnapshot,
    type PlayerTuningSnapshot
} from './player_tuning_types';

export interface PlayerTuningRuntimeState {
    persistedSnapshot: PlayerTuningSnapshot;
    draftSnapshot: PlayerTuningSnapshot;
    saveStatus: string;
    isSaving: boolean;
}

export interface PlayerTuningRuntime {
    getState: () => PlayerTuningRuntimeState;
    subscribe: (listener: () => void) => () => void;
    updateDraft: (mutator: (draft: PlayerTuningSnapshot) => void) => void;
    revertUnsaved: () => void;
    resetToDefaults: () => void;
    saveToProject: () => Promise<void>;
    isDirty: () => boolean;
}

export const applyPlayerTuningSnapshot = (snapshot: PlayerTuningSnapshot): void => {
    applyPlayerTuningRawSnapshot(normalizePlayerTuningSnapshot(snapshot).raw);
};

export const bootstrapPersistedPlayerTuning = (): void => {
    applyPlayerTuningSnapshot(PLAYER_TUNING_PERSISTED_SNAPSHOT);
};

export const captureLivePlayerTuningSnapshot = (): PlayerTuningSnapshot => {
    return normalizePlayerTuningSnapshot({
        version: 1,
        raw: capturePlayerTuningRawSnapshot()
    });
};

export const createPlayerTuningRuntime = (): PlayerTuningRuntime => {
    let persistedSnapshot = normalizePlayerTuningSnapshot(clonePlayerTuningSnapshot(PLAYER_TUNING_PERSISTED_SNAPSHOT));
    let draftSnapshot = clonePlayerTuningSnapshot(persistedSnapshot);
    let saveStatus = 'persisted snapshot loaded';
    let isSaving = false;
    const listeners = new Set<() => void>();

    applyPlayerTuningSnapshot(draftSnapshot);

    const emit = (): void => {
        listeners.forEach((listener) => listener());
    };

    return {
        getState: () => ({
            persistedSnapshot,
            draftSnapshot,
            saveStatus,
            isSaving
        }),
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        updateDraft: (mutator) => {
            const nextDraft = clonePlayerTuningSnapshot(draftSnapshot);
            mutator(nextDraft);
            draftSnapshot = normalizePlayerTuningSnapshot(nextDraft);
            applyPlayerTuningSnapshot(draftSnapshot);
            saveStatus = 'live draft applied';
            emit();
        },
        revertUnsaved: () => {
            draftSnapshot = clonePlayerTuningSnapshot(persistedSnapshot);
            applyPlayerTuningSnapshot(draftSnapshot);
            saveStatus = 'reverted to persisted snapshot';
            emit();
        },
        resetToDefaults: () => {
            draftSnapshot = normalizePlayerTuningSnapshot(createPlayerTuningDefaultsSnapshot());
            applyPlayerTuningSnapshot(draftSnapshot);
            saveStatus = 'reset to canonical defaults';
            emit();
        },
        saveToProject: async () => {
            isSaving = true;
            saveStatus = 'saving to project...';
            emit();

            try {
                const response = await fetch('/__dev/save-player-tuning', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(draftSnapshot)
                });
                const payload = await response.json().catch(() => ({ message: response.ok ? 'saved to project' : 'save failed' }));
                if (!response.ok) {
                    throw new Error(typeof payload.message === 'string' ? payload.message : 'save failed');
                }

                persistedSnapshot = clonePlayerTuningSnapshot(draftSnapshot);
                saveStatus = typeof payload.message === 'string' ? payload.message : 'saved to project';
            } catch (error) {
                saveStatus = error instanceof Error ? error.message : 'save failed';
            } finally {
                isSaving = false;
                emit();
            }
        },
        isDirty: () => JSON.stringify(draftSnapshot.raw) !== JSON.stringify(persistedSnapshot.raw)
    };
};

export const getPlayerTuningRawValue = (snapshot: PlayerTuningSnapshot, path: string): number => {
    const segments = path.split('.');
    let cursor: unknown = snapshot.raw;
    for (const segment of segments) {
        if (typeof cursor !== 'object' || cursor === null || !(segment in cursor)) {
            return 0;
        }
        cursor = (cursor as Record<string, unknown>)[segment];
    }
    return typeof cursor === 'number' ? cursor : 0;
};

export const setPlayerTuningRawValue = (snapshot: PlayerTuningSnapshot, path: string, value: number): void => {
    const segments = path.split('.');
    const lastSegment = segments.pop();
    if (!lastSegment) {
        return;
    }

    let cursor: Record<string, unknown> = snapshot.raw as unknown as Record<string, unknown>;
    for (const segment of segments) {
        const next = cursor[segment];
        if (typeof next !== 'object' || next === null) {
            return;
        }
        cursor = next as Record<string, unknown>;
    }

    cursor[lastSegment] = value;
};

export const clampPlayerTuningNumber = (value: number, min?: number, max?: number): number => {
    let nextValue = Number.isFinite(value) ? value : 0;
    if (typeof min === 'number') {
        nextValue = Math.max(min, nextValue);
    }
    if (typeof max === 'number') {
        nextValue = Math.min(max, nextValue);
    }
    return nextValue;
};

export const createPlayerTuningSnapshotFromRaw = (raw: PlayerTuningRawSnapshot): PlayerTuningSnapshot => {
    return normalizePlayerTuningSnapshot({
        version: 1,
        raw
    });
};

export const normalizePlayerTuningSnapshot = (snapshot: PlayerTuningSnapshot): PlayerTuningSnapshot => {
    const defaults = createPlayerTuningDefaultsSnapshot();
    const source = snapshot.raw as unknown as Partial<PlayerTuningRawSnapshot>;

    return {
        version: 1,
        raw: {
            common: {
                ...defaults.raw.common,
                ...(source.common ?? {})
            },
            ball: {
                movement: {
                    ...defaults.raw.ball.movement,
                    ...(source.ball?.movement ?? {})
                },
                jump: {
                    ...defaults.raw.ball.jump,
                    ...(source.ball?.jump ?? {})
                },
                animation: {
                    ...defaults.raw.ball.animation,
                    ...(source.ball?.animation ?? {})
                },
                boost: {
                    ...defaults.raw.ball.boost,
                    ...(source.ball?.boost ?? {})
                },
                rebound: {
                    ...defaults.raw.ball.rebound,
                    ...(source.ball?.rebound ?? {})
                }
            },
            triangle: {
                movement: {
                    ...defaults.raw.triangle.movement,
                    ...(source.triangle?.movement ?? {})
                },
                jump: {
                    ...defaults.raw.triangle.jump,
                    ...(source.triangle?.jump ?? {})
                },
                animation: {
                    ...defaults.raw.triangle.animation,
                    ...(source.triangle?.animation ?? {})
                },
                flight: {
                    ...defaults.raw.triangle.flight,
                    ...(source.triangle?.flight ?? {})
                }
            },
            square: {
                movement: {
                    ...defaults.raw.square.movement,
                    ...(source.square?.movement ?? {})
                },
                jump: {
                    ...defaults.raw.square.jump,
                    ...(source.square?.jump ?? {})
                },
                animation: {
                    ...defaults.raw.square.animation,
                    ...(source.square?.animation ?? {})
                },
                attach: {
                    ...defaults.raw.square.attach,
                    ...(source.square?.attach ?? {})
                },
                trail: {
                    ...defaults.raw.square.trail,
                    ...(source.square?.trail ?? {})
                },
                attachJump: {
                    ...defaults.raw.square.attachJump,
                    ...(source.square?.attachJump ?? {})
                },
                rollover: {
                    ...defaults.raw.square.rollover,
                    ...(source.square?.rollover ?? {})
                }
            }
        }
    };
};
