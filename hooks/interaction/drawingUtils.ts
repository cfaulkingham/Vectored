import type { Point, PolygonVertex, ShapeType } from '../../types';

/**
 * Generates polygon vertices for standard shape primitives (rectangle, triangle, star, regular polygon, etc.)
 */
export function generatePrimitiveVertices(
    shapeType: ShapeType,
    p1: Point,
    p2: Point,
    options?: { pointsCount?: number; starInnerRadiusRatio?: number }
): PolygonVertex[] {
    const minX = Math.min(p1[0], p2[0]);
    const maxX = Math.max(p1[0], p2[0]);
    const minY = Math.min(p1[1], p2[1]);
    const maxY = Math.max(p1[1], p2[1]);
    const width = maxX - minX;
    const height = maxY - minY;
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    const createVertex = (pt: Point): PolygonVertex => ({ anchor: pt, handle1: pt, handle2: pt });

    switch (shapeType) {
        case 'rectangle':
            return [
                createVertex([minX, minY]),
                createVertex([maxX, minY]),
                createVertex([maxX, maxY]),
                createVertex([minX, maxY]),
            ];

        case 'triangle':
            return [
                createVertex([cx, minY]),
                createVertex([maxX, maxY]),
                createVertex([minX, maxY]),
            ];

        case 'star': {
            const count = options?.pointsCount || 5;
            const innerRatio = options?.starInnerRadiusRatio || 0.4;
            const vertices: PolygonVertex[] = [];
            const step = Math.PI / count;

            for (let i = 0; i < count * 2; i++) {
                const angle = i * step - Math.PI / 2;
                const r = i % 2 === 0 ? rx : rx * innerRatio;
                const rY = i % 2 === 0 ? ry : ry * innerRatio;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * rY;
                vertices.push(createVertex([x, y]));
            }
            return vertices;
        }

        case 'hexagon':
        case 'pentagon':
        case 'octagon': {
            const count = shapeType === 'pentagon' ? 5 : shapeType === 'octagon' ? 8 : 6;
            const vertices: PolygonVertex[] = [];
            const step = (2 * Math.PI) / count;

            for (let i = 0; i < count; i++) {
                const angle = i * step - Math.PI / 2;
                const x = cx + Math.cos(angle) * rx;
                const y = cy + Math.sin(angle) * ry;
                vertices.push(createVertex([x, y]));
            }
            return vertices;
        }

        case 'ellipse': {
            // Cubic Bezier approximation constant kappa = 4/3 * (sqrt(2) - 1) approx 0.5522847498
            const kappa = 0.5522847498;
            const kx = rx * kappa;
            const ky = ry * kappa;

            return [
                // Top
                { anchor: [cx, minY], handle1: [cx - kx, minY], handle2: [cx + kx, minY] },
                // Right
                { anchor: [maxX, cy], handle1: [maxX, cy - ky], handle2: [maxX, cy + ky] },
                // Bottom
                { anchor: [cx, maxY], handle1: [cx + kx, maxY], handle2: [cx - kx, maxY] },
                // Left
                { anchor: [minX, cy], handle1: [minX, cy + ky], handle2: [minX, cy - ky] },
            ];
        }

        default:
            return [
                createVertex([minX, minY]),
                createVertex([maxX, minY]),
                createVertex([maxX, maxY]),
                createVertex([minX, maxY]),
            ];
    }
}
