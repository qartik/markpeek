type Snapshot = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

const MAX_HISTORY = 200;

export class EditorHistory {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private restoring = false;

  constructor(private textarea: HTMLTextAreaElement) {}

  record(): void {
    if (this.restoring) {
      return;
    }

    const snapshot = this.snapshot();
    const last = this.undoStack.at(-1);

    if (
      last?.value === snapshot.value &&
      last.selectionStart === snapshot.selectionStart &&
      last.selectionEnd === snapshot.selectionEnd
    ) {
      return;
    }

    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length <= 1) {
      return false;
    }

    const current = this.undoStack.pop();
    if (current) {
      this.redoStack.push(current);
    }

    return this.restore(this.undoStack[this.undoStack.length - 1]);
  }

  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot) {
      return false;
    }

    this.undoStack.push(snapshot);
    return this.restore(snapshot);
  }

  private snapshot(): Snapshot {
    return {
      value: this.textarea.value,
      selectionStart: this.textarea.selectionStart,
      selectionEnd: this.textarea.selectionEnd,
    };
  }

  private restore(snapshot: Snapshot | undefined): boolean {
    if (!snapshot) {
      return false;
    }

    this.restoring = true;
    this.textarea.value = snapshot.value;
    this.textarea.setSelectionRange(
      snapshot.selectionStart,
      snapshot.selectionEnd,
    );
    this.textarea.focus({ preventScroll: true });
    this.textarea.dispatchEvent(new Event("input", { bubbles: true }));
    this.restoring = false;
    return true;
  }
}
