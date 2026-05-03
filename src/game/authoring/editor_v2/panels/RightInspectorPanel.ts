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
      container.style.display = 'grid';
      container.style.gridTemplateRows = 'auto auto';
      container.style.gap = '10px';

      const runtimeSection = document.createElement('section');
      runtimeSection.style.display = 'grid';
      runtimeSection.style.gap = '6px';

      const title = document.createElement('h3');
      title.textContent = 'Runtime';
      title.style.margin = '0';
      title.style.fontSize = '14px';

      const description = document.createElement('p');
      description.textContent =
        'Runtime controls are placeholder-only in this shell.';
      description.style.margin = '0';
      description.style.fontSize = '12px';
      description.style.opacity = '0.9';

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

      runtimeSection.append(title, description, levelId, objectCount, dirtyHint);

      const validationSection = document.createElement('section');
      validationSection.style.borderTop = '1px solid rgba(148, 163, 184, 0.35)';
      validationSection.style.paddingTop = '10px';

      const validationTitle = document.createElement('h3');
      validationTitle.textContent = 'Validation & Properties';
      validationTitle.style.margin = '0 0 6px 0';
      validationTitle.style.fontSize = '14px';

      const validationText = document.createElement('p');
      validationText.textContent =
        'No validation results or property editors are available yet. This panel reserves that space.';
      validationText.style.margin = '0';
      validationText.style.fontSize = '12px';
      validationText.style.opacity = '0.9';

      validationSection.append(validationTitle, validationText);
      container.append(runtimeSection, validationSection);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
