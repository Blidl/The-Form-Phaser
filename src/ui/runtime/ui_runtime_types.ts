export interface TestHudRuntime {
    update: () => void;
    setVisible: (visible: boolean) => void;
    reset: () => void;
    destroy: () => void;
}

export interface TestDebugRuntime {
    update: () => void;
    setVisible: (visible: boolean) => void;
    reset: () => void;
    destroy: () => void;
}
