import type { BallConfig } from '../../../config/forms/ballConfig';
import type { PlayerInputFrame } from '../../player/input/playerInputTypes';
import type { PlayerTimerState } from '../../player/timers/playerTimerTypes';
import { applyBallBoost } from './applyBallBoost';
import { applyBallRebound } from './applyBallRebound';
import { canChainBallAbility } from './canChainBallAbility';

export interface BallAbilityUpdateContext {
    body: Physics.Arcade.Body;
    inputFrame: PlayerInputFrame;
    timerState: PlayerTimerState;
    ballConfig: BallConfig;
}

export function ballAbilityUpdate(context: BallAbilityUpdateContext): void {
    const { body, inputFrame, timerState, ballConfig } = context;

    const didRebound = applyBallRebound(
        body,
        ballConfig,
        timerState.reboundBufferMs
    );
    if (didRebound) {
        timerState.reboundBufferMs = 0;
        timerState.chainWindowMs = ballConfig.chainWindowMs;
        return;
    }

    const canBoostByCooldown = timerState.boostCooldownMs <= 0;
    const canBoostNow = canChainBallAbility({
        normalEligibility: canBoostByCooldown,
        chainWindowMs: timerState.chainWindowMs
    });
    const didBoost = applyBallBoost({
        body,
        inputFrame,
        ballConfig,
        boostCooldownMs: canBoostNow ? 0 : timerState.boostCooldownMs,
        reboundConsumedThisFrame: didRebound
    });
    if (didBoost) {
        timerState.boostCooldownMs = ballConfig.boostCooldownMs;
        timerState.reboundBufferMs = 0;
        timerState.chainWindowMs = ballConfig.chainWindowMs;
    }
}
