import { nestObjects, NestingOptions } from '../lib/nesting';
import type { VectorObject, NestingResult } from '../types';

export interface NestingWorkerRequest {
    id: string;
    objects: VectorObject[];
    options: NestingOptions;
}

export interface NestingWorkerResponse {
    id: string;
    result?: NestingResult;
    error?: string;
}

self.onmessage = (event: MessageEvent<NestingWorkerRequest>) => {
    const { id, objects, options } = event.data;
    try {
        const result = nestObjects(objects, options);
        const response: NestingWorkerResponse = { id, result };
        self.postMessage(response);
    } catch (err: any) {
        const response: NestingWorkerResponse = { id, error: err?.message || 'Nesting computation failed' };
        self.postMessage(response);
    }
};
