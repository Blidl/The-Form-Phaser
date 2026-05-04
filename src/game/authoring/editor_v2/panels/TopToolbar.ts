import {
  AUTHORING_EDITOR_TABS,
  type AuthoringEditorGridSize,
  type AuthoringEditorState,
  type AuthoringEditorTab,
  type AuthoringEditorTimeMode,
} from '../AuthoringEditorTypes';

export interface TopToolbarBindings {
  onTabSelected(tab: AuthoringEditorTab): void;
  onTimeModeSelected(mode: AuthoringEditorTimeMode): void;
  onGridVisibleChanged(visible: boolean): void;
  onSnapEnabledChanged(enabled: boolean): void;
  onGridSizeSelected(size: AuthoringEditorGridSize): void;
  onSaveRequested(): void;
  onClearDraftRequested(): void;
  onExportJsonRequested(): void;
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
  button.style.fontWeight = state.activeTab === tab ? '700' : '600';
  button.style.padding = '3px 8px';
  button.style.fontSize = '12px';
  button.style.lineHeight = '1.1';
  button.style.border = state.activeTab === tab ? '1px solid #16a34a' : '1px solid rgba(148, 163, 184, 0.7)';
  button.style.borderRadius = '6px';
  button.style.background =
    state.activeTab === tab ? 'rgba(34, 197, 94, 0.35)' : 'rgba(15, 23, 42, 0.38)';
  button.style.color = state.activeTab === tab ? '#dcfce7' : '#f8fafc';
  button.style.pointerEvents = 'auto';
  button.onclick = (): void => {
    bindings.onTabSelected(tab);
  };
  return button;
}

function createToggleButton(
  label: string,
  active: boolean,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cursor = 'pointer';
  button.style.padding = '3px 8px';
  button.style.fontSize = '12px';
  button.style.lineHeight = '1.1';
  button.style.borderRadius = '6px';
  button.style.border = active ? '1px solid #16a34a' : '1px solid rgba(148, 163, 184, 0.6)';
  button.style.background = active ? 'rgba(34, 197, 94, 0.28)' : 'rgba(15, 23, 42, 0.38)';
  button.style.color = '#f8fafc';
  button.style.pointerEvents = 'auto';
  button.onclick = onClick;
  return button;
}

export function createTopToolbar(bindings: TopToolbarBindings): TopToolbar {
  return {
    render(container: HTMLElement, state: AuthoringEditorState): void {
      container.replaceChildren();
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'space-between';
      container.style.gap = '8px';
      container.style.height = '100%';

      const closeButton = createToggleButton('Close', false, (): void => {
        bindings.onCloseRequested();
      });
      closeButton.style.marginLeft = '2px';

      const launchAndControlRow = document.createElement('div');
      launchAndControlRow.style.display = 'flex';
      launchAndControlRow.style.alignItems = 'center';
      launchAndControlRow.style.gap = '6px';
      launchAndControlRow.style.overflowX = 'auto';
      launchAndControlRow.style.flex = '1';
      launchAndControlRow.style.minWidth = '0';

      AUTHORING_EDITOR_TABS.forEach((tab) => {
        launchAndControlRow.appendChild(createTabButton(tab, state, bindings));
      });

      const separator = document.createElement('span');
      separator.textContent = '|';
      separator.style.opacity = '0.45';
      separator.style.padding = '0 2px';
      launchAndControlRow.appendChild(separator);

      launchAndControlRow.appendChild(
        createToggleButton(`Live`, state.timeMode === 'Live', (): void => {
          bindings.onTimeModeSelected('Live');
        }),
      );
      launchAndControlRow.appendChild(
        createToggleButton(`Paused`, state.timeMode === 'Paused', (): void => {
          bindings.onTimeModeSelected('Paused');
        }),
      );
      launchAndControlRow.appendChild(
        createToggleButton(`Grid Visible`, state.gridVisible, (): void => {
          bindings.onGridVisibleChanged(!state.gridVisible);
        }),
      );
      launchAndControlRow.appendChild(
        createToggleButton(`Snap Enabled`, state.snapEnabled, (): void => {
          bindings.onSnapEnabledChanged(!state.snapEnabled);
        }),
      );
      ([8, 16, 32] as const).forEach((size) => {
        launchAndControlRow.appendChild(
          createToggleButton(`Grid ${size}`, state.gridSize === size, (): void => {
            bindings.onGridSizeSelected(size);
          }),
        );
      });

      const dirtyIndicator = document.createElement('span');
      dirtyIndicator.textContent = state.dirty ? 'Unsaved' : 'Saved';
      dirtyIndicator.style.fontSize = '12px';
      dirtyIndicator.style.padding = '2px 8px';
      dirtyIndicator.style.border = '1px solid rgba(148, 163, 184, 0.6)';
      dirtyIndicator.style.borderRadius = '6px';
      dirtyIndicator.style.opacity = state.dirty ? '1' : '0.85';
      dirtyIndicator.style.fontSize = '11px';
      launchAndControlRow.append(dirtyIndicator);

      launchAndControlRow.appendChild(
        createToggleButton('Save', false, (): void => {
          bindings.onSaveRequested();
        }),
      );
      launchAndControlRow.appendChild(
        createToggleButton('Clear Draft', false, (): void => {
          bindings.onClearDraftRequested();
        }),
      );
      launchAndControlRow.appendChild(
        createToggleButton('Export JSON', false, (): void => {
          bindings.onExportJsonRequested();
        }),
      );

      const saveStatus = document.createElement('span');
      const statusText = state.draftLoaded ? 'Draft loaded' : state.saveStatus;
      saveStatus.textContent = `Status: ${statusText}`;
      saveStatus.style.fontSize = '11px';
      saveStatus.style.padding = '2px 8px';
      saveStatus.style.border = '1px solid rgba(148, 163, 184, 0.6)';
      saveStatus.style.borderRadius = '6px';
      saveStatus.style.background = 'rgba(15, 23, 42, 0.38)';
      launchAndControlRow.append(saveStatus);

      if (state.saveStatusNote) {
        const note = document.createElement('span');
        note.textContent = state.saveStatusNote;
        note.style.fontSize = '11px';
        note.style.opacity = '0.9';
        launchAndControlRow.append(note);
      }

      container.append(launchAndControlRow, closeButton);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
