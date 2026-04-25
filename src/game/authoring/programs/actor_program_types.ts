export type ActorProgramId = string;
export type ActorProgramNodeId = string;
export type ActorProgramVariableName = string;

// Variable refs (for example "$self") are serialized strings resolved by the runner later.
export type ActorProgramVariableRef = string;

export interface ActorProgram {
    readonly id: ActorProgramId;
    readonly title?: string;
    readonly root: ActorProgramNode;
    readonly variables?: Readonly<Record<string, unknown>>;
}

export type ActorProgramParallelPolicy = 'wait_all' | 'wait_first' | 'fire_and_forget';

export type ActorProgramLoopPolicy = 'forever' | 'count' | 'while_conditions';

export interface ActorProgramCondition {
    readonly type: string;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly invert?: boolean;
}

interface ActorProgramNodeBase {
    readonly id?: ActorProgramNodeId;
    readonly label?: string;
}

export interface ActorProgramSequenceNode extends ActorProgramNodeBase {
    readonly kind: 'sequence';
    readonly children: readonly ActorProgramNode[];
}

export interface ActorProgramParallelNode extends ActorProgramNodeBase {
    readonly kind: 'parallel';
    readonly policy: ActorProgramParallelPolicy;
    readonly children: readonly ActorProgramNode[];
}

export interface ActorProgramActionNode extends ActorProgramNodeBase {
    readonly kind: 'action';
    readonly actionType: string;
    readonly params?: Readonly<Record<string, unknown>>;
}

export interface ActorProgramWaitNode extends ActorProgramNodeBase {
    readonly kind: 'wait';
    readonly durationMs: number;
}

export interface ActorProgramIfNode extends ActorProgramNodeBase {
    readonly kind: 'if';
    readonly conditions: readonly ActorProgramCondition[];
    readonly then: ActorProgramNode;
    readonly else?: ActorProgramNode;
}

export interface ActorProgramLoopNode extends ActorProgramNodeBase {
    readonly kind: 'loop';
    readonly policy: ActorProgramLoopPolicy;
    readonly child: ActorProgramNode;
    readonly count?: number;
    readonly conditions?: readonly ActorProgramCondition[];
    readonly maxIterations?: number;
}

export interface ActorProgramEmitEventNode extends ActorProgramNodeBase {
    readonly kind: 'emit_event';
    readonly eventId: string;
    readonly payload?: Readonly<Record<string, unknown>>;
}

export type ActorProgramNode =
    | ActorProgramSequenceNode
    | ActorProgramParallelNode
    | ActorProgramActionNode
    | ActorProgramWaitNode
    | ActorProgramIfNode
    | ActorProgramLoopNode
    | ActorProgramEmitEventNode;