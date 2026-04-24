export type TestNpcManpuEmotionId = 'sweat_drop' | 'anger' | 'sparkles';
export type TestNpcManpuEditorEmotionId = 'none' | TestNpcManpuEmotionId | 'calm';

export const TEST_NPC_MANPU_EMOTION_OPTIONS: ReadonlyArray<{
    value: TestNpcManpuEditorEmotionId;
    label: string;
}> = [
    { value: 'none', label: 'None' },
    { value: 'sweat_drop', label: 'Sweat Drop' },
    { value: 'anger', label: 'Anger' },
    { value: 'sparkles', label: 'Sparkles' },
    { value: 'calm', label: 'Calm / Hide' }
];

interface ResolveTestNpcManpuEmotionResult {
    canonicalEmotionId: TestNpcManpuEmotionId | null;
    shouldHide: boolean;
    wasKnownInput: boolean;
}

const MANPU_EMOTION_ALIASES: Record<string, TestNpcManpuEmotionId> = {
    sweat_drop: 'sweat_drop',
    anger: 'anger',
    sparkles: 'sparkles',
    manpu_sweat_drop: 'sweat_drop',
    manpu_anger: 'anger',
    manpu_sparkles: 'sparkles',
    alert: 'anger',
    curious: 'sparkles'
};

const MANPU_HIDE_IDS = new Set<string>([
    'calm',
    'none',
    'off'
]);

export const resolveTestNpcManpuEmotion = (
    emotionId: string | null | undefined
): ResolveTestNpcManpuEmotionResult => {
    if (typeof emotionId !== 'string') {
        return {
            canonicalEmotionId: null,
            shouldHide: true,
            wasKnownInput: true
        };
    }

    const normalized = emotionId.trim().toLowerCase();
    if (normalized.length <= 0) {
        return {
            canonicalEmotionId: null,
            shouldHide: true,
            wasKnownInput: true
        };
    }

    if (MANPU_HIDE_IDS.has(normalized)) {
        return {
            canonicalEmotionId: null,
            shouldHide: true,
            wasKnownInput: true
        };
    }

    const canonicalEmotionId = MANPU_EMOTION_ALIASES[normalized] ?? null;
    if (canonicalEmotionId) {
        return {
            canonicalEmotionId,
            shouldHide: false,
            wasKnownInput: true
        };
    }

    return {
        canonicalEmotionId: null,
        shouldHide: false,
        wasKnownInput: false
    };
};
