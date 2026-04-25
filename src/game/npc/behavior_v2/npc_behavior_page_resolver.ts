import type {
    NpcBehaviorAsset,
    NpcBehaviorEvaluationContext,
    NpcBehaviorResolvedPage
} from './npc_behavior_v2_types';

export const resolveNpcBehaviorPage = (
    asset: NpcBehaviorAsset,
    context?: NpcBehaviorEvaluationContext
): NpcBehaviorResolvedPage | null => {
    let selected: NpcBehaviorAsset['pages'][number] | null = null;

    for (const page of asset.pages) {
        if (page.enabled !== true) {
            continue;
        }

        if (page.conditions.length > 0) {
            if (!context?.evaluateConditions) {
                continue;
            }
            if (!context.evaluateConditions(page.conditions)) {
                continue;
            }
        }

        if (!selected) {
            selected = page;
            continue;
        }

        if (page.priority > selected.priority) {
            selected = page;
            continue;
        }
        if (page.priority === selected.priority && page.id.localeCompare(selected.id) < 0) {
            selected = page;
        }
    }

    if (!selected) {
        return null;
    }

    return {
        assetId: asset.id,
        page: selected
    };
};
