import type { ActorAction, ActorActionSequence } from '../actor_actions/actor_action_types';
import scriptedSequencesJson from './data/test_npc_scripted_sequences.json';

export const NPC_SCRIPTED_SEQUENCE_SOURCE = 'npc_scripted_sequence_ref';
export const TEST_NPC_SCRIPTED_SEQUENCE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
export const TEST_NPC_SCRIPTED_SEQUENCE_ACTION_KINDS = [
    'wait',
    'face',
    'walk_to_x',
    'play_animation',
    'set_emotion',
    'trigger_event'
] as const;

export type TestNpcScriptedSequenceActionKind = typeof TEST_NPC_SCRIPTED_SEQUENCE_ACTION_KINDS[number];

export interface TestNpcScriptedSequenceDefinition {
    id: string;
    actions: readonly ActorAction[];
}

export interface TestNpcScriptedSequenceValidationIssue {
    path: string;
    message: string;
}

export interface NormalizeTestNpcScriptedSequenceDefinitionsResult {
    definitions: readonly TestNpcScriptedSequenceDefinition[] | null;
    issues: readonly TestNpcScriptedSequenceValidationIssue[];
}

export interface ParseTestNpcScriptedSequenceDefinitionsResult {
    definitions: readonly TestNpcScriptedSequenceDefinition[] | null;
    issues: readonly TestNpcScriptedSequenceValidationIssue[];
    error: string | null;
}

export interface TestNpcScriptedSequenceRegistryAuditSnapshot {
    registrySource: string;
    defaultSequenceCount: number;
    defaultSequenceIds: readonly string[];
    moduleInitDefaultSequenceCount: number;
    moduleInitDefaultSequenceIds: readonly string[];
    liveSequenceCount: number;
    liveSequenceIds: readonly string[];
}

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

const asTrimmedString = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
};

const clonePayload = (payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    return payload ? { ...payload } : undefined;
};

export const cloneTestNpcScriptedSequenceAction = (action: ActorAction): ActorAction => {
    if (action.kind === 'trigger_event') {
        return {
            ...action,
            payload: clonePayload(action.payload)
        };
    }

    return { ...action };
};

export const cloneTestNpcScriptedSequenceDefinition = (
    definition: TestNpcScriptedSequenceDefinition
): TestNpcScriptedSequenceDefinition => {
    return {
        id: definition.id,
        actions: definition.actions.map(cloneTestNpcScriptedSequenceAction)
    };
};

const cloneDefinitions = (
    definitions: readonly TestNpcScriptedSequenceDefinition[]
): readonly TestNpcScriptedSequenceDefinition[] => {
    return definitions.map(cloneTestNpcScriptedSequenceDefinition);
};

export const validateTestNpcScriptedSequenceId = (
    value: string
): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return 'sequence id must not be empty';
    }
    if (!TEST_NPC_SCRIPTED_SEQUENCE_ID_PATTERN.test(trimmed)) {
        return 'sequence id must use lowercase snake_case';
    }
    return null;
};

const validateTypedActorAction = (
    action: ActorAction,
    path: string
): readonly TestNpcScriptedSequenceValidationIssue[] => {
    const issues: TestNpcScriptedSequenceValidationIssue[] = [];
    if (action.ref !== undefined && (typeof action.ref !== 'string' || action.ref.trim().length === 0)) {
        issues.push({
            path: `${path}.ref`,
            message: 'action ref must be a non-empty string when present'
        });
    }

    if (action.kind === 'wait') {
        if (!Number.isFinite(action.durationMs) || action.durationMs < 0) {
            issues.push({
                path: `${path}.durationMs`,
                message: 'wait.durationMs must be a finite number >= 0'
            });
        }
        return issues;
    }
    if (action.kind === 'face') {
        if (action.facing !== -1 && action.facing !== 1) {
            issues.push({
                path: `${path}.facing`,
                message: 'face.facing must be -1 or 1'
            });
        }
        return issues;
    }
    if (action.kind === 'walk_to_x') {
        if (!Number.isFinite(action.targetX)) {
            issues.push({
                path: `${path}.targetX`,
                message: 'walk_to_x.targetX must be a finite number'
            });
        }
        if (!Number.isFinite(action.moveSpeed) || action.moveSpeed < 0) {
            issues.push({
                path: `${path}.moveSpeed`,
                message: 'walk_to_x.moveSpeed must be a finite number >= 0'
            });
        }
        if (!Number.isFinite(action.tolerancePx) || action.tolerancePx < 0) {
            issues.push({
                path: `${path}.tolerancePx`,
                message: 'walk_to_x.tolerancePx must be a finite number >= 0'
            });
        }
        return issues;
    }
    if (action.kind === 'play_animation') {
        if (action.animationId.trim().length === 0) {
            issues.push({
                path: `${path}.animationId`,
                message: 'play_animation.animationId must be a non-empty string'
            });
        }
        return issues;
    }
    if (action.kind === 'set_emotion') {
        if (action.emotionId.trim().length === 0) {
            issues.push({
                path: `${path}.emotionId`,
                message: 'set_emotion.emotionId must be a non-empty string'
            });
        }
        return issues;
    }
    if (action.eventId.trim().length === 0) {
        issues.push({
            path: `${path}.eventId`,
            message: 'trigger_event.eventId must be a non-empty string'
        });
    }
    if (action.payload !== undefined && asObject(action.payload) === null) {
        issues.push({
            path: `${path}.payload`,
            message: 'trigger_event.payload must be an object when present'
        });
    }
    return issues;
};

export const validateTestNpcScriptedSequenceDefinitions = (
    definitions: readonly TestNpcScriptedSequenceDefinition[]
): readonly TestNpcScriptedSequenceValidationIssue[] => {
    const issues: TestNpcScriptedSequenceValidationIssue[] = [];
    const seenIds = new Set<string>();

    definitions.forEach((definition, definitionIndex) => {
        const path = `[${definitionIndex}]`;
        const idIssue = validateTestNpcScriptedSequenceId(definition.id);
        if (idIssue) {
            issues.push({
                path: `${path}.id`,
                message: idIssue
            });
        } else if (seenIds.has(definition.id)) {
            issues.push({
                path: `${path}.id`,
                message: `duplicate sequence id "${definition.id}"`
            });
        } else {
            seenIds.add(definition.id);
        }

        if (!Array.isArray(definition.actions) || definition.actions.length === 0) {
            issues.push({
                path: `${path}.actions`,
                message: 'sequence must contain at least one action'
            });
            return;
        }

        definition.actions.forEach((action, actionIndex) => {
            issues.push(...validateTypedActorAction(action, `${path}.actions[${actionIndex}]`));
        });
    });

    return issues;
};

const normalizeActorActionFromUnknown = (
    value: unknown,
    path: string,
    issues: TestNpcScriptedSequenceValidationIssue[]
): ActorAction | null => {
    const raw = asObject(value);
    if (!raw) {
        issues.push({
            path,
            message: 'action must be an object'
        });
        return null;
    }

    const ref = asTrimmedString(raw.ref) ?? undefined;
    if (raw.ref !== undefined && ref === undefined) {
        issues.push({
            path: `${path}.ref`,
            message: 'action ref must be a non-empty string when present'
        });
    }

    if (raw.kind === 'wait') {
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0) {
            issues.push({
                path: `${path}.durationMs`,
                message: 'wait.durationMs must be a finite number >= 0'
            });
            return null;
        }
        return {
            kind: 'wait',
            ref,
            durationMs: raw.durationMs
        };
    }

    if (raw.kind === 'face') {
        if (raw.facing !== -1 && raw.facing !== 1) {
            issues.push({
                path: `${path}.facing`,
                message: 'face.facing must be -1 or 1'
            });
            return null;
        }
        return {
            kind: 'face',
            ref,
            facing: raw.facing
        };
    }

    if (raw.kind === 'walk_to_x') {
        if (typeof raw.targetX !== 'number' || !Number.isFinite(raw.targetX)) {
            issues.push({
                path: `${path}.targetX`,
                message: 'walk_to_x.targetX must be a finite number'
            });
            return null;
        }
        if (typeof raw.moveSpeed !== 'number' || !Number.isFinite(raw.moveSpeed) || raw.moveSpeed < 0) {
            issues.push({
                path: `${path}.moveSpeed`,
                message: 'walk_to_x.moveSpeed must be a finite number >= 0'
            });
            return null;
        }
        if (typeof raw.tolerancePx !== 'number' || !Number.isFinite(raw.tolerancePx) || raw.tolerancePx < 0) {
            issues.push({
                path: `${path}.tolerancePx`,
                message: 'walk_to_x.tolerancePx must be a finite number >= 0'
            });
            return null;
        }
        return {
            kind: 'walk_to_x',
            ref,
            targetX: raw.targetX,
            moveSpeed: raw.moveSpeed,
            tolerancePx: raw.tolerancePx
        };
    }

    if (raw.kind === 'play_animation') {
        const animationId = asTrimmedString(raw.animationId);
        if (!animationId) {
            issues.push({
                path: `${path}.animationId`,
                message: 'play_animation.animationId must be a non-empty string'
            });
            return null;
        }
        return {
            kind: 'play_animation',
            ref,
            animationId
        };
    }

    if (raw.kind === 'set_emotion') {
        const emotionId = asTrimmedString(raw.emotionId);
        if (!emotionId) {
            issues.push({
                path: `${path}.emotionId`,
                message: 'set_emotion.emotionId must be a non-empty string'
            });
            return null;
        }
        return {
            kind: 'set_emotion',
            ref,
            emotionId
        };
    }

    if (raw.kind === 'trigger_event') {
        const eventId = asTrimmedString(raw.eventId);
        if (!eventId) {
            issues.push({
                path: `${path}.eventId`,
                message: 'trigger_event.eventId must be a non-empty string'
            });
            return null;
        }
        const payload = raw.payload === undefined ? undefined : asObject(raw.payload);
        if (raw.payload !== undefined && payload === null) {
            issues.push({
                path: `${path}.payload`,
                message: 'trigger_event.payload must be an object when present'
            });
            return null;
        }
        return {
            kind: 'trigger_event',
            ref,
            eventId,
            payload: payload ? { ...payload } : undefined
        };
    }

    issues.push({
        path: `${path}.kind`,
        message: `unsupported action kind "${String(raw.kind ?? 'unknown')}"`
    });
    return null;
};

export const normalizeTestNpcScriptedSequenceDefinitions = (
    input: unknown
): NormalizeTestNpcScriptedSequenceDefinitionsResult => {
    if (!Array.isArray(input)) {
        return {
            definitions: null,
            issues: [{
                path: '',
                message: 'scripted sequence registry must be an array'
            }]
        };
    }

    const issues: TestNpcScriptedSequenceValidationIssue[] = [];
    const definitions: TestNpcScriptedSequenceDefinition[] = [];
    const seenIds = new Set<string>();

    input.forEach((entry, definitionIndex) => {
        const raw = asObject(entry);
        const path = `[${definitionIndex}]`;
        if (!raw) {
            issues.push({
                path,
                message: 'sequence entry must be an object'
            });
            return;
        }

        const id = asTrimmedString(raw.id);
        if (!id) {
            issues.push({
                path: `${path}.id`,
                message: 'sequence id must not be empty'
            });
            return;
        }

        const idIssue = validateTestNpcScriptedSequenceId(id);
        if (idIssue) {
            issues.push({
                path: `${path}.id`,
                message: idIssue
            });
            return;
        }
        if (seenIds.has(id)) {
            issues.push({
                path: `${path}.id`,
                message: `duplicate sequence id "${id}"`
            });
            return;
        }
        seenIds.add(id);

        if (!Array.isArray(raw.actions) || raw.actions.length === 0) {
            issues.push({
                path: `${path}.actions`,
                message: 'sequence must contain at least one action'
            });
            return;
        }

        const actions = raw.actions
            .map((actionEntry, actionIndex) => normalizeActorActionFromUnknown(
                actionEntry,
                `${path}.actions[${actionIndex}]`,
                issues
            ))
            .filter((action): action is ActorAction => action !== null);

        if (actions.length !== raw.actions.length) {
            return;
        }

        definitions.push({
            id,
            actions
        });
    });

    return {
        definitions: issues.length > 0 ? null : definitions,
        issues
    };
};

export const parseTestNpcScriptedSequenceDefinitionsJson = (
    jsonText: string
): ParseTestNpcScriptedSequenceDefinitionsResult => {
    try {
        const parsed = JSON.parse(jsonText) as unknown;
        const normalized = normalizeTestNpcScriptedSequenceDefinitions(parsed);
        return {
            definitions: normalized.definitions,
            issues: normalized.issues,
            error: normalized.issues.length > 0
                ? normalized.issues.map((issue) => `${issue.path || 'root'}: ${issue.message}`).join('; ')
                : null
        };
    } catch (error) {
        return {
            definitions: null,
            issues: [],
            error: error instanceof Error ? error.message : 'invalid json'
        };
    }
};

const resolveDefaultDefinitionsFromSource = (): readonly TestNpcScriptedSequenceDefinition[] => {
    const normalized = normalizeTestNpcScriptedSequenceDefinitions(scriptedSequencesJson);
    if (normalized.definitions === null) {
        const summary = normalized.issues
            .map((issue) => `${issue.path || 'root'}: ${issue.message}`)
            .join('; ');
        throw new Error(`Invalid default NPC scripted sequence registry: ${summary}`);
    }

    return cloneDefinitions(normalized.definitions);
};

const MODULE_INIT_DEFAULT_SCRIPTED_SEQUENCE_DEFINITIONS = resolveDefaultDefinitionsFromSource();

let scriptedSequenceDefinitions: readonly TestNpcScriptedSequenceDefinition[] = cloneDefinitions(MODULE_INIT_DEFAULT_SCRIPTED_SEQUENCE_DEFINITIONS);
let scriptedSequenceMap = new Map(
    scriptedSequenceDefinitions.map((entry) => [entry.id, entry] satisfies readonly [string, TestNpcScriptedSequenceDefinition])
);
let scriptedSequenceRegistrySource = 'module_init_default';

const commitDefinitions = (
    definitions: readonly TestNpcScriptedSequenceDefinition[],
    source: string
): readonly TestNpcScriptedSequenceDefinition[] => {
    scriptedSequenceDefinitions = cloneDefinitions(definitions);
    scriptedSequenceMap = new Map(
        scriptedSequenceDefinitions.map((entry) => [entry.id, entry] satisfies readonly [string, TestNpcScriptedSequenceDefinition])
    );
    scriptedSequenceRegistrySource = source;
    return scriptedSequenceDefinitions;
};

export const getDefaultTestNpcScriptedSequenceDefinitions = (): readonly TestNpcScriptedSequenceDefinition[] => {
    return resolveDefaultDefinitionsFromSource();
};

export const setTestNpcScriptedSequenceDefinitions = (
    definitions: readonly TestNpcScriptedSequenceDefinition[],
    source: string = 'set_definitions'
): NormalizeTestNpcScriptedSequenceDefinitionsResult => {
    const normalizedDefinitions = cloneDefinitions(definitions);
    const issues = validateTestNpcScriptedSequenceDefinitions(normalizedDefinitions);
    if (issues.length > 0) {
        return {
            definitions: null,
            issues
        };
    }

    return {
        definitions: commitDefinitions(normalizedDefinitions, source),
        issues: []
    };
};

export const resetTestNpcScriptedSequenceDefinitions = (): readonly TestNpcScriptedSequenceDefinition[] => {
    return commitDefinitions(resolveDefaultDefinitionsFromSource(), 'reset_default_from_source');
};

export const getTestNpcScriptedSequenceDefinitions = (): readonly TestNpcScriptedSequenceDefinition[] => {
    return cloneDefinitions(scriptedSequenceDefinitions);
};

export const getTestNpcScriptedSequenceRefs = (): readonly string[] => {
    return scriptedSequenceDefinitions.map((entry) => entry.id);
};

export const getTestNpcScriptedSequenceRegistryAuditSnapshot = (): TestNpcScriptedSequenceRegistryAuditSnapshot => {
    const defaultDefinitions = resolveDefaultDefinitionsFromSource();
    return {
        registrySource: scriptedSequenceRegistrySource,
        defaultSequenceCount: defaultDefinitions.length,
        defaultSequenceIds: defaultDefinitions.map((entry) => entry.id),
        moduleInitDefaultSequenceCount: MODULE_INIT_DEFAULT_SCRIPTED_SEQUENCE_DEFINITIONS.length,
        moduleInitDefaultSequenceIds: MODULE_INIT_DEFAULT_SCRIPTED_SEQUENCE_DEFINITIONS.map((entry) => entry.id),
        liveSequenceCount: scriptedSequenceDefinitions.length,
        liveSequenceIds: scriptedSequenceDefinitions.map((entry) => entry.id)
    };
};

export const isTestNpcScriptedSequenceRef = (sequenceRef: string): boolean => {
    return scriptedSequenceMap.has(sequenceRef);
};

export const getTestNpcScriptedSequenceDefinition = (
    sequenceRef: string
): TestNpcScriptedSequenceDefinition | null => {
    const definition = scriptedSequenceMap.get(sequenceRef);
    return definition ? cloneTestNpcScriptedSequenceDefinition(definition) : null;
};

export const resolveTestNpcScriptedSequence = (
    actorId: string,
    sequenceRef: string
): ActorActionSequence | null => {
    const definition = scriptedSequenceMap.get(sequenceRef);
    if (!definition) {
        return null;
    }

    return {
        id: `${actorId}:scripted_loop:${definition.id}`,
        source: NPC_SCRIPTED_SEQUENCE_SOURCE,
        targetRef: definition.id,
        actions: definition.actions.map(cloneTestNpcScriptedSequenceAction)
    };
};
