import {
  createAuthoringEditorDomRoot,
  type AuthoringEditorDomRoot,
} from './AuthoringEditorDomRoot';
import {
  createAuthoringEditorPhaserOverlay,
  type AuthoringEditorPhaserOverlay,
} from './AuthoringEditorPhaserOverlay';
import {
  createInitialAuthoringEditorState,
  setAuthoringEditorActiveTab,
  setAuthoringEditorOpenState,
} from './AuthoringEditorState';
import {
  createNoopAuthoringEditorRuntimeBridge,
  type AuthoringEditorRuntimeBridge,
  type AuthoringEditorRuntimeSnapshot,
} from './AuthoringEditorRuntimeBridge';
import type {
  AuthoringEditorLifecycle,
  AuthoringEditorState,
  AuthoringEditorTab,
  AuthoringEditorTabView,
} from './AuthoringEditorTypes';
import { createLeftInspectorPanel } from './panels/LeftInspectorPanel';
import { createRightInspectorPanel } from './panels/RightInspectorPanel';
import { createTopToolbar, type TopToolbar } from './panels/TopToolbar';
import { createBackgroundTab } from './tabs/BackgroundTab';
import { createCutscenesTab } from './tabs/CutscenesTab';
import { createLevelTab } from './tabs/LevelTab';
import { createLogicTab } from './tabs/LogicTab';
import { createNpcTab } from './tabs/NpcTab';
import { createObjectsTab } from './tabs/ObjectsTab';
import { createPlayerTab } from './tabs/PlayerTab';

export interface AuthoringEditorApp extends AuthoringEditorLifecycle {
  getState(): AuthoringEditorState;
}

interface CreateAuthoringEditorAppOptions {
  readonly domRoot?: AuthoringEditorDomRoot;
  readonly overlay?: AuthoringEditorPhaserOverlay;
  readonly runtimeBridge?: AuthoringEditorRuntimeBridge;
  readonly initialState?: Partial<AuthoringEditorState>;
}

type AuthoringEditorTabViewMap = Record<AuthoringEditorTab, AuthoringEditorTabView>;

function createTabViewMap(): AuthoringEditorTabViewMap {
  return {
    Level: createLevelTab(),
    Player: createPlayerTab(),
    Objects: createObjectsTab(),
    Background: createBackgroundTab(),
    NPC: createNpcTab(),
    Cutscenes: createCutscenesTab(),
    Logic: createLogicTab(),
  };
}

export function createAuthoringEditorApp(
  options?: CreateAuthoringEditorAppOptions,
): AuthoringEditorApp {
  const domRoot = options?.domRoot ?? createAuthoringEditorDomRoot();
  const overlay = options?.overlay ?? createAuthoringEditorPhaserOverlay();
  const runtimeBridge = options?.runtimeBridge ?? createNoopAuthoringEditorRuntimeBridge();
  const tabViews = createTabViewMap();
  const leftInspectorPanel = createLeftInspectorPanel();
  const rightInspectorPanel = createRightInspectorPanel();

  let state = createInitialAuthoringEditorState(options?.initialState);
  let runtimeSnapshot: AuthoringEditorRuntimeSnapshot = runtimeBridge.readSnapshot();
  let mountedContainer: HTMLElement | null = null;
  let destroyed = false;

  const topToolbar: TopToolbar = createTopToolbar({
    onTabSelected: (tab: AuthoringEditorTab): void => {
      setActiveTab(tab);
    },
    onCloseRequested: (): void => {
      close();
    },
  });

  const syncExternalState = (): void => {
    const editorVisible = state.openState === 'open';
    domRoot.setVisible(editorVisible);
    overlay.setVisible(editorVisible);
    overlay.setGridVisible(state.gridVisible);
    overlay.setGridSize(state.gridSize);
    overlay.setSelectedObjectId(state.selectedObjectId);
    runtimeBridge.setTimeMode(state.timeMode);
    runtimeBridge.setSelectedObjectId(state.selectedObjectId);
    runtimeBridge.setGridSettings(state.gridVisible, state.snapEnabled, state.gridSize);
  };

  const render = (): void => {
    if (!mountedContainer) {
      return;
    }

    if (state.openState !== 'open') {
      return;
    }

    topToolbar.render(domRoot.toolbarElement, state);
    leftInspectorPanel.render(domRoot.leftPanelElement, state);
    rightInspectorPanel.render(domRoot.rightPanelElement, state, runtimeSnapshot);
    tabViews[state.activeTab].render(domRoot.tabContentElement, state);
  };

  function setActiveTab(tab: AuthoringEditorTab): void {
    if (destroyed || state.activeTab === tab) {
      return;
    }
    state = setAuthoringEditorActiveTab(state, tab);
    render();
  }

  function open(): void {
    if (destroyed || state.openState === 'open') {
      return;
    }
    state = setAuthoringEditorOpenState(state, 'open');
    runtimeSnapshot = runtimeBridge.readSnapshot();
    runtimeBridge.onEditorOpened?.(state);
    syncExternalState();
    render();
  }

  function close(): void {
    if (destroyed || state.openState === 'closed') {
      return;
    }
    state = setAuthoringEditorOpenState(state, 'closed');
    runtimeBridge.onEditorClosed?.();
    syncExternalState();
    render();
  }

  return {
    mount(container: HTMLElement): void {
      if (destroyed) {
        return;
      }

      if (mountedContainer === container) {
        return;
      }

      if (mountedContainer) {
        this.unmount();
      }

      mountedContainer = container;
      domRoot.mount(container);
      syncExternalState();
      render();
    },
    unmount(): void {
      if (!mountedContainer) {
        return;
      }
      domRoot.unmount();
      mountedContainer = null;
    },
    open,
    close,
    setActiveTab,
    update(deltaMs: number): void {
      if (destroyed || state.openState !== 'open') {
        return;
      }
      runtimeSnapshot = runtimeBridge.readSnapshot();
      overlay.update(deltaMs);
      render();
    },
    destroy(): void {
      if (destroyed) {
        return;
      }

      close();
      this.unmount();
      topToolbar.destroy();
      leftInspectorPanel.destroy();
      rightInspectorPanel.destroy();
      Object.values(tabViews).forEach((tabView: AuthoringEditorTabView): void => {
        tabView.destroy();
      });
      domRoot.destroy();
      overlay.destroy();
      destroyed = true;
    },
    getState(): AuthoringEditorState {
      return state;
    },
  };
}
