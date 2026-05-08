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

    public constructor(
        projectStore: ProjectStore,
        getRuntimeLevelMetaId?: () => string | null,
        legacyObjectAdapter?: LegacyObjectAdapter | null,
        onUiChanged?: () => void
    ) {
        this.projectStore = projectStore;
        this.getRuntimeLevelMetaId = getRuntimeLevelMetaId ?? (() => null);
        this.legacyObjectAdapter = legacyObjectAdapter ?? null;
        this.onUiChanged = onUiChanged ?? null;
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
