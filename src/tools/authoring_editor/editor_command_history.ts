export interface EditorCommand {
  readonly label: string;
  readonly timestamp: number;
  do(): void;
  undo(): void;
}

export interface EditorCommandHistory {
  execute(command: EditorCommand): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  getUndoStack(): readonly EditorCommand[];
  getRedoStack(): readonly EditorCommand[];
}

class DefaultEditorCommandHistory implements EditorCommandHistory {
  private readonly undoStack: EditorCommand[] = [];
  private readonly redoStack: EditorCommand[] = [];

  execute(command: EditorCommand): void {
    command.do();
    this.undoStack.push(command);
    this.redoStack.length = 0;
  }

  undo(): boolean {
    const command = this.undoStack[this.undoStack.length - 1];
    if (!command) {
      return false;
    }

    command.undo();
    this.undoStack.pop();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack[this.redoStack.length - 1];
    if (!command) {
      return false;
    }

    command.do();
    this.redoStack.pop();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  getUndoStack(): readonly EditorCommand[] {
    return [...this.undoStack];
  }

  getRedoStack(): readonly EditorCommand[] {
    return [...this.redoStack];
  }
}

export function createEditorCommandHistory(): EditorCommandHistory {
  return new DefaultEditorCommandHistory();
}
