import { imageTracer } from './image-tracer';
import { blur, getSvgString } from './utils';

export interface TraceWorkerRequest {
    id: string;
    imageData: ImageData;
    options: any;
    blurRadius: number;
    blurDelta: number;
}

export interface TraceWorkerResponse {
    id: string;
    tracedata?: any;
    svgString?: string;
    error?: string;
}

self.onmessage = (event: MessageEvent<TraceWorkerRequest>) => {
    const { id, imageData, options, blurRadius, blurDelta } = event.data;

    try {
        let processedImageData = imageData;
        if (blurRadius > 0) {
            processedImageData = blur(imageData, blurRadius, blurDelta);
        }

        const tracedata = imageTracer.imageDataToTracedata(processedImageData, options);
        const svgString = getSvgString(tracedata, { ...options, scale: 1, viewbox: true });

        const response: TraceWorkerResponse = {
            id,
            tracedata,
            svgString,
        };
        self.postMessage(response);
    } catch (err: any) {
        self.postMessage({
            id,
            error: err?.message || 'Failed to trace image in worker',
        });
    }
};
