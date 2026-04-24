import cutscenesJson from './data/test_cutscenes.json';
import type { TestCutsceneDefinition, TestCutsceneStep } from './cutscene_types';

export interface TestCutsceneValidationIssue {
    path: string;
    message: string;
}

export interface NormalizeTestCutsceneDefinitionsResult {
    definitions: readonly TestCutsceneDefinition[] | null;
    issues: readonly TestCutsceneValidationIssue[];
}

export interface ParseTestCutsceneDefinitionsResult {
    definitions: readonly TestCutsceneDefinition[] | null;
    issues: readonly TestCutsceneValidationIssue[];
    error: string | null;
}

export interface TestCutsceneRegistryAuditSnapshot {
    registrySource: string;
    defaultCutsceneCount: number;
    defaultCutsceneIds: readonly string[];
    moduleInitDefaultCutsceneCount: number;
    moduleInitDefaultCutsceneIds: readonly string[];
    liveCutsceneCount: number;
    liveCutsceneIds: readonly string[];
}

export const TEST_CUTSCENE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
export const TEST_CUTSCENE_STEP_KINDS = [
    'lock_input',
    'unlock_input',
    'camera_focus_actor',
    'camera_pan_to',
    'wait',
    'play_sfx',
    'spawn_vfx',
    'subtitle',
    'actor_sequence_ref',
    'set_emotion'
] as const;

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

const cloneStep = (step: TestCutsceneStep): TestCutsceneStep => {
    return { ...step };
};

const cloneDefinition = (definition: TestCutsceneDefinition): TestCutsceneDefinition => {
    return {
        id: definition.id,
        mode: definition.mode,
        steps: definition.steps.map(cloneStep)
    };
};

const cloneDefinitions = (
    definitions: readonly TestCutsceneDefinition[]
): readonly TestCutsceneDefinition[] => {
    return definitions.map(cloneDefinition);
};

export const validateTestCutsceneId = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return 'cutscene id must not be empty';
    }
    if (!TEST_CUTSCENE_ID_PATTERN.test(trimmed)) {
        return 'cutscene id must use lowercase snake_case';
    }
    return null;
};

const normalizeStepFromUnknown = (
    value: unknown,
    path: string,
    issues: TestCutsceneValidationIssue[]
): TestCutsceneStep | null => {
    const raw = asObject(value);
    if (!raw) {
        issues.push({ path, message: 'step must be an object' });
        return null;
    }

    const ref = asTrimmedString(raw.ref) ?? undefined;
    const kind = raw.kind;
    if (kind === 'lock_input' || kind === 'unlock_input') {
        return { kind, ref };
    }
    if (kind === 'camera_focus_actor') {
        const actorId = asTrimmedString(raw.actorId);
        if (!actorId) {
            issues.push({ path: `${path}.actorId`, message: 'camera_focus_actor.actorId must be a non-empty string' });
            return null;
        }
        if (
            raw.durationMs !== undefined
            && (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0)
        ) {
            issues.push({ path: `${path}.durationMs`, message: 'camera_focus_actor.durationMs must be a finite number >= 0' });
            return null;
        }
        if (
            raw.tolerancePx !== undefined
            && (typeof raw.tolerancePx !== 'number' || !Number.isFinite(raw.tolerancePx) || raw.tolerancePx <= 0)
        ) {
            issues.push({ path: `${path}.tolerancePx`, message: 'camera_focus_actor.tolerancePx must be a finite number > 0' });
            return null;
        }
        const ease = asTrimmedString(raw.ease) ?? undefined;
        const durationMs = typeof raw.durationMs === 'number' ? raw.durationMs : undefined;
        const tolerancePx = typeof raw.tolerancePx === 'number' ? raw.tolerancePx : undefined;
        return { kind, ref, actorId, durationMs, ease, tolerancePx };
    }
    if (kind === 'camera_pan_to') {
        if (typeof raw.x !== 'number' || !Number.isFinite(raw.x)) {
            issues.push({ path: `${path}.x`, message: 'camera_pan_to.x must be a finite number' });
            return null;
        }
        if (typeof raw.y !== 'number' || !Number.isFinite(raw.y)) {
            issues.push({ path: `${path}.y`, message: 'camera_pan_to.y must be a finite number' });
            return null;
        }
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0) {
            issues.push({ path: `${path}.durationMs`, message: 'camera_pan_to.durationMs must be a finite number >= 0' });
            return null;
        }
        const ease = asTrimmedString(raw.ease) ?? undefined;
        return { kind, ref, x: raw.x, y: raw.y, durationMs: raw.durationMs, ease };
    }
    if (kind === 'wait') {
        if (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0) {
            issues.push({ path: `${path}.durationMs`, message: 'wait.durationMs must be a finite number >= 0' });
            return null;
        }
        return { kind, ref, durationMs: raw.durationMs };
    }
    if (kind === 'play_sfx') {
        const sfxId = asTrimmedString(raw.sfxId);
        if (!sfxId) {
            issues.push({ path: `${path}.sfxId`, message: 'play_sfx.sfxId must be a non-empty string' });
            return null;
        }
        return { kind, ref, sfxId };
    }
    if (kind === 'spawn_vfx') {
        const vfxId = asTrimmedString(raw.vfxId);
        if (!vfxId) {
            issues.push({ path: `${path}.vfxId`, message: 'spawn_vfx.vfxId must be a non-empty string' });
            return null;
        }
        if (raw.x !== undefined && (typeof raw.x !== 'number' || !Number.isFinite(raw.x))) {
            issues.push({ path: `${path}.x`, message: 'spawn_vfx.x must be a finite number when present' });
            return null;
        }
        if (raw.y !== undefined && (typeof raw.y !== 'number' || !Number.isFinite(raw.y))) {
            issues.push({ path: `${path}.y`, message: 'spawn_vfx.y must be a finite number when present' });
            return null;
        }
        const actorId = asTrimmedString(raw.actorId) ?? undefined;
        const x = typeof raw.x === 'number' ? raw.x : undefined;
        const y = typeof raw.y === 'number' ? raw.y : undefined;
        return { kind, ref, vfxId, actorId, x, y };
    }
    if (kind === 'subtitle') {
        const text = asTrimmedString(raw.text);
        if (!text) {
            issues.push({ path: `${path}.text`, message: 'subtitle.text must be a non-empty string' });
            return null;
        }
        if (
            raw.durationMs !== undefined
            && (typeof raw.durationMs !== 'number' || !Number.isFinite(raw.durationMs) || raw.durationMs < 0)
        ) {
            issues.push({ path: `${path}.durationMs`, message: 'subtitle.durationMs must be a finite number >= 0 when present' });
            return null;
        }
        const durationMs = typeof raw.durationMs === 'number' ? raw.durationMs : undefined;
        return { kind, ref, text, durationMs };
    }
    if (kind === 'actor_sequence_ref') {
        const actorId = asTrimmedString(raw.actorId);
        if (!actorId) {
            issues.push({ path: `${path}.actorId`, message: 'actor_sequence_ref.actorId must be a non-empty string' });
            return null;
        }
        const sequenceRef = asTrimmedString(raw.sequenceRef);
        if (!sequenceRef) {
            issues.push({ path: `${path}.sequenceRef`, message: 'actor_sequence_ref.sequenceRef must be a non-empty string' });
            return null;
        }
        return { kind, ref, actorId, sequenceRef };
    }
    if (kind === 'set_emotion') {
        const actorId = asTrimmedString(raw.actorId);
        if (!actorId) {
            issues.push({ path: `${path}.actorId`, message: 'set_emotion.actorId must be a non-empty string' });
            return null;
        }
        const emotionId = asTrimmedString(raw.emotionId);
        if (!emotionId) {
            issues.push({ path: `${path}.emotionId`, message: 'set_emotion.emotionId must be a non-empty string' });
            return null;
        }
        return { kind, ref, actorId, emotionId };
    }

    issues.push({
        path: `${path}.kind`,
        message: `unsupported cutscene step kind "${String(kind ?? 'unknown')}"`
    });
    return null;
};

const normalizeDefinitionsFromUnknown = (
    input: unknown
): NormalizeTestCutsceneDefinitionsResult => {
    if (!Array.isArray(input)) {
        return {
            definitions: null,
            issues: [{ path: '', message: 'cutscene registry must be an array' }]
        };
    }

    const issues: TestCutsceneValidationIssue[] = [];
    const definitions: TestCutsceneDefinition[] = [];
    const seenIds = new Set<string>();

    input.forEach((entry, index) => {
        const path = `[${index}]`;
        const raw = asObject(entry);
        if (!raw) {
            issues.push({ path, message: 'cutscene entry must be an object' });
            return;
        }

        const id = asTrimmedString(raw.id);
        if (!id) {
            issues.push({ path: `${path}.id`, message: 'cutscene id must not be empty' });
            return;
        }
        const idIssue = validateTestCutsceneId(id);
        if (idIssue) {
            issues.push({ path: `${path}.id`, message: idIssue });
            return;
        }
        if (seenIds.has(id)) {
            issues.push({ path: `${path}.id`, message: `duplicate cutscene id "${id}"` });
            return;
        }
        seenIds.add(id);

        let mode: 'in_level' | 'overlay';
        if (raw.mode === 'in_level' || raw.mode === 'overlay') {
            mode = raw.mode;
        } else {
            issues.push({ path: `${path}.mode`, message: 'cutscene mode must be "in_level" or "overlay"' });
            return;
        }
        if (!Array.isArray(raw.steps) || raw.steps.length <= 0) {
            issues.push({ path: `${path}.steps`, message: 'cutscene must contain at least one step' });
            return;
        }

        const steps = raw.steps
            .map((step, stepIndex) => normalizeStepFromUnknown(step, `${path}.steps[${stepIndex}]`, issues))
            .filter((step): step is TestCutsceneStep => step !== null);
        if (steps.length !== raw.steps.length) {
            return;
        }

        definitions.push({
            id,
            mode,
            steps
        });
    });

    return {
        definitions: issues.length > 0 ? null : definitions,
        issues
    };
};

export const validateTestCutsceneDefinitions = (
    definitions: readonly TestCutsceneDefinition[]
): readonly TestCutsceneValidationIssue[] => {
    const normalized = normalizeDefinitionsFromUnknown(cloneDefinitions(definitions));
    return normalized.issues;
};

export const normalizeTestCutsceneDefinitions = (
    input: unknown
): NormalizeTestCutsceneDefinitionsResult => {
    return normalizeDefinitionsFromUnknown(input);
};

export const parseTestCutsceneDefinitionsJson = (
    jsonText: string
): ParseTestCutsceneDefinitionsResult => {
    try {
        const parsed = JSON.parse(jsonText) as unknown;
        const normalized = normalizeDefinitionsFromUnknown(parsed);
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

const resolveDefaultDefinitions = (): readonly TestCutsceneDefinition[] => {
    const normalized = normalizeDefinitionsFromUnknown(cutscenesJson);
    if (normalized.definitions === null) {
        const summary = normalized.issues.map((issue) => `${issue.path || 'root'}: ${issue.message}`).join('; ');
        throw new Error(`Invalid default cutscene registry: ${summary}`);
    }
    return cloneDefinitions(normalized.definitions);
};

const MODULE_INIT_DEFAULT_CUTSCENE_DEFINITIONS = resolveDefaultDefinitions();

let cutsceneDefinitions: readonly TestCutsceneDefinition[] = cloneDefinitions(MODULE_INIT_DEFAULT_CUTSCENE_DEFINITIONS);
let cutsceneMap = new Map(cutsceneDefinitions.map((entry) => [entry.id, entry] as const));
let cutsceneRegistrySource = 'module_init_default';

const commitDefinitions = (
    definitions: readonly TestCutsceneDefinition[],
    source: string
): readonly TestCutsceneDefinition[] => {
    cutsceneDefinitions = cloneDefinitions(definitions);
    cutsceneMap = new Map(cutsceneDefinitions.map((entry) => [entry.id, entry] as const));
    cutsceneRegistrySource = source;
    return cutsceneDefinitions;
};

export const getDefaultTestCutsceneDefinitions = (): readonly TestCutsceneDefinition[] => {
    return resolveDefaultDefinitions();
};

export const setTestCutsceneDefinitions = (
    definitions: readonly TestCutsceneDefinition[],
    source: string = 'set_definitions'
): NormalizeTestCutsceneDefinitionsResult => {
    const normalized = normalizeDefinitionsFromUnknown(cloneDefinitions(definitions));
    if (normalized.definitions === null) {
        return {
            definitions: null,
            issues: normalized.issues
        };
    }
    return {
        definitions: commitDefinitions(normalized.definitions, source),
        issues: []
    };
};

export const resetTestCutsceneDefinitions = (): readonly TestCutsceneDefinition[] => {
    return commitDefinitions(resolveDefaultDefinitions(), 'reset_default_from_source');
};

export const getTestCutsceneDefinitions = (): readonly TestCutsceneDefinition[] => {
    return cloneDefinitions(cutsceneDefinitions);
};

export const getTestCutsceneRegistryAuditSnapshot = (): TestCutsceneRegistryAuditSnapshot => {
    const defaultDefinitions = resolveDefaultDefinitions();
    return {
        registrySource: cutsceneRegistrySource,
        defaultCutsceneCount: defaultDefinitions.length,
        defaultCutsceneIds: defaultDefinitions.map((entry) => entry.id),
        moduleInitDefaultCutsceneCount: MODULE_INIT_DEFAULT_CUTSCENE_DEFINITIONS.length,
        moduleInitDefaultCutsceneIds: MODULE_INIT_DEFAULT_CUTSCENE_DEFINITIONS.map((entry) => entry.id),
        liveCutsceneCount: cutsceneDefinitions.length,
        liveCutsceneIds: cutsceneDefinitions.map((entry) => entry.id)
    };
};

export const getTestCutsceneDefinition = (cutsceneRef: string): TestCutsceneDefinition | null => {
    const definition = cutsceneMap.get(cutsceneRef);
    return definition ? cloneDefinition(definition) : null;
};

export const getTestCutsceneRefs = (): readonly string[] => {
    return cutsceneDefinitions.map((entry) => entry.id);
};

export const isTestCutsceneRef = (cutsceneRef: string): boolean => {
    return cutsceneMap.has(cutsceneRef);
};
