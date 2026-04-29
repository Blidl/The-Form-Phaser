import type { AuthoringEditorRuntimeBridge } from './authoring_editor_runtime_bridge';
import { createAuthoringEditorApp, type AuthoringEditorApp } from './editor_app';

const AUTHORING_EDITOR_V2_DEV_SHELL_ID = 'authoring-editor-v2-dev-shell';
const ENABLE_AUTHORING_EDITOR_V2_DEV_SHELL = import.meta.env.DEV;

export interface AuthoringEditorDevLauncher {
    isEnabled(): boolean;
    isOpen(): boolean;
    open(): void;
    close(): void;
    toggle(): void;
    destroy(): void;
}

interface CreateAuthoringEditorDevLauncherOptions {
    readonly runtimeBridge?: AuthoringEditorRuntimeBridge;
}

const createNoopLauncher = (): AuthoringEditorDevLauncher => ({
    isEnabled: () => false,
    isOpen: () => false,
    open: () => undefined,
    close: () => undefined,
    toggle: () => undefined,
    destroy: () => undefined
});

export const createAuthoringEditorDevLauncher = (
    options?: CreateAuthoringEditorDevLauncherOptions
): AuthoringEditorDevLauncher => {
    if (!ENABLE_AUTHORING_EDITOR_V2_DEV_SHELL || typeof window === 'undefined' || typeof document === 'undefined') {
        return createNoopLauncher();
    }

    let app: AuthoringEditorApp | null = null;
    let shellElement: HTMLDivElement | null = null;
    let mountElement: HTMLDivElement | null = null;
    let cameraModeActive = false;

    const enterCameraMode = (): void => {
        if (cameraModeActive) {
            return;
        }
        options?.runtimeBridge?.enterAuthoringEditorCameraMode();
        cameraModeActive = true;
    };

    const exitCameraMode = (): void => {
        if (!cameraModeActive) {
            return;
        }
        options?.runtimeBridge?.exitAuthoringEditorCameraMode();
        cameraModeActive = false;
    };

    const ensureShellElements = (): HTMLDivElement => {
        const shell = document.createElement('div');
        shell.id = AUTHORING_EDITOR_V2_DEV_SHELL_ID;
        shell.style.position = 'fixed';
        shell.style.top = '12px';
        shell.style.right = '12px';
        shell.style.width = 'min(680px, calc(100vw - 24px))';
        shell.style.maxHeight = 'calc(100vh - 24px)';
        shell.style.overflow = 'auto';
        shell.style.zIndex = '9999';
        shell.style.backgroundColor = 'rgba(10, 17, 24, 0.96)';
        shell.style.border = '2px solid #6ee7b7';
        shell.style.borderRadius = '8px';
        shell.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.45)';
        shell.style.color = '#e2f7f0';
        shell.style.fontFamily = 'monospace';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.gap = '10px';
        header.style.padding = '8px 10px';
        header.style.borderBottom = '1px solid rgba(110, 231, 183, 0.35)';

        const title = document.createElement('div');
        title.textContent = 'Authoring Editor V2 Dev Shell';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'Close';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = (): void => {
            close();
        };

        const mount = document.createElement('div');
        mount.style.padding = '8px';

        header.append(title, closeButton);
        shell.append(header, mount);

        document.body.appendChild(shell);

        shellElement = shell;
        mountElement = mount;

        return mount;
    };

    const open = (): void => {
        if (shellElement && mountElement) {
            return;
        }

        enterCameraMode();
        const mount = ensureShellElements();
        app = app ?? createAuthoringEditorApp({ runtimeBridge: options?.runtimeBridge });
        app.mount(mount);
    };

    const close = (): void => {
        if (!shellElement) {
            return;
        }

        if (app) {
            app.unmount();
        }

        shellElement.remove();
        shellElement = null;
        mountElement = null;
        exitCameraMode();
    };

    return {
        isEnabled: (): boolean => ENABLE_AUTHORING_EDITOR_V2_DEV_SHELL,
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
        destroy: (): void => {
            close();
            app = null;
        }
    };
};
