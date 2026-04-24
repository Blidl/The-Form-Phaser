import { GameObjects, Physics, Scene } from 'phaser';
import type { PlayerFormAnchor, PlayerHazardHitShape } from './geometry/player_geometry_types';
import type { PlayerSquareDebugView } from './player_runtime_contracts';
import type { PlayerFormId, PlayerShellState } from './player_types';
import type { PlayerDeathTransitionDebugSnapshot } from './view/player_death_transition';
import { PfPlayerRuntime } from './player_runtime';
import type {
    TestWorldActorContactMode,
    TestWorldActorContactShapeSnapshot,
    TestWorldActorWorldContactSnapshot
} from '../world/runtime/test_world_actor_contact_shapes';

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

    public get triangleFlightResourceCurrent(): number {
        return this.runtime.triangleFlightResourceCurrent;
    }

    public get triangleFlightResourceMax(): number {
        return this.runtime.triangleFlightResourceMax;
    }

    public get triangleFlightResourceRatio(): number {
        return this.runtime.triangleFlightResourceRatio;
    }

    public get arcadeBodyObject(): GameObjects.Arc {
        return this.runtime.arcadeBodyObject;
    }

    public get contactMode(): TestWorldActorContactMode {
        return this.runtime.contactMode;
    }

    public get contactShapeSnapshot(): TestWorldActorContactShapeSnapshot {
        return this.runtime.contactShapeSnapshot;
    }

    public get worldContactSnapshot(): TestWorldActorWorldContactSnapshot {
        return this.runtime.worldContactSnapshot;
    }

    public applyActorContactPush(deltaX: number, deltaY: number): { appliedDeltaX: number; appliedDeltaY: number } {
        return this.runtime.applyActorContactPush(deltaX, deltaY);
    }

    public get squareAttachJumpPullBody(): Physics.Arcade.Body | Physics.Arcade.StaticBody | null {
        return this.runtime.squareAttachJumpPullBody;
    }

    public get isCurrentlyGrounded(): boolean {
        return this.runtime.isCurrentlyGrounded;
    }

    public get isTriangleFlightActive(): boolean {
        return this.runtime.isTriangleFlightActive;
    }

    public get isTriangleBreakWallActive(): boolean {
        return this.runtime.isTriangleBreakWallActive;
    }

    public get hazardHitShape(): PlayerHazardHitShape {
        return this.runtime.hazardHitShape;
    }

    public startDeathTransition(
        impactX: number,
        impactY: number,
        impactNormalX: number,
        impactNormalY: number,
        durationMs: number
    ): void {
        this.runtime.startDeathTransition(impactX, impactY, impactNormalX, impactNormalY, durationMs);
    }

    public get formAnchor(): PlayerFormAnchor {
        return this.runtime.formAnchor;
    }

    public get triangleVisualObject(): GameObjects.Triangle {
        return this.runtime.triangleVisualObject;
    }

    public get trianglePhysicsPoints(): ReadonlyArray<{ x: number; y: number }> | null {
        return this.runtime.trianglePhysicsPoints;
    }

    public get squareDebugView(): PlayerSquareDebugView | null {
        return this.runtime.squareDebugView;
    }

    public get presentationDebugState(): {
        ball: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        triangle: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        square: { visible: boolean; scaleX: number; scaleY: number; rotationRad: number };
        velocityX: number;
        velocityY: number;
    } {
        return this.runtime.presentationDebugState;
    }

    public setDebugVisualsVisible(visible: boolean): void {
        this.runtime.setDebugVisualsVisible(visible);
    }

    public setDeathDebugOverlay(enabled: boolean, progressOverride: number | null): void {
        this.runtime.setDeathDebugOverlay(enabled, progressOverride);
    }

    public get deathDebugSnapshot(): PlayerDeathTransitionDebugSnapshot {
        return this.runtime.deathDebugSnapshot;
    }

    public refillTriangleFlightResource(): void {
        this.runtime.refillTriangleFlightResource();
    }

    public freezeForRespawn(): void {
        this.runtime.freezeForRespawn();
    }

    public respawnAt(x: number, y: number): void {
        this.runtime.respawnAt(x, y);
    }

    public refreshWorldGeometryState(): void {
        this.runtime.refreshWorldGeometryState();
    }

    public tick(deltaMs: number, input: import('./player_input').PlayerInputSnapshot, externalHorizontalInfluenceX: number = 0): void {
        this.runtime.tick(deltaMs, input, externalHorizontalInfluenceX);
    }

    public destroy(): void {
        this.runtime.destroy();
    }
}
