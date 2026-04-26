import type { DebugEventType, EventDebugEntry } from '../../../game/debug/event_debug_types';

export interface EventTimelinePanelOptions {
    readonly onEntrySelect?: (entry: EventDebugEntry) => void;
}

export interface EventTimelinePanel {
    render(
        container: HTMLElement,
        entries: readonly EventDebugEntry[],
        filter?: {
            readonly source?: string;
            readonly type?: DebugEventType;
        }
    ): void;
    destroy(): void;
}

const formatEntryLabel = (entry: EventDebugEntry): string => {
    const timestamp = new Date(entry.timestampMs).toISOString();
    return `${timestamp} #${entry.id} ${entry.source} ${entry.type}`;
};

const formatEntryDetails = (entry: EventDebugEntry): string => {
    const detailParts: string[] = [];
    if (entry.eventId) {
        detailParts.push(`eventId=${entry.eventId}`);
    }
    if (entry.message) {
        detailParts.push(entry.message);
    }
    return detailParts.join(' | ');
};

const sortByTimestampAndId = (entries: readonly EventDebugEntry[]): EventDebugEntry[] =>
    [...entries].sort((a, b) => {
        if (a.timestampMs !== b.timestampMs) {
            return a.timestampMs - b.timestampMs;
        }
        return a.id - b.id;
    });

export const createEventTimelinePanel = (options?: EventTimelinePanelOptions): EventTimelinePanel => {
    let currentContainer: HTMLElement | null = null;

    return {
        render(
            container: HTMLElement,
            entries: readonly EventDebugEntry[],
            filter?: {
                readonly source?: string;
                readonly type?: DebugEventType;
            }
        ): void {
            currentContainer = container;
            container.textContent = '';

            const filteredEntries = entries.filter((entry) => {
                if (filter?.source && entry.source !== filter.source) {
                    return false;
                }
                if (filter?.type && entry.type !== filter.type) {
                    return false;
                }
                return true;
            });

            const sortedEntries = sortByTimestampAndId(filteredEntries);
            if (sortedEntries.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No entries for current filter.';
                empty.style.padding = '8px';
                container.appendChild(empty);
                return;
            }

            const list = document.createElement('div');
            for (const entry of sortedEntries) {
                const row = document.createElement('div');
                row.style.padding = '6px 8px';
                row.style.borderBottom = '1px solid #d8d8d8';

                const label = document.createElement('div');
                label.textContent = formatEntryLabel(entry);
                row.appendChild(label);

                const details = formatEntryDetails(entry);
                if (details.length > 0) {
                    const detailsElement = document.createElement('div');
                    detailsElement.textContent = details;
                    detailsElement.style.fontSize = '12px';
                    detailsElement.style.opacity = '0.8';
                    row.appendChild(detailsElement);
                }

                if (options?.onEntrySelect) {
                    row.style.cursor = 'pointer';
                    row.tabIndex = 0;
                    row.addEventListener('click', () => {
                        options.onEntrySelect?.(entry);
                    });
                    row.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            options.onEntrySelect?.(entry);
                        }
                    });
                }

                list.appendChild(row);
            }

            container.appendChild(list);
        },
        destroy(): void {
            if (currentContainer) {
                currentContainer.textContent = '';
                currentContainer = null;
            }
        }
    };
};
