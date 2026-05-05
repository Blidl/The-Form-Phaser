import logicScriptRegistryJson from './data/logic_scripts.json';
import type {
    TestWorldConfig,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig,
    TestWorldLogicScriptConfig
} from './test_world_config';
import { collectTestWorldLogicDiagnostics, type TestWorldLogicDiagnostic } from './test_world_config_validation';

const LOGIC_SCRIPT_CATEGORIES = new Set<TestWorldLogicScriptCategory>([
    'object.move',
    'object.rotate',
    'object.action',
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

const asObject = (value: unknown): Record<string, unknown> | null => {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
};

const asOptionalString = (value: unknown): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const cloneParamsObject = (params: Record<string, unknown>): Record<string, unknown> => {
    try {
        return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
    } catch {
        return { ...params };
    }
};

const cloneLogicScriptCommand = (
    command: TestWorldLogicScriptCommandConfig
): TestWorldLogicScriptCommandConfig => {
    return {
        id: command.id,
        type: command.type,
        params: cloneParamsObject(command.params)
    };
};

const cloneLogicScriptAsset = (script: TestWorldLogicScriptConfig): TestWorldLogicScriptConfig => {
    return {
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
    };
};

const normalizeLogicScriptCategory = (value: unknown): TestWorldLogicScriptCategory | null => {
    return typeof value === 'string' && LOGIC_SCRIPT_CATEGORIES.has(value as TestWorldLogicScriptCategory)
        ? value as TestWorldLogicScriptCategory
        : null;
};

const normalizeLogicScriptCommand = (value: unknown): TestWorldLogicScriptCommandConfig | null => {
    const raw = asObject(value);
    if (!raw) {
        return null;
    }
    const id = asOptionalString(raw.id);
    const type = asOptionalString(raw.type);
    if (!id || !type) {
        return null;
    }
    return {
        id,
        type,
        params: asObject(raw.params) ? cloneParamsObject(raw.params as Record<string, unknown>) : {}
    };
};

const normalizeLogicScript = (value: unknown): TestWorldLogicScriptConfig | null => {
    const raw = asObject(value);
    if (!raw) {
        return null;
    }
    const id = asOptionalString(raw.id);
    const category = normalizeLogicScriptCategory(raw.category);
    if (!id || !category) {
        return null;
    }
    const commands = Array.isArray(raw.commands)
        ? raw.commands
            .map((entry) => normalizeLogicScriptCommand(entry))
            .filter((entry): entry is TestWorldLogicScriptCommandConfig => entry !== null)
        : [];
    const editorRaw = asObject(raw.editor);
    const editorRawLines = Array.isArray(editorRaw?.rawLines)
        ? editorRaw.rawLines.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const editorHasLocked = typeof editorRaw?.locked === 'boolean';
    const editor = editorRaw && (editorRawLines.length > 0 || editorHasLocked)
        ? {
            rawLines: editorRawLines.length > 0 ? [...editorRawLines] : undefined,
            locked: editorHasLocked ? editorRaw.locked as boolean : false
        }
        : undefined;
    return {
        id,
        name: asOptionalString(raw.name) ?? id,
        category,
        commands,
        editor
    };
};

const normalizeLogicScriptAssets = (rawRegistry: unknown): TestWorldLogicScriptConfig[] => {
    const rawRoot = asObject(rawRegistry);
    if (!rawRoot || !Array.isArray(rawRoot.scripts)) {
        return [];
    }

    const usedIds = new Set<string>();
    const normalized: TestWorldLogicScriptConfig[] = [];
    rawRoot.scripts.forEach((entry) => {
        const script = normalizeLogicScript(entry);
        if (!script || usedIds.has(script.id)) {
            return;
        }
        usedIds.add(script.id);
        normalized.push(cloneLogicScriptAsset(script));
    });
    return normalized;
};

const LOGIC_SCRIPT_ASSETS = normalizeLogicScriptAssets(logicScriptRegistryJson);
const LOGIC_SCRIPT_ASSET_BY_ID = new Map<string, TestWorldLogicScriptConfig>(
    LOGIC_SCRIPT_ASSETS.map((entry) => [entry.id, entry] as const)
);
const LOGIC_SCRIPT_ASSET_IDS = LOGIC_SCRIPT_ASSETS.map((entry) => entry.id);

export const getAllLogicScriptAssets = (): TestWorldLogicScriptConfig[] => {
    return LOGIC_SCRIPT_ASSETS.map((entry) => cloneLogicScriptAsset(entry));
};

export const getLogicScriptAsset = (id: string): TestWorldLogicScriptConfig | null => {
    const scriptId = id.trim();
    if (scriptId.length <= 0) {
        return null;
    }
    const script = LOGIC_SCRIPT_ASSET_BY_ID.get(scriptId);
    return script ? cloneLogicScriptAsset(script) : null;
};

export const hasLogicScriptAsset = (id: string): boolean => {
    const scriptId = id.trim();
    return scriptId.length > 0 && LOGIC_SCRIPT_ASSET_BY_ID.has(scriptId);
};

export const getLogicScriptAssetIds = (): string[] => {
    return [...LOGIC_SCRIPT_ASSET_IDS];
};

export const resolveLogicScriptAssetIds = (
    ids: string[]
): { found: TestWorldLogicScriptConfig[]; missing: string[] } => {
    const found: TestWorldLogicScriptConfig[] = [];
    const missing: string[] = [];
    ids.forEach((entry) => {
        const scriptId = entry.trim();
        if (scriptId.length <= 0) {
            return;
        }
        const script = LOGIC_SCRIPT_ASSET_BY_ID.get(scriptId);
        if (script) {
            found.push(cloneLogicScriptAsset(script));
            return;
        }
        missing.push(scriptId);
    });
    return {
        found,
        missing
    };
};

export const collectTestWorldLogicDiagnosticsWithRegistry = (
    config: TestWorldConfig
): TestWorldLogicDiagnostic[] => {
    return collectTestWorldLogicDiagnostics(config, {
        availableExternalScriptIds: LOGIC_SCRIPT_ASSET_IDS
    });
};
