import type { Scene } from 'phaser';
import type { TestWorldSurfaceConfig } from './test_world_config';
import { resolveTestWorldVisualLayer } from './test_world_visual_order';

interface Interval {
    start: number;
    end: number;
}

export interface TestWorldSurfaceOutlineRenderer {
    refresh: () => void;
    destroy: () => void;
}

interface RuntimeSurfaceBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TestWorldSurfaceOutlineRendererOptions {
    resolveRuntimeBounds?: (surfaceId: string) => RuntimeSurfaceBounds | null;
}

const OUTLINE_THICKNESS_PX = 2;
const EDGE_EPSILON = 0.001;

const sortIntervals = (intervals: readonly Interval[]): Interval[] => {
    return [...intervals]
        .filter((interval) => interval.end - interval.start > EDGE_EPSILON)
        .sort((left, right) => left.start - right.start);
};

const subtractIntervals = (source: readonly Interval[], masks: readonly Interval[]): Interval[] => {
    if (source.length === 0 || masks.length === 0) {
        return [...source];
    }

    const normalizedMasks = sortIntervals(masks);
    const result: Interval[] = [];

    source.forEach((interval) => {
        let cursor = interval.start;
        normalizedMasks.forEach((mask) => {
            if (mask.end <= cursor || mask.start >= interval.end) {
                return;
            }
            if (mask.start > cursor) {
                result.push({
                    start: cursor,
                    end: Math.min(mask.start, interval.end)
                });
            }
            cursor = Math.max(cursor, mask.end);
        });

        if (cursor < interval.end) {
            result.push({
                start: cursor,
                end: interval.end
            });
        }
    });

    return result.filter((interval) => interval.end - interval.start > EDGE_EPSILON);
};

const isClose = (left: number, right: number): boolean => {
    return Math.abs(left - right) <= EDGE_EPSILON;
};

const createTestWorldSurfaceBounds = (
    surface: TestWorldSurfaceConfig,
    runtimeBounds: RuntimeSurfaceBounds | null = null
) => {
    const centerX = runtimeBounds?.x ?? surface.x;
    const centerY = runtimeBounds?.y ?? surface.y;
    const width = runtimeBounds?.width ?? surface.width;
    const height = runtimeBounds?.height ?? surface.height;
    const left = centerX - (width * 0.5);
    const right = centerX + (width * 0.5);
    const top = centerY - (height * 0.5);
    const bottom = centerY + (height * 0.5);
    return { left, right, top, bottom };
};

const isSolidSurface = (surface: TestWorldSurfaceConfig): boolean => {
    return (surface.collisionMode ?? 'solid') === 'solid';
};

export const createTestWorldSurfaceOutlineRenderer = (
    scene: Scene,
    surfaces: readonly TestWorldSurfaceConfig[],
    options?: TestWorldSurfaceOutlineRendererOptions
): TestWorldSurfaceOutlineRenderer => {
    const graphicsByGroup = new Map<string, Phaser.GameObjects.Graphics>([
        ['layer_1', scene.add.graphics().setDepth(3595)],
        ['layer_2', scene.add.graphics().setDepth(4045)],
        ['layer_3', scene.add.graphics().setDepth(4488)],
        ['layer_4', scene.add.graphics().setDepth(4695)],
        ['layer_5', scene.add.graphics().setDepth(4895)]
    ]);

    const refresh = (): void => {
        graphicsByGroup.forEach((graphics) => graphics.clear());
        if (surfaces.length === 0) {
            return;
        }

        const outlinedSurfaces = surfaces.map((surface) => ({
            surface,
            bounds: createTestWorldSurfaceBounds(
                surface,
                options?.resolveRuntimeBounds?.(surface.id) ?? null
            )
        }));

        outlinedSurfaces.forEach(({ surface, bounds }) => {
            const layer = resolveTestWorldVisualLayer('surface', surface);
            const graphics = graphicsByGroup.get(layer);
            if (!graphics) {
                return;
            }
            const leftMasks: Interval[] = [];
            const rightMasks: Interval[] = [];
            const topMasks: Interval[] = [];
            const bottomMasks: Interval[] = [];
            const allowSeamMasking = isSolidSurface(surface);

            outlinedSurfaces.forEach((candidate) => {
                if (candidate.surface.id === surface.id) {
                    return;
                }
                if (!allowSeamMasking || !isSolidSurface(candidate.surface)) {
                    return;
                }

                const overlapYStart = Math.max(bounds.top, candidate.bounds.top);
                const overlapYEnd = Math.min(bounds.bottom, candidate.bounds.bottom);
                const overlapXStart = Math.max(bounds.left, candidate.bounds.left);
                const overlapXEnd = Math.min(bounds.right, candidate.bounds.right);

                if (isClose(bounds.left, candidate.bounds.right) && overlapYEnd - overlapYStart > EDGE_EPSILON) {
                    leftMasks.push({ start: overlapYStart, end: overlapYEnd });
                }
                if (isClose(bounds.right, candidate.bounds.left) && overlapYEnd - overlapYStart > EDGE_EPSILON) {
                    rightMasks.push({ start: overlapYStart, end: overlapYEnd });
                }
                if (isClose(bounds.top, candidate.bounds.bottom) && overlapXEnd - overlapXStart > EDGE_EPSILON) {
                    topMasks.push({ start: overlapXStart, end: overlapXEnd });
                }
                if (isClose(bounds.bottom, candidate.bounds.top) && overlapXEnd - overlapXStart > EDGE_EPSILON) {
                    bottomMasks.push({ start: overlapXStart, end: overlapXEnd });
                }
            });

            const visibleLeft = subtractIntervals([{ start: bounds.top, end: bounds.bottom }], leftMasks);
            const visibleRight = subtractIntervals([{ start: bounds.top, end: bounds.bottom }], rightMasks);
            const visibleTop = subtractIntervals([{ start: bounds.left, end: bounds.right }], topMasks);
            const visibleBottom = subtractIntervals([{ start: bounds.left, end: bounds.right }], bottomMasks);

            graphics.fillStyle(surface.strokeColor, 1);
            visibleLeft.forEach((segment) => {
                graphics.fillRect(bounds.left, segment.start, OUTLINE_THICKNESS_PX, segment.end - segment.start);
            });
            visibleRight.forEach((segment) => {
                graphics.fillRect(bounds.right - OUTLINE_THICKNESS_PX, segment.start, OUTLINE_THICKNESS_PX, segment.end - segment.start);
            });
            visibleTop.forEach((segment) => {
                graphics.fillRect(segment.start, bounds.top, segment.end - segment.start, OUTLINE_THICKNESS_PX);
            });
            visibleBottom.forEach((segment) => {
                graphics.fillRect(segment.start, bounds.bottom - OUTLINE_THICKNESS_PX, segment.end - segment.start, OUTLINE_THICKNESS_PX);
            });
        });
    };

    refresh();

    return {
        refresh,
        destroy: () => {
            graphicsByGroup.forEach((graphics) => graphics.destroy());
        }
    };
};
