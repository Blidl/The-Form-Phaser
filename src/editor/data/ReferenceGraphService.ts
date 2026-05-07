// ReferenceGraph Lite service for script usage analysis.
// This service is pure/read-only and does not depend on ProjectStore as canonical source.
// It takes runtime config and external script assets as inputs.

import type { TestWorldConfig } from '../../game/world/runtime/test_world_config';
import type { TestWorldLogicScriptConfig } from '../../game/world/runtime/test_world_config';

// Entry types for script users
export interface ScriptUserEntry {
  kind: 'logic_script_ref' | 'logic_binding' | 'surface_behavior';
  scriptId: string;
  // For logic_script_ref
  path?: string; // e.g., "logic.scriptRefs[0]"
  // For logic_binding
  bindingId?: string;
  targetType?: string;
  targetId?: string;
  slot?: string;
  enabled?: boolean;
  // For surface_behavior
  surfaceId?: string;
  field?: 'move' | 'rotate' | 'defaultAction' | 'actions';
  actionIndex?: number;
  // Common
  pathInConfig?: string; // e.g., "logic.scriptRefs[0]" or "logic.bindings[2]" or "surfaces[3].behaviorScripts.move"
}

// Entry types for script dependencies (e.g., cutscene dependencies)
export interface ScriptDependencyEntry {
  kind: 'cutscene_dependency';
  scriptId: string;
  commandId: string;
  cutsceneId: string;
  pathInConfig?: string; // e.g., "scripts[0].commands[2]"
}

// Entry types for cutscene users (reverse of ScriptDependencyEntry)
export interface CutsceneUserEntry {
  scriptId: string;
  commandId: string;
  pathInConfig?: string;
}

// The reference graph structure
interface ReferenceGraph {
  // Map scriptId -> array of users
  scriptUsers: Map<string, ScriptUserEntry[]>;
  // Map scriptId -> array of dependencies (cutscenes it depends on)
  scriptDependencies: Map<string, ScriptDependencyEntry[]>;
  // Map cutsceneId -> array of scripts that depend on it
  cutsceneUsers: Map<string, CutsceneUserEntry[]>;
  // Set of all known scriptIds from external assets
  knownScriptIds: Set<string>;
}

/**
 * Builds a read-only reference graph from the current runtime config and external script assets.
 * @param config The current runtime config / level config.
 * @param externalScripts The external script assets (same as config.logic.scripts).
 * @returns A reference graph that can be queried.
 */
export function buildReferenceGraph(
  config: TestWorldConfig,
  externalScripts: TestWorldLogicScriptConfig[]
): ReferenceGraph {
  const knownScriptIds = new Set<string>();
  externalScripts.forEach(s => knownScriptIds.add(s.id));

  const scriptUsers = new Map<string, ScriptUserEntry[]>();
  const scriptDependencies = new Map<string, ScriptDependencyEntry[]>();
  const cutsceneUsers = new Map<string, CutsceneUserEntry[]>;

  // Helper to add to a map of arrays
  const addToMap = <T>(map: Map<string, T[]>, key: string, value: T) => {
    const arr = map.get(key) ?? [];
    arr.push(value);
    map.set(key, arr);
  };

  // Process logic.scriptRefs
  config.logic.scriptRefs.forEach((ref, index) => {
    const path = `logic.scriptRefs[${index}]`;
    const entry: ScriptUserEntry = {
      kind: 'logic_script_ref',
      scriptId: ref.id ?? '', // Assuming ref.id exists; if not, we may need to adjust
      pathInConfig: path,
    };
    addToMap(scriptUsers, ref.id ?? '', entry);
  });

  // Process logic.bindings
  config.logic.bindings.forEach((binding, index) => {
    const path = `logic.bindings[${index}]`;
    const entry: ScriptUserEntry = {
      kind: 'logic_binding',
      scriptId: binding.scriptId,
      bindingId: binding.id,
      targetType: binding.targetType,
      targetId: binding.targetId,
      slot: binding.slot,
      enabled: binding.enabled,
      pathInConfig: path,
    };
    addToMap(scriptUsers, binding.scriptId, entry);
  });

  // Process surfaces[].behaviorScripts
  config.surfaces.forEach((surface, surfaceIndex) => {
    const behavior = surface.behaviorScripts;
    if (!behavior) return;

    // move
    if (behavior.move) {
      const path = `surfaces[${surfaceIndex}].behaviorScripts.move`;
      const entry: ScriptUserEntry = {
        kind: 'surface_behavior',
        scriptId: behavior.move,
        surfaceId: surface.id,
        field: 'move',
        pathInConfig: path,
      };
      addToMap(scriptUsers, behavior.move, entry);
    }

    // rotate
    if (behavior.rotate) {
      const path = `surfaces[${surfaceIndex}].behaviorScripts.rotate`;
      const entry: ScriptUserEntry = {
        kind: 'surface_behavior',
        scriptId: behavior.rotate,
        surfaceId: surface.id,
        field: 'rotate',
        pathInConfig: path,
      };
      addToMap(scriptUsers, behavior.rotate, entry);
    }

    // defaultAction
    if (behavior.defaultAction) {
      const path = `surfaces[${surfaceIndex}].behaviorScripts.defaultAction`;
      const entry: ScriptUserEntry = {
        kind: 'surface_behavior',
        scriptId: behavior.defaultAction,
        surfaceId: surface.id,
        field: 'defaultAction',
        pathInConfig: path,
      };
      addToMap(scriptUsers, behavior.defaultAction, entry);
    }

    // actions array
    if (behavior.actions) {
      behavior.actions.forEach((actionScriptId, actionIndex) => {
        if (!actionScriptId) return;
        const path = `surfaces[${surfaceIndex}].behaviorScripts.actions[${actionIndex}]`;
        const entry: ScriptUserEntry = {
          kind: 'surface_behavior',
          scriptId: actionScriptId,
          surfaceId: surface.id,
          field: 'actions',
          actionIndex: actionIndex,
          pathInConfig: path,
        };
        addToMap(scriptUsers, actionScriptId, entry);
      });
    }
  });

  // Process script dependencies (start_cutscene commands)
  externalScripts.forEach((script, scriptIndex) => {
    script.commands.forEach((command, commandIndex) => {
      if (command.type === 'start_cutscene') {
        const cutsceneId = command.params.cutsceneId as string | undefined;
        if (!cutsceneId) return;

        const path = `scripts[${scriptIndex}].commands[${commandIndex}]`;
        const dependencyEntry: ScriptDependencyEntry = {
          kind: 'cutscene_dependency',
          scriptId: script.id,
          commandId: command.id,
          cutsceneId,
          pathInConfig: path,
        };
        addToMap(scriptDependencies, script.id, dependencyEntry);
        addToMap(cutsceneUsers, cutsceneId, {
          scriptId: script.id,
          commandId: command.id,
          pathInConfig: path,
        });
      }
    });
  });

  return {
    scriptUsers,
    scriptDependencies,
    cutsceneUsers,
    knownScriptIds,
  };
}

/**
 * Returns all users (references) of a given script.
 * @param graph The reference graph.
 * @param scriptId The ID of the script to query.
 * @returns Array of ScriptUserEntry, empty if none.
 */
export function getScriptUsers(
  graph: ReferenceGraph,
  scriptId: string
): ScriptUserEntry[] {
  return graph.scriptUsers.get(scriptId) ?? [];
}

/**
 * Returns references to a script that are missing (i.e., the scriptId is not in the known external scripts).
 * @param graph The reference graph.
 * @returns Array of ScriptUserEntry for missing scripts.
 */
export function getMissingScriptReferences(
  graph: ReferenceGraph
): ScriptUserEntry[] {
  const missing: ScriptUserEntry[] = [];
  graph.scriptUsers.forEach((users, scriptId) => {
    if (!graph.knownScriptIds.has(scriptId)) {
      missing.push(...users);
    }
  });
  return missing;
}

/**
 * Returns dependencies (e.g., cutscenes) of a given script.
 * @param graph The reference graph.
 * @param scriptId The ID of the script to query.
 * @returns Array of ScriptDependencyEntry, empty if none.
 */
export function getScriptDependencies(
  graph: ReferenceGraph,
  scriptId: string
): ScriptDependencyEntry[] {
  return graph.scriptDependencies.get(scriptId) ?? [];
}

/**
 * Returns which scripts depend on a given cutscene (via start_cutscene command).
 * @param graph The reference graph.
 * @param cutsceneId The ID of the cutscene to query.
 * @returns Array of CutsceneUserEntry, empty if none.
 */
export function getCutsceneUsers(
  graph: ReferenceGraph,
  cutsceneId: string
): CutsceneUserEntry[] {
  return graph.cutsceneUsers.get(cutsceneId) ?? [];
}

/**
 * Returns delete impact information for a script: its users and whether it is missing.
 * @param graph The reference graph.
 * @param scriptId The ID of the script to check.
 * @returns Object containing users and a missing flag.
 */
export function getDeleteImpactForScript(
  graph: ReferenceGraph,
  scriptId: string
): {
  users: ScriptUserEntry[];
  missing: boolean;
} {
  const users = getScriptUsers(graph, scriptId);
  const missing = !graph.knownScriptIds.has(scriptId);
  return { users, missing };
}