import {
    PLAYER_TUNING_TAB_MAP,
    PLAYER_TUNING_TABS,
    type PlayerTuningFieldSchema
} from '../../game/player/tuning/player_tuning_schema';
import { createPlayerTuningDefaultsSnapshot } from '../../game/player/tuning/player_tuning_defaults';
import type { PlayerTuningSnapshot, PlayerTuningTabId } from '../../game/player/tuning/player_tuning_types';

export interface PlayerTuningSidebarState {
    visible: boolean;
    activeTabId: PlayerTuningTabId;
    snapshot: PlayerTuningSnapshot;
    status: string;
    isSaving: boolean;
    isDirty: boolean;
}

export interface PlayerTuningSidebarCallbacks {
    onSelectTab: (tabId: PlayerTuningTabId) => void;
    onChangeField: (fieldId: string, value: number) => void;
    onSaveToProject: () => void;
    onRevertUnsaved: () => void;
    onResetToDefaults: () => void;
}

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

export class PlayerTuningSidebar {
    private readonly root: HTMLDivElement;
    private readonly fieldMap = new Map<string, PlayerTuningFieldSchema>();
    private readonly openDetails = new Set<string>();
    private state: PlayerTuningSidebarState = {
        visible: false,
        activeTabId: 'common',
        snapshot: createPlayerTuningDefaultsSnapshot(),
        status: '',
        isSaving: false,
        isDirty: false
    };

    public constructor(parent: HTMLElement, private readonly callbacks: PlayerTuningSidebarCallbacks) {
        this.root = document.createElement('div');
        this.root.id = 'player-tuning-sidebar';
        this.root.className = 'player-tuning player-tuning--hidden';
        parent.appendChild(this.root);

        PLAYER_TUNING_TABS.forEach((tab) => {
            tab.sections.forEach((section) => {
                section.fields.forEach((field) => {
                    this.fieldMap.set(field.id, field);
                });
                section.rawFields.forEach((field) => {
                    this.fieldMap.set(field.id, field);
                });
            });
        });

        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('change', this.handleChange);
        this.root.addEventListener('toggle', this.handleToggle, true);
        this.render();
    }

    public setState(nextState: PlayerTuningSidebarState): void {
        this.state = nextState;
        this.render();
    }

    public getRootElement(): HTMLElement {
        return this.root;
    }

    public destroy(): void {
        this.root.removeEventListener('click', this.handleClick);
        this.root.removeEventListener('change', this.handleChange);
        this.root.removeEventListener('toggle', this.handleToggle, true);
        this.root.remove();
    }

    private readonly handleClick = (event: Event): void => {
        const target = event.target as HTMLElement | null;
        const action = target?.closest<HTMLElement>('[data-tuning-action]')?.dataset.tuningAction;
        if (action === 'save') {
            this.callbacks.onSaveToProject();
            return;
        }
        if (action === 'revert') {
            this.callbacks.onRevertUnsaved();
            return;
        }
        if (action === 'reset') {
            this.callbacks.onResetToDefaults();
            return;
        }

        const tabId = target?.closest<HTMLElement>('[data-tuning-tab-id]')?.dataset.tuningTabId;
        if (tabId && PLAYER_TUNING_TAB_MAP.has(tabId as PlayerTuningTabId)) {
            this.callbacks.onSelectTab(tabId as PlayerTuningTabId);
        }
    };

    private readonly handleChange = (event: Event): void => {
        const target = event.target as HTMLInputElement | null;
        const fieldId = target?.dataset.tuningFieldId;
        if (!target || !fieldId) {
            return;
        }

        const parsedValue = Number(target.value);
        if (!Number.isFinite(parsedValue)) {
            return;
        }
        this.callbacks.onChangeField(fieldId, parsedValue);
    };

    private readonly handleToggle = (event: Event): void => {
        const details = event.target as HTMLDetailsElement | null;
        const detailsId = details?.dataset.tuningDetailsId;
        if (!details || !detailsId) {
            return;
        }

        if (details.open) {
            this.openDetails.add(detailsId);
            return;
        }
        this.openDetails.delete(detailsId);
    };

    private render(): void {
        const state = this.state;
        const activeTab = PLAYER_TUNING_TAB_MAP.get(state.activeTabId) ?? PLAYER_TUNING_TABS[0];
        this.root.classList.toggle('player-tuning--hidden', !state.visible);

        const tabsMarkup = PLAYER_TUNING_TABS.map((tab) => {
            const className = tab.id === state.activeTabId
                ? 'player-tuning__tab is-active'
                : 'player-tuning__tab';
            return `<button type="button" class="${className}" data-tuning-tab-id="${tab.id}">${escapeHtml(tab.title)}</button>`;
        }).join('');

        const sectionsMarkup = activeTab.sections.map((section) => {
            const fieldsMarkup = section.fields.map((field) => this.renderField(field)).join('');
            const rawMarkup = section.rawFields.map((field) => this.renderField(field)).join('');
            const detailsId = `${section.id}-raw`;
            const isOpen = this.openDetails.has(detailsId) ? 'open' : '';
            return `
                <section class="player-tuning__section">
                    <h3>${escapeHtml(section.title)}</h3>
                    <div class="player-tuning__fields">${fieldsMarkup}</div>
                    <details class="player-tuning__details" data-tuning-details-id="${detailsId}" ${isOpen}>
                        <summary>Advanced Raw</summary>
                        <div class="player-tuning__fields player-tuning__fields--raw">${rawMarkup}</div>
                    </details>
                </section>
            `;
        }).join('');

        this.root.innerHTML = `
            <div class="player-tuning__inner">
                <section class="player-tuning__section">
                    <h2>Player Tuning</h2>
                    <div class="player-tuning__toolbar">
                        <button type="button" class="player-tuning__button" data-tuning-action="save" ${state.isSaving ? 'disabled' : ''}>Save to Project</button>
                        <button type="button" class="player-tuning__button" data-tuning-action="revert">Revert Unsaved</button>
                        <button type="button" class="player-tuning__button" data-tuning-action="reset">Reset to Defaults</button>
                    </div>
                    <div class="player-tuning__status-row">
                        <span class="player-tuning__status">${escapeHtml(state.status || 'Ready')}</span>
                        <span class="player-tuning__status">${state.isDirty ? 'Unsaved draft' : 'Draft matches persisted'}</span>
                    </div>
                </section>
                <section class="player-tuning__section">
                    <div class="player-tuning__tabs">${tabsMarkup}</div>
                </section>
                ${sectionsMarkup}
            </div>
        `;
    }

    private renderField(field: PlayerTuningFieldSchema): string {
        const value = field.read(this.state.snapshot);
        const min = typeof field.min === 'number' ? `min="${field.min}"` : '';
        const max = typeof field.max === 'number' ? `max="${field.max}"` : '';
        const step = typeof field.step === 'number' ? `step="${field.step}"` : '';

        return `
            <label class="player-tuning__field">
                <span>${escapeHtml(field.label)} <small>${escapeHtml(field.unit)}</small></span>
                <input
                    type="number"
                    value="${Number.isFinite(value) ? value : 0}"
                    data-tuning-field-id="${field.id}"
                    ${min}
                    ${max}
                    ${step}
                />
            </label>
        `;
    }
}
