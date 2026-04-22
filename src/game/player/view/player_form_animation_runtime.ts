import { Math as PhaserMath } from 'phaser';
import type { PlayerFormId } from '../player_types';
import { type PlayerFormAnimationPhasePulse, type PlayerFormAnimationProfile, resolvePlayerFormAnimationProfile } from './player_form_animation_profiles';
import { PlayerFormAnimationPhasePulseRuntime } from './player_form_animation_phase_pulse';
import type { PlayerPresentationFrameHooks } from './player_presentation_hooks';

interface PlayerFormAnimationRuntimeInput {
    currentForm: PlayerFormId;
    grounded: boolean;
    hooks: PlayerPresentationFrameHooks;
    verticalSpeed: number;
    deltaMs: number;
}

export interface PlayerFormAnimationPose {
    scaleX: number;
    scaleY: number;
}

export class PlayerFormAnimationRuntime {
    private static readonly IMPULSE_RECOVER_SCALE: PlayerFormAnimationPhasePulse = {
        scaleX: 1,
        scaleY: 1,
        durationMs: 110
    };

    private currentForm: PlayerFormId;
    private readonly phasePulse: PlayerFormAnimationPhasePulseRuntime;
    private airScaleX: number;
    private airScaleY: number;
    private airFollowWeight: number;
    private airFollowRecoverDurationMs: number;

    public constructor(initialForm: PlayerFormId) {
        this.currentForm = initialForm;
        this.phasePulse = new PlayerFormAnimationPhasePulseRuntime();
        this.airScaleX = 1;
        this.airScaleY = 1;
        this.airFollowWeight = 1;
        this.airFollowRecoverDurationMs = 0;
    }

    public resetPose(formId: PlayerFormId): void {
        this.currentForm = formId;
        this.phasePulse.reset();
        this.airScaleX = 1;
        this.airScaleY = 1;
        this.airFollowWeight = 1;
        this.airFollowRecoverDurationMs = 0;
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
        this.phasePulse.tick(input.deltaMs);
        this.tickAirScale(profile, this.currentForm, input.verticalSpeed, input.grounded, input.deltaMs);

        const blendedAirScaleX = PhaserMath.Linear(1, this.airScaleX, this.airFollowWeight);
        const blendedAirScaleY = PhaserMath.Linear(1, this.airScaleY, this.airFollowWeight);
        return {
            scaleX: this.phasePulse.currentScaleX * blendedAirScaleX,
            scaleY: this.phasePulse.currentScaleY * blendedAirScaleY
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
                this.phasePulse.trigger([profile.jumpCommit, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
            }
            if (hooks.squareAttachJumpCommit && profile.squareAttachJumpCommit !== undefined) {
                this.phasePulse.trigger([profile.squareAttachJumpCommit, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
            }
            if (hooks.landImpactSpeed !== null) {
                this.onLandImpact(hooks.landImpactSpeed, profile);
            }
            return;
        }

        if (hooks.jumpCommit) {
            this.phasePulse.trigger([profile.jumpCommit, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
        }
        if (hooks.apexEnter) {
            this.phasePulse.trigger([profile.apexEnter]);
        }
        if (hooks.ballReboundLaunch && profile.ballReboundLaunch !== undefined) {
            this.phasePulse.trigger([profile.ballReboundLaunch, PlayerFormAnimationRuntime.IMPULSE_RECOVER_SCALE]);
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

    private tickAirScale(
        profile: PlayerFormAnimationProfile,
        form: PlayerFormId,
        verticalSpeed: number,
        grounded: boolean,
        deltaMs: number
    ): void {
        const speed = grounded ? 0 : Math.abs(verticalSpeed);
        const speedForMax = Math.max(1, profile.airSpeedForMax);
        const normalizedAirSpeed = PhaserMath.Clamp(speed / speedForMax, 0, 1);
        const targetScaleX = form === 'ball'
            ? PhaserMath.Linear(1, 0.95, normalizedAirSpeed)
            : PhaserMath.Linear(1, profile.airScaleX, normalizedAirSpeed);
        const targetScaleY = form === 'ball'
            ? PhaserMath.Linear(1, 1.08, normalizedAirSpeed)
            : PhaserMath.Linear(1, profile.airScaleY, normalizedAirSpeed);
        const deltaSec = Math.max(0, deltaMs) / 1000;
        const smoothingTimeSec = Math.max(0.0001, profile.airSmoothingTimeSec);
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
}
