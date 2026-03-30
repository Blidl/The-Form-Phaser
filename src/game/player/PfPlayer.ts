import { GameObjects, Scene } from 'phaser';
import type { PlayerFormAnchor, PlayerHazardHitShape } from './geometry/player_geometry_types';
import type { PlayerFormId, PlayerShellState } from './player_types';
import { PfPlayerRuntime } from './player_runtime';

export class PfPlayer {
    private readonly runtime: PfPlayerRuntime;

    public constructor(scene: Scene, x: number, y: number) {
        this.runtime = new PfPlayerRuntime(scene, x, y);
    }

    public get state(): PlayerShellState {
        return this.runtime.state;
    }

    public get currentForm(): PlayerFormId {
        return this.runtime.currentForm;
    }

    public get squareTrailResourceCurrent(): number {
        return this.runtime.squareTrailResourceCurrent;
    }

    public get squareTrailResourceMax(): number {
        return this.runtime.squareTrailResourceMax;
    }

    public get squareTrailResourceRatio(): number {
        return this.runtime.squareTrailResourceRatio;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.runtime.arcadeBodyObject;
    }

    public get hazardHitShape(): PlayerHazardHitShape {
        return this.runtime.hazardHitShape;
    }

    public get formAnchor(): PlayerFormAnchor {
        return this.runtime.formAnchor;
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.runtime.triangleVisualObject;
    }

    public freezeForRespawn(): void {
        this.runtime.freezeForRespawn();
    }

    public respawnAt(x: number, y: number): void {
        this.runtime.respawnAt(x, y);
    }

    public tick(deltaMs: number, input: import('./player_input').PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        this.runtime.tick(deltaMs, input, externalHorizontalInfluenceX);
    }
}
