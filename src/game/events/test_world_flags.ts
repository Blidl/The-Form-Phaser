export interface TestWorldFlagsSnapshot {
    readonly [flagId: string]: boolean;
}

export interface TestWorldFlagsRuntime {
    setWorldFlag: (flagId: string, value: boolean) => void;
    getWorldFlag: (flagId: string) => boolean;
    resetWorldFlags: (initialFlags?: Record<string, boolean> | null | undefined) => void;
    getWorldFlagsDebugSnapshot: () => TestWorldFlagsSnapshot;
}

const createRuntimeStore = (): TestWorldFlagsRuntime => {
    const store = new Map<string, boolean>();

    const normalizeFlagId = (flagId: string): string | null => {
        if (typeof flagId !== 'string') {
            return null;
        }
        const normalized = flagId.trim();
        return normalized.length > 0 ? normalized : null;
    };

    return {
        setWorldFlag: (flagId, value): void => {
            const normalizedFlagId = normalizeFlagId(flagId);
            if (!normalizedFlagId) {
                return;
            }
            store.set(normalizedFlagId, Boolean(value));
        },
        getWorldFlag: (flagId): boolean => {
            const normalizedFlagId = normalizeFlagId(flagId);
            if (!normalizedFlagId) {
                return false;
            }
            return store.get(normalizedFlagId) ?? false;
        },
        resetWorldFlags: (initialFlags): void => {
            store.clear();
            if (!initialFlags || typeof initialFlags !== 'object') {
                return;
            }
            Object.entries(initialFlags).forEach(([flagId, value]) => {
                const normalizedFlagId = normalizeFlagId(flagId);
                if (!normalizedFlagId || typeof value !== 'boolean') {
                    return;
                }
                store.set(normalizedFlagId, value);
            });
        },
        getWorldFlagsDebugSnapshot: (): TestWorldFlagsSnapshot => {
            const snapshot: Record<string, boolean> = {};
            store.forEach((value, flagId) => {
                snapshot[flagId] = value;
            });
            return snapshot;
        }
    };
};

const DEFAULT_WORLD_FLAGS_RUNTIME = createRuntimeStore();

export const setWorldFlag = (flagId: string, value: boolean): void => {
    DEFAULT_WORLD_FLAGS_RUNTIME.setWorldFlag(flagId, value);
};

export const getWorldFlag = (flagId: string): boolean => {
    return DEFAULT_WORLD_FLAGS_RUNTIME.getWorldFlag(flagId);
};

export const resetWorldFlags = (initialFlags?: Record<string, boolean> | null): void => {
    DEFAULT_WORLD_FLAGS_RUNTIME.resetWorldFlags(initialFlags);
};

export const getWorldFlagsDebugSnapshot = (): TestWorldFlagsSnapshot => {
    return DEFAULT_WORLD_FLAGS_RUNTIME.getWorldFlagsDebugSnapshot();
};
