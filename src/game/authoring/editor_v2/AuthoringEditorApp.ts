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
  setAuthoringEditorGridSize,
  setAuthoringEditorGridVisible,
  setAuthoringEditorDirty,
  setAuthoringEditorOpenState,
  setAuthoringEditorSnapEnabled,
  setAuthoringEditorTimeMode,
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

function createRuntimeSnapshotSignature(snapshot: AuthoringEditorRuntimeSnapshot): string {
  const objectSignature = snapshot.objects
    .map((entry) => `${entry.id}:${entry.type ?? ''}:${entry.label ?? ''}`)
    .join('|');
  return `${snapshot.levelId}#${objectSignature}`;
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
  let runtimeSnapshotSignature = createRuntimeSnapshotSignature(runtimeSnapshot);
  let mountedContainer: HTMLElement | null = null;
  let destroyed = false;

  const topToolbar: TopToolbar = createTopToolbar({
    onTabSelected: (tab: AuthoringEditorTab): void => {
      setActiveTab(tab);
    },
    onTimeModeSelected: (mode): void => {
      if (destroyed || state.timeMode === mode) {
        return;
      }
      state = setAuthoringEditorTimeMode(state, mode);
      syncExternalState();
      render();
    },
    onGridVisibleChanged: (visible): void => {
      if (destroyed || state.gridVisible === visible) {
        return;
      }
      state = setAuthoringEditorGridVisible(state, visible);
      state = setAuthoringEditorDirty(state, true);
      syncExternalState();
      render();
    },
    onSnapEnabledChanged: (enabled): void => {
      if (destroyed || state.snapEnabled === enabled) {
        return;
      }
      state = setAuthoringEditorSnapEnabled(state, enabled);
      state = setAuthoringEditorDirty(state, true);
      syncExternalState();
      render();
    },
    onGridSizeSelected: (size): void => {
      if (destroyed || state.gridSize === size) {
        return;
      }
      state = setAuthoringEditorGridSize(state, size);
      state = setAuthoringEditorDirty(state, true);
      syncExternalState();
      render();
    },
    onCloseRequested: (): void => {
      close();
    },
  });

  const syncExternalState = (): void => {
    const editorVisible = state.openState === 'open';
    domRoot.setVisible(editorVisible);
    overlay.setVisible(editorVisible);
    overlay.setLayoutInsets(domRoot.getLayoutInsets());
    overlay.setGridVisible(state.gridVisible);
    overlay.setGridSize(state.gridSize);
    overlay.setSelectedObjectId(state.selectedObjectId);
    runtimeBridge.setTimeMode(state.timeMode);
    runtimeBridge.setSelectedObjectId(state.selectedObjectId);
    runtimeBridge.setGridSettings(state.gridVisible, state.snapEnabled, state.gridSize);
  };

  const renderStatusBar = (): void => {
    const statusBar = domRoot.statusBarElement;
    statusBar.replaceChildren();

    const chips: readonly string[] = [
      `Time: ${state.timeMode}`,
      `Dirty: ${state.dirty ? 'Yes' : 'No'}`,
      'Validation: Pending',
      'Mouse: --,--',
      'Save/Export: Idle',
    ];

    chips.forEach((label) => {
      const chip = document.createElement('span');
      chip.textContent = label;
      chip.style.fontSize = '11px';
      chip.style.lineHeight = '1';
      chip.style.padding = '2px 6px';
      chip.style.border = '1px solid rgba(148, 163, 184, 0.5)';
      chip.style.borderRadius = '6px';
      chip.style.background = 'rgba(15, 23, 42, 0.32)';
      statusBar.appendChild(chip);
    });

    statusBar.style.display = 'flex';
    statusBar.style.alignItems = 'center';
    statusBar.style.gap = '6px';
    statusBar.style.overflowX = 'auto';
    statusBar.style.whiteSpace = 'nowrap';
  };

  const renderRuntimePanels = (): void => {
    if (!mountedContainer) {
      return;
    }

    if (state.openState !== 'open') {
      return;
    }

    rightInspectorPanel.render(domRoot.rightPanelElement, state, runtimeSnapshot);
    renderStatusBar();
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
    tabViews[state.activeTab].render(domRoot.tabContentElement, state);
    renderRuntimePanels();
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
    runtimeSnapshotSignature = createRuntimeSnapshotSignature(runtimeSnapshot);
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
      overlay.update(deltaMs);
      const nextRuntimeSnapshot = runtimeBridge.readSnapshot();
      const nextSnapshotSignature = createRuntimeSnapshotSignature(nextRuntimeSnapshot);
      if (nextSnapshotSignature !== runtimeSnapshotSignature) {
        runtimeSnapshot = nextRuntimeSnapshot;
        runtimeSnapshotSignature = nextSnapshotSignature;
        renderRuntimePanels();
      }
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
