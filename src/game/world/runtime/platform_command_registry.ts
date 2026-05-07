import type { TestWorldLogicScriptCommandConfig } from './test_world_config';
import {
    asObject,
    type LogicCommandDefinition,
    type LogicCommandParamValidationResult
} from './script_command_core';

export const PLATFORM_MOVE_PING_PONG_COMMAND_TYPE = 'platform_move_ping_pong';
const PLATFORM_MOVE_PING_PONG_AXIS_VALUES = ['horizontal', 'vertical'] as const;
const PLATFORM_MOVE_PING_PONG_START_VALUES = ['running_loop', 'stopped', 'run_once'] as const;

export type PlatformMovePingPongAxis = (typeof PLATFORM_MOVE_PING_PONG_AXIS_VALUES)[number];
export type PlatformMovePingPongStart = (typeof PLATFORM_MOVE_PING_PONG_START_VALUES)[number];

export interface PlatformMovePingPongParams {
    axis: PlatformMovePingPongAxis;
    distance: number;
    speed: number;
    start: PlatformMovePingPongStart;
}

const isPlatformMovePingPongAxis = (value: unknown): value is PlatformMovePingPongAxis => {
    return value === 'horizontal' || value === 'vertical';
};

const isPlatformMovePingPongStart = (value: unknown): value is PlatformMovePingPongStart => {
    return value === 'running_loop' || value === 'stopped' || value === 'run_once';
};

const isFinitePositiveNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const validatePlatformMovePingPongParams = (params: unknown): LogicCommandParamValidationResult => {
    const raw = asObject(params);
    if (!raw) {
        return {
            valid: false,
            message: 'requires params object',
            fieldPath: 'params'
        };
    }

    if (!isPlatformMovePingPongAxis(raw.axis)) {
        return {
            valid: false,
            message: 'requires axis: "horizontal" | "vertical"',
            fieldPath: 'params.axis'
        };
    }

    if (!isFinitePositiveNumber(raw.distance)) {
        return {
            valid: false,
            message: 'requires distance as finite number > 0',
            fieldPath: 'params.distance'
        };
    }

    if (!isFinitePositiveNumber(raw.speed)) {
        return {
            valid: false,
            message: 'requires speed as finite number > 0',
            fieldPath: 'params.speed'
        };
    }

    if (raw.start !== undefined && !isPlatformMovePingPongStart(raw.start)) {
        return {
            valid: false,
            message: 'requires start to be "running_loop" | "stopped" | "run_once" when present',
            fieldPath: 'params.start'
        };
    }

    return { valid: true };
};

export const getPlatformMovePingPongParams = (params: unknown): PlatformMovePingPongParams | null => {
    const validation = validatePlatformMovePingPongParams(params);
    if (!validation.valid) {
        return null;
    }
    const raw = asObject(params) as {
        axis: PlatformMovePingPongAxis;
        distance: number;
        speed: number;
        start?: PlatformMovePingPongStart;
    };
    return {
        axis: raw.axis,
        distance: raw.distance,
        speed: raw.speed,
        start: raw.start ?? 'running_loop'
    };
};

const formatNumberValue = (value: unknown, fallback: string): string => {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
};

const getPlatformMovePingPongDisplay = (command: TestWorldLogicScriptCommandConfig): string => {
    const resolved = getPlatformMovePingPongParams(command.params);
    const raw = asObject(command.params);
    const axis = resolved?.axis ?? (isPlatformMovePingPongAxis(raw?.axis) ? raw.axis : '<invalid-axis>');
    const distance = resolved ? String(resolved.distance) : formatNumberValue(raw?.distance, '<invalid-distance>');
    const speed = resolved ? String(resolved.speed) : formatNumberValue(raw?.speed, '<invalid-speed>');
    const start = resolved
        ? resolved.start
        : raw?.start === undefined
            ? 'running_loop'
            : isPlatformMovePingPongStart(raw.start)
                ? raw.start
                : '<invalid-start>';
    return `${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE} axis=${axis} distance=${distance} speed=${speed} start=${start}`;
};

export interface PlatformMovePingPongContractSummary {
    commandCount: number;
    pingPongCommandCount: number;
    validPingPongCommandCount: number;
    invalidPingPongCommandCount: number;
    nonPingPongCommandCount: number;
    hasExactlyOneValidCommand: boolean;
}

export const summarizePlatformMovePingPongContract = (
    commands: readonly TestWorldLogicScriptCommandConfig[]
): PlatformMovePingPongContractSummary => {
    let pingPongCommandCount = 0;
    let validPingPongCommandCount = 0;
    let invalidPingPongCommandCount = 0;
    let nonPingPongCommandCount = 0;

    commands.forEach((command) => {
        const commandType = command.type.trim();
        if (commandType !== PLATFORM_MOVE_PING_PONG_COMMAND_TYPE) {
            nonPingPongCommandCount += 1;
            return;
        }
        pingPongCommandCount += 1;
        const paramsValidation = validatePlatformMovePingPongParams(command.params);
        if (paramsValidation.valid) {
            validPingPongCommandCount += 1;
            return;
        }
        invalidPingPongCommandCount += 1;
    });

    return {
        commandCount: commands.length,
        pingPongCommandCount,
        validPingPongCommandCount,
        invalidPingPongCommandCount,
        nonPingPongCommandCount,
        hasExactlyOneValidCommand: commands.length === 1 && validPingPongCommandCount === 1
    };
};

export const PLATFORM_LOGIC_COMMAND_DEFINITIONS: readonly LogicCommandDefinition[] = [
    {
        type: PLATFORM_MOVE_PING_PONG_COMMAND_TYPE,
        label: 'Platform Move Ping-Pong',
        description: 'Runtime v1 for surface/default platform ping-pong movement (gameplay only).',
        domain: 'platform',
        supportedAssignmentKinds: ['platform'],
        supportedScriptCategories: ['platform.move'],
        eventRuntimeSupported: false,
        readOnlyDisplay: {
            summaryTemplate: 'platform_move_ping_pong axis=<horizontal|vertical> distance=<number> speed=<number> start=<running_loop|stopped|run_once>'
        },
        paramSpec: [
            {
                key: 'axis',
                description: 'Movement axis.',
                required: true,
                expectedType: 'string',
                nonEmpty: true
            },
            {
                key: 'distance',
                description: 'Travel distance in pixels (> 0).',
                required: true,
                expectedType: 'number'
            },
            {
                key: 'speed',
                description: 'Movement speed in pixels/sec (> 0).',
                required: true,
                expectedType: 'number'
            },
            {
                key: 'start',
                description: 'Optional start state (defaults to running_loop).',
                required: false,
                expectedType: 'string',
                nonEmpty: true
            }
        ],
        runtimeSupported: true,
        previewSupported: false,
        previewBehaviorNote: 'platform_move_ping_pong is a platform behavior command; runtime movement preview is not simulated.',
        runtimeSupportedSlots: ['surface.behaviorScripts.move'],
        validateParams: validatePlatformMovePingPongParams,
        formatDisplay: getPlatformMovePingPongDisplay
    }
] as const;
