import { GameObjects, Scene } from 'phaser';
import type { PlayerFormId } from '../shared/types/formTypes';
import { canSwitchPlayerForm, getPlayerFormCyclePreview } from '../game/player/switching';

export class PfUiRoot {
    private readonly formStatusText: GameObjects.Text;

    public constructor(scene: Scene) {
        this.formStatusText = scene.add.text(16, 52, '', {
            color: '#cbd5e1',
            fontFamily: 'monospace',
            fontSize: '12px'
        });
        this.formStatusText.setScrollFactor(0);
        this.formStatusText.setDepth(1000);
    }

    public updateFormStatus(currentFormId: PlayerFormId, transformLockMs: number): void {
        const preview = getPlayerFormCyclePreview(currentFormId);
        const lockActive = !canSwitchPlayerForm(transformLockMs);

        this.formStatusText.setText([
            `form: ${preview.current}`,
            `prev: ${preview.previous} | next: ${preview.next}`,
            `switch lock: ${lockActive ? 'active' : 'inactive'} (${Math.ceil(transformLockMs)}ms)`
        ]);
    }
}
