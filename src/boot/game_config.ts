import { AUTO, type Types } from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { EndScreenScene } from '../scenes/EndScreenScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { PauseMenuScene } from '../scenes/PauseMenuScene';
import { TestScene } from '../scenes/TestScene';

export const createGameConfig = (parent: string): Types.Core.GameConfig => {
    return {
        type: AUTO,
        width: 1024,
        height: 768,
        parent,
        backgroundColor: '#101820',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { x: 0, y: 0 },
                debug: false
            },
            matter: {
                gravity: { x: 0, y: 0 },
                debug: false
            }
        },
        scene: [BootScene, MainMenuScene, TestScene, PauseMenuScene, EndScreenScene]
    };
};
