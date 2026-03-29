import { Game } from 'phaser';
import { createGameConfig } from './boot/gameConfig';

const GAME_CONTAINER_ID = 'game-container';

const bootstrapGame = (): void => {
    void new Game(createGameConfig(GAME_CONTAINER_ID));
};

window.addEventListener('DOMContentLoaded', bootstrapGame);
