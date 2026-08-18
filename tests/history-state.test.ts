import { describe, it, expect } from 'vitest';

/**
 * Pure state reducer logic matching useHistoryState for direct deterministic testing.
 */
interface HistoryState<T> {
    history: T[];
    index: number;
}

function createHistoryManager<T>(initialState: T, maxCapacity: number = 60) {
    let stateData: HistoryState<T> = {
        history: [initialState],
        index: 0
    };
    let isCoalescing = false;

    return {
        get state() {
            return stateData.history[stateData.index];
        },
        get canUndo() {
            return stateData.index > 0;
        },
        get canRedo() {
            return stateData.index < stateData.history.length - 1;
        },
        setState(action: T | ((prev: T) => T), options?: { coalesce?: boolean }) {
            const requestedCoalesce = options?.coalesce && isCoalescing;
            isCoalescing = options?.coalesce ?? false;

            const currentState = stateData.history[stateData.index];
            const nextState = typeof action === 'function' ? (action as any)(currentState) : action;

            if (Object.is(nextState, currentState)) return;

            let newHistory: T[];
            let newIndex: number;

            if (requestedCoalesce) {
                newHistory = [...stateData.history];
                newHistory[stateData.index] = nextState;
                newIndex = stateData.index;
            } else {
                newHistory = stateData.history.slice(0, stateData.index + 1);
                newHistory.push(nextState);
                if (newHistory.length > maxCapacity) {
                    const overflow = newHistory.length - maxCapacity;
                    newHistory = newHistory.slice(overflow);
                }
                newIndex = newHistory.length - 1;
            }
            stateData = { history: newHistory, index: newIndex };
        },
        undo() {
            isCoalescing = false;
            if (stateData.index > 0) {
                stateData = { ...stateData, index: stateData.index - 1 };
            }
        },
        redo() {
            isCoalescing = false;
            if (stateData.index < stateData.history.length - 1) {
                stateData = { ...stateData, index: stateData.index + 1 };
            }
        },
        reset(newState: T) {
            isCoalescing = false;
            stateData = { history: [newState], index: 0 };
        }
    };
}

describe('useHistoryState Logic', () => {
    it('initializes with the initial state and cannot undo/redo', () => {
        const history = createHistoryManager({ count: 0 });
        expect(history.state).toEqual({ count: 0 });
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });

    it('records state transitions and allows undo/redo', () => {
        const history = createHistoryManager({ count: 0 });

        history.setState({ count: 1 });
        expect(history.state).toEqual({ count: 1 });
        expect(history.canUndo).toBe(true);
        expect(history.canRedo).toBe(false);

        history.setState({ count: 2 });
        expect(history.state).toEqual({ count: 2 });

        history.undo();
        expect(history.state).toEqual({ count: 1 });
        expect(history.canRedo).toBe(true);

        history.redo();
        expect(history.state).toEqual({ count: 2 });
    });

    it('supports coalesced updates without creating extra history entries', () => {
        const history = createHistoryManager({ value: 0 });

        history.setState({ value: 10 }, { coalesce: true });
        history.setState({ value: 20 }, { coalesce: true });
        history.setState({ value: 30 }, { coalesce: true });

        expect(history.state).toEqual({ value: 30 });
        // Single undo should jump back to the initial state { value: 0 }
        history.undo();
        expect(history.state).toEqual({ value: 0 });
    });

    it('enforces maximum history length to prevent unbounded memory growth', () => {
        const maxCapacity = 5;
        const history = createHistoryManager(0, maxCapacity);

        for (let i = 1; i <= 10; i++) {
            history.setState(i);
        }

        expect(history.state).toBe(10);

        let undoCount = 0;
        while (history.canUndo) {
            history.undo();
            undoCount++;
        }

        expect(undoCount).toBe(maxCapacity - 1);
        expect(history.state).toBe(6);
    });

    it('resets history cleanly when reset is called', () => {
        const history = createHistoryManager(100);

        history.setState(200);
        history.setState(300);
        expect(history.canUndo).toBe(true);

        history.reset(500);
        expect(history.state).toBe(500);
        expect(history.canUndo).toBe(false);
        expect(history.canRedo).toBe(false);
    });
});
