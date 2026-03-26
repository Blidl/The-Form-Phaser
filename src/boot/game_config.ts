import { AUTO, type Types } from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { TestScene } from '../scenes/TestScene';

export const createGameConfig = (parent: string): Types.Core.GameConfig => {
    return {
        type: AUTO,
        width: 1024,
        height: 768,
        parent,
        backgroundColor: '#101820',
        scene: [BootScene, TestScene]
    };
};
