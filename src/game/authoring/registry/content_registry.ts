import type { ContentReferenceKind } from '../validation/validation_types';
import { getReferenceIds, hasReference, type ReferenceIndex } from './reference_index';

export interface ContentRegistry {
    readonly referenceIndex: ReferenceIndex;
    has(kind: ContentReferenceKind, id: string): boolean;
    list(kind: ContentReferenceKind): readonly string[];
}

export const createContentRegistry = (referenceIndex: ReferenceIndex): ContentRegistry => {
    return {
        referenceIndex,
        has(kind: ContentReferenceKind, id: string): boolean {
            return hasReference(referenceIndex, kind, id);
        },
        list(kind: ContentReferenceKind): readonly string[] {
            return getReferenceIds(referenceIndex, kind);
        }
    };
};
