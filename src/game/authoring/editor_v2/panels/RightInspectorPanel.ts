import type { AuthoringEditorRuntimeSnapshot } from '../AuthoringEditorRuntimeBridge';
import type { AuthoringEditorState } from '../AuthoringEditorTypes';

export interface RightInspectorPanel {
  render(
    container: HTMLElement,
    state: AuthoringEditorState,
    snapshot: AuthoringEditorRuntimeSnapshot,
  ): void;
  destroy(): void;
}

export function createRightInspectorPanel(): RightInspectorPanel {
  return {
    render(
      container: HTMLElement,
      state: AuthoringEditorState,
      snapshot: AuthoringEditorRuntimeSnapshot,
    ): void {
      container.replaceChildren();

      const title = document.createElement('h3');
      title.textContent = 'Right Inspector';
      title.style.margin = '0 0 6px 0';
      title.style.fontSize = '14px';

      const description = document.createElement('p');
      description.textContent =
        'Empty state: runtime write/read tools are not implemented in this scaffold.';
      description.style.margin = '0 0 10px 0';

      const levelId = document.createElement('div');
      levelId.textContent = `Runtime Level: ${snapshot.levelId}`;
      levelId.style.fontSize = '12px';
      levelId.style.opacity = '0.95';

      const objectCount = document.createElement('div');
      objectCount.textContent = `Runtime Objects: ${snapshot.objects.length}`;
      objectCount.style.fontSize = '12px';
      objectCount.style.opacity = '0.95';
      objectCount.style.marginTop = '4px';

      const dirtyHint = document.createElement('div');
      dirtyHint.textContent = `Dirty Flag: ${state.dirty ? 'true' : 'false'}`;
      dirtyHint.style.fontSize = '12px';
      dirtyHint.style.opacity = '0.95';
      dirtyHint.style.marginTop = '4px';

      container.append(title, description, levelId, objectCount, dirtyHint);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
