import type { AuthoringEditorState, AuthoringEditorTabView } from '../AuthoringEditorTypes';

export function createBackgroundTab(): AuthoringEditorTabView {
  return {
    id: 'Background',
    render(container: HTMLElement, state: AuthoringEditorState): void {
      void state;
      container.replaceChildren();

      const title = document.createElement('h3');
      title.textContent = 'Background Tab';
      title.style.margin = '0 0 6px 0';

      const description = document.createElement('p');
      description.textContent = 'Empty state: Background authoring tools are not implemented yet.';
      description.style.margin = '0';

      container.append(title, description);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
