export type TestEventCondition =
    | {
        kind: 'flag';
        flagId: string;
        equals: boolean;
    }
    | {
        kind: 'once';
        key?: string;
    }
    | {
        kind: 'player_form';
        form: string;
    };

export interface TestEventConditionContext {
    getWorldFlag: (flagId: string) => boolean;
    getPlayerFormId: () => string | null;
    isOnceConsumed?: (key: string) => boolean;
}

export interface EvaluateTestEventConditionsDetail {
    passed: boolean;
    pendingOnceKeys: string[];
}

const normalizeStableKey = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
};

const resolveOnceKey = (
    ownerKey: string,
    explicitKey?: string
): string | null => {
    const normalizedExplicitKey = normalizeStableKey(explicitKey);
    if (normalizedExplicitKey) {
        return normalizedExplicitKey;
    }
    return normalizeStableKey(ownerKey);
};

export const evaluateTestEventConditionsDetailed = (
    context: TestEventConditionContext,
    conditions: readonly TestEventCondition[] | null | undefined,
    ownerKey: string
): EvaluateTestEventConditionsDetail => {
    if (!Array.isArray(conditions) || conditions.length <= 0) {
        return {
            passed: true,
            pendingOnceKeys: []
        };
    }

    const pendingOnceKeys: string[] = [];
    const knownOnceKeys = new Set<string>();
    for (const condition of conditions) {
        if (!condition || typeof condition !== 'object' || typeof condition.kind !== 'string') {
            return {
                passed: false,
                pendingOnceKeys: []
            };
        }

        if (condition.kind === 'flag') {
            const normalizedFlagId = normalizeStableKey(condition.flagId);
            if (!normalizedFlagId || typeof condition.equals !== 'boolean') {
                return {
                    passed: false,
                    pendingOnceKeys: []
                };
            }
            const currentValue = context.getWorldFlag(normalizedFlagId);
            if (currentValue !== condition.equals) {
                return {
                    passed: false,
                    pendingOnceKeys: []
                };
            }
            continue;
        }

        if (condition.kind === 'once') {
            const onceKey = resolveOnceKey(ownerKey, condition.key);
            if (!onceKey) {
                return {
                    passed: false,
                    pendingOnceKeys: []
                };
            }
            const isConsumed = context.isOnceConsumed?.(onceKey) ?? false;
            if (isConsumed) {
                return {
                    passed: false,
                    pendingOnceKeys: []
                };
            }
            if (!knownOnceKeys.has(onceKey)) {
                knownOnceKeys.add(onceKey);
                pendingOnceKeys.push(onceKey);
            }
            continue;
        }

        if (condition.kind === 'player_form') {
            const expectedFormId = normalizeStableKey(condition.form);
            const currentFormId = normalizeStableKey(context.getPlayerFormId());
            if (!expectedFormId || !currentFormId || expectedFormId !== currentFormId) {
                return {
                    passed: false,
                    pendingOnceKeys: []
                };
            }
            continue;
        }

        return {
            passed: false,
            pendingOnceKeys: []
        };
    }

    return {
        passed: true,
        pendingOnceKeys
    };
};

export const evaluateTestEventConditions = (
    context: TestEventConditionContext,
    conditions: readonly TestEventCondition[] | null | undefined,
    ownerKey: string
): boolean => {
    return evaluateTestEventConditionsDetailed(context, conditions, ownerKey).passed;
};
