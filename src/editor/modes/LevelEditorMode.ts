import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import type { ProjectStore } from '../data/ProjectStore';
import type { EditorPanel } from '../ui/EditorPanel';
import {
    createCampaignLevel,
    deleteCampaignLevel,
    getCampaignLevelConfig,
    getCampaignLevelIds,
    getCampaignLevelSummaries,
    getCampaignManifestDiagnostics,
    getInitialCampaignLevelId,
    setInitialCampaignLevelId,
    updateCampaignLevelConfig
} from '../../game/world/runtime/test_campaign_registry';
import {
    cloneTestWorldConfig,
    type TestWorldConfig
} from '../../game/world/runtime/test_world_config';

const DEFAULT_LEVEL_CAMERA = {
    enabled: true,
    zoom: 1,
    lerpX: 0.05,
    lerpY: 0.05,
    offsetX: 0,
    offsetY: 96,
    deadzoneWidth: 0,
    deadzoneHeight: 0
} as const;

export class LevelEditorMode implements EditorMode {
    public readonly id = 'level';
    public readonly label = 'Level';
    private readonly projectStore: ProjectStore;
    private readonly getRuntimeLevelMetaId: () => string | null;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly onUiChanged: (() => void) | null;
    private readonly onJumpToLevel: ((levelId: string) => boolean) | null;
    private selectedLevelId: string | null = null;
    private statusMessage: string | null = null;
    private statusIsError = false;

    public constructor(
        projectStore: ProjectStore,
        getRuntimeLevelMetaId?: () => string | null,
        legacyObjectAdapter?: LegacyObjectAdapter | null,
        onUiChanged?: () => void,
        onJumpToLevel?: (levelId: string) => boolean
    ) {
        this.projectStore = projectStore;
        this.getRuntimeLevelMetaId = getRuntimeLevelMetaId ?? (() => null);
        this.legacyObjectAdapter = legacyObjectAdapter ?? null;
        this.onUiChanged = onUiChanged ?? null;
        this.onJumpToLevel = onJumpToLevel ?? null;
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const runtimeLevelId = this.getCurrentRuntimeLevelId();
        const levelSummaries = getCampaignLevelSummaries();
        const selectedLevelId = this.resolveSelectedLevelId(runtimeLevelId);

        panel.setCustomContent('Levels', (container) => {
            container.appendChild(this.makeInfoLine(`Current runtime level: ${runtimeLevelId}`));

            const createButton = this.makeButton('Create Level');
            createButton.addEventListener('click', () => {
                const created = createCampaignLevel();
                this.selectedLevelId = created.meta.id;
                this.statusMessage = `Created ${created.meta.displayName}`;
                this.statusIsError = false;
                this.onUiChanged?.();
            });
            container.appendChild(createButton);

            const deleteButton = this.makeButton('Delete Level');
            deleteButton.disabled = levelSummaries.length <= 1 || !selectedLevelId;
            deleteButton.addEventListener('click', () => {
                if (!selectedLevelId) {
                    return;
                }
                if (levelSummaries.length <= 1) {
                    this.setStatus('Cannot delete the last level.', true);
                    return;
                }
                const selectedSummary = levelSummaries.find((entry) => entry.id === selectedLevelId);
                const confirmed = confirm(`Delete level ${selectedSummary?.displayName ?? selectedLevelId}?`);
                if (!confirmed) {
                    return;
                }
                const result = deleteCampaignLevel(selectedLevelId);
                if (!result) {
                    this.setStatus('Failed to delete level.', true);
                    return;
                }
                this.selectedLevelId = result.switchedToLevelId;
                this.setStatus(
                    result.clearedNextLevelRefs.length > 0
                        ? `Deleted level. Cleared next refs: ${result.clearedNextLevelRefs.join(', ')}`
                        : 'Deleted level.',
                    false
                );
                if (runtimeLevelId === selectedLevelId) {
                    this.onJumpToLevel?.(result.switchedToLevelId);
                }
                this.onUiChanged?.();
            });
            container.appendChild(deleteButton);

            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '6px';
            list.style.marginTop = '10px';

            levelSummaries.forEach((level) => {
                const isSelected = level.id === selectedLevelId;
                const isRuntime = level.id === runtimeLevelId;
                const button = this.makeButton(`${level.displayName}\n${level.id}${isRuntime ? ' (open)' : ''}`);
                button.style.whiteSpace = 'pre-line';
                button.style.textAlign = 'left';
                button.style.background = isSelected ? '#70de63' : '#dcdcdc';
                button.addEventListener('click', () => {
                    this.selectedLevelId = level.id;
                    this.statusMessage = null;
                    this.statusIsError = false;
                    this.onUiChanged?.();
                });
                list.appendChild(button);
            });
            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const runtimeLevelId = this.getCurrentRuntimeLevelId();
        const selectedLevelId = this.resolveSelectedLevelId(runtimeLevelId);
        const selectedConfig = this.getSelectedLevelConfig(selectedLevelId);
        const runtimeConfig = this.getRuntimeLevelConfig(runtimeLevelId);
        const diagnostics = this.collectDiagnostics(runtimeLevelId, selectedConfig?.nextLevelId ?? null);

        panel.setCustomContent('Level Properties', (container) => {
            if (!selectedConfig) {
                container.appendChild(this.makeInfoLine('No level selected.'));
                return;
            }

            const selectedIsRuntime = selectedConfig.meta.id === runtimeLevelId;
            const manifestLevelIds = getCampaignLevelIds();

            container.appendChild(this.makeSectionTitle(selectedConfig.meta.displayName));
            container.appendChild(this.makeInfoLine(`Editing: ${selectedConfig.meta.id}${selectedIsRuntime ? ' (open)' : ''}`));

            if (this.statusMessage) {
                const status = this.makeInfoLine(this.statusMessage);
                status.style.color = this.statusIsError ? '#b00020' : '#145800';
                container.appendChild(status);
            }

            const idInput = this.makeTextInput(selectedConfig.meta.id, true);
            container.appendChild(this.makeField('ID', idInput));

            const nameInput = this.makeTextInput(selectedConfig.meta.displayName, false);
            nameInput.addEventListener('change', () => {
                const nextName = nameInput.value.trim();
                if (!nextName) {
                    nameInput.value = selectedConfig.meta.displayName;
                    this.setStatus('Level name cannot be empty.', true);
                    return;
                }
                const updated = this.updateSelectedLevel(selectedConfig.meta.id, (draft) => {
                    draft.meta.displayName = nextName;
                });
                if (updated) {
                    this.setStatus('Level name updated.', false);
                }
            });
            container.appendChild(this.makeField('Name', nameInput));

            const widthInput = this.makeNumberInput(selectedConfig.worldBounds.width, 64);
            const heightInput = this.makeNumberInput(selectedConfig.worldBounds.height, 64);
            const commitSize = (): void => {
                const width = Math.round(Number(widthInput.value));
                const height = Math.round(Number(heightInput.value));
                if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) {
                    widthInput.value = String(Math.round(selectedConfig.worldBounds.width));
                    heightInput.value = String(Math.round(selectedConfig.worldBounds.height));
                    this.setStatus('Level size must be finite numbers >= 64.', true);
                    return;
                }
                const updated = this.updateSelectedLevel(selectedConfig.meta.id, (draft) => {
                    draft.worldBounds.width = width;
                    draft.worldBounds.height = height;
                });
                if (updated) {
                    this.setStatus(`Level size updated: ${width} x ${height}.`, false);
                }
            };
            widthInput.addEventListener('change', commitSize);
            heightInput.addEventListener('change', commitSize);
            container.appendChild(this.makeField('Width', widthInput));
            container.appendChild(this.makeField('Height', heightInput));

            const cameraConfig = selectedConfig.camera ?? DEFAULT_LEVEL_CAMERA;
            container.appendChild(this.makeSectionTitle('Camera'));

            const cameraEnabledInput = document.createElement('input');
            cameraEnabledInput.type = 'checkbox';
            cameraEnabledInput.checked = cameraConfig.enabled ?? true;
            cameraEnabledInput.addEventListener('change', () => {
                const updated = this.updateSelectedLevel(selectedConfig.meta.id, (draft) => {
                    draft.camera = {
                        ...(draft.camera ?? DEFAULT_LEVEL_CAMERA),
                        enabled: cameraEnabledInput.checked
                    };
                });
                if (updated) {
                    this.setStatus('Camera usage updated.', false);
                }
            });
            container.appendChild(this.makeField('Use level camera', cameraEnabledInput));

            const makeCameraNumberField = (
                label: string,
                initialValue: number,
                min: number,
                step: string,
                apply: (draft: TestWorldConfig, value: number) => void,
                statusLabel: string
            ): void => {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = String(min);
                input.step = step;
                input.value = String(initialValue);
                input.style.width = '100%';
                input.style.boxSizing = 'border-box';
                input.addEventListener('change', () => {
                    const value = Number(input.value);
                    if (!Number.isFinite(value)) {
                        input.value = String(initialValue);
                        this.setStatus(`${label} must be a finite number.`, true);
                        return;
                    }
                    const updated = this.updateSelectedLevel(selectedConfig.meta.id, (draft) => {
                        apply(draft, value);
                    });
                    if (updated) {
                        this.setStatus(statusLabel, false);
                    }
                });
                container.appendChild(this.makeField(label, input));
            };

            makeCameraNumberField('Zoom', cameraConfig.zoom ?? 1, 0.2, '0.05', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), zoom: Math.max(0.2, Math.min(4, value)) };
            }, 'Camera zoom updated.');
            makeCameraNumberField('Lerp X (inertia)', cameraConfig.lerpX ?? 0.18, 0, '0.01', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), lerpX: Math.max(0, Math.min(1, value)) };
            }, 'Camera lerp X updated.');
            makeCameraNumberField('Lerp Y (inertia)', cameraConfig.lerpY ?? 0.18, 0, '0.01', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), lerpY: Math.max(0, Math.min(1, value)) };
            }, 'Camera lerp Y updated.');
            makeCameraNumberField('Offset X', cameraConfig.offsetX ?? 0, -100000, '1', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), offsetX: value };
            }, 'Camera offset X updated.');
            makeCameraNumberField('Offset Y', cameraConfig.offsetY ?? 96, -100000, '1', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), offsetY: value };
            }, 'Camera offset Y updated.');
            makeCameraNumberField('Free Move Window Width', cameraConfig.deadzoneWidth ?? 0, 0, '1', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), deadzoneWidth: Math.max(0, value) };
            }, 'Camera free-move window width updated.');
            makeCameraNumberField('Free Move Window Height', cameraConfig.deadzoneHeight ?? 0, 0, '1', (draft, value) => {
                draft.camera = { ...(draft.camera ?? DEFAULT_LEVEL_CAMERA), deadzoneHeight: Math.max(0, value) };
            }, 'Camera free-move window height updated.');

            const nextSelect = document.createElement('select');
            nextSelect.style.width = '100%';
            nextSelect.style.boxSizing = 'border-box';
            const endOption = document.createElement('option');
            endOption.value = '';
            endOption.textContent = '(end screen)';
            nextSelect.appendChild(endOption);
            getCampaignLevelSummaries().forEach((level) => {
                const option = document.createElement('option');
                option.value = level.id;
                option.textContent = `${level.displayName} (${level.id})`;
                nextSelect.appendChild(option);
            });
            if (selectedConfig.nextLevelId && !manifestLevelIds.includes(selectedConfig.nextLevelId)) {
                const staleOption = document.createElement('option');
                staleOption.value = selectedConfig.nextLevelId;
                staleOption.textContent = `${selectedConfig.nextLevelId} (missing)`;
                nextSelect.appendChild(staleOption);
            }
            nextSelect.value = selectedConfig.nextLevelId ?? '';
            nextSelect.addEventListener('change', () => {
                const nextLevelId = nextSelect.value.trim().length > 0 ? nextSelect.value.trim() : null;
                const updated = this.updateSelectedLevel(selectedConfig.meta.id, (draft) => {
                    draft.nextLevelId = nextLevelId;
                });
                if (updated) {
                    this.setStatus(nextLevelId ? `Next level set to ${nextLevelId}.` : 'Next level set to end screen.', false);
                }
            });
            container.appendChild(this.makeField('Next level', nextSelect));

            const initialSelect = document.createElement('select');
            initialSelect.style.width = '100%';
            initialSelect.style.boxSizing = 'border-box';
            getCampaignLevelSummaries().forEach((level) => {
                const option = document.createElement('option');
                option.value = level.id;
                option.textContent = `${level.displayName} (${level.id})`;
                initialSelect.appendChild(option);
            });
            const currentInitialLevelId = getInitialCampaignLevelId();
            if (!manifestLevelIds.includes(currentInitialLevelId)) {
                const staleOption = document.createElement('option');
                staleOption.value = currentInitialLevelId;
                staleOption.textContent = `${currentInitialLevelId} (missing)`;
                initialSelect.appendChild(staleOption);
            }
            initialSelect.value = currentInitialLevelId;
            initialSelect.addEventListener('change', () => {
                const nextInitialLevelId = initialSelect.value.trim();
                if (!nextInitialLevelId) {
                    return;
                }
                const updated = setInitialCampaignLevelId(nextInitialLevelId);
                if (!updated) {
                    this.setStatus(`Failed to set initial level to ${nextInitialLevelId}.`, true);
                    return;
                }
                this.setStatus(`Initial level set to ${nextInitialLevelId}.`, false);
            });
            container.appendChild(this.makeField('Initial level', initialSelect));

            const openRow = document.createElement('div');
            openRow.style.display = 'flex';
            openRow.style.gap = '6px';
            openRow.style.marginTop = '8px';
            const openButton = this.makeButton('Open Level');
            openButton.disabled = selectedIsRuntime || this.onJumpToLevel === null;
            openButton.addEventListener('click', () => {
                const accepted = this.onJumpToLevel?.(selectedConfig.meta.id) ?? false;
                if (accepted) {
                    openButton.disabled = true;
                    this.setStatus(`Opening ${selectedConfig.meta.id}...`, false);
                }
            });
            const saveButton = this.makeButton('Save Draft');
            saveButton.addEventListener('click', () => {
                const config = selectedIsRuntime ? runtimeConfig : selectedConfig;
                const result = selectedIsRuntime
                    ? this.legacyObjectAdapter?.saveRuntimeConfig()
                    : null;
                if (selectedIsRuntime && result?.success) {
                    this.setStatus('Saved open level draft.', false);
                    this.onUiChanged?.();
                    return;
                }
                if (!selectedIsRuntime) {
                    this.setStatus('Stored in editor campaign registry. Open level, then Save Draft to write runtime draft.', false);
                    this.onUiChanged?.();
                    return;
                }
                this.setStatus(config ? 'Save failed.' : 'Runtime config unavailable.', true);
            });
            openRow.append(openButton, saveButton);
            container.appendChild(openRow);

            const hint = this.makeInfoLine('Created levels are stored in the editor campaign registry and are available in Open Level and Next level selectors.');
            hint.style.marginTop = '8px';
            container.appendChild(hint);

            if (diagnostics.length > 0) {
                container.appendChild(this.makeSectionTitle('Diagnostics'));
                diagnostics.forEach((entry) => {
                    container.appendChild(this.makeInfoLine(entry));
                });
            }
        });
    }

    private getCurrentRuntimeLevelId(): string {
        return this.getRuntimeLevelMetaId() ?? this.projectStore.getActiveLevel().id;
    }

    private resolveSelectedLevelId(runtimeLevelId: string): string {
        const levelIds = getCampaignLevelIds();
        if (this.selectedLevelId && levelIds.includes(this.selectedLevelId)) {
            return this.selectedLevelId;
        }
        const fallback = levelIds.includes(runtimeLevelId) ? runtimeLevelId : (levelIds[0] ?? runtimeLevelId);
        this.selectedLevelId = fallback;
        return fallback;
    }

    private getSelectedLevelConfig(levelId: string): TestWorldConfig | null {
        if (!getCampaignLevelIds().includes(levelId)) {
            return null;
        }
        return getCampaignLevelConfig(levelId);
    }

    private getRuntimeLevelConfig(runtimeLevelMetaId: string): TestWorldConfig | null {
        if (this.legacyObjectAdapter?.getLevelId() !== runtimeLevelMetaId) {
            return null;
        }
        const runtimeConfig = this.legacyObjectAdapter.getRuntimeConfig();
        if (!runtimeConfig || typeof runtimeConfig !== 'object') {
            return null;
        }
        return runtimeConfig as TestWorldConfig;
    }

    private updateSelectedLevel(levelId: string, edit: (draft: TestWorldConfig) => void): TestWorldConfig | null {
        const runtimeLevelId = this.getCurrentRuntimeLevelId();
        const runtimeConfig = this.getRuntimeLevelConfig(runtimeLevelId);
        if (levelId === runtimeLevelId && runtimeConfig && this.legacyObjectAdapter) {
            const nextConfig = cloneTestWorldConfig(runtimeConfig);
            edit(nextConfig);
            const importResult = this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
            if (!importResult?.success) {
                this.setStatus(importResult?.reason ?? 'Failed to update open level.', true);
                return null;
            }
            updateCampaignLevelConfig(levelId, (draft) => {
                const synced = cloneTestWorldConfig(nextConfig);
                synced.meta.id = draft.meta.id;
                Object.assign(draft, synced);
                draft.meta.id = levelId;
            });
            this.onUiChanged?.();
            return nextConfig;
        }

        const updated = updateCampaignLevelConfig(levelId, edit);
        if (!updated) {
            this.setStatus('Failed to update selected level.', true);
            return null;
        }
        this.onUiChanged?.();
        return updated;
    }

    private collectDiagnostics(runtimeLevelMetaId: string, nextLevelId: string | null): string[] {
        const diagnostics = getCampaignManifestDiagnostics().map((entry) => `[${entry.severity}] ${entry.code}: ${entry.message}`);
        if (!getCampaignLevelIds().includes(runtimeLevelMetaId)) {
            diagnostics.unshift(
                `[warning] runtime_level_not_in_manifest: Runtime level meta.id '${runtimeLevelMetaId}' is not listed in campaign manifest ids.`
            );
        }
        if (nextLevelId && !getCampaignLevelIds().includes(nextLevelId)) {
            diagnostics.unshift(
                `[warning] runtime_next_level_not_in_manifest: nextLevelId '${nextLevelId}' is not listed in campaign level ids.`
            );
        }
        return diagnostics;
    }

    private setStatus(message: string, isError: boolean): void {
        this.statusMessage = message;
        this.statusIsError = isError;
        this.onUiChanged?.();
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const title = document.createElement('div');
        title.textContent = text;
        title.style.fontWeight = 'bold';
        title.style.margin = '10px 0 6px';
        return title;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.marginBottom = '6px';
        line.style.wordBreak = 'break-word';
        return line;
    }

    private makeButton(text: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.width = '100%';
        button.style.marginBottom = '6px';
        button.style.border = '1px solid #707070';
        button.style.background = '#dcdcdc';
        button.style.color = '#222';
        button.style.padding = '6px 8px';
        button.style.cursor = 'pointer';
        return button;
    }

    private makeTextInput(value: string, disabled: boolean): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.disabled = disabled;
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        return input;
    }

    private makeNumberInput(value: number, min: number): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = String(min);
        input.step = '1';
        input.value = String(Math.round(value));
        input.style.width = '100%';
        input.style.boxSizing = 'border-box';
        return input;
    }

    private makeField(labelText: string, control: HTMLElement): HTMLDivElement {
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '8px';
        const label = document.createElement('label');
        label.textContent = labelText;
        label.style.display = 'block';
        label.style.fontWeight = 'bold';
        label.style.marginBottom = '4px';
        wrap.append(label, control);
        return wrap;
    }
}
