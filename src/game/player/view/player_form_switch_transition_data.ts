import type { PlayerFormId } from '../player_types';

export interface PlayerFormSwitchTransitionShapeParams {
    widthScale: number;
    heightScale: number;
    cornerHardness: number;
    topWidth: number;
    bottomWidth: number;
    sideBulge: number;
    topBulge: number;
    bottomBulge: number;
    apexSharpness: number;
    tiltRad: number;
    alpha: number;
    lineWidth: number;
}

export interface PlayerFormSwitchTransitionPoseStages {
    source: PlayerFormSwitchTransitionShapeParams;
    compress: PlayerFormSwitchTransitionShapeParams;
    bridge: PlayerFormSwitchTransitionShapeParams;
    emerge: PlayerFormSwitchTransitionShapeParams;
    target: PlayerFormSwitchTransitionShapeParams;
}

export interface PlayerFormSwitchTransitionSpec {
    fromForm: PlayerFormId;
    toForm: PlayerFormId;
    timing: PlayerFormSwitchTransitionTiming;
    stages: PlayerFormSwitchTransitionPoseStages;
}

export interface PlayerFormSwitchResolvedTransitionSpec {
    fromForm: PlayerFormId;
    toForm: PlayerFormId;
    timing: PlayerFormSwitchTransitionTiming;
    stages: PlayerFormSwitchTransitionPoseStages;
}

export interface PlayerFormSwitchTransitionTiming {
    totalDurationMs: number;
    commitDelayMs: number;
    sourceToCompressMs: number;
    compressToBridgeMs: number;
    bridgeToEmergeMs: number;
    emergeToTargetMs: number;
}

const DEFAULT_TRANSITION_TIMING: PlayerFormSwitchTransitionTiming = {
    totalDurationMs: 150,
    commitDelayMs: 44,
    sourceToCompressMs: 36,
    compressToBridgeMs: 39,
    bridgeToEmergeMs: 39,
    emergeToTargetMs: 36
};

const DEFAULT_POSE_ALPHA = 1;
const DEFAULT_POSE_LINE_WIDTH = 3.1;
const DEFAULT_POSE_TILT_RAD = 0;

const makeShape = (
    shape: Omit<PlayerFormSwitchTransitionShapeParams, 'alpha' | 'lineWidth' | 'tiltRad'>
): PlayerFormSwitchTransitionShapeParams => ({
    ...shape,
    tiltRad: DEFAULT_POSE_TILT_RAD,
    alpha: DEFAULT_POSE_ALPHA,
    lineWidth: DEFAULT_POSE_LINE_WIDTH
});

const withTimingSlices = (
    totalDurationMs: number,
    commitDelayMs: number,
    weights: [number, number, number, number] = [0.24, 0.26, 0.26, 0.24]
): PlayerFormSwitchTransitionTiming => {
    const [w0, w1, w2] = [
        Math.max(1, Math.round(totalDurationMs * weights[0])),
        Math.max(1, Math.round(totalDurationMs * weights[1])),
        Math.max(1, Math.round(totalDurationMs * weights[2]))
    ];
    const w3 = Math.max(1, totalDurationMs - w0 - w1 - w2);
    return {
        totalDurationMs,
        commitDelayMs,
        sourceToCompressMs: w0,
        compressToBridgeMs: w1,
        bridgeToEmergeMs: w2,
        emergeToTargetMs: w3
    };
};

const BALL_SHAPE = makeShape({
    widthScale: 1,
    heightScale: 1,
    cornerHardness: 0,
    topWidth: 1,
    bottomWidth: 1,
    sideBulge: 0,
    topBulge: 0,
    bottomBulge: 0,
    apexSharpness: 0
});

const TRIANGLE_SHAPE = makeShape({
    widthScale: 1,
    heightScale: 1,
    cornerHardness: 0.92,
    topWidth: 0.08,
    bottomWidth: 1.04,
    sideBulge: -0.08,
    topBulge: 0.16,
    bottomBulge: 0.05,
    apexSharpness: 1
});

const SQUARE_SHAPE = makeShape({
    widthScale: 1,
    heightScale: 1,
    cornerHardness: 1,
    topWidth: 1,
    bottomWidth: 1,
    sideBulge: 0,
    topBulge: 0,
    bottomBulge: 0,
    apexSharpness: 0
});

const TRANSITION_DATA: PlayerFormSwitchTransitionSpec[] = [
    {
        fromForm: 'triangle',
        toForm: 'ball',
        timing: withTimingSlices(160, 48, [0.24, 0.29, 0.27, 0.2]),
        stages: {
            source: TRIANGLE_SHAPE,
            compress: makeShape({
                widthScale: 1.04,
                heightScale: 0.96,
                cornerHardness: 0.72,
                topWidth: 0.24,
                bottomWidth: 1.1,
                sideBulge: -0.02,
                topBulge: 0.12,
                bottomBulge: 0.08,
                apexSharpness: 0.78
            }),
            bridge: makeShape({
                widthScale: 1.08,
                heightScale: 0.94,
                cornerHardness: 0.26,
                topWidth: 0.64,
                bottomWidth: 1.1,
                sideBulge: 0.18,
                topBulge: 0.02,
                bottomBulge: 0.12,
                apexSharpness: 0.22
            }),
            emerge: makeShape({
                widthScale: 1.03,
                heightScale: 0.98,
                cornerHardness: 0.1,
                topWidth: 0.88,
                bottomWidth: 1.04,
                sideBulge: 0.08,
                topBulge: 0,
                bottomBulge: 0.04,
                apexSharpness: 0.04
            }),
            target: BALL_SHAPE
        }
    },
    {
        fromForm: 'ball',
        toForm: 'triangle',
        timing: withTimingSlices(160, 48, [0.22, 0.27, 0.29, 0.22]),
        stages: {
            source: BALL_SHAPE,
            compress: makeShape({
                widthScale: 1.04,
                heightScale: 0.97,
                cornerHardness: 0.12,
                topWidth: 0.86,
                bottomWidth: 1.06,
                sideBulge: 0.06,
                topBulge: 0,
                bottomBulge: 0.06,
                apexSharpness: 0.08
            }),
            bridge: makeShape({
                widthScale: 1.06,
                heightScale: 0.95,
                cornerHardness: 0.44,
                topWidth: 0.58,
                bottomWidth: 1.1,
                sideBulge: 0.04,
                topBulge: 0.08,
                bottomBulge: 0.08,
                apexSharpness: 0.36
            }),
            emerge: makeShape({
                widthScale: 1.02,
                heightScale: 0.98,
                cornerHardness: 0.75,
                topWidth: 0.25,
                bottomWidth: 1.08,
                sideBulge: -0.03,
                topBulge: 0.12,
                bottomBulge: 0.06,
                apexSharpness: 0.8
            }),
            target: TRIANGLE_SHAPE
        }
    },
    {
        fromForm: 'ball',
        toForm: 'square',
        timing: withTimingSlices(140, 40, [0.24, 0.24, 0.26, 0.26]),
        stages: {
            source: BALL_SHAPE,
            compress: makeShape({
                widthScale: 1.06,
                heightScale: 0.94,
                cornerHardness: 0.14,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0.08,
                topBulge: 0,
                bottomBulge: 0.08,
                apexSharpness: 0
            }),
            bridge: makeShape({
                widthScale: 1.04,
                heightScale: 0.95,
                cornerHardness: 0.52,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0.03,
                topBulge: 0,
                bottomBulge: 0.03,
                apexSharpness: 0
            }),
            emerge: makeShape({
                widthScale: 1.01,
                heightScale: 0.99,
                cornerHardness: 0.84,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0,
                topBulge: 0,
                bottomBulge: 0.01,
                apexSharpness: 0
            }),
            target: SQUARE_SHAPE
        }
    },
    {
        fromForm: 'square',
        toForm: 'ball',
        timing: withTimingSlices(140, 40, [0.22, 0.27, 0.27, 0.24]),
        stages: {
            source: SQUARE_SHAPE,
            compress: makeShape({
                widthScale: 0.99,
                heightScale: 0.99,
                cornerHardness: 0.82,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0,
                topBulge: 0,
                bottomBulge: 0.01,
                apexSharpness: 0
            }),
            bridge: makeShape({
                widthScale: 1.03,
                heightScale: 0.95,
                cornerHardness: 0.48,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0.04,
                topBulge: 0,
                bottomBulge: 0.05,
                apexSharpness: 0
            }),
            emerge: makeShape({
                widthScale: 1.05,
                heightScale: 0.95,
                cornerHardness: 0.12,
                topWidth: 1,
                bottomWidth: 1,
                sideBulge: 0.09,
                topBulge: 0,
                bottomBulge: 0.08,
                apexSharpness: 0
            }),
            target: BALL_SHAPE
        }
    },
    {
        fromForm: 'triangle',
        toForm: 'square',
        timing: withTimingSlices(170, 54, [0.24, 0.27, 0.27, 0.22]),
        stages: {
            source: TRIANGLE_SHAPE,
            compress: makeShape({
                widthScale: 0.98,
                heightScale: 0.98,
                cornerHardness: 0.8,
                topWidth: 0.26,
                bottomWidth: 1.06,
                sideBulge: -0.04,
                topBulge: 0.12,
                bottomBulge: 0.05,
                apexSharpness: 0.74
            }),
            bridge: makeShape({
                widthScale: 0.99,
                heightScale: 0.98,
                cornerHardness: 0.46,
                topWidth: 0.66,
                bottomWidth: 1.04,
                sideBulge: 0.03,
                topBulge: 0.04,
                bottomBulge: 0.04,
                apexSharpness: 0.28
            }),
            emerge: makeShape({
                widthScale: 1,
                heightScale: 0.99,
                cornerHardness: 0.78,
                topWidth: 0.92,
                bottomWidth: 1.02,
                sideBulge: 0,
                topBulge: 0,
                bottomBulge: 0.01,
                apexSharpness: 0.04
            }),
            target: SQUARE_SHAPE
        }
    },
    {
        fromForm: 'square',
        toForm: 'triangle',
        timing: withTimingSlices(170, 54, [0.24, 0.29, 0.25, 0.22]),
        stages: {
            source: SQUARE_SHAPE,
            compress: makeShape({
                widthScale: 1.01,
                heightScale: 0.99,
                cornerHardness: 0.78,
                topWidth: 0.9,
                bottomWidth: 1.02,
                sideBulge: 0,
                topBulge: 0,
                bottomBulge: 0.01,
                apexSharpness: 0.05
            }),
            bridge: makeShape({
                widthScale: 1.02,
                heightScale: 0.97,
                cornerHardness: 0.42,
                topWidth: 0.62,
                bottomWidth: 1.06,
                sideBulge: 0.03,
                topBulge: 0.05,
                bottomBulge: 0.05,
                apexSharpness: 0.32
            }),
            emerge: makeShape({
                widthScale: 1.02,
                heightScale: 0.98,
                cornerHardness: 0.78,
                topWidth: 0.23,
                bottomWidth: 1.08,
                sideBulge: -0.04,
                topBulge: 0.12,
                bottomBulge: 0.06,
                apexSharpness: 0.82
            }),
            target: TRIANGLE_SHAPE
        }
    }
];

export const resolvePlayerFormSwitchTransitionSpec = (
    fromForm: PlayerFormId,
    toForm: PlayerFormId
): PlayerFormSwitchResolvedTransitionSpec | null => {
    const directSpec = TRANSITION_DATA.find((entry) => entry.fromForm === fromForm && entry.toForm === toForm);
    if (directSpec === undefined) {
        return null;
    }

    return {
        fromForm,
        toForm,
        timing: directSpec.timing,
        stages: directSpec.stages
    };
};

export const resolvePlayerFormSwitchTiming = (
    fromForm: PlayerFormId,
    toForm: PlayerFormId
): PlayerFormSwitchTransitionTiming => {
    const resolved = resolvePlayerFormSwitchTransitionSpec(fromForm, toForm);
    return resolved?.timing ?? DEFAULT_TRANSITION_TIMING;
};