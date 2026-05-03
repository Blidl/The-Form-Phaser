import type {
  AuthoringEditorObjectSummary as LegacyEditorObjectSummary,
  AuthoringEditorRuntimeBridge as LegacyAuthoringEditorRuntimeBridge,
} from '../../../tools/authoring_editor/authoring_editor_runtime_bridge';
import {
  createAuthoringEditorApp,
  type AuthoringEditorApp,
} from './AuthoringEditorApp';
import type {
  AuthoringEditorRuntimeBridge,
  AuthoringEditorRuntimeSnapshot,
} from './AuthoringEditorRuntimeBridge';

const AUTHORING_EDITOR_V2_SHELL_ID = 'authoring-editor-v2-shell';
const ENABLE_AUTHORING_EDITOR_V2_SHELL = import.meta.env.DEV;

export interface AuthoringEditorV2Entrypoint {
  isEnabled(): boolean;
  isOpen(): boolean;
  open(): void;
  close(): void;
  toggle(): void;
  update(deltaMs: number): void;
  destroy(): void;
}

interface CreateAuthoringEditorV2EntrypointOptions {
  readonly runtimeBridge?: LegacyAuthoringEditorRuntimeBridge;
  readonly hostElement?: HTMLElement;
}

const mapLegacyObjects = (
  objects: readonly LegacyEditorObjectSummary[],
): AuthoringEditorRuntimeSnapshot['objects'] => {
  return objects.map((entry) => ({
    id: entry.id,
    type: entry.type,
    label: entry.label,
  }));
};

const createBridgeAdapter = (
  legacyBridge: LegacyAuthoringEditorRuntimeBridge | undefined,
): AuthoringEditorRuntimeBridge => {
  return {
    onEditorOpened: () => {
      legacyBridge?.enterAuthoringEditorCameraMode();
      legacyBridge?.enterAuthoringEditorOverlayMode?.();
    },
    onEditorClosed: () => {
      legacyBridge?.exitAuthoringEditorOverlayMode?.();
      legacyBridge?.exitAuthoringEditorCameraMode();
    },
    readSnapshot: (): AuthoringEditorRuntimeSnapshot => {
      if (!legacyBridge) {
        return {
          levelId: 'unknown_level',
          objects: [],
        };
      }
      return {
        levelId: legacyBridge.getLevelId(),
        objects: mapLegacyObjects(legacyBridge.getEditorObjects()),
      };
    },
    setTimeMode: () => {
      // Time ownership will be wired in later phases.
    },
    setSelectedObjectId: (objectId: string | null) => {
      if (objectId) {
        legacyBridge?.focusObject(objectId);
      }
    },
    setGridSettings: () => {
      // Grid/snap wiring will be added in later phases.
    },
  };
};

const createNoopEntrypoint = (): AuthoringEditorV2Entrypoint => ({
  isEnabled: () => false,
  isOpen: () => false,
  open: () => undefined,
  close: () => undefined,
  toggle: () => undefined,
  update: () => undefined,
  destroy: () => undefined,
});

const resolveHostElement = (hostElement?: HTMLElement): HTMLElement | null => {
  if (hostElement) {
    return hostElement;
  }
  if (typeof document === 'undefined') {
    return null;
  }
  return document.getElementById('app') ?? document.body;
};

export const createAuthoringEditorV2Entrypoint = (
  options?: CreateAuthoringEditorV2EntrypointOptions,
): AuthoringEditorV2Entrypoint => {
  if (!ENABLE_AUTHORING_EDITOR_V2_SHELL || typeof window === 'undefined' || typeof document === 'undefined') {
    return createNoopEntrypoint();
  }

  const runtimeBridge = createBridgeAdapter(options?.runtimeBridge);
  let app: AuthoringEditorApp | null = null;
  let shellElement: HTMLDivElement | null = null;
  let mountElement: HTMLDivElement | null = null;

  const ensureMounted = (): HTMLDivElement | null => {
    const hostElement = resolveHostElement(options?.hostElement);
    if (!hostElement) {
      return null;
    }
    if (shellElement && mountElement) {
      return mountElement;
    }

    const shell = document.createElement('div');
    shell.id = AUTHORING_EDITOR_V2_SHELL_ID;
    shell.style.position = 'fixed';
    shell.style.inset = '0';
    shell.style.zIndex = '9999';
    shell.style.pointerEvents = 'none';

    const mount = document.createElement('div');
    mount.style.position = 'relative';
    mount.style.width = '100%';
    mount.style.height = '100%';
    mount.style.pointerEvents = 'none';

    shell.appendChild(mount);
    hostElement.appendChild(shell);

    shellElement = shell;
    mountElement = mount;
    return mount;
  };

  const open = (): void => {
    const mount = ensureMounted();
    if (!mount) {
      return;
    }
    app = app ?? createAuthoringEditorApp({ runtimeBridge });
    app.mount(mount);
    app.open();
  };

  const close = (): void => {
    if (!app) {
      return;
    }
    app.close();
    app.unmount();
    if (shellElement) {
      shellElement.remove();
    }
    shellElement = null;
    mountElement = null;
  };

  return {
    isEnabled: (): boolean => ENABLE_AUTHORING_EDITOR_V2_SHELL,
    isOpen: (): boolean => shellElement !== null,
    open,
    close,
    toggle: (): void => {
      if (shellElement) {
        close();
        return;
      }
      open();
    },
    update(deltaMs: number): void {
      if (!app || !shellElement) {
        return;
      }
      app.update(deltaMs);
    },
    destroy(): void {
      close();
      if (app) {
        app.destroy();
      }
      app = null;
    },
  };
};
