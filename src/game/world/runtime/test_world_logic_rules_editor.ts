import type { ActorAction } from '../../actor_actions/actor_action_types';
import type { TestEventAction } from '../../events/test_event_actions';
import type { TestEventCondition } from '../../events/test_event_conditions';
import type {
    TestWorldLogicEventMatcher,
    TestWorldLogicRule
} from '../../events/test_world_logic_rules';
import { TEST_NPC_MANPU_EMOTION_OPTIONS } from '../../npc/npc_manpu';
import type {
    TestWorldEditorSidebarFieldOption,
    TestWorldEditorSidebarSection
} from './test_world_editor_sidebar';

const PLAYER_FORM_IDS = ['ball', 'triangle', 'square'] as const;

export interface WorldLogicRuleEditorOptions {
    npcIds: readonly string[];
    cutsceneRefs: readonly string[];
    objectIds: readonly string[];
}

export interface WorldLogicRuleEditorApplyResult {
    handled: boolean;
    changed: boolean;
    warning?: string;
    selectedRuleId?: string | null;
}

const MATCHER_KIND_OPTIONS: TestWorldEditorSidebarFieldOption[] = [
    { value: 'object_state_changed', label: 'object_state_changed' },
    { value: 'trigger_event', label: 'trigger_event' },
    { value: 'npc_event', label: 'npc_event' },
    { value: 'cutscene_finished', label: 'cutscene_finished' }
];

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

const normalizeText = (value: unknown): string => {
    return typeof value === 'string' ? value : String(value ?? '');
};

const withUnknownOption = (
    options: readonly TestWorldEditorSidebarFieldOption[],
    value: string
): TestWorldEditorSidebarFieldOption[] => {
    if (!value || options.some((entry) => entry.value === value)) {
        return [...options];
    }
    return [{ value, label: `${value} (unsupported)` }, ...options];
};

const cloneCondition = (condition: TestEventCondition): TestEventCondition => ({ ...condition });

const cloneActorAction = (action: ActorAction): ActorAction => ({ ...action });

const cloneAction = (action: TestEventAction): TestEventAction => {
    if (action.kind !== 'actor_action') {
        return { ...action };
    }
    return {
        ...action,
        action: cloneActorAction(action.action)
    };
};

const createDefaultCondition = (): TestEventCondition => ({ kind: 'once', key: '' });

const createDefaultAction = (options: WorldLogicRuleEditorOptions): TestEventAction => ({
    kind: 'actor_action',
    actorId: options.npcIds[0] ?? '',
    action: {
        kind: 'set_emotion',
        emotionId: 'anger'
    }
});

export const createDefaultWorldLogicRule = (): TestWorldLogicRule => ({
    id: 'new_logic_rule',
    enabled: true,
    when: {
        kind: 'trigger_event',
        eventId: 'event_id'
    },
    conditions: [{
        kind: 'once',
        key: ''
    }],
    actions: []
});

export const applyWorldLogicRuleEditorFieldChange = (
    rule: TestWorldLogicRule,
    fieldKey: string,
    value: string | number | boolean,
    options: WorldLogicRuleEditorOptions
): WorldLogicRuleEditorApplyResult => {
    if (!fieldKey.startsWith('logic_rule:')) {
        return { handled: false, changed: false };
    }

    const parts = fieldKey.split(':');
    if (parts[1] === 'id') {
        rule.id = normalizeText(value);
        return { handled: true, changed: true };
    }
    if (parts[1] === 'enabled' && typeof value === 'boolean') {
        rule.enabled = value;
        return { handled: true, changed: true };
    }
    if (parts[1] === 'when') {
        if (parts[2] === 'kind') {
            const nextKind = normalizeText(value);
            if (nextKind === 'object_state_changed') {
                rule.when = {
                    kind: 'object_state_changed',
                    objectId: options.objectIds[0] ?? '',
                    toState: 'broken'
                };
                return { handled: true, changed: true };
            }
            if (nextKind === 'trigger_event') {
                rule.when = {
                    kind: 'trigger_event',
                    eventId: 'event_id'
                };
                return { handled: true, changed: true };
            }
            if (nextKind === 'npc_event') {
                rule.when = {
                    kind: 'npc_event',
                    actorId: options.npcIds[0] ?? '',
                    eventId: 'event_id'
                };
                return { handled: true, changed: true };
            }
            if (nextKind === 'cutscene_finished') {
                rule.when = {
                    kind: 'cutscene_finished',
                    cutsceneRef: options.cutsceneRefs[0] ?? ''
                };
                return { handled: true, changed: true };
            }
            return { handled: true, changed: false };
        }

        if (rule.when.kind === 'object_state_changed') {
            if (parts[2] === 'objectId') {
                rule.when.objectId = normalizeText(value);
                return { handled: true, changed: true };
            }
            if (parts[2] === 'fromState') {
                const next = normalizeText(value).trim();
                rule.when.fromState = next.length > 0 ? next : undefined;
                return { handled: true, changed: true };
            }
            if (parts[2] === 'toState') {
                rule.when.toState = normalizeText(value);
                return { handled: true, changed: true };
            }
        } else if (rule.when.kind === 'trigger_event') {
            if (parts[2] === 'eventId') {
                rule.when.eventId = normalizeText(value);
                return { handled: true, changed: true };
            }
            if (parts[2] === 'sourceId') {
                const next = normalizeText(value).trim();
                rule.when.sourceId = next.length > 0 ? next : undefined;
                return { handled: true, changed: true };
            }
        } else if (rule.when.kind === 'npc_event') {
            if (parts[2] === 'actorId') {
                const next = normalizeText(value).trim();
                rule.when.actorId = next.length > 0 ? next : undefined;
                return { handled: true, changed: true };
            }
            if (parts[2] === 'eventId') {
                rule.when.eventId = normalizeText(value);
                return { handled: true, changed: true };
            }
        } else if (rule.when.kind === 'cutscene_finished' && parts[2] === 'cutsceneRef') {
            const next = normalizeText(value).trim();
            rule.when.cutsceneRef = next.length > 0 ? next : undefined;
            return { handled: true, changed: true };
        }
        return { handled: true, changed: false };
    }

    if (parts[1] === 'condition') {
        const conditionIndex = Number(parts[2]);
        if (!Number.isInteger(conditionIndex) || conditionIndex < 0) {
            return { handled: true, changed: false };
        }
        const conditions = [...(rule.conditions ?? [])];
        const current = conditions[conditionIndex];
        if (!current) {
            return { handled: true, changed: false };
        }
        let nextCondition = cloneCondition(current);
        if (parts[3] === 'kind') {
            const nextKind = normalizeText(value);
            if (nextKind === 'flag') {
                nextCondition = { kind: 'flag', flagId: 'flag_id', equals: true };
            } else if (nextKind === 'once') {
                nextCondition = { kind: 'once', key: '' };
            } else if (nextKind === 'player_form') {
                nextCondition = { kind: 'player_form', form: PLAYER_FORM_IDS[0] };
            } else {
                return { handled: true, changed: false };
            }
        } else if (nextCondition.kind === 'flag') {
            if (parts[3] === 'flagId') {
                nextCondition.flagId = normalizeText(value);
            } else if (parts[3] === 'equals' && typeof value === 'boolean') {
                nextCondition.equals = value;
            }
        } else if (nextCondition.kind === 'once' && parts[3] === 'key') {
            const key = normalizeText(value).trim();
            nextCondition.key = key.length > 0 ? key : undefined;
        } else if (nextCondition.kind === 'player_form' && parts[3] === 'form') {
            nextCondition.form = normalizeText(value);
        }
        conditions[conditionIndex] = nextCondition;
        rule.conditions = conditions;
        return { handled: true, changed: true };
    }

    if (parts[1] !== 'action') {
        return { handled: true, changed: false };
    }
    const actionIndex = Number(parts[2]);
    if (!Number.isInteger(actionIndex) || actionIndex < 0) {
        return { handled: true, changed: false };
    }
    const actions = [...rule.actions];
    const current = actions[actionIndex];
    if (!current) {
        return { handled: true, changed: false };
    }
    let nextAction = cloneAction(current);
    if (parts[3] === 'kind') {
        const nextKind = normalizeText(value);
        if (nextKind === 'actor_action') {
            nextAction = createDefaultAction(options);
        } else if (nextKind === 'start_cutscene') {
            nextAction = { kind: 'start_cutscene', cutsceneRef: options.cutsceneRefs[0] ?? '' };
        } else if (nextKind === 'set_flag') {
            nextAction = { kind: 'set_flag', flagId: 'flag_id', value: true };
        } else if (nextKind === 'trigger_event') {
            nextAction = { kind: 'trigger_event', eventId: 'event_id' };
        } else if (nextKind === 'play_sfx') {
            nextAction = { kind: 'play_sfx', sfxId: 'sfx_id' };
        } else if (nextKind === 'spawn_vfx') {
            nextAction = { kind: 'spawn_vfx', vfxId: 'vfx_id' };
        } else {
            return { handled: true, changed: false };
        }
        actions[actionIndex] = nextAction;
        rule.actions = actions;
        return { handled: true, changed: true };
    }

    if (nextAction.kind === 'actor_action') {
        if (parts[3] === 'actorId') {
            nextAction.actorId = normalizeText(value);
        } else if (parts[3] === 'actorActionKind') {
            const nextKind = normalizeText(value);
            nextAction.action = nextKind === 'trigger_event'
                ? { kind: 'trigger_event', eventId: 'event_id' }
                : { kind: 'set_emotion', emotionId: 'anger' };
        } else if (parts[3] === 'emotionId' && nextAction.action.kind === 'set_emotion') {
            nextAction.action = { ...nextAction.action, emotionId: normalizeText(value) };
        } else if (parts[3] === 'eventId' && nextAction.action.kind === 'trigger_event') {
            nextAction.action = { ...nextAction.action, eventId: normalizeText(value) };
        } else if (parts[3] === 'payloadJson' && nextAction.action.kind === 'trigger_event') {
            const jsonText = normalizeText(value).trim();
            if (jsonText.length <= 0) {
                nextAction.action = { ...nextAction.action, payload: undefined };
            } else {
                try {
                    const parsed = JSON.parse(jsonText) as unknown;
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        return { handled: true, changed: false, warning: 'payload must be a JSON object' };
                    }
                    nextAction.action = { ...nextAction.action, payload: parsed as Record<string, unknown> };
                } catch {
                    return { handled: true, changed: false, warning: 'payload JSON is invalid' };
                }
            }
        }
    } else if (nextAction.kind === 'start_cutscene' && parts[3] === 'cutsceneRef') {
        nextAction.cutsceneRef = normalizeText(value);
    } else if (nextAction.kind === 'set_flag') {
        if (parts[3] === 'flagId') {
            nextAction.flagId = normalizeText(value);
        } else if (parts[3] === 'value' && typeof value === 'boolean') {
            nextAction.value = value;
        }
    } else if (nextAction.kind === 'trigger_event') {
        if (parts[3] === 'eventId') {
            nextAction.eventId = normalizeText(value);
        } else if (parts[3] === 'payloadJson') {
            const jsonText = normalizeText(value).trim();
            if (jsonText.length <= 0) {
                nextAction.payload = undefined;
            } else {
                try {
                    const parsed = JSON.parse(jsonText) as unknown;
                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                        return { handled: true, changed: false, warning: 'payload must be a JSON object' };
                    }
                    nextAction.payload = parsed as Record<string, unknown>;
                } catch {
                    return { handled: true, changed: false, warning: 'payload JSON is invalid' };
                }
            }
        }
    } else if (nextAction.kind === 'play_sfx' && parts[3] === 'sfxId') {
        nextAction.sfxId = normalizeText(value);
    } else if (nextAction.kind === 'spawn_vfx') {
        if (parts[3] === 'vfxId') {
            nextAction.vfxId = normalizeText(value);
        } else if (parts[3] === 'vfxActorId') {
            const nextActorId = normalizeText(value).trim();
            nextAction.actorId = nextActorId.length > 0 ? nextActorId : undefined;
        } else if (parts[3] === 'x') {
            nextAction.x = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        } else if (parts[3] === 'y') {
            nextAction.y = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        }
    }

    actions[actionIndex] = nextAction;
    rule.actions = actions;
    return { handled: true, changed: true };
};

export const applyWorldLogicRuleEditorAction = (
    rules: TestWorldLogicRule[],
    selectedRuleId: string | null,
    actionId: string,
    options: WorldLogicRuleEditorOptions
): WorldLogicRuleEditorApplyResult => {
    if (!actionId.startsWith('logic_rule:')) {
        return { handled: false, changed: false };
    }
    if (actionId === 'logic_rule:add_rule') {
        const existingIds = new Set(rules.map((entry) => entry.id));
        const rule = createDefaultWorldLogicRule();
        let suffix = 1;
        while (existingIds.has(rule.id)) {
            rule.id = `new_logic_rule_${suffix}`;
            suffix += 1;
        }
        rules.push(rule);
        return {
            handled: true,
            changed: true,
            selectedRuleId: rule.id
        };
    }
    if (actionId === 'logic_rule:delete_rule') {
        if (!selectedRuleId) {
            return { handled: true, changed: false };
        }
        const index = rules.findIndex((entry) => entry.id === selectedRuleId);
        if (index < 0) {
            return { handled: true, changed: false };
        }
        rules.splice(index, 1);
        return {
            handled: true,
            changed: true,
            selectedRuleId: rules[Math.max(0, index - 1)]?.id ?? rules[0]?.id ?? null
        };
    }

    const selectedRule = selectedRuleId
        ? rules.find((entry) => entry.id === selectedRuleId) ?? null
        : null;
    if (!selectedRule) {
        return { handled: true, changed: false };
    }

    if (actionId === 'logic_rule:condition:add') {
        selectedRule.conditions = [...(selectedRule.conditions ?? []), createDefaultCondition()];
        return { handled: true, changed: true };
    }
    if (actionId === 'logic_rule:action:add') {
        selectedRule.actions = [...selectedRule.actions, createDefaultAction(options)];
        return { handled: true, changed: true };
    }

    const parts = actionId.split(':');
    if (parts.length !== 4) {
        return { handled: true, changed: false };
    }
    const scope = parts[1];
    const op = parts[2];
    const index = Number(parts[3]);
    if (!Number.isInteger(index) || index < 0) {
        return { handled: true, changed: false };
    }

    if (scope === 'condition') {
        const conditions = [...(selectedRule.conditions ?? [])];
        if (!conditions[index]) {
            return { handled: true, changed: false };
        }
        if (op === 'delete') {
            conditions.splice(index, 1);
        } else if (op === 'move_up') {
            if (index <= 0) {
                return { handled: true, changed: false };
            }
            const [moved] = conditions.splice(index, 1);
            conditions.splice(index - 1, 0, moved);
        } else if (op === 'move_down') {
            if (index >= conditions.length - 1) {
                return { handled: true, changed: false };
            }
            const [moved] = conditions.splice(index, 1);
            conditions.splice(index + 1, 0, moved);
        } else {
            return { handled: true, changed: false };
        }
        selectedRule.conditions = conditions.length > 0 ? conditions : undefined;
        return { handled: true, changed: true };
    }

    if (scope !== 'action') {
        return { handled: true, changed: false };
    }
    const actions = [...selectedRule.actions];
    if (!actions[index]) {
        return { handled: true, changed: false };
    }
    if (op === 'delete') {
        actions.splice(index, 1);
    } else if (op === 'move_up') {
        if (index <= 0) {
            return { handled: true, changed: false };
        }
        const [moved] = actions.splice(index, 1);
        actions.splice(index - 1, 0, moved);
    } else if (op === 'move_down') {
        if (index >= actions.length - 1) {
            return { handled: true, changed: false };
        }
        const [moved] = actions.splice(index, 1);
        actions.splice(index + 1, 0, moved);
    } else {
        return { handled: true, changed: false };
    }
    selectedRule.actions = actions;
    return { handled: true, changed: true };
};

const buildConditionFields = (
    condition: TestEventCondition,
    conditionIndex: number
): TestWorldEditorSidebarSection['fields'] => {
    const baseKey = `logic_rule:condition:${conditionIndex}`;
    const kind = condition.kind;
    const fields: TestWorldEditorSidebarSection['fields'] = [{
        key: `${baseKey}:kind`,
        label: `Condition ${conditionIndex + 1} Kind`,
        input: 'select',
        value: kind,
        options: withUnknownOption(EVENT_CONDITION_KIND_OPTIONS, kind)
    }];

    if (kind === 'flag') {
        fields.push(
            { key: `${baseKey}:flagId`, label: `Condition ${conditionIndex + 1} Flag Id`, input: 'text', value: condition.flagId },
            { key: `${baseKey}:equals`, label: `Condition ${conditionIndex + 1} Equals`, input: 'checkbox', value: condition.equals }
        );
    } else if (kind === 'once') {
        fields.push({ key: `${baseKey}:key`, label: `Condition ${conditionIndex + 1} Once Key`, input: 'text', value: condition.key ?? '' });
    } else if (kind === 'player_form') {
        fields.push({
            key: `${baseKey}:form`,
            label: `Condition ${conditionIndex + 1} Player Form`,
            input: 'select',
            value: condition.form,
            options: withUnknownOption(
                PLAYER_FORM_IDS.map((entry) => ({ value: entry, label: entry })),
                condition.form
            )
        });
    }
    return fields;
};

const buildActionFields = (
    action: TestEventAction,
    actionIndex: number,
    options: WorldLogicRuleEditorOptions
): TestWorldEditorSidebarSection['fields'] => {
    const baseKey = `logic_rule:action:${actionIndex}`;
    const fields: TestWorldEditorSidebarSection['fields'] = [{
        key: `${baseKey}:kind`,
        label: `Action ${actionIndex + 1} Kind`,
        input: 'select',
        value: action.kind,
        options: withUnknownOption(EVENT_ACTION_KIND_OPTIONS, action.kind)
    }];

    if (action.kind === 'actor_action') {
        fields.push({
            key: `${baseKey}:actorId`,
            label: `Action ${actionIndex + 1} Actor Id`,
            input: 'select',
            value: action.actorId,
            options: withUnknownOption(
                options.npcIds.map((entry) => ({ value: entry, label: entry })),
                action.actorId
            )
        });
        fields.push({
            key: `${baseKey}:actorActionKind`,
            label: `Action ${actionIndex + 1} Actor Action`,
            input: 'select',
            value: action.action.kind,
            options: withUnknownOption(EVENT_ACTOR_ACTION_KIND_OPTIONS, action.action.kind)
        });
        if (action.action.kind === 'set_emotion') {
            fields.push({
                key: `${baseKey}:emotionId`,
                label: `Action ${actionIndex + 1} Emotion`,
                input: 'select',
                value: action.action.emotionId,
                options: withUnknownOption(
                    TEST_NPC_MANPU_EMOTION_OPTIONS
                        .filter((entry) => entry.value !== 'none')
                        .map((entry) => ({ value: entry.value, label: entry.label })),
                    action.action.emotionId
                )
            });
        } else if (action.action.kind === 'trigger_event') {
            fields.push(
                { key: `${baseKey}:eventId`, label: `Action ${actionIndex + 1} Event Id`, input: 'text', value: action.action.eventId },
                {
                    key: `${baseKey}:payloadJson`,
                    label: `Action ${actionIndex + 1} Payload JSON`,
                    input: 'textarea',
                    value: action.action.payload ? JSON.stringify(action.action.payload, null, 2) : ''
                }
            );
        }
    } else if (action.kind === 'start_cutscene') {
        fields.push({
            key: `${baseKey}:cutsceneRef`,
            label: `Action ${actionIndex + 1} Cutscene Ref`,
            input: 'select',
            value: action.cutsceneRef,
            options: withUnknownOption(
                options.cutsceneRefs.map((entry) => ({ value: entry, label: entry })),
                action.cutsceneRef
            )
        });
    } else if (action.kind === 'set_flag') {
        fields.push(
            { key: `${baseKey}:flagId`, label: `Action ${actionIndex + 1} Flag Id`, input: 'text', value: action.flagId },
            { key: `${baseKey}:value`, label: `Action ${actionIndex + 1} Value`, input: 'checkbox', value: action.value }
        );
    } else if (action.kind === 'trigger_event') {
        fields.push(
            { key: `${baseKey}:eventId`, label: `Action ${actionIndex + 1} Event Id`, input: 'text', value: action.eventId },
            {
                key: `${baseKey}:payloadJson`,
                label: `Action ${actionIndex + 1} Payload JSON`,
                input: 'textarea',
                value: action.payload ? JSON.stringify(action.payload, null, 2) : ''
            }
        );
    } else if (action.kind === 'play_sfx') {
        fields.push({ key: `${baseKey}:sfxId`, label: `Action ${actionIndex + 1} Sfx Id`, input: 'text', value: action.sfxId });
    } else if (action.kind === 'spawn_vfx') {
        fields.push(
            { key: `${baseKey}:vfxId`, label: `Action ${actionIndex + 1} Vfx Id`, input: 'text', value: action.vfxId },
            {
                key: `${baseKey}:vfxActorId`,
                label: `Action ${actionIndex + 1} Actor Id`,
                input: 'select',
                value: action.actorId ?? '',
                options: [{ value: '', label: 'None' }, ...options.npcIds.map((entry) => ({ value: entry, label: entry }))]
            },
            { key: `${baseKey}:x`, label: `Action ${actionIndex + 1} X`, input: 'number', value: action.x ?? 0, step: 1 },
            { key: `${baseKey}:y`, label: `Action ${actionIndex + 1} Y`, input: 'number', value: action.y ?? 0, step: 1 }
        );
    }
    return fields;
};

const buildWhenFields = (
    when: TestWorldLogicEventMatcher,
    options: WorldLogicRuleEditorOptions
): TestWorldEditorSidebarSection['fields'] => {
    const fields: TestWorldEditorSidebarSection['fields'] = [{
        key: 'logic_rule:when:kind',
        label: 'Event Kind',
        input: 'select',
        value: when.kind,
        options: withUnknownOption(MATCHER_KIND_OPTIONS, when.kind)
    }];

    if (when.kind === 'object_state_changed') {
        fields.push(
            {
                key: 'logic_rule:when:objectId',
                label: 'Object Id',
                input: 'select',
                value: when.objectId,
                options: withUnknownOption(
                    options.objectIds.map((entry) => ({ value: entry, label: entry })),
                    when.objectId
                )
            },
            { key: 'logic_rule:when:fromState', label: 'From State (Optional)', input: 'text', value: when.fromState ?? '' },
            { key: 'logic_rule:when:toState', label: 'To State', input: 'text', value: when.toState ?? 'broken' }
        );
    } else if (when.kind === 'trigger_event') {
        fields.push(
            { key: 'logic_rule:when:eventId', label: 'Event Id', input: 'text', value: when.eventId },
            { key: 'logic_rule:when:sourceId', label: 'Source Id (Optional)', input: 'text', value: when.sourceId ?? '' }
        );
    } else if (when.kind === 'npc_event') {
        fields.push(
            {
                key: 'logic_rule:when:actorId',
                label: 'Actor Id (Optional)',
                input: 'select',
                value: when.actorId ?? '',
                options: [{ value: '', label: 'Any NPC' }, ...options.npcIds.map((entry) => ({ value: entry, label: entry }))]
            },
            { key: 'logic_rule:when:eventId', label: 'Event Id', input: 'text', value: when.eventId }
        );
    } else if (when.kind === 'cutscene_finished') {
        fields.push({
            key: 'logic_rule:when:cutsceneRef',
            label: 'Cutscene Ref (Optional)',
            input: 'select',
            value: when.cutsceneRef ?? '',
            options: [{ value: '', label: 'Any Cutscene' }, ...options.cutsceneRefs.map((entry) => ({ value: entry, label: entry }))]
        });
    }

    return fields;
};

export const buildWorldLogicRuleEditorSections = (
    rule: TestWorldLogicRule | null,
    options: WorldLogicRuleEditorOptions
): TestWorldEditorSidebarSection[] => {
    if (!rule) {
        return [{
            title: 'Logic Editor / Rules',
            fields: [],
            actions: [{ id: 'logic_rule:add_rule', label: 'Add Rule' }]
        }];
    }

    const conditions = rule.conditions ?? [];
    const conditionFields = conditions.flatMap((entry, index) => buildConditionFields(entry, index));
    const conditionActions = conditions.flatMap((_entry, index) => ([
        { id: `logic_rule:condition:move_up:${index}`, label: `Cond ${index + 1} Up` },
        { id: `logic_rule:condition:move_down:${index}`, label: `Cond ${index + 1} Down` },
        { id: `logic_rule:condition:delete:${index}`, label: `Delete Cond ${index + 1}` }
    ]));

    const actionFields = rule.actions.flatMap((entry, index) => buildActionFields(entry, index, options));
    const ruleActions = rule.actions.flatMap((_entry, index) => ([
        { id: `logic_rule:action:move_up:${index}`, label: `Action ${index + 1} Up` },
        { id: `logic_rule:action:move_down:${index}`, label: `Action ${index + 1} Down` },
        { id: `logic_rule:action:delete:${index}`, label: `Delete Action ${index + 1}` }
    ]));

    return [
        {
            title: 'Rule',
            fields: [
                { key: 'logic_rule:enabled', label: 'Enabled', input: 'checkbox', value: rule.enabled !== false },
                { key: 'logic_rule:id', label: 'Rule Id', input: 'text', value: rule.id }
            ],
            actions: [
                { id: 'logic_rule:add_rule', label: 'Add Rule' },
                { id: 'logic_rule:delete_rule', label: 'Delete Rule' }
            ]
        },
        {
            title: 'WHEN',
            fields: buildWhenFields(rule.when, options)
        },
        {
            title: 'IF / CONDITIONS',
            fields: conditionFields,
            actions: [{ id: 'logic_rule:condition:add', label: 'Add Condition' }, ...conditionActions]
        },
        {
            title: 'DO / ACTIONS',
            fields: actionFields,
            actions: [{ id: 'logic_rule:action:add', label: 'Add Action' }, ...ruleActions]
        }
    ];
};
