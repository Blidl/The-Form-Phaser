import Phaser from 'phaser';
import {
    createOverlayReplayPlayer,
    type OverlayReplayPlaybackFrame,
    type OverlayReplayPlaybackStatus,
    type OverlayReplayPlayer
} from '../../game/director/replay/overlay_replay_player';
import type {
    OverlayReplayActorTrack,
    OverlayReplayAsset
} from '../../game/director/replay/overlay_replay_types';

export const CINEMATIC_OVERLAY_SCENE_KEY = 'CinematicOverlayScene';

export interface CinematicOverlayUnderlayController {
    readonly pause?: () => void;
    readonly resume?: () => void;
}

export interface CinematicOverlaySceneData {
    readonly asset: OverlayReplayAsset;
    readonly underlayController?: CinematicOverlayUnderlayController;
    readonly pauseUnderlay?: boolean;
    readonly darkenUnderlay?: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly scale?: number;
    readonly backgroundAlpha?: number;
    readonly borderAlpha?: number;
    readonly onComplete?: () => void;
}

interface ActorRenderObject {
    readonly container: Phaser.GameObjects.Container;
    readonly shape: Phaser.GameObjects.Graphics;
    readonly label: Phaser.GameObjects.Text;
    touched: boolean;
}

interface PlatformRenderObject {
    readonly container: Phaser.GameObjects.Container;
    readonly shape: Phaser.GameObjects.Graphics;
    readonly label: Phaser.GameObjects.Text;
    touched: boolean;
}

interface VfxRenderObject {
    readonly text: Phaser.GameObjects.Text;
    touched: boolean;
}

interface ScreenRenderObject {
    readonly container: Phaser.GameObjects.Container;
    readonly label: Phaser.GameObjects.Text;
    readonly overlay?: Phaser.GameObjects.Rectangle;
    touched: boolean;
}

interface NormalizedSceneData {
    readonly asset: OverlayReplayAsset | null;
    readonly underlayController?: CinematicOverlayUnderlayController;
    readonly pauseUnderlay: boolean;
    readonly darkenUnderlay: boolean;
    readonly x?: number;
    readonly y?: number;
    readonly scale?: number;
    readonly backgroundAlpha: number;
    readonly borderAlpha: number;
    readonly onComplete?: () => void;
}

const DEFAULT_BACKGROUND_ALPHA = 0.65;
const DEFAULT_BORDER_ALPHA = 0.9;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isValidActorTrackList = (value: unknown): value is readonly OverlayReplayActorTrack[] => Array.isArray(value);

const isValidOverlayReplayAsset = (value: unknown): value is OverlayReplayAsset => {
    if (!isRecord(value)) {
        return false;
    }

    if (!isRecord(value.viewport)) {
        return false;
    }

    if (!isFiniteNumber(value.viewport.width) || value.viewport.width <= 0) {
        return false;
    }

    if (!isFiniteNumber(value.viewport.height) || value.viewport.height <= 0) {
        return false;
    }

    if (!isRecord(value.cameraTrack) || !Array.isArray(value.cameraTrack.frames)) {
        return false;
    }

    if (!isFiniteNumber(value.durationMs) || value.durationMs < 0) {
        return false;
    }

    if (!isFiniteNumber(value.fps) || value.fps <= 0) {
        return false;
    }

    if (!isValidActorTrackList(value.actorTracks)) {
        return false;
    }

    if (!Array.isArray(value.platformTracks) || !Array.isArray(value.vfxTracks) || !Array.isArray(value.screenTracks)) {
        return false;
    }

    return true;
};

const clampAlpha = (value: number | undefined, fallback: number): number => {
    if (!isFiniteNumber(value)) {
        return fallback;
    }
    return Phaser.Math.Clamp(value, 0, 1);
};

const normalizeSceneData = (data: unknown): NormalizedSceneData => {
    const input = isRecord(data) ? data : {};
    const rawAsset = input.asset;

    return {
        asset: isValidOverlayReplayAsset(rawAsset) ? rawAsset : null,
        underlayController: input.underlayController as CinematicOverlayUnderlayController | undefined,
        pauseUnderlay: input.pauseUnderlay !== false,
        darkenUnderlay: input.darkenUnderlay !== false,
        x: isFiniteNumber(input.x) ? input.x : undefined,
        y: isFiniteNumber(input.y) ? input.y : undefined,
        scale: isFiniteNumber(input.scale) && input.scale > 0 ? input.scale : undefined,
        backgroundAlpha: clampAlpha(input.backgroundAlpha as number | undefined, DEFAULT_BACKGROUND_ALPHA),
        borderAlpha: clampAlpha(input.borderAlpha as number | undefined, DEFAULT_BORDER_ALPHA),
        onComplete: typeof input.onComplete === 'function' ? (input.onComplete as () => void) : undefined
    };
};

const toDisplayString = (id: string, fallbackPrefix: string): string => {
    if (id.trim().length > 0) {
        return id;
    }
    return fallbackPrefix;
};

const getColorFromId = (id: string, base: number): number => {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
    }

    const mixed = hash ^ base;
    const r = 80 + (mixed & 0x6f);
    const g = 80 + ((mixed >>> 8) & 0x6f);
    const b = 80 + ((mixed >>> 16) & 0x6f);
    return (r << 16) | (g << 8) | b;
};

export class CinematicOverlayScene extends Phaser.Scene {
    private sceneData: NormalizedSceneData = normalizeSceneData(undefined);
    private replayAsset: OverlayReplayAsset | null = null;
    private player: OverlayReplayPlayer | null = null;
    private pipRoot: Phaser.GameObjects.Container | null = null;
    private pipBackground: Phaser.GameObjects.Rectangle | null = null;
    private pipBorder: Phaser.GameObjects.Rectangle | null = null;
    private underlayShade: Phaser.GameObjects.Rectangle | null = null;
    private actorObjects = new Map<string, ActorRenderObject>();
    private platformObjects = new Map<string, PlatformRenderObject>();
    private vfxObjects = new Map<string, VfxRenderObject>();
    private screenObjects = new Map<string, ScreenRenderObject>();
    private actorDisplayNames = new Map<string, string>();
    private pausedUnderlayApplied = false;
    private resumedUnderlay = false;
    private completed = false;
    private onCompleteCalled = false;
    private destroyed = false;
    private viewportWidth = 0;
    private viewportHeight = 0;

    public constructor() {
        super(CINEMATIC_OVERLAY_SCENE_KEY);
    }

    public init(data?: CinematicOverlaySceneData): void {
        this.sceneData = normalizeSceneData(data);
        this.replayAsset = this.sceneData.asset;
        this.player = null;
        this.pipRoot = null;
        this.pipBackground = null;
        this.pipBorder = null;
        this.underlayShade = null;
        this.actorObjects.clear();
        this.platformObjects.clear();
        this.vfxObjects.clear();
        this.screenObjects.clear();
        this.actorDisplayNames.clear();
        this.pausedUnderlayApplied = false;
        this.resumedUnderlay = false;
        this.completed = false;
        this.onCompleteCalled = false;
        this.destroyed = false;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
    }

    public create(): void {
        this.events.once('shutdown', this.onSceneShutdown, this);
        this.events.once('destroy', this.onSceneDestroy, this);

        if (this.replayAsset === null) {
            return;
        }

        this.viewportWidth = this.replayAsset.viewport.width;
        this.viewportHeight = this.replayAsset.viewport.height;
        this.buildActorLabelMap(this.replayAsset);

        this.setupUnderlayShade();
        this.setupPauseUnderlay();
        this.setupPipRoot();
        const beginStatus = this.setupPlayer(this.replayAsset);

        if (this.player !== null) {
            this.renderPlaybackFrame(this.player.getFrame());
        }
        if (beginStatus === 'completed') {
            this.handleCompleted();
        }
    }

    public update(_time: number, delta: number): void {
        if (this.destroyed || this.player === null || this.completed) {
            return;
        }

        const status = this.player.update(delta);
        this.renderPlaybackFrame(this.player.getFrame());

        if (status === 'completed') {
            this.handleCompleted();
        }
    }

    private setupPlayer(asset: OverlayReplayAsset): OverlayReplayPlaybackStatus {
        this.player = createOverlayReplayPlayer(asset);
        return this.player.begin();
    }

    private setupUnderlayShade(): void {
        if (!this.sceneData.darkenUnderlay) {
            return;
        }

        const camera = this.cameras.main;
        this.underlayShade = this.add
            .rectangle(0, 0, camera.width, camera.height, 0x000000, 0.5)
            .setOrigin(0, 0);
    }

    private setupPauseUnderlay(): void {
        if (!this.sceneData.pauseUnderlay) {
            return;
        }

        this.sceneData.underlayController?.pause?.();
        this.pausedUnderlayApplied = true;
    }

    private setupPipRoot(): void {
        const camera = this.cameras.main;
        const safeScale = this.resolvePipScale(camera.width, camera.height);

        const pipX = this.sceneData.x ?? (camera.width - this.viewportWidth * safeScale) * 0.5;
        const pipY = this.sceneData.y ?? (camera.height - this.viewportHeight * safeScale) * 0.5;

        this.pipRoot = this.add.container(pipX, pipY);
        this.pipRoot.setScale(safeScale);

        this.pipBackground = this.add
            .rectangle(0, 0, this.viewportWidth, this.viewportHeight, 0x10141c, this.sceneData.backgroundAlpha)
            .setOrigin(0, 0);
        this.pipRoot.add(this.pipBackground);

        this.pipBorder = this.add
            .rectangle(0, 0, this.viewportWidth, this.viewportHeight, 0xffffff, 0)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0xffffff, this.sceneData.borderAlpha);
        this.pipRoot.add(this.pipBorder);
    }

    private resolvePipScale(cameraWidth: number, cameraHeight: number): number {
        if (isFiniteNumber(this.sceneData.scale) && this.sceneData.scale > 0) {
            return this.sceneData.scale;
        }

        if (this.viewportWidth <= 0 || this.viewportHeight <= 0) {
            return 1;
        }

        const widthScale = (cameraWidth * 0.45) / this.viewportWidth;
        const heightScale = (cameraHeight * 0.45) / this.viewportHeight;
        const candidate = Math.min(widthScale, heightScale);
        if (!Number.isFinite(candidate) || candidate <= 0) {
            return 1;
        }
        return Phaser.Math.Clamp(candidate, 0.2, 1);
    }

    private renderPlaybackFrame(frame: OverlayReplayPlaybackFrame): void {
        if (this.pipRoot === null || this.destroyed) {
            return;
        }

        this.markAllRenderObjectsStale();
        this.renderPlatformFrames(frame);
        this.renderActorFrames(frame);
        this.renderVfxFrames(frame);
        this.renderScreenFrames(frame);
        this.destroyStaleRenderObjects();
    }

    private markAllRenderObjectsStale(): void {
        this.actorObjects.forEach((entry) => {
            entry.touched = false;
        });
        this.platformObjects.forEach((entry) => {
            entry.touched = false;
        });
        this.vfxObjects.forEach((entry) => {
            entry.touched = false;
        });
        this.screenObjects.forEach((entry) => {
            entry.touched = false;
        });
    }

    private renderActorFrames(frame: OverlayReplayPlaybackFrame): void {
        frame.actors.forEach((actorFrame) => {
            if (actorFrame.visible === false) {
                return;
            }

            const render = this.getOrCreateActorObject(actorFrame.actorId);
            const local = this.toViewportLocalPosition(actorFrame.x, actorFrame.y, frame);
            render.container.setPosition(local.x, local.y);
            render.container.rotation = actorFrame.rotation ?? 0;

            let resolvedScaleX = actorFrame.scaleX ?? 1;
            const resolvedScaleY = actorFrame.scaleY ?? 1;
            if (actorFrame.facing === 'left') {
                resolvedScaleX = -Math.abs(resolvedScaleX);
            } else if (actorFrame.facing === 'right') {
                resolvedScaleX = Math.abs(resolvedScaleX);
            }

            render.container.setScale(resolvedScaleX, resolvedScaleY);
            render.container.setVisible(true);

            const detailParts: string[] = [];
            if (actorFrame.animationId !== undefined) {
                detailParts.push(`anim:${actorFrame.animationId}`);
            }
            if (actorFrame.formId !== undefined) {
                detailParts.push(`form:${actorFrame.formId}`);
            }
            if (actorFrame.manpuId !== undefined) {
                detailParts.push(`manpu:${actorFrame.manpuId}`);
            }
            if (actorFrame.focusMarker !== undefined) {
                detailParts.push(`focus:${actorFrame.focusMarker.kind}`);
            }
            if (actorFrame.facing !== undefined) {
                detailParts.push(`face:${actorFrame.facing}`);
            }

            const detailText = detailParts.length > 0 ? `\n${detailParts.join(' ')}` : '';
            render.label.setText(`${this.resolveActorDisplayName(actorFrame.actorId)}${detailText}`);
            render.touched = true;
        });
    }

    private renderPlatformFrames(frame: OverlayReplayPlaybackFrame): void {
        frame.platforms.forEach((platformFrame) => {
            if (platformFrame.visible === false) {
                return;
            }

            const render = this.getOrCreatePlatformObject(platformFrame.platformId);
            const local = this.toViewportLocalPosition(platformFrame.x, platformFrame.y, frame);
            render.container.setPosition(local.x, local.y);
            render.container.rotation = platformFrame.rotation ?? 0;
            render.container.setVisible(true);
            render.touched = true;
        });
    }

    private renderVfxFrames(frame: OverlayReplayPlaybackFrame): void {
        frame.vfx.forEach((vfxFrame) => {
            if (vfxFrame.visible === false) {
                return;
            }

            const render = this.getOrCreateVfxObject(vfxFrame.trackId);
            const local = this.toViewportLocalPosition(vfxFrame.x, vfxFrame.y, frame);
            render.text.setPosition(local.x, local.y);
            render.text.setText(`vfx:${vfxFrame.vfxId}`);
            render.text.setVisible(true);
            render.touched = true;
        });
    }

    private renderScreenFrames(frame: OverlayReplayPlaybackFrame): void {
        frame.screen.forEach((screenFrame, index) => {
            const render = this.getOrCreateScreenObject(screenFrame.trackId, index);
            const effectId = screenFrame.effectId.toLowerCase();
            const isFlash = effectId.includes('flash');
            const isFade = effectId.includes('fade');
            const alphaFromParams = this.getNumericParam(screenFrame.params, 'alpha');
            const overlayAlpha = alphaFromParams !== undefined ? Phaser.Math.Clamp(alphaFromParams, 0, 1) : 0.25;

            if (render.overlay !== undefined && (isFlash || isFade)) {
                render.overlay
                    .setFillStyle(isFlash ? 0xffffff : 0x000000, overlayAlpha)
                    .setVisible(true);
            } else if (render.overlay !== undefined) {
                render.overlay.setVisible(false);
            }

            render.label.setText(`screen:${screenFrame.effectId}`);
            render.container.setPosition(8, 8 + index * 16);
            render.container.setVisible(true);
            render.touched = true;
        });
    }

    private toViewportLocalPosition(
        worldX: number,
        worldY: number,
        frame: OverlayReplayPlaybackFrame
    ): Phaser.Types.Math.Vector2Like {
        const camera = frame.camera;
        if (camera !== null) {
            const zoom = camera.zoom ?? 1;
            return {
                x: (worldX - camera.x) * zoom + this.viewportWidth * 0.5,
                y: (worldY - camera.y) * zoom + this.viewportHeight * 0.5
            };
        }

        return { x: worldX, y: worldY };
    }

    private getOrCreateActorObject(actorId: string): ActorRenderObject {
        const existing = this.actorObjects.get(actorId);
        if (existing !== undefined) {
            return existing;
        }

        const color = getColorFromId(actorId, 0x3076ff);
        const container = this.add.container(0, 0);
        const shape = this.add.graphics();
        shape.fillStyle(color, 1);
        shape.fillCircle(0, 0, 8);
        shape.lineStyle(1.5, 0x101010, 1);
        shape.strokeCircle(0, 0, 8);

        const label = this.add.text(10, -8, this.resolveActorDisplayName(actorId), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffffff',
            align: 'left'
        });
        label.setOrigin(0, 0);

        container.add([shape, label]);
        this.pipRoot?.add(container);

        const created: ActorRenderObject = {
            container,
            shape,
            label,
            touched: true
        };
        this.actorObjects.set(actorId, created);
        return created;
    }

    private getOrCreatePlatformObject(platformId: string): PlatformRenderObject {
        const existing = this.platformObjects.get(platformId);
        if (existing !== undefined) {
            return existing;
        }

        const color = getColorFromId(platformId, 0x70c49a);
        const container = this.add.container(0, 0);
        const shape = this.add.graphics();
        shape.fillStyle(color, 0.9);
        shape.fillRect(-18, -4, 36, 8);
        shape.lineStyle(1.5, 0x101010, 1);
        shape.strokeRect(-18, -4, 36, 8);

        const label = this.add.text(-18, -18, `platform:${toDisplayString(platformId, 'platform')}`, {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#e8f7ff'
        });
        label.setOrigin(0, 0);

        container.add([shape, label]);
        this.pipRoot?.add(container);

        const created: PlatformRenderObject = {
            container,
            shape,
            label,
            touched: true
        };
        this.platformObjects.set(platformId, created);
        return created;
    }

    private getOrCreateVfxObject(trackId: string): VfxRenderObject {
        const existing = this.vfxObjects.get(trackId);
        if (existing !== undefined) {
            return existing;
        }

        const text = this.add.text(0, 0, `vfx:${trackId}`, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#fff59d'
        });
        text.setOrigin(0.5, 0.5);
        this.pipRoot?.add(text);

        const created: VfxRenderObject = { text, touched: true };
        this.vfxObjects.set(trackId, created);
        return created;
    }

    private getOrCreateScreenObject(trackId: string, index: number): ScreenRenderObject {
        const existing = this.screenObjects.get(trackId);
        if (existing !== undefined) {
            return existing;
        }

        const container = this.add.container(8, 8 + index * 16);
        const overlay = this.add
            .rectangle(0, 0, this.viewportWidth, this.viewportHeight, 0xffffff, 0.25)
            .setOrigin(0, 0)
            .setVisible(false);
        const label = this.add.text(0, 0, `screen:${trackId}`, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ffd7a9'
        });
        label.setOrigin(0, 0);

        container.add(overlay);
        container.add(label);
        this.pipRoot?.add(container);

        const created: ScreenRenderObject = {
            container,
            label,
            overlay,
            touched: true
        };
        this.screenObjects.set(trackId, created);
        return created;
    }

    private destroyStaleRenderObjects(): void {
        this.actorObjects.forEach((entry, actorId) => {
            if (entry.touched) {
                return;
            }
            entry.shape.destroy();
            entry.label.destroy();
            entry.container.destroy();
            this.actorObjects.delete(actorId);
        });

        this.platformObjects.forEach((entry, platformId) => {
            if (entry.touched) {
                return;
            }
            entry.shape.destroy();
            entry.label.destroy();
            entry.container.destroy();
            this.platformObjects.delete(platformId);
        });

        this.vfxObjects.forEach((entry, trackId) => {
            if (entry.touched) {
                return;
            }
            entry.text.destroy();
            this.vfxObjects.delete(trackId);
        });

        this.screenObjects.forEach((entry, trackId) => {
            if (entry.touched) {
                return;
            }
            entry.overlay?.destroy();
            entry.label.destroy();
            entry.container.destroy();
            this.screenObjects.delete(trackId);
        });
    }

    private resolveActorDisplayName(actorId: string): string {
        const displayName = this.actorDisplayNames.get(actorId);
        if (displayName !== undefined && displayName.trim().length > 0) {
            return displayName;
        }
        return `actor:${toDisplayString(actorId, 'actor')}`;
    }

    private buildActorLabelMap(asset: OverlayReplayAsset): void {
        this.actorDisplayNames.clear();
        asset.actorTracks.forEach((track) => {
            if (track.displayName !== undefined && track.displayName.trim().length > 0) {
                this.actorDisplayNames.set(track.actorId, track.displayName);
            }
        });
    }

    private getNumericParam(params: Readonly<Record<string, unknown>> | undefined, key: string): number | undefined {
        if (params === undefined) {
            return undefined;
        }
        const value = params[key];
        return isFiniteNumber(value) ? value : undefined;
    }

    private handleCompleted(): void {
        if (this.completed) {
            return;
        }
        this.completed = true;
        this.callOnCompleteOnce();
        this.resumeUnderlayOnce();
        this.scene.stop();
    }

    private callOnCompleteOnce(): void {
        if (this.onCompleteCalled) {
            return;
        }
        this.onCompleteCalled = true;
        this.sceneData.onComplete?.();
    }

    private resumeUnderlayOnce(): void {
        if (!this.pausedUnderlayApplied || this.resumedUnderlay) {
            return;
        }
        this.resumedUnderlay = true;
        this.sceneData.underlayController?.resume?.();
    }

    private onSceneShutdown(): void {
        this.cleanup(true);
    }

    private onSceneDestroy(): void {
        this.cleanup(true);
    }

    private cleanup(markDestroyed: boolean): void {
        if (markDestroyed) {
            this.destroyed = true;
        }

        this.player = null;
        this.resumeUnderlayOnce();

        this.actorObjects.forEach((entry) => {
            entry.shape.destroy();
            entry.label.destroy();
            entry.container.destroy();
        });
        this.actorObjects.clear();

        this.platformObjects.forEach((entry) => {
            entry.shape.destroy();
            entry.label.destroy();
            entry.container.destroy();
        });
        this.platformObjects.clear();

        this.vfxObjects.forEach((entry) => {
            entry.text.destroy();
        });
        this.vfxObjects.clear();

        this.screenObjects.forEach((entry) => {
            entry.overlay?.destroy();
            entry.label.destroy();
            entry.container.destroy();
        });
        this.screenObjects.clear();

        this.pipBorder?.destroy();
        this.pipBorder = null;
        this.pipBackground?.destroy();
        this.pipBackground = null;
        this.pipRoot?.destroy();
        this.pipRoot = null;

        this.underlayShade?.destroy();
        this.underlayShade = null;
    }
}
