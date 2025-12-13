
import type { PrimitivePatternData } from '../types';
import type { GeneratorContext } from './utils';

/**
 * Generates a Maze pattern using specified algorithms (Recursive Backtracker or Prim's).
 * Supports both Square and Polar coordinate layouts.
 *
 * @param {GeneratorContext} ctx - The generator context containing settings, bounds, and random generator.
 * @returns {PrimitivePatternData | null} The generated pattern data with maze wall paths, or null if dimensions are too small.
 */
export const generateMaze = (ctx: GeneratorContext): PrimitivePatternData => {
    const { settings, bounds, random } = ctx;
    const { mazeCellSize, mazePadding, mazeType, mazeAlgorithm } = settings;
    const paths: string[] = [];
    const size = Math.max(5, mazeCellSize);
    const padding = Math.max(0, mazePadding || 0);
    
    const innerWidth = bounds.width - (padding * 2);
    const innerHeight = bounds.height - (padding * 2);
    
    if (innerWidth <= size || innerHeight <= size) return { type: 'maze', paths: [] };

    if (mazeType === 'square') {
        const cols = Math.floor(innerWidth / size);
        const rows = Math.floor(innerHeight / size);
        
        if (cols <= 0 || rows <= 0) return null;
        
        const gridW = cols * size;
        const gridH = rows * size;
        const startX = bounds.x + padding + (innerWidth - gridW) / 2;
        const startY = bounds.y + padding + (innerHeight - gridH) / 2;

        const vWalls = Array.from({ length: cols + 1 }, () => Array(rows).fill(true));
        const hWalls = Array.from({ length: cols }, () => Array(rows + 1).fill(true));
        
        const visited = Array.from({ length: cols }, () => Array(rows).fill(false));
        
        if (mazeAlgorithm === 'recursive-backtracker') {
            const stack: [number, number][] = [[0, 0]];
            visited[0][0] = true;

            while (stack.length > 0) {
                const [cx, cy] = stack[stack.length - 1];
                const neighbors: [number, number, string][] = [];

                if (cy > 0 && !visited[cx][cy - 1]) neighbors.push([cx, cy - 1, 'U']);
                if (cx < cols - 1 && !visited[cx + 1][cy]) neighbors.push([cx + 1, cy, 'R']);
                if (cy < rows - 1 && !visited[cx][cy + 1]) neighbors.push([cx, cy + 1, 'D']);
                if (cx > 0 && !visited[cx - 1][cy]) neighbors.push([cx - 1, cy, 'L']);

                if (neighbors.length > 0) {
                    const [nx, ny, dir] = neighbors[Math.floor(random() * neighbors.length)];
                    if (dir === 'U') hWalls[cx][cy] = false;
                    else if (dir === 'R') vWalls[cx + 1][cy] = false;
                    else if (dir === 'D') hWalls[cx][cy + 1] = false;
                    else if (dir === 'L') vWalls[cx][cy] = false;
                    
                    visited[nx][ny] = true;
                    stack.push([nx, ny]);
                } else {
                    stack.pop();
                }
            }
        } else if (mazeAlgorithm === 'prim') {
            const startXCell = Math.floor(random() * cols);
            const startYCell = Math.floor(random() * rows);
            visited[startXCell][startYCell] = true;
            
            let frontier: [number, number, number, number, string][] = [];
            
            const addFrontier = (x: number, y: number) => {
                if (y > 0 && !visited[x][y - 1]) frontier.push([x, y - 1, x, y, 'U']);
                if (x < cols - 1 && !visited[x + 1][y]) frontier.push([x + 1, y, x, y, 'R']);
                if (y < rows - 1 && !visited[x][y + 1]) frontier.push([x, y + 1, x, y, 'D']);
                if (x > 0 && !visited[x - 1][y]) frontier.push([x - 1, y, x, y, 'L']);
            };
            addFrontier(startXCell, startYCell);
            
            while(frontier.length > 0) {
                const randIndex = Math.floor(random() * frontier.length);
                const [fx, fy, sx, sy, dir] = frontier[randIndex];
                frontier.splice(randIndex, 1); 
                
                if (!visited[fx][fy]) {
                     visited[fx][fy] = true;
                     if (dir === 'U') hWalls[sx][sy] = false;
                     if (dir === 'R') vWalls[sx + 1][sy] = false;
                     if (dir === 'D') hWalls[sx][sy + 1] = false;
                     if (dir === 'L') vWalls[sx][sy] = false;
                     
                     addFrontier(fx, fy);
                }
            }
        }

        for (let y = 0; y <= rows; y++) {
            let currentLineStartX = -1;
            for (let x = 0; x < cols; x++) {
                if (hWalls[x][y]) {
                    if (currentLineStartX === -1) currentLineStartX = x;
                } else {
                    if (currentLineStartX !== -1) {
                        paths.push(`M ${startX + currentLineStartX * size} ${startY + y * size} L ${startX + x * size} ${startY + y * size}`);
                        currentLineStartX = -1;
                    }
                }
            }
            if (currentLineStartX !== -1) {
                 paths.push(`M ${startX + currentLineStartX * size} ${startY + y * size} L ${startX + cols * size} ${startY + y * size}`);
            }
        }

        for (let x = 0; x <= cols; x++) {
            let currentLineStartY = -1;
            for (let y = 0; y < rows; y++) {
                if (vWalls[x][y]) {
                    if (currentLineStartY === -1) currentLineStartY = y;
                } else {
                    if (currentLineStartY !== -1) {
                        paths.push(`M ${startX + x * size} ${startY + currentLineStartY * size} L ${startX + x * size} ${startY + y * size}`);
                        currentLineStartY = -1;
                    }
                }
            }
            if (currentLineStartY !== -1) {
                 paths.push(`M ${startX + x * size} ${startY + currentLineStartY * size} L ${startX + x * size} ${startY + rows * size}`);
            }
        }

    } else if (mazeType === 'polar') {
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const maxRadius = Math.min(innerWidth, innerHeight) / 2;
        const ringHeight = size;
        const ringCount = Math.floor(maxRadius / ringHeight);
        
        if (ringCount < 1) return null;
        
        const cells: boolean[][] = [];
        const sectorsPerRing: number[] = [];
        
        for (let r = 0; r < ringCount; r++) {
             if (r === 0) {
                 sectorsPerRing.push(1);
                 cells.push([false]); 
             } else {
                 const idealSectors = Math.round(2 * Math.PI * r);
                 sectorsPerRing.push(idealSectors);
                 cells.push(new Array(idealSectors).fill(false));
             }
        }
        
        const passages = new Set<string>();
        const makeKey = (r1: number, i1: number, r2: number, i2: number) => `${r1},${i1}-${r2},${i2}`;
        
        const stack: [number, number][] = [[0, 0]];
        cells[0][0] = true; 
        
        while(stack.length > 0) {
             const current = mazeAlgorithm === 'recursive-backtracker' ? stack[stack.length - 1] : stack[Math.floor(random() * stack.length)];
             const [r, i] = current;
             const neighbors: [number, number][] = [];
             
             if (r < ringCount - 1) {
                 const nextSectors = sectorsPerRing[r + 1];
                 const currentSectors = sectorsPerRing[r];
                 
                 const startNext = Math.floor((i / currentSectors) * nextSectors);
                 const endNext = Math.floor(((i + 1) / currentSectors) * nextSectors);
                 
                 for (let ni = startNext; ni < endNext || (startNext === endNext && ni === startNext); ni++) {
                     const wrappedNi = ni % nextSectors;
                     if (!cells[r + 1][wrappedNi]) {
                         neighbors.push([r + 1, wrappedNi]);
                     }
                 }
                 if (neighbors.length === 0 && r === 0) {
                     for(let k=0; k<sectorsPerRing[1]; k++) {
                         if(!cells[1][k]) neighbors.push([1, k]);
                     }
                 }
             }
             
             if (r > 0) {
                 const prevSectors = sectorsPerRing[r - 1];
                 const currentSectors = sectorsPerRing[r];
                 const ni = Math.floor((i / currentSectors) * prevSectors) % prevSectors;
                 if (!cells[r - 1][ni]) {
                     neighbors.push([r - 1, ni]);
                 }
             }
             
             if (r > 0) { 
                 const N = sectorsPerRing[r];
                 const ni = (i - 1 + N) % N;
                 if (!cells[r][ni]) neighbors.push([r, ni]);
             }
             
             if (r > 0) {
                 const N = sectorsPerRing[r];
                 const ni = (i + 1) % N;
                 if (!cells[r][ni]) neighbors.push([r, ni]);
             }
             
             if (neighbors.length > 0) {
                 const [nr, ni] = neighbors[Math.floor(random() * neighbors.length)];
                 passages.add(makeKey(r, i, nr, ni));
                 passages.add(makeKey(nr, ni, r, i));
                 
                 cells[nr][ni] = true;
                 stack.push([nr, ni]);
             } else {
                 if (mazeAlgorithm === 'recursive-backtracker') stack.pop();
                 else {
                     const idx = stack.indexOf(current);
                     if (idx > -1) stack.splice(idx, 1);
                 }
             }
        }
        
        for (let r = 1; r < ringCount; r++) {
            const N = sectorsPerRing[r];
            const innerRad = r * ringHeight;
            const outerRad = (r + 1) * ringHeight;
            
            for (let i = 0; i < N; i++) {
                const nextI = (i + 1) % N;
                if (!passages.has(makeKey(r, i, r, nextI))) {
                    const angle = (nextI / N) * 2 * Math.PI;
                    paths.push(`M ${centerX + innerRad * Math.cos(angle)} ${centerY + innerRad * Math.sin(angle)} L ${centerX + outerRad * Math.cos(angle)} ${centerY + outerRad * Math.sin(angle)}`);
                }
            }
        }
        
        for (let r = 1; r <= ringCount; r++) { 
            const rad = r * ringHeight;
            if (r === ringCount) {
                 paths.push(`M ${centerX + rad} ${centerY} A ${rad} ${rad} 0 1 1 ${centerX - rad} ${centerY} A ${rad} ${rad} 0 1 1 ${centerX + rad} ${centerY}`);
                 continue;
            }

            const N_outer = sectorsPerRing[r];
            const N_inner = sectorsPerRing[r-1];
            
            for (let i = 0; i < N_outer; i++) {
                const angleStart = (i / N_outer) * 2 * Math.PI;
                const angleEnd = ((i + 1) / N_outer) * 2 * Math.PI;
                
                const parentI = Math.floor((i / N_outer) * N_inner) % N_inner;
                
                if (!passages.has(makeKey(r, i, r - 1, parentI))) {
                     const x1 = centerX + rad * Math.cos(angleStart);
                     const y1 = centerY + rad * Math.sin(angleStart);
                     const x2 = centerX + rad * Math.cos(angleEnd);
                     const y2 = centerY + rad * Math.sin(angleEnd);
                     paths.push(`M ${x1} ${y1} A ${rad} ${rad} 0 0 1 ${x2} ${y2}`);
                }
            }
        }
    }

    return { type: 'maze', paths };
};
