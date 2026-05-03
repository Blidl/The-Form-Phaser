import {
  AUTHORING_EDITOR_TABS,
  type AuthoringEditorState,
  type AuthoringEditorTab,
} from '../AuthoringEditorTypes';

export interface TopToolbarBindings {
  onTabSelected(tab: AuthoringEditorTab): void;
  onCloseRequested(): void;
}

export interface TopToolbar {
  render(container: HTMLElement, state: AuthoringEditorState): void;
  destroy(): void;
}

function createTabButton(
  tab: AuthoringEditorTab,
  state: AuthoringEditorState,
  bindings: TopToolbarBindings,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = tab;
  button.style.cursor = 'pointer';
  button.style.fontWeight = state.activeTab === tab ? '700' : '400';
  button.style.padding = '4px 8px';
  button.onclick = (): void => {
    bindings.onTabSelected(tab);
  };
  return button;
}

export function createTopToolbar(bindings: TopToolbarBindings): TopToolbar {
  return {
    render(container: HTMLElement, state: AuthoringEditorState): void {
      container.replaceChildren();

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.justifyContent = 'space-between';
      topRow.style.gap = '12px';

      const title = document.createElement('strong');
      title.textContent = 'Authoring Editor V2 (scaffold only)';

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Close';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = (): void => {
        bindings.onCloseRequested();
      };

      topRow.append(title, closeButton);

      const statusRow = document.createElement('div');
      statusRow.style.fontSize = '12px';
      statusRow.style.opacity = '0.92';
      statusRow.style.marginTop = '6px';
      statusRow.textContent = [
        `Mode: ${state.timeMode}`,
        `Grid: ${state.gridVisible ? 'visible' : 'hidden'}`,
        `Snap: ${state.snapEnabled ? 'on' : 'off'}`,
        `Grid Size: ${state.gridSize}`,
        `Dirty: ${state.dirty ? 'yes' : 'no'}`,
      ].join(' | ');

      const tabsRow = document.createElement('div');
      tabsRow.style.display = 'flex';
      tabsRow.style.flexWrap = 'wrap';
      tabsRow.style.gap = '6px';
      tabsRow.style.marginTop = '8px';
      AUTHORING_EDITOR_TABS.forEach((tab) => {
        tabsRow.appendChild(createTabButton(tab, state, bindings));
      });

      container.append(topRow, statusRow, tabsRow);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
