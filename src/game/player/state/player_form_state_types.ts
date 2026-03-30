import type { PlayerFormId } from '../player_types';

export interface PlayerFormSwitchIntentSnapshot {
    currentForm: PlayerFormId;
    transformLockMs: number;
    wantsNextForm: boolean;
    wantsPrevForm: boolean;
    nextForm: PlayerFormId;
    prevForm: PlayerFormId;
}

export interface PlayerFormSwitchDecision {
    shouldSwitch: boolean;
    targetForm: PlayerFormId;
    shouldApplyTransformLock: boolean;
}

export interface PlayerFormTransitionResetDirective {
    stopTriangleFlight: boolean;
    resetTriangleFlight: boolean;
    resetTriangleShell: boolean;
    resetSquareShell: boolean;
    clearSquareAttach: boolean;
}

export interface PlayerTriangleFlightStartSnapshot {
    currentForm: PlayerFormId;
    actionPressed: boolean;
    isFlightActive: boolean;
    grounded: boolean;
    hasFullFlightResource: boolean;
    hasAnyFlightResource: boolean;
}

export interface PlayerTriangleFlightStartDecision {
    canStart: boolean;
}

export interface PlayerSquareAttachEntryBufferSnapshot {
    currentForm: PlayerFormId;
    actionPressed: boolean;
    actionHeld: boolean;
}

export interface PlayerSquareAttachEntryBufferDirective {
    shouldPushEntryBuffer: boolean;
    shouldClearEntryBuffer: boolean;
}

export interface PlayerSquareAttachStartSnapshot {
    currentForm: PlayerFormId;
    actionHeld: boolean;
    hasEntryBuffer: boolean;
    isAttached: boolean;
    hasContact: boolean;
}

export interface PlayerSquareAttachStartDecision {
    canStart: boolean;
}

export interface PlayerSquareAttachHoldSnapshot {
    currentForm: PlayerFormId;
    isAttached: boolean;
    actionHeld: boolean;
}

export interface PlayerSquareAttachHoldDecision {
    shouldKeepAttachHold: boolean;
}

export interface PlayerFreezeResetDirective {
    shouldClearAirborneWindDrift: boolean;
    shouldResetTriangleFlight: boolean;
    shouldFreezeRespawnState: boolean;
}

export interface PlayerRespawnResetDirective {
    nextForm: PlayerFormId;
    resetTriangleShell: boolean;
    resetSquareShell: boolean;
    resetTriangleFlight: boolean;
    clearJumpBuffer: boolean;
    clearSquareAttachEntryBuffer: boolean;
    clearCoyoteTime: boolean;
    resetTransformLock: boolean;
    resetDeathPause: boolean;
    resetJumpCutConsumed: boolean;
    resetBoostCooldown: boolean;
    resetBoostActive: boolean;
    resetPendingBoostRequest: boolean;
    resetWasGrounded: boolean;
    resetLastMoveDirection: boolean;
    resetReboundWindow: boolean;
    resetReboundJumpVelocity: boolean;
    resetLastAirborneDownwardSpeed: boolean;
    resetAirborneWindDrift: boolean;
    unfreezeRespawnState: boolean;
}

export interface PlayerFormStateCombinationSnapshot {
    currentForm: PlayerFormId;
    triangleFlightActive: boolean;
    squareAttached: boolean;
}

export interface PlayerFormStateCombinationFlags {
    triangleFlightOutsideTriangle: boolean;
    squareAttachOutsideSquare: boolean;
}
