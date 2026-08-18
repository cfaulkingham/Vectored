
import { useState, useCallback, useRef } from 'react';

type SetStateAction<T> = T | ((prevState: T) => T);

export interface HistoryOptions {
  coalesce?: boolean;
}

/**
 * A custom hook that manages state with a linear history stack, enabling Undo and Redo functionality.
 * Supports coalescing rapid updates (e.g., slider moves) into a single history entry to prevent stack spam.
 * Caps the maximum history entries to prevent unbounded memory growth on long editing sessions.
 * 
 * @template T - The type of the state object (e.g., AppState).
 * @param initialState - The initial value of the state.
 * @param maxHistoryLength - Maximum number of history snapshots retained (defaults to 60).
 */
export const useHistoryState = <T>(initialState: T, maxHistoryLength: number = 60) => {
  // Combine history and index into one state atom to ensure they update together
  const [stateData, setStateData] = useState<{ history: T[]; index: number }>({
    history: [initialState],
    index: 0
  });
  
  const isCoalescing = useRef(false);

  // Safe access to current state
  const state = stateData.history[stateData.index];

  const setState = useCallback((action: SetStateAction<T>, options?: HistoryOptions) => {
    // Capture intent synchronously
    const requestedCoalesce = options?.coalesce && isCoalescing.current;
    isCoalescing.current = options?.coalesce ?? false;

    setStateData(prev => {
      const currentState = prev.history[prev.index];
      const nextState = typeof action === 'function' 
        ? (action as (prevState: T) => T)(currentState) 
        : action;

      // Optimization: Don't update if state hasn't changed
      if (Object.is(nextState, currentState)) {
        return prev;
      }

      let newHistory: T[];
      let newIndex: number;

      if (requestedCoalesce) {
          // Replace the current tip of history
          newHistory = [...prev.history];
          newHistory[prev.index] = nextState;
          newIndex = prev.index;
      } else {
          // Standard update: truncate future and append new
          newHistory = prev.history.slice(0, prev.index + 1);
          newHistory.push(nextState);
          
          // Enforce bounded history capacity to prevent memory leaks
          if (newHistory.length > maxHistoryLength) {
              const overflow = newHistory.length - maxHistoryLength;
              newHistory = newHistory.slice(overflow);
          }
          newIndex = newHistory.length - 1;
      }

      return { history: newHistory, index: newIndex };
    });
  }, [maxHistoryLength]);

  const undo = useCallback(() => {
    isCoalescing.current = false;
    setStateData(prev => {
        if (prev.index > 0) {
            return { ...prev, index: prev.index - 1 };
        }
        return prev;
    });
  }, []);

  const redo = useCallback(() => {
    isCoalescing.current = false;
    setStateData(prev => {
        if (prev.index < prev.history.length - 1) {
            return { ...prev, index: prev.index + 1 };
        }
        return prev;
    });
  }, []);

  const reset = useCallback((newState: T) => {
    isCoalescing.current = false;
    setStateData({
        history: [newState],
        index: 0
    });
  }, []);

  const commit = useCallback(() => {
    isCoalescing.current = false;
  }, []);

  const canUndo = stateData.index > 0;
  const canRedo = stateData.index < stateData.history.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo, reset, commit };
};
