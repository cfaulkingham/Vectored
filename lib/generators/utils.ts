
import type { LayerSettings, Point, VectorObject } from '../../types';

/**
 * Creates a seeded pseudo-random number generator using the Mulberry32 algorithm.
 * @param a - The seed value.
 * @returns A function that returns a random number between 0 and 1.
 */
export function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Simplex Noise implementation constants
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

/**
 * A Simplex Noise generator class for creating smooth, natural-looking randomness.
 * Uses a seeded random generator for deterministic results.
 */
export class SimplexNoise {
    private p: Uint8Array;
    private perm: Uint8Array;
    private permMod12: Uint8Array;
    private static grad3 = new Float32Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);

    /**
     * @param random - A random number generator function to seed the noise.
     */
    constructor(random: () => number) {
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }
        this.perm = new Uint8Array(512);
        this.permMod12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
            this.permMod12[i] = this.perm[i] % 12;
        }
    }

    private static dot(g: number, x: number, y: number): number {
        const i = g * 3;
        return SimplexNoise.grad3[i] * x + SimplexNoise.grad3[i+1] * y;
    }

    /**
     * Generates 2D noise value for given coordinates.
     * @param xin - X coordinate.
     * @param yin - Y coordinate.
     * @returns Noise value, typically in range [-1, 1].
     */
    noise2D(xin: number, yin: number): number {
        let n0 = 0, n1 = 0, n2 = 0;
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;
        const ii = i & 255;
        const jj = j & 255;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * SimplexNoise.dot(this.permMod12[ii + this.perm[jj]], x0, y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * SimplexNoise.dot(this.permMod12[ii + i1 + this.perm[jj + j1]], x1, y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * SimplexNoise.dot(this.permMod12[ii + 1 + this.perm[jj + 1]], x2, y2);
        }
        return 70.0 * (n0 + n1 + n2);
    }
}

/**
 * Generates a 1D Gaussian kernel for blurring operations.
 * @param radius - The standard deviation (sigma) of the Gaussian distribution roughly maps to radius.
 * @returns The normalized 1D kernel array.
 */
export function gaussianKernel(radius: number): number[] {
    const sigma = radius / 3;
    const size = Math.floor(radius) * 2 + 1;
    const kernel = new Array(size);
    const sigma2 = 2 * sigma * sigma;
    const PI = Math.PI;
    let sum = 0;
    
    for (let i = 0; i < size; i++) {
        const x = i - Math.floor(radius);
        const g = (1 / Math.sqrt(PI * sigma2)) * Math.exp(-(x * x) / sigma2);
        kernel[i] = g;
        sum += g;
    }
    
    // Normalize the kernel
    for (let i = 0; i < size; i++) {
        kernel[i] /= sum;
    }
    
    return kernel;
}

/**
 * Applies a Gaussian blur to a 2D float array.
 * @param data - The flat input array (row-major order).
 * @param width - Width of the data grid.
 * @param height - Height of the data grid.
 * @param radius - Blur radius.
 * @returns A new Float32Array containing the blurred data.
 */
export function gaussianBlur(data: Float32Array, width: number, height: number, radius: number): Float32Array {
    if (radius <= 0) return data;

    const kernel = gaussianKernel(radius);
    const kernelRadius = Math.floor(kernel.length / 2);
    const temp = new Float32Array(data.length);
    const result = new Float32Array(data.length);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = -kernelRadius; i <= kernelRadius; i++) {
                const xi = x + i;
                if (xi >= 0 && xi < width) {
                    sum += data[y * width + xi] * kernel[i + kernelRadius];
                }
            }
            temp[y * width + x] = sum;
        }
    }
    
    // Vertical pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let i = -kernelRadius; i <= kernelRadius; i++) {
                const yi = y + i;
                if (yi >= 0 && yi < height) {
                    sum += temp[yi * width + x] * kernel[i + kernelRadius];
                }
            }
            result[y * width + x] = sum;
        }
    }
    
    return result;
}

/**
 * Represents raw pixel data from an image used for density mapping.
 */
export interface DensityImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

/**
 * Helper function to process an image into a density map (Float32Array of 0-1 values).
 * Handles resizing to fit canvas bounds while maintaining aspect ratio.
 * 
 * @param densityImage - HTML image element to use as source.
 * @param densityData - Raw pixel data to use as source (alternative to densityImage).
 * @param width - Target width for the density map.
 * @param height - Target height for the density map.
 * @param invert - Whether to invert the brightness (dark becomes light).
 * @returns Object containing the map data and layout info, or null if no source provided.
 */
export const getDensityMap = (
    densityImage: HTMLImageElement | null,
    densityData: DensityImageData | null | undefined,
    width: number, 
    height: number, 
    invert: boolean
): { map: Float32Array, width: number, height: number, offsetX: number, offsetY: number } | null => {
    if (!densityImage && !densityData) return null;

    let darknessMap: Float32Array;
    let mapW = 0, mapH = 0, offsetX = 0, offsetY = 0;

    if (densityImage) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const imgW = Math.min(densityImage.naturalWidth, width);
        const imgH = Math.min(densityImage.naturalHeight, height);
        const canvasAspectRatio = width / height;
        const imgAspectRatio = imgW / imgH;
        
        let drawW, drawH;
        if (imgAspectRatio > canvasAspectRatio) {
          drawW = Math.min(imgW, width);
          drawH = drawW / imgAspectRatio;
        } else {
          drawH = Math.min(imgH, height);
          drawW = drawH * imgAspectRatio;
        }

        offsetX = (width - drawW) / 2;
        offsetY = (height - drawH) / 2;

        canvas.width = drawW;
        canvas.height = drawH;
        ctx.drawImage(densityImage, 0, 0, drawW, drawH);
        
        const imageData = ctx.getImageData(0, 0, drawW, drawH);
        const data = imageData.data;
        mapW = Math.floor(drawW);
        mapH = Math.floor(drawH);
        darknessMap = new Float32Array(mapW * mapH);
        
        for (let y = 0; y < mapH; y++) {
            for (let x = 0; x < mapW; x++) {
                const i = (y * mapW + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                darknessMap[y * mapW + x] = invert ? brightness / 255.0 : (255 - brightness) / 255.0;
            }
        }
    } else if (densityData) {
        const imgW = densityData.width;
        const imgH = densityData.height;
        const canvasAspectRatio = width / height;
        const imgAspectRatio = imgW / imgH;
        
        let drawW, drawH;
        if (imgAspectRatio > canvasAspectRatio) {
          drawW = Math.min(imgW, width);
          drawH = drawW / imgAspectRatio;
        } else {
          drawH = Math.min(imgH, height);
          drawW = drawH * imgAspectRatio;
        }

        offsetX = (width - drawW) / 2;
        offsetY = (height - drawH) / 2;

        mapW = Math.floor(drawW);
        mapH = Math.floor(drawH);
        darknessMap = new Float32Array(mapW * mapH);
        
        const scaleX = imgW / drawW;
        const scaleY = imgH / drawH;

        for (let y = 0; y < mapH; y++) { 
            for (let x = 0; x < mapW; x++) { 
                 const srcX = Math.min(imgW - 1, Math.floor(x * scaleX));
                 const srcY = Math.min(imgH - 1, Math.floor(y * scaleY));
                 const i = (srcY * imgW + srcX) * 4; 
                 const r = densityData.data[i], g = densityData.data[i + 1], b = densityData.data[i + 2]; 
                 const brightness = 0.299 * r + 0.587 * g + 0.114 * b; 
                 darknessMap[y * mapW + x] = invert ? brightness / 255.0 : (255 - brightness) / 255.0; 
            } 
        }
    } else {
        return null;
    }
    
    return { map: darknessMap!, width: mapW, height: mapH, offsetX, offsetY };
}

/**
 * Context object passed to specific pattern generators.
 * Contains all necessary data to generate a pattern.
 */
export interface GeneratorContext {
    /** Settings for the current layer */
    settings: LayerSettings;
    /** Bounds of the drawing area */
    bounds: { x: number; y: number; width: number; height: number };
    /** Seeded random number generator */
    random: () => number;
    /** Optional density map data */
    densityMap: { map: Float32Array; width: number; height: number; offsetX: number; offsetY: number } | null;
    /** Optional list of points (e.g. for Voronoi) */
    points?: Point[];
    /** Optional list of vector objects (e.g. for flow guides) */
    objects?: VectorObject[];
}
