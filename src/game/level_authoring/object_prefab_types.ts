import type { LevelAuthoringTransform } from './motion_path_types';

export type PrefabComponentKind =
  | 'collision'
  | 'render'
  | 'trigger'
  | 'npc'
  | 'platform'
  | 'motion_path'
  | 'camera'
  | 'custom';

export interface PrefabComponent {
  readonly id: string;
  readonly kind: PrefabComponentKind;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface ObjectPrefabVariant {
  readonly id: string;
  readonly displayName?: string;
  readonly overrides?: Readonly<Record<string, unknown>>;
  readonly editorMetadata?: Readonly<Record<string, unknown>>;
}

export interface ObjectPrefab {
  readonly id: string;
  readonly displayName?: string;
  readonly defaultTransform: LevelAuthoringTransform;
  readonly components: readonly PrefabComponent[];
  readonly variants: readonly ObjectPrefabVariant[];
  readonly editorMetadata?: Readonly<Record<string, unknown>>;
}
