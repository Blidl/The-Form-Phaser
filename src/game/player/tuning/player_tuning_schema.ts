import type { PlayerTuningSnapshot, PlayerTuningTabId } from './player_tuning_types';
import {
    clampPlayerTuningNumber,
    getPlayerTuningRawValue,
    setPlayerTuningRawValue
} from './player_tuning_runtime';

export interface PlayerTuningFieldSchema {
    id: string;
    label: string;
    unit: string;
    min?: number;
    max?: number;
    step?: number;
    read: (snapshot: PlayerTuningSnapshot) => number;
    write: (snapshot: PlayerTuningSnapshot, value: number) => void;
}

export interface PlayerTuningSectionSchema {
    id: string;
    title: string;
    fields: PlayerTuningFieldSchema[];
    rawFields: PlayerTuningFieldSchema[];
}

export interface PlayerTuningTabSchema {
    id: PlayerTuningTabId;
    title: string;
    sections: PlayerTuningSectionSchema[];
}

const MS_PER_SEC = 1000;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const rawField = (
    id: string,
    label: string,
    unit: string,
    path: string,
    options: { min?: number; max?: number; step?: number } = {}
): PlayerTuningFieldSchema => ({
    id,
    label,
    unit,
    min: options.min,
    max: options.max,
    step: options.step ?? 1,
    read: (snapshot) => getPlayerTuningRawValue(snapshot, path),
    write: (snapshot, value) => {
        setPlayerTuningRawValue(snapshot, path, clampPlayerTuningNumber(value, options.min, options.max));
    }
});

const secondsField = (
    id: string,
    label: string,
    path: string,
    options: { min?: number; max?: number; step?: number } = {}
): PlayerTuningFieldSchema => ({
    id,
    label,
    unit: 'sec',
    min: options.min ?? 0,
    max: options.max,
    step: options.step ?? 0.01,
    read: (snapshot) => getPlayerTuningRawValue(snapshot, path) / MS_PER_SEC,
    write: (snapshot, value) => {
        setPlayerTuningRawValue(snapshot, path, clampPlayerTuningNumber(value, options.min, options.max) * MS_PER_SEC);
    }
});

const degreesField = (
    id: string,
    label: string,
    path: string,
    options: { min?: number; max?: number; step?: number } = {}
): PlayerTuningFieldSchema => ({
    id,
    label,
    unit: 'deg/sec',
    min: options.min ?? 0,
    max: options.max,
    step: options.step ?? 1,
    read: (snapshot) => getPlayerTuningRawValue(snapshot, path) * RAD_TO_DEG,
    write: (snapshot, value) => {
        setPlayerTuningRawValue(snapshot, path, clampPlayerTuningNumber(value, options.min, options.max) * DEG_TO_RAD);
    }
});

const timeToRateField = (
    id: string,
    label: string,
    speedPath: string,
    ratePath: string
): PlayerTuningFieldSchema => ({
    id,
    label,
    unit: 'sec',
    min: 0.01,
    step: 0.01,
    read: (snapshot) => {
        const speed = getPlayerTuningRawValue(snapshot, speedPath);
        const rate = getPlayerTuningRawValue(snapshot, ratePath);
        return rate <= 0 ? 0 : speed / rate;
    },
    write: (snapshot, value) => {
        const speed = getPlayerTuningRawValue(snapshot, speedPath);
        setPlayerTuningRawValue(snapshot, ratePath, speed / clampPlayerTuningNumber(value, 0.01));
    }
});

const jumpHeightFromRaw = (snapshot: PlayerTuningSnapshot, rootPath: string): number => {
    const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
    const launchVelocity = getPlayerTuningRawValue(snapshot, `${rootPath}.launchVelocity`);
    const riseGravityScale = getPlayerTuningRawValue(snapshot, `${rootPath}.riseGravityScale`);
    const effectiveGravity = Math.max(1, gravityY * riseGravityScale);
    return (Math.abs(launchVelocity) * Math.abs(launchVelocity)) / (2 * effectiveGravity);
};

const jumpTimeToApexFromRaw = (snapshot: PlayerTuningSnapshot, rootPath: string): number => {
    const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
    const launchVelocity = getPlayerTuningRawValue(snapshot, `${rootPath}.launchVelocity`);
    const riseGravityScale = getPlayerTuningRawValue(snapshot, `${rootPath}.riseGravityScale`);
    return Math.abs(launchVelocity) / Math.max(1, gravityY * riseGravityScale);
};

const applyJumpDesignHeightAndApex = (
    snapshot: PlayerTuningSnapshot,
    rootPath: string,
    heightPx: number,
    timeToApexSec: number
): void => {
    const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
    const nextHeight = clampPlayerTuningNumber(heightPx, 1);
    const nextApexTime = clampPlayerTuningNumber(timeToApexSec, 0.05);
    const riseGravity = (2 * nextHeight) / (nextApexTime * nextApexTime);
    setPlayerTuningRawValue(snapshot, `${rootPath}.launchVelocity`, -(riseGravity * nextApexTime));
    setPlayerTuningRawValue(snapshot, `${rootPath}.riseGravityScale`, riseGravity / Math.max(1, gravityY));
};

const apexHangTimeFromRaw = (snapshot: PlayerTuningSnapshot, rootPath: string): number => {
    const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
    const riseScale = getPlayerTuningRawValue(snapshot, `${rootPath}.riseGravityScale`);
    const apexScale = getPlayerTuningRawValue(snapshot, `${rootPath}.apexGravityScale`);
    const threshold = getPlayerTuningRawValue(snapshot, `${rootPath}.apexVelocityThreshold`);
    const riseGravity = Math.max(1, gravityY * riseScale);
    const apexGravity = Math.max(1, gravityY * apexScale);
    const deltaPerSpeed = (1 / apexGravity) - (1 / riseGravity);
    return deltaPerSpeed <= 0 ? 0 : 2 * threshold * deltaPerSpeed;
};

const writeApexHangTime = (snapshot: PlayerTuningSnapshot, rootPath: string, value: number): void => {
    const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
    const riseScale = getPlayerTuningRawValue(snapshot, `${rootPath}.riseGravityScale`);
    const apexScale = getPlayerTuningRawValue(snapshot, `${rootPath}.apexGravityScale`);
    const riseGravity = Math.max(1, gravityY * riseScale);
    const apexGravity = Math.max(1, gravityY * apexScale);
    const deltaPerSpeed = (1 / apexGravity) - (1 / riseGravity);
    const nextHangTime = clampPlayerTuningNumber(value, 0);
    const threshold = deltaPerSpeed <= 0 ? 0 : nextHangTime / (2 * deltaPerSpeed);
    setPlayerTuningRawValue(snapshot, `${rootPath}.apexVelocityThreshold`, threshold);
};

const jumpField = (
    id: string,
    label: string,
    unit: string,
    rootPath: string,
    read: (snapshot: PlayerTuningSnapshot, rootPath: string) => number,
    write: (snapshot: PlayerTuningSnapshot, rootPath: string, value: number) => void,
    options: { min?: number; max?: number; step?: number } = {}
): PlayerTuningFieldSchema => ({
    id,
    label,
    unit,
    min: options.min,
    max: options.max,
    step: options.step ?? 0.01,
    read: (snapshot) => read(snapshot, rootPath),
    write: (snapshot, value) => write(snapshot, rootPath, value)
});

const buildJumpFields = (rootPath: string, prefix: string): PlayerTuningFieldSchema[] => [
    jumpField(`${prefix}-full-height`, 'Full Jump Height', 'px', rootPath, jumpHeightFromRaw, (snapshot, path, value) => {
        applyJumpDesignHeightAndApex(snapshot, path, value, jumpTimeToApexFromRaw(snapshot, path));
    }, { min: 1, step: 1 }),
    jumpField(`${prefix}-time-to-apex`, 'Time To Apex', 'sec', rootPath, jumpTimeToApexFromRaw, (snapshot, path, value) => {
        applyJumpDesignHeightAndApex(snapshot, path, jumpHeightFromRaw(snapshot, path), value);
    }, { min: 0.05, step: 0.01 }),
    jumpField(`${prefix}-apex-hang`, 'Apex Hang Time', 'sec', rootPath, apexHangTimeFromRaw, writeApexHangTime, { min: 0, step: 0.01 }),
    jumpField(`${prefix}-short-hop-height`, 'Short Hop Height', 'px', rootPath, (snapshot, path) => {
        const fullHeight = jumpHeightFromRaw(snapshot, path);
        const jumpCutMultiplier = getPlayerTuningRawValue(snapshot, `${path}.jumpCutMultiplier`);
        return fullHeight * jumpCutMultiplier * jumpCutMultiplier;
    }, (snapshot, path, value) => {
        const fullHeight = Math.max(1, jumpHeightFromRaw(snapshot, path));
        setPlayerTuningRawValue(snapshot, `${path}.jumpCutMultiplier`, Math.sqrt(clampPlayerTuningNumber(value, 1, fullHeight) / fullHeight));
    }, { min: 1, step: 1 })
];

const buildJumpRawFields = (rootPath: string, prefix: string): PlayerTuningFieldSchema[] => [
    rawField(`${prefix}-launch-velocity`, 'Launch Velocity', 'px/sec', `${rootPath}.launchVelocity`, { step: 1 }),
    rawField(`${prefix}-jump-cut`, 'Jump Cut Multiplier', 'ratio', `${rootPath}.jumpCutMultiplier`, { min: 0.01, max: 1, step: 0.01 }),
    rawField(`${prefix}-rise-scale`, 'Rise Gravity Scale', 'ratio', `${rootPath}.riseGravityScale`, { min: 0.01, step: 0.01 }),
    rawField(`${prefix}-apex-scale`, 'Apex Gravity Scale', 'ratio', `${rootPath}.apexGravityScale`, { min: 0.01, step: 0.01 }),
    rawField(`${prefix}-apex-threshold`, 'Apex Velocity Threshold', 'px/sec', `${rootPath}.apexVelocityThreshold`, { min: 0, step: 1 })
];

const buildMovementFields = (rootPath: string, prefix: string): PlayerTuningFieldSchema[] => [
    rawField(`${prefix}-ground-max-speed`, 'Ground Max Speed', 'px/sec', `${rootPath}.groundMaxSpeed`, { min: 1, step: 1 }),
    timeToRateField(`${prefix}-ground-accel-time`, 'Ground Accel 0→Max', `${rootPath}.groundMaxSpeed`, `${rootPath}.groundAccel`),
    timeToRateField(`${prefix}-ground-decel-time`, 'Ground Decel Max→0', `${rootPath}.groundMaxSpeed`, `${rootPath}.groundDecel`),
    rawField(`${prefix}-air-max-speed`, 'Air Max Speed', 'px/sec', `${rootPath}.airMaxSpeed`, { min: 1, step: 1 }),
    timeToRateField(`${prefix}-air-accel-time`, 'Air Accel 0→Max', `${rootPath}.airMaxSpeed`, `${rootPath}.airAccel`),
    timeToRateField(`${prefix}-air-decel-time`, 'Air Decel Max→0', `${rootPath}.airMaxSpeed`, `${rootPath}.airDecel`)
];

const buildMovementRawFields = (rootPath: string, prefix: string): PlayerTuningFieldSchema[] => [
    rawField(`${prefix}-ground-max-speed-raw`, 'Ground Max Speed', 'px/sec', `${rootPath}.groundMaxSpeed`, { min: 1, step: 1 }),
    rawField(`${prefix}-ground-accel-raw`, 'Ground Accel', 'px/sec²', `${rootPath}.groundAccel`, { min: 1, step: 1 }),
    rawField(`${prefix}-ground-decel-raw`, 'Ground Decel', 'px/sec²', `${rootPath}.groundDecel`, { min: 1, step: 1 }),
    rawField(`${prefix}-air-max-speed-raw`, 'Air Max Speed', 'px/sec', `${rootPath}.airMaxSpeed`, { min: 1, step: 1 }),
    rawField(`${prefix}-air-accel-raw`, 'Air Accel', 'px/sec²', `${rootPath}.airAccel`, { min: 1, step: 1 }),
    rawField(`${prefix}-air-decel-raw`, 'Air Decel', 'px/sec²', `${rootPath}.airDecel`, { min: 1, step: 1 })
];

const reboundHeightField = (id: string, label: string, path: string): PlayerTuningFieldSchema => ({
    id,
    label,
    unit: 'px',
    min: 1,
    step: 1,
    read: (snapshot) => {
        const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
        const velocity = getPlayerTuningRawValue(snapshot, path);
        return (Math.abs(velocity) * Math.abs(velocity)) / (2 * Math.max(1, gravityY));
    },
    write: (snapshot, value) => {
        const gravityY = getPlayerTuningRawValue(snapshot, 'common.gravityY');
        setPlayerTuningRawValue(snapshot, path, -Math.sqrt(2 * Math.max(1, gravityY) * clampPlayerTuningNumber(value, 1)));
    }
});

const squareTrailMaxLengthField: PlayerTuningFieldSchema = {
    id: 'square-trail-max-length',
    label: 'Max Length',
    unit: 'px',
    min: 1,
    step: 1,
    read: (snapshot) => {
        const resourceMax = getPlayerTuningRawValue(snapshot, 'square.trail.resourceMax');
        const spendPerPx = Math.max(0.0001, getPlayerTuningRawValue(snapshot, 'square.trail.spendPerPx'));
        return resourceMax / spendPerPx;
    },
    write: (snapshot, value) => {
        const spendPerPx = Math.max(0.0001, getPlayerTuningRawValue(snapshot, 'square.trail.spendPerPx'));
        setPlayerTuningRawValue(snapshot, 'square.trail.resourceMax', clampPlayerTuningNumber(value, 1) * spendPerPx);
    }
};

const triangleFlightRestoreTimeField: PlayerTuningFieldSchema = {
    id: 'triangle-flight-restore-time',
    label: 'Flight Restore Time',
    unit: 'sec',
    min: 0.01,
    step: 0.01,
    read: (snapshot) => {
        const distance = getPlayerTuningRawValue(snapshot, 'triangle.flight.flightDistancePx');
        const restoreSpeed = Math.max(0.0001, getPlayerTuningRawValue(snapshot, 'triangle.flight.flightRestoreSpeed'));
        return distance / restoreSpeed;
    },
    write: (snapshot, value) => {
        const distance = getPlayerTuningRawValue(snapshot, 'triangle.flight.flightDistancePx');
        setPlayerTuningRawValue(snapshot, 'triangle.flight.flightRestoreSpeed', distance / clampPlayerTuningNumber(value, 0.01));
    }
};

export const PLAYER_TUNING_TABS: PlayerTuningTabSchema[] = [
    {
        id: 'common',
        title: 'Common',
        sections: [
            {
                id: 'common-system',
                title: 'System',
                fields: [
                    secondsField('common-coyote', 'Coyote Time', 'common.coyoteTimeMs'),
                    secondsField('common-jump-buffer', 'Jump Buffer', 'common.jumpBufferMs'),
                    secondsField('common-transform-lock', 'Transform Lock', 'common.transformLockMs'),
                    secondsField('common-death-pause', 'Death Pause', 'common.deathPauseMs'),
                    rawField('common-gravity', 'Gravity', 'px/sec²', 'common.gravityY', { min: 1, step: 1 })
                ],
                rawFields: [
                    rawField('common-coyote-raw', 'Coyote Time', 'ms', 'common.coyoteTimeMs', { min: 0, step: 1 }),
                    rawField('common-jump-buffer-raw', 'Jump Buffer', 'ms', 'common.jumpBufferMs', { min: 0, step: 1 }),
                    rawField('common-transform-lock-raw', 'Transform Lock', 'ms', 'common.transformLockMs', { min: 0, step: 1 }),
                    rawField('common-death-pause-raw', 'Death Pause', 'ms', 'common.deathPauseMs', { min: 0, step: 1 }),
                    rawField('common-gravity-raw', 'Gravity', 'px/sec²', 'common.gravityY', { min: 1, step: 1 })
                ]
            },
            {
                id: 'common-camera',
                title: 'Camera',
                fields: [
                    rawField('common-camera-follow-lerp', 'Follow Lerp', 'ratio', 'common.cameraFollowLerp', { min: 0.01, max: 1, step: 0.01 })
                ],
                rawFields: [
                    rawField('common-camera-follow-lerp-raw', 'Follow Lerp', 'ratio', 'common.cameraFollowLerp', { min: 0.01, max: 1, step: 0.01 })
                ]
            },
            {
                id: 'common-marker',
                title: 'Marker',
                fields: [
                    rawField('common-marker-move', 'Marker Move Speed', 'px/sec', 'common.markerMoveSpeed', { min: 1, step: 1 }),
                    rawField('common-marker-return', 'Marker Return Speed', 'px/sec', 'common.markerReturnSpeed', { min: 1, step: 1 }),
                    rawField('common-marker-offset', 'Marker Max Offset', 'px', 'common.markerMaxOffset', { min: 1, step: 1 }),
                    rawField('common-marker-smoothing', 'Marker Smoothing Time', 'sec', 'common.markerSmoothingTimeSec', { min: 0.001, step: 0.01 })
                ],
                rawFields: [
                    rawField('common-marker-move-raw', 'Marker Move Speed', 'px/sec', 'common.markerMoveSpeed', { min: 1, step: 1 }),
                    rawField('common-marker-return-raw', 'Marker Return Speed', 'px/sec', 'common.markerReturnSpeed', { min: 1, step: 1 }),
                    rawField('common-marker-offset-raw', 'Marker Max Offset', 'px', 'common.markerMaxOffset', { min: 1, step: 1 }),
                    rawField('common-marker-smoothing-raw', 'Marker Smoothing Time', 'sec', 'common.markerSmoothingTimeSec', { min: 0.001, step: 0.01 })
                ]
            },
            {
                id: 'common-wind',
                title: 'Wind',
                fields: [
                    rawField('common-wind-response', 'Wind Response', 'raw', 'common.windResponse', { min: 0, step: 1 }),
                    rawField('common-wind-min-drift', 'Wind Min Drift Ratio', 'ratio', 'common.windMinDriftRatio', { min: 0, max: 1, step: 0.01 })
                ],
                rawFields: [
                    rawField('common-wind-response-raw', 'Wind Response', 'raw', 'common.windResponse', { min: 0, step: 1 }),
                    rawField('common-wind-min-drift-raw', 'Wind Min Drift Ratio', 'ratio', 'common.windMinDriftRatio', { min: 0, max: 1, step: 0.01 })
                ]
            }
        ]
    },
    {
        id: 'ball',
        title: 'Ball',
        sections: [
            { id: 'ball-movement', title: 'Movement', fields: buildMovementFields('ball.movement', 'ball-move'), rawFields: buildMovementRawFields('ball.movement', 'ball-move') },
            { id: 'ball-jump', title: 'Jump', fields: buildJumpFields('ball.jump', 'ball-jump'), rawFields: buildJumpRawFields('ball.jump', 'ball-jump') },
            {
                id: 'ball-boost',
                title: 'Boost',
                fields: [
                    rawField('ball-boost-start', 'Start Impulse', 'px/sec', 'ball.boost.startImpulseSpeed', { min: 1, step: 1 }),
                    secondsField('ball-boost-decay', 'Impulse Decay Time', 'ball.boost.startImpulseDecayMs'),
                    rawField('ball-boost-ground-speed', 'Hold Ground Speed', 'px/sec', 'ball.boost.holdGroundMoveSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-air-speed', 'Hold Air Speed', 'px/sec', 'ball.boost.holdAirMoveSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-accel', 'Hold Accel', 'px/sec²', 'ball.boost.holdAccel', { min: 1, step: 1 }),
                    rawField('ball-boost-jump-min-speed', 'Boost Jump Min Horizontal Speed', 'px/sec', 'ball.boost.jumpMinHorizontalSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-jump-multiplier', 'Boost Jump Velocity Multiplier', 'ratio', 'ball.boost.jumpVelocityMultiplier', { min: 0.01, step: 0.01 }),
                    rawField('ball-boost-air-control', 'Boost Air Control Factor', 'ratio', 'ball.boost.holdAirControlFactor', { min: 0, max: 1, step: 0.01 })
                ],
                rawFields: [
                    rawField('ball-boost-start-raw', 'Start Impulse', 'px/sec', 'ball.boost.startImpulseSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-decay-raw', 'Impulse Decay', 'ms', 'ball.boost.startImpulseDecayMs', { min: 0, step: 1 }),
                    rawField('ball-boost-ground-speed-raw', 'Hold Ground Speed', 'px/sec', 'ball.boost.holdGroundMoveSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-air-speed-raw', 'Hold Air Speed', 'px/sec', 'ball.boost.holdAirMoveSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-accel-raw', 'Hold Accel', 'px/sec²', 'ball.boost.holdAccel', { min: 1, step: 1 }),
                    rawField('ball-boost-jump-min-speed-raw', 'Boost Jump Min Horizontal Speed', 'px/sec', 'ball.boost.jumpMinHorizontalSpeed', { min: 1, step: 1 }),
                    rawField('ball-boost-jump-multiplier-raw', 'Boost Jump Velocity Multiplier', 'ratio', 'ball.boost.jumpVelocityMultiplier', { min: 0.01, step: 0.01 }),
                    rawField('ball-boost-air-control-raw', 'Boost Air Control Factor', 'ratio', 'ball.boost.holdAirControlFactor', { min: 0, max: 1, step: 0.01 })
                ]
            },
            {
                id: 'ball-rebound',
                title: 'Rebound',
                fields: [
                    secondsField('ball-rebound-input-window', 'Input Window', 'ball.rebound.inputWindowMs'),
                    secondsField('ball-rebound-hit-pause', 'Hit Pause', 'ball.rebound.hitPauseMs'),
                    reboundHeightField('ball-rebound-level1', 'Level1 Rebound Height', 'ball.rebound.level1JumpVelocity'),
                    reboundHeightField('ball-rebound-level2', 'Level2 Rebound Height', 'ball.rebound.level2JumpVelocity'),
                    secondsField('ball-rebound-wall-coyote', 'Wall Coyote', 'ball.rebound.wallCoyoteMs'),
                    secondsField('ball-rebound-launch-pause', 'Pause Before Launch', 'ball.rebound.pauseBeforeLaunchMs'),
                    secondsField('ball-rebound-input-lock', 'Surface Input Lock', 'ball.rebound.surfaceInputLockMs'),
                    rawField('ball-rebound-wall-into-speed', 'Wall Min Into Surface Speed', 'px/sec', 'ball.rebound.wallMinIntoSurfaceSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-wall-bias', 'Wall Fallback Upward Bias', 'ratio', 'ball.rebound.wallFallbackUpwardBias', { min: 0, step: 0.01 }),
                    rawField('ball-rebound-wall-exit-speed', 'Wall Min Exit Speed', 'px/sec', 'ball.rebound.wallMinExitSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-ceiling-exit-speed', 'Ceiling Min Exit Speed', 'px/sec', 'ball.rebound.ceilingMinExitSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-ceiling-downward-speed', 'Ceiling Min Downward Speed', 'px/sec', 'ball.rebound.ceilingMinDownwardSpeed', { min: 0, step: 1 })
                ],
                rawFields: [
                    rawField('ball-rebound-input-window-raw', 'Input Window', 'ms', 'ball.rebound.inputWindowMs', { min: 0, step: 1 }),
                    rawField('ball-rebound-hit-pause-raw', 'Hit Pause', 'ms', 'ball.rebound.hitPauseMs', { min: 0, step: 1 }),
                    rawField('ball-rebound-level1-raw', 'Level1 Launch Velocity', 'px/sec', 'ball.rebound.level1JumpVelocity', { step: 1 }),
                    rawField('ball-rebound-level2-raw', 'Level2 Launch Velocity', 'px/sec', 'ball.rebound.level2JumpVelocity', { step: 1 }),
                    rawField('ball-rebound-wall-coyote-raw', 'Wall Coyote', 'ms', 'ball.rebound.wallCoyoteMs', { min: 0, step: 1 }),
                    rawField('ball-rebound-launch-pause-raw', 'Pause Before Launch', 'ms', 'ball.rebound.pauseBeforeLaunchMs', { min: 0, step: 1 }),
                    rawField('ball-rebound-input-lock-raw', 'Surface Input Lock', 'ms', 'ball.rebound.surfaceInputLockMs', { min: 0, step: 1 }),
                    rawField('ball-rebound-wall-into-speed-raw', 'Wall Min Into Surface Speed', 'px/sec', 'ball.rebound.wallMinIntoSurfaceSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-wall-bias-raw', 'Wall Fallback Upward Bias', 'ratio', 'ball.rebound.wallFallbackUpwardBias', { min: 0, step: 0.01 }),
                    rawField('ball-rebound-wall-exit-speed-raw', 'Wall Min Exit Speed', 'px/sec', 'ball.rebound.wallMinExitSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-ceiling-exit-speed-raw', 'Ceiling Min Exit Speed', 'px/sec', 'ball.rebound.ceilingMinExitSpeed', { min: 0, step: 1 }),
                    rawField('ball-rebound-ceiling-downward-speed-raw', 'Ceiling Min Downward Speed', 'px/sec', 'ball.rebound.ceilingMinDownwardSpeed', { min: 0, step: 1 })
                ]
            }
        ]
    },
    {
        id: 'triangle',
        title: 'Triangle',
        sections: [
            { id: 'triangle-movement', title: 'Movement', fields: buildMovementFields('triangle.movement', 'triangle-move'), rawFields: buildMovementRawFields('triangle.movement', 'triangle-move') },
            { id: 'triangle-jump', title: 'Jump', fields: buildJumpFields('triangle.jump', 'triangle-jump'), rawFields: buildJumpRawFields('triangle.jump', 'triangle-jump') },
            {
                id: 'triangle-flight',
                title: 'Flight',
                fields: [
                    rawField('triangle-flight-speed', 'Flight Speed', 'px/sec', 'triangle.flight.flightSpeed', { min: 1, step: 1 }),
                    rawField('triangle-flight-distance', 'Flight Distance', 'px', 'triangle.flight.flightDistancePx', { min: 1, step: 1 }),
                    triangleFlightRestoreTimeField,
                    degreesField('triangle-flight-turn-speed', 'Flight Turn Speed', 'triangle.flight.flightTurnSpeedRadPerSec', { min: 0, step: 1 })
                ],
                rawFields: [
                    rawField('triangle-flight-speed-raw', 'Flight Speed', 'px/sec', 'triangle.flight.flightSpeed', { min: 1, step: 1 }),
                    rawField('triangle-flight-distance-raw', 'Flight Distance', 'px', 'triangle.flight.flightDistancePx', { min: 1, step: 1 }),
                    rawField('triangle-flight-restore-speed-raw', 'Flight Restore Speed', 'px/sec', 'triangle.flight.flightRestoreSpeed', { min: 1, step: 1 }),
                    rawField('triangle-flight-turn-speed-raw', 'Flight Turn Speed', 'rad/sec', 'triangle.flight.flightTurnSpeedRadPerSec', { min: 0, step: 0.01 })
                ]
            }
        ]
    },
    {
        id: 'square',
        title: 'Square',
        sections: [
            { id: 'square-movement', title: 'Movement', fields: buildMovementFields('square.movement', 'square-move'), rawFields: buildMovementRawFields('square.movement', 'square-move') },
            { id: 'square-jump', title: 'Jump', fields: buildJumpFields('square.jump', 'square-jump'), rawFields: buildJumpRawFields('square.jump', 'square-jump') },
            {
                id: 'square-attach',
                title: 'Attach',
                fields: [
                    rawField('square-attach-acquire', 'Acquire Range', 'px', 'square.attach.acquireRangePx', { min: 1, step: 1 }),
                    secondsField('square-attach-buffer', 'Attach Buffer', 'square.attach.attachBufferMs'),
                    secondsField('square-attach-grace', 'Contact Grace', 'square.attach.contactGraceMs'),
                    rawField('square-attach-surface-speed', 'Surface Move Speed', 'px/sec', 'square.attach.surfaceMoveSpeed', { min: 1, step: 1 })
                ],
                rawFields: [
                    rawField('square-attach-acquire-raw', 'Acquire Range', 'px', 'square.attach.acquireRangePx', { min: 1, step: 1 }),
                    rawField('square-attach-buffer-raw', 'Attach Buffer', 'ms', 'square.attach.attachBufferMs', { min: 0, step: 1 }),
                    rawField('square-attach-grace-raw', 'Contact Grace', 'ms', 'square.attach.contactGraceMs', { min: 0, step: 1 }),
                    rawField('square-attach-surface-speed-raw', 'Surface Move Speed', 'px/sec', 'square.attach.surfaceMoveSpeed', { min: 1, step: 1 })
                ]
            },
            {
                id: 'square-trail',
                title: 'Trail',
                fields: [
                    squareTrailMaxLengthField,
                    rawField('square-trail-spend', 'Spend Per Px', 'resource/px', 'square.trail.spendPerPx', { min: 0.0001, step: 0.01 }),
                    rawField('square-trail-regen', 'Manual Regen Speed', 'px/sec', 'square.trail.manualRegenSpeed', { min: 1, step: 1 })
                ],
                rawFields: [
                    rawField('square-trail-resource-max-raw', 'Trail Resource Max', 'resource', 'square.trail.resourceMax', { min: 1, step: 1 }),
                    rawField('square-trail-spend-raw', 'Spend Per Px', 'resource/px', 'square.trail.spendPerPx', { min: 0.0001, step: 0.01 }),
                    rawField('square-trail-regen-raw', 'Manual Regen Speed', 'px/sec', 'square.trail.manualRegenSpeed', { min: 1, step: 1 })
                ]
            },
            {
                id: 'square-attach-jump',
                title: 'Attach Jump',
                fields: [
                    rawField('square-attach-jump-height', 'Jump Height', 'px', 'square.attachJump.heightPx', { min: 1, step: 1 }),
                    rawField('square-attach-jump-out-speed', 'Jump Out Speed', 'px/sec', 'square.attachJump.outSpeed', { min: 1, step: 1 }),
                    secondsField('square-attach-jump-return-time', 'Return Time', 'square.attachJump.returnTimeMs'),
                    rawField('square-attach-jump-tether', 'Tether Stretch', 'px', 'square.attachJump.tetherStretchPx', { min: 1, step: 1 }),
                    rawField('square-attach-jump-reacquire', 'Reacquire Range', 'px', 'square.attachJump.reacquireRangePx', { min: 1, step: 1 })
                ],
                rawFields: [
                    rawField('square-attach-jump-height-raw', 'Jump Height', 'px', 'square.attachJump.heightPx', { min: 1, step: 1 }),
                    rawField('square-attach-jump-out-speed-raw', 'Jump Out Speed', 'px/sec', 'square.attachJump.outSpeed', { min: 1, step: 1 }),
                    rawField('square-attach-jump-return-time-raw', 'Return Time', 'ms', 'square.attachJump.returnTimeMs', { min: 1, step: 1 }),
                    rawField('square-attach-jump-tether-raw', 'Tether Stretch', 'px', 'square.attachJump.tetherStretchPx', { min: 1, step: 1 }),
                    rawField('square-attach-jump-reacquire-raw', 'Reacquire Range', 'px', 'square.attachJump.reacquireRangePx', { min: 1, step: 1 })
                ]
            },
            {
                id: 'square-rollover',
                title: 'Rollover',
                fields: [
                    secondsField('square-rollover-preview', 'Preview Time', 'square.rollover.previewTimeMs'),
                    secondsField('square-rollover-duration', 'Duration', 'square.rollover.durationMs'),
                    secondsField('square-rollover-return', 'Return Time', 'square.rollover.returnTimeMs'),
                    rawField('square-rollover-corner-range', 'Corner Detection Range', 'px', 'square.rollover.cornerDetectionRangePx', { min: 1, step: 1 }),
                    rawField('square-rollover-surface-range', 'Surface Validation Range', 'px', 'square.rollover.surfaceValidationRangePx', { min: 1, step: 1 })
                ],
                rawFields: [
                    rawField('square-rollover-preview-raw', 'Preview Time', 'ms', 'square.rollover.previewTimeMs', { min: 0, step: 1 }),
                    rawField('square-rollover-duration-raw', 'Duration', 'ms', 'square.rollover.durationMs', { min: 0, step: 1 }),
                    rawField('square-rollover-return-raw', 'Return Time', 'ms', 'square.rollover.returnTimeMs', { min: 0, step: 1 }),
                    rawField('square-rollover-corner-range-raw', 'Corner Detection Range', 'px', 'square.rollover.cornerDetectionRangePx', { min: 1, step: 1 }),
                    rawField('square-rollover-surface-range-raw', 'Surface Validation Range', 'px', 'square.rollover.surfaceValidationRangePx', { min: 1, step: 1 })
                ]
            }
        ]
    }
];

export const PLAYER_TUNING_TAB_MAP = new Map(PLAYER_TUNING_TABS.map((tab) => [tab.id, tab]));
