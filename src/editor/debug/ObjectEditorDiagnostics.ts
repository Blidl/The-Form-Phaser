const DIAG_STORAGE_KEY = 'TFP_EDITOR_OBJECT_DIAG';
const MAX_BUFFER_ENTRIES = 300;

interface DiagEntry {
    timestampIso: string;
    label: string;
    payload: unknown;
}

const diagBuffer: DiagEntry[] = [];

const safePayload = (payload: unknown): unknown => {
    if (payload === undefined) {
        return null;
    }
    try {
        return JSON.parse(JSON.stringify(payload));
    } catch {
        return String(payload);
    }
};

const readEnabled = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.localStorage.getItem(DIAG_STORAGE_KEY) === '1';
};

export const isObjectEditorDiagnosticsEnabled = (): boolean => readEnabled();

export const setObjectEditorDiagnosticsEnabled = (enabled: boolean): void => {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(DIAG_STORAGE_KEY, enabled ? '1' : '0');
};

export const toggleObjectEditorDiagnostics = (): boolean => {
    const nextEnabled = !isObjectEditorDiagnosticsEnabled();
    setObjectEditorDiagnosticsEnabled(nextEnabled);
    objectDiag('[EditorDiag:toggle]', { enabled: nextEnabled });
    return nextEnabled;
};

export const objectDiag = (label: string, payload?: unknown): void => {
    if (!isObjectEditorDiagnosticsEnabled()) {
        return;
    }
    const entry: DiagEntry = {
        timestampIso: new Date().toISOString(),
        label,
        payload: safePayload(payload)
    };
    diagBuffer.push(entry);
    while (diagBuffer.length > MAX_BUFFER_ENTRIES) {
        diagBuffer.shift();
    }
    console.info(`[TFP:ObjectDiag] ${entry.timestampIso} ${label}`, entry.payload);
};

export const clearObjectDiagBuffer = (): void => {
    diagBuffer.length = 0;
};

export const getObjectDiagBufferText = (): string => {
    return diagBuffer.map((entry) => {
        const payloadText = entry.payload === null ? 'null' : JSON.stringify(entry.payload);
        return `${entry.timestampIso} ${entry.label} ${payloadText}`;
    }).join('\n');
};

export const getLatestObjectDiagSummary = (): string => {
    const latest = diagBuffer[diagBuffer.length - 1];
    if (!latest) {
        return '-';
    }
    return `${latest.label}`;
};

export const copyObjectDiagBufferToClipboard = async (): Promise<{ success: boolean; message: string }> => {
    const text = getObjectDiagBufferText();
    if (typeof window === 'undefined') {
        return { success: false, message: 'Clipboard API unavailable.' };
    }
    try {
        if (window.navigator?.clipboard?.writeText) {
            await window.navigator.clipboard.writeText(text);
            return { success: true, message: 'Diagnostics copied to clipboard.' };
        }
    } catch {
        // fallback below
    }
    console.info('[TFP:ObjectDiagBuffer]', text);
    return {
        success: false,
        message: 'Diagnostics copied failed; logs printed to console.'
    };
};
