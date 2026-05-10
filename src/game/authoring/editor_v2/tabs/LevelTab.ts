import type { AuthoringEditorState, AuthoringEditorTabView } from '../AuthoringEditorTypes';
import {
  getCampaignLevelSummaries,
  getInitialCampaignLevelId,
  setInitialCampaignLevelId,
} from '../../../world/runtime/test_campaign_registry';

export function createLevelTab(): AuthoringEditorTabView {
  return {
    id: 'Level',
    render(container: HTMLElement, state: AuthoringEditorState): void {
      void state;
      container.replaceChildren();

      const title = document.createElement('h3');
      title.textContent = 'Level';
      title.style.margin = '0 0 6px 0';

      const description = document.createElement('p');
      description.textContent = 'Campaign settings';
      description.style.margin = '0';

      const levelSummaries = getCampaignLevelSummaries();
      const initialLevelId = getInitialCampaignLevelId();

      const initialLevelRow = document.createElement('label');
      initialLevelRow.style.display = 'grid';
      initialLevelRow.style.gap = '6px';
      initialLevelRow.style.marginTop = '12px';
      initialLevelRow.textContent = 'Initial Level';

      const select = document.createElement('select');
      select.style.padding = '6px';
      select.style.borderRadius = '6px';
      select.style.border = '1px solid rgba(148, 163, 184, 0.5)';
      select.style.background = 'rgba(15, 23, 42, 0.32)';
      select.style.color = '#e2e8f0';

      levelSummaries.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.id} - ${entry.displayName}`;
        option.selected = entry.id === initialLevelId;
        select.appendChild(option);
      });

      const applyButton = document.createElement('button');
      applyButton.type = 'button';
      applyButton.textContent = 'Set as Initial';
      applyButton.style.marginTop = '8px';
      applyButton.style.padding = '6px 10px';
      applyButton.style.borderRadius = '6px';
      applyButton.style.border = '1px solid rgba(148, 163, 184, 0.5)';
      applyButton.style.background = 'rgba(30, 41, 59, 0.9)';
      applyButton.style.color = '#e2e8f0';
      applyButton.style.cursor = 'pointer';

      const status = document.createElement('p');
      status.style.margin = '8px 0 0 0';
      status.style.fontSize = '12px';
      status.style.opacity = '0.9';
      status.textContent = `Current initial level: ${initialLevelId}`;

      applyButton.addEventListener('click', () => {
        const selectedLevelId = select.value.trim();
        if (!selectedLevelId) {
          return;
        }
        const changed = setInitialCampaignLevelId(selectedLevelId);
        status.textContent = changed
          ? `Initial level set to: ${selectedLevelId}`
          : `Failed to set initial level: ${selectedLevelId}`;
      });

      initialLevelRow.appendChild(select);
      container.append(title, description, initialLevelRow, applyButton, status);
    },
    destroy(): void {
      // No persistent objects yet.
    },
  };
}
