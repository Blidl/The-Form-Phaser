import type { AuthoringEditorState } from '../AuthoringEditorTypes';

export interface LeftInspectorPanel {
  render(container: HTMLElement, state: AuthoringEditorState): void;
  destroy(): void;
}

export function createLeftInspectorPanel(): LeftInspectorPanel {
  return {
    render(container: HTMLElement, state: AuthoringEditorState): void {
      container.replaceChildren();

      const title = document.createElement('h3');
      title.textContent = 'Left Inspector';
      title.style.margin = '0 0 6px 0';
      title.style.fontSize = '14px';

      const description = document.createElement('p');
      description.textContent =
        'Empty state: selection/object controls are not implemented in this scaffold.';
      description.style.margin = '0 0 10px 0';

      const selectedObject = document.createElement('div');
      selectedObject.textContent = `Selected Object: ${state.selectedObjectId ?? 'none'}`;
      selectedObject.style.fontSize = '12px';
      selectedObject.style.opacity = '0.95';

      container.append(title, description, selectedObject);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
