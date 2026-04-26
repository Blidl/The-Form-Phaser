export type BackgroundLayerKind =
  | 'solid_color'
  | 'image'
  | 'tile_sprite'
  | 'parallax'
  | 'decor';

export interface BackgroundLayer {
  readonly id: string;
  readonly kind: BackgroundLayerKind;
  readonly visible: boolean;
  readonly order: number;
  readonly color?: string;
  readonly assetId?: string;
  readonly x?: number;
  readonly y?: number;
  readonly scrollFactorX?: number;
  readonly scrollFactorY?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  readonly repeatX?: boolean;
  readonly repeatY?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface BackgroundAuthoring {
  readonly layers: readonly BackgroundLayer[];
}
