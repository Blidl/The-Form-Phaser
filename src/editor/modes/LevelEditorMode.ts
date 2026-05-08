import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import type { ProjectStore } from '../data/ProjectStore';
import type { EditorPanel } from '../ui/EditorPanel';
import {
    getCampaignLevelConfig,
    getCampaignLevelIds,
    getCampaignManifestDiagnostics,
    getInitialCampaignLevelId
} from '../../game/world/runtime/test_campaign_registry';
import {
    cloneTestWorldConfig,
    type TestWorldConfig
} from '../../game/world/runtime/test_world_config';

export class LevelEditorMode implements EditorMode {
    public readonly id = 'level';
    public readonly label = 'Level';
    private readonly projectStore: ProjectStore;
    private readonly getRuntimeLevelMetaId: () => string | null;
    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly onUiChanged: (() => void) | null;
    private readonly onJumpToLevel: ((levelId: string) => boolean) | null;
    private levelSizeStatusMessage: string | null = null;

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
        const projectStoreLevel = this.projectStore.getActiveLevel();
        const runtimeLevelMetaId = this.getRuntimeLevelMetaId() ?? projectStoreLevel.id;
        const campaignLevelIds = getCampaignLevelIds();
        const campaignInitialLevelId = getInitialCampaignLevelId();
        const campaignLevelOrder = campaignLevelIds.length > 0 ? campaignLevelIds.join(' -> ') : '(none)';
        const manifestDiagnostics = getCampaignManifestDiagnostics();
        const currentLevelConfig = campaignLevelIds.includes(runtimeLevelMetaId)
            ? getCampaignLevelConfig(runtimeLevelMetaId)
            : null;
        const currentLevelNext = currentLevelConfig?.nextLevelId ?? 'null';
        const runtimeLevelInManifest = campaignLevelIds.includes(runtimeLevelMetaId) ? 'yes' : 'no';
        const currentRuntimeConfig = this.getRuntimeLevelConfig(runtimeLevelMetaId);
        const runtimeCurrentNext = currentRuntimeConfig?.nextLevelId ?? null;

        panel.setContent('Level Inspector', [
            'Campaign/Level Manifest v1.',
            `Runtime level meta.id: ${runtimeLevelMetaId}`,
            `Campaign/source level id (active): ${runtimeLevelMetaId}`,
            `ProjectStore level id (mirror): ${projectStoreLevel.id}`,
            `Runtime level in manifest: ${runtimeLevelInManifest}`,
            `Manifest initialLevelId: ${campaignInitialLevelId}`,
            `Manifest order: ${campaignLevelOrder}`,
            `Runtime current nextLevelId: ${runtimeCurrentNext ?? 'null'}`,
            `Manifest level nextLevelId: ${currentLevelNext}`,
            `Diagnostics: ${manifestDiagnostics.length}`
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        const projectStoreLevel = this.projectStore.getActiveLevel();
        const runtimeLevelMetaId = this.getRuntimeLevelMetaId() ?? projectStoreLevel.id;
        const manifestLevelIds = getCampaignLevelIds();
        const runtimeConfig = this.getRuntimeLevelConfig(runtimeLevelMetaId);
        const selectedNextLevelId = runtimeConfig?.nextLevelId ?? null;
        const diagnostics = this.collectDiagnostics(runtimeLevelMetaId, selectedNextLevelId);

        panel.setCustomContent('Level Properties', (container) => {
            const makeInfo = (text: string): HTMLDivElement => {
                const line = document.createElement('div');
                line.textContent = text;
                line.style.marginBottom = '6px';
                line.style.wordBreak = 'break-word';
                return line;
            };

            const makeLabel = (text: string): HTMLLabelElement => {
                const label = document.createElement('label');
                label.textContent = text;
                label.style.display = 'block';
                label.style.fontWeight = 'bold';
                label.style.marginBottom = '4px';
                return label;
            };

            container.appendChild(makeInfo(`Runtime meta.id: ${runtimeLevelMetaId}`));
            container.appendChild(makeInfo(`ProjectStore mirror id: ${projectStoreLevel.id}`));
            container.appendChild(makeInfo(`Current runtime nextLevelId: ${selectedNextLevelId ?? 'null (end screen)'}`));
            container.appendChild(makeInfo(`Manifest levels: ${manifestLevelIds.length > 0 ? manifestLevelIds.join(', ') : '(none)'}`));

            const runtimeWorldBounds = runtimeConfig?.worldBounds ?? null;
            const widthValue = Number.isFinite(runtimeWorldBounds?.width) ? String(Math.round(runtimeWorldBounds.width)) : '';
            const heightValue = Number.isFinite(runtimeWorldBounds?.height) ? String(Math.round(runtimeWorldBounds.height)) : '';

            const worldSizeTitle = makeLabel('Level size');
            container.appendChild(worldSizeTitle);

            const worldSizeRow = document.createElement('div');
            worldSizeRow.style.display = 'flex';
            worldSizeRow.style.flexDirection = 'column';
            worldSizeRow.style.gap = '4px';
            worldSizeRow.style.marginBottom = '8px';
            worldSizeRow.style.minWidth = '0';

            const widthLabel = makeLabel('Width');
            widthLabel.htmlFor = 'level-size-width-input';
            widthLabel.style.marginBottom = '0';

            const widthInput = document.createElement('input');
            widthInput.id = 'level-size-width-input';
            widthInput.type = 'number';
            widthInput.min = '64';
            widthInput.step = '1';
            widthInput.value = widthValue;
            widthInput.disabled = runtimeConfig === null;
            widthInput.setAttribute('aria-label', 'Level width');
            widthInput.style.width = '100%';
            widthInput.style.boxSizing = 'border-box';
            widthInput.style.minWidth = '0';

            const heightLabel = makeLabel('Height');
            heightLabel.htmlFor = 'level-size-height-input';
            heightLabel.style.marginBottom = '0';

            const heightInput = document.createElement('input');
            heightInput.id = 'level-size-height-input';
            heightInput.type = 'number';
            heightInput.min = '64';
            heightInput.step = '1';
            heightInput.value = heightValue;
            heightInput.disabled = runtimeConfig === null;
            heightInput.setAttribute('aria-label', 'Level height');
            heightInput.style.width = '100%';
            heightInput.style.boxSizing = 'border-box';
            heightInput.style.minWidth = '0';

            worldSizeRow.append(widthLabel, widthInput, heightLabel, heightInput);
            container.appendChild(worldSizeRow);

            const levelSizeStatusLine = makeInfo(this.levelSizeStatusMessage ?? ' ');
            levelSizeStatusLine.style.minHeight = '18px';
            levelSizeStatusLine.style.color = '#9fe870';
            container.appendChild(levelSizeStatusLine);

            const commitWorldSize = (): void => {
                if (!runtimeConfig) {
                    return;
                }
                const parsedWidth = Number(widthInput.value);
                const parsedHeight = Number(heightInput.value);
                const nextWidth = Math.round(parsedWidth);
                const nextHeight = Math.round(parsedHeight);
                if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight) || nextWidth < 64 || nextHeight < 64) {
                    this.levelSizeStatusMessage = 'Level size must be finite numbers >= 64.';
                    levelSizeStatusLine.textContent = this.levelSizeStatusMessage;
                    levelSizeStatusLine.style.color = '#ff8a80';
                    widthInput.value = widthValue;
                    heightInput.value = heightValue;
                    return;
                }
                const applied = this.applyWorldBounds(runtimeLevelMetaId, nextWidth, nextHeight);
                if (!applied) {
                    this.levelSizeStatusMessage = 'Unable to update level size in runtime config.';
                    levelSizeStatusLine.textContent = this.levelSizeStatusMessage;
                    levelSizeStatusLine.style.color = '#ff8a80';
                    widthInput.value = widthValue;
                    heightInput.value = heightValue;
                    return;
                }
                this.levelSizeStatusMessage = `Applied level size: ${nextWidth} x ${nextHeight}`;
                levelSizeStatusLine.textContent = this.levelSizeStatusMessage;
                levelSizeStatusLine.style.color = '#9fe870';
            };

            widthInput.addEventListener('blur', commitWorldSize);
            heightInput.addEventListener('blur', commitWorldSize);
            widthInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    commitWorldSize();
                }
            });
            heightInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    commitWorldSize();
                }
            });

            const selectLabel = makeLabel('Next level');
            selectLabel.htmlFor = 'level-next-level-id-select';
            container.appendChild(selectLabel);

            const select = document.createElement('select');
            select.id = 'level-next-level-id-select';
            select.style.width = '100%';
            select.style.marginBottom = '10px';
            select.style.boxSizing = 'border-box';

            const endOption = document.createElement('option');
            endOption.value = '';
            endOption.textContent = '(end screen)';
            select.appendChild(endOption);

            manifestLevelIds.forEach((levelId) => {
                const option = document.createElement('option');
                option.value = levelId;
                option.textContent = levelId;
                select.appendChild(option);
            });

            if (selectedNextLevelId && !manifestLevelIds.includes(selectedNextLevelId)) {
                const staleOption = document.createElement('option');
                staleOption.value = selectedNextLevelId;
                staleOption.textContent = `${selectedNextLevelId} (missing in manifest)`;
                select.appendChild(staleOption);
            }

            select.value = selectedNextLevelId ?? '';
            select.disabled = runtimeConfig === null;
            select.addEventListener('change', () => {
                const nextValue = select.value.trim();
                const nextLevelId = nextValue.length > 0 ? nextValue : null;
                this.applyNextLevelId(runtimeLevelMetaId, nextLevelId);
            });
            container.appendChild(select);

            const jumpLabel = makeLabel('Jump to level');
            jumpLabel.htmlFor = 'level-jump-level-id-select';
            container.appendChild(jumpLabel);

            const jumpRow = document.createElement('div');
            jumpRow.style.display = 'flex';
            jumpRow.style.gap = '6px';
            jumpRow.style.marginBottom = '6px';

            const jumpSelect = document.createElement('select');
            jumpSelect.id = 'level-jump-level-id-select';
            jumpSelect.style.flex = '1';
            manifestLevelIds.forEach((levelId) => {
                const option = document.createElement('option');
                option.value = levelId;
                option.textContent = levelId;
                jumpSelect.appendChild(option);
            });
            jumpSelect.value = manifestLevelIds.includes(runtimeLevelMetaId)
                ? runtimeLevelMetaId
                : (manifestLevelIds[0] ?? '');

            const jumpButton = document.createElement('button');
            jumpButton.type = 'button';
            jumpButton.textContent = 'Load';
            jumpButton.disabled = manifestLevelIds.length === 0 || this.onJumpToLevel === null;
            jumpButton.addEventListener('click', () => {
                const targetLevelId = jumpSelect.value.trim();
                if (!targetLevelId || !manifestLevelIds.includes(targetLevelId)) {
                    return;
                }
                const accepted = this.onJumpToLevel?.(targetLevelId) ?? false;
                if (accepted) {
                    jumpButton.disabled = true;
                    jumpSelect.disabled = true;
                }
            });

            jumpRow.append(jumpSelect, jumpButton);
            container.appendChild(jumpRow);
            container.appendChild(makeInfo('Switching level reloads runtime state. Save Draft first to keep unsaved changes.'));

            if (diagnostics.length > 0) {
                diagnostics.forEach((entry) => {
                    container.appendChild(makeInfo(entry));
                });
            } else {
                container.appendChild(makeInfo('No campaign manifest diagnostics.'));
            }
        });
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

    private applyNextLevelId(runtimeLevelMetaId: string, nextLevelId: string | null): void {
        const runtimeConfig = this.getRuntimeLevelConfig(runtimeLevelMetaId);
        if (!runtimeConfig || !this.legacyObjectAdapter) {
            return;
        }
        if ((runtimeConfig.nextLevelId ?? null) === nextLevelId) {
            return;
        }
        const nextConfig = cloneTestWorldConfig(runtimeConfig);
        nextConfig.nextLevelId = nextLevelId;
        this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        this.onUiChanged?.();
    }

    private applyWorldBounds(runtimeLevelMetaId: string, width: number, height: number): boolean {
        const runtimeConfig = this.getRuntimeLevelConfig(runtimeLevelMetaId);
        if (!runtimeConfig || !this.legacyObjectAdapter || !runtimeConfig.worldBounds) {
            return false;
        }
        if (runtimeConfig.worldBounds.width === width && runtimeConfig.worldBounds.height === height) {
            return true;
        }
        const nextConfig = cloneTestWorldConfig(runtimeConfig);
        nextConfig.worldBounds.width = width;
        nextConfig.worldBounds.height = height;
        const result = this.legacyObjectAdapter.importRuntimeConfig(nextConfig, { mode: 'runtime_patch' });
        if (!result?.success) {
            return false;
        }
        this.onUiChanged?.();
        return true;
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
                `[warning] runtime_next_level_not_in_manifest: nextLevelId '${nextLevelId}' is not listed in campaign manifest ids.`
            );
        }
        return diagnostics;
    }
}
