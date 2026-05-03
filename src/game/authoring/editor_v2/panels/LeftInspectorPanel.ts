import type { AuthoringEditorState } from '../AuthoringEditorTypes';

export interface LeftInspectorPanel {
  render(container: HTMLElement, state: AuthoringEditorState): void;
  destroy(): void;
}

export function createLeftInspectorPanel(): LeftInspectorPanel {
  return {
    render(container: HTMLElement, state: AuthoringEditorState): void {
      container.replaceChildren();
      container.style.display = 'grid';
      container.style.gridTemplateRows = 'auto auto auto';
      container.style.gap = '8px';

      const title = document.createElement('h3');
      title.textContent = 'Selection';
      title.style.margin = '0 0 6px 0';
      title.style.fontSize = '14px';

      const description = document.createElement('p');
      description.textContent =
        'No object is selected. Selection and object editing tools are not implemented yet.';
      description.style.margin = '0';
      description.style.fontSize = '12px';
      description.style.opacity = '0.9';

      const selectedObject = document.createElement('div');
      selectedObject.textContent = `Selected object: ${state.selectedObjectId ?? 'none'}`;
      selectedObject.style.fontSize = '12px';
      selectedObject.style.opacity = '0.95';
      selectedObject.style.padding = '6px 8px';
      selectedObject.style.border = '1px solid rgba(148, 163, 184, 0.4)';
      selectedObject.style.borderRadius = '6px';

      container.append(title, description, selectedObject);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
