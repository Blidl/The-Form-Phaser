import type { GameObjects, Physics } from 'phaser';
import type { PlayerFormId } from '../../../shared/types/formTypes';
import { getFormProfile } from '../../../config/forms/formProfileConfig';

export interface ApplyPlayerFormProfileParams {
    gameObject: GameObjects.Rectangle;
    body: Physics.Arcade.Body;
    formId: PlayerFormId;
}

export function applyPlayerFormProfile(params: ApplyPlayerFormProfileParams): void {
    const profile = getFormProfile(params.formId);

    params.gameObject.setFillStyle(profile.displayColor, 1);
    params.gameObject.setSize(profile.bodyWidth, profile.bodyHeight);
    params.body.setSize(profile.bodyWidth, profile.bodyHeight, true);
}
