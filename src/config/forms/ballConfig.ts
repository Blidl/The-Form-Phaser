export interface BallConfig {
    readonly groundMoveSpeed: number;
    readonly groundIdleVelocityX: number;
    readonly airMoveSpeed: number;
    readonly airIdleVelocityXMode: 'preserve';
    readonly jumpVelocity: number;
    readonly reboundVelocityX: number;
    readonly reboundVelocityY: number;
    readonly reboundMinIncomingSpeed: number;
    readonly reboundBufferMs: number;
    readonly boostVelocityX: number;
    readonly boostVelocityY: number;
    readonly boostCooldownMs: number;
    readonly wallAssistVerticalClamp: number;
    readonly wallAssistHorizontalNudge: number;
    readonly chainWindowMs: number;
}

export const BALL_CONFIG: BallConfig = {
    groundMoveSpeed: 180,
    groundIdleVelocityX: 0,
    airMoveSpeed: 130,
    airIdleVelocityXMode: 'preserve',
    jumpVelocity: 620,
    reboundVelocityX: 420,
    reboundVelocityY: 520,
    reboundMinIncomingSpeed: 90,
    reboundBufferMs: 90,
    boostVelocityX: 340,
    boostVelocityY: 380,
    boostCooldownMs: 220,
    wallAssistVerticalClamp: 260,
    wallAssistHorizontalNudge: 16,
    chainWindowMs: 180
};
