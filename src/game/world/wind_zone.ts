import { GameObjects, Physics, Scene } from 'phaser';

export interface WindZoneConfig {
    x: number;
    y: number;
    width: number;
    height: number;
    directionX: -1 | 1;
    force: number;
}

export interface WindZoneObject {
    trigger: GameObjects.Rectangle;
    force: number;
    directionX: -1 | 1;
}

export const createWindZone = (scene: Scene, config: WindZoneConfig): WindZoneObject => {
    const fillColor = 0x80deea;
    const strokeColor = 0x00838f;

    const trigger = scene.add.rectangle(config.x, config.y, config.width, config.height, fillColor, 0.25)
        .setStrokeStyle(2, strokeColor)
        .setDepth(4150);

    scene.physics.add.existing(trigger, true);
    const triggerBody = trigger.body as Physics.Arcade.StaticBody;
    triggerBody.checkCollision.none = false;
    triggerBody.checkCollision.up = false;
    triggerBody.checkCollision.down = false;
    triggerBody.checkCollision.left = false;
    triggerBody.checkCollision.right = false;

    const stripeSpacing = 30;
    const stripeWidth = 12;
    const stripeHeight = Math.max(26, config.height - 24);
    const startX = config.x - (config.width * 0.5) + 18;
    const endX = config.x + (config.width * 0.5) - 18;

    for (let stripeX = startX; stripeX <= endX; stripeX += stripeSpacing) {
        const stripe = scene.add.rectangle(stripeX, config.y, stripeWidth, stripeHeight, 0x4dd0e1, 0.28)
            .setDepth(4151);
        stripe.setAngle(config.directionX > 0 ? 18 : -18);
    }

    const arrowSymbol = config.directionX > 0 ? '>>' : '<<';
    scene.add.text(config.x, config.y - (config.height * 0.5) - 16, `WIND ${arrowSymbol}`, {
        color: '#b2ebf2',
        fontFamily: 'monospace',
        fontSize: '14px'
    })
        .setOrigin(0.5, 0.5)
        .setDepth(4152);

    return {
        trigger,
        force: config.force,
        directionX: config.directionX
    };
};
