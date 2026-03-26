import { GameObjects, Scene } from 'phaser';
import {
    PLAYER_PLACEHOLDER_FILL_COLOR,
    PLAYER_PLACEHOLDER_RADIUS,
    PLAYER_PLACEHOLDER_STROKE_COLOR,
    PLAYER_START_FORM
} from './player_constants';
import { EMPTY_PLAYER_INPUT_SNAPSHOT, type PlayerInputSnapshot } from './player_input';
import { createPlayerTimers, updatePlayerTimers, type PlayerTimers } from './player_timers';
import type { PlayerFormId, PlayerShellState } from './player_types';

export class PfPlayer extends GameObjects.Container {
    public readonly state: PlayerShellState;
    private readonly timers: PlayerTimers;
    private lastInput: PlayerInputSnapshot;
    private readonly formLabel: GameObjects.Text;

    public constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y);

        this.name = 'pf_player';
        this.state = { currentForm: PLAYER_START_FORM };
        this.timers = createPlayerTimers();
        this.lastInput = EMPTY_PLAYER_INPUT_SNAPSHOT;

        const body = scene.add.circle(0, 0, PLAYER_PLACEHOLDER_RADIUS, PLAYER_PLACEHOLDER_FILL_COLOR);
        body.setStrokeStyle(2, PLAYER_PLACEHOLDER_STROKE_COLOR);

        this.formLabel = scene.add.text(0, PLAYER_PLACEHOLDER_RADIUS + 10, this.state.currentForm, {
            color: '#ffffff',
            fontFamily: 'monospace',
            fontSize: '12px'
        });
        this.formLabel.setOrigin(0.5, 0);

        this.add([body, this.formLabel]);
        this.setSize(PLAYER_PLACEHOLDER_RADIUS * 2, PLAYER_PLACEHOLDER_RADIUS * 2);

        scene.add.existing(this);
    }

    public get currentForm(): PlayerFormId {
        return this.state.currentForm;
    }

    public tick(deltaMs: number, input: PlayerInputSnapshot): void {
        updatePlayerTimers(this.timers, deltaMs);
        this.lastInput = input;

        const activeInputs = this.buildActiveInputsLabel(this.lastInput);
        this.formLabel.setText(`${this.state.currentForm} ${activeInputs}`);
    }

    private buildActiveInputsLabel(input: PlayerInputSnapshot): string {
        const tags: string[] = [];

        if (input.moveLeft) tags.push('L');
        if (input.moveRight) tags.push('R');
        if (input.moveUp) tags.push('U');
        if (input.moveDown) tags.push('D');
        if (input.jumpPressed) tags.push('J');
        if (input.nextFormPressed) tags.push('E');
        if (input.prevFormPressed) tags.push('Q');
        if (input.actionPressed) tags.push('K');

        return tags.length > 0 ? `[${tags.join(',')}]` : '[idle]';
    }
}
