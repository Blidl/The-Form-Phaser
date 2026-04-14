import type { ActorAction, ActorActionSequence } from '../actor_actions/actor_action_types';
import scriptedSequencesJson from './data/test_npc_scripted_sequences.json';

export const NPC_SCRIPTED_SEQUENCE_SOURCE = 'npc_scripted_sequence_ref';

export interface TestNpcScriptedSequenceDefinition {
    id: string;
    actions: readonly ActorAction[];
}

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

const asNonEmptyString = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
};

const asActionRef = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
};

const parseActorAction = (value: unknown): ActorAction | null => {
    const raw = asObject(value);
    if (!raw) {
        return null;
    }

    const ref = asActionRef(raw.ref);
    if (raw.kind === 'wait' && typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs)) {
        return {
            kind: 'wait',
            ref,
            durationMs: Math.max(0, raw.durationMs)
        };
    }
    if (raw.kind === 'face' && (raw.facing === -1 || raw.facing === 1)) {
        return {
            kind: 'face',
            ref,
            facing: raw.facing
        };
    }
    if (
        raw.kind === 'walk_to_x'
        && typeof raw.targetX === 'number'
        && Number.isFinite(raw.targetX)
        && typeof raw.moveSpeed === 'number'
        && Number.isFinite(raw.moveSpeed)
        && typeof raw.tolerancePx === 'number'
        && Number.isFinite(raw.tolerancePx)
    ) {
        return {
            kind: 'walk_to_x',
            ref,
            targetX: raw.targetX,
            moveSpeed: Math.max(0, raw.moveSpeed),
            tolerancePx: Math.max(0, raw.tolerancePx)
        };
    }
    if (raw.kind === 'play_animation') {
        const animationId = asNonEmptyString(raw.animationId);
        if (!animationId) {
            return null;
        }
        return {
            kind: 'play_animation',
            ref,
            animationId
        };
    }
    if (raw.kind === 'set_emotion') {
        const emotionId = asNonEmptyString(raw.emotionId);
        if (!emotionId) {
            return null;
        }
        return {
            kind: 'set_emotion',
            ref,
            emotionId
        };
    }
    if (raw.kind === 'trigger_event') {
        const eventId = asNonEmptyString(raw.eventId);
        if (!eventId) {
            return null;
        }
        return {
            kind: 'trigger_event',
            ref,
            eventId,
            payload: asObject(raw.payload) ?? undefined
        };
    }

    return null;
};

const parseScriptedSequenceDefinition = (
    value: unknown,
    index: number
): TestNpcScriptedSequenceDefinition | null => {
    const raw = asObject(value);
    if (!raw) {
        return null;
    }

    const id = asNonEmptyString(raw.id) ?? `npc_scripted_sequence_${index + 1}`;
    const actionEntries = Array.isArray(raw.actions)
        ? raw.actions.map(parseActorAction).filter((entry): entry is ActorAction => entry !== null)
        : [];
    if (actionEntries.length === 0) {
        return null;
    }

    return {
        id,
        actions: actionEntries
    };
};

const SCRIPTED_SEQUENCE_DEFINITIONS = (Array.isArray(scriptedSequencesJson) ? scriptedSequencesJson : [])
    .map((entry, index) => parseScriptedSequenceDefinition(entry, index))
    .filter((entry): entry is TestNpcScriptedSequenceDefinition => entry !== null);

const SCRIPTED_SEQUENCE_MAP = new Map(
    SCRIPTED_SEQUENCE_DEFINITIONS.map((entry) => [entry.id, entry] satisfies readonly [string, TestNpcScriptedSequenceDefinition])
);

export const getTestNpcScriptedSequenceDefinitions = (): readonly TestNpcScriptedSequenceDefinition[] => {
    return SCRIPTED_SEQUENCE_DEFINITIONS;
};

export const getTestNpcScriptedSequenceRefs = (): readonly string[] => {
    return SCRIPTED_SEQUENCE_DEFINITIONS.map((entry) => entry.id);
};

export const isTestNpcScriptedSequenceRef = (sequenceRef: string): boolean => {
    return SCRIPTED_SEQUENCE_MAP.has(sequenceRef);
};

const cloneActorAction = (action: ActorAction): ActorAction => {
    if (action.kind === 'wait') {
        return { ...action };
    }
    if (action.kind === 'face') {
        return { ...action };
    }
    if (action.kind === 'walk_to_x') {
        return { ...action };
    }
    if (action.kind === 'play_animation') {
        return { ...action };
    }
    if (action.kind === 'set_emotion') {
        return { ...action };
    }
    return {
        ...action,
        payload: action.payload ? { ...action.payload } : undefined
    };
};

export const getTestNpcScriptedSequenceDefinition = (
    sequenceRef: string
): TestNpcScriptedSequenceDefinition | null => {
    return SCRIPTED_SEQUENCE_MAP.get(sequenceRef) ?? null;
};

export const resolveTestNpcScriptedSequence = (
    actorId: string,
    sequenceRef: string
): ActorActionSequence | null => {
    const definition = getTestNpcScriptedSequenceDefinition(sequenceRef);
    if (!definition) {
        return null;
    }

    return {
        id: `${actorId}:scripted_loop:${definition.id}`,
        source: NPC_SCRIPTED_SEQUENCE_SOURCE,
        targetRef: definition.id,
        actions: definition.actions.map(cloneActorAction)
    };
};
