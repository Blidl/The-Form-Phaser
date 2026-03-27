export interface SquareRolloverResolution {
    shouldDetach: boolean;
    transitioned: boolean;
    nextNormalX: -1 | 0 | 1;
    nextNormalY: -1 | 0 | 1;
}

export const resolveSquareRollover = (
    attachedNormalX: -1 | 0 | 1,
    attachedNormalY: -1 | 0 | 1,
    contactNormalX: -1 | 0 | 1,
    contactNormalY: -1 | 0 | 1
): SquareRolloverResolution => {
    const sameNormal = attachedNormalX === contactNormalX && attachedNormalY === contactNormalY;
    if (sameNormal) {
        return {
            shouldDetach: false,
            transitioned: false,
            nextNormalX: attachedNormalX,
            nextNormalY: attachedNormalY
        };
    }

    const isOrthogonalTransition = ((attachedNormalX * contactNormalX) + (attachedNormalY * contactNormalY)) === 0;
    if (isOrthogonalTransition) {
        return {
            shouldDetach: false,
            transitioned: true,
            nextNormalX: contactNormalX,
            nextNormalY: contactNormalY
        };
    }

    return {
        shouldDetach: true,
        transitioned: false,
        nextNormalX: attachedNormalX,
        nextNormalY: attachedNormalY
    };
};
