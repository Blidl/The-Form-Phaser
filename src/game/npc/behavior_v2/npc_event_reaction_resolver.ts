import type {
    NpcBehaviorAsset,
    NpcBehaviorEvaluationContext,
    NpcBehaviorResolvedEventReaction,
    NpcEventReactionInput
} from './npc_behavior_v2_types';

export const resolveNpcEventReaction = (
    asset: NpcBehaviorAsset,
    event: NpcEventReactionInput,
    context?: NpcBehaviorEvaluationContext
): NpcBehaviorResolvedEventReaction | null => {
    let selected: NpcBehaviorAsset['eventReactions'][number] | null = null;

    for (const reaction of asset.eventReactions) {
        if (reaction.enabled !== true) {
            continue;
        }
        if (reaction.eventType !== event.eventType) {
            continue;
        }

        if (reaction.conditions && reaction.conditions.length > 0) {
            if (!context?.evaluateConditions) {
                continue;
            }
            if (!context.evaluateConditions(reaction.conditions)) {
                continue;
            }
        }

        if (!selected) {
            selected = reaction;
            continue;
        }

        if (reaction.priority > selected.priority) {
            selected = reaction;
            continue;
        }
        if (reaction.priority === selected.priority && reaction.id.localeCompare(selected.id) < 0) {
            selected = reaction;
        }
    }

    if (!selected) {
        return null;
    }

    return {
        assetId: asset.id,
        reaction: selected,
        event
    };
};
