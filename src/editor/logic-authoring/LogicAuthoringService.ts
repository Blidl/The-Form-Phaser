import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import {
    cloneTestWorldConfig,
    type TestWorldConfig,
    type TestWorldLogicBindingConfig,
    type TestWorldLogicBindingTargetType,
    type TestWorldLogicConfig,
    type TestWorldLogicScriptCommandConfig,
    type TestWorldLogicScriptConfig
} from '../../game/world/runtime/test_world_config';
import {
    type CreateLogicBindingInput,
    type CreateLogicScriptInput,
    type LogicMutationResult,
    type LogicSnapshot,
    type UpdateLogicBindingPatch,
    type UpdateLogicScriptPatch
} from './LogicAuthoringTypes';
import {
    generateDuplicateName,
    generateNextId,
    resolveId
} from './LogicAuthoringIds';
import {
    asLogicBindingTargetType,
    asLogicScriptCategory,
    asOptionalString,
    cloneLogicBinding,
    cloneLogicScript,
    normalizeBindingList,
    normalizeLogicScriptCommand,
    normalizeLogicScriptEditor,
    normalizeScriptList,
    resolveLogicForRead,
    validateBindingTarget
} from './LogicAuthoringValidation';

export class LogicAuthoringService {
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;

    public constructor(legacyObjectAdapter: LegacyObjectAdapter | null) {
        this.legacyObjectAdapter = legacyObjectAdapter;
    }

    public getSnapshot(): LogicSnapshot | null {
        const config = this.getRuntimeConfig();
        if (!config) {
            return null;
        }
        return this.createSnapshotFromConfig(config);
    }

    public listScripts(): TestWorldLogicScriptConfig[] {
        return this.getSnapshot()?.scripts ?? [];
    }

    public getScript(id: string): TestWorldLogicScriptConfig | null {
        const targetId = id.trim();
        if (!targetId) {
            return null;
        }
        const script = this.listScripts().find((entry) => entry.id === targetId);
        return script ? cloneLogicScript(script) : null;
    }

    public listBindings(): TestWorldLogicBindingConfig[] {
        return this.getSnapshot()?.bindings ?? [];
    }

    public getBinding(id: string): TestWorldLogicBindingConfig | null {
        const targetId = id.trim();
        if (!targetId) {
            return null;
        }
        const binding = this.listBindings().find((entry) => entry.id === targetId);
        return binding ? cloneLogicBinding(binding) : null;
    }

    public listBindingsForScript(scriptId: string): TestWorldLogicBindingConfig[] {
        const targetScriptId = scriptId.trim();
        if (!targetScriptId) {
            return [];
        }
        return this.listBindings().filter((entry) => entry.scriptId === targetScriptId);
    }

    public listBindingsForTarget(
        targetType: TestWorldLogicBindingTargetType,
        targetId?: string
    ): TestWorldLogicBindingConfig[] {
        const resolvedTargetId = asOptionalString(targetId);
        return this.listBindings().filter((entry) => {
            if (entry.targetType !== targetType) {
                return false;
            }
            if (!resolvedTargetId) {
                return true;
            }
            return entry.targetId === resolvedTargetId;
        });
    }

    public createScript(input: CreateLogicScriptInput): LogicMutationResult {
        const category = asLogicScriptCategory(input.category);
        if (!category) {
            return {
                success: false,
                reason: 'Invalid logic script category.'
            };
        }

        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const existingIds = new Set(scripts.map((entry) => entry.id));
            const scriptId = resolveId({
                requestedId: input.id,
                prefix: 'logic_script',
                existingIds
            });
            const commands = Array.isArray(input.commands)
                ? input.commands
                    .map((entry) => normalizeLogicScriptCommand(entry))
                    .filter((entry): entry is TestWorldLogicScriptCommandConfig => entry !== null)
                : [];
            const script: TestWorldLogicScriptConfig = {
                id: scriptId,
                name: asOptionalString(input.name) ?? scriptId,
                category,
                commands,
                editor: normalizeLogicScriptEditor(input.editor)
            };
            scripts.push(script);
            logic.scripts = scripts;
            return {
                success: true,
                script
            };
        });
    }

    public updateScript(id: string, patch: UpdateLogicScriptPatch): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const scriptIndex = this.findScriptIndex(scripts, id);
            if (scriptIndex < 0) {
                return {
                    success: false,
                    reason: 'Logic script not found.'
                };
            }

            const current = scripts[scriptIndex];
            const next = cloneLogicScript(current);
            let changed = false;

            if (Object.prototype.hasOwnProperty.call(patch, 'id')) {
                const nextId = asOptionalString(patch.id);
                if (!nextId) {
                    return { success: false, reason: 'Script id must be a non-empty string.' };
                }
                if (nextId !== current.id && scripts.some((entry) => entry.id === nextId)) {
                    return { success: false, reason: 'Script id already exists.' };
                }
                next.id = nextId;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
                next.name = asOptionalString(patch.name) ?? next.id;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'category')) {
                const nextCategory = asLogicScriptCategory(patch.category);
                if (!nextCategory) {
                    return { success: false, reason: 'Invalid logic script category.' };
                }
                next.category = nextCategory;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'commands')) {
                next.commands = Array.isArray(patch.commands)
                    ? patch.commands
                        .map((entry) => normalizeLogicScriptCommand(entry))
                        .filter((entry): entry is TestWorldLogicScriptCommandConfig => entry !== null)
                    : [];
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'editor')) {
                if (patch.editor === null) {
                    next.editor = undefined;
                } else if (patch.editor) {
                    const mergedEditor = {
                        rawLines: Object.prototype.hasOwnProperty.call(patch.editor, 'rawLines')
                            ? patch.editor.rawLines
                            : next.editor?.rawLines,
                        locked: Object.prototype.hasOwnProperty.call(patch.editor, 'locked')
                            ? patch.editor.locked
                            : next.editor?.locked
                    };
                    next.editor = normalizeLogicScriptEditor(mergedEditor);
                }
                changed = true;
            }

            if (!changed) {
                return {
                    success: false,
                    reason: 'No valid script fields to update.'
                };
            }

            scripts[scriptIndex] = next;
            logic.scripts = scripts;

            if (next.id !== current.id) {
                logic.bindings = normalizeBindingList(logic.bindings).map((binding) => {
                    if (binding.scriptId !== current.id) {
                        return binding;
                    }
                    return {
                        ...binding,
                        scriptId: next.id
                    };
                });
            }

            return {
                success: true,
                script: next
            };
        });
    }

    public deleteScript(
        id: string,
        options?: { deleteBindings?: boolean }
    ): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const bindings = normalizeBindingList(logic.bindings);
            const scriptIndex = this.findScriptIndex(scripts, id);
            if (scriptIndex < 0) {
                return {
                    success: false,
                    reason: 'Logic script not found.'
                };
            }

            const script = scripts[scriptIndex];
            const hasBindingRefs = bindings.some((entry) => entry.scriptId === script.id);
            if (hasBindingRefs && !options?.deleteBindings) {
                return {
                    success: false,
                    reason: 'Logic script is referenced by bindings.'
                };
            }

            scripts.splice(scriptIndex, 1);
            logic.scripts = scripts;
            logic.bindings = options?.deleteBindings
                ? bindings.filter((entry) => entry.scriptId !== script.id)
                : bindings;
            return { success: true };
        });
    }

    public duplicateScript(id: string): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const scriptIndex = this.findScriptIndex(scripts, id);
            if (scriptIndex < 0) {
                return {
                    success: false,
                    reason: 'Logic script not found.'
                };
            }

            const source = scripts[scriptIndex];
            const nextScript = cloneLogicScript(source);
            nextScript.id = generateNextId('logic_script', new Set(scripts.map((entry) => entry.id)));
            nextScript.name = generateDuplicateName(source.name, new Set(scripts.map((entry) => entry.name)));
            scripts.push(nextScript);
            logic.scripts = scripts;
            return {
                success: true,
                script: nextScript
            };
        });
    }

    public createBinding(input: CreateLogicBindingInput): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const bindings = normalizeBindingList(logic.bindings);
            const scriptId = asOptionalString(input.scriptId);
            if (!scriptId || !scripts.some((entry) => entry.id === scriptId)) {
                return {
                    success: false,
                    reason: 'Binding scriptId must reference an existing script.'
                };
            }
            const targetType = asLogicBindingTargetType(input.targetType);
            if (!targetType) {
                return {
                    success: false,
                    reason: 'Invalid binding target type.'
                };
            }
            const slot = asOptionalString(input.slot);
            if (!slot) {
                return {
                    success: false,
                    reason: 'Binding slot must be a non-empty string.'
                };
            }

            const targetValidation = validateBindingTarget(nextConfig, targetType, input.targetId);
            if (!targetValidation.valid) {
                return {
                    success: false,
                    reason: targetValidation.reason ?? 'Invalid binding target.'
                };
            }

            const existingIds = new Set(bindings.map((entry) => entry.id));
            const bindingId = resolveId({
                requestedId: input.id,
                prefix: 'logic_binding',
                existingIds
            });
            const binding: TestWorldLogicBindingConfig = {
                id: bindingId,
                targetType,
                targetId: targetValidation.targetId,
                slot,
                scriptId,
                enabled: typeof input.enabled === 'boolean' ? input.enabled : true
            };
            bindings.push(binding);
            logic.bindings = bindings;
            return {
                success: true,
                binding
            };
        });
    }

    public updateBinding(id: string, patch: UpdateLogicBindingPatch): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const scripts = normalizeScriptList(logic.scripts);
            const bindings = normalizeBindingList(logic.bindings);
            const bindingIndex = this.findBindingIndex(bindings, id);
            if (bindingIndex < 0) {
                return {
                    success: false,
                    reason: 'Logic binding not found.'
                };
            }

            const current = bindings[bindingIndex];
            const next = cloneLogicBinding(current);
            let changed = false;

            if (Object.prototype.hasOwnProperty.call(patch, 'id')) {
                const nextId = asOptionalString(patch.id);
                if (!nextId) {
                    return { success: false, reason: 'Binding id must be a non-empty string.' };
                }
                if (nextId !== current.id && bindings.some((entry) => entry.id === nextId)) {
                    return { success: false, reason: 'Binding id already exists.' };
                }
                next.id = nextId;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'targetType')) {
                const nextTargetType = asLogicBindingTargetType(patch.targetType);
                if (!nextTargetType) {
                    return { success: false, reason: 'Invalid binding target type.' };
                }
                next.targetType = nextTargetType;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'scriptId')) {
                const nextScriptId = asOptionalString(patch.scriptId);
                if (!nextScriptId || !scripts.some((entry) => entry.id === nextScriptId)) {
                    return { success: false, reason: 'Binding scriptId must reference an existing script.' };
                }
                next.scriptId = nextScriptId;
                changed = true;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'slot')) {
                const nextSlot = asOptionalString(patch.slot);
                if (!nextSlot) {
                    return { success: false, reason: 'Binding slot must be a non-empty string.' };
                }
                next.slot = nextSlot;
                changed = true;
            }

            const targetInput = Object.prototype.hasOwnProperty.call(patch, 'targetId')
                ? patch.targetId
                : next.targetId;
            const targetValidation = validateBindingTarget(nextConfig, next.targetType, targetInput);
            if (!targetValidation.valid) {
                return {
                    success: false,
                    reason: targetValidation.reason ?? 'Invalid binding target.'
                };
            }
            next.targetId = targetValidation.targetId;

            if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
                next.enabled = typeof patch.enabled === 'boolean' ? patch.enabled : next.enabled;
                changed = true;
            }

            if (!changed && !Object.prototype.hasOwnProperty.call(patch, 'targetId')) {
                return {
                    success: false,
                    reason: 'No valid binding fields to update.'
                };
            }

            bindings[bindingIndex] = next;
            logic.bindings = bindings;
            return {
                success: true,
                binding: next
            };
        });
    }

    public deleteBinding(id: string): LogicMutationResult {
        return this.applyConfigEdit((nextConfig) => {
            const logic = this.ensureLogicForWrite(nextConfig);
            const bindings = normalizeBindingList(logic.bindings);
            const bindingIndex = this.findBindingIndex(bindings, id);
            if (bindingIndex < 0) {
                return {
                    success: false,
                    reason: 'Logic binding not found.'
                };
            }
            bindings.splice(bindingIndex, 1);
            logic.bindings = bindings;
            return { success: true };
        });
    }

    private getRuntimeConfig(): TestWorldConfig | null {
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds) {
            return null;
        }
        return config;
    }

    private createSnapshotFromConfig(config: TestWorldConfig): LogicSnapshot {
        const logic = resolveLogicForRead(config);
        return {
            levelId: config.meta.id,
            levelName: config.meta.displayName,
            scripts: logic.scripts,
            bindings: logic.bindings
        };
    }

    private ensureLogicForWrite(config: TestWorldConfig): TestWorldLogicConfig {
        if (!config.logic) {
            config.logic = {
                scripts: [],
                scriptRefs: [],
                bindings: []
            };
            return config.logic;
        }
        if (!Array.isArray(config.logic.scripts)) {
            config.logic.scripts = [];
        }
        if (!Array.isArray(config.logic.scriptRefs)) {
            config.logic.scriptRefs = [];
        }
        if (!Array.isArray(config.logic.bindings)) {
            config.logic.bindings = [];
        }
        return config.logic;
    }

    private applyConfigEdit(
        edit: (nextConfig: TestWorldConfig) => LogicMutationResult
    ): LogicMutationResult {
        if (!this.legacyObjectAdapter) {
            return {
                success: false,
                reason: 'Runtime adapter unavailable.'
            };
        }
        const runtimeConfig = this.getRuntimeConfig();
        if (!runtimeConfig) {
            return {
                success: false,
                reason: 'Runtime config unavailable.'
            };
        }

        const nextConfig = cloneTestWorldConfig(runtimeConfig);
        let editResult: LogicMutationResult;
        try {
            editResult = edit(nextConfig);
        } catch (error) {
            return {
                success: false,
                reason: error instanceof Error ? error.message : 'Failed to apply logic edit.'
            };
        }
        if (!editResult.success) {
            return editResult;
        }

        const importResult = this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        if (!importResult?.success) {
            return {
                success: false,
                reason: importResult?.reason ?? 'Failed to apply logic edit.'
            };
        }

        const snapshot = this.getSnapshot() ?? this.createSnapshotFromConfig(nextConfig);
        return {
            success: true,
            reason: editResult.reason,
            snapshot,
            script: editResult.script ? cloneLogicScript(editResult.script) : undefined,
            binding: editResult.binding ? cloneLogicBinding(editResult.binding) : undefined
        };
    }

    private findScriptIndex(scripts: TestWorldLogicScriptConfig[], id: string): number {
        const targetId = id.trim();
        if (!targetId) {
            return -1;
        }
        return scripts.findIndex((entry) => entry.id === targetId);
    }

    private findBindingIndex(bindings: TestWorldLogicBindingConfig[], id: string): number {
        const targetId = id.trim();
        if (!targetId) {
            return -1;
        }
        return bindings.findIndex((entry) => entry.id === targetId);
    }
}
