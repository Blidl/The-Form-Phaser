/**
 * WARNING: Frozen placeholder layer.
 * This file is NOT the active F2 Objects authoring editor.
 * Active implementation: src/editor/*
 * Legacy reference path: Shift+F2 in src/game/world/runtime/test_world_editor_runtime.ts
 * Do not add new Objects authoring features here unless there is an explicit migration plan.
 */
import type {
  AuthoringEditorObjectSummary as LegacyEditorObjectSummary,
  AuthoringEditorRuntimeBridge as LegacyAuthoringEditorRuntimeBridge,
} from '../../../tools/authoring_editor/authoring_editor_runtime_bridge';
import {
  createAuthoringEditorApp,
  type AuthoringEditorApp,
} from './AuthoringEditorApp';
import {
  clearTestWorldEditorDraft,
  getTestWorldEditorDraftStorageAuditSnapshot,
  saveTestWorldEditorDraft,
} from '../../world/runtime/test_world_editor_storage';
import type { TestWorldConfig } from '../../world/runtime/test_world_config';
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
    getConfigSignature: (): string => {
      const config = legacyBridge?.getCurrentWorldConfig() ?? null;
      return JSON.stringify(config);
    },
    isDraftLoaded: (): boolean => {
      if (!legacyBridge) {
        return false;
      }
      const levelId = legacyBridge.getLevelId();
      const config = legacyBridge.getCurrentWorldConfig() as TestWorldConfig;
      const audit = getTestWorldEditorDraftStorageAuditSnapshot(levelId, config);
      return audit.draftPresent && audit.draftValid && audit.draftConfigSignature === JSON.stringify(config);
    },
    hasDraft: (): boolean => {
      if (!legacyBridge) {
        return false;
      }
      const levelId = legacyBridge.getLevelId();
      const config = legacyBridge.getCurrentWorldConfig() as TestWorldConfig;
      return getTestWorldEditorDraftStorageAuditSnapshot(levelId, config).draftPresent;
    },
    saveDraft: (): { success: boolean; error?: string } => {
      if (!legacyBridge) {
        return { success: false, error: 'legacy bridge unavailable' };
      }
      const levelId = legacyBridge.getLevelId();
      const config = legacyBridge.getCurrentWorldConfig() as TestWorldConfig;
      try {
        const result = saveTestWorldEditorDraft(levelId, config);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'save failed' };
      }
    },
    clearDraft: (): { success: boolean; hadDraft: boolean; storageKey: string | null; error?: string } => {
      if (!legacyBridge) {
        return { success: false, hadDraft: false, storageKey: null, error: 'legacy bridge unavailable' };
      }
      const levelId = legacyBridge.getLevelId();
      const config = legacyBridge.getCurrentWorldConfig() as TestWorldConfig;
      const audit = getTestWorldEditorDraftStorageAuditSnapshot(levelId, config);
      try {
        clearTestWorldEditorDraft(levelId);
        return { success: true, hadDraft: audit.draftPresent, storageKey: audit.storageKey };
      } catch (error) {
        return {
          success: false,
          hadDraft: audit.draftPresent,
          storageKey: audit.storageKey,
          error: error instanceof Error ? error.message : 'draft clear failed',
        };
      }
    },
    exportJson: (): { success: boolean; filename?: string; error?: string } => {
      if (typeof document === 'undefined' || !legacyBridge) {
        return { success: false, error: 'export unavailable' };
      }
      const levelId = legacyBridge.getLevelId();
      const config = legacyBridge.getCurrentWorldConfig();
      try {
        const filename = `${levelId}.json`;
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        return { success: true, filename };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'export failed' };
      }
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
