import type { AuthoringEditorRuntimeBridge } from '../authoring_editor_runtime_bridge';
import type {
  AuthoringEditorState,
  AuthoringEditorTab,
} from '../editor_state';

export interface AuthoringWorkspaceRenderContext {
  readonly runtimeBridge?: AuthoringEditorRuntimeBridge;
  getState(): AuthoringEditorState;
  setState(state: AuthoringEditorState): void;
  requestRender(): void;
}

export interface AuthoringWorkspace {
  readonly id: AuthoringEditorTab;
  readonly title: string;
  render(
    container: HTMLElement,
    state: AuthoringEditorState,
    context: AuthoringWorkspaceRenderContext,
  ): void;
  destroy(): void;
}
