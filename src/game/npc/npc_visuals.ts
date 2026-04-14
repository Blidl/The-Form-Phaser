import type { Scene } from 'phaser';
import type {
    TestNpcArchetype,
    TestNpcPresentationAnimation,
    TestNpcPresentationEmotion,
    TestNpcState,
    TestNpcVisualConfig
} from './npc_types';

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
    const body = scene.add.rectangle(0, 0, visual.bodyWidth, visual.bodyHeight, visual.fillColor, 0.95)
        .setStrokeStyle(2, visual.strokeColor);
    const accent = scene.add.rectangle(0, -visual.bodyHeight * 0.16, visual.bodyWidth * 0.52, 8, visual.accentColor ?? visual.strokeColor, 0.9);
    const eye = scene.add.circle(0, -visual.bodyHeight * 0.12, 4, 0xffffff, 0.95);
    const label = scene.add.text(0, -(visual.bodyHeight * 0.5) - 14, visual.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: visual.textColor ?? '#ffffff'
    }).setOrigin(0.5);
    const container = scene.add.container(x, y, [body, accent, eye, label]).setDepth(archetype === 'enemy' ? 4248 : 4244);
    let presentationAnimation: TestNpcPresentationAnimation | null = null;
    let presentationEmotion: TestNpcPresentationEmotion | null = null;

    const applyStateStyle = (state: TestNpcState): void => {
        if (state === 'chase') {
            body.setFillStyle(0xff7868, 1);
            accent.setFillStyle(0xffe082, 1);
            eye.setFillStyle(0xffffff, 1);
            return;
        }

        if (state === 'alert') {
            body.setFillStyle(0xffc65c, 0.98);
            accent.setFillStyle(0xfff59d, 0.95);
            eye.setFillStyle(0xffffff, 0.95);
            return;
        }

        if (state === 'return_to_post') {
            body.setFillStyle(0xe59b65, 0.95);
            accent.setFillStyle(0xffd89a, 0.9);
            eye.setFillStyle(0xf8fff4, 0.9);
            return;
        }

        if (state === 'idle_patrol' || state === 'patrol') {
            body.setFillStyle(visual.fillColor, 0.95);
            accent.setFillStyle(visual.accentColor ?? visual.strokeColor, 0.92);
            eye.setFillStyle(0xffffff, 0.95);
            return;
        }

        body.setFillStyle(visual.fillColor, 0.82);
        accent.setFillStyle(visual.accentColor ?? visual.strokeColor, 0.82);
        eye.setFillStyle(0xf5f5f5, 0.88);
    };

    const applyPresentationStyle = (): void => {
        if (presentationEmotion === 'alert') {
            eye.setScale(1.2);
        } else if (presentationEmotion === 'calm') {
            eye.setScale(0.9);
        } else {
            eye.setScale(1);
        }

        if (presentationAnimation === 'wave') {
            accent.setScale(1.15, 1);
        } else if (presentationAnimation === 'shake') {
            accent.setScale(0.9, 1);
        } else {
            accent.setScale(1);
        }
    };

    applyStateStyle(archetype === 'enemy' ? 'patrol' : 'idle');
    applyPresentationStyle();

    return {
        rootObject: container,
        setPosition: (nextX, nextY): void => {
            container.setPosition(nextX, nextY);
        },
        setFacing: (facing): void => {
            eye.setX(facing * 4);
            accent.setX(facing * 2);
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
            container.destroy(true);
        }
    };
};
