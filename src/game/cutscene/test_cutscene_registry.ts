import cutscenesJson from './data/test_cutscenes.json';
import type { TestCutsceneDefinition, TestCutsceneStep } from './cutscene_types';

export interface TestCutsceneValidationIssue {
    path: string;
    message: string;
}

const TEST_CUTSCENE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

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

const normalizeStep = (
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
        return { kind, ref, actorId };
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
        const actorId = asTrimmedString(raw.actorId) ?? undefined;
        const x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : undefined;
        const y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : undefined;
        return { kind, ref, vfxId, actorId, x, y };
    }
    if (kind === 'subtitle') {
        const text = asTrimmedString(raw.text);
        if (!text) {
            issues.push({ path: `${path}.text`, message: 'subtitle.text must be a non-empty string' });
            return null;
        }
        const durationMs = typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs) && raw.durationMs >= 0
            ? raw.durationMs
            : undefined;
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

    issues.push({
        path: `${path}.kind`,
        message: `unsupported cutscene step kind "${String(kind ?? 'unknown')}"`
    });
    return null;
};

const normalizeDefinitions = (
    input: unknown
): { definitions: readonly TestCutsceneDefinition[] | null; issues: readonly TestCutsceneValidationIssue[] } => {
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
        if (!id || !TEST_CUTSCENE_ID_PATTERN.test(id)) {
            issues.push({ path: `${path}.id`, message: 'cutscene id must use lowercase snake_case' });
            return;
        }
        if (seenIds.has(id)) {
            issues.push({ path: `${path}.id`, message: `duplicate cutscene id "${id}"` });
            return;
        }
        seenIds.add(id);

        const mode = raw.mode === 'overlay' ? 'overlay' : 'in_level';
        if (!Array.isArray(raw.steps) || raw.steps.length <= 0) {
            issues.push({ path: `${path}.steps`, message: 'cutscene must contain at least one step' });
            return;
        }

        const steps = raw.steps
            .map((step, stepIndex) => normalizeStep(step, `${path}.steps[${stepIndex}]`, issues))
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

const resolveDefaultDefinitions = (): readonly TestCutsceneDefinition[] => {
    const normalized = normalizeDefinitions(cutscenesJson);
    if (normalized.definitions === null) {
        const summary = normalized.issues.map((issue) => `${issue.path || 'root'}: ${issue.message}`).join('; ');
        throw new Error(`Invalid default cutscene registry: ${summary}`);
    }
    return normalized.definitions.map(cloneDefinition);
};

const defaultDefinitions = resolveDefaultDefinitions();
const cutsceneMap = new Map(defaultDefinitions.map((entry) => [entry.id, entry] as const));

export const getTestCutsceneDefinition = (cutsceneRef: string): TestCutsceneDefinition | null => {
    const definition = cutsceneMap.get(cutsceneRef);
    return definition ? cloneDefinition(definition) : null;
};

export const getTestCutsceneRefs = (): readonly string[] => {
    return defaultDefinitions.map((entry) => entry.id);
};

export const isTestCutsceneRef = (cutsceneRef: string): boolean => {
    return cutsceneMap.has(cutsceneRef);
};
