export const AUTHORING_EDITOR_TABS = [
  'Level',
  'Player',
  'Objects',
  'Background',
  'NPC',
  'Cutscenes',
  'Logic',
] as const;

export type AuthoringEditorTab = (typeof AUTHORING_EDITOR_TABS)[number];

export type AuthoringEditorOpenState = 'open' | 'closed';

export type AuthoringEditorTimeMode = 'Live' | 'Paused';

export type AuthoringEditorGridSize = 8 | 16 | 32;

export interface AuthoringEditorLayoutInsets {
  readonly toolbarHeight: number;
  readonly topRulerBandHeight: number;
  readonly leftPanelWidth: number;
  readonly rightPanelWidth: number;
  readonly bottomStatusBarHeight: number;
}

export interface AuthoringEditorState {
  readonly openState: AuthoringEditorOpenState;
  readonly activeTab: AuthoringEditorTab;
  readonly timeMode: AuthoringEditorTimeMode;
  readonly selectedObjectId: string | null;
  readonly dirty: boolean;
  readonly gridVisible: boolean;
  readonly snapEnabled: boolean;
  readonly gridSize: AuthoringEditorGridSize;
}

export interface AuthoringEditorLifecycle {
  mount(container: HTMLElement): void;
  unmount(): void;
  open(): void;
  close(): void;
  setActiveTab(tab: AuthoringEditorTab): void;
  update(deltaMs: number): void;
  destroy(): void;
}

export interface AuthoringEditorTabView {
  readonly id: AuthoringEditorTab;
  render(container: HTMLElement, state: AuthoringEditorState): void;
  destroy(): void;
}
