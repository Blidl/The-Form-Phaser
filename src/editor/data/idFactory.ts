const LEVEL_ID_PREFIX = 'level';
const LEVEL_ID_PAD = 3;
const OBJECT_ID_PREFIX = 'object';
const OBJECT_ID_PAD = 4;

const escapeForRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const nextIdFrom = (existingIds: readonly string[], prefix: string, padLength: number): string => {
    const matcher = new RegExp(`^${escapeForRegExp(prefix)}_(\\d+)$`);
    let maxNumericId = 0;

    existingIds.forEach((id) => {
        const match = id.match(matcher);
        if (!match) {
            return;
        }

        const numeric = Number.parseInt(match[1], 10);
        if (Number.isNaN(numeric)) {
            return;
        }
        maxNumericId = Math.max(maxNumericId, numeric);
    });

    const nextNumeric = maxNumericId + 1;
    return `${prefix}_${String(nextNumeric).padStart(padLength, '0')}`;
};

export const createNextLevelId = (existingLevelIds: readonly string[]): string => {
    return nextIdFrom(existingLevelIds, LEVEL_ID_PREFIX, LEVEL_ID_PAD);
};

export const createNextObjectId = (existingObjectIds: readonly string[]): string => {
    return nextIdFrom(existingObjectIds, OBJECT_ID_PREFIX, OBJECT_ID_PAD);
};
