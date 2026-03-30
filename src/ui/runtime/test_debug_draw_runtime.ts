import type { Physics, Scene } from 'phaser';
import type { PlayerHazardHitShape } from '../../game/player/player_form_collision_shapes';
import type { PlayerDebugModel, PlayerSquareDebugZoneId } from '../../game/player/player_runtime_contracts';
import { resolveTriangleWorldPoints } from '../../game/player/geometry/player_geometry_queries';
import type { HazardObject } from '../../game/world/hazard';

interface CreateTestDebugDrawRuntimeParams {
    scene: Scene;
    player: PlayerDebugModel;
    getHazards: () => readonly HazardObject[];
}

export interface TestDebugDrawRuntime {
    render: () => void;
    setVisible: (visible: boolean) => void;
    reset: () => void;
    destroy: () => void;
}

export const createTestDebugDrawRuntime = (
    params: CreateTestDebugDrawRuntimeParams
): TestDebugDrawRuntime => {
    const { scene, player, getHazards } = params;
    const debugOverlay = scene.add.graphics().setDepth(6000);
    const squareZoneLabels = createSquareZoneLabels(scene);

    const drawHazardHitShape = (shape: PlayerHazardHitShape, color: number): void => {
        debugOverlay.lineStyle(2, color, 1);

        if (shape.kind === 'circle') {
            debugOverlay.strokeCircle(shape.centerX, shape.centerY, shape.radius);
            return;
        }

        if (shape.kind === 'box') {
            debugOverlay.strokeRect(
                shape.centerX - (shape.width * 0.5),
                shape.centerY - (shape.height * 0.5),
                shape.width,
                shape.height
            );
            return;
        }

        const points = shape.points;
        debugOverlay.beginPath();
        debugOverlay.moveTo(points[0].x, points[0].y);
        debugOverlay.lineTo(points[1].x, points[1].y);
        debugOverlay.lineTo(points[2].x, points[2].y);
        debugOverlay.closePath();
        debugOverlay.strokePath();
    };

    const drawBodyOutline = (body: Physics.Arcade.Body, color: number): void => {
        debugOverlay.lineStyle(2, color, 1);

        if (body.isCircle) {
            const radius = body.width * 0.5;
            debugOverlay.strokeCircle(body.x + radius, body.y + radius, radius);
            return;
        }

        debugOverlay.strokeRect(body.x, body.y, body.width, body.height);
    };

    const drawTriangleOutline = (
        points: ReadonlyArray<{ x: number; y: number }>,
        color: number,
        alpha: number = 1
    ): void => {
        debugOverlay.lineStyle(2, color, alpha);
        debugOverlay.beginPath();
        debugOverlay.moveTo(points[0].x, points[0].y);
        debugOverlay.lineTo(points[1].x, points[1].y);
        debugOverlay.lineTo(points[2].x, points[2].y);
        debugOverlay.closePath();
        debugOverlay.strokePath();
    };

    const drawSquareZoneOverlay = (): void => {
        const squareDebugView = player.squareDebugView;
        if (player.currentForm !== 'square' || squareDebugView === null) {
            setSquareZoneLabelsVisible(false);
            return;
        }

        const body = player.arcadeBodyObject.body as Physics.Arcade.Body;
        const centerX = body.x + (body.width * 0.5);
        const centerY = body.y + (body.height * 0.5);
        const halfWidth = body.width * 0.5;
        const halfHeight = body.height * 0.5;
        const quadrants = buildSquareQuadrants(centerX, centerY, halfWidth, halfHeight, squareDebugView.orientationRad);

        quadrants.forEach((quadrant) => {
            const fillStyle = resolveSquareZoneStyle(
                quadrant.id,
                squareDebugView.attachedZoneIds,
                squareDebugView.danglingZoneIds,
                squareDebugView.isAttached
            );
            debugOverlay.fillStyle(fillStyle.color, fillStyle.alpha);
            debugOverlay.beginPath();
            debugOverlay.moveTo(quadrant.points[0].x, quadrant.points[0].y);
            debugOverlay.lineTo(quadrant.points[1].x, quadrant.points[1].y);
            debugOverlay.lineTo(quadrant.points[2].x, quadrant.points[2].y);
            debugOverlay.lineTo(quadrant.points[3].x, quadrant.points[3].y);
            debugOverlay.closePath();
            debugOverlay.fillPath();
            debugOverlay.lineStyle(1, fillStyle.outlineColor, 0.9);
            debugOverlay.strokePoints(quadrant.points, true, true);
        });

        debugOverlay.lineStyle(1, 0xffffff, 0.5);
        debugOverlay.beginPath();
        debugOverlay.moveTo(quadrants[0].splitLineA.x, quadrants[0].splitLineA.y);
        debugOverlay.lineTo(quadrants[0].splitLineB.x, quadrants[0].splitLineB.y);
        debugOverlay.moveTo(quadrants[1].splitLineA.x, quadrants[1].splitLineA.y);
        debugOverlay.lineTo(quadrants[1].splitLineB.x, quadrants[1].splitLineB.y);
        debugOverlay.strokePath();

        squareZoneLabels.TL.setPosition(quadrants[0].labelX, quadrants[0].labelY);
        squareZoneLabels.TR.setPosition(quadrants[1].labelX, quadrants[1].labelY);
        squareZoneLabels.BL.setPosition(quadrants[2].labelX, quadrants[2].labelY);
        squareZoneLabels.BR.setPosition(quadrants[3].labelX, quadrants[3].labelY);
        setSquareZoneLabelsVisible(true);

        if (squareDebugView.rolloverPivotWorld !== null) {
            debugOverlay.lineStyle(2, 0xffeb3b, 1);
            debugOverlay.strokeCircle(squareDebugView.rolloverPivotWorld.x, squareDebugView.rolloverPivotWorld.y, 5);
            debugOverlay.beginPath();
            debugOverlay.moveTo(squareDebugView.rolloverPivotWorld.x - 8, squareDebugView.rolloverPivotWorld.y);
            debugOverlay.lineTo(squareDebugView.rolloverPivotWorld.x + 8, squareDebugView.rolloverPivotWorld.y);
            debugOverlay.moveTo(squareDebugView.rolloverPivotWorld.x, squareDebugView.rolloverPivotWorld.y - 8);
            debugOverlay.lineTo(squareDebugView.rolloverPivotWorld.x, squareDebugView.rolloverPivotWorld.y + 8);
            debugOverlay.strokePath();
        }
    };

    return {
        render: (): void => {
            debugOverlay.clear();

            if (player.currentForm === 'triangle') {
                if (player.trianglePhysicsPoints !== null && player.trianglePhysicsPoints.length >= 3) {
                    drawTriangleOutline(player.trianglePhysicsPoints, 0x4fc3f7, 1);
                }
            } else {
                drawBodyOutline(player.arcadeBodyObject.body as Physics.Arcade.Body, 0x4fc3f7);
            }
            drawHazardHitShape(player.hazardHitShape, 0xffd54f);
            if (player.currentForm === 'triangle') {
                const visualTrianglePoints = resolveTriangleWorldPoints(
                    player.triangleVisualObject.x,
                    player.triangleVisualObject.y,
                    player.triangleVisualObject.rotation
                );
                drawTriangleOutline(visualTrianglePoints, 0x66bb6a, 1);
            }

            getHazards().forEach((hazard) => {
                const hazardBody = hazard.trigger.body as Physics.Arcade.StaticBody;
                debugOverlay.lineStyle(2, 0xef5350, 1);
                debugOverlay.strokeRect(hazardBody.x, hazardBody.y, hazardBody.width, hazardBody.height);
            });

            drawSquareZoneOverlay();
        },
        setVisible: (visible: boolean): void => {
            debugOverlay.setVisible(visible);
            setSquareZoneLabelsVisible(visible && player.currentForm === 'square');
        },
        reset: (): void => {
            debugOverlay.clear();
            setSquareZoneLabelsVisible(false);
        },
        destroy: (): void => {
            debugOverlay.destroy();
            Object.values(squareZoneLabels).forEach((label) => label.destroy());
        }
    };

    function setSquareZoneLabelsVisible(visible: boolean): void {
        Object.values(squareZoneLabels).forEach((label) => {
            label.setVisible(visible);
        });
    }
};

const createSquareZoneLabels = (scene: Scene) => {
    return {
        TL: createSquareZoneLabel(scene, 'TL'),
        TR: createSquareZoneLabel(scene, 'TR'),
        BL: createSquareZoneLabel(scene, 'BL'),
        BR: createSquareZoneLabel(scene, 'BR')
    };
};

const createSquareZoneLabel = (scene: Scene, text: string) => {
    return scene.add.text(0, 0, text, {
        fontSize: '11px',
        color: '#ffffff',
        stroke: '#111111',
        strokeThickness: 3
    }).setOrigin(0.5).setDepth(6001).setVisible(false);
};

const buildSquareQuadrants = (
    centerX: number,
    centerY: number,
    halfWidth: number,
    halfHeight: number,
    rotationRad: number
): Array<{
    id: PlayerSquareDebugZoneId;
    points: Array<{ x: number; y: number }>;
    labelX: number;
    labelY: number;
    splitLineA: { x: number; y: number };
    splitLineB: { x: number; y: number };
}> => {
    const transform = (localX: number, localY: number) => {
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);
        return {
            x: centerX + (localX * cos) - (localY * sin),
            y: centerY + (localX * sin) + (localY * cos)
        };
    };

    const topLeft = transform(-halfWidth, -halfHeight);
    const topRight = transform(halfWidth, -halfHeight);
    const bottomLeft = transform(-halfWidth, halfHeight);
    const bottomRight = transform(halfWidth, halfHeight);
    const topMid = transform(0, -halfHeight);
    const bottomMid = transform(0, halfHeight);
    const leftMid = transform(-halfWidth, 0);
    const rightMid = transform(halfWidth, 0);
    const center = transform(0, 0);

    return [
        {
            id: 'TL',
            points: [topLeft, topMid, center, leftMid],
            labelX: averagePointX([topLeft, topMid, center, leftMid]),
            labelY: averagePointY([topLeft, topMid, center, leftMid]),
            splitLineA: topMid,
            splitLineB: bottomMid
        },
        {
            id: 'TR',
            points: [topMid, topRight, rightMid, center],
            labelX: averagePointX([topMid, topRight, rightMid, center]),
            labelY: averagePointY([topMid, topRight, rightMid, center]),
            splitLineA: leftMid,
            splitLineB: rightMid
        },
        {
            id: 'BL',
            points: [leftMid, center, bottomMid, bottomLeft],
            labelX: averagePointX([leftMid, center, bottomMid, bottomLeft]),
            labelY: averagePointY([leftMid, center, bottomMid, bottomLeft]),
            splitLineA: topMid,
            splitLineB: bottomMid
        },
        {
            id: 'BR',
            points: [center, rightMid, bottomRight, bottomMid],
            labelX: averagePointX([center, rightMid, bottomRight, bottomMid]),
            labelY: averagePointY([center, rightMid, bottomRight, bottomMid]),
            splitLineA: leftMid,
            splitLineB: rightMid
        }
    ];
};

const resolveSquareZoneStyle = (
    zoneId: PlayerSquareDebugZoneId,
    attachedZoneIds: readonly PlayerSquareDebugZoneId[],
    danglingZoneIds: readonly PlayerSquareDebugZoneId[],
    isAttached: boolean
): { color: number; alpha: number; outlineColor: number } => {
    if (isAttached && attachedZoneIds.includes(zoneId)) {
        return { color: 0x66bb6a, alpha: 0.22, outlineColor: 0xa5d6a7 };
    }

    if (isAttached && danglingZoneIds.includes(zoneId)) {
        return { color: 0xef5350, alpha: 0.18, outlineColor: 0xff8a80 };
    }

    return { color: 0x4fc3f7, alpha: 0.08, outlineColor: 0x81d4fa };
};

const averagePointX = (points: ReadonlyArray<{ x: number }>): number => {
    return points.reduce((sum, point) => sum + point.x, 0) / points.length;
};

const averagePointY = (points: ReadonlyArray<{ y: number }>): number => {
    return points.reduce((sum, point) => sum + point.y, 0) / points.length;
};
