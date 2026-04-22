import { Math as PhaserMath } from 'phaser';
import type { PlayerFormAnimationPhasePulse } from './player_form_animation_profiles';

interface ActivePulseSequence {
    stages: readonly PlayerFormAnimationPhasePulse[];
    index: number;
    elapsedMs: number;
    startScaleX: number;
    startScaleY: number;
}

export class PlayerFormAnimationPhasePulseRuntime {
    private scaleX: number = 1;
    private scaleY: number = 1;
    private sequence: ActivePulseSequence | null = null;

    public reset(): void {
        this.scaleX = 1;
        this.scaleY = 1;
        this.sequence = null;
    }

    public trigger(stages: readonly PlayerFormAnimationPhasePulse[]): void {
        if (stages.length <= 0) {
            return;
        }

        this.sequence = {
            stages,
            index: 0,
            elapsedMs: 0,
            startScaleX: this.scaleX,
            startScaleY: this.scaleY
        };
    }

    public tick(deltaMs: number): void {
        if (this.sequence === null) {
            return;
        }

        let remainingMs = Math.max(0, deltaMs);
        while (this.sequence !== null && remainingMs >= 0) {
            const stage = this.sequence.stages[this.sequence.index];
            const durationMs = Math.max(0, stage.durationMs);
            if (durationMs <= 0) {
                this.scaleX = stage.scaleX;
                this.scaleY = stage.scaleY;
                if (!this.advanceStage()) {
                    return;
                }
                continue;
            }

            const timeLeftMs = durationMs - this.sequence.elapsedMs;
            const stepMs = Math.min(remainingMs, Math.max(0, timeLeftMs));
            this.sequence.elapsedMs += stepMs;
            remainingMs -= stepMs;

            const t = PhaserMath.Clamp(this.sequence.elapsedMs / durationMs, 0, 1);
            this.scaleX = PhaserMath.Linear(this.sequence.startScaleX, stage.scaleX, t);
            this.scaleY = PhaserMath.Linear(this.sequence.startScaleY, stage.scaleY, t);
            if (this.sequence.elapsedMs + 0.0001 < durationMs) {
                break;
            }

            if (!this.advanceStage()) {
                return;
            }
        }
    }

    public get currentScaleX(): number {
        return this.scaleX;
    }

    public get currentScaleY(): number {
        return this.scaleY;
    }

    private advanceStage(): boolean {
        if (this.sequence === null) {
            return false;
        }

        const stage = this.sequence.stages[this.sequence.index];
        this.scaleX = stage.scaleX;
        this.scaleY = stage.scaleY;
        this.sequence.index += 1;
        if (this.sequence.index >= this.sequence.stages.length) {
            this.sequence = null;
            return false;
        }

        this.sequence.elapsedMs = 0;
        this.sequence.startScaleX = this.scaleX;
        this.sequence.startScaleY = this.scaleY;
        return true;
    }
}
