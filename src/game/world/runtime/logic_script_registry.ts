import type {
    TestWorldConfig,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig,
    TestWorldLogicScriptConfig
} from './test_world_config';
import { collectTestWorldLogicDiagnostics, type TestWorldLogicDiagnostic } from './test_world_config_validation';
import {
    getTestCutsceneRequiredSceneParticipantIds,
    isTestCutsceneRef
} from '../../cutscene/test_cutscene_registry';
import {
    getStartCutsceneCommandIdFromParams,
    isKnownLogicCommandType,
    validateKnownLogicCommandParams
} from './logic_command_registry';

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
type LogicScriptRegistryReloadResult = {
    success: boolean;
    version: number;
    assetCount: number;
    message: string;
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

const normalizeLogicScriptAssets = (rawRegistry: unknown): {
    assets: TestWorldLogicScriptConfig[];
    error: string | null;
} => {
    const rawRoot = asObject(rawRegistry);
    if (!rawRoot || !Array.isArray(rawRoot.scripts)) {
        return {
            assets: [],
            error: 'Registry payload must be an object with a scripts array.'
        };
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
    return {
        assets: normalized,
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
    lastRawRegistry: EMPTY_LOGIC_SCRIPT_REGISTRY
};

const commitLogicScriptRegistry = (rawRegistry: unknown, source: string): void => {
    const normalized = normalizeLogicScriptAssets(rawRegistry);
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
    registryState.version += 1;
    registryState.source = source;
    registryState.lastReloadedAt = Date.now();
    registryState.lastError = undefined;
};

commitLogicScriptRegistry(EMPTY_LOGIC_SCRIPT_REGISTRY, 'module_init_fallback');
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
            commitLogicScriptRegistry(responsePayload, 'dev-fetch');
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
    commitLogicScriptRegistry(registryState.lastRawRegistry, 'manual_reload');
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

    registryState.assets.forEach((script) => {
        const shouldCheckCutsceneSceneParticipantDependencies = referencedScriptRefIds?.has(script.id) ?? false;
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
                    path: `${path}.type`
                });
                return;
            }

            const paramsValidation = validateKnownLogicCommandParams(command);
            if (paramsValidation && !paramsValidation.valid) {
                const paramsMessage = commandType === 'set_world_flag'
                    ? ' (requires non-empty key and boolean value)'
                    : commandType === 'start_cutscene'
                        ? ' (requires non-empty cutsceneId)'
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
                        : `${path}.params`
                });
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
                        path: `${path}.params.cutsceneId`
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
                        path: `${path}.params.cutsceneId`
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
                            cutsceneId,
                            missingParticipantId: participantId
                        });
                    });
                }
            }
        });
    });

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
