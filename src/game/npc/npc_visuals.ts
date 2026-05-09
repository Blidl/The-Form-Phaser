import type { Scene } from 'phaser';
import type {
    TestNpcArchetype,
    TestNpcPresentationAnimation,
    TestNpcPresentationEmotion,
    TestNpcState,
    TestNpcVisualConfig,
    TestNpcVisualShape
} from './npc_types';
import { resolveTestNpcManpuEmotion } from './npc_manpu';
import {
    PLAYER_MARKER_ACTIVE_ALPHA,
    PLAYER_MARKER_FILL_COLOR,
    PLAYER_MARKER_RADIUS,
    PLAYER_MARKER_STROKE_COLOR,
    PLAYER_MARKER_STROKE_WIDTH
} from '../player/player_constants';

export interface TestNpcVisualRuntime {
    rootObject: Phaser.GameObjects.Container;
    setPosition: (x: number, y: number) => void;
    setFacing: (facing: -1 | 1) => void;
    setState: (state: TestNpcState) => void;
    setPresentationStubState: (
        animationId: TestNpcPresentationAnimation | null,
        emotionId: TestNpcPresentationEmotion | null
    ) => void;
    destroy: () => void;
}

export const createTestNpcVisualRuntime = (
    scene: Scene,
    x: number,
    y: number,
    archetype: TestNpcArchetype,
    visual: TestNpcVisualConfig
): TestNpcVisualRuntime => {
    const resolvedShape = ((visual as TestNpcVisualConfig & { shape?: TestNpcVisualShape }).shape ?? 'rectangle');
    const resolvedStrokeWidth = (visual as TestNpcVisualConfig & { strokeWidth?: number }).strokeWidth ?? 2;
    const resolvedAlpha = (visual as TestNpcVisualConfig & { alpha?: number }).alpha ?? 0.95;
    const body = scene.add.graphics();
    const drawBody = (): void => {
        body.clear();
        body.fillStyle(visual.fillColor, resolvedAlpha);
        if (resolvedStrokeWidth > 0) {
            body.lineStyle(resolvedStrokeWidth, visual.strokeColor, Math.max(0.15, resolvedAlpha));
        }
        const halfW = visual.bodyWidth * 0.5;
        const halfH = visual.bodyHeight * 0.5;
        if (resolvedShape === 'circle' || resolvedShape === 'ball') {
            const radius = Math.max(6, Math.min(halfW, halfH));
            body.fillCircle(0, 0, radius);
            if (resolvedStrokeWidth > 0) {
                body.strokeCircle(0, 0, radius);
            }
            return;
        }
        if (resolvedShape === 'triangle') {
            body.fillTriangle(0, -halfH, halfW, halfH, -halfW, halfH);
            if (resolvedStrokeWidth > 0) {
                body.strokeTriangle(0, -halfH, halfW, halfH, -halfW, halfH);
            }
            return;
        }
        body.fillRect(-halfW, -halfH, visual.bodyWidth, visual.bodyHeight);
        if (resolvedStrokeWidth > 0) {
            body.strokeRect(-halfW, -halfH, visual.bodyWidth, visual.bodyHeight);
        }
    };
    drawBody();
    const marker = scene.add.circle(
        0,
        -visual.bodyHeight * 0.16,
        PLAYER_MARKER_RADIUS,
        PLAYER_MARKER_FILL_COLOR,
        PLAYER_MARKER_ACTIVE_ALPHA
    ).setStrokeStyle(PLAYER_MARKER_STROKE_WIDTH, PLAYER_MARKER_STROKE_COLOR, PLAYER_MARKER_ACTIVE_ALPHA);
    const label = scene.add.text(0, -(visual.bodyHeight * 0.5) - 14, visual.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: visual.textColor ?? '#ffffff'
    }).setOrigin(0.5);
    const manpuContainer = scene.add.container(0, 0).setVisible(false);
    const manpuGraphics = scene.add.graphics();
    manpuContainer.add(manpuGraphics);
    const container = scene.add.container(x, y, [body, marker, label, manpuContainer]).setDepth(archetype === 'enemy' ? 4248 : 4244);
    const scaleX = (visual as TestNpcVisualConfig & { scaleX?: number }).scaleX ?? 1;
    const scaleY = (visual as TestNpcVisualConfig & { scaleY?: number }).scaleY ?? 1;
    container.setScale(scaleX, scaleY);
    let presentationAnimation: TestNpcPresentationAnimation | null = null;
    let presentationEmotion: TestNpcPresentationEmotion | null = null;
    let facing: -1 | 1 = 1;
    let manpuTweens: Phaser.Tweens.Tween[] = [];

    const applyStateStyle = (state: TestNpcState): void => {
        if (state === 'chase') {
            body.clear();
            drawBody();
            marker.setFillStyle(0xffe082, 1);
            return;
        }

        if (state === 'alert') {
            body.clear();
            drawBody();
            marker.setFillStyle(0xfff59d, 0.95);
            return;
        }

        if (state === 'return_to_post') {
            body.clear();
            drawBody();
            marker.setFillStyle(0xffd89a, 0.9);
            return;
        }

        if (state === 'idle_patrol' || state === 'patrol') {
            body.clear();
            drawBody();
            marker.setFillStyle(visual.accentColor ?? visual.strokeColor, 0.92);
            return;
        }

        body.clear();
        drawBody();
        marker.setFillStyle(visual.accentColor ?? visual.strokeColor, 0.82);
    };

    const stopManpuTweens = (): void => {
        manpuTweens.forEach((tween) => tween.stop());
        manpuTweens = [];
        scene.tweens.killTweensOf(manpuContainer);
    };

    const setManpuVisible = (visible: boolean): void => {
        if (!visible) {
            stopManpuTweens();
            manpuGraphics.clear();
        }
        manpuContainer.setVisible(visible);
    };

    const applyManpuPlacement = (): void => {
        manpuContainer.setPosition(facing * 7, -(visual.bodyHeight * 0.72));
    };

    const drawSweatDropManpu = (): void => {
        // Keep the shape primitive-only and avoid curve APIs that can fail on some Phaser builds.
        manpuGraphics.fillStyle(0x96d6ff, 1);
        manpuGraphics.lineStyle(2, 0x1f4d6f, 0.95);
        manpuGraphics.fillTriangle(0, -9, 6, 0, -6, 0);
        manpuGraphics.strokeTriangle(0, -9, 6, 0, -6, 0);
        manpuGraphics.fillEllipse(0, 3, 10, 12);
        manpuGraphics.strokeEllipse(0, 3, 10, 12);
    };

    const drawAngerManpu = (): void => {
        manpuGraphics.lineStyle(2.5, 0xb71c1c, 1);
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(-8, -6, -2, -10));
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(-2, -10, 2, -4));
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(2, -4, 8, -8));
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(0, -2, -2, 3));
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(0, -2, 2, 3));
        manpuGraphics.strokeLineShape(new Phaser.Geom.Line(-2, 3, 2, 3));
    };

    const drawSparklesManpu = (): void => {
        const drawStar = (xPos: number, yPos: number, size: number): void => {
            manpuGraphics.lineStyle(2, 0xfff4a5, 1);
            manpuGraphics.strokeLineShape(new Phaser.Geom.Line(xPos - size, yPos, xPos + size, yPos));
            manpuGraphics.strokeLineShape(new Phaser.Geom.Line(xPos, yPos - size, xPos, yPos + size));
        };
        drawStar(-5, -6, 4);
        drawStar(5, -2, 3);
        drawStar(0, 4, 2);

        stopManpuTweens();
        manpuTweens = [
            scene.tweens.add({
                targets: manpuContainer,
                alpha: { from: 0.65, to: 1 },
                duration: 280,
                yoyo: true,
                repeat: -1
            })
        ];
    };

    const applyManpuStyle = (): void => {
        applyManpuPlacement();
        const resolvedManpu = resolveTestNpcManpuEmotion(presentationEmotion);
        if (resolvedManpu.shouldHide) {
            setManpuVisible(false);
            return;
        }
        if (!resolvedManpu.canonicalEmotionId) {
            setManpuVisible(false);
            return;
        }

        setManpuVisible(true);
        manpuContainer.alpha = 1;
        stopManpuTweens();
        manpuGraphics.clear();
        try {
            if (resolvedManpu.canonicalEmotionId === 'sweat_drop') {
                drawSweatDropManpu();
                return;
            }
            if (resolvedManpu.canonicalEmotionId === 'anger') {
                drawAngerManpu();
                return;
            }
            drawSparklesManpu();
        } catch {
            // Fail-safe: never let visual issues break NPC runtime behavior.
            setManpuVisible(false);
        }
    };

    const applyPresentationStyle = (): void => {
        if (presentationAnimation === 'wave') {
            marker.setScale(1.15, 1);
        } else if (presentationAnimation === 'shake') {
            marker.setScale(0.9, 1);
        } else {
            marker.setScale(1);
        }
        applyManpuStyle();
    };

    applyStateStyle(archetype === 'enemy' ? 'patrol' : 'idle');
    applyPresentationStyle();

    return {
        rootObject: container,
        setPosition: (nextX, nextY): void => {
            container.setPosition(nextX, nextY);
        },
        setFacing: (nextFacing): void => {
            facing = nextFacing;
            marker.setX(nextFacing * 2);
            applyManpuPlacement();
        },
        setState: (state): void => {
            applyStateStyle(state);
            applyPresentationStyle();
        },
        setPresentationStubState: (animationId, emotionId): void => {
            presentationAnimation = animationId;
            presentationEmotion = emotionId;
            applyPresentationStyle();
        },
        destroy: (): void => {
            stopManpuTweens();
            scene.tweens.killTweensOf(manpuContainer);
            container.destroy(true);
        }
    };
};
