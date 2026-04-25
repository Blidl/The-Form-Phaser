import type { ActionCatalog } from '../actions/action_catalog';
import type { AuthoringValidationContext, ValidationIssue } from '../validation/validation_types';
import type {
    ActorProgram,
    ActorProgramActionNode,
    ActorProgramCondition,
    ActorProgramLoopNode,
    ActorProgramNode
} from './actor_program_types';

export interface ActorProgramValidationContext {
    readonly actionCatalog: ActionCatalog;
    readonly authoringContext: AuthoringValidationContext;
}

export const validateActorProgram = (
    program: ActorProgram,
    context: ActorProgramValidationContext
): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    const seenNodeIds = new Set<string>();

    if (!isNonEmptyString(program.id)) {
        issues.push(createIssue('error', 'missing_actor_program_id', 'Actor program id is missing or empty.', 'id'));
    }

    validateNode(program.root, 'root', context, seenNodeIds, issues);

    return issues;
};

const validateNode = (
    node: ActorProgramNode,
    path: string,
    context: ActorProgramValidationContext,
    seenNodeIds: Set<string>,
    issues: ValidationIssue[]
): void => {
    if (isNonEmptyString(node.id)) {
        if (seenNodeIds.has(node.id)) {
            issues.push(
                createIssue(
                    'error',
                    'duplicate_actor_program_node_id',
                    `Duplicate actor program node id "${node.id}".`,
                    `${path}.id`
                )
            );
        } else {
            seenNodeIds.add(node.id);
        }
    }

    switch (node.kind) {
        case 'sequence': {
            if (node.children.length === 0) {
                issues.push(
                    createIssue('error', 'empty_actor_program_sequence', 'Sequence node must have at least one child.', path)
                );
            }
            node.children.forEach((child, index) => {
                validateNode(child, `${path}.children[${index}]`, context, seenNodeIds, issues);
            });
            return;
        }
        case 'parallel': {
            if (node.children.length === 0) {
                issues.push(
                    createIssue('error', 'empty_actor_program_parallel', 'Parallel node must have at least one child.', path)
                );
            }
            node.children.forEach((child, index) => {
                validateNode(child, `${path}.children[${index}]`, context, seenNodeIds, issues);
            });
            return;
        }
        case 'action': {
            validateActionNode(node, path, context, issues);
            return;
        }
        case 'wait': {
            if (!Number.isFinite(node.durationMs) || node.durationMs < 0) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_actor_program_wait',
                        'Wait node durationMs must be a finite number >= 0.',
                        `${path}.durationMs`
                    )
                );
            }
            return;
        }
        case 'if': {
            if (node.conditions.length === 0) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_actor_program_if',
                        'If node must include at least one condition.',
                        `${path}.conditions`
                    )
                );
            }

            node.conditions.forEach((condition, index) => {
                validateCondition(condition, `${path}.conditions[${index}]`, issues);
            });

            if (!node.then) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_actor_program_if',
                        'If node must include a then branch.',
                        `${path}.then`
                    )
                );
            } else {
                validateNode(node.then, `${path}.then`, context, seenNodeIds, issues);
            }

            if (node.else) {
                validateNode(node.else, `${path}.else`, context, seenNodeIds, issues);
            }
            return;
        }
        case 'loop': {
            validateLoopNode(node, path, context, seenNodeIds, issues);
            return;
        }
        case 'emit_event': {
            if (!isNonEmptyString(node.eventId)) {
                issues.push(
                    createIssue(
                        'error',
                        'invalid_actor_program_event',
                        'Emit event node requires a non-empty eventId.',
                        `${path}.eventId`
                    )
                );
            }
            return;
        }
        default: {
            const neverNode: never = node;
            return neverNode;
        }
    }
};

const validateActionNode = (
    node: ActorProgramActionNode,
    path: string,
    context: ActorProgramValidationContext,
    issues: ValidationIssue[]
): void => {
    const actionDefinition = context.actionCatalog.get(node.actionType);
    if (!actionDefinition) {
        issues.push(
            createIssue(
                'error',
                'unknown_action_type',
                `Unknown actor program action type "${node.actionType}".`,
                `${path}.actionType`
            )
        );
        return;
    }

    const params = (node.params ?? {}) as Readonly<Record<string, unknown>>;
    const paramIssues = actionDefinition.validate(params, context.authoringContext);
    paramIssues.forEach((issue) => {
        issues.push(appendPath(issue, `${path}.params`));
    });
};

const validateLoopNode = (
    node: ActorProgramLoopNode,
    path: string,
    context: ActorProgramValidationContext,
    seenNodeIds: Set<string>,
    issues: ValidationIssue[]
): void => {
    validateNode(node.child, `${path}.child`, context, seenNodeIds, issues);

    if (node.conditions) {
        node.conditions.forEach((condition, index) => {
            validateCondition(condition, `${path}.conditions[${index}]`, issues);
        });
    }

    if (node.policy === 'count') {
        if (!Number.isFinite(node.count) || !Number.isInteger(node.count) || (node.count ?? -1) < 0) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_actor_program_loop',
                    'Loop policy "count" requires count to be a finite integer >= 0.',
                    `${path}.count`
                )
            );
        }
    }

    if (node.policy === 'while_conditions') {
        if (!node.conditions || node.conditions.length === 0) {
            issues.push(
                createIssue(
                    'error',
                    'invalid_actor_program_loop',
                    'Loop policy "while_conditions" requires at least one condition.',
                    `${path}.conditions`
                )
            );
        }
    }

    if (node.policy === 'forever' && node.maxIterations === undefined) {
        issues.push(
            createIssue(
                'warning',
                'invalid_actor_program_loop',
                'Loop policy "forever" should specify maxIterations for editor-authored content.',
                `${path}.maxIterations`
            )
        );
    }
};

const validateCondition = (condition: ActorProgramCondition, path: string, issues: ValidationIssue[]): void => {
    if (!isNonEmptyString(condition.type)) {
        issues.push(
            createIssue(
                'error',
                'invalid_actor_program_condition',
                'Condition placeholder requires a non-empty type.',
                `${path}.type`
            )
        );
    }
};

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
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
    path?: string
): ValidationIssue => {
    return {
        severity,
        code,
        message,
        path
    };
};