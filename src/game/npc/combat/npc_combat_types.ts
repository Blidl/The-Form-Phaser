export type NpcCombatAttackKind = 'contact' | 'melee' | 'projectile' | 'dash';

export interface NpcCombatDamagePayload {
  readonly amount: number;
  readonly damageType?: string;
  readonly knockbackX?: number;
  readonly knockbackY?: number;
}

export interface NpcCombatBaseAttackConfig {
  readonly id: string;
  readonly kind: NpcCombatAttackKind;
  readonly cooldownMs?: number;
  readonly windupMs?: number;
  readonly activeMs?: number;
  readonly recoveryMs?: number;
  readonly damage: NpcCombatDamagePayload;
}

export interface NpcCombatContactAttackConfig extends NpcCombatBaseAttackConfig {
  readonly kind: 'contact';
  readonly radiusPx?: number;
}

export interface NpcCombatMeleeAttackConfig extends NpcCombatBaseAttackConfig {
  readonly kind: 'melee';
  readonly rangePx: number;
  readonly arcDeg?: number;
}

export interface NpcCombatProjectileAttackConfig extends NpcCombatBaseAttackConfig {
  readonly kind: 'projectile';
  readonly projectileId: string;
  readonly speedPxPerSec: number;
  readonly rangePx?: number;
}

export interface NpcCombatDashAttackConfig extends NpcCombatBaseAttackConfig {
  readonly kind: 'dash';
  readonly speedPxPerSec: number;
  readonly durationMs: number;
  readonly hitRadiusPx?: number;
}

export type NpcCombatAttackConfig =
  | NpcCombatContactAttackConfig
  | NpcCombatMeleeAttackConfig
  | NpcCombatProjectileAttackConfig
  | NpcCombatDashAttackConfig;

export interface NpcCombatActorSnapshot {
  readonly actorId: string;
  readonly x: number;
  readonly y: number;
  readonly facingDeg: number;
  readonly tags?: readonly string[];
}

export interface NpcCombatAttackRequest {
  readonly attacker: NpcCombatActorSnapshot;
  readonly target?: NpcCombatActorSnapshot;
  readonly attack: NpcCombatAttackConfig;
  readonly startedAtMs?: number;
}

export type NpcCombatAttackPhase = 'windup' | 'active' | 'recovery' | 'completed' | 'cancelled';

export interface NpcCombatActiveAttack {
  readonly instanceId: string;
  readonly attackerActorId: string;
  readonly targetActorId?: string;
  readonly attackId: string;
  readonly kind: NpcCombatAttackKind;
  readonly phase: NpcCombatAttackPhase;
  readonly startedAtMs: number;
  readonly elapsedMs: number;
}

export interface NpcCombatHitCandidate {
  readonly attackInstanceId: string;
  readonly attackerActorId: string;
  readonly targetActorId: string;
  readonly damage: NpcCombatDamagePayload;
  readonly reason: string;
}

export interface NpcCombatDebugSnapshot {
  readonly activeAttacks: readonly NpcCombatActiveAttack[];
}
