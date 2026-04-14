import { Physics, type Scene } from 'phaser';
import type { MovingPlatformObject } from '../moving_platform';
import type { TestWorldMovingPlatformConfig, TestWorldMovingPlatformMotionState } from './test_world_config';

interface MovingPlatformRuntimeState {
    mode: TestWorldMovingPlatformMotionState;
    runOnceHasDepartedOrigin: boolean;
}

export interface TestWorldMovingPlatformRuntimeController {
    update: () => void;
    setMotionState: (platformId: string, mode: TestWorldMovingPlatformMotionState) => void;
    getMotionState: (platformId: string) => TestWorldMovingPlatformMotionState | null;
}

interface CreateTestWorldMovingPlatformRuntimeControllerParams {
    scene: Scene;
    platformConfigs: readonly TestWorldMovingPlatformConfig[];
    getPlatform: (id: string) => MovingPlatformObject | null;
}

const ORIGIN_EPSILON = 1;

export const createTestWorldMovingPlatformRuntimeController = (
    params: CreateTestWorldMovingPlatformRuntimeControllerParams
): TestWorldMovingPlatformRuntimeController => {
    const stateByPlatformId = new Map<string, MovingPlatformRuntimeState>();
    const originByPlatformId = new Map<string, { x: number; y: number }>();

    params.platformConfigs.forEach((platformConfig) => {
        stateByPlatformId.set(platformConfig.id, {
            mode: platformConfig.initialMotionState ?? 'running_loop',
            runOnceHasDepartedOrigin: false
        });
        originByPlatformId.set(platformConfig.id, {
            x: platformConfig.x,
            y: platformConfig.y
        });
    });

    return {
        update: (): void => {
            params.platformConfigs.forEach((platformConfig) => {
                const platform = params.getPlatform(platformConfig.id);
                const runtimeState = stateByPlatformId.get(platformConfig.id);
                const origin = originByPlatformId.get(platformConfig.id);
                if (!platform || !runtimeState || !origin) {
                    return;
                }

                if (runtimeState.mode === 'stopped') {
                    stopPlatform(platform);
                    return;
                }

                platform.update();

                if (runtimeState.mode !== 'run_once') {
                    return;
                }

                const isAtOrigin = isPlatformAtOrigin(platform, origin);
                if (!runtimeState.runOnceHasDepartedOrigin) {
                    runtimeState.runOnceHasDepartedOrigin = !isAtOrigin;
                    return;
                }

                if (isAtOrigin) {
                    runtimeState.mode = 'stopped';
                    runtimeState.runOnceHasDepartedOrigin = false;
                    stopPlatform(platform);
                }
            });
        },
        setMotionState: (platformId, mode): void => {
            const runtimeState = stateByPlatformId.get(platformId);
            if (!runtimeState) {
                return;
            }
            runtimeState.mode = mode;
            runtimeState.runOnceHasDepartedOrigin = false;
            const platform = params.getPlatform(platformId);
            if (platform && mode === 'stopped') {
                stopPlatform(platform);
            }
        },
        getMotionState: (platformId): TestWorldMovingPlatformMotionState | null => {
            return stateByPlatformId.get(platformId)?.mode ?? null;
        }
    };
};

const stopPlatform = (platform: MovingPlatformObject): void => {
    const body = platform.bodyObject.body as Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    const matterBody = platform.matterBody as MatterJS.BodyType & {
        pfCarryDeltaX?: number;
        pfCarryDeltaY?: number;
    };
    matterBody.pfCarryDeltaX = 0;
    matterBody.pfCarryDeltaY = 0;
};

const isPlatformAtOrigin = (
    platform: MovingPlatformObject,
    origin: { x: number; y: number }
): boolean => {
    return Math.abs(platform.bodyObject.x - origin.x) <= ORIGIN_EPSILON
        && Math.abs(platform.bodyObject.y - origin.y) <= ORIGIN_EPSILON;
};
