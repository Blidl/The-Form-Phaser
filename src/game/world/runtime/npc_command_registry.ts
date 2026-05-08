import type { TestWorldLogicScriptCommandConfig } from './test_world_config';
import {
    asObject,
    type LogicCommandDefinition,
    type LogicCommandParamValidationResult
} from './script_command_core';

export const NPC_PATROL_PING_PONG_COMMAND_TYPE = 'npc_patrol_ping_pong';
const NPC_PATROL_AXIS_VALUES = ['horizontal', 'vertical'] as const;
const NPC_PATROL_START_VALUES = ['running_loop', 'stopped'] as const;

export type NpcPatrolPingPongAxis = (typeof NPC_PATROL_AXIS_VALUES)[number];
export type NpcPatrolPingPongStart = (typeof NPC_PATROL_START_VALUES)[number];

export interface NpcPatrolPingPongParams {
    axis: NpcPatrolPingPongAxis;
    distance: number;
    speed: number;
    start: NpcPatrolPingPongStart;
}

const isNpcPatrolAxis = (value: unknown): value is NpcPatrolPingPongAxis => {
    return value === 'horizontal' || value === 'vertical';
};

const isNpcPatrolStart = (value: unknown): value is NpcPatrolPingPongStart => {
    return value === 'running_loop' || value === 'stopped';
};

const isFinitePositiveNumber = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const validateNpcPatrolPingPongParams = (params: unknown): LogicCommandParamValidationResult => {
    const raw = asObject(params);
    if (!raw) {
        return {
            valid: false,
            message: 'requires params object',
            fieldPath: 'params'
        };
    }

    if (!isNpcPatrolAxis(raw.axis)) {
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

    if (raw.start !== undefined && !isNpcPatrolStart(raw.start)) {
        return {
            valid: false,
            message: 'requires start to be "running_loop" | "stopped" when present',
            fieldPath: 'params.start'
        };
    }

    return { valid: true };
};

export const getNpcPatrolPingPongParams = (params: unknown): NpcPatrolPingPongParams | null => {
    const validation = validateNpcPatrolPingPongParams(params);
    if (!validation.valid) {
        return null;
    }
    const raw = asObject(params) as {
        axis: NpcPatrolPingPongAxis;
        distance: number;
        speed: number;
        start?: NpcPatrolPingPongStart;
    };
    return {
        axis: raw.axis,
        distance: raw.distance,
        speed: raw.speed,
        start: raw.start ?? 'running_loop'
    };
};

export interface NpcPatrolPingPongContractSummary {
    commandCount: number;
    pingPongCommandCount: number;
    validPingPongCommandCount: number;
    invalidPingPongCommandCount: number;
    nonPingPongCommandCount: number;
    hasExactlyOneValidCommand: boolean;
}

export const summarizeNpcPatrolPingPongContract = (
    commands: readonly TestWorldLogicScriptCommandConfig[]
): NpcPatrolPingPongContractSummary => {
    let pingPongCommandCount = 0;
    let validPingPongCommandCount = 0;
    let invalidPingPongCommandCount = 0;
    let nonPingPongCommandCount = 0;

    commands.forEach((command) => {
        const commandType = command.type.trim();
        if (commandType !== NPC_PATROL_PING_PONG_COMMAND_TYPE) {
            nonPingPongCommandCount += 1;
            return;
        }
        pingPongCommandCount += 1;
        const paramsValidation = validateNpcPatrolPingPongParams(command.params);
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

const formatNumberValue = (value: unknown, fallback: string): string => {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
};

const getNpcPatrolPingPongDisplay = (command: TestWorldLogicScriptCommandConfig): string => {
    const resolved = getNpcPatrolPingPongParams(command.params);
    const raw = asObject(command.params);
    const axis = resolved?.axis ?? (isNpcPatrolAxis(raw?.axis) ? raw.axis : '<invalid-axis>');
    const distance = resolved ? String(resolved.distance) : formatNumberValue(raw?.distance, '<invalid-distance>');
    const speed = resolved ? String(resolved.speed) : formatNumberValue(raw?.speed, '<invalid-speed>');
    const start = resolved
        ? resolved.start
        : raw?.start === undefined
            ? 'running_loop'
            : isNpcPatrolStart(raw.start)
                ? raw.start
                : '<invalid-start>';
    return `${NPC_PATROL_PING_PONG_COMMAND_TYPE} axis=${axis} distance=${distance} speed=${speed} start=${start}`;
};

export const NPC_LOGIC_COMMAND_DEFINITIONS: readonly LogicCommandDefinition[] = [
    {
        type: NPC_PATROL_PING_PONG_COMMAND_TYPE,
        label: 'NPC Patrol Ping-Pong',
        description: 'NPC autonomous patrol runtime v1 (horizontal/vertical ping-pong from authored origin).',
        domain: 'npc',
        supportedAssignmentKinds: ['npc'],
        supportedScriptCategories: ['npc.patrol'],
        eventRuntimeSupported: false,
        readOnlyDisplay: {
            summaryTemplate: 'npc_patrol_ping_pong axis=<horizontal|vertical> distance=<number> speed=<number> start=<running_loop|stopped>'
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
        previewBehaviorNote: 'npc_patrol_ping_pong is a runtime NPC behavior command; authoring preview is deferred.',
        runtimeSupportedSlots: ['npc.behaviorScripts.patrol'],
        validateParams: validateNpcPatrolPingPongParams,
        formatDisplay: getNpcPatrolPingPongDisplay
    }
] as const;
