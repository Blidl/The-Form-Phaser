import type {
    TestWorldConfig,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig,
    TestWorldLogicScriptConfig
} from './test_world_config';
import logicScriptsRegistryJson from './data/logic_scripts.json';
import { collectTestWorldLogicDiagnostics, type TestWorldLogicDiagnostic } from './test_world_config_validation';
import {
    getTestCutsceneRequiredSceneParticipantIds,
    isTestCutsceneRef
} from '../../cutscene/test_cutscene_registry';
import {
    getLogicCommandDefinition,
    getStartCutsceneCommandIdFromParams,
    isKnownLogicCommandType,
    validateKnownLogicCommandParams
} from './logic_command_registry';
import {
    getNpcPatrolPingPongParams,
    NPC_PATROL_PING_PONG_COMMAND_TYPE,
    summarizeNpcPatrolPingPongContract
} from './npc_command_registry';
import {
    PLATFORM_MOVE_PING_PONG_COMMAND_TYPE,
    PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE,
    summarizePlatformMovePingPongContract,
    summarizePlatformRotateConstantContract
} from './platform_command_registry';

const BUNDLED_LOGIC_SCRIPT_FILE_MODULES = import.meta.glob('./data/scripts/**/*.json', {
    eager: true,
    import: 'default'
}) as Record<string, unknown>;

const LOGIC_SCRIPT_CATEGORIES = new Set<TestWorldLogicScriptCategory>([
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
const EMPTY_LOGIC_SCRIPT_REGISTRY: { scripts: unknown[] } = { scripts: [] };
const LOGIC_SCRIPT_REGISTRY_MANIFEST_PATH = 'src/game/world/runtime/data/logic_scripts.json';
const LOGIC_SCRIPT_REGISTRY_DATA_PREFIX = './data/';
type LogicScriptRegistryReloadResult = {
    success: boolean;
    version: number;
    assetCount: number;
    message: string;
};

type NormalizeLogicScriptAssetsOptions = {
    scriptFileLookup?: ReadonlyMap<string, unknown>;
};

type RawLogicScriptEntry = {
    raw: unknown;
    manifestIndex: number;
    path: string;
};

interface LogicScriptRegistryState {
    assets: TestWorldLogicScriptConfig[];
    byId: Map<string, TestWorldLogicScriptConfig>;
    ids: string[];
    version: number;
    source: string;
    lastReloadedAt: number;
    lastError?: string;
    lastRawRegistry: unknown;
    loadDiagnostics: TestWorldLogicDiagnostic[];
}

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

const cloneLogicScriptDiagnostic = (diagnostic: TestWorldLogicDiagnostic): TestWorldLogicDiagnostic => ({
    ...diagnostic
});

const normalizeManifestScriptPath = (value: string): string => {
    const forwardSlashes = value.replaceAll('\\', '/').trim();
    const withoutLeading = forwardSlashes.replace(/^\.\/+/, '').replace(/^\/+/, '');
    return withoutLeading;
};

const toManifestScriptPathFromGlobKey = (globKey: string): string => {
    const normalized = normalizeManifestScriptPath(globKey);
    return normalized.startsWith('data/')
        ? normalized.slice('data/'.length)
        : normalized;
};

const buildBundledScriptFileLookup = (modules: Record<string, unknown>): ReadonlyMap<string, unknown> => {
    const lookup = new Map<string, unknown>();
    Object.entries(modules).forEach(([key, moduleValue]) => {
        lookup.set(toManifestScriptPathFromGlobKey(key), moduleValue);
    });
    return lookup;
};

const BUNDLED_LOGIC_SCRIPT_FILE_LOOKUP = buildBundledScriptFileLookup(BUNDLED_LOGIC_SCRIPT_FILE_MODULES);

const createRegistryLoadDiagnostic = (
    index: number,
    options: {
        severity?: TestWorldLogicDiagnostic['severity'];
        code: TestWorldLogicDiagnostic['code'];
        message: string;
        path?: string;
        field?: string;
        scriptId?: string;
        commandId?: string;
    }
): TestWorldLogicDiagnostic => {
    return {
        id: `registry_manifest_${index}`,
        severity: options.severity ?? 'error',
        code: options.code,
        message: options.message,
        path: options.path,
        field: options.field,
        scriptId: options.scriptId,
        commandId: options.commandId
    };
};

const isValidManifestScriptPath = (value: string): boolean => {
    if (value.length <= 0) {
        return false;
    }
    if (/^[a-zA-Z]:\//.test(value) || value.startsWith('//')) {
        return false;
    }
    if (value.split('/').some((part) => part === '..')) {
        return false;
    }
    return value.startsWith('scripts/') && value.endsWith('.json');
};

const isEventCommandType = (commandType: string): boolean => {
    return commandType === 'noop'
        || commandType === 'set_world_flag'
        || commandType === 'start_cutscene';
};

const isEventScriptCategory = (category: TestWorldLogicScriptCategory): boolean => {
    return category === 'object.action'
        || category === 'platform.defaultAction'
        || category === 'platform.action'
        || category === 'npc.action'
        || category === 'npc.altAction'
        || category === 'cutscene.npc'
        || category === 'cutscene.camera'
        || category === 'cutscene.player'
        || category === 'cutscene.other'
        || category === 'trigger.action'
        || category === 'world.rule';
};

const validateRawLogicScriptAsset = (
    entry: RawLogicScriptEntry,
    nextDiagnosticIndex: () => number
): TestWorldLogicDiagnostic[] => {
    const diagnostics: TestWorldLogicDiagnostic[] = [];
    const raw = asObject(entry.raw);
    const basePath = entry.path || `logic_scripts.json.scriptFiles[${entry.manifestIndex}]`;
    const pushDiagnostic = (options: Parameters<typeof createRegistryLoadDiagnostic>[1]): void => {
        diagnostics.push(createRegistryLoadDiagnostic(nextDiagnosticIndex(), options));
    };

    if (!raw) {
        pushDiagnostic({
            code: 'invalid_logic_script_shape',
            message: `External script file "${basePath}" must contain a JSON object.`,
            path: basePath
        });
        return diagnostics;
    }

    const scriptId = asOptionalString(raw.id);
    const scriptIdForPath = scriptId ?? `script_file_${entry.manifestIndex + 1}`;
    const scriptPath = `logicScripts.${scriptIdForPath}`;
    if (!scriptId) {
        pushDiagnostic({
            code: 'invalid_logic_script_shape',
            message: `External script file "${basePath}" is missing a non-empty script id.`,
            path: `${basePath}.id`,
            field: 'id'
        });
    }

    if (!asOptionalString(raw.name)) {
        pushDiagnostic({
            code: 'invalid_logic_script_name',
            message: `External script "${scriptIdForPath}" must have a non-empty name.`,
            scriptId,
            path: `${scriptPath}.name`,
            field: 'name'
        });
    }

    const category = normalizeLogicScriptCategory(raw.category);
    if (!category) {
        pushDiagnostic({
            code: 'invalid_logic_script_category',
            message: `External script "${scriptIdForPath}" has invalid category "${String(raw.category)}".`,
            scriptId,
            path: `${scriptPath}.category`,
            field: 'category'
        });
    }

    if (!Array.isArray(raw.commands)) {
        pushDiagnostic({
            code: 'invalid_logic_script_commands',
            message: `External script "${scriptIdForPath}" must have a commands array.`,
            scriptId,
            path: `${scriptPath}.commands`,
            field: 'commands'
        });
        return diagnostics;
    }

    const usedCommandIds = new Set<string>();
    raw.commands.forEach((commandValue, commandIndex) => {
        const commandPath = `${scriptPath}.commands[${commandIndex}]`;
        const command = asObject(commandValue);
        if (!command) {
            pushDiagnostic({
                code: 'invalid_logic_command_shape',
                message: `External script "${scriptIdForPath}" command ${commandIndex + 1} must be an object.`,
                scriptId,
                path: commandPath
            });
            return;
        }

        const commandId = asOptionalString(command.id);
        if (!commandId) {
            pushDiagnostic({
                code: 'invalid_logic_command_id',
                message: `External script "${scriptIdForPath}" command ${commandIndex + 1} is missing a non-empty id.`,
                scriptId,
                path: `${commandPath}.id`,
                field: 'id'
            });
        } else if (usedCommandIds.has(commandId)) {
            pushDiagnostic({
                code: 'duplicate_logic_command_id',
                message: `External script "${scriptIdForPath}" has duplicate command id "${commandId}".`,
                scriptId,
                commandId,
                path: `${commandPath}.id`,
                field: 'id'
            });
        } else {
            usedCommandIds.add(commandId);
        }

        const commandType = asOptionalString(command.type);
        if (!commandType) {
            pushDiagnostic({
                code: 'unknown_logic_command_type',
                message: `External script "${scriptIdForPath}" command "${commandId ?? `command_${commandIndex + 1}`}" is missing a non-empty type.`,
                scriptId,
                commandId,
                path: `${commandPath}.type`,
                field: 'type'
            });
        }

        if (command.params !== undefined && !asObject(command.params)) {
            pushDiagnostic({
                code: 'invalid_logic_command_params',
                message: `External script "${scriptIdForPath}" command "${commandId ?? `command_${commandIndex + 1}`}" params must be an object when present.`,
                scriptId,
                commandId,
                path: `${commandPath}.params`,
                field: 'params'
            });
        }
    });

    return diagnostics;
};

const normalizeLogicScriptAssets = (
    rawRegistry: unknown,
    options?: NormalizeLogicScriptAssetsOptions
): {
    assets: TestWorldLogicScriptConfig[];
    diagnostics: TestWorldLogicDiagnostic[];
    error: string | null;
} => {
    const rawRoot = asObject(rawRegistry);
    if (!rawRoot) {
        return {
            assets: [],
            diagnostics: [],
            error: 'Registry payload must be an object.'
        };
    }

    const diagnostics: TestWorldLogicDiagnostic[] = [];
    const hasManifestShape = Array.isArray(rawRoot.scriptFiles);
    const hasLegacyShape = Array.isArray(rawRoot.scripts);

    if (!hasManifestShape) {
        diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
            code: 'invalid_logic_manifest',
            message: `${LOGIC_SCRIPT_REGISTRY_MANIFEST_PATH} must define scriptFiles as an array.`,
            path: 'logic_scripts.json.scriptFiles',
            field: 'scriptFiles'
        }));
        if (!hasLegacyShape) {
            return {
                assets: [],
                diagnostics,
                error: null
            };
        }
    }

    if (hasManifestShape && hasLegacyShape) {
        diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
            severity: 'warning',
            code: 'duplicate_logic_script_ref',
            message: `External logic script registry has both scriptFiles and scripts arrays. scriptFiles from ${LOGIC_SCRIPT_REGISTRY_MANIFEST_PATH} is preferred.`,
            path: 'logic_scripts.json'
        }));
    }

    const rawScriptEntries: RawLogicScriptEntry[] = [];

    if (hasManifestShape) {
        const scriptFileLookup = options?.scriptFileLookup;
        if (!scriptFileLookup) {
            return {
                assets: [],
                diagnostics,
                error: `Manifest payload requires a script file lookup for ${LOGIC_SCRIPT_REGISTRY_MANIFEST_PATH}.`
            };
        }

        const usedManifestPaths = new Set<string>();
        rawRoot.scriptFiles.forEach((entry, entryIndex) => {
            const scriptPath = asOptionalString(entry);
            const diagnosticPath = `logic_scripts.json.scriptFiles[${entryIndex}]`;
            if (!scriptPath) {
                diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                    code: 'missing_logic_script_asset',
                    message: `Manifest entry at index ${entryIndex} must be a non-empty script file path.`,
                    path: diagnosticPath
                }));
                return;
            }

            const manifestPath = normalizeManifestScriptPath(scriptPath);
            if (!isValidManifestScriptPath(manifestPath)) {
                diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                    code: 'invalid_logic_manifest_path',
                    message: `Manifest entry "${scriptPath}" is not a valid script file path. Expected a relative scripts/*.json path.`,
                    path: diagnosticPath,
                    field: 'scriptFiles'
                }));
                return;
            }

            if (usedManifestPaths.has(manifestPath)) {
                diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                    code: 'duplicate_logic_script_ref',
                    message: `Manifest contains duplicate script file path "${manifestPath}".`,
                    path: diagnosticPath,
                    field: 'scriptFiles'
                }));
                return;
            }
            usedManifestPaths.add(manifestPath);

            const rawScript = scriptFileLookup.get(manifestPath);
            if (rawScript === undefined) {
                diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                    code: 'missing_logic_script_asset',
                    message: `Manifest path "${manifestPath}" does not resolve to a bundled script JSON module under ${LOGIC_SCRIPT_REGISTRY_DATA_PREFIX}scripts/.`,
                    path: diagnosticPath,
                    field: 'scriptFiles'
                }));
                return;
            }
            rawScriptEntries.push({
                raw: rawScript,
                manifestIndex: entryIndex,
                path: manifestPath
            });
        });
    } else if (hasLegacyShape) {
        rawRoot.scripts.forEach((rawScript, index) => {
            rawScriptEntries.push({
                raw: rawScript,
                manifestIndex: index,
                path: `logic_scripts.json.scripts[${index}]`
            });
        });
    }

    const usedIds = new Set<string>();
    const normalized: TestWorldLogicScriptConfig[] = [];
    const nextRawDiagnosticIndex = (): number => diagnostics.length + 1;
    rawScriptEntries.forEach((entry, entryIndex) => {
        diagnostics.push(...validateRawLogicScriptAsset(entry, nextRawDiagnosticIndex));

        const script = normalizeLogicScript(entry.raw);
        if (!script) {
            diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                code: 'missing_logic_script_asset',
                message: `External script asset "${entry.path}" has invalid shape and was not loaded.`,
                path: entry.path
            }));
            return;
        }

        if (usedIds.has(script.id)) {
            diagnostics.push(createRegistryLoadDiagnostic(diagnostics.length + 1, {
                code: 'duplicate_logic_script_id',
                message: `Duplicate external script id "${script.id}" detected while loading ${LOGIC_SCRIPT_REGISTRY_MANIFEST_PATH}.`,
                scriptId: script.id,
                path: entry.path,
                field: 'id'
            }));
            return;
        }

        usedIds.add(script.id);
        normalized.push(cloneLogicScriptAsset(script));
    });

    return {
        assets: normalized,
        diagnostics,
        error: null
    };
};

const registryState: LogicScriptRegistryState = {
    assets: [],
    byId: new Map<string, TestWorldLogicScriptConfig>(),
    ids: [],
    version: 0,
    source: 'init',
    lastReloadedAt: Date.now(),
    lastRawRegistry: EMPTY_LOGIC_SCRIPT_REGISTRY,
    loadDiagnostics: []
};

const commitLogicScriptRegistry = (
    rawRegistry: unknown,
    source: string,
    options?: NormalizeLogicScriptAssetsOptions
): void => {
    const normalized = normalizeLogicScriptAssets(rawRegistry, options);
    if (normalized.error) {
        registryState.source = source;
        registryState.lastError = normalized.error;
        return;
    }

    const nextAssets = normalized.assets.map((entry) => cloneLogicScriptAsset(entry));
    registryState.assets = nextAssets;
    registryState.byId = new Map<string, TestWorldLogicScriptConfig>(
        nextAssets.map((entry) => [entry.id, entry] as const)
    );
    registryState.ids = nextAssets.map((entry) => entry.id);
    registryState.lastRawRegistry = rawRegistry;
    registryState.loadDiagnostics = normalized.diagnostics.map((entry) => cloneLogicScriptDiagnostic(entry));
    registryState.version += 1;
    registryState.source = source;
    registryState.lastReloadedAt = Date.now();
    registryState.lastError = undefined;
};

commitLogicScriptRegistry(EMPTY_LOGIC_SCRIPT_REGISTRY, 'module_init_fallback');
commitLogicScriptRegistry(logicScriptsRegistryJson, 'module_init_manifest', {
    scriptFileLookup: BUNDLED_LOGIC_SCRIPT_FILE_LOOKUP
});
let hasLoadedExternalLogicScripts = false;
let initialExternalLogicScriptsLoadPromise: Promise<LogicScriptRegistryReloadResult> | null = null;

export const getAllLogicScriptAssets = (): TestWorldLogicScriptConfig[] => {
    return registryState.assets.map((entry) => cloneLogicScriptAsset(entry));
};

export const getLogicScriptAsset = (id: string): TestWorldLogicScriptConfig | null => {
    const scriptId = id.trim();
    if (scriptId.length <= 0) {
        return null;
    }
    const script = registryState.byId.get(scriptId);
    return script ? cloneLogicScriptAsset(script) : null;
};

export const hasLogicScriptAsset = (id: string): boolean => {
    const scriptId = id.trim();
    return scriptId.length > 0 && registryState.byId.has(scriptId);
};

export const getLogicScriptAssetIds = (): string[] => {
    return [...registryState.ids];
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
        const script = registryState.byId.get(scriptId);
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

const collectKnownLevelSceneParticipantIds = (config: TestWorldConfig): Set<string> => {
    const participantIds = new Set<string>(['player']);
    config.npcs.forEach((entry) => {
        const npcId = typeof entry.id === 'string' ? entry.id.trim() : '';
        if (npcId.length > 0) {
            participantIds.add(npcId);
        }
    });
    return participantIds;
};

const collectReferencedScriptRefIds = (config: TestWorldConfig): Set<string> => {
    const referencedScriptRefIds = new Set<string>();
    const scriptRefs = Array.isArray(config.logic?.scriptRefs) ? config.logic.scriptRefs : [];
    scriptRefs.forEach((entry) => {
        const scriptRefId = typeof entry.id === 'string' ? entry.id.trim() : '';
        if (scriptRefId.length > 0) {
            referencedScriptRefIds.add(scriptRefId);
        }
    });
    return referencedScriptRefIds;
};

export const getLogicScriptRegistryVersion = (): number => {
    return registryState.version;
};

export const getLogicScriptRegistryStatus = (): {
    version: number;
    source: string;
    assetCount: number;
    lastReloadedAt: number;
    lastError?: string;
} => {
    return {
        version: registryState.version,
        source: registryState.source,
        assetCount: registryState.assets.length,
        lastReloadedAt: registryState.lastReloadedAt,
        lastError: registryState.lastError
    };
};

export const reloadExternalLogicScripts = async (): Promise<LogicScriptRegistryReloadResult> => {
    const isBrowser = typeof window !== 'undefined';
    const isDev = import.meta.env.DEV;
    if (isDev && isBrowser) {
        hasLoadedExternalLogicScripts = false;
        try {
            const response = await fetch(`/__theform/logic-scripts?ts=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json'
                }
            });
            const responsePayload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorMessage = asObject(responsePayload) && typeof responsePayload.message === 'string'
                    ? responsePayload.message
                    : `HTTP ${response.status}`;
                registryState.source = 'dev-fetch';
                registryState.lastError = errorMessage;
                return {
                    success: false,
                    version: registryState.version,
                    assetCount: registryState.assets.length,
                    message: `Failed to reload external scripts: ${errorMessage}`
                };
            }

            const previousVersion = registryState.version;
            commitLogicScriptRegistry(responsePayload, 'dev-fetch', {
                scriptFileLookup: BUNDLED_LOGIC_SCRIPT_FILE_LOOKUP
            });
            if (registryState.version === previousVersion && registryState.lastError) {
                return {
                    success: false,
                    version: registryState.version,
                    assetCount: registryState.assets.length,
                    message: `Failed to reload external scripts: ${registryState.lastError}`
                };
            }
            hasLoadedExternalLogicScripts = true;
            return {
                success: true,
                version: registryState.version,
                assetCount: registryState.assets.length,
                message: `Reloaded external scripts: ${registryState.assets.length} assets.`
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'unknown fetch failure';
            registryState.source = 'dev-fetch';
            registryState.lastError = errorMessage;
            return {
                success: false,
                version: registryState.version,
                assetCount: registryState.assets.length,
                message: `Failed to reload external scripts: ${errorMessage}`
            };
        }
    }

    const previousVersion = registryState.version;
    commitLogicScriptRegistry(registryState.lastRawRegistry, 'manual_reload', {
        scriptFileLookup: BUNDLED_LOGIC_SCRIPT_FILE_LOOKUP
    });
    if (registryState.version === previousVersion && registryState.lastError) {
        return {
            success: false,
            version: registryState.version,
            assetCount: registryState.assets.length,
            message: `Failed to reload external scripts: ${registryState.lastError}`
        };
    }
    return {
        success: true,
        version: registryState.version,
        assetCount: registryState.assets.length,
        message: `Reloaded external scripts: ${registryState.assets.length} assets.`
    };
};

export const ensureExternalLogicScriptsLoaded = async (): Promise<LogicScriptRegistryReloadResult> => {
    const hasSuccessfulDevFetchState = registryState.source === 'dev-fetch' && !registryState.lastError;
    if (hasLoadedExternalLogicScripts && hasSuccessfulDevFetchState) {
        return {
            success: true,
            version: registryState.version,
            assetCount: registryState.assets.length,
            message: `External scripts already loaded: ${registryState.assets.length} assets.`
        };
    }

    const isBrowser = typeof window !== 'undefined';
    const isDev = import.meta.env.DEV;
    if (!isBrowser || !isDev) {
        return {
            success: false,
            version: registryState.version,
            assetCount: registryState.assets.length,
            message: 'External scripts preload is only available in browser dev mode.'
        };
    }

    if (!initialExternalLogicScriptsLoadPromise) {
        initialExternalLogicScriptsLoadPromise = reloadExternalLogicScripts()
            .then((result) => {
                if (result.success) {
                    hasLoadedExternalLogicScripts = true;
                } else {
                    hasLoadedExternalLogicScripts = false;
                }
                return result;
            })
            .catch((error) => {
                hasLoadedExternalLogicScripts = false;
                const message = error instanceof Error ? error.message : 'unknown fetch failure';
                return {
                    success: false,
                    version: registryState.version,
                    assetCount: registryState.assets.length,
                    message: `Failed to preload external scripts: ${message}`
                };
            })
            .finally(() => {
                initialExternalLogicScriptsLoadPromise = null;
            });
    }

    return initialExternalLogicScriptsLoadPromise;
};

export const collectLogicScriptAssetDiagnostics = (
    options?: {
        config?: TestWorldConfig;
    }
): TestWorldLogicDiagnostic[] => {
    const diagnostics: TestWorldLogicDiagnostic[] = [];
    let diagnosticIndex = 1;
    const nextDiagnosticId = (code: TestWorldLogicDiagnostic['code']): string => {
        const id = `registry_${code}_${diagnosticIndex}`;
        diagnosticIndex += 1;
        return id;
    };
    const activeConfig = options?.config;
    const knownSceneParticipantIds = activeConfig
        ? collectKnownLevelSceneParticipantIds(activeConfig)
        : null;
    const referencedScriptRefIds = activeConfig
        ? collectReferencedScriptRefIds(activeConfig)
        : null;

    if (registryState.lastError) {
        diagnostics.push({
            id: nextDiagnosticId('invalid_logic_manifest'),
            severity: 'error',
            code: 'invalid_logic_manifest',
            message: registryState.lastError,
            path: 'logic_scripts.json'
        });
    }
    diagnostics.push(...registryState.loadDiagnostics.map((entry) => cloneLogicScriptDiagnostic(entry)));

    registryState.assets.forEach((script) => {
        const shouldCheckCutsceneSceneParticipantDependencies = referencedScriptRefIds?.has(script.id) ?? false;
        const isNpcPatrolScript = script.category === 'npc.patrol';
        const isPlatformMoveScript = script.category === 'platform.move';
        const isPlatformRotateScript = script.category === 'platform.rotate';
        let npcPatrolPingPongCount = 0;
        let platformMovePingPongCount = 0;
        let platformRotateConstantCount = 0;
        script.commands.forEach((command, commandIndex) => {
            const commandType = command.type.trim();
            const path = `logicScripts.${script.id}.commands[${commandIndex}]`;
            const commandId = command.id.trim() || undefined;

            if (!isKnownLogicCommandType(commandType)) {
                diagnostics.push({
                    id: nextDiagnosticId('unknown_logic_command_type'),
                    severity: 'error',
                    code: 'unknown_logic_command_type',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" has unknown command type "${commandType}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            const commandDefinition = getLogicCommandDefinition(commandType);
            if (
                commandDefinition
                && commandDefinition.supportedScriptCategories
                && !commandDefinition.supportedScriptCategories.includes(script.category)
            ) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is not valid for category "${script.category}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (isEventScriptCategory(script.category) && !isEventCommandType(commandType)) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" category "${script.category}" accepts event commands only for now; command "${commandId ?? `command_${commandIndex + 1}`}" uses "${commandType}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (isPlatformMoveScript && commandType !== PLATFORM_MOVE_PING_PONG_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is not valid for category "platform.move"; expected "${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (isPlatformRotateScript && commandType !== PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is not valid for category "platform.rotate"; expected "${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (isNpcPatrolScript && commandType !== NPC_PATROL_PING_PONG_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is not valid for category "npc.patrol"; expected "${NPC_PATROL_PING_PONG_COMMAND_TYPE}".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (!isPlatformMoveScript && commandType === PLATFORM_MOVE_PING_PONG_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is only valid for category "platform.move".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (!isNpcPatrolScript && commandType === NPC_PATROL_PING_PONG_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is only valid for category "npc.patrol".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (!isPlatformRotateScript && commandType === PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_category'),
                    severity: 'error',
                    code: 'invalid_logic_command_category',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" type "${commandType}" is only valid for category "platform.rotate".`,
                    scriptId: script.id,
                    commandId,
                    path: `${path}.type`,
                    field: 'type'
                });
                return;
            }

            if (commandType === NPC_PATROL_PING_PONG_COMMAND_TYPE) {
                npcPatrolPingPongCount += 1;
            }
            if (commandType === PLATFORM_MOVE_PING_PONG_COMMAND_TYPE) {
                platformMovePingPongCount += 1;
            }
            if (commandType === PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE) {
                platformRotateConstantCount += 1;
            }

            const paramsValidation = validateKnownLogicCommandParams(command);
            if (paramsValidation && !paramsValidation.valid) {
                const paramsMessage = commandType === 'set_world_flag'
                    ? ' (requires non-empty key and boolean value)'
                    : commandType === 'start_cutscene'
                        ? ' (requires non-empty cutsceneId)'
                        : commandType === PLATFORM_MOVE_PING_PONG_COMMAND_TYPE
                            ? ' (requires axis, distance > 0, speed > 0, optional start)'
                            : commandType === NPC_PATROL_PING_PONG_COMMAND_TYPE
                                ? ' (requires axis, distance > 0, speed > 0, optional start)'
                            : commandType === PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE
                                ? ' (requires angularSpeedDeg > 0, optional direction/start)'
                                : '';
                diagnostics.push({
                    id: nextDiagnosticId('invalid_logic_command_params'),
                    severity: 'error',
                    code: 'invalid_logic_command_params',
                    message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" has invalid params for "${commandType}"${paramsMessage}.`,
                    scriptId: script.id,
                    commandId,
                    path: paramsValidation.fieldPath
                        ? `${path}.${paramsValidation.fieldPath}`
                        : `${path}.params`,
                    field: paramsValidation.fieldPath ?? 'params'
                });
                return;
            }

            if (isNpcPatrolScript || isPlatformMoveScript || isPlatformRotateScript) {
                return;
            }

            if (commandType === 'start_cutscene') {
                const cutsceneId = getStartCutsceneCommandIdFromParams(command.params);
                if (!cutsceneId) {
                    diagnostics.push({
                        id: nextDiagnosticId('invalid_logic_command_params'),
                        severity: 'error',
                        code: 'invalid_logic_command_params',
                        message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" has invalid params for "${commandType}" (requires non-empty cutsceneId).`,
                        scriptId: script.id,
                        commandId,
                        path: `${path}.params.cutsceneId`,
                        field: 'params.cutsceneId'
                    });
                    return;
                }

                if (!isTestCutsceneRef(cutsceneId)) {
                    diagnostics.push({
                        id: nextDiagnosticId('invalid_logic_command_ref'),
                        severity: 'error',
                        code: 'invalid_logic_command_ref',
                        message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" references unknown cutscene "${cutsceneId}".`,
                        scriptId: script.id,
                        commandId,
                        path: `${path}.params.cutsceneId`,
                        field: 'params.cutsceneId'
                    });
                    return;
                }

                if (
                    shouldCheckCutsceneSceneParticipantDependencies
                    && knownSceneParticipantIds
                ) {
                    const requiredParticipantIds = getTestCutsceneRequiredSceneParticipantIds(cutsceneId);
                    requiredParticipantIds.forEach((participantId) => {
                        if (participantId === 'player' || knownSceneParticipantIds.has(participantId)) {
                            return;
                        }
                        diagnostics.push({
                            id: nextDiagnosticId('missing_logic_command_cutscene_scene_participant_dependency'),
                            severity: 'error',
                            code: 'missing_logic_command_cutscene_scene_participant_dependency',
                            message: `Script "${script.id}" command "${commandId ?? `command_${commandIndex + 1}`}" starts cutscene "${cutsceneId}", but required scene participant "${participantId}" is missing from this level.`,
                            scriptId: script.id,
                            commandId,
                            path: `${path}.params.cutsceneId`,
                            field: 'params.cutsceneId',
                            cutsceneId,
                            missingParticipantId: participantId
                        });
                    });
                }
            }
        });

        if (isPlatformMoveScript && platformMovePingPongCount > 1) {
            diagnostics.push({
                id: nextDiagnosticId('invalid_platform_move_script_contract'),
                severity: 'error',
                code: 'invalid_platform_move_script_contract',
                message: `Script "${script.id}" contains ${platformMovePingPongCount} "${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE}" commands. Exactly one is supported in this XS.`,
                scriptId: script.id,
                path: `logicScripts.${script.id}.commands`
            });
        }

        if (isNpcPatrolScript && npcPatrolPingPongCount > 1) {
            diagnostics.push({
                id: nextDiagnosticId('invalid_logic_command_category'),
                severity: 'error',
                code: 'invalid_logic_command_category',
                message: `Script "${script.id}" contains ${npcPatrolPingPongCount} "${NPC_PATROL_PING_PONG_COMMAND_TYPE}" commands. Exactly one is supported in this XS.`,
                scriptId: script.id,
                path: `logicScripts.${script.id}.commands`
            });
        }

        if (isPlatformRotateScript && platformRotateConstantCount > 1) {
            diagnostics.push({
                id: nextDiagnosticId('invalid_platform_rotate_script_contract'),
                severity: 'error',
                code: 'invalid_platform_rotate_script_contract',
                message: `Script "${script.id}" contains ${platformRotateConstantCount} "${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE}" commands. Exactly one is supported in this XS.`,
                scriptId: script.id,
                path: `logicScripts.${script.id}.commands`
            });
        }
    });

    if (activeConfig) {
        activeConfig.surfaces.forEach((surface, surfaceIndex) => {
            const assignedMoveScriptId = typeof surface.behaviorScripts?.move === 'string'
                ? surface.behaviorScripts.move.trim()
                : '';
            if (assignedMoveScriptId.length <= 0) {
                return;
            }

            const path = `surfaces[${surfaceIndex}].behaviorScripts.move`;
            const script = registryState.byId.get(assignedMoveScriptId);
            if (!script) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" move behavior script "${assignedMoveScriptId}" is assigned but missing from external script assets.`,
                    scriptId: assignedMoveScriptId,
                    path
                });
                return;
            }

            if (script.category !== 'platform.move') {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" move behavior script "${assignedMoveScriptId}" has category "${script.category}", expected "platform.move".`,
                    scriptId: script.id,
                    path
                });
                return;
            }

            const summary = summarizePlatformMovePingPongContract(script.commands);
            if (summary.commandCount <= 0) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'warning',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" move behavior script "${assignedMoveScriptId}" is empty. Assign exactly one "${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE}" command.`,
                    scriptId: script.id,
                    path
                });
                return;
            }

            if (!summary.hasExactlyOneValidCommand) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" move behavior script "${assignedMoveScriptId}" must contain exactly one valid "${PLATFORM_MOVE_PING_PONG_COMMAND_TYPE}" command.`,
                    scriptId: script.id,
                    path
                });
            }

            const assignedRotateScriptId = typeof surface.behaviorScripts?.rotate === 'string'
                ? surface.behaviorScripts.rotate.trim()
                : '';
            if (assignedRotateScriptId.length <= 0) {
                return;
            }

            const rotatePath = `surfaces[${surfaceIndex}].behaviorScripts.rotate`;
            const rotateScript = registryState.byId.get(assignedRotateScriptId);
            if (!rotateScript) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" rotate behavior script "${assignedRotateScriptId}" is assigned but missing from external script assets.`,
                    scriptId: assignedRotateScriptId,
                    path: rotatePath
                });
                return;
            }

            if (rotateScript.category !== 'platform.rotate') {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" rotate behavior script "${assignedRotateScriptId}" has category "${rotateScript.category}", expected "platform.rotate".`,
                    scriptId: rotateScript.id,
                    path: rotatePath
                });
                return;
            }

            const rotateSummary = summarizePlatformRotateConstantContract(rotateScript.commands);
            if (rotateSummary.commandCount <= 0) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'warning',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" rotate behavior script "${assignedRotateScriptId}" is empty. Assign exactly one "${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE}" command (runtime rotation remains deferred in this XS).`,
                    scriptId: rotateScript.id,
                    path: rotatePath
                });
                return;
            }

            if (!rotateSummary.hasExactlyOneValidCommand) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `Surface "${surface.id}" rotate behavior script "${assignedRotateScriptId}" must contain exactly one valid "${PLATFORM_ROTATE_CONSTANT_COMMAND_TYPE}" command (runtime rotation remains deferred in this XS).`,
                    scriptId: rotateScript.id,
                    path: rotatePath
                });
            }
        });

        activeConfig.npcs.forEach((npc, npcIndex) => {
            const assignedDefaultActionScriptId = typeof npc.behaviorScripts?.defaultAction === 'string'
                ? npc.behaviorScripts.defaultAction.trim()
                : '';
            if (assignedDefaultActionScriptId.length > 0) {
                const defaultActionPath = `npcs[${npcIndex}].behaviorScripts.defaultAction`;
                const defaultActionScript = registryState.byId.get(assignedDefaultActionScriptId);
                if (!defaultActionScript) {
                    diagnostics.push({
                        id: nextDiagnosticId('invalid_npc_behavior_script_assignment'),
                        severity: 'error',
                        code: 'invalid_surface_behavior_script_assignment',
                        message: `NPC "${npc.id}" defaultAction behavior script "${assignedDefaultActionScriptId}" is assigned but missing from external script assets.`,
                        scriptId: assignedDefaultActionScriptId,
                        path: defaultActionPath
                    });
                } else if (defaultActionScript.category !== 'npc.action') {
                    diagnostics.push({
                        id: nextDiagnosticId('invalid_npc_behavior_script_assignment'),
                        severity: 'error',
                        code: 'invalid_surface_behavior_script_assignment',
                        message: `NPC "${npc.id}" defaultAction behavior script "${assignedDefaultActionScriptId}" has category "${defaultActionScript.category}", expected "npc.action".`,
                        scriptId: defaultActionScript.id,
                        path: defaultActionPath
                    });
                }
            }

            const assignedPatrolScriptId = typeof npc.behaviorScripts?.patrol === 'string'
                ? npc.behaviorScripts.patrol.trim()
                : '';
            if (assignedPatrolScriptId.length <= 0) {
                return;
            }
            const path = `npcs[${npcIndex}].behaviorScripts.patrol`;
            const script = registryState.byId.get(assignedPatrolScriptId);
            if (!script) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `NPC "${npc.id}" patrol behavior script "${assignedPatrolScriptId}" is assigned but missing from external script assets.`,
                    scriptId: assignedPatrolScriptId,
                    path
                });
                return;
            }
            if (script.category !== 'npc.patrol') {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `NPC "${npc.id}" patrol behavior script "${assignedPatrolScriptId}" has category "${script.category}", expected "npc.patrol".`,
                    scriptId: script.id,
                    path
                });
                return;
            }
            const summary = summarizeNpcPatrolPingPongContract(script.commands);
            if (!summary.hasExactlyOneValidCommand) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `NPC "${npc.id}" patrol behavior script "${assignedPatrolScriptId}" must contain exactly one valid "${NPC_PATROL_PING_PONG_COMMAND_TYPE}" command.`,
                    scriptId: script.id,
                    path
                });
                return;
            }
            const command = script.commands[0];
            const params = command ? getNpcPatrolPingPongParams(command.params) : null;
            if (!command || command.type.trim() !== NPC_PATROL_PING_PONG_COMMAND_TYPE || !params) {
                diagnostics.push({
                    id: nextDiagnosticId('invalid_surface_behavior_script_assignment'),
                    severity: 'error',
                    code: 'invalid_surface_behavior_script_assignment',
                    message: `NPC "${npc.id}" patrol behavior script "${assignedPatrolScriptId}" has unsupported patrol command contract.`,
                    scriptId: script.id,
                    path
                });
            }
        });
    }

    return diagnostics;
};

export const collectTestWorldLogicDiagnosticsWithRegistry = (
    config: TestWorldConfig
): TestWorldLogicDiagnostic[] => {
    const levelDiagnostics = collectTestWorldLogicDiagnostics(config, {
        availableExternalScriptIds: registryState.ids
    });
    const assetDiagnostics = collectLogicScriptAssetDiagnostics({ config });
    return [
        ...levelDiagnostics,
        ...assetDiagnostics
    ];
};
