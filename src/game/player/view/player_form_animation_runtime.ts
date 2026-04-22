import { Math as PhaserMath } from 'phaser';
import type { PlayerFormId } from '../player_types';
import { type PlayerFormAnimationPhasePulse, type PlayerFormAnimationProfile, resolvePlayerFormAnimationProfile } from './player_form_animation_profiles';
import { PlayerFormAnimationPhasePulseRuntime } from './player_form_animation_phase_pulse';
import type { PlayerPresentationFrameHooks } from './player_presentation_hooks';

interface PlayerFormAnimationRuntimeInput {
    currentForm: PlayerFormId;
    grounded: boolean;
    hooks: PlayerPresentationFrameHooks;
    velocityX: number;
    velocityY: number;
    deltaMs: number;
}

export interface PlayerFormAnimationPose {
    scaleX: number;
    scaleY: number;
    stretchAxisX: number | null;
    stretchAxisY: number | null;
}

export class PlayerFormAnimationRuntime {
    private static readonly IMPULSE_RECOVER_SCALE: PlayerFormAnimationPhasePulse = {
        scaleX: 1,
        scaleY: 1,
        durationMs: 110
    };
    private static readonly SQUARE_IMPULSE_RECOVER_SCALE: PlayerFormAnimationPhasePulse = {
        scaleX: 1,
        scaleY: 1,
        durationMs: 130
    };

    private static readonly BALL_BOOST_GROUND_START_PULSE: PlayerFormAnimationPhasePulse = {
        scaleX: 0.82,
        scaleY: 1.22,
        durationMs: 82
    };

    private static readonly BALL_SPEED_MAX_FOR_FULL_STRETCH = 620;
    private static readonly BALL_SPEED_LOW_NEUTRAL_THRESHOLD = 50;
    private static readonly BALL_SPEED_AXIS_FALLBACK_THRESHOLD = 40;
    private static readonly BALL_CONTINUOUS_STRETCH_MAX = 1.08;
    private static readonly BALL_CONTINUOUS_SQUASH_MIN = 0.95;
    private static readonly BALL_NEUTRAL_RETURN_SMOOTH_SEC = 0.03;
    private static readonly IMPULSE_AXIS_HOLD_MS = 120;
    private static readonly BOOST_SUSTAIN_AXIS_HOLD_MS = 50;

    private currentForm: PlayerFormId;
    private readonly phasePulse: PlayerFormAnimationPhasePulseRuntime;
    private airScaleX: number;
    private airScaleY: number;
    private airFollowWeight: number;
    private airFollowRecoverDurationMs: number;
    private impulseAxisX: number;
    private impulseAxisY: number;
    private impulseAxisMs: number;
    private boostSustainBlend: number;

    public constructor(initialForm: PlayerFormId) {
        this.currentForm = initialForm;
        this.phasePulse = new PlayerFormAnimationPhasePulseRuntime();
        this.airScaleX = 1;
        this.airScaleY = 1;
        this.airFollowWeight = 1;
        this.airFollowRecoverDurationMs = 0;
        this.impulseAxisX = 0;
        this.impulseAxisY = -1;
        this.impulseAxisMs = 0;
        this.boostSustainBlend = 0;
    }

    public resetPose(formId: PlayerFormId): void {
        this.currentForm = formId;
        this.phasePulse.reset();
        this.airScaleX = 1;
        this.airScaleY = 1;
        this.airFollowWeight = 1;
        this.airFollowRecoverDurationMs = 0;
        this.impulseAxisX = 0;
        this.impulseAxisY = -1;
        this.impulseAxisMs = 0;
        this.boostSustainBlend = 0;
    }

    public onFormSwitchIn(nextForm: PlayerFormId): void {
        this.resetPose(nextForm);
        const profile = resolvePlayerFormAnimationProfile(nextForm);
        this.phasePulse.trigger([profile.formSwitchIn]);
        this.airFollowWeight = 0;
        this.airFollowRecoverDurationMs = Math.max(0, profile.formSwitchIn.durationMs);
    }

    public tick(input: PlayerFormAnimationRuntimeInput): PlayerFormAnimationPose {
        if (input.hooks.formSwitchIn !== null) {
            this.onFormSwitchIn(input.hooks.formSwitchIn);
        } else if (input.currentForm !== this.currentForm) {
            this.onFormSwitchIn(input.currentForm);
        }

        const profile = resolvePlayerFormAnimationProfile(this.currentForm);
        this.consumeHooks(input.hooks, profile, this.currentForm);

        this.tickAirFollowWeight(input.deltaMs);
        this.tickImpulseAxisTimer(input.deltaMs);
        this.phasePulse.tick(input.deltaMs);
        this.tickFollowScale(profile, input, this.currentForm);

        const blendedAirScaleX = PhaserMath.Linear(1, this.airScaleX, this.airFollowWeight);
        const blendedAirScaleY = PhaserMath.Linear(1, this.airScaleY, this.airFollowWeight);
        const stretchAxis = this.resolveStretchAxis(this.currentForm, input.velocityX, input.velocityY);
        return {
            scaleX: this.phasePulse.currentScaleX * blendedAirScaleX,
            scaleY: this.phasePulse.currentScaleY * blendedAirScaleY,
            stretchAxisX: stretchAxis.x,
            stretchAxisY: stretchAxis.y
        };
    }

    private consumeHooks(
        hooks: PlayerPresentationFrameHooks,
        profile: PlayerFormAnimationProfile,
        currentForm: PlayerFormId
    ): void {
        if (currentForm === 'triangle') {
            if (hooks.landImpactSpeed !== null) {
                this.onLandImpact(hooks.landImpactSpeed, profile);
            }
            return;
        }

        if (currentForm === 'square') {
            if (hooks.jumpCommit) {
                this.phasePulse.trigger([profile.jumpCommit, PlayerFormAnimationRuntime.SQUARE_IMPULSE_RECOVER_SCALE]);
                this.applyImpulseAxisFromHook(
                    hooks.jumpCommitImpulseX,
                    hooks.jumpCommitImpulseY,
                    PlayerFormAnimationRuntime.IMPULSE_AXIS_HOLD_MS
                );
            }
            if (hooks.squareAttachJumpCommit && profile.squareAttachJumpCommit !== undefined) {
                this.phasePulse.trigger([profile.squareAttachJumpCommit, PlayerFormAnimationRuntime.SQUARE_IMPULSE_RECOVER_SCALE]);
                this.applyImpulseAxisFromHook(
                    hooks.squareAttachJumpCommitImpulseX,
                    hooks.squareAttachJumpCommitImpulseY,
                    PlayerFormAnimationRuntime.IMPULSE_AXIS_HOLD_MS
                );
            }
            if (hooks.landImpactSpeed !== null) {
                this.onLandImpact(hooks.landImpactSpeed, profile);
            }
            return;
        }

        if (hooks.jumpCommit) {
            this.phasePulse.trigger([profile.jumpCommit, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
            this.applyImpulseAxisFromHook(
                hooks.jumpCommitImpulseX,
                hooks.jumpCommitImpulseY,
                PlayerFormAnimationRuntime.IMPULSE_AXIS_HOLD_MS
            );
        }
        if (hooks.apexEnter) {
            this.phasePulse.trigger([profile.apexEnter]);
        }
        if (hooks.ballReboundLaunch && profile.ballReboundLaunch !== undefined) {
            this.phasePulse.trigger([profile.ballReboundLaunch, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
            this.applyImpulseAxisFromHook(
                hooks.ballReboundLaunchImpulseX,
                hooks.ballReboundLaunchImpulseY,
                PlayerFormAnimationRuntime.IMPULSE_AXIS_HOLD_MS
            );
        }
        if (hooks.ballBoostGroundStart) {
            this.phasePulse.trigger([
                PlayerFormAnimationRuntime.BALL_BOOST_GROUND_START_PULSE,
                PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE
            ]);
            this.applyImpulseAxisFromHook(
                hooks.ballBoostGroundStartImpulseX,
                hooks.ballBoostGroundStartImpulseY,
                PlayerFormAnimationRuntime.IMPULSE_AXIS_HOLD_MS
            );
        }
        if (hooks.ballBoostGroundSustain) {
            this.applyImpulseAxisFromHook(
                hooks.ballBoostGroundSustainDirX,
                hooks.ballBoostGroundSustainDirY,
                PlayerFormAnimationRuntime.BOOST_SUSTAIN_AXIS_HOLD_MS
            );
        }
        if (hooks.landImpactSpeed !== null) {
            this.onLandImpact(hooks.landImpactSpeed, profile);
        }
    }

    private onLandImpact(impactSpeed: number, profile: PlayerFormAnimationProfile): void {
        const normalizedImpact = PhaserMath.Clamp(
            impactSpeed / Math.max(1, profile.landImpactSpeedForMax),
            0,
            1
        );
        if (normalizedImpact <= 0) {
            return;
        }

        this.phasePulse.trigger([
            {
                scaleX: PhaserMath.Linear(1, profile.landImpactMax.scaleX, normalizedImpact),
                scaleY: PhaserMath.Linear(1, profile.landImpactMax.scaleY, normalizedImpact),
                durationMs: profile.landImpactMax.durationMs
            },
            profile.landRecover
        ]);
    }

    private tickFollowScale(
        profile: PlayerFormAnimationProfile,
        input: PlayerFormAnimationRuntimeInput,
        form: PlayerFormId
    ): void {
        if (form !== 'ball') {
            const deltaSec = Math.max(0, input.deltaMs) / 1000;
            const nonBallSmoothingAlpha = 1 - Math.exp(-deltaSec / Math.max(0.0001, profile.airSmoothingTimeSec));
            this.airScaleX = PhaserMath.Linear(this.airScaleX, 1, nonBallSmoothingAlpha);
            this.airScaleY = PhaserMath.Linear(this.airScaleY, 1, nonBallSmoothingAlpha);
            this.boostSustainBlend = PhaserMath.Linear(this.boostSustainBlend, 0, nonBallSmoothingAlpha);
            return;
        }

        const speed = Math.hypot(input.velocityX, input.velocityY);
        const normalizedSpeed = PhaserMath.Clamp(
            speed / PlayerFormAnimationRuntime.BALL_SPEED_MAX_FOR_FULL_STRETCH,
            0,
            1
        );
        const lowSpeed = speed < PlayerFormAnimationRuntime.BALL_SPEED_LOW_NEUTRAL_THRESHOLD;

        let targetScaleX = PhaserMath.Linear(
            1.00,
            PlayerFormAnimationRuntime.BALL_CONTINUOUS_SQUASH_MIN,
            normalizedSpeed
        );
        let targetScaleY = PhaserMath.Linear(
            1.00,
            PlayerFormAnimationRuntime.BALL_CONTINUOUS_STRETCH_MAX,
            normalizedSpeed
        );
        if (lowSpeed) {
            targetScaleX = 1;
            targetScaleY = 1;
        }

        const boostSustainTarget = input.hooks.ballBoostGroundSustain ? 1 : 0;
        const deltaSec = Math.max(0, input.deltaMs) / 1000;
        const boostSustainAlpha = 1 - Math.exp(-deltaSec / 0.08);
        this.boostSustainBlend = PhaserMath.Linear(
            this.boostSustainBlend,
            boostSustainTarget,
            boostSustainAlpha
        );
        targetScaleX *= PhaserMath.Linear(1, 0.985, this.boostSustainBlend);
        targetScaleY *= PhaserMath.Linear(1, 1.03, this.boostSustainBlend);

        const smoothingTimeSec = lowSpeed
            ? PlayerFormAnimationRuntime.BALL_NEUTRAL_RETURN_SMOOTH_SEC
            : Math.max(0.0001, profile.airSmoothingTimeSec);
        const smoothingAlpha = 1 - Math.exp(-deltaSec / smoothingTimeSec);
        this.airScaleX = PhaserMath.Linear(this.airScaleX, targetScaleX, smoothingAlpha);
        this.airScaleY = PhaserMath.Linear(this.airScaleY, targetScaleY, smoothingAlpha);
    }

    private tickAirFollowWeight(deltaMs: number): void {
        if (this.airFollowWeight >= 1 || this.airFollowRecoverDurationMs <= 0) {
            this.airFollowWeight = 1;
            return;
        }

        this.airFollowWeight = PhaserMath.Clamp(
            this.airFollowWeight + (Math.max(0, deltaMs) / this.airFollowRecoverDurationMs),
            0,
            1
        );
    }

    private tickImpulseAxisTimer(deltaMs: number): void {
        this.impulseAxisMs = Math.max(0, this.impulseAxisMs - Math.max(0, deltaMs));
    }

    private resolveStretchAxis(
        form: PlayerFormId,
        velocityX: number,
        velocityY: number
    ): { x: number | null; y: number | null } {
        if (form === 'triangle') {
            return { x: null, y: null };
        }

        if (this.impulseAxisMs > 0) {
            return { x: this.impulseAxisX, y: this.impulseAxisY };
        }

        if (form === 'square') {
            return { x: null, y: null };
        }

        const speed = Math.hypot(velocityX, velocityY);
        if (speed < PlayerFormAnimationRuntime.BALL_SPEED_AXIS_FALLBACK_THRESHOLD) {
            return { x: null, y: null };
        }

        return {
            x: velocityX / speed,
            y: velocityY / speed
        };
    }

    private applyImpulseAxisFromHook(impulseX: number | null, impulseY: number | null, holdMs: number): void {
        if (impulseX === null || impulseY === null) {
            return;
        }

        const magnitude = Math.hypot(impulseX, impulseY);
        if (magnitude <= 0.0001) {
            return;
        }

        this.impulseAxisX = impulseX / magnitude;
        this.impulseAxisY = impulseY / magnitude;
        this.impulseAxisMs = Math.max(this.impulseAxisMs, Math.max(0, holdMs));
    }
}
