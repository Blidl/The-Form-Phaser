import type { Scene } from 'phaser';

export interface GameplayTimeSnapshot {
    stopped: boolean;
    speed: number;
    effectiveScale: number;
}

export interface GameplayTimeController {
    setStopped: (stopped: boolean) => void;
    toggleStopped: () => void;
    setSpeed: (speed: number) => void;
    getSnapshot: () => GameplayTimeSnapshot;
    getEffectiveGameplayDeltaMs: (rawDeltaMs: number) => number;
}

const MIN_SPEED = 0;
const MAX_SPEED = 4;
const MIN_ACTIVE_SPEED_EPSILON = 0.0001;

const clampSpeed = (speed: number): number => {
    if (!Number.isFinite(speed)) {
        return 1;
    }
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
};

const clampRawDeltaMs = (deltaMs: number): number => {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
        return 0;
    }
    return deltaMs;
};

export const createGameplayTimeController = (scene: Scene): GameplayTimeController => {
    let stopped = false;
    let speed = 1;

    const getEffectiveScale = (): number => (stopped ? 0 : speed);

    const applyToRuntimeSystems = (): void => {
        const effectiveScale = getEffectiveScale();
        const activeSpeed = Math.max(speed, MIN_ACTIVE_SPEED_EPSILON);

        if (scene.physics?.world) {
            scene.physics.world.timeScale = 1 / activeSpeed;
            if (effectiveScale <= 0) {
                scene.physics.world.pause();
            } else {
                scene.physics.world.resume();
            }
        }

        if (scene.matter?.world) {
            const matterWorld = scene.matter.world;
            matterWorld.engine.timing.timeScale = activeSpeed;
            if (effectiveScale <= 0) {
                matterWorld.pause();
            } else {
                matterWorld.resume();
            }
        }
    };

    const setStopped = (nextStopped: boolean): void => {
        stopped = Boolean(nextStopped);
        applyToRuntimeSystems();
    };

    const setSpeed = (nextSpeed: number): void => {
        speed = clampSpeed(nextSpeed);
        applyToRuntimeSystems();
    };

    applyToRuntimeSystems();

    return {
        setStopped,
        toggleStopped: (): void => {
            setStopped(!stopped);
        },
        setSpeed,
        getSnapshot: (): GameplayTimeSnapshot => ({
            stopped,
            speed,
            effectiveScale: getEffectiveScale()
        }),
        getEffectiveGameplayDeltaMs: (rawDeltaMs: number): number => {
            const safeRawDeltaMs = clampRawDeltaMs(rawDeltaMs);
            return safeRawDeltaMs * getEffectiveScale();
        }
    };
};
