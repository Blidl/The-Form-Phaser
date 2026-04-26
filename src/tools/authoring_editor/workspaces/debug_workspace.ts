import type { AuthoringEditorState, AuthoringEditorTab } from '../editor_state';

export interface AuthoringWorkspace {
  readonly id: AuthoringEditorTab;
  readonly title: string;
  render(container: HTMLElement, state: AuthoringEditorState): void;
  destroy(): void;
}

function createPlaceholderWorkspace(
  id: AuthoringEditorTab,
  title: string,
  description: string,
): AuthoringWorkspace {
  return {
    id,
    title,
    render(container: HTMLElement, state: AuthoringEditorState): void {
      container.innerHTML = '';

      const titleElement = document.createElement('h2');
      titleElement.textContent = title;

      const descriptionElement = document.createElement('p');
      descriptionElement.textContent = description;

      const stateElement = document.createElement('p');
      stateElement.textContent = `Active tab: ${state.activeTab}`;

      container.append(titleElement, descriptionElement, stateElement);
    },
    destroy(): void {
      // Placeholder workspace has no side effects.
    },
  };
}

export function createDebugWorkspace(): AuthoringWorkspace {
  return createPlaceholderWorkspace(
    'debug',
    'Debug Workspace',
    'Validation, diagnostics, and tooling placeholders will appear here.',
  );
}
