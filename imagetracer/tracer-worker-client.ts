import { imageTracer } from './image-tracer';
import { blur, getSvgString } from './utils';
import type { TraceWorkerRequest, TraceWorkerResponse } from './tracer.worker';

let workerInstance: Worker | null = null;
let activeRequests = new Map<string, { resolve: (res: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker | null {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        return null;
    }
    if (!workerInstance) {
        try {
            workerInstance = new Worker(new URL('./tracer.worker.ts', import.meta.url), { type: 'module' });
            workerInstance.onmessage = (event: MessageEvent<TraceWorkerResponse>) => {
                const { id, tracedata, svgString, error } = event.data;
                const callbacks = activeRequests.get(id);
                if (callbacks) {
                    activeRequests.delete(id);
                    if (error) {
                        callbacks.reject(new Error(error));
                    } else {
                        callbacks.resolve({ tracedata, svgString });
                    }
                }
            };
            workerInstance.onerror = (err) => {
                console.warn('Trace worker error, falling back to main thread:', err);
            };
        } catch (e) {
            console.warn('Could not initialize trace worker, will use main thread:', e);
            workerInstance = null;
        }
    }
    return workerInstance;
}

export async function traceImageAsync(
    imageData: ImageData,
    options: any,
    blurRadius: number = 0,
    blurDelta: number = 20
): Promise<{ tracedata: any; svgString: string }> {
    const worker = getWorker();
    const requestId = `trace_${Date.now()}_${Math.random()}`;

    if (worker) {
        return new Promise((resolve, reject) => {
            activeRequests.set(requestId, { resolve, reject });
            const message: TraceWorkerRequest = {
                id: requestId,
                imageData,
                options,
                blurRadius,
                blurDelta,
            };
            worker.postMessage(message);
        });
    }

    // Fallback on main thread if worker unsupported
    let processedImageData = imageData;
    if (blurRadius > 0) {
        processedImageData = blur(imageData, blurRadius, blurDelta);
    }
    const tracedata = imageTracer.imageDataToTracedata(processedImageData, options);
    const svgString = getSvgString(tracedata, { ...options, scale: 1, viewbox: true });
    return { tracedata, svgString };
}
