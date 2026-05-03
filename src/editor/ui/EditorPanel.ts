export type EditorPanelSide = 'left' | 'right';

interface EditorPanelOptions {
    parent: HTMLElement;
    side: EditorPanelSide;
    topOffsetPx: number;
    widthPx?: number;
    zIndex?: number;
}

export class EditorPanel {
    private readonly root: HTMLDivElement;
    private readonly title: HTMLDivElement;
    private readonly content: HTMLDivElement;

    public constructor(options: EditorPanelOptions) {
        const widthPx = options.widthPx ?? 232;

        this.root = document.createElement('div');
        this.root.style.position = 'fixed';
        this.root.style.top = `${options.topOffsetPx}px`;
        this.root.style.bottom = '0';
        this.root.style.width = `${widthPx}px`;
        this.root.style.background = '#cfcfcf';
        this.root.style.border = '1px solid #747474';
        this.root.style.boxSizing = 'border-box';
        this.root.style.padding = '12px';
        this.root.style.fontFamily = 'Tahoma, Verdana, sans-serif';
        this.root.style.pointerEvents = 'auto';
        this.root.style.overflowY = 'auto';
        this.root.style.zIndex = `${options.zIndex ?? 4100}`;
        if (options.side === 'left') {
            this.root.style.left = '0';
        } else {
            this.root.style.right = '0';
        }

        this.title = document.createElement('div');
        this.title.style.fontSize = '20px';
        this.title.style.marginBottom = '12px';
        this.title.style.color = '#202020';

        this.content = document.createElement('div');
        this.content.style.fontSize = '13px';
        this.content.style.lineHeight = '1.4';
        this.content.style.color = '#222';

        this.root.append(this.title, this.content);
        options.parent.appendChild(this.root);
    }

    public setVisible(visible: boolean): void {
        this.root.style.display = visible ? 'block' : 'none';
    }

    public setContent(title: string, lines: readonly string[]): void {
        this.title.textContent = title;

        this.content.replaceChildren();
        const list = document.createElement('ul');
        list.style.margin = '0';
        list.style.paddingLeft = '16px';

        lines.forEach((line) => {
            const item = document.createElement('li');
            item.textContent = line;
            list.appendChild(item);
        });

        this.content.appendChild(list);
    }

    public setCustomContent(title: string, render: (container: HTMLDivElement) => void): void {
        this.title.textContent = title;
        this.content.replaceChildren();
        render(this.content);
    }

    public destroy(): void {
        this.root.remove();
    }
}
