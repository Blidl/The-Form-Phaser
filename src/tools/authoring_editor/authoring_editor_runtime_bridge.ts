import type { ReferenceIndex } from '../../game/authoring/registry/reference_index';
import type { ValidationIssue } from '../../game/authoring/validation/validation_types';
import type { LevelAsset } from '../../game/level_authoring/level_asset_types';
import type { TestWorldToLevelAssetAdapterIssue } from '../../game/level_authoring/test_world_to_level_asset_adapter';

export interface AuthoringEditorWorldBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface AuthoringEditorObjectSummary {
  readonly id: string;
  readonly type?: string;
  readonly label?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly raw?: unknown;
}

export interface AuthoringEditorLevelAssetSnapshot {
  readonly levelAsset: LevelAsset;
  readonly adapterIssues: readonly TestWorldToLevelAssetAdapterIssue[];
}

export interface AuthoringEditorValidationSnapshot {
  readonly issues: readonly ValidationIssue[];
}

export interface AuthoringEditorRuntimeBridge {
  getCurrentWorldConfig(): unknown;
  getEditorObjects(): readonly AuthoringEditorObjectSummary[];
  getLevelId(): string;
  getWorldBounds(): AuthoringEditorWorldBounds;
  focusObject(id: string): boolean;
  buildLevelAsset(): AuthoringEditorLevelAssetSnapshot;
  buildReferenceIndex(): ReferenceIndex;
  validateCurrentLevel(): AuthoringEditorValidationSnapshot;
}
