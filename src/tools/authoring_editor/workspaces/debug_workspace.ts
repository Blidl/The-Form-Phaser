import type { AuthoringEditorTab } from '../editor_state';
import type { AuthoringWorkspace } from './authoring_workspace';

function createPlaceholderWorkspace(
  id: AuthoringEditorTab,
  title: string,
  description: string,
): AuthoringWorkspace {
  return {
    id,
    title,
    render(container, state, _context): void {
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
