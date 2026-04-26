import type { AuthoringEditorRuntimeBridge } from './authoring_editor_runtime_bridge';
import type { AuthoringEditorStorage } from './editor_storage';
import { createAuthoringEditorStorage } from './editor_storage';
import {
  createInitialAuthoringEditorState,
  setAuthoringEditorStorageStatus,
  setAuthoringEditorTab,
  type AuthoringEditorState,
  type AuthoringEditorStorageStatus,
  type AuthoringEditorTab,
} from './editor_state';
import { createDebugWorkspace } from './workspaces/debug_workspace';
import { createDirectorWorkspace } from './workspaces/director_workspace';
import { createEventsWorkspace } from './workspaces/events_workspace';
import { createLevelWorkspace } from './workspaces/level_workspace';
import { createNpcWorkspace } from './workspaces/npc_workspace';
import type {
  AuthoringWorkspace,
  AuthoringWorkspaceRenderContext,
} from './workspaces/authoring_workspace';

export interface AuthoringEditorApp {
  mount(container: HTMLElement): void;
  unmount(): void;
  getState(): AuthoringEditorState;
  setActiveTab(tab: AuthoringEditorTab): void;
  markUnsavedChanges(unsaved: boolean): void;
  refreshStorageStatus(): void;
}

interface CreateAuthoringEditorAppOptions {
  readonly storage?: AuthoringEditorStorage;
  readonly initialState?: AuthoringEditorState;
  readonly runtimeBridge?: AuthoringEditorRuntimeBridge;
}

const TAB_LABELS: Record<AuthoringEditorTab, string> = {
  level: 'Level',
  npc: 'NPC',
  director: 'Director',
  events: 'Events',
  debug: 'Debug',
};

function createStorageMessage(status: AuthoringEditorStorageStatus): string {
  if (status.message) {
    return status.message;
  }

  if (status.localDraftActive && status.source === 'local_autosave_draft') {
    return 'Local autosave draft is active';
  }

  if (status.hasLocalDraft) {
    return 'Local autosave draft exists but is not active';
  }

  if (status.source === 'bundled_json') {
    return 'Bundled JSON is active';
  }

  return 'Storage state unavailable';
}

function createWorkspaceMap(): Record<AuthoringEditorTab, AuthoringWorkspace> {
  return {
    level: createLevelWorkspace(),
    npc: createNpcWorkspace(),
    director: createDirectorWorkspace(),
    events: createEventsWorkspace(),
    debug: createDebugWorkspace(),
  };
}

export function createAuthoringEditorApp(
  options?: CreateAuthoringEditorAppOptions,
): AuthoringEditorApp {
  const storage = options?.storage ?? createAuthoringEditorStorage();
  const workspaces = createWorkspaceMap();

  let state = options?.initialState ?? createInitialAuthoringEditorState();
  let hostContainer: HTMLElement | null = null;
  let rootElement: HTMLElement | null = null;
  let statusElement: HTMLElement | null = null;
  let workspaceContainer: HTMLElement | null = null;
  let activeWorkspace: AuthoringWorkspace | null = null;

  const renderStorageStatus = (): void => {
    if (!statusElement) {
      return;
    }

    const status = state.storageStatus;
    const lines: string[] = [
      `Source: ${status.source === 'bundled_json' ? 'bundled JSON' : 'local autosave draft'}`,
      status.hasLocalDraft ? 'Local draft: yes' : 'Local draft: no',
      status.unsavedChanges ? 'Unsaved changes: yes' : 'Unsaved changes: no',
      `Message: ${createStorageMessage(status)}`,
    ];

    if (typeof status.lastAutosaveAtMs === 'number') {
      lines.push(`Last autosave: ${new Date(status.lastAutosaveAtMs).toLocaleString()}`);
    }

    statusElement.textContent = lines.join(' | ');
  };

  const workspaceContext: AuthoringWorkspaceRenderContext = {
    runtimeBridge: options?.runtimeBridge,
    getState: (): AuthoringEditorState => state,
    setState: (nextState: AuthoringEditorState): void => {
      state = nextState;
      render();
    },
    requestRender: (): void => {
      renderWorkspace();
    },
  };

  const renderWorkspace = (): void => {
    if (!workspaceContainer) {
      return;
    }

    const nextWorkspace = workspaces[state.activeTab];
    if (activeWorkspace && activeWorkspace.id !== nextWorkspace.id) {
      activeWorkspace.destroy();
    }

    activeWorkspace = nextWorkspace;
    nextWorkspace.render(workspaceContainer, state, workspaceContext);
  };

  const renderTabs = (tabsContainer: HTMLElement): void => {
    tabsContainer.innerHTML = '';

    (Object.keys(TAB_LABELS) as AuthoringEditorTab[]).forEach((tab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = TAB_LABELS[tab];
      button.style.fontWeight = state.activeTab === tab ? '700' : '400';
      button.setAttribute('data-authoring-tab', tab);
      button.onclick = (): void => {
        setActiveTab(tab);
      };
      tabsContainer.appendChild(button);
    });
  };

  const render = (): void => {
    if (!rootElement) {
      return;
    }

    const tabsContainer = rootElement.querySelector('[data-authoring-tabs]');
    if (tabsContainer instanceof HTMLElement) {
      renderTabs(tabsContainer);
    }

    renderStorageStatus();
    renderWorkspace();
  };

  const setState = (nextState: AuthoringEditorState): void => {
    state = nextState;
    render();
  };

  const refreshStorageStatus = (): void => {
    const draftStatus = storage.getDraftStatus(state.activeTab);
    const localDraftActive =
      state.storageStatus.source === 'local_autosave_draft' && draftStatus.hasLocalDraft;
    const source = localDraftActive ? 'local_autosave_draft' : 'bundled_json';

    const message = localDraftActive
      ? 'Local autosave draft is active'
      : draftStatus.hasLocalDraft
        ? 'Local autosave draft exists but is not active'
        : 'Bundled JSON is active';

    setState(
      setAuthoringEditorStorageStatus(state, {
        source,
        hasLocalDraft: draftStatus.hasLocalDraft,
        localDraftActive,
        unsavedChanges: state.storageStatus.unsavedChanges,
        lastAutosaveAtMs: draftStatus.lastAutosaveAtMs,
        message,
      }),
    );
  };

  const setActiveTab = (tab: AuthoringEditorTab): void => {
    if (state.activeTab === tab) {
      return;
    }

    setState(setAuthoringEditorTab(state, tab));
    refreshStorageStatus();
  };

  return {
    mount(container: HTMLElement): void {
      if (hostContainer && hostContainer !== container) {
        this.unmount();
      }

      if (rootElement) {
        return;
      }

      hostContainer = container;

      const root = document.createElement('div');
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.gap = '8px';
      root.style.padding = '8px';

      const tabsContainer = document.createElement('div');
      tabsContainer.style.display = 'flex';
      tabsContainer.style.gap = '8px';
      tabsContainer.setAttribute('data-authoring-tabs', 'true');

      const storageIndicator = document.createElement('div');
      storageIndicator.setAttribute('data-authoring-storage-status', 'true');

      const contentRow = document.createElement('div');
      contentRow.style.display = 'grid';
      contentRow.style.gridTemplateColumns = '1fr 1fr';
      contentRow.style.gap = '8px';

      const workspacePanel = document.createElement('section');
      workspacePanel.setAttribute('data-authoring-workspace', 'true');
      workspacePanel.style.border = '1px solid #999';
      workspacePanel.style.padding = '8px';
      workspacePanel.style.minHeight = '220px';

      const viewportPanel = document.createElement('section');
      viewportPanel.style.border = '1px dashed #999';
      viewportPanel.style.padding = '8px';
      viewportPanel.style.minHeight = '220px';

      const viewportTitle = document.createElement('h2');
      viewportTitle.textContent = 'Phaser viewport/gizmos placeholder';

      const viewportDescription = document.createElement('p');
      viewportDescription.textContent =
        'Reserved area for future Phaser viewport and gizmo integration.';

      viewportPanel.append(viewportTitle, viewportDescription);

      contentRow.append(workspacePanel, viewportPanel);
      root.append(tabsContainer, storageIndicator, contentRow);
      container.appendChild(root);

      rootElement = root;
      statusElement = storageIndicator;
      workspaceContainer = workspacePanel;

      refreshStorageStatus();
      render();
    },

    unmount(): void {
      if (activeWorkspace) {
        activeWorkspace.destroy();
        activeWorkspace = null;
      }

      if (rootElement && hostContainer) {
        hostContainer.removeChild(rootElement);
      }

      hostContainer = null;
      rootElement = null;
      statusElement = null;
      workspaceContainer = null;
    },

    getState(): AuthoringEditorState {
      return state;
    },

    setActiveTab,

    markUnsavedChanges(unsaved: boolean): void {
      setState(
        setAuthoringEditorStorageStatus(state, {
          ...state.storageStatus,
          unsavedChanges: unsaved,
          message: unsaved
            ? `${createStorageMessage(state.storageStatus)} | Unsaved changes`
            : createStorageMessage(state.storageStatus),
        }),
      );
    },

    refreshStorageStatus,
  };
}
