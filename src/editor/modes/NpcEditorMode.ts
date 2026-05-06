import type { EditorMode } from '../core/EditorMode';
import type { LegacyObjectAdapter } from '../bridge/LegacyObjectAdapter';
import { LogicAuthoringService } from '../logic-authoring/LogicAuthoringService';
import type { EditorPanel } from '../ui/EditorPanel';
import type {
    TestWorldConfig,
    TestWorldLogicBindingConfig
} from '../../game/world/runtime/test_world_config';
import type { TestNpcInstanceConfig } from '../../game/npc/npc_types';

interface NpcEditorModeOptions {
    legacyObjectAdapter: LegacyObjectAdapter | null;
    onUiChanged: () => void;
}

export class NpcEditorMode implements EditorMode {
    public readonly id = 'npc';
    public readonly label = 'NPC';

    private readonly legacyObjectAdapter: LegacyObjectAdapter | null;
    private readonly logicAuthoringService: LogicAuthoringService;
    private readonly onUiChanged: () => void;
    private selectedNpcId: string | null = null;
    private lastSnapshotSignature: string | null = null;

    public constructor(options: NpcEditorModeOptions) {
        this.legacyObjectAdapter = options.legacyObjectAdapter;
        this.logicAuthoringService = new LogicAuthoringService(options.legacyObjectAdapter);
        this.onUiChanged = options.onUiChanged;
    }

    public enter(): void {
        this.lastSnapshotSignature = this.readSnapshotSignature();
    }

    public update(): void {
        const nextSignature = this.readSnapshotSignature();
        if (nextSignature === this.lastSnapshotSignature) {
            return;
        }
        this.lastSnapshotSignature = nextSignature;
        this.syncSelectedNpc(this.getCurrentNpcs());
        this.onUiChanged();
    }

    public renderLeftInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const npcs = runtimeConfig?.npcs ?? [];
        this.syncSelectedNpc(npcs);

        panel.setCustomContent('NPCs', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            container.appendChild(this.makeInfoLine(`Count: ${npcs.length}`));
            if (npcs.length <= 0) {
                container.appendChild(this.makeSpacer(8));
                container.appendChild(this.makeInfoLine('No NPCs in this level.'));
                return;
            }

            container.appendChild(this.makeSpacer(8));
            const list = document.createElement('div');
            list.style.display = 'grid';
            list.style.gap = '6px';

            npcs.forEach((npc) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.style.width = '100%';
                button.style.textAlign = 'left';
                button.style.border = '1px solid #7a7a7a';
                button.style.padding = '6px';
                button.style.cursor = 'pointer';
                button.style.background = npc.id === this.selectedNpcId ? '#9ec9ff' : '#e8e8e8';
                button.style.fontFamily = 'inherit';
                button.style.fontSize = '12px';

                const idLine = document.createElement('div');
                idLine.style.fontWeight = 'bold';
                idLine.textContent = npc.id;

                const profileLine = document.createElement('div');
                profileLine.textContent = `profile: ${npc.profileId}`;

                button.append(idLine, profileLine);
                button.addEventListener('click', () => {
                    if (this.selectedNpcId === npc.id) {
                        return;
                    }
                    this.selectedNpcId = npc.id;
                    this.onUiChanged();
                });

                list.appendChild(button);
            });

            container.appendChild(list);
        });
    }

    public renderRightInspector(panel: EditorPanel): void {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        const npcs = runtimeConfig?.npcs ?? [];
        const selectedNpc = this.syncSelectedNpc(npcs);

        panel.setCustomContent('NPC Inspector', (container) => {
            if (!runtimeConfig) {
                container.appendChild(this.makeInfoLine('Runtime config unavailable.'));
                return;
            }

            if (!selectedNpc) {
                container.appendChild(this.makeInfoLine('Select an NPC to inspect.'));
                return;
            }

            container.appendChild(this.makeSectionTitle('Selected NPC'));
            container.appendChild(this.makeKeyValueLine('id', selectedNpc.id));
            container.appendChild(this.makeKeyValueLine('profileId', selectedNpc.profileId));
            container.appendChild(this.makeKeyValueLine('position', `${selectedNpc.x}, ${selectedNpc.y}`));
            container.appendChild(this.makeKeyValueLine('facing', selectedNpc.facing ?? '-'));
            container.appendChild(this.makeKeyValueLine('initialManpuEmotionId', this.formatNullableString(selectedNpc.initialManpuEmotionId)));
            container.appendChild(this.makeKeyValueLine('scriptedLoopRef', this.formatNullableString(selectedNpc.scriptedLoopRef)));
            container.appendChild(this.makeKeyValueLine('playerBodyContactMode', selectedNpc.playerBodyContactMode ?? '-'));
            container.appendChild(this.makeKeyValueLine('visualLayer', selectedNpc.visualLayer ?? '-'));
            container.appendChild(this.makeKeyValueLine(
                'renderOrder',
                Number.isFinite(selectedNpc.renderOrder) ? String(selectedNpc.renderOrder) : '-'
            ));

            if (selectedNpc.behavior) {
                container.appendChild(this.makeKeyValueLine(
                    'behavior overrides',
                    String(Object.keys(selectedNpc.behavior).length)
                ));
            }

            container.appendChild(this.makeSpacer(10));
            container.appendChild(this.makeSectionTitle('Logic Actions'));

            const bindings = this.listNpcBindings(selectedNpc.id);
            if (bindings.length <= 0) {
                container.appendChild(this.makeInfoLine('No logic bindings for this NPC.'));
                return;
            }

            const bindingsList = document.createElement('div');
            bindingsList.style.display = 'grid';
            bindingsList.style.gap = '8px';

            bindings.forEach((binding) => {
                const card = document.createElement('div');
                card.style.border = '1px solid #7a7a7a';
                card.style.background = '#e8e8e8';
                card.style.padding = '6px';
                card.appendChild(this.makeKeyValueLine('id', binding.id));
                card.appendChild(this.makeKeyValueLine('slot', binding.slot));
                card.appendChild(this.makeKeyValueLine('scriptId', binding.scriptId));
                card.appendChild(this.makeKeyValueLine('status', binding.enabled === false ? 'disabled' : 'enabled'));
                card.appendChild(this.makeKeyValueLine('runtime', 'not supported for NPC slots yet'));
                bindingsList.appendChild(card);
            });

            container.appendChild(bindingsList);
        });
    }

    private getCurrentRuntimeConfig(): TestWorldConfig | null {
        const config = this.legacyObjectAdapter?.getRuntimeConfig() as TestWorldConfig | null;
        if (!config || typeof config !== 'object') {
            return null;
        }
        if (!config.meta || !config.worldBounds || !Array.isArray(config.npcs)) {
            return null;
        }
        return config;
    }

    private getCurrentNpcs(): TestNpcInstanceConfig[] {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        return runtimeConfig?.npcs ?? [];
    }

    private listNpcBindings(npcId: string): TestWorldLogicBindingConfig[] {
        return this.logicAuthoringService.listBindingsForTarget('npc', npcId);
    }

    private syncSelectedNpc(npcs: TestNpcInstanceConfig[]): TestNpcInstanceConfig | null {
        if (!this.selectedNpcId) {
            return null;
        }
        const selectedNpc = npcs.find((entry) => entry.id === this.selectedNpcId) ?? null;
        if (selectedNpc) {
            return selectedNpc;
        }
        this.selectedNpcId = null;
        return null;
    }

    private readSnapshotSignature(): string | null {
        const runtimeConfig = this.getCurrentRuntimeConfig();
        if (!runtimeConfig) {
            return null;
        }
        try {
            return JSON.stringify({
                npcs: runtimeConfig.npcs,
                logicBindings: runtimeConfig.logic?.bindings ?? []
            });
        } catch {
            return String(runtimeConfig.npcs.length);
        }
    }

    private makeSectionTitle(text: string): HTMLDivElement {
        const element = document.createElement('div');
        element.style.fontWeight = 'bold';
        element.style.marginBottom = '6px';
        element.textContent = text;
        return element;
    }

    private makeInfoLine(text: string): HTMLDivElement {
        const element = document.createElement('div');
        element.textContent = text;
        return element;
    }

    private makeKeyValueLine(key: string, value: string): HTMLDivElement {
        const element = document.createElement('div');
        element.style.display = 'flex';
        element.style.gap = '6px';

        const keyNode = document.createElement('span');
        keyNode.style.fontWeight = 'bold';
        keyNode.textContent = `${key}:`;

        const valueNode = document.createElement('span');
        valueNode.textContent = value;

        element.append(keyNode, valueNode);
        return element;
    }

    private makeSpacer(heightPx: number): HTMLDivElement {
        const spacer = document.createElement('div');
        spacer.style.height = `${heightPx}px`;
        return spacer;
    }

    private formatNullableString(value: string | null | undefined): string {
        if (value === null) {
            return 'null';
        }
        return value?.trim().length ? value : '-';
    }
}
