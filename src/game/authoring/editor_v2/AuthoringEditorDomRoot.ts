export interface AuthoringEditorDomRoot {
  readonly rootElement: HTMLDivElement;
  readonly toolbarElement: HTMLDivElement;
  readonly leftPanelElement: HTMLDivElement;
  readonly rightPanelElement: HTMLDivElement;
  readonly tabContentElement: HTMLDivElement;
  mount(container: HTMLElement): void;
  unmount(): void;
  setVisible(visible: boolean): void;
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
  const root = document.createElement('div');
  root.setAttribute('data-authoring-editor-v2-root', 'true');
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.zIndex = '9998';
  root.style.display = 'grid';
  root.style.gridTemplateRows = 'auto 1fr';
  root.style.gap = '10px';
  root.style.padding = '10px';
  root.style.pointerEvents = 'none';

  const toolbar = document.createElement('div');
  toolbar.setAttribute('data-authoring-editor-v2-toolbar', 'true');
  applyPanelFrameStyle(toolbar);

  const contentRow = document.createElement('div');
  contentRow.style.display = 'grid';
  contentRow.style.gridTemplateColumns = '280px minmax(0, 1fr) 320px';
  contentRow.style.gap = '10px';

  const leftPanel = document.createElement('div');
  leftPanel.setAttribute('data-authoring-editor-v2-left-panel', 'true');
  applyPanelFrameStyle(leftPanel);

  const centerPanel = document.createElement('div');
  centerPanel.setAttribute('data-authoring-editor-v2-center-shell', 'true');
  centerPanel.style.pointerEvents = 'none';
  centerPanel.style.display = 'flex';
  centerPanel.style.justifyContent = 'center';
  centerPanel.style.alignItems = 'flex-start';

  const tabContent = document.createElement('div');
  tabContent.setAttribute('data-authoring-editor-v2-tab-content', 'true');
  applyPanelFrameStyle(tabContent);
  tabContent.style.maxWidth = '460px';
  tabContent.style.width = '100%';
  tabContent.style.pointerEvents = 'auto';

  const rightPanel = document.createElement('div');
  rightPanel.setAttribute('data-authoring-editor-v2-right-panel', 'true');
  applyPanelFrameStyle(rightPanel);

  centerPanel.appendChild(tabContent);
  contentRow.append(leftPanel, centerPanel, rightPanel);
  root.append(toolbar, contentRow);

  let hostContainer: HTMLElement | null = null;

  return {
    rootElement: root,
    toolbarElement: toolbar,
    leftPanelElement: leftPanel,
    rightPanelElement: rightPanel,
    tabContentElement: tabContent,
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
      root.style.display = visible ? 'grid' : 'none';
    },
    destroy(): void {
      this.unmount();
      toolbar.replaceChildren();
      leftPanel.replaceChildren();
      rightPanel.replaceChildren();
      tabContent.replaceChildren();
    },
  };
}
