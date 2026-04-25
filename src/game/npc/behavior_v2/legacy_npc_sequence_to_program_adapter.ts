import type {
    ActorProgram,
    ActorProgramActionNode,
    ActorProgramEmitEventNode,
    ActorProgramNode,
    ActorProgramWaitNode
} from '../../authoring/programs/actor_program_types';
import type { TestNpcScriptedSequenceDefinition } from '../npc_scripted_sequences';

export interface LegacyNpcSequenceAdapterIssue {
    readonly severity: 'warning' | 'info';
    readonly code: string;
    readonly message: string;
    readonly path?: string;
}

export interface LegacyNpcSequenceToProgramResult {
    readonly program: ActorProgram;
    readonly issues: readonly LegacyNpcSequenceAdapterIssue[];
}

const FALLBACK_PROGRAM_ID = 'legacy_npc_sequence';

export const adaptLegacyNpcSequenceToActorProgram = (
    sequence: TestNpcScriptedSequenceDefinition
): LegacyNpcSequenceToProgramResult => {
    const issues: LegacyNpcSequenceAdapterIssue[] = [];
    const programId = normalizeProgramId(sequence.id);
    const rawActions: readonly unknown[] = Array.isArray(sequence.actions) ? sequence.actions : [];

    const children: ActorProgramNode[] = rawActions.map((action, index) => {
        const node = mapLegacyActionToNode(action, programId, index, issues);
        return node ?? createUnsupportedStepNode(action, programId, index, issues);
    });

    const program: ActorProgram = {
        id: programId,
        root: {
            kind: 'sequence',
            id: `${programId}.root`,
            children
        }
    };

    return {
        program,
        issues
    };
};

const normalizeProgramId = (inputId: unknown): string => {
    if (typeof inputId !== 'string') {
        return FALLBACK_PROGRAM_ID;
    }
    const normalizedId = inputId.trim();
    return normalizedId.length > 0 ? normalizedId : FALLBACK_PROGRAM_ID;
};

const mapLegacyActionToNode = (
    action: unknown,
    programId: string,
    index: number,
    issues: LegacyNpcSequenceAdapterIssue[]
): ActorProgramNode | null => {
    if (!isRecord(action) || typeof action.kind !== 'string') {
        return null;
    }

    const nodeId = `${programId}.step.${index}`;
    if (action.kind === 'wait') {
        return mapWaitStep(action, nodeId);
    }
    if (action.kind === 'face') {
        return mapFaceStep(action, nodeId);
    }
    if (action.kind === 'walk_to_x') {
        return mapWalkToXStep(action, nodeId);
    }
    if (action.kind === 'play_animation') {
        return mapPlayAnimationStep(action, nodeId);
    }
    if (action.kind === 'trigger_event') {
        return mapTriggerEventStep(action, nodeId, issues, index);
    }
    return null;
};

const mapWaitStep = (action: Readonly<Record<string, unknown>>, nodeId: string): ActorProgramWaitNode | null => {
    const durationMs = action.durationMs;
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
        return null;
    }
    return {
        kind: 'wait',
        id: nodeId,
        durationMs: Math.max(0, durationMs)
    };
};

const mapFaceStep = (action: Readonly<Record<string, unknown>>, nodeId: string): ActorProgramActionNode | null => {
    const facing = action.facing;
    if (facing === -1) {
        return {
            kind: 'action',
            id: nodeId,
            actionType: 'actor.face_left'
        };
    }
    if (facing === 1) {
        return {
            kind: 'action',
            id: nodeId,
            actionType: 'actor.face_right'
        };
    }
    return null;
};

const mapWalkToXStep = (action: Readonly<Record<string, unknown>>, nodeId: string): ActorProgramActionNode | null => {
    const x = action.targetX;
    const speed = action.moveSpeed;
    const tolerancePx = action.tolerancePx;
    if (
        typeof x !== 'number' ||
        !Number.isFinite(x) ||
        typeof speed !== 'number' ||
        !Number.isFinite(speed) ||
        typeof tolerancePx !== 'number' ||
        !Number.isFinite(tolerancePx)
    ) {
        return null;
    }
    return {
        kind: 'action',
        id: nodeId,
        actionType: 'actor.move_to_x',
        params: {
            x,
            speed: Math.max(0, speed),
            tolerancePx: Math.max(0, tolerancePx)
        }
    };
};

const mapPlayAnimationStep = (
    action: Readonly<Record<string, unknown>>,
    nodeId: string
): ActorProgramActionNode | null => {
    const animationId = typeof action.animationId === 'string' ? action.animationId.trim() : '';
    if (animationId.length === 0) {
        return null;
    }
    return {
        kind: 'action',
        id: nodeId,
        actionType: 'actor.play_animation',
        params: {
            animationId
        }
    };
};

const mapTriggerEventStep = (
    action: Readonly<Record<string, unknown>>,
    nodeId: string,
    issues: LegacyNpcSequenceAdapterIssue[],
    index: number
): ActorProgramEmitEventNode | null => {
    const eventId = typeof action.eventId === 'string' ? action.eventId.trim() : '';
    if (eventId.length === 0) {
        issues.push({
            severity: 'warning',
            code: 'unsupported_legacy_npc_sequence_step',
            message: 'trigger_event step is missing eventId and was converted to fallback emit_event.',
            path: `actions[${index}]`
        });
        return null;
    }

    return {
        kind: 'emit_event',
        id: nodeId,
        eventId,
        payload: cloneRecordOrUndefined(action.payload)
    };
};

const createUnsupportedStepNode = (
    action: unknown,
    programId: string,
    index: number,
    issues: LegacyNpcSequenceAdapterIssue[]
): ActorProgramEmitEventNode => {
    const description = describeLegacyStep(action);
    issues.push({
        severity: 'warning',
        code: 'unsupported_legacy_npc_sequence_step',
        message: `Unsupported legacy NPC sequence step at actions[${index}]: ${description}.`,
        path: `actions[${index}]`
    });

    return {
        kind: 'emit_event',
        id: `${programId}.step.${index}`,
        eventId: 'legacy.unsupported_npc_sequence_step',
        payload: {
            step: description
        }
    };
};

const describeLegacyStep = (action: unknown): string => {
    if (!isRecord(action)) {
        return 'non_object_step';
    }
    if (typeof action.kind === 'string' && action.kind.trim().length > 0) {
        return `kind:${action.kind.trim()}`;
    }
    return 'missing_kind';
};

const cloneRecordOrUndefined = (value: unknown): Readonly<Record<string, unknown>> | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }
    return { ...value };
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
