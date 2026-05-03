import type { AuthoringEditorLayoutInsets } from './AuthoringEditorTypes';

export interface AuthoringEditorDomRoot {
  readonly rootElement: HTMLDivElement;
  readonly toolbarElement: HTMLDivElement;
  readonly leftPanelElement: HTMLDivElement;
  readonly rightPanelElement: HTMLDivElement;
  readonly tabContentElement: HTMLDivElement;
  readonly statusBarElement: HTMLDivElement;
  mount(container: HTMLElement): void;
  unmount(): void;
  setVisible(visible: boolean): void;
  getLayoutInsets(): AuthoringEditorLayoutInsets;
  destroy(): void;
}

function applyPanelFrameStyle(element: HTMLDivElement): void {
  element.style.pointerEvents = 'auto';
  element.style.border = '1px solid rgba(148, 163, 184, 0.55)';
  element.style.borderRadius = '8px';
  element.style.backgroundColor = 'rgba(12, 19, 27, 0.84)';
  element.style.color = '#e7edf5';
  element.style.padding = '10px';
  element.style.fontFamily = 'monospace';
}

export function createAuthoringEditorDomRoot(): AuthoringEditorDomRoot {
  const OUTER_MARGIN_PX = 8;
  const TOOLBAR_HEIGHT_PX = 44;
  const TOP_RULER_BAND_HEIGHT_PX = 22;
  const TOP_CHROME_GAP_PX = 6;
  const SIDE_PANEL_BOTTOM_GAP_PX = 6;
  const BOTTOM_STATUS_HEIGHT_PX = 28;
  const LEFT_PANEL_WIDTH_PX = 320;
  const RIGHT_PANEL_WIDTH_PX = 340;
  const RAIL_GAP_PX = 8;

  const root = document.createElement('div');
  root.setAttribute('data-authoring-editor-v2-root', 'true');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.zIndex = '9998';
  root.style.display = 'block';
  root.style.pointerEvents = 'none';

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-authoring-editor-v2-toolbar', 'true');
  applyPanelFrameStyle(toolbar);
  toolbar.style.position = 'absolute';
  toolbar.style.top = `${OUTER_MARGIN_PX}px`;
  toolbar.style.left = `${OUTER_MARGIN_PX}px`;
  toolbar.style.right = `${OUTER_MARGIN_PX}px`;
  toolbar.style.height = `${TOOLBAR_HEIGHT_PX}px`;
  toolbar.style.overflow = 'hidden';

  const sidePanelTopOffsetPx =
    OUTER_MARGIN_PX + TOOLBAR_HEIGHT_PX + TOP_RULER_BAND_HEIGHT_PX + TOP_CHROME_GAP_PX;
  const sidePanelBottomOffsetPx =
    OUTER_MARGIN_PX + BOTTOM_STATUS_HEIGHT_PX + SIDE_PANEL_BOTTOM_GAP_PX;

  const leftRail = document.createElement('div');
  leftRail.style.position = 'absolute';
  leftRail.style.top = `${sidePanelTopOffsetPx}px`;
  leftRail.style.bottom = `${sidePanelBottomOffsetPx}px`;
  leftRail.style.left = `${OUTER_MARGIN_PX}px`;
  leftRail.style.width = `${LEFT_PANEL_WIDTH_PX}px`;
  leftRail.style.display = 'grid';
  leftRail.style.gridTemplateRows = 'minmax(180px, 42%) 1fr';
  leftRail.style.gap = `${RAIL_GAP_PX}px`;
  leftRail.style.pointerEvents = 'auto';

  const leftPanel = document.createElement('div');
  leftPanel.setAttribute('data-authoring-editor-v2-left-panel', 'true');
  applyPanelFrameStyle(leftPanel);
  leftPanel.style.overflow = 'auto';

  const tabContent = document.createElement('div');
  tabContent.setAttribute('data-authoring-editor-v2-tab-content', 'true');
  applyPanelFrameStyle(tabContent);
  tabContent.style.overflow = 'auto';

  const rightRail = document.createElement('div');
  rightRail.style.position = 'absolute';
  rightRail.style.top = `${sidePanelTopOffsetPx}px`;
  rightRail.style.bottom = `${sidePanelBottomOffsetPx}px`;
  rightRail.style.right = `${OUTER_MARGIN_PX}px`;
  rightRail.style.width = `${RIGHT_PANEL_WIDTH_PX}px`;
  rightRail.style.pointerEvents = 'auto';
  const rightPanel = document.createElement('div');
  rightPanel.setAttribute('data-authoring-editor-v2-right-panel', 'true');
  applyPanelFrameStyle(rightPanel);
  rightPanel.style.height = '100%';
  rightPanel.style.overflow = 'auto';

  const statusBar = document.createElement('div');
  statusBar.setAttribute('data-authoring-editor-v2-status-bar', 'true');
  applyPanelFrameStyle(statusBar);
  statusBar.style.position = 'absolute';
  statusBar.style.left = `${OUTER_MARGIN_PX}px`;
  statusBar.style.right = `${OUTER_MARGIN_PX}px`;
  statusBar.style.bottom = `${OUTER_MARGIN_PX}px`;
  statusBar.style.height = `${BOTTOM_STATUS_HEIGHT_PX}px`;
  statusBar.style.display = 'flex';
  statusBar.style.alignItems = 'center';
  statusBar.style.padding = '4px 8px';

  leftRail.append(leftPanel, tabContent);
  rightRail.appendChild(rightPanel);
  root.append(toolbar, leftRail, rightRail, statusBar);

  let hostContainer: HTMLElement | null = null;

  return {
    rootElement: root,
    toolbarElement: toolbar,
    leftPanelElement: leftPanel,
    rightPanelElement: rightPanel,
    tabContentElement: tabContent,
    statusBarElement: statusBar,
    mount(container: HTMLElement): void {
      if (hostContainer === container && root.parentElement === container) {
        return;
      }
      if (root.parentElement) {
        root.remove();
      }
      hostContainer = container;
      container.appendChild(root);
    },
    unmount(): void {
      if (root.parentElement) {
        root.remove();
      }
      hostContainer = null;
    },
    setVisible(visible: boolean): void {
      root.style.display = visible ? 'block' : 'none';
    },
    getLayoutInsets(): AuthoringEditorLayoutInsets {
      return {
        toolbarHeight: TOOLBAR_HEIGHT_PX,
        topRulerBandHeight: TOP_RULER_BAND_HEIGHT_PX,
        leftPanelWidth: LEFT_PANEL_WIDTH_PX,
        rightPanelWidth: RIGHT_PANEL_WIDTH_PX,
        bottomStatusBarHeight: BOTTOM_STATUS_HEIGHT_PX,
      };
    },
    destroy(): void {
      this.unmount();
      toolbar.replaceChildren();
      leftPanel.replaceChildren();
      rightPanel.replaceChildren();
      tabContent.replaceChildren();
      statusBar.replaceChildren();
    },
  };
}
