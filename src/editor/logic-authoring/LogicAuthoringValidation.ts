import { isTestCutsceneRef } from '../../game/cutscene/test_cutscene_registry';
import type {
    TestWorldConfig,
    TestWorldLogicBindingConfig,
    TestWorldLogicBindingTargetType,
    TestWorldLogicConfig,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig,
    TestWorldLogicScriptConfig,
    TestWorldLogicScriptEditorConfig,
    TestWorldLogicScriptRefConfig
} from '../../game/world/runtime/test_world_config';

export const LOGIC_SCRIPT_CATEGORIES = new Set<TestWorldLogicScriptCategory>([
    'object.move',
    'object.rotate',
    'object.action',
    'platform.move',
    'platform.rotate',
    'platform.defaultAction',
    'platform.action',
    'npc.patrol',
    'npc.action',
    'npc.altAction',
    'cutscene.npc',
    'cutscene.camera',
    'cutscene.player',
    'cutscene.other',
    'trigger.action',
    'world.rule'
]);

export const LOGIC_BINDING_TARGET_TYPES = new Set<TestWorldLogicBindingTargetType>([
    'object',
    'npc',
    'cutscene',
    'trigger',
    'world'
]);

export interface BindingTargetValidationResult {
    valid: boolean;
    reason?: string;
    targetId?: string;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const asOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

export const asLogicScriptCategory = (value: unknown): TestWorldLogicScriptCategory | null => {
    return typeof value === 'string' && LOGIC_SCRIPT_CATEGORIES.has(value as TestWorldLogicScriptCategory)
        ? value as TestWorldLogicScriptCategory
        : null;
};

export const asLogicBindingTargetType = (value: unknown): TestWorldLogicBindingTargetType | null => {
    return typeof value === 'string' && LOGIC_BINDING_TARGET_TYPES.has(value as TestWorldLogicBindingTargetType)
        ? value as TestWorldLogicBindingTargetType
        : null;
};

export const cloneParamsObject = (params: Record<string, unknown>): Record<string, unknown> => {
    try {
        return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
    } catch {
        return { ...params };
    }
};

export const cloneLogicScriptCommand = (
    command: TestWorldLogicScriptCommandConfig
): TestWorldLogicScriptCommandConfig => {
    return {
        id: command.id,
        type: command.type,
        params: cloneParamsObject(command.params)
    };
};

export const normalizeLogicScriptCommand = (value: unknown): TestWorldLogicScriptCommandConfig | null => {
    if (!isObjectRecord(value)) {
        return null;
    }
    const id = asOptionalString(value.id);
    const type = asOptionalString(value.type);
    if (!id || !type) {
        return null;
    }
    return {
        id,
        type,
        params: isObjectRecord(value.params) ? cloneParamsObject(value.params) : {}
    };
};

export const normalizeLogicScriptEditor = (value: unknown): TestWorldLogicScriptEditorConfig | undefined => {
    if (!isObjectRecord(value)) {
        return undefined;
    }
    const rawLines = Array.isArray(value.rawLines)
        ? value.rawLines.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const hasLocked = typeof value.locked === 'boolean';
    if (rawLines.length <= 0 && !hasLocked) {
        return undefined;
    }
    return {
        rawLines: rawLines.length > 0 ? [...rawLines] : undefined,
        locked: hasLocked ? value.locked : false
    };
};

export const cloneLogicScript = (script: TestWorldLogicScriptConfig): TestWorldLogicScriptConfig => ({
    id: script.id,
    name: script.name,
    category: script.category,
    commands: script.commands.map((entry) => cloneLogicScriptCommand(entry)),
    editor: script.editor
        ? {
            rawLines: script.editor.rawLines ? [...script.editor.rawLines] : undefined,
            locked: script.editor.locked
        }
        : undefined
});

export const cloneLogicBinding = (binding: TestWorldLogicBindingConfig): TestWorldLogicBindingConfig => ({
    id: binding.id,
    targetType: binding.targetType,
    targetId: binding.targetId,
    slot: binding.slot,
    scriptId: binding.scriptId,
    enabled: binding.enabled
});

export const cloneLogicScriptRef = (scriptRef: TestWorldLogicScriptRefConfig): TestWorldLogicScriptRefConfig => ({
    id: scriptRef.id,
    path: scriptRef.path,
    displayName: scriptRef.displayName
});

export const normalizeLogicScript = (value: unknown): TestWorldLogicScriptConfig | null => {
    if (!isObjectRecord(value)) {
        return null;
    }
    const id = asOptionalString(value.id);
    const category = asLogicScriptCategory(value.category);
    if (!id || !category) {
        return null;
    }
    const commands = Array.isArray(value.commands)
        ? value.commands
            .map((entry) => normalizeLogicScriptCommand(entry))
            .filter((entry): entry is TestWorldLogicScriptCommandConfig => entry !== null)
        : [];

    return {
        id,
        name: asOptionalString(value.name) ?? id,
        category,
        commands,
        editor: normalizeLogicScriptEditor(value.editor)
    };
};

export const normalizeLogicBinding = (value: unknown): TestWorldLogicBindingConfig | null => {
    if (!isObjectRecord(value)) {
        return null;
    }
    const id = asOptionalString(value.id);
    const targetType = asLogicBindingTargetType(value.targetType);
    const slot = asOptionalString(value.slot);
    const scriptId = asOptionalString(value.scriptId);
    if (!id || !targetType || !slot || !scriptId) {
        return null;
    }
    return {
        id,
        targetType,
        targetId: asOptionalString(value.targetId),
        slot,
        scriptId,
        enabled: typeof value.enabled === 'boolean' ? value.enabled : true
    };
};

export const normalizeScriptList = (rawScripts: unknown): TestWorldLogicScriptConfig[] => {
    if (!Array.isArray(rawScripts)) {
        return [];
    }
    return rawScripts
        .map((entry) => normalizeLogicScript(entry))
        .filter((entry): entry is TestWorldLogicScriptConfig => entry !== null)
        .map((entry) => cloneLogicScript(entry));
};

export const normalizeBindingList = (rawBindings: unknown): TestWorldLogicBindingConfig[] => {
    if (!Array.isArray(rawBindings)) {
        return [];
    }
    return rawBindings
        .map((entry) => normalizeLogicBinding(entry))
        .filter((entry): entry is TestWorldLogicBindingConfig => entry !== null)
        .map((entry) => cloneLogicBinding(entry));
};

export const normalizeScriptRefList = (rawScriptRefs: unknown): TestWorldLogicScriptRefConfig[] => {
    if (!Array.isArray(rawScriptRefs)) {
        return [];
    }
    return rawScriptRefs
        .map((entry) => {
            if (!isObjectRecord(entry)) {
                return null;
            }
            const id = asOptionalString(entry.id);
            if (!id) {
                return null;
            }
            return {
                id,
                path: asOptionalString(entry.path),
                displayName: asOptionalString(entry.displayName)
            } satisfies TestWorldLogicScriptRefConfig;
        })
        .filter((entry): entry is TestWorldLogicScriptRefConfig => entry !== null)
        .map((entry) => cloneLogicScriptRef(entry));
};

export const resolveLogicForRead = (config: TestWorldConfig): TestWorldLogicConfig => {
    const logic = isObjectRecord(config.logic)
        ? config.logic
        : undefined;
    return {
        scripts: normalizeScriptList(logic?.scripts),
        scriptRefs: normalizeScriptRefList(logic?.scriptRefs),
        bindings: normalizeBindingList(logic?.bindings)
    };
};

export const collectWorldObjectIds = (config: TestWorldConfig): Set<string> => {
    return new Set<string>([
        ...config.surfaces.map((entry) => entry.id),
        ...config.hazards.map((entry) => entry.id),
        ...config.checkpoints.map((entry) => entry.id),
        ...config.movingPlatforms.map((entry) => entry.id),
        ...config.triggerPlatforms.map((entry) => entry.id),
        ...config.triggerVolumes.map((entry) => entry.id),
        ...config.dragBoxes.map((entry) => entry.id),
        ...config.windZones.map((entry) => entry.id),
        ...config.triangleFlightBreakWalls.map((entry) => entry.id),
        ...config.trianglePickups.map((entry) => entry.id),
        ...(config.finish ? [config.finish.id] : [])
    ]);
};

export const validateBindingTarget = (
    config: TestWorldConfig,
    targetType: TestWorldLogicBindingTargetType,
    targetIdValue: unknown
): BindingTargetValidationResult => {
    const targetId = asOptionalString(targetIdValue);
    if (targetType === 'world') {
        return {
            valid: true,
            targetId
        };
    }
    if (!targetId) {
        return {
            valid: false,
            reason: 'Binding targetId is required for this target type.'
        };
    }
    if (targetType === 'object') {
        const worldObjectIds = collectWorldObjectIds(config);
        return worldObjectIds.has(targetId)
            ? { valid: true, targetId }
            : { valid: false, reason: 'Binding object target does not exist.' };
    }
    if (targetType === 'npc') {
        const npcIds = new Set(config.npcs.map((entry) => entry.id));
        return npcIds.has(targetId)
            ? { valid: true, targetId }
            : { valid: false, reason: 'Binding npc target does not exist.' };
    }
    if (targetType === 'trigger') {
        const triggerTargetIds = new Set<string>([
            ...config.triggerPlatforms.map((entry) => entry.id),
            ...config.triggerVolumes.map((entry) => entry.id)
        ]);
        return triggerTargetIds.has(targetId)
            ? { valid: true, targetId }
            : { valid: false, reason: 'Binding trigger target does not exist.' };
    }
    if (targetType === 'cutscene') {
        return isTestCutsceneRef(targetId)
            ? { valid: true, targetId }
            : { valid: false, reason: 'Binding cutscene target does not exist.' };
    }
    return {
        valid: false,
        reason: 'Invalid binding target type.'
    };
};
