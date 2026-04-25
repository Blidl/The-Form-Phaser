import type { ActionDefinition } from './action_types';

export interface ActionCatalog {
    register(definition: ActionDefinition): void;
    get(type: string): ActionDefinition | null;
    list(): readonly ActionDefinition[];
    has(type: string): boolean;
}

const normalizeActionTypeId = (type: string): string => {
    return type.trim();
};

export const createActionCatalog = (initialDefinitions: readonly ActionDefinition[] = []): ActionCatalog => {
    const definitionsByType = new Map<string, ActionDefinition>();

    const register = (definition: ActionDefinition): void => {
        const normalizedType = normalizeActionTypeId(definition.type);
        if (normalizedType.length === 0) {
            throw new Error('invalid_action_type: action type id must not be empty');
        }
        if (definitionsByType.has(normalizedType)) {
            throw new Error(`duplicate_action_type: action type "${normalizedType}" is already registered`);
        }

        definitionsByType.set(normalizedType, definition);
    };

    const get = (type: string): ActionDefinition | null => {
        const normalizedType = normalizeActionTypeId(type);
        if (normalizedType.length === 0) {
            return null;
        }
        return definitionsByType.get(normalizedType) ?? null;
    };

    const has = (type: string): boolean => {
        const normalizedType = normalizeActionTypeId(type);
        if (normalizedType.length === 0) {
            return false;
        }
        return definitionsByType.has(normalizedType);
    };

    const list = (): readonly ActionDefinition[] => {
        return [...definitionsByType.entries()]
            .sort(([leftType], [rightType]) => leftType.localeCompare(rightType))
            .map(([, definition]) => definition);
    };

    const catalog: ActionCatalog = {
        register,
        get,
        list,
        has
    };

    registerActionDefinitions(catalog, initialDefinitions);

    return catalog;
};

export const registerActionDefinitions = (
    catalog: ActionCatalog,
    definitions: readonly ActionDefinition[]
): void => {
    definitions.forEach((definition) => {
        catalog.register(definition);
    });
};
