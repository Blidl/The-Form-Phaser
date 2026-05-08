import type { EditorMode } from '../core/EditorMode';
import type { ProjectStore } from '../data/ProjectStore';
import type { EditorPanel } from '../ui/EditorPanel';
import {
    getCampaignLevelConfig,
    getCampaignLevelIds,
    getCampaignManifestDiagnostics,
    getInitialCampaignLevelId
} from '../../game/world/runtime/test_campaign_registry';

export class LevelEditorMode implements EditorMode {
    public readonly id = 'level';
    public readonly label = 'Level';
    private readonly projectStore: ProjectStore;
    private readonly getRuntimeLevelMetaId: () => string | null;

    public constructor(projectStore: ProjectStore, getRuntimeLevelMetaId?: () => string | null) {
        this.projectStore = projectStore;
        this.getRuntimeLevelMetaId = getRuntimeLevelMetaId ?? (() => null);
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

        panel.setContent('Level Inspector', [
            'Campaign/Level Manifest v1 (read-only).',
            `Runtime level meta.id: ${runtimeLevelMetaId}`,
            `Campaign/source level id (active): ${runtimeLevelMetaId}`,
            `ProjectStore level id (mirror): ${projectStoreLevel.id}`,
            `Runtime level in manifest: ${runtimeLevelInManifest}`,
            `Manifest initialLevelId: ${campaignInitialLevelId}`,
            `Manifest order: ${campaignLevelOrder}`,
            `Current nextLevelId: ${currentLevelNext}`,
            `Diagnostics: ${manifestDiagnostics.length}`
        ]);
    }

    public renderRightInspector(panel: EditorPanel): void {
        const projectStoreLevel = this.projectStore.getActiveLevel();
        const runtimeLevelMetaId = this.getRuntimeLevelMetaId() ?? projectStoreLevel.id;
        const diagnostics = getCampaignManifestDiagnostics();
        const runtimeLevelDiagnostics = getCampaignLevelIds().includes(runtimeLevelMetaId)
            ? []
            : [`[warning] runtime_level_not_in_manifest: Runtime level meta.id '${runtimeLevelMetaId}' is not listed in campaign manifest ids.`];

        panel.setContent('Level Properties', [
            `Runtime meta.id: ${runtimeLevelMetaId}`,
            `ProjectStore mirror id: ${projectStoreLevel.id}`,
            ...(
                diagnostics.length + runtimeLevelDiagnostics.length > 0
                    ? [
                        ...runtimeLevelDiagnostics,
                        ...diagnostics.map((entry) => `[${entry.severity}] ${entry.code}: ${entry.message}`)
                    ]
                    : ['No campaign manifest diagnostics.']
            )
        ]);
    }
}
