import type {
    TestWorldLogicBindingConfig,
    TestWorldLogicBindingTargetType,
    TestWorldLogicScriptCategory,
    TestWorldLogicScriptCommandConfig,
    TestWorldLogicScriptConfig,
    TestWorldLogicScriptEditorConfig,
    TestWorldLogicScriptRefConfig
} from '../../game/world/runtime/test_world_config';

export interface LogicSnapshot {
    levelId: string;
    levelName: string;
    scripts: TestWorldLogicScriptConfig[];
    scriptRefs: TestWorldLogicScriptRefConfig[];
    bindings: TestWorldLogicBindingConfig[];
}

export interface LogicMutationResult {
    success: boolean;
    reason?: string;
    snapshot?: LogicSnapshot;
    script?: TestWorldLogicScriptConfig;
    scriptRef?: TestWorldLogicScriptRefConfig;
    binding?: TestWorldLogicBindingConfig;
}

export interface CreateLogicScriptRefInput {
    id: string;
    path?: string;
    displayName?: string;
}

export interface UpdateLogicScriptRefPatch {
    path?: string;
    displayName?: string;
}

export interface CreateLogicScriptInput {
    id?: string;
    name?: string;
    category: TestWorldLogicScriptCategory | string;
    commands?: TestWorldLogicScriptCommandConfig[];
    editor?: TestWorldLogicScriptEditorConfig;
}

export interface UpdateLogicScriptPatch {
    id?: string;
    name?: string;
    category?: TestWorldLogicScriptCategory | string;
    commands?: TestWorldLogicScriptCommandConfig[];
    editor?: {
        rawLines?: string[];
        locked?: boolean;
    } | null;
}

export interface CreateLogicBindingInput {
    id?: string;
    targetType: TestWorldLogicBindingTargetType | string;
    targetId?: string;
    slot: string;
    scriptId: string;
    enabled?: boolean;
}

export interface UpdateLogicBindingPatch {
    id?: string;
    targetType?: TestWorldLogicBindingTargetType | string;
    targetId?: string;
    slot?: string;
    scriptId?: string;
    enabled?: boolean;
}
