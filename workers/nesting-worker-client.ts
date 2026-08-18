import { nestObjects, NestingOptions } from '../lib/nesting';
import type { VectorObject, NestingResult } from '../types';
import type { NestingWorkerRequest, NestingWorkerResponse } from './nesting.worker';

let nestingWorkerInstance: Worker | null = null;
const activeRequests = new Map<string, { resolve: (res: NestingResult) => void; reject: (err: any) => void }>();

function getNestingWorker(): Worker | null {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        return null;
    }
    if (!nestingWorkerInstance) {
        try {
            nestingWorkerInstance = new Worker(new URL('./nesting.worker.ts', import.meta.url), { type: 'module' });
            nestingWorkerInstance.onmessage = (event: MessageEvent<NestingWorkerResponse>) => {
                const { id, result, error } = event.data;
                const callbacks = activeRequests.get(id);
                if (callbacks) {
                    activeRequests.delete(id);
                    if (error) {
                        callbacks.reject(new Error(error));
                    } else if (result) {
                        callbacks.resolve(result);
                    }
                }
            };
            nestingWorkerInstance.onerror = (err) => {
                console.warn('Nesting worker error, falling back to main thread:', err);
            };
        } catch (e) {
            console.warn('Could not initialize nesting worker, using main thread:', e);
            nestingWorkerInstance = null;
        }
    }
    return nestingWorkerInstance;
}

/**
 * Executes nesting calculation asynchronously on a background Web Worker when available,
 * falling back gracefully to synchronous execution on the main thread if workers are unsupported.
 */
export async function nestObjectsAsync(
    objects: VectorObject[],
    options: NestingOptions
): Promise<NestingResult> {
    const worker = getNestingWorker();
    const requestId = `nest_${Date.now()}_${Math.random()}`;

    if (worker) {
        return new Promise((resolve, reject) => {
            activeRequests.set(requestId, { resolve, reject });
            const message: NestingWorkerRequest = {
                id: requestId,
                objects,
                options
            };
            worker.postMessage(message);
        });
    }

    // Direct main-thread execution fallback
    return nestObjects(objects, options);
}
