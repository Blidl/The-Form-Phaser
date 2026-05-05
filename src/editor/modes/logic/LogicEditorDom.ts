export interface LogicEditorDomHelpers {
    makeSectionTitle: (text: string) => HTMLDivElement;
    makeInfoLine: (text: string) => HTMLDivElement;
    makeSpacer: (heightPx: number) => HTMLDivElement;
    bindEditorInputKeyboardGuards: (input: HTMLElement) => void;
}

export function makeSectionTitle(text: string): HTMLDivElement {
    const title = document.createElement('div');
    title.textContent = text;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    return title;
}

export function makeInfoLine(text: string): HTMLDivElement {
    const line = document.createElement('div');
    line.textContent = text;
    return line;
}

export function makeSpacer(heightPx: number): HTMLDivElement {
    const spacer = document.createElement('div');
    spacer.style.height = `${heightPx}px`;
    return spacer;
}

export function bindEditorInputKeyboardGuards(input: HTMLElement): void {
    const stopKeyboardEvent = (event: Event): void => {
        event.stopPropagation();
    };
    input.addEventListener('keydown', stopKeyboardEvent);
    input.addEventListener('keyup', stopKeyboardEvent);
    input.addEventListener('keypress', stopKeyboardEvent);
}
