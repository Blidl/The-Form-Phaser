import type { PlayerFormId } from '../player_types';
import type {
    PlayerFormStateCombinationFlags,
    PlayerFormStateCombinationSnapshot,
    PlayerFormSwitchDecision,
    PlayerFormSwitchIntentSnapshot,
    PlayerFormTransitionResetDirective,
    PlayerFreezeResetDirective,
    PlayerRespawnResetDirective,
    PlayerSquareAttachEntryBufferDirective,
    PlayerSquareAttachEntryBufferSnapshot,
    PlayerSquareAttachHoldDecision,
    PlayerSquareAttachHoldSnapshot,
    PlayerSquareAttachStartDecision,
    PlayerSquareAttachStartSnapshot,
    PlayerTriangleDashStartDecision,
    PlayerTriangleDashStartSnapshot
} from './player_form_state_types';

const EMPTY_SWITCH_DECISION: PlayerFormSwitchDecision = {
    shouldSwitch: false,
    targetForm: 'ball',
    shouldApplyTransformLock: false
};

const EMPTY_TRANSITION_RESET_DIRECTIVE: PlayerFormTransitionResetDirective = {
    stopTriangleDash: false,
    resetTriangleDash: false,
    resetTriangleShell: false,
    resetSquareShell: false,
    clearSquareAttach: false
};

const EMPTY_SQUARE_ATTACH_ENTRY_BUFFER_DIRECTIVE: PlayerSquareAttachEntryBufferDirective = {
    shouldPushEntryBuffer: false,
    shouldClearEntryBuffer: false
};

const EMPTY_DASH_START_DECISION: PlayerTriangleDashStartDecision = {
    canStart: false
};

const EMPTY_SQUARE_ATTACH_START_DECISION: PlayerSquareAttachStartDecision = {
    canStart: false
};

const EMPTY_SQUARE_ATTACH_HOLD_DECISION: PlayerSquareAttachHoldDecision = {
    shouldKeepAttachHold: false
};

const DEFAULT_FREEZE_RESET_DIRECTIVE: PlayerFreezeResetDirective = {
    shouldClearAirborneWindDrift: true,
    shouldResetTriangleDash: true,
    shouldFreezeRespawnState: true
};

export const resolveFormSwitchDecision = (
    snapshot: PlayerFormSwitchIntentSnapshot
): PlayerFormSwitchDecision => {
    if (snapshot.transformLockMs > 0) {
        return {
            ...EMPTY_SWITCH_DECISION,
            targetForm: snapshot.currentForm
        };
    }

    if (snapshot.wantsNextForm === snapshot.wantsPrevForm) {
        return {
            ...EMPTY_SWITCH_DECISION,
            targetForm: snapshot.currentForm
        };
    }

    const targetForm = snapshot.wantsNextForm ? snapshot.nextForm : snapshot.prevForm;
    if (targetForm === snapshot.currentForm) {
        return {
            ...EMPTY_SWITCH_DECISION,
            targetForm: snapshot.currentForm
        };
    }

    return {
        shouldSwitch: true,
        targetForm,
        shouldApplyTransformLock: true
    };
};

export const resolveFormTransitionResetDirective = (
    previousForm: PlayerFormId,
    nextForm: PlayerFormId
): PlayerFormTransitionResetDirective => {
    if (nextForm === 'triangle') {
        return {
            ...EMPTY_TRANSITION_RESET_DIRECTIVE,
            stopTriangleDash: true,
            resetTriangleDash: true,
            resetTriangleShell: true
        };
    }

    if (nextForm === 'square') {
        const resetDirective: PlayerFormTransitionResetDirective = {
            ...EMPTY_TRANSITION_RESET_DIRECTIVE,
            resetSquareShell: true
        };
        if (previousForm === 'triangle') {
            resetDirective.stopTriangleDash = true;
            resetDirective.resetTriangleDash = true;
        }
        return resetDirective;
    }

    if (previousForm === 'square') {
        return {
            ...EMPTY_TRANSITION_RESET_DIRECTIVE,
            clearSquareAttach: true
        };
    }

    if (previousForm === 'triangle') {
        return {
            ...EMPTY_TRANSITION_RESET_DIRECTIVE,
            stopTriangleDash: true,
            resetTriangleDash: true
        };
    }

    return EMPTY_TRANSITION_RESET_DIRECTIVE;
};

export const resolveTriangleDashStartDecision = (
    snapshot: PlayerTriangleDashStartSnapshot
): PlayerTriangleDashStartDecision => {
    if (!snapshot.actionPressed || snapshot.currentForm !== 'triangle') {
        return EMPTY_DASH_START_DECISION;
    }

    if (snapshot.isDashActive) {
        return EMPTY_DASH_START_DECISION;
    }

    if (snapshot.dashCooldownMs > 0) {
        return EMPTY_DASH_START_DECISION;
    }

    if (!snapshot.hasDashCharges) {
        return EMPTY_DASH_START_DECISION;
    }

    return { canStart: true };
};

export const resolveSquareAttachEntryBufferDirective = (
    snapshot: PlayerSquareAttachEntryBufferSnapshot
): PlayerSquareAttachEntryBufferDirective => {
    if (snapshot.currentForm === 'square' && snapshot.actionPressed) {
        return {
            ...EMPTY_SQUARE_ATTACH_ENTRY_BUFFER_DIRECTIVE,
            shouldPushEntryBuffer: true
        };
    }

    if (!snapshot.actionHeld || snapshot.currentForm !== 'square') {
        return {
            ...EMPTY_SQUARE_ATTACH_ENTRY_BUFFER_DIRECTIVE,
            shouldClearEntryBuffer: true
        };
    }

    return EMPTY_SQUARE_ATTACH_ENTRY_BUFFER_DIRECTIVE;
};

export const resolveSquareAttachStartDecision = (
    snapshot: PlayerSquareAttachStartSnapshot
): PlayerSquareAttachStartDecision => {
    if (snapshot.currentForm !== 'square') {
        return EMPTY_SQUARE_ATTACH_START_DECISION;
    }

    if (!snapshot.actionHeld || !snapshot.hasEntryBuffer) {
        return EMPTY_SQUARE_ATTACH_START_DECISION;
    }

    if (snapshot.isAttached || !snapshot.hasContact) {
        return EMPTY_SQUARE_ATTACH_START_DECISION;
    }

    return { canStart: true };
};

export const resolveSquareAttachHoldDecision = (
    snapshot: PlayerSquareAttachHoldSnapshot
): PlayerSquareAttachHoldDecision => {
    if (snapshot.currentForm !== 'square') {
        return EMPTY_SQUARE_ATTACH_HOLD_DECISION;
    }

    if (!snapshot.isAttached) {
        return EMPTY_SQUARE_ATTACH_HOLD_DECISION;
    }

    return {
        shouldKeepAttachHold: snapshot.actionHeld
    };
};

export const resolveFreezeResetDirective = (): PlayerFreezeResetDirective => {
    return DEFAULT_FREEZE_RESET_DIRECTIVE;
};

export const resolveRespawnResetDirective = (
    startForm: PlayerFormId
): PlayerRespawnResetDirective => {
    return {
        nextForm: startForm,
        resetTriangleShell: true,
        resetSquareShell: true,
        resetTriangleDash: true,
        resetTriangleCharges: true,
        clearJumpBuffer: true,
        clearSquareAttachEntryBuffer: true,
        clearCoyoteTime: true,
        resetTransformLock: true,
        resetDeathPause: true,
        resetJumpCutConsumed: true,
        resetBoostCooldown: true,
        resetBoostActive: true,
        resetPendingBoostRequest: true,
        resetWasGrounded: true,
        resetLastMoveDirection: true,
        resetReboundWindow: true,
        resetReboundJumpVelocity: true,
        resetLastAirborneDownwardSpeed: true,
        resetAirborneWindDrift: true,
        unfreezeRespawnState: true
    };
};

export const resolveInvalidFormStateCombinationFlags = (
    snapshot: PlayerFormStateCombinationSnapshot
): PlayerFormStateCombinationFlags => {
    return {
        triangleDashOutsideTriangle: snapshot.currentForm !== 'triangle' && snapshot.triangleDashActive,
        squareAttachOutsideSquare: snapshot.currentForm !== 'square' && snapshot.squareAttached
    };
};
