import { Game } from 'phaser';
import { createGameConfig } from './boot/game_config';

document.addEventListener('DOMContentLoaded', () => {
    new Game(createGameConfig('game-container'));

});
