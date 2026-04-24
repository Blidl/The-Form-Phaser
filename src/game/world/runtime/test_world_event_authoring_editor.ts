
import type { ActorAction } from '../../actor_actions/actor_action_types';
import type { TestEventAction, TestEventBlock } from '../../events/test_event_actions';
import type { TestEventCondition } from '../../events/test_event_conditions';
import { TEST_NPC_MANPU_EMOTION_OPTIONS } from '../../npc/npc_manpu';
import type { TestWorldTriggerVolumeConfig } from './test_world_config';
import type { TestWorldEditorSidebarFieldOption, TestWorldEditorSidebarSection } from './test_world_editor_sidebar';

const EVENT_EDITOR_PREFIX = 'event';
const PLAYER_FORM_IDS = ['ball', 'triangle', 'square'] as const;

const EVENT_ACTION_KIND_OPTIONS: TestWorldEditorSidebarFieldOption[] = [
    { value: 'actor_action', label: 'actor_action' },
    { value: 'start_cutscene', label: 'start_cutscene' },
    { value: 'set_flag', label: 'set_flag' },
    { value: 'trigger_event', label: 'trigger_event' },
    { value: 'play_sfx', label: 'play_sfx (stub)' },
    { value: 'spawn_vfx', label: 'spawn_vfx (stub)' }
];

const EVENT_CONDITION_KIND_OPTIONS: TestWorldEditorSidebarFieldOption[] = [
    { value: 'flag', label: 'flag' },
    { value: 'once', label: 'once' },
    { value: 'player_form', label: 'player_form' }
];

const EVENT_ACTOR_ACTION_KIND_OPTIONS: TestWorldEditorSidebarFieldOption[] = [
    { value: 'set_emotion', label: 'set_emotion' },
    { value: 'trigger_event', label: 'trigger_event' }
];

const EVENT_PHASES = [
    { key: 'onEnter', label: 'On Enter Blocks' },
    { key: 'onExit', label: 'On Exit Blocks' },
    { key: 'onStay', label: 'On Stay Blocks' }
] as const;

type EventPhaseKey = typeof EVENT_PHASES[number]['key'];

export interface TriggerEventEditorOptions {
    npcIds: readonly string[];
    cutsceneRefs: readonly string[];
}

export interface TriggerEventEditorApplyResult {
    handled: boolean;
    changed: boolean;
    warning?: string;
}

const cloneCondition = (condition: TestEventCondition | Record<string, unknown>): TestEventCondition | Record<string, unknown> => {
    return { ...condition };
};

const cloneActorAction = (action: ActorAction | Record<string, unknown>): ActorAction | Record<string, unknown> => {
    if (action && typeof action === 'object') {
        return { ...action };
    }
    return action;
};

const cloneEventAction = (action: TestEventAction | Record<string, unknown>): TestEventAction | Record<string, unknown> => {
    if (!action || typeof action !== 'object') {
        return action;
    }
    if (action.kind === 'actor_action') {
        return {
            ...action,
            action: cloneActorAction(action.action)
        };
    }
    return { ...action };
};

const cloneEventBlock = (block: TestEventBlock): TestEventBlock => {
    return {
        ...block,
        conditions: block.conditions?.map((entry) => cloneCondition(entry) as TestEventCondition),
        actions: block.actions.map((entry) => cloneEventAction(entry) as TestEventAction)
    };
};

const getPhaseBlocks = (
    trigger: TestWorldTriggerVolumeConfig,
    phase: EventPhaseKey
): TestEventBlock[] => {
    const blocks = trigger[phase];
    if (!Array.isArray(blocks)) {
        return [];
    }
    return blocks.map((entry) => cloneEventBlock(entry));
};

const setPhaseBlocks = (
    trigger: TestWorldTriggerVolumeConfig,
    phase: EventPhaseKey,
    blocks: TestEventBlock[]
): void => {
    trigger[phase] = blocks.length > 0 ? blocks : undefined;
};

const isKnownConditionKind = (kind: unknown): kind is TestEventCondition['kind'] => {
    return kind === 'flag' || kind === 'once' || kind === 'player_form';
};

const isKnownActionKind = (kind: unknown): kind is TestEventAction['kind'] => {
    return kind === 'actor_action'
        || kind === 'start_cutscene'
        || kind === 'set_flag'
        || kind === 'trigger_event'
        || kind === 'play_sfx'
        || kind === 'spawn_vfx';
};

const isKnownActorActionKind = (kind: unknown): kind is 'set_emotion' | 'trigger_event' => {
    return kind === 'set_emotion' || kind === 'trigger_event';
};

const normalizeText = (value: unknown): string => {
    return typeof value === 'string' ? value : String(value ?? '');
};

const toPhaseKey = (value: string): EventPhaseKey | null => {
    if (value === 'onEnter' || value === 'onExit' || value === 'onStay') {
        return value;
    }
    return null;
};

const resolveOptionSetWithUnknown = (
    options: readonly TestWorldEditorSidebarFieldOption[],
    value: string,
    missingLabelPrefix: string
): TestWorldEditorSidebarFieldOption[] => {
    if (options.some((entry) => entry.value === value)) {
        return [...options];
    }
    if (value.trim().length <= 0) {
        return [...options];
    }
    return [
        { value, label: `${value} (${missingLabelPrefix})` },
        ...options
    ];
};

const createDefaultCondition = (): TestEventCondition => {
    return {
        kind: 'once'
    };
};

const createDefaultActorAction = (): ActorAction => {
    return {
        kind: 'set_emotion',
        emotionId: 'anger'
    };
};

const createDefaultAction = (npcIds: readonly string[]): TestEventAction => {
    return {
        kind: 'actor_action',
        actorId: npcIds[0] ?? '',
        action: createDefaultActorAction()
    };
};

const createDefaultBlock = (phase: EventPhaseKey, index: number, npcIds: readonly string[]): TestEventBlock => {
    return {
        id: `${phase}_block_${index + 1}`,
        conditions: [],
        actions: [createDefaultAction(npcIds)]
    };
};
const parseEventFieldKey = (fieldKey: string): {
    phase: EventPhaseKey;
    blockIndex: number;
    scope: 'id' | 'condition' | 'action';
    itemIndex?: number;
    field?: string;
} | null => {
    const parts = fieldKey.split(':');
    if (parts.length < 5 || parts[0] !== EVENT_EDITOR_PREFIX) {
        return null;
    }

    const phase = toPhaseKey(parts[1]);
    if (!phase || parts[2] !== 'block') {
        return null;
    }

    const blockIndex = Number(parts[3]);
    if (!Number.isInteger(blockIndex) || blockIndex < 0) {
        return null;
    }

    if (parts[4] === 'id') {
        return {
            phase,
            blockIndex,
            scope: 'id'
        };
    }

    if ((parts[4] === 'condition' || parts[4] === 'action') && parts.length >= 7) {
        const itemIndex = Number(parts[5]);
        if (!Number.isInteger(itemIndex) || itemIndex < 0) {
            return null;
        }
        return {
            phase,
            blockIndex,
            scope: parts[4],
            itemIndex,
            field: parts.slice(6).join(':')
        };
    }

    return null;
};

const parseEventActionId = (actionId: string): {
    phase: EventPhaseKey;
    op: string;
    blockIndex?: number;
    itemIndex?: number;
} | null => {
    const parts = actionId.split(':');
    if (parts.length < 3 || parts[0] !== EVENT_EDITOR_PREFIX) {
        return null;
    }

    const phase = toPhaseKey(parts[1]);
    if (!phase) {
        if (actionId === 'event:add_manpu_pair') {
            return {
                phase: 'onEnter',
                op: 'add_manpu_pair'
            };
        }
        return null;
    }

    if (parts[2] === 'add_block') {
        return { phase, op: 'add_block' };
    }

    if (parts[2] !== 'block' || parts.length < 5) {
        return null;
    }

    const blockIndex = Number(parts[3]);
    if (!Number.isInteger(blockIndex) || blockIndex < 0) {
        return null;
    }

    if (parts[4] === 'delete' || parts[4] === 'add_condition' || parts[4] === 'add_action') {
        return {
            phase,
            op: parts[4],
            blockIndex
        };
    }

    if ((parts[4] === 'condition' || parts[4] === 'action') && parts.length >= 7) {
        const itemIndex = Number(parts[5]);
        if (!Number.isInteger(itemIndex) || itemIndex < 0) {
            return null;
        }
        return {
            phase,
            op: `${parts[4]}_${parts[6]}`,
            blockIndex,
            itemIndex
        };
    }

    return null;
};

const moveArrayEntry = <T>(items: T[], index: number, offset: -1 | 1): boolean => {
    const nextIndex = index + offset;
    if (index < 0 || index >= items.length || nextIndex < 0 || nextIndex >= items.length) {
        return false;
    }

    const [item] = items.splice(index, 1);
    items.splice(nextIndex, 0, item);
    return true;
};

export const applyTriggerEventEditorFieldChange = (
    trigger: TestWorldTriggerVolumeConfig,
    fieldKey: string,
    value: string | number | boolean,
    options: TriggerEventEditorOptions
): TriggerEventEditorApplyResult => {
    const parsed = parseEventFieldKey(fieldKey);
    if (!parsed) {
        return { handled: false, changed: false };
    }

    const blocks = getPhaseBlocks(trigger, parsed.phase);
    const block = blocks[parsed.blockIndex];
    if (!block) {
        return { handled: true, changed: false };
    }

    if (parsed.scope === 'id') {
        block.id = normalizeText(value);
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (parsed.scope === 'condition') {
        if (typeof parsed.itemIndex !== 'number' || !parsed.field) {
            return { handled: true, changed: false };
        }

        const conditions = [...(block.conditions ?? [])] as Array<TestEventCondition | Record<string, unknown>>;
        const currentCondition = conditions[parsed.itemIndex];
        if (!currentCondition || typeof currentCondition !== 'object') {
            return { handled: true, changed: false };
        }

        let nextCondition = cloneCondition(currentCondition);
        if (parsed.field === 'kind') {
            const nextKind = normalizeText(value);
            if (!isKnownConditionKind(nextKind)) {
                (nextCondition as Record<string, unknown>).kind = nextKind;
            } else if (nextKind === 'flag') {
                nextCondition = { kind: 'flag', flagId: 'flag_id', equals: true };
            } else if (nextKind === 'once') {
                nextCondition = { kind: 'once' };
            } else {
                nextCondition = { kind: 'player_form', form: PLAYER_FORM_IDS[0] };
            }
        } else if ((nextCondition as Record<string, unknown>).kind === 'flag') {
            const typed = nextCondition as TestEventCondition & { kind: 'flag' };
            if (parsed.field === 'flagId') {
                typed.flagId = normalizeText(value);
            } else if (parsed.field === 'equals' && typeof value === 'boolean') {
                typed.equals = value;
            }
        } else if ((nextCondition as Record<string, unknown>).kind === 'once') {
            const typed = nextCondition as TestEventCondition & { kind: 'once' };
            if (parsed.field === 'key') {
                const key = normalizeText(value).trim();
                typed.key = key.length > 0 ? key : undefined;
            }
        } else if ((nextCondition as Record<string, unknown>).kind === 'player_form') {
            const typed = nextCondition as TestEventCondition & { kind: 'player_form' };
            if (parsed.field === 'form') {
                typed.form = normalizeText(value);
            }
        }

        conditions[parsed.itemIndex] = nextCondition as TestEventCondition;
        block.conditions = conditions as TestEventCondition[];
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (typeof parsed.itemIndex !== 'number' || !parsed.field) {
        return { handled: true, changed: false };
    }

    const actions = [...block.actions] as Array<TestEventAction | Record<string, unknown>>;
    const currentAction = actions[parsed.itemIndex];
    if (!currentAction || typeof currentAction !== 'object') {
        return { handled: true, changed: false };
    }

    let nextAction = cloneEventAction(currentAction);
    if (parsed.field === 'kind') {
        const nextKind = normalizeText(value);
        if (!isKnownActionKind(nextKind)) {
            (nextAction as Record<string, unknown>).kind = nextKind;
        } else if (nextKind === 'actor_action') {
            nextAction = createDefaultAction(options.npcIds);
        } else if (nextKind === 'start_cutscene') {
            nextAction = {
                kind: 'start_cutscene',
                cutsceneRef: options.cutsceneRefs[0] ?? ''
            };
        } else if (nextKind === 'set_flag') {
            nextAction = {
                kind: 'set_flag',
                flagId: 'flag_id',
                value: true
            };
        } else if (nextKind === 'trigger_event') {
            nextAction = {
                kind: 'trigger_event',
                eventId: 'event_id'
            };
        } else if (nextKind === 'play_sfx') {
            nextAction = {
                kind: 'play_sfx',
                sfxId: 'sfx_id'
            };
        } else {
            nextAction = {
                kind: 'spawn_vfx',
                vfxId: 'vfx_id'
            };
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'actor_action') {
        const typed = nextAction as TestEventAction & { kind: 'actor_action' };
        if (parsed.field === 'actorId') {
            typed.actorId = normalizeText(value);
        } else if (parsed.field === 'actorActionKind') {
            const actorActionKind = normalizeText(value);
            if (isKnownActorActionKind(actorActionKind)) {
                typed.action = actorActionKind === 'set_emotion'
                    ? { kind: 'set_emotion', emotionId: 'anger' }
                    : { kind: 'trigger_event', eventId: 'event_id' };
            }
        } else if (parsed.field === 'emotionId' && typed.action.kind === 'set_emotion') {
            typed.action = {
                ...typed.action,
                emotionId: normalizeText(value)
            };
        } else if (parsed.field === 'eventId' && typed.action.kind === 'trigger_event') {
            typed.action = {
                ...typed.action,
                eventId: normalizeText(value)
            };
        } else if (parsed.field === 'payloadJson' && typed.action.kind === 'trigger_event') {
            const rawPayload = normalizeText(value).trim();
            if (rawPayload.length <= 0) {
                typed.action = {
                    ...typed.action,
                    payload: undefined
                };
            } else {
                try {
                    const parsedPayload = JSON.parse(rawPayload) as unknown;
                    if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
                        return {
                            handled: true,
                            changed: false,
                            warning: 'actor_action.trigger_event payload must be a JSON object'
                        };
                    }
                    typed.action = {
                        ...typed.action,
                        payload: parsedPayload as Record<string, unknown>
                    };
                } catch {
                    return {
                        handled: true,
                        changed: false,
                        warning: 'actor_action.trigger_event payload JSON is invalid'
                    };
                }
            }
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'start_cutscene') {
        const typed = nextAction as TestEventAction & { kind: 'start_cutscene' };
        if (parsed.field === 'cutsceneRef') {
            typed.cutsceneRef = normalizeText(value);
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'set_flag') {
        const typed = nextAction as TestEventAction & { kind: 'set_flag' };
        if (parsed.field === 'flagId') {
            typed.flagId = normalizeText(value);
        } else if (parsed.field === 'value' && typeof value === 'boolean') {
            typed.value = value;
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'trigger_event') {
        const typed = nextAction as TestEventAction & { kind: 'trigger_event' };
        if (parsed.field === 'eventId') {
            typed.eventId = normalizeText(value);
        } else if (parsed.field === 'payloadJson') {
            const rawPayload = normalizeText(value).trim();
            if (rawPayload.length <= 0) {
                typed.payload = undefined;
            } else {
                try {
                    const parsedPayload = JSON.parse(rawPayload) as unknown;
                    if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
                        return {
                            handled: true,
                            changed: false,
                            warning: 'trigger_event payload must be a JSON object'
                        };
                    }
                    typed.payload = parsedPayload as Record<string, unknown>;
                } catch {
                    return {
                        handled: true,
                        changed: false,
                        warning: 'trigger_event payload JSON is invalid'
                    };
                }
            }
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'play_sfx') {
        const typed = nextAction as TestEventAction & { kind: 'play_sfx' };
        if (parsed.field === 'sfxId') {
            typed.sfxId = normalizeText(value);
        }
    } else if ((nextAction as Record<string, unknown>).kind === 'spawn_vfx') {
        const typed = nextAction as TestEventAction & { kind: 'spawn_vfx' };
        if (parsed.field === 'vfxId') {
            typed.vfxId = normalizeText(value);
        } else if (parsed.field === 'vfxActorId') {
            const nextActorId = normalizeText(value).trim();
            typed.actorId = nextActorId.length > 0 ? nextActorId : undefined;
        } else if (parsed.field === 'x') {
            typed.x = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        } else if (parsed.field === 'y') {
            typed.y = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        }
    }

    actions[parsed.itemIndex] = nextAction as TestEventAction;
    block.actions = actions as TestEventAction[];
    setPhaseBlocks(trigger, parsed.phase, blocks);
    return { handled: true, changed: true };
};

export const applyTriggerEventEditorAction = (
    trigger: TestWorldTriggerVolumeConfig,
    actionId: string,
    options: TriggerEventEditorOptions
): TriggerEventEditorApplyResult => {
    if (actionId === 'event:add_manpu_pair') {
        const npcId = options.npcIds[0];
        if (!npcId) {
            return {
                handled: true,
                changed: false,
                warning: 'no NPCs available for manpu pair'
            };
        }

        const onEnter = getPhaseBlocks(trigger, 'onEnter');
        const onExit = getPhaseBlocks(trigger, 'onExit');
        onEnter.push({
            id: `onEnter_manpu_${onEnter.length + 1}`,
            actions: [
                {
                    kind: 'actor_action',
                    actorId: npcId,
                    action: {
                        kind: 'set_emotion',
                        emotionId: 'anger'
                    }
                }
            ]
        });
        onExit.push({
            id: `onExit_manpu_${onExit.length + 1}`,
            actions: [
                {
                    kind: 'actor_action',
                    actorId: npcId,
                    action: {
                        kind: 'set_emotion',
                        emotionId: 'calm'
                    }
                }
            ]
        });
        setPhaseBlocks(trigger, 'onEnter', onEnter);
        setPhaseBlocks(trigger, 'onExit', onExit);
        return {
            handled: true,
            changed: true
        };
    }

    const parsed = parseEventActionId(actionId);
    if (!parsed) {
        return { handled: false, changed: false };
    }

    const blocks = getPhaseBlocks(trigger, parsed.phase);
    if (parsed.op === 'add_block') {
        blocks.push(createDefaultBlock(parsed.phase, blocks.length, options.npcIds));
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (typeof parsed.blockIndex !== 'number') {
        return { handled: true, changed: false };
    }

    if (!blocks[parsed.blockIndex]) {
        return { handled: true, changed: false };
    }

    if (parsed.op === 'delete') {
        blocks.splice(parsed.blockIndex, 1);
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    const block = blocks[parsed.blockIndex];
    if (parsed.op === 'add_condition') {
        const conditions = [...(block.conditions ?? [])];
        conditions.push(createDefaultCondition());
        block.conditions = conditions;
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (parsed.op === 'add_action') {
        block.actions = [...block.actions, createDefaultAction(options.npcIds)];
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (typeof parsed.itemIndex !== 'number') {
        return { handled: true, changed: false };
    }

    if (parsed.op.startsWith('condition_')) {
        const conditions = [...(block.conditions ?? [])];
        if (!conditions[parsed.itemIndex]) {
            return { handled: true, changed: false };
        }
        if (parsed.op === 'condition_delete') {
            conditions.splice(parsed.itemIndex, 1);
            block.conditions = conditions.length > 0 ? conditions : undefined;
        } else if (parsed.op === 'condition_move_up') {
            if (!moveArrayEntry(conditions, parsed.itemIndex, -1)) {
                return { handled: true, changed: false };
            }
            block.conditions = conditions;
        } else if (parsed.op === 'condition_move_down') {
            if (!moveArrayEntry(conditions, parsed.itemIndex, 1)) {
                return { handled: true, changed: false };
            }
            block.conditions = conditions;
        }
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    if (parsed.op.startsWith('action_')) {
        const actions = [...block.actions];
        if (!actions[parsed.itemIndex]) {
            return { handled: true, changed: false };
        }
        if (parsed.op === 'action_delete') {
            actions.splice(parsed.itemIndex, 1);
        } else if (parsed.op === 'action_move_up') {
            if (!moveArrayEntry(actions, parsed.itemIndex, -1)) {
                return { handled: true, changed: false };
            }
        } else if (parsed.op === 'action_move_down') {
            if (!moveArrayEntry(actions, parsed.itemIndex, 1)) {
                return { handled: true, changed: false };
            }
        }

        if (actions.length <= 0) {
            return {
                handled: true,
                changed: false,
                warning: 'event block must contain at least one action'
            };
        }

        block.actions = actions;
        setPhaseBlocks(trigger, parsed.phase, blocks);
        return { handled: true, changed: true };
    }

    return { handled: true, changed: false };
};
const buildConditionFields = (
    phase: EventPhaseKey,
    blockIndex: number,
    condition: TestEventCondition,
    conditionIndex: number
): TestWorldEditorSidebarSection['fields'] => {
    const conditionBaseKey = `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:condition:${conditionIndex}`;
    const rawKind = (condition as { kind?: string }).kind;
    const kind = typeof rawKind === 'string' ? rawKind : 'once';
    const kindOptions = resolveOptionSetWithUnknown(
        EVENT_CONDITION_KIND_OPTIONS,
        kind,
        'unsupported'
    );

    const fields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: `${conditionBaseKey}:kind`,
            label: `Condition ${conditionIndex + 1} Kind`,
            input: 'select',
            value: kind,
            options: kindOptions
        }
    ];

    if (kind === 'flag') {
        const typed = condition as TestEventCondition & { kind: 'flag' };
        fields.push(
            {
                key: `${conditionBaseKey}:flagId`,
                label: `Condition ${conditionIndex + 1} Flag Id`,
                input: 'text',
                value: typed.flagId
            },
            {
                key: `${conditionBaseKey}:equals`,
                label: `Condition ${conditionIndex + 1} Equals`,
                input: 'checkbox',
                value: typed.equals
            }
        );
    } else if (kind === 'once') {
        const typed = condition as TestEventCondition & { kind: 'once' };
        fields.push({
            key: `${conditionBaseKey}:key`,
            label: `Condition ${conditionIndex + 1} Once Key (Optional)`,
            input: 'text',
            value: typed.key ?? ''
        });
    } else if (kind === 'player_form') {
        const typed = condition as TestEventCondition & { kind: 'player_form' };
        const options = resolveOptionSetWithUnknown(
            PLAYER_FORM_IDS.map((entry) => ({ value: entry, label: entry })),
            typed.form,
            'missing'
        );
        fields.push({
            key: `${conditionBaseKey}:form`,
            label: `Condition ${conditionIndex + 1} Player Form`,
            input: 'select',
            value: typed.form,
            options
        });
    }

    return fields;
};

const buildActionFields = (
    phase: EventPhaseKey,
    blockIndex: number,
    action: TestEventAction,
    actionIndex: number,
    options: TriggerEventEditorOptions
): TestWorldEditorSidebarSection['fields'] => {
    const actionBaseKey = `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:action:${actionIndex}`;
    const rawKind = (action as { kind?: string }).kind;
    const kind = typeof rawKind === 'string' ? rawKind : 'actor_action';
    const kindOptions = resolveOptionSetWithUnknown(
        EVENT_ACTION_KIND_OPTIONS,
        kind,
        'unsupported'
    );

    const fields: TestWorldEditorSidebarSection['fields'] = [
        {
            key: `${actionBaseKey}:kind`,
            label: `Action ${actionIndex + 1} Kind`,
            input: 'select',
            value: kind,
            options: kindOptions
        }
    ];

    if (kind === 'actor_action') {
        const typed = action as TestEventAction & { kind: 'actor_action' };
        const actorIdOptions = options.npcIds.map((entry) => ({
            value: entry,
            label: entry
        }));
        const resolvedActorOptions = resolveOptionSetWithUnknown(
            actorIdOptions,
            typed.actorId,
            'missing'
        );
        fields.push({
            key: `${actionBaseKey}:actorId`,
            label: `Action ${actionIndex + 1} Actor Id`,
            input: 'select',
            value: typed.actorId,
            options: resolvedActorOptions.length > 0 ? resolvedActorOptions : [{ value: '', label: 'No NPCs' }]
        });

        const actorActionKind = typed.action?.kind ?? 'set_emotion';
        fields.push({
            key: `${actionBaseKey}:actorActionKind`,
            label: `Action ${actionIndex + 1} Actor Action`,
            input: 'select',
            value: actorActionKind,
            options: resolveOptionSetWithUnknown(EVENT_ACTOR_ACTION_KIND_OPTIONS, actorActionKind, 'unsupported')
        });

        if (typed.action.kind === 'set_emotion') {
            const emotionId = typed.action.emotionId;
            const emotionOptions = resolveOptionSetWithUnknown(
                TEST_NPC_MANPU_EMOTION_OPTIONS
                    .filter((entry) => entry.value !== 'none')
                    .map((entry) => ({
                        value: entry.value,
                        label: entry.label
                    })),
                emotionId,
                'legacy'
            );
            fields.push({
                key: `${actionBaseKey}:emotionId`,
                label: `Action ${actionIndex + 1} Emotion`,
                input: 'select',
                value: emotionId,
                options: emotionOptions
            });
        } else if (typed.action.kind === 'trigger_event') {
            fields.push(
                {
                    key: `${actionBaseKey}:eventId`,
                    label: `Action ${actionIndex + 1} Event Id`,
                    input: 'text',
                    value: typed.action.eventId
                },
                {
                    key: `${actionBaseKey}:payloadJson`,
                    label: `Action ${actionIndex + 1} Payload JSON`,
                    input: 'textarea',
                    value: typed.action.payload ? JSON.stringify(typed.action.payload, null, 2) : ''
                }
            );
        }
    } else if (kind === 'start_cutscene') {
        const typed = action as TestEventAction & { kind: 'start_cutscene' };
        fields.push({
            key: `${actionBaseKey}:cutsceneRef`,
            label: `Action ${actionIndex + 1} Cutscene Ref`,
            input: 'select',
            value: typed.cutsceneRef,
            options: resolveOptionSetWithUnknown(
                options.cutsceneRefs.map((entry) => ({ value: entry, label: entry })),
                typed.cutsceneRef,
                'missing'
            )
        });
    } else if (kind === 'set_flag') {
        const typed = action as TestEventAction & { kind: 'set_flag' };
        fields.push(
            {
                key: `${actionBaseKey}:flagId`,
                label: `Action ${actionIndex + 1} Flag Id`,
                input: 'text',
                value: typed.flagId
            },
            {
                key: `${actionBaseKey}:value`,
                label: `Action ${actionIndex + 1} Value`,
                input: 'checkbox',
                value: typed.value
            }
        );
    } else if (kind === 'trigger_event') {
        const typed = action as TestEventAction & { kind: 'trigger_event' };
        fields.push(
            {
                key: `${actionBaseKey}:eventId`,
                label: `Action ${actionIndex + 1} Event Id`,
                input: 'text',
                value: typed.eventId
            },
            {
                key: `${actionBaseKey}:payloadJson`,
                label: `Action ${actionIndex + 1} Payload JSON`,
                input: 'textarea',
                value: typed.payload ? JSON.stringify(typed.payload, null, 2) : ''
            }
        );
    } else if (kind === 'play_sfx') {
        const typed = action as TestEventAction & { kind: 'play_sfx' };
        fields.push({
            key: `${actionBaseKey}:sfxId`,
            label: `Action ${actionIndex + 1} Sfx Id (stub)`,
            input: 'text',
            value: typed.sfxId
        });
    } else if (kind === 'spawn_vfx') {
        const typed = action as TestEventAction & { kind: 'spawn_vfx' };
        const actorIdOptions = [{ value: '', label: 'None' }, ...options.npcIds.map((entry) => ({ value: entry, label: entry }))];
        fields.push(
            {
                key: `${actionBaseKey}:vfxId`,
                label: `Action ${actionIndex + 1} Vfx Id (stub)`,
                input: 'text',
                value: typed.vfxId
            },
            {
                key: `${actionBaseKey}:vfxActorId`,
                label: `Action ${actionIndex + 1} Actor Id (Optional)`,
                input: 'select',
                value: typed.actorId ?? '',
                options: resolveOptionSetWithUnknown(actorIdOptions, typed.actorId ?? '', 'missing')
            },
            {
                key: `${actionBaseKey}:x`,
                label: `Action ${actionIndex + 1} X (Optional)`,
                input: 'number',
                value: typed.x ?? 0,
                step: 1
            },
            {
                key: `${actionBaseKey}:y`,
                label: `Action ${actionIndex + 1} Y (Optional)`,
                input: 'number',
                value: typed.y ?? 0,
                step: 1
            }
        );
    }

    return fields;
};

const buildPhaseSections = (
    trigger: TestWorldTriggerVolumeConfig,
    phase: EventPhaseKey,
    phaseLabel: string,
    options: TriggerEventEditorOptions,
    includeQuickManpuButton: boolean
): TestWorldEditorSidebarSection[] => {
    const blocks = trigger[phase] ?? [];
    const sections: TestWorldEditorSidebarSection[] = [
        {
            title: phaseLabel,
            fields: [],
            actions: [
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:add_block`, label: 'Add Block' },
                ...(includeQuickManpuButton ? [{ id: 'event:add_manpu_pair', label: 'Add NPC Manpu Enter/Exit Pair' }] : [])
            ]
        }
    ];

    blocks.forEach((block, blockIndex) => {
        const fields: TestWorldEditorSidebarSection['fields'] = [
            {
                key: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:id`,
                label: 'Block Id',
                input: 'text',
                value: block.id
            }
        ];

        const sectionActions: NonNullable<TestWorldEditorSidebarSection['actions']> = [
            { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:add_condition`, label: 'Add Condition' },
            { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:add_action`, label: 'Add Action' },
            { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:delete`, label: 'Delete Block' }
        ];

        const conditions = block.conditions ?? [];
        conditions.forEach((condition, conditionIndex) => {
            fields.push(...buildConditionFields(phase, blockIndex, condition, conditionIndex));
            sectionActions.push(
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:condition:${conditionIndex}:move_up`, label: `Cond ${conditionIndex + 1} Up` },
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:condition:${conditionIndex}:move_down`, label: `Cond ${conditionIndex + 1} Down` },
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:condition:${conditionIndex}:delete`, label: `Delete Cond ${conditionIndex + 1}` }
            );
        });

        block.actions.forEach((action, actionIndex) => {
            fields.push(...buildActionFields(phase, blockIndex, action, actionIndex, options));
            sectionActions.push(
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:action:${actionIndex}:move_up`, label: `Action ${actionIndex + 1} Up` },
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:action:${actionIndex}:move_down`, label: `Action ${actionIndex + 1} Down` },
                { id: `${EVENT_EDITOR_PREFIX}:${phase}:block:${blockIndex}:action:${actionIndex}:delete`, label: `Delete Action ${actionIndex + 1}` }
            );
        });

        sections.push({
            title: `${phaseLabel} / Block ${blockIndex + 1}`,
            fields,
            actions: sectionActions
        });
    });

    return sections;
};

export const buildTriggerEventEditorSections = (
    trigger: TestWorldTriggerVolumeConfig,
    options: TriggerEventEditorOptions
): TestWorldEditorSidebarSection[] => {
    const sections: TestWorldEditorSidebarSection[] = [
        {
            title: 'Event Blocks',
            fields: []
        }
    ];

    EVENT_PHASES.forEach((phase) => {
        sections.push(
            ...buildPhaseSections(trigger, phase.key, phase.label, options, phase.key === 'onEnter')
        );
    });

    return sections;
};
