import { AUTO, type Types } from 'phaser';
import {
    GAME_BACKGROUND_COLOR,
    GAME_GRAVITY_Y,
    GAME_HEIGHT,
    GAME_PHYSICS_DEBUG,
    GAME_PIXEL_ART,
    GAME_WIDTH
} from '../config/game/gameConfigValues';
import { BootScene } from '../scenes/BootScene';
import { TestScene } from '../scenes/TestScene';

export const createGameConfig = (parent: string): Types.Core.GameConfig => ({
    type: AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: GAME_BACKGROUND_COLOR,
    pixelArt: GAME_PIXEL_ART,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: GAME_GRAVITY_Y },
            debug: GAME_PHYSICS_DEBUG
        }
    },
    scene: [BootScene, TestScene]
});
