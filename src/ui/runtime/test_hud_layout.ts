import type { Scene } from 'phaser';

export type TestHudHorizontalAnchor = 'left' | 'right';
export type TestHudVerticalAnchor = 'top' | 'bottom';

// Shared screen-space layout contract for UI that must stay relative to the viewport.
// horizontal/vertical pick the screen edge to anchor against.
// offsetX/offsetY are pixel offsets from that anchored edge.
export interface TestHudAnchorLayout {
    horizontal: TestHudHorizontalAnchor;
    vertical: TestHudVerticalAnchor;
    offsetX: number;
    offsetY: number;
}

// Gameplay HUD scene title.
export const TEST_HUD_TITLE_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'right',
    vertical: 'top',
    offsetX: 125,
    offsetY: 24
};

// Square resource bar and its label.
export const TEST_HUD_SQUARE_TRAIL_BAR_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'left',
    vertical: 'top',
    offsetX: 24,
    offsetY: 60
};

// Triangle resource bar and its label.
export const TEST_HUD_TRIANGLE_FLIGHT_BAR_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'left',
    vertical: 'top',
    offsetX: 24,
    offsetY: 92
};

// Runtime debug text block.
export const TEST_DEBUG_RUNTIME_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'left',
    vertical: 'top',
    offsetX: 18,
    offsetY: 120
};

// Dev helper DOM overlay shown in dev builds.
export const TEST_DEV_HELPER_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'right',
    vertical: 'top',
    offsetX: 20,
    offsetY: 1200
};

// F2 editor sidebar root container.
export const TEST_EDITOR_SIDEBAR_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'right',
    vertical: 'top',
    offsetX: 0,
    offsetY: 0
};

// F2 editor help/instructions overlay.
export const TEST_EDITOR_HELP_OVERLAY_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'left',
    vertical: 'top',
    offsetX: 18,
    offsetY: 150
};

// F2 editor background-selection badge.
export const TEST_EDITOR_BACKGROUND_BADGE_LAYOUT: TestHudAnchorLayout = {
    horizontal: 'right',
    vertical: 'top',
    offsetX: 18,
    offsetY: 44
};

// Resolves a viewport-relative layout into an absolute screen-space point for Phaser UI.
export const resolveTestHudAnchorPosition = (
    scene: Scene,
    layout: TestHudAnchorLayout
): { x: number; y: number } => {
    const viewportWidth = scene.scale.width;
    const viewportHeight = scene.scale.height;

    return {
        x: layout.horizontal === 'left'
            ? layout.offsetX
            : viewportWidth - layout.offsetX,
        y: layout.vertical === 'top'
            ? layout.offsetY
            : viewportHeight - layout.offsetY
    };
};

// Applies the same anchor model to absolutely positioned DOM overlays.
export const applyDomAnchorLayout = (
    element: HTMLElement,
    layout: TestHudAnchorLayout
): void => {
    element.style.left = '';
    element.style.right = '';
    element.style.top = '';
    element.style.bottom = '';

    if (layout.horizontal === 'left') {
        element.style.left = `${layout.offsetX}px`;
    } else {
        element.style.right = `${layout.offsetX}px`;
    }

    if (layout.vertical === 'top') {
        element.style.top = `${layout.offsetY}px`;
    } else {
        element.style.bottom = `${layout.offsetY}px`;
    }
};
