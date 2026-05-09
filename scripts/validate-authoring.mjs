import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const manifestRelPath = 'src/game/world/runtime/data/logic_scripts.json';
const dataRelDir = 'src/game/world/runtime/data';
const manifestPath = path.join(rootDir, manifestRelPath);

const CATEGORIES = new Set([
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

const EVENT_COMMANDS = new Set(['noop', 'set_world_flag', 'start_cutscene']);
const EVENT_CATEGORIES = new Set([
  'object.action',
  'platform.defaultAction',
  'platform.action',
  'npc.action',
  'npc.altAction',
  'cutscene.npc',
  'cutscene.camera',
  'cutscene.player',
  'cutscene.other',
  'trigger.action',
  'world.rule'
]);

const KNOWN_COMMANDS = new Set([
  ...EVENT_COMMANDS,
  'platform_move_ping_pong',
  'platform_rotate_constant',
  'npc_patrol_ping_pong'
]);

const diagnostics = [];

const asObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : null
);

const asNonEmptyString = (value) => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const pushDiagnostic = ({
  severity = 'error',
  code,
  message,
  scriptId,
  commandId,
  path: diagnosticPath,
  field
}) => {
  diagnostics.push({
    severity,
    code,
    message,
    scriptId,
    commandId,
    path: diagnosticPath,
    field
  });
};

const readJson = (filePath, displayPath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    pushDiagnostic({
      code: 'invalid_json',
      message: `${displayPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      path: displayPath
    });
    return null;
  }
};

const normalizeManifestPath = (value) => (
  value.replaceAll('\\', '/').trim().replace(/^\.\/+/, '').replace(/^\/+/, '')
);

const isValidManifestScriptPath = (value) => {
  if (!value || /^[a-zA-Z]:\//.test(value) || value.startsWith('//')) {
    return false;
  }
  if (!value.startsWith('scripts/') || !value.endsWith('.json')) {
    return false;
  }
  return !value.split('/').some((part) => part === '..');
};

const isPositiveFiniteNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const validateParams = (scriptId, command, commandPath) => {
  const params = asObject(command.params);
  if (command.params !== undefined && !params) {
    pushDiagnostic({
      code: 'invalid_logic_command_params',
      message: `Command "${command.id}" params must be an object when present.`,
      scriptId,
      commandId: command.id,
      path: `${commandPath}.params`,
      field: 'params'
    });
    return;
  }

  if (command.type === 'noop') {
    return;
  }

  if (command.type === 'set_world_flag') {
    if (!params || !asNonEmptyString(params.key) || typeof params.value !== 'boolean') {
      pushDiagnostic({
        code: 'invalid_logic_command_params',
        message: `Command "${command.id}" set_world_flag requires non-empty key and boolean value.`,
        scriptId,
        commandId: command.id,
        path: `${commandPath}.params`,
        field: 'params'
      });
    }
    return;
  }

  if (command.type === 'start_cutscene') {
    if (!params || !asNonEmptyString(params.cutsceneId)) {
      pushDiagnostic({
        code: 'invalid_logic_command_params',
        message: `Command "${command.id}" start_cutscene requires non-empty cutsceneId.`,
        scriptId,
        commandId: command.id,
        path: `${commandPath}.params.cutsceneId`,
        field: 'params.cutsceneId'
      });
    }
    return;
  }

  if (command.type === 'platform_move_ping_pong') {
    if (
      !params
      || (params.axis !== 'horizontal' && params.axis !== 'vertical')
      || !isPositiveFiniteNumber(params.distance)
      || !isPositiveFiniteNumber(params.speed)
      || (params.start !== undefined && !['running_loop', 'stopped', 'run_once'].includes(params.start))
    ) {
      pushDiagnostic({
        code: 'invalid_logic_command_params',
        message: `Command "${command.id}" platform_move_ping_pong requires axis, distance > 0, speed > 0, optional start.`,
        scriptId,
        commandId: command.id,
        path: `${commandPath}.params`,
        field: 'params'
      });
    }
    return;
  }

  if (command.type === 'platform_rotate_constant') {
    if (
      !params
      || !isPositiveFiniteNumber(params.angularSpeedDeg)
      || (params.direction !== undefined && !['clockwise', 'counterclockwise'].includes(params.direction))
      || (params.start !== undefined && !['running_loop', 'stopped'].includes(params.start))
    ) {
      pushDiagnostic({
        code: 'invalid_logic_command_params',
        message: `Command "${command.id}" platform_rotate_constant requires angularSpeedDeg > 0, optional direction/start.`,
        scriptId,
        commandId: command.id,
        path: `${commandPath}.params`,
        field: 'params'
      });
    }
    return;
  }

  if (command.type === 'npc_patrol_ping_pong') {
    if (
      !params
      || (params.axis !== 'horizontal' && params.axis !== 'vertical')
      || !isPositiveFiniteNumber(params.distance)
      || !isPositiveFiniteNumber(params.speed)
      || (params.start !== undefined && !['running_loop', 'stopped'].includes(params.start))
    ) {
      pushDiagnostic({
        code: 'invalid_logic_command_params',
        message: `Command "${command.id}" npc_patrol_ping_pong requires axis, distance > 0, speed > 0, optional start.`,
        scriptId,
        commandId: command.id,
        path: `${commandPath}.params`,
        field: 'params'
      });
    }
  }
};

const validateCategoryCompatibility = (script, command, commandPath) => {
  const type = command.type;
  let valid = true;
  let message = '';

  if (script.category === 'platform.move') {
    valid = type === 'platform_move_ping_pong';
    message = 'platform.move accepts platform_move_ping_pong.';
  } else if (script.category === 'platform.rotate') {
    valid = type === 'platform_rotate_constant';
    message = 'platform.rotate accepts platform_rotate_constant.';
  } else if (script.category === 'npc.patrol') {
    valid = type === 'npc_patrol_ping_pong';
    message = 'npc.patrol accepts npc_patrol_ping_pong.';
  } else if (EVENT_CATEGORIES.has(script.category)) {
    valid = EVENT_COMMANDS.has(type);
    message = `${script.category} accepts event commands only for now.`;
  }

  if (!valid) {
    pushDiagnostic({
      code: 'invalid_logic_command_category',
      message: `Script "${script.id}" command "${command.id}" type "${type}" is not valid for category "${script.category}": ${message}`,
      scriptId: script.id,
      commandId: command.id,
      path: `${commandPath}.type`,
      field: 'type'
    });
  }
};

const validateScriptFile = (script, scriptFilePath) => {
  const raw = asObject(script);
  if (!raw) {
    pushDiagnostic({
      code: 'invalid_logic_script_shape',
      message: `Script file "${scriptFilePath}" must contain a JSON object.`,
      path: scriptFilePath
    });
    return null;
  }

  const scriptId = asNonEmptyString(raw.id);
  if (!scriptId) {
    pushDiagnostic({
      code: 'invalid_logic_script_shape',
      message: `Script file "${scriptFilePath}" is missing a non-empty id.`,
      path: `${scriptFilePath}.id`,
      field: 'id'
    });
  }

  if (!asNonEmptyString(raw.name)) {
    pushDiagnostic({
      code: 'invalid_logic_script_name',
      message: `Script "${scriptId ?? scriptFilePath}" must have a non-empty name.`,
      scriptId,
      path: `${scriptFilePath}.name`,
      field: 'name'
    });
  }

  const category = asNonEmptyString(raw.category);
  if (!category || !CATEGORIES.has(category)) {
    pushDiagnostic({
      code: 'invalid_logic_script_category',
      message: `Script "${scriptId ?? scriptFilePath}" has invalid category "${String(raw.category)}".`,
      scriptId,
      path: `${scriptFilePath}.category`,
      field: 'category'
    });
  }

  if (!Array.isArray(raw.commands)) {
    pushDiagnostic({
      code: 'invalid_logic_script_commands',
      message: `Script "${scriptId ?? scriptFilePath}" must have a commands array.`,
      scriptId,
      path: `${scriptFilePath}.commands`,
      field: 'commands'
    });
    return scriptId && category ? { id: scriptId, category } : null;
  }

  const commandIds = new Set();
  raw.commands.forEach((commandValue, index) => {
    const commandPath = `${scriptFilePath}.commands[${index}]`;
    const command = asObject(commandValue);
    if (!command) {
      pushDiagnostic({
        code: 'invalid_logic_command_shape',
        message: `Script "${scriptId ?? scriptFilePath}" command ${index + 1} must be an object.`,
        scriptId,
        path: commandPath
      });
      return;
    }

    const commandId = asNonEmptyString(command.id);
    const commandType = asNonEmptyString(command.type);
    if (!commandId) {
      pushDiagnostic({
        code: 'invalid_logic_command_id',
        message: `Script "${scriptId ?? scriptFilePath}" command ${index + 1} is missing a non-empty id.`,
        scriptId,
        path: `${commandPath}.id`,
        field: 'id'
      });
    } else if (commandIds.has(commandId)) {
      pushDiagnostic({
        code: 'duplicate_logic_command_id',
        message: `Script "${scriptId ?? scriptFilePath}" has duplicate command id "${commandId}".`,
        scriptId,
        commandId,
        path: `${commandPath}.id`,
        field: 'id'
      });
    } else {
      commandIds.add(commandId);
    }

    if (!commandType || !KNOWN_COMMANDS.has(commandType)) {
      pushDiagnostic({
        code: 'unknown_logic_command_type',
        message: `Script "${scriptId ?? scriptFilePath}" command "${commandId ?? `command_${index + 1}`}" has unknown command type "${String(command.type)}".`,
        scriptId,
        commandId,
        path: `${commandPath}.type`,
        field: 'type'
      });
      return;
    }

    const normalizedCommand = { ...command, id: commandId, type: commandType };
    if (scriptId && category && CATEGORIES.has(category)) {
      validateCategoryCompatibility({ id: scriptId, category }, normalizedCommand, commandPath);
    }
    validateParams(scriptId, normalizedCommand, commandPath);
  });

  return scriptId && category ? { id: scriptId, category } : null;
};

const manifest = fs.existsSync(manifestPath)
  ? readJson(manifestPath, manifestRelPath)
  : null;

if (!manifest) {
  if (!fs.existsSync(manifestPath)) {
    pushDiagnostic({
      code: 'missing_logic_script_asset',
      message: `Missing manifest file ${manifestRelPath}.`,
      path: manifestRelPath
    });
  }
} else if (!asObject(manifest)) {
  pushDiagnostic({
    code: 'invalid_logic_manifest',
    message: `${manifestRelPath} must contain a JSON object.`,
    path: manifestRelPath
  });
} else if (!Array.isArray(manifest.scriptFiles)) {
  pushDiagnostic({
    code: 'invalid_logic_manifest',
    message: `${manifestRelPath} must define scriptFiles as an array.`,
    path: 'logic_scripts.json.scriptFiles',
    field: 'scriptFiles'
  });
} else {
  const seenPaths = new Set();
  const seenScriptIds = new Set();

  manifest.scriptFiles.forEach((entry, index) => {
    const manifestEntryPath = `logic_scripts.json.scriptFiles[${index}]`;
    const rawPath = asNonEmptyString(entry);
    if (!rawPath) {
      pushDiagnostic({
        code: 'invalid_logic_manifest_path',
        message: `Manifest entry at index ${index} must be a non-empty script file path.`,
        path: manifestEntryPath,
        field: 'scriptFiles'
      });
      return;
    }

    const scriptRelPath = normalizeManifestPath(rawPath);
    if (!isValidManifestScriptPath(scriptRelPath)) {
      pushDiagnostic({
        code: 'invalid_logic_manifest_path',
        message: `Manifest entry "${rawPath}" is not valid. Expected a relative scripts/*.json path.`,
        path: manifestEntryPath,
        field: 'scriptFiles'
      });
      return;
    }

    if (seenPaths.has(scriptRelPath)) {
      pushDiagnostic({
        code: 'duplicate_logic_script_ref',
        message: `Manifest contains duplicate script file path "${scriptRelPath}".`,
        path: manifestEntryPath,
        field: 'scriptFiles'
      });
      return;
    }
    seenPaths.add(scriptRelPath);

    const scriptDiskPath = path.join(rootDir, dataRelDir, scriptRelPath);
    if (!fs.existsSync(scriptDiskPath)) {
      pushDiagnostic({
        code: 'missing_logic_script_asset',
        message: `Manifest path "${scriptRelPath}" does not exist under ${dataRelDir}.`,
        path: manifestEntryPath,
        field: 'scriptFiles'
      });
      return;
    }

    const scriptJson = readJson(scriptDiskPath, scriptRelPath);
    if (!scriptJson) {
      return;
    }
    const scriptSummary = validateScriptFile(scriptJson, scriptRelPath);
    if (!scriptSummary?.id) {
      return;
    }
    if (seenScriptIds.has(scriptSummary.id)) {
      pushDiagnostic({
        code: 'duplicate_logic_script_id',
        message: `Duplicate external script id "${scriptSummary.id}".`,
        scriptId: scriptSummary.id,
        path: `${scriptRelPath}.id`,
        field: 'id'
      });
      return;
    }
    seenScriptIds.add(scriptSummary.id);
  });
}

const warnings = diagnostics.filter((entry) => entry.severity === 'warning');
const errors = diagnostics.filter((entry) => entry.severity === 'error');

console.log(`Authoring validation: ${errors.length} error(s), ${warnings.length} warning(s).`);

if (diagnostics.length > 0) {
  for (const diagnostic of diagnostics) {
    const parts = [
      `[${diagnostic.severity}]`,
      `[${diagnostic.code}]`
    ];
    if (diagnostic.scriptId) {
      parts.push(`script=${diagnostic.scriptId}`);
    }
    if (diagnostic.commandId) {
      parts.push(`command=${diagnostic.commandId}`);
    }
    if (diagnostic.field) {
      parts.push(`field=${diagnostic.field}`);
    }
    if (diagnostic.path) {
      parts.push(`path=${diagnostic.path}`);
    }
    parts.push(diagnostic.message);
    console.log(parts.join(' '));
  }
}

if (errors.length > 0) {
  process.exitCode = 1;
}
