import { GameObjects, Physics } from 'phaser';
import { PLAYER_CONFIG } from '../../config/player/playerConfig';
import { PLAYER_SWITCH_CONFIG } from '../../config/player/playerSwitchConfig';
import { BALL_CONFIG } from '../../config/forms/ballConfig';
import {
    applyBallAirMovement,
    applyBallBoost,
    applyBallGroundMovement,
    applyBallJump,
    applyBallRebound,
    applyBallWallAssist,
    canChainBallAbility
} from '../forms/ball';
import { PLAYER_FORM_IDS, type PlayerFormId } from '../../shared/types/formTypes';
import { getFormProfile } from '../../config/forms/formProfileConfig';
import {
    createPlayerRuntimeState,
    createPlayerSnapshotFromRuntimeState,
    setPlayerRuntimeRespawnPoint,
    type PlayerRuntimeState
} from './core/playerRuntimeState';
import { createPlayerInput } from './input/createPlayerInput';
import { readPlayerInputFrame } from './input/readPlayerInputFrame';
import {
    EMPTY_PLAYER_INPUT_FRAME,
    type PlayerInputFrame,
    type PlayerInputKeys
} from './input/playerInputTypes';
import { createPlayerMarker } from './marker/createPlayerMarker';
import {
    DEFAULT_PLAYER_MARKER_CONFIG,
    type PlayerMarkerConfig
} from './marker/playerMarkerTypes';
import type { PfPlayerCreateConfig, PlayerSnapshot } from './shared/playerTypes';
import { createPlayerTimerState } from './timers/createPlayerTimerState';
import { tickPlayerTimers } from './timers/tickPlayerTimers';
import type { PlayerTimerState } from './timers/playerTimerTypes';
import {
    applyPlayerFormProfile,
    canSwitchPlayerForm,
    getNextFormId,
    getPreviousFormId
} from './switching';

export class PfPlayer {
    private readonly runtimeState: PlayerRuntimeState;
    private timerState: PlayerTimerState;
    private readonly gameObject: GameObjects.Rectangle;
    private readonly markerGameObject: GameObjects.Arc;
    private readonly markerConfig: PlayerMarkerConfig;
    private readonly body: Physics.Arcade.Body;
    private readonly inputKeys: PlayerInputKeys;
    private inputFrame: PlayerInputFrame;

    public constructor(config: PfPlayerCreateConfig) {
        const { scene, spawnPoint } = config;

        this.runtimeState = createPlayerRuntimeState({
            currentFormId: PLAYER_CONFIG.spawnFormId,
            spawnX: spawnPoint.x,
            spawnY: spawnPoint.y
        });
        this.timerState = createPlayerTimerState();

        this.gameObject = scene.add.rectangle(
            spawnPoint.x,
            spawnPoint.y,
            getFormProfile(this.runtimeState.currentFormId).bodyWidth,
            getFormProfile(this.runtimeState.currentFormId).bodyHeight,
            getFormProfile(this.runtimeState.currentFormId).displayColor
        );
        this.gameObject.name = 'pf_player';
        this.markerConfig = DEFAULT_PLAYER_MARKER_CONFIG;
        this.markerGameObject = createPlayerMarker(
            scene,
            spawnPoint.x,
            spawnPoint.y,
            this.markerConfig
        );

        scene.physics.add.existing(this.gameObject);
        this.body = this.gameObject.body as Physics.Arcade.Body;
        this.body.setCollideWorldBounds(true);
        this.body.setBounce(0.1, 0);
        applyPlayerFormProfile({
            gameObject: this.gameObject,
            body: this.body,
            formId: this.runtimeState.currentFormId
        });

        this.inputKeys = createPlayerInput(scene);
        this.inputFrame = { ...EMPTY_PLAYER_INPUT_FRAME };
    }

    public update(deltaMs: number): void {
        tickPlayerTimers(this.timerState, deltaMs);
        this.inputFrame = readPlayerInputFrame(this.inputKeys);

        if (this.inputFrame.abilityPressed) {
            this.timerState.reboundBufferMs = BALL_CONFIG.reboundBufferMs;
        }

        if (this.inputFrame.resetPressed) {
            this.resetToSpawn();
        }

        if (canSwitchPlayerForm(this.timerState.transformLockMs)) {
            if (this.inputFrame.previousFormPressed) {
                this.setCurrentFormId(getPreviousFormId(this.runtimeState.currentFormId));
            } else if (this.inputFrame.nextFormPressed) {
                this.setCurrentFormId(getNextFormId(this.runtimeState.currentFormId));
            }
        }

        if (this.runtimeState.currentFormId === PLAYER_FORM_IDS.ball) {
            applyBallGroundMovement(this.body, this.inputFrame, BALL_CONFIG);
            applyBallAirMovement(this.body, this.inputFrame, BALL_CONFIG);
            applyBallJump(this.body, this.inputFrame, BALL_CONFIG);
            applyBallWallAssist(this.body, BALL_CONFIG);

            const didRebound = applyBallRebound(
                this.body,
                BALL_CONFIG,
                this.timerState.reboundBufferMs
            );
            if (didRebound) {
                this.timerState.reboundBufferMs = 0;
                this.timerState.chainWindowMs = BALL_CONFIG.chainWindowMs;
            } else {
                const canBoostByCooldown = this.timerState.boostCooldownMs <= 0;
                const canBoostNow = canChainBallAbility({
                    normalEligibility: canBoostByCooldown,
                    chainWindowMs: this.timerState.chainWindowMs
                });
                const didBoost = applyBallBoost({
                    body: this.body,
                    inputFrame: this.inputFrame,
                    ballConfig: BALL_CONFIG,
                    boostCooldownMs: canBoostNow ? 0 : this.timerState.boostCooldownMs,
                    reboundConsumedThisFrame: didRebound
                });
                if (didBoost) {
                    this.timerState.boostCooldownMs = BALL_CONFIG.boostCooldownMs;
                    this.timerState.reboundBufferMs = 0;
                    this.timerState.chainWindowMs = BALL_CONFIG.chainWindowMs;
                }
            }
        }

        this.updateMarkerPosition();
    }

    public getSnapshot(): PlayerSnapshot {
        return createPlayerSnapshotFromRuntimeState(
            this.runtimeState,
            this.gameObject.x,
            this.gameObject.y
        );
    }

    public setRespawnPoint(x: number, y: number): void {
        setPlayerRuntimeRespawnPoint(this.runtimeState, x, y);
    }

    public resetToSpawn(): void {
        const { spawnX, spawnY } = this.runtimeState;

        this.runtimeState.isAlive = true;
        this.timerState = createPlayerTimerState();
        this.body.reset(spawnX, spawnY);
    }

    public getGameObject(): GameObjects.Rectangle {
        return this.gameObject;
    }

    public getMarkerGameObject(): GameObjects.Arc {
        return this.markerGameObject;
    }

    public getBody(): Physics.Arcade.Body {
        return this.body;
    }

    public getCurrentFormId(): PlayerFormId {
        return this.runtimeState.currentFormId;
    }

    public getInputFrame(): PlayerInputFrame {
        return { ...this.inputFrame };
    }

    public getTimerState(): Readonly<PlayerTimerState> {
        return { ...this.timerState };
    }

    private updateMarkerPosition(): void {
        this.markerGameObject.setPosition(
            this.gameObject.x + this.markerConfig.offset.x,
            this.gameObject.y + this.markerConfig.offset.y
        );
    }

    private setCurrentFormId(nextFormId: PlayerFormId): void {
        if (nextFormId === this.runtimeState.currentFormId) {
            return;
        }

        this.runtimeState.currentFormId = nextFormId;
        this.timerState.transformLockMs = PLAYER_SWITCH_CONFIG.switchLockMs;
        applyPlayerFormProfile({
            gameObject: this.gameObject,
            body: this.body,
            formId: this.runtimeState.currentFormId
        });
    }
}
