import { asOptionalString } from './LogicAuthoringValidation';

export interface ResolveIdInput {
    requestedId?: string;
    prefix: string;
    existingIds: Set<string>;
}

export const resolveId = (input: ResolveIdInput): string => {
    const requested = asOptionalString(input.requestedId);
    if (!requested) {
        return generateNextId(input.prefix, input.existingIds);
    }
    if (!input.existingIds.has(requested)) {
        input.existingIds.add(requested);
        return requested;
    }
    let suffix = 1;
    let candidate = `${requested}_${suffix}`;
    while (input.existingIds.has(candidate)) {
        suffix += 1;
        candidate = `${requested}_${suffix}`;
    }
    input.existingIds.add(candidate);
    return candidate;
};

export const generateNextId = (prefix: string, existingIds: Set<string>): string => {
    let index = 1;
    let candidate = `${prefix}_${index}`;
    while (existingIds.has(candidate)) {
        index += 1;
        candidate = `${prefix}_${index}`;
    }
    existingIds.add(candidate);
    return candidate;
};

export const generateDuplicateName = (name: string, existingNames: Set<string>): string => {
    const baseName = asOptionalString(name) ?? 'Logic Script';
    const copyLabel = `${baseName} Copy`;
    if (!existingNames.has(copyLabel)) {
        return copyLabel;
    }
    let index = 2;
    let candidate = `${copyLabel} ${index}`;
    while (existingNames.has(candidate)) {
        index += 1;
        candidate = `${copyLabel} ${index}`;
    }
    return candidate;
};
