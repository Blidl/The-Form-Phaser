import type {
  NpcCombatActiveAttack,
  NpcCombatAttackPhase,
  NpcCombatAttackRequest,
  NpcCombatDebugSnapshot
} from './npc_combat_types';

interface NpcCombatRuntimeAttackRecord {
  readonly instanceId: string;
  readonly attackerActorId: string;
  readonly targetActorId?: string;
  readonly attackId: string;
  readonly kind: NpcCombatActiveAttack['kind'];
  readonly startedAtMs: number;
  readonly windupMs: number;
  readonly activeMs: number;
  readonly recoveryMs: number;
  phase: NpcCombatAttackPhase;
  elapsedMs: number;
}

export interface NpcCombatRuntime {
  beginAttack(request: NpcCombatAttackRequest): NpcCombatActiveAttack;
  cancelAttack(instanceId: string): NpcCombatActiveAttack | null;
  update(deltaMs: number): readonly NpcCombatActiveAttack[];
  getActiveAttacks(): readonly NpcCombatActiveAttack[];
  getDebugSnapshot(): NpcCombatDebugSnapshot;
}

function sanitizeFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeDurationMs(value: number | undefined): number {
  return Math.max(0, sanitizeFinite(value ?? 0, 0));
}

function sanitizeStartedAtMs(value: number | undefined, nowMs: () => number): number {
  if (value !== undefined && Number.isFinite(value)) {
    return value;
  }
  const now = nowMs();
  if (Number.isFinite(now)) {
    return now;
  }
  return Date.now();
}

function cloneActiveAttack(attack: NpcCombatRuntimeAttackRecord): NpcCombatActiveAttack {
  return {
    instanceId: attack.instanceId,
    attackerActorId: attack.attackerActorId,
    targetActorId: attack.targetActorId,
    attackId: attack.attackId,
    kind: attack.kind,
    phase: attack.phase,
    startedAtMs: attack.startedAtMs,
    elapsedMs: attack.elapsedMs
  };
}

function compareByInstanceId(a: NpcCombatRuntimeAttackRecord, b: NpcCombatRuntimeAttackRecord): number {
  return a.instanceId.localeCompare(b.instanceId);
}

function computePhase(attack: Pick<NpcCombatRuntimeAttackRecord, 'windupMs' | 'activeMs' | 'recoveryMs' | 'elapsedMs'>): NpcCombatAttackPhase {
  const windupEnd = attack.windupMs;
  if (attack.elapsedMs < windupEnd) {
    return 'windup';
  }
  const activeEnd = windupEnd + attack.activeMs;
  if (attack.elapsedMs < activeEnd) {
    return 'active';
  }
  const recoveryEnd = activeEnd + attack.recoveryMs;
  if (attack.elapsedMs < recoveryEnd) {
    return 'recovery';
  }
  return 'completed';
}

function computeInitialPhase(windupMs: number, activeMs: number, recoveryMs: number): NpcCombatAttackPhase {
  if (windupMs > 0) {
    return 'windup';
  }
  if (activeMs > 0) {
    return 'active';
  }
  if (recoveryMs > 0) {
    return 'recovery';
  }
  return 'completed';
}

export function createNpcCombatRuntime(options?: {
  readonly nowMs?: () => number;
  readonly createInstanceId?: () => string;
}): NpcCombatRuntime {
  let fallbackCounter = 0;
  const activeByInstanceId = new Map<string, NpcCombatRuntimeAttackRecord>();
  const nowMs = options?.nowMs ?? (() => Date.now());
  const createInstanceId = options?.createInstanceId;

  return {
    beginAttack(request: NpcCombatAttackRequest): NpcCombatActiveAttack {
      const attackerActorId = request.attacker.actorId;
      const attackId = request.attack.id;
      if (typeof attackerActorId !== 'string' || attackerActorId.trim().length === 0) {
        throw new Error('invalid_npc_combat_attack: attacker actor id is required');
      }
      if (typeof attackId !== 'string' || attackId.trim().length === 0) {
        throw new Error('invalid_npc_combat_attack: attack id is required');
      }

      const startedAtMs = sanitizeStartedAtMs(request.startedAtMs, nowMs);
      const windupMs = sanitizeDurationMs(request.attack.windupMs);
      const activeMs = sanitizeDurationMs(request.attack.activeMs);
      const recoveryMs = sanitizeDurationMs(request.attack.recoveryMs);
      const phase = computeInitialPhase(windupMs, activeMs, recoveryMs);

      const generatedInstanceId = createInstanceId?.();
      const instanceId = typeof generatedInstanceId === 'string' && generatedInstanceId.length > 0
        ? generatedInstanceId
        : `${request.attack.id}:${startedAtMs}:${fallbackCounter++}`;

      const record: NpcCombatRuntimeAttackRecord = {
        instanceId,
        attackerActorId: request.attacker.actorId,
        targetActorId: request.target?.actorId,
        attackId: request.attack.id,
        kind: request.attack.kind,
        startedAtMs,
        windupMs,
        activeMs,
        recoveryMs,
        phase,
        elapsedMs: 0
      };

      if (phase !== 'completed') {
        activeByInstanceId.set(instanceId, record);
      }

      return cloneActiveAttack(record);
    },

    cancelAttack(instanceId: string): NpcCombatActiveAttack | null {
      const active = activeByInstanceId.get(instanceId);
      if (!active) {
        return null;
      }
      const cancelled: NpcCombatRuntimeAttackRecord = {
        ...active,
        phase: 'cancelled'
      };
      activeByInstanceId.delete(instanceId);
      return cloneActiveAttack(cancelled);
    },

    update(deltaMs: number): readonly NpcCombatActiveAttack[] {
      const safeDeltaMs = Math.max(0, sanitizeFinite(deltaMs, 0));
      const all = [...activeByInstanceId.values()];
      for (const attack of all) {
        attack.elapsedMs = Math.max(0, sanitizeFinite(attack.elapsedMs + safeDeltaMs, attack.elapsedMs));
        attack.phase = computePhase(attack);
        if (attack.phase === 'completed' || attack.phase === 'cancelled') {
          activeByInstanceId.delete(attack.instanceId);
        }
      }
      return this.getActiveAttacks();
    },

    getActiveAttacks(): readonly NpcCombatActiveAttack[] {
      const attacks = [...activeByInstanceId.values()];
      attacks.sort(compareByInstanceId);
      return attacks.map(cloneActiveAttack);
    },

    getDebugSnapshot(): NpcCombatDebugSnapshot {
      return {
        activeAttacks: this.getActiveAttacks()
      };
    }
  };
}
