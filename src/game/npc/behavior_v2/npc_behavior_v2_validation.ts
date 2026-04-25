import type { ActionCatalog } from '../../authoring/actions/action_catalog';
import { validateActorProgram } from '../../authoring/programs/actor_program_validation';
import type { AuthoringValidationContext, ValidationIssue } from '../../authoring/validation/validation_types';
import type {
    NpcActorPhysicsMode,
    NpcBehaviorAsset,
    NpcBehaviorEventType,
    NpcBehaviorInterruptPolicy,
    NpcBehaviorPageMode
} from './npc_behavior_v2_types';

export interface NpcBehaviorValidationContext {
    readonly actionCatalog: ActionCatalog;
    readonly authoringContext: AuthoringValidationContext;
}

const NPC_PAGE_MODES: ReadonlySet<NpcBehaviorPageMode> = new Set([
    'idle',
    'patrol_path',
    'guard_area',
    'chase_player',
    'attack_player',
    'scripted_program',
    'dead',
    'disabled'
]);

const NPC_INTERRUPT_POLICIES: ReadonlySet<NpcBehaviorInterruptPolicy> = new Set([
    'ignore_if_busy',
    'interrupt',
    'queue'
]);

const NPC_EVENT_TYPES: ReadonlySet<NpcBehaviorEventType> = new Set([
    'player.near',
    'player.far',
    'player.visible',
    'player.interact',
    'world.flag_changed',
    'trigger.enter',
    'event.received',
    'cutscene.started',
    'cutscene.finished',
    'actor.died',
    'actor.touched_actor'
]);

const NPC_PHYSICS_MODES: ReadonlySet<NpcActorPhysicsMode> = new Set([
    'dynamic',
    'kinematic',
    'static',
    'ghost'
]);

export const validateNpcBehaviorAsset = (
    asset: NpcBehaviorAsset,
    context: NpcBehaviorValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const programIds = new Set<string>();
    const pageIds = new Set<string>();
    const reactionIds = new Set<string>();

    const source = context.authoringContext.source;
    const assetId = typeof asset.id === 'string' ? asset.id.trim() : '';

    if (assetId.length === 0) {
        issues.push(createIssue('error', 'missing_npc_behavior_asset_id', 'NPC behavior asset id is missing or empty.', 'id', source));
    }

    if (asset.physicsMode !== undefined && !NPC_PHYSICS_MODES.has(asset.physicsMode)) {
        issues.push(
            createIssue(
                'error',
                'invalid_npc_physics_mode',
                `Invalid NPC physics mode "${String(asset.physicsMode)}".`,
                'physicsMode',
                source
            )
        );
    }

    asset.programs.forEach((program, index) => {
        const path = `programs[${index}]`;
        const programId = typeof program.id === 'string' ? program.id.trim() : '';

        if (programId.length > 0) {
            if (programIds.has(programId)) {
                issues.push(
                    createIssue(
                        'error',
                        'duplicate_npc_behavior_program_id',
                        `Duplicate NPC behavior program id "${programId}".`,
                        `${path}.id`,
                        source
                    )
                );
            } else {
                programIds.add(programId);
            }
        }

        const programIssues = validateActorProgram(program, {
            actionCatalog: context.actionCatalog,
            authoringContext: context.authoringContext
        });
        programIssues.forEach((programIssue) => {
            issues.push(appendPath(programIssue, path));
        });
    });

    asset.pages.forEach((page, index) => {
        const pagePath = `pages[${index}]`;
        const pageId = typeof page.id === 'string' ? page.id.trim() : '';

        if (pageId.length === 0) {
            issues.push(
                createIssue('error', 'missing_npc_behavior_page_id', 'NPC behavior page id is missing or empty.', `${pagePath}.id`, source)
            );
        } else if (pageIds.has(pageId)) {
            issues.push(
                createIssue(
                    'error',
                    'duplicate_npc_behavior_page_id',
                    `Duplicate NPC behavior page id "${pageId}".`,
                    `${pagePath}.id`,
                    source
                )
            );
        } else {
            pageIds.add(pageId);
        }

        if (!Number.isFinite(page.priority)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_behavior_page_priority',
                    'NPC behavior page priority must be a finite number.',
                    `${pagePath}.priority`,
                    source
                )
            );
        }

        if (!NPC_PAGE_MODES.has(page.mode)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_behavior_page_mode',
                    `Invalid NPC behavior page mode "${String(page.mode)}".`,
                    `${pagePath}.mode`,
                    source
                )
            );
        }

        if (!NPC_INTERRUPT_POLICIES.has(page.interruptPolicy)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_behavior_page_interrupt_policy',
                    `Invalid NPC behavior page interrupt policy "${String(page.interruptPolicy)}".`,
                    `${pagePath}.interruptPolicy`,
                    source
                )
            );
        }

        page.conditions.forEach((condition, conditionIndex) => {
            if (typeof condition.type !== 'string' || condition.type.trim().length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_npc_behavior_condition',
                        'Condition requires a non-empty type.',
                        `${pagePath}.conditions[${conditionIndex}].type`,
                        source
                    )
                );
            }
        });

        validateProgramRef(page.enterProgramRef, `${pagePath}.enterProgramRef`, programIds, issues, source);
        validateProgramRef(page.tickProgramRef, `${pagePath}.tickProgramRef`, programIds, issues, source);
        validateProgramRef(page.exitProgramRef, `${pagePath}.exitProgramRef`, programIds, issues, source);
    });

    asset.eventReactions.forEach((reaction, index) => {
        const reactionPath = `eventReactions[${index}]`;
        const reactionId = typeof reaction.id === 'string' ? reaction.id.trim() : '';

        if (reactionId.length === 0) {
            issues.push(
                createIssue(
                    'error',
                    'missing_npc_event_reaction_id',
                    'NPC event reaction id is missing or empty.',
                    `${reactionPath}.id`,
                    source
                )
            );
        } else if (reactionIds.has(reactionId)) {
            issues.push(
                createIssue(
                    'error',
                    'duplicate_npc_event_reaction_id',
                    `Duplicate NPC event reaction id "${reactionId}".`,
                    `${reactionPath}.id`,
                    source
                )
            );
        } else {
            reactionIds.add(reactionId);
        }

        if (!NPC_EVENT_TYPES.has(reaction.eventType)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_event_reaction_type',
                    `Invalid NPC event reaction type "${String(reaction.eventType)}".`,
                    `${reactionPath}.eventType`,
                    source
                )
            );
        }

        if (!Number.isFinite(reaction.priority)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_event_reaction_priority',
                    'NPC event reaction priority must be a finite number.',
                    `${reactionPath}.priority`,
                    source
                )
            );
        }

        if (typeof reaction.programRef !== 'string' || reaction.programRef.trim().length === 0) {
            issues.push(
                createIssue(
                    'error',
                    'missing_npc_event_reaction_program_ref',
                    'NPC event reaction programRef is missing or empty.',
                    `${reactionPath}.programRef`,
                    source
                )
            );
        } else {
            validateProgramRef(reaction.programRef, `${reactionPath}.programRef`, programIds, issues, source);
        }

        if (!NPC_INTERRUPT_POLICIES.has(reaction.interruptPolicy)) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_npc_event_reaction_interrupt_policy',
                    `Invalid NPC event reaction interrupt policy "${String(reaction.interruptPolicy)}".`,
                    `${reactionPath}.interruptPolicy`,
                    source
                )
            );
        }

        reaction.conditions?.forEach((condition, conditionIndex) => {
            if (typeof condition.type !== 'string' || condition.type.trim().length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_npc_behavior_condition',
                        'Condition requires a non-empty type.',
                        `${reactionPath}.conditions[${conditionIndex}].type`,
                        source
                    )
                );
            }
        });
    });

    return issues;
};

const validateProgramRef = (
    programRef: string | undefined,
    path: string,
    knownProgramIds: ReadonlySet<string>,
    issues: ValidationIssue[],
    source?: string
): void => {
    if (programRef === undefined) {
        return;
    }
    const normalizedProgramRef = programRef.trim();
    if (normalizedProgramRef.length === 0) {
        issues.push(
            createIssue(
                'error',
                'unknown_npc_behavior_program_ref',
                'NPC behavior program reference must not be empty.',
                path,
                source
            )
        );
        return;
    }
    if (!knownProgramIds.has(normalizedProgramRef)) {
        issues.push(
            createIssue(
                'error',
                'unknown_npc_behavior_program_ref',
                `Unknown NPC behavior program reference "${normalizedProgramRef}".`,
                path,
                source
            )
        );
    }
};

const appendPath = (issue: ValidationIssue, parentPath: string): ValidationIssue => {
    if (!issue.path || issue.path.length === 0) {
        return {
            ...issue,
            path: parentPath
        };
    }

    return {
        ...issue,
        path: `${parentPath}.${issue.path}`
    };
};

const createIssue = (
    severity: ValidationIssue['severity'],
    code: string,
    message: string,
    path?: string,
    source?: string
): ValidationIssue => {
    return {
        severity,
        code,
        message,
        path,
        source
    };
};
