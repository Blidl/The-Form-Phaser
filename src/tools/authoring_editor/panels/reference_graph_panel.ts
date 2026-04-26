export interface ReferenceGraphNode {
    readonly id: string;
    readonly kind?: string;
    readonly label?: string;
}

export interface ReferenceGraphEdge {
    readonly fromId: string;
    readonly toId: string;
    readonly label?: string;
}

export interface ReferenceGraphData {
    readonly nodes: readonly ReferenceGraphNode[];
    readonly edges: readonly ReferenceGraphEdge[];
}

export interface ReferenceGraphPanelOptions {
    readonly onReferenceSelect?: (id: string) => void;
}

export interface ReferenceGraphPanel {
    render(container: HTMLElement, data: ReferenceGraphData, selectedId?: string): void;
    destroy(): void;
}

const appendSelectableId = (
    container: HTMLElement,
    id: string,
    onReferenceSelect?: (id: string) => void
): void => {
    if (!onReferenceSelect) {
        const span = document.createElement('span');
        span.textContent = id;
        container.appendChild(span);
        return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = id;
    button.addEventListener('click', () => {
        onReferenceSelect(id);
    });
    container.appendChild(button);
};

const appendSectionTitle = (container: HTMLElement, title: string): void => {
    const heading = document.createElement('div');
    heading.textContent = title;
    heading.style.fontWeight = 'bold';
    heading.style.marginTop = '8px';
    container.appendChild(heading);
};

export const createReferenceGraphPanel = (options?: ReferenceGraphPanelOptions): ReferenceGraphPanel => {
    let currentContainer: HTMLElement | null = null;

    return {
        render(container: HTMLElement, data: ReferenceGraphData, selectedId?: string): void {
            currentContainer = container;
            container.textContent = '';

            if (!selectedId) {
                const summary = document.createElement('div');
                summary.textContent = `Nodes: ${data.nodes.length} | Edges: ${data.edges.length}`;
                container.appendChild(summary);

                appendSectionTitle(container, 'All Nodes');
                const nodeList = document.createElement('div');
                for (const node of data.nodes) {
                    const row = document.createElement('div');
                    row.style.padding = '4px 0';
                    appendSelectableId(row, node.id, options?.onReferenceSelect);
                    const nodeLabel = node.label ?? node.kind;
                    if (nodeLabel) {
                        const label = document.createElement('span');
                        label.textContent = ` (${nodeLabel})`;
                        row.appendChild(label);
                    }
                    nodeList.appendChild(row);
                }
                container.appendChild(nodeList);
                return;
            }

            const selectedHeader = document.createElement('div');
            selectedHeader.textContent = 'Selected: ';
            appendSelectableId(selectedHeader, selectedId, options?.onReferenceSelect);
            container.appendChild(selectedHeader);

            const outgoing = data.edges.filter((edge) => edge.fromId === selectedId);
            const incoming = data.edges.filter((edge) => edge.toId === selectedId);

            appendSectionTitle(container, `Outgoing (${outgoing.length})`);
            const outgoingList = document.createElement('div');
            if (outgoing.length === 0) {
                const emptyOutgoing = document.createElement('div');
                emptyOutgoing.textContent = 'None';
                outgoingList.appendChild(emptyOutgoing);
            } else {
                for (const edge of outgoing) {
                    const row = document.createElement('div');
                    row.style.padding = '4px 0';

                    const prefix = document.createElement('span');
                    prefix.textContent = `${edge.fromId} -> `;
                    row.appendChild(prefix);

                    appendSelectableId(row, edge.toId, options?.onReferenceSelect);

                    if (edge.label) {
                        const label = document.createElement('span');
                        label.textContent = ` (${edge.label})`;
                        row.appendChild(label);
                    }
                    outgoingList.appendChild(row);
                }
            }
            container.appendChild(outgoingList);

            appendSectionTitle(container, `Incoming (${incoming.length})`);
            const incomingList = document.createElement('div');
            if (incoming.length === 0) {
                const emptyIncoming = document.createElement('div');
                emptyIncoming.textContent = 'None';
                incomingList.appendChild(emptyIncoming);
            } else {
                for (const edge of incoming) {
                    const row = document.createElement('div');
                    row.style.padding = '4px 0';

                    appendSelectableId(row, edge.fromId, options?.onReferenceSelect);

                    const suffix = document.createElement('span');
                    suffix.textContent = ` -> ${edge.toId}`;
                    row.appendChild(suffix);

                    if (edge.label) {
                        const label = document.createElement('span');
                        label.textContent = ` (${edge.label})`;
                        row.appendChild(label);
                    }
                    incomingList.appendChild(row);
                }
            }
            container.appendChild(incomingList);
        },
        destroy(): void {
            if (currentContainer) {
                currentContainer.textContent = '';
                currentContainer = null;
            }
        }
    };
};
