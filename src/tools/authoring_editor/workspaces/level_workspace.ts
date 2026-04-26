import type { ValidationIssue } from '../../../game/authoring/validation/validation_types';
import type {
  AuthoringEditorLevelAssetSnapshot,
  AuthoringEditorObjectSummary,
  AuthoringEditorRuntimeBridge,
} from '../authoring_editor_runtime_bridge';
import {
  setLastRefreshAtMs,
  setSelectedLevelObjectId,
  setSelectedReferenceId,
  setValidationIssueCount,
} from '../editor_state';
import type { AuthoringWorkspace } from './authoring_workspace';

interface GroupedValidationIssues {
  readonly error: readonly ValidationIssue[];
  readonly warning: readonly ValidationIssue[];
  readonly info: readonly ValidationIssue[];
}

function createSectionTitle(text: string): HTMLHeadingElement {
  const title = document.createElement('h3');
  title.textContent = text;
  return title;
}

function createTextLine(text: string): HTMLParagraphElement {
  const line = document.createElement('p');
  line.textContent = text;
  line.style.margin = '4px 0';
  return line;
}

function groupValidationIssues(issues: readonly ValidationIssue[]): GroupedValidationIssues {
  const grouped: {
    error: ValidationIssue[];
    warning: ValidationIssue[];
    info: ValidationIssue[];
  } = {
    error: [],
    warning: [],
    info: [],
  };

  issues.forEach((issue) => {
    grouped[issue.severity].push(issue);
  });

  return grouped;
}

function formatWorldBounds(bridge: AuthoringEditorRuntimeBridge): string {
  const bounds = bridge.getWorldBounds();
  return `x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`;
}

function formatObjectLabel(objectSummary: AuthoringEditorObjectSummary): string {
  const parts = [objectSummary.id];
  if (objectSummary.type) {
    parts.push(`type=${objectSummary.type}`);
  }
  if (objectSummary.label) {
    parts.push(`label=${objectSummary.label}`);
  }

  if (typeof objectSummary.x === 'number' && typeof objectSummary.y === 'number') {
    parts.push(`x=${objectSummary.x}, y=${objectSummary.y}`);
  }

  if (
    typeof objectSummary.width === 'number' &&
    typeof objectSummary.height === 'number'
  ) {
    parts.push(`width=${objectSummary.width}, height=${objectSummary.height}`);
  }

  return parts.join(' | ');
}

export function createLevelWorkspace(): AuthoringWorkspace {
  let lastLevelAssetSnapshot: AuthoringEditorLevelAssetSnapshot | null = null;
  let lastEditorObjects: readonly AuthoringEditorObjectSummary[] = [];
  let hasEditorObjectSnapshot = false;
  let lastValidationIssues: readonly ValidationIssue[] = [];

  const ensureSnapshot = (bridge: AuthoringEditorRuntimeBridge): void => {
    if (!lastLevelAssetSnapshot) {
      lastLevelAssetSnapshot = bridge.buildLevelAsset();
    }

    if (!hasEditorObjectSnapshot) {
      lastEditorObjects = bridge.getEditorObjects();
      hasEditorObjectSnapshot = true;
    }
  };

  return {
    id: 'level',
    title: 'Level Workspace',
    render(container, state, context): void {
      container.innerHTML = '';

      const runtimeBridge = context.runtimeBridge;
      if (!runtimeBridge) {
        container.append(
          createSectionTitle('Level Workspace'),
          createTextLine('Runtime bridge is not available.'),
        );
        return;
      }

      ensureSnapshot(runtimeBridge);
      if (!lastLevelAssetSnapshot) {
        container.append(
          createSectionTitle('Level Workspace'),
          createTextLine('Unable to build level asset snapshot.'),
        );
        return;
      }

      const refreshFromRuntime = (): void => {
        lastLevelAssetSnapshot = runtimeBridge.buildLevelAsset();
        lastEditorObjects = runtimeBridge.getEditorObjects();
        hasEditorObjectSnapshot = true;

        context.setState(setLastRefreshAtMs(context.getState(), Date.now()));
      };

      const validateCurrentLevel = (): void => {
        const validationSnapshot = runtimeBridge.validateCurrentLevel();
        lastValidationIssues = validationSnapshot.issues;
        context.setState(
          setValidationIssueCount(context.getState(), validationSnapshot.issues.length),
        );
      };

      const focusSelectedObject = (): void => {
        const selectedId = context.getState().selectedLevelObjectId;
        if (!selectedId) {
          return;
        }

        runtimeBridge.focusObject(selectedId);
      };

      const rootTitle = document.createElement('h2');
      rootTitle.textContent = this.title;

      const buttonsRow = document.createElement('div');
      buttonsRow.style.display = 'flex';
      buttonsRow.style.gap = '8px';
      buttonsRow.style.marginBottom = '8px';

      const refreshButton = document.createElement('button');
      refreshButton.type = 'button';
      refreshButton.textContent = 'Refresh from runtime';
      refreshButton.onclick = refreshFromRuntime;

      const focusButton = document.createElement('button');
      focusButton.type = 'button';
      focusButton.textContent = 'Focus selected object';
      focusButton.disabled = !state.selectedLevelObjectId;
      focusButton.onclick = focusSelectedObject;

      const validateButton = document.createElement('button');
      validateButton.type = 'button';
      validateButton.textContent = 'Validate level';
      validateButton.onclick = validateCurrentLevel;

      buttonsRow.append(refreshButton, focusButton, validateButton);

      const headerSection = document.createElement('section');
      headerSection.append(
        createSectionTitle('Runtime Snapshot'),
        createTextLine(`Level id: ${runtimeBridge.getLevelId()}`),
        createTextLine(`World bounds: ${formatWorldBounds(runtimeBridge)}`),
        createTextLine(
          `Selected object id: ${state.selectedLevelObjectId ?? 'none'}`,
        ),
        createTextLine(
          `Last refresh: ${
            typeof state.lastRefreshAtMs === 'number'
              ? new Date(state.lastRefreshAtMs).toLocaleString()
              : 'not refreshed'
          }`,
        ),
      );

      const gridSection = document.createElement('section');
      const grid = lastLevelAssetSnapshot.levelAsset.grid;
      gridSection.append(
        createSectionTitle('LevelAsset v2'),
        createTextLine(
          `Grid: enabled=${grid.enabled}, sizePx=${grid.sizePx}, snap=${grid.snap}`,
        ),
        createTextLine(
          `Layers: ${lastLevelAssetSnapshot.levelAsset.layers.length}`,
        ),
        createTextLine(
          `Objects (LevelAsset): ${lastLevelAssetSnapshot.levelAsset.objects.length}`,
        ),
        createTextLine(`Objects (Runtime): ${lastEditorObjects.length}`),
      );

      const layersList = document.createElement('ul');
      lastLevelAssetSnapshot.levelAsset.layers.forEach((layer) => {
        const layerItem = document.createElement('li');
        layerItem.textContent = `${layer.id} | type=${layer.type} | visible=${layer.visible} | order=${layer.order}`;
        layersList.appendChild(layerItem);
      });
      gridSection.append(layersList);

      const objectsSection = document.createElement('section');
      objectsSection.append(createSectionTitle('Runtime Objects'));
      const objectList = document.createElement('ul');

      lastEditorObjects.forEach((objectSummary) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.style.display = 'block';
        button.style.width = '100%';
        button.style.textAlign = 'left';
        button.style.marginBottom = '4px';
        button.style.fontWeight =
          state.selectedLevelObjectId === objectSummary.id ? '700' : '400';
        button.textContent = formatObjectLabel(objectSummary);
        button.onclick = (): void => {
          const selectedState = setSelectedLevelObjectId(
            context.getState(),
            objectSummary.id,
          );
          context.setState(setSelectedReferenceId(selectedState, objectSummary.id));
        };

        item.appendChild(button);
        objectList.appendChild(item);
      });

      if (lastEditorObjects.length === 0) {
        objectsSection.append(createTextLine('No runtime objects found.'));
      } else {
        objectsSection.append(objectList);
      }

      const adapterIssuesSection = document.createElement('section');
      adapterIssuesSection.append(
        createSectionTitle('Adapter Issues'),
        createTextLine(
          `Count: ${lastLevelAssetSnapshot.adapterIssues.length}`,
        ),
      );

      if (lastLevelAssetSnapshot.adapterIssues.length > 0) {
        const adapterIssueList = document.createElement('ul');
        lastLevelAssetSnapshot.adapterIssues.forEach((issue) => {
          const item = document.createElement('li');
          item.textContent = `${issue.severity.toUpperCase()} ${issue.code}: ${issue.message}${
            issue.path ? ` (${issue.path})` : ''
          }`;
          adapterIssueList.appendChild(item);
        });
        adapterIssuesSection.append(adapterIssueList);
      }

      const groupedIssues = groupValidationIssues(lastValidationIssues);
      const validationSection = document.createElement('section');
      validationSection.append(
        createSectionTitle('Validation Issues'),
        createTextLine(`Total: ${state.validationIssueCount ?? 0}`),
        createTextLine(`Errors: ${groupedIssues.error.length}`),
        createTextLine(`Warnings: ${groupedIssues.warning.length}`),
        createTextLine(`Info: ${groupedIssues.info.length}`),
      );

      const severities: Array<keyof GroupedValidationIssues> = [
        'error',
        'warning',
        'info',
      ];

      severities.forEach((severity) => {
        const issues = groupedIssues[severity];
        const severityTitle = document.createElement('h4');
        severityTitle.textContent = `${severity.toUpperCase()} (${issues.length})`;
        validationSection.appendChild(severityTitle);

        if (issues.length === 0) {
          validationSection.append(createTextLine('None.'));
          return;
        }

        const list = document.createElement('ul');
        issues.forEach((issue) => {
          const item = document.createElement('li');
          item.textContent = `${issue.code}: ${issue.message}${
            issue.path ? ` (${issue.path})` : ''
          }`;
          list.appendChild(item);
        });
        validationSection.appendChild(list);
      });

      container.append(
        rootTitle,
        buttonsRow,
        headerSection,
        gridSection,
        objectsSection,
        adapterIssuesSection,
        validationSection,
      );
    },
    destroy(): void {
      // Workspace state is cached in closure and intentionally preserved.
    },
  };
}
