
import type { AppState, Gradient, VectorObject, Layer, PolygonVertex, LineObject, TextObject, PolygonObject, Units, Point, MeasurementObject, PathObject } from '../types';
import { getPolygonPathWithCurves, getSmoothedPolylinePath, getShapePath, calculateGenericPathBounds, getSVGPathFromObject, getPathTotalLength, getPointAndTangentAtLength, getObjectAsPolygon, flattenBezier, calculatePolygonArea, calculatePolygonPerimeter, getObjectVisualBounds } from './geometry';
import { convertObjectToPolygon } from './path-converter';
import { googleFonts } from './utils';

/**
 * Escapes unsafe characters for XML/SVG strings to prevent syntax errors or injection.
 * 
 * @param unsafe - The raw string to escape.
 * @returns The escaped XML string.
 */
const escapeXml = (unsafe: string) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

/**
 * Maps a hex color to the nearest AutoCAD Color Index (ACI).
 * Uses a simplified palette of standard colors often used for laser cutting layers.
 * 
 * @param hex - The hex color string (e.g., "#FF0000").
 * @returns The ACI color code (1-7).
 */
const hexToACI = (hex: string): number => {
    if (!hex || hex === 'none') return 7; // White/Black default
    
    // Normalize hex
    const h = hex.toLowerCase().replace(/^#/, '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);

    // Standard Laser Colors Mapping
    // Red=1, Yellow=2, Green=3, Cyan=4, Blue=5, Magenta=6, White=7
    if (r > 200 && g < 50 && b < 50) return 1; // Red
    if (r > 200 && g > 200 && b < 50) return 2; // Yellow
    if (r < 50 && g > 200 && b < 50) return 3; // Green
    if (r < 50 && g > 200 && b > 200) return 4; // Cyan
    if (r < 50 && g < 50 && b > 200) return 5; // Blue
    if (r > 200 && g < 50 && b > 200) return 6; // Magenta
    if (r > 200 && g > 200 && b > 200) return 7; // White
    
    return 7; // Default to white
};

/**
 * Generates a valid DXF (Drawing Exchange Format) file string from the application state.
 * Handles Layers, Colors, Text, Lines, and converts Polygons/Paths into LWPOLYLINE entities.
 * Flattens Bezier curves into segmented polylines as standard DXF R12/2000 support for splines is complex.
 * Scales coordinates based on the selected unit system to ensure physical dimensions match.
 * 
 * @param appState - The current state of the application containing layers and objects.
 * @param units - The measurement units ('mm' or 'inches').
 * @param options - Export options (e.g., whether to include measurements).
 * @returns A string containing the DXF file content.
 */
export const generateDXFString = (appState: AppState, units: Units, options: { includeMeasurements: boolean } = { includeMeasurements: true }): string => {
    const { layers } = appState;
    let handleCounter = 0x100;
    const nextHandle = () => (handleCounter++).toString(16).toUpperCase();

    const dxfTables: string[] = [];
    const dxfEntities: string[] = [];

    // --- 1. HEADER SECTION ---
    // Set units: 1 = Inches, 4 = Millimeters, 0 = Unitless
    let unitCode = 0;
    let scale = 1; // Default scale for pixels (unitless)

    if (units === 'mm') {
        unitCode = 4;
        scale = 25.4 / 96; // Convert 96 DPI pixels to mm
    } else if (units === 'in') {
        unitCode = 1;
        scale = 1 / 96; // Convert 96 DPI pixels to inches
    }

    const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n${unitCode}\n0\nENDSEC\n`;

    // --- 2. TABLES SECTION (Layers) ---
    let layerTable = `0\nTABLE\n2\nLAYER\n70\n${layers.length + 1}\n`; // +1 for layer 0
    
    // Standard Layer 0
    layerTable += `0\nLAYER\n5\n${nextHandle()}\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n`;

    layers.forEach(layer => {
        const safeName = layer.name.replace(/[^a-zA-Z0-9_\- ]/g, "_"); // Sanitize layer name
        const colorCode = hexToACI(layer.color);
        const isOff = !layer.visible;
        
        layerTable += `0\nLAYER\n5\n${nextHandle()}\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\n${safeName}\n70\n0\n62\n${isOff ? -colorCode : colorCode}\n6\nCONTINUOUS\n`;
    });
    layerTable += `0\nENDTAB\n`;
    
    // Minimal Style Table (Standard)
    dxfTables.push(layerTable);
    dxfTables.push(`0\nTABLE\n2\nSTYLE\n70\n1\n0\nSTYLE\n5\n${nextHandle()}\n100\nAcDbSymbolTableRecord\n100\nAcDbTextStyleTableRecord\n2\nSTANDARD\n70\n0\n40\n0.0\n41\n1.0\n50\n0.0\n71\n0\n42\n0.2\n3\ntxt\n4\n\n0\nENDTAB\n`);

    const tablesSection = `0\nSECTION\n2\nTABLES\n${dxfTables.join('')}0\nENDSEC\n`;

    // --- 3. ENTITIES SECTION ---
    
    const processObject = (obj: VectorObject, layerName: string) => {
        if (!options.includeMeasurements && obj.type === 'measurement') return;

        // Helper to flatten beziers in a polygon/path
        const flattenPolygon = (vertices: PolygonVertex[], isClosed: boolean): Point[] => {
            let points: Point[] = [];
            if (vertices.length === 0) return points;
            
            points.push(vertices[0].anchor);
            
            for (let i = 0; i < vertices.length - 1; i++) {
                const start = vertices[i];
                const end = vertices[i+1];
                const segmentPoints = flattenBezier(start.anchor, start.handle2, end.handle1, end.anchor, 16);
                points.push(...segmentPoints.slice(1)); // Skip first point as it is duplicate of previous end
            }
            
            if (isClosed && vertices.length > 1) {
                const start = vertices[vertices.length - 1];
                const end = vertices[0];
                const segmentPoints = flattenBezier(start.anchor, start.handle2, end.handle1, end.anchor, 16);
                points.push(...segmentPoints.slice(1));
            }
            
            return points;
        };

        const addPolyline = (points: Point[], closed: boolean) => {
            if (points.length < 2) return;
            let s = `0\nLWPOLYLINE\n5\n${nextHandle()}\n100\nAcDbEntity\n8\n${layerName}\n100\nAcDbPolyline\n90\n${points.length}\n70\n${closed ? 1 : 0}\n`;
            points.forEach(p => {
                s += `10\n${p[0] * scale}\n20\n${p[1] * scale}\n`;
            });
            dxfEntities.push(s);
        };

        const addLine = (x1: number, y1: number, x2: number, y2: number) => {
            dxfEntities.push(`0\nLINE\n5\n${nextHandle()}\n100\nAcDbEntity\n8\n${layerName}\n100\nAcDbLine\n10\n${x1 * scale}\n20\n${y1 * scale}\n11\n${x2 * scale}\n21\n${y2 * scale}\n`);
        };

        const addText = (textObj: TextObject) => {
            // Basic TEXT entity. Note: DXF alignment is complex, defaulting to bottom-left (0,0) baseline.
            dxfEntities.push(`0\nTEXT\n5\n${nextHandle()}\n100\nAcDbEntity\n8\n${layerName}\n100\nAcDbText\n10\n${textObj.x * scale}\n20\n${textObj.y * scale}\n40\n${textObj.fontSize * scale}\n1\n${textObj.text}\n50\n${textObj.rotation}\n`);
        };

        const addCircle = (cx: number, cy: number, radius: number) => {
            dxfEntities.push(`0\nCIRCLE\n5\n${nextHandle()}\n100\nAcDbEntity\n8\n${layerName}\n100\nAcDbCircle\n10\n${cx * scale}\n20\n${cy * scale}\n40\n${radius * scale}\n`);
        };

        if (obj.type === 'line') {
            addLine(obj.x1, obj.y1, obj.x2, obj.y2);
        } else if (obj.type === 'text') {
            addText(obj);
        } else if (obj.type === 'shape' && obj.shapeType === 'ellipse' && Math.abs(obj.width - obj.height) < 0.01) {
            // Export native CIRCLE for optimal CNC/laser machine pathing
            const radius = obj.width / 2;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            addCircle(cx, cy, radius);
        } else if (obj.type === 'measurement') {
            const m = obj as MeasurementObject;
            addLine(m.x1, m.y1, m.x2, m.y2);
            // For DXF measurement text, we skip dynamic calculation for simplicity and just write "DIM" or handle explicitly later if needed.
            // For now, just lines.
        } else if (obj.type === 'image') {
            // Images ignored in basic DXF export
        } else {
            // For Polygon, Path, Shape, Generic-Path -> Convert to Polyline with flattening
            let polys = convertObjectToPolygon(obj);
            
            if (!polys && obj.type === 'path') {
                const pathObj = obj as PathObject;
                addPolyline(pathObj.points, false);
                return;
            }

            if (polys) {
                polys.forEach(p => {
                    const flattenedPoints = flattenPolygon(p.points, p.isClosed);
                    addPolyline(flattenedPoints, p.isClosed);
                });
            } else {
                const bounds = getObjectAsPolygon(obj);
                if (bounds) {
                    addPolyline(bounds, true);
                }
            }
        }
    };

    layers.forEach(layer => {
        if (!layer.visible) return;
        const layerName = layer.name.replace(/[^a-zA-Z0-9_\- ]/g, "_");

        const ownedObjectIds = new Set<string>();
        const explodedObjects: VectorObject[] = [];

        layer.objects.forEach(obj => {
            if (obj.type === 'path-group') {
                ownedObjectIds.add(obj.pathId);
                obj.templateObjectIds.forEach(id => ownedObjectIds.add(id));
                
                const pathObject = layer.objects.find(o => o.id === obj.pathId);
                const templateObjects = obj.templateObjectIds.map(id => layer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
                
                if (pathObject && templateObjects.length > 0) {
                    explodedObjects.push(pathObject);

                    const pathD = getSVGPathFromObject(pathObject);
                    if (pathD) {
                        const totalLength = getPathTotalLength(pathD);
                        const { distributionMode, count, distance, startOffset, endOffset, alignToPath, rotationOffset = 0, perpendicularOffset = 0 } = obj.settings;
                        const pathStart = totalLength * Math.max(0, Math.min(1, startOffset));
                        const pathEnd = totalLength * Math.max(0, Math.min(1, endOffset));
                        const effectiveLength = Math.max(0, pathEnd - pathStart);
                        
                        const isPathClosed = pathD.trim().endsWith('Z') || pathD.trim().endsWith('z');
                        const numInstances = distributionMode === 'count' ? count : (distance > 0 ? Math.floor(effectiveLength / distance) + 1 : 0);

                        for (let i = 0; i < numInstances; i++) {
                            let lengthOnPath = 0;
                            if (distributionMode === 'count') {
                                let fraction = (numInstances > 1) ? (i / (numInstances - 1)) : 0.5;
                                if (isPathClosed && numInstances > 1) fraction = i / numInstances;
                                lengthOnPath = pathStart + (fraction * effectiveLength);
                            } else {
                                lengthOnPath = pathStart + (i * distance);
                            }
                            
                            if (lengthOnPath > pathEnd + 0.01) break;
                            const posAndTan = getPointAndTangentAtLength(pathD, lengthOnPath);
                            if (posAndTan) {
                                const { point, angle } = posAndTan;
                                const template = templateObjects[i % templateObjects.length];
                                
                                const instance = JSON.parse(JSON.stringify(template));
                                instance.id = `dxf-temp-${i}`;
                                instance.rotation = (alignToPath ? template.rotation + angle : template.rotation) + rotationOffset;

                                const normalRad = (angle + 90) * Math.PI / 180;
                                const offsetX = Math.cos(normalRad) * perpendicularOffset;
                                const offsetY = Math.sin(normalRad) * perpendicularOffset;

                                const dx = point[0] - (template.x + template.width / 2) + offsetX;
                                const dy = point[1] - (template.y + template.height / 2) + offsetY;
                                instance.x += dx;
                                instance.y += dy;
                                if (instance.type === 'polygon') {
                                    instance.points = instance.points.map((p: any) => ({
                                        anchor: [p.anchor[0] + dx, p.anchor[1] + dy],
                                        handle1: [p.handle1[0] + dx, p.handle1[1] + dy],
                                        handle2: [p.handle2[0] + dx, p.handle2[1] + dy]
                                    }));
                                } else if (instance.type === 'line') {
                                    instance.x1 += dx; instance.y1 += dy;
                                    instance.x2 += dx; instance.y2 += dy;
                                } else if (instance.type === 'path') {
                                    instance.points = instance.points.map((p: any) => [p[0]+dx, p[1]+dy]);
                                }

                                explodedObjects.push(instance);
                            }
                        }
                    }
                }
            }
        });

        layer.objects.forEach(obj => {
            if (ownedObjectIds.has(obj.id) || obj.type === 'path-group' || obj.type === 'flow-guide') return;
            processObject(obj, layerName);
        });

        explodedObjects.forEach(obj => {
            processObject(obj, layerName);
        });
    });

    const entitiesSection = `0\nSECTION\n2\nENTITIES\n${dxfEntities.join('')}0\nENDSEC\n`;
    const eof = `0\nEOF\n`;

    return header + tablesSection + entitiesSection + eof;
};

/**
 * Generates a complete SVG string representation of the current application state.
 * Includes all vector objects, layers, text, images, and clipping paths.
 * Adds physical units to the root SVG element to ensure correct scaling in external software.
 * 
 * @param appState - The current state of the application.
 * @param units - The current units (mm, in, px).
 * @param options - Export options (e.g., inverted colors, include measurements).
 * @returns A string containing the full SVG document.
 */
export const generateSVGString = (appState: AppState, units: Units, options: { inverted: boolean, includeMeasurements: boolean }): string => {
    const { layers, canvasConfig } = appState;
    const { width, height } = canvasConfig;
    
    // Calculate attributes for physical size if units are specified.
    // We assume internal resolution is 96 DPI (web standard).
    // IMPORTANT: The physical dimensions (mm or inches) represent the "real world" size of the artwork.
    // These values are calculated from the original 96-DPI pixel count because our internal coordinate system is 96-DPI based.
    // Changing the target DPI changes the pixel resolution (viewBox) but NOT the physical size.
    let widthAttr = `${width}`;
    let heightAttr = `${height}`;
    
    if (units === 'mm') {
        const wMM = (width * 25.4) / 96;
        const hMM = (height * 25.4) / 96;
        widthAttr = `${wMM.toFixed(2)}mm`;
        heightAttr = `${hMM.toFixed(2)}mm`;
    } else if (units === 'in') {
        const wIn = width / 96;
        const hIn = height / 96;
        widthAttr = `${wIn.toFixed(2)}in`;
        heightAttr = `${hIn.toFixed(2)}in`;
    }

    const scaleFactor = units === 'mm' ? (25.4 / 96) : (units === 'in' ? 1/96 : 1);
    
    // The viewBox defines the coordinate system of the SVG.
    const viewBoxWidth = width;
    const viewBoxHeight = height;

    let defs = '';
    let content = '';

    const addDef = (defString: string) => {
        if (!defs.includes(defString)) {
            defs += defString;
        }
    };

    const renderObjectToString = (obj: VectorObject, layerId: string, originalIdForGradient?: string, layerForRef?: Layer) => {
        if (!options.includeMeasurements && obj.type === 'measurement') return '';

        const isGradient = typeof obj.fill === 'object' && obj.fill !== null;
        let fillProp = 'none';
        const idForGradient = originalIdForGradient || obj.id;

        if (isGradient) {
            const gradient = obj.fill as Gradient;
            const gradientId = `grad-${layerId}-${idForGradient}`;
            fillProp = `url(#${gradientId})`;

            const stops = gradient.stops.map(stop => `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}" />`).join('');

            if (gradient.type === 'linear') {
                if (gradient.units === 'userSpaceOnUse' && gradient.coords) {
                   addDef(`<linearGradient id="${gradientId}" x1="${gradient.coords.x1}" y1="${gradient.coords.y1}" x2="${gradient.coords.x2}" y2="${gradient.coords.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
                } else {
                   const angleRad = (gradient.angle - 90) * Math.PI / 180;
                   const x1 = 0.5 - Math.cos(angleRad) * 0.5, y1 = 0.5 - Math.sin(angleRad) * 0.5;
                   const x2 = 0.5 + Math.cos(angleRad) * 0.5, y2 = 0.5 + Math.sin(angleRad) * 0.5;
                   addDef(`<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="objectBoundingBox">${stops}</linearGradient>`);
                }
            } else { // radial
                addDef(`<radialGradient id="${gradientId}" cx="${gradient.cx}" cy="${gradient.cy}" r="${gradient.r}" gradientUnits="objectBoundingBox">${stops}</radialGradient>`);
            }
        } else {
            fillProp = obj.fill as string;
        }

        const baseProps = `id="${layerId}-obj-${obj.id}" fill="${fillProp}" stroke="${obj.stroke}" stroke-width="${obj.strokeWidth}" ` +
            (obj.strokeLinecap ? `stroke-linecap="${obj.strokeLinecap}" ` : '') +
            (obj.strokeLinejoin ? `stroke-linejoin="${obj.strokeLinejoin}" ` : '') +
            (obj.strokeDasharray ? `stroke-dasharray="${obj.strokeDasharray}" ` : '') +
            (obj.strokeDashoffset ? `stroke-dashoffset="${obj.strokeDashoffset}" ` : '') +
            `opacity="${obj.opacity}" fill-opacity="${obj.fillOpacity}" stroke-opacity="${obj.strokeOpacity}" `;

        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        let transform = `translate(${cx}, ${cy}) rotate(${obj.rotation})`;
        if (obj.skewX) transform += ` skewX(${obj.skewX})`;
        if (obj.skewY) transform += ` skewY(${obj.skewY})`;
        if (obj.flipX) transform += ` scale(-1, 1)`;
        if (obj.flipY) transform += ` scale(1, -1)`;
        transform += ` translate(${-cx}, ${-cy})`;

        const getStyle = (extraStyle: string = '') => {
            return `style="mix-blend-mode: ${obj.blendMode}; ${extraStyle}"`;
        };

        switch (obj.type) {
            case 'polygon': {
                const pathData = getPolygonPathWithCurves(obj.points, obj.isClosed);
                return pathData ? `<path ${baseProps} ${getStyle()} d="${escapeXml(pathData)}" transform="${transform}" />` : '';
            }
            case 'path': {
                const pathData = getSmoothedPolylinePath(obj.points, (obj as PathObject).smoothing ?? 0);
                return pathData ? `<path ${baseProps} ${getStyle()} d="${escapeXml(pathData)}" transform="${transform}" />` : '';
            }
            case 'line': {
                return `<line ${baseProps} ${getStyle()} x1="${obj.x1}" y1="${obj.y1}" x2="${obj.x2}" y2="${obj.y2}" transform="${transform}" />`;
            }
            case 'text': {
                const lineHeight = obj.lineHeight ?? 1.2;
                const letterSpacingProp = obj.letterSpacing ? `letter-spacing="${obj.letterSpacing}"` : '';
                
                if (obj.textPathId) {
                    const textStyle = "paint-order: stroke; white-space: pre;";
                    const pathId = `${layerId}-obj-${obj.textPathId}`;
                    const textPathContent = `<textPath href="#${pathId}" startOffset="${obj.textPathStartOffset || 0}%" text-anchor="${obj.textPathAlign || 'start'}" side="${obj.textPathSide || 'left'}">${escapeXml(obj.text)}</textPath>`;
                    return `<text ${baseProps} ${letterSpacingProp} ${getStyle(textStyle)} font-size="${obj.fontSize}" font-family="${obj.fontFamily}" font-weight="${obj.fontWeight}">${textPathContent}</text>`;
                }
                
                if (obj.isForeignObject) {
                    const foreignStyle = `
                        font-family: ${obj.fontFamily};
                        font-size: ${obj.fontSize}px;
                        font-weight: ${obj.fontWeight};
                        line-height: ${lineHeight};
                        letter-spacing: ${obj.letterSpacing ? obj.letterSpacing + 'px' : 'normal'};
                        color: ${typeof obj.fill === 'string' ? obj.fill : '#000'};
                        background-color: ${obj.backgroundColor || 'transparent'};
                        width: 100%;
                        height: 100%;
                        padding: 10px;
                        box-sizing: border-box;
                        display: flex;
                        text-align: ${obj.textAlign || 'left'};
                        justify-content: ${obj.textAlign === 'center' ? 'center' : 'flex-start'};
                        align-items: ${obj.verticalAlign === 'middle' ? 'center' : 'flex-start'};
                        word-wrap: break-word;
                        white-space: pre-wrap;
                        mix-blend-mode: ${obj.blendMode};
                    `;
                    return `<foreignObject ${baseProps} x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" transform="${transform}">
                        <div xmlns="http://www.w3.org/1999/xhtml" style="${foreignStyle}">${escapeXml(obj.text)}</div>
                    </foreignObject>`;
                } else {
                    const textStyle = "paint-order: stroke; white-space: pre;";
                    const lines = obj.text.split('\n').map((line, index) => 
                        `<tspan x="${obj.x}" dy="${index === 0 ? 0 : lineHeight + 'em'}">${escapeXml(line || ' ')}</tspan>`
                    ).join('');
                    return `<text ${baseProps} ${letterSpacingProp} ${getStyle(textStyle)} x="${obj.x}" y="${obj.y}" font-size="${obj.fontSize}" font-family="${obj.fontFamily}" font-weight="${obj.fontWeight}" transform="${transform}" dominant-baseline="hanging">${lines}</text>`;
                }
            }
            case 'shape': {
                const pathData = getShapePath(obj.shapeType, obj.width, obj.height, obj.cornerRadius);
                const shapeTransform = `translate(${obj.x}, ${obj.y}) translate(${obj.width/2}, ${obj.height/2}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) ${obj.flipX ? 'scale(-1, 1) ' : ''}${obj.flipY ? 'scale(1, -1) ' : ''}translate(${-obj.width/2}, ${-obj.height/2})`;
                return `<path ${baseProps} ${getStyle()} d="${escapeXml(pathData)}" transform="${shapeTransform}" />`;
            }
            case 'generic-path': {
                const originalBounds = calculateGenericPathBounds(obj.d);
                const scaleX = originalBounds.width > 0 ? obj.width / originalBounds.width : 1;
                const scaleY = originalBounds.height > 0 ? obj.height / originalBounds.height : 1;
                const dx = obj.x - originalBounds.x * scaleX;
                const dy = obj.y - originalBounds.y * scaleY;

                const rotCenterX = obj.x + obj.width / 2;
                const rotCenterY = obj.y + obj.height / 2;

                const transformStr = `translate(${rotCenterX}, ${rotCenterY}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) ${obj.flipX ? 'scale(-1, 1) ' : ''}${obj.flipY ? 'scale(1, -1) ' : ''}translate(${-rotCenterX}, ${-rotCenterY}) translate(${dx}, ${dy}) scale(${scaleX}, ${scaleY})`;
                return `<path ${baseProps} ${getStyle()} d="${escapeXml(obj.d)}" transform="${transformStr}" />`;
            }
             case 'image': {
                return `<image ${baseProps} ${getStyle()} href="${obj.href}" x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" transform="${transform}" preserveAspectRatio="none" />`;
            }
        case 'measurement': {
                const mObj = obj as MeasurementObject;
                const { x1, y1, x2, y2, showLength, showAngle, fontSize, fontFamily, fontWeight, stroke, strokeWidth, strokeOpacity, textColor, measurementType, referenceId } = mObj;
                
                // Get reference object if available to recalculate dynamic values (Area, etc)
                let refObj: VectorObject | undefined;
                if (referenceId && layerForRef) {
                    refObj = layerForRef.objects.find(o => o.id === referenceId);
                }

                let label = 'Measurement';
                let displayVal = 0;

                const getSmartValue = (): number | null => {
                    if (!refObj) return null;
                    
                    if (measurementType === 'area') {
                        if (refObj.type === 'shape') {
                            if (refObj.shapeType === 'ellipse' || refObj.shapeType === 'ring') {
                                return Math.PI * (refObj.width / 2) * (refObj.height / 2) * scaleFactor * scaleFactor;
                            }
                            return refObj.width * refObj.height * scaleFactor * scaleFactor;
                        } else if (refObj.type === 'polygon') {
                            return calculatePolygonArea(refObj.points.map(p => p.anchor)) * scaleFactor * scaleFactor;
                        }
                        const b = getObjectVisualBounds(refObj);
                        return b.width * b.height * scaleFactor * scaleFactor;
                    }

                    if (measurementType === 'perimeter') {
                         let lenPx = 0;
                         if (refObj.type === 'path' || refObj.type === 'generic-path' || refObj.type === 'shape' || refObj.type === 'line') {
                             const d = getSVGPathFromObject(refObj);
                             if (d) lenPx = getPathTotalLength(d);
                         } else if (refObj.type === 'polygon') {
                             lenPx = calculatePolygonPerimeter(refObj.points.map(p => p.anchor), refObj.isClosed);
                         }
                         return lenPx * scaleFactor;
                    }

                    let dimension = 0;
                    if ('width' in refObj) dimension = refObj.width;
                    else {
                        const b = getObjectVisualBounds(refObj);
                        dimension = b.width;
                    }
                    
                    if (measurementType === 'radius') return (dimension / 2) * scaleFactor;
                    if (measurementType === 'diameter') return dimension * scaleFactor;
                    if (measurementType === 'circumference') {
                         if (refObj.type === 'shape' && (refObj.shapeType === 'ellipse' || refObj.shapeType === 'ring')) {
                             const a = refObj.width / 2;
                             const b = refObj.height / 2;
                             return (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))) * scaleFactor;
                         }
                         return Math.PI * dimension * scaleFactor;
                    }
                    return null;
                };

                const smartValue = getSmartValue();

                if (mObj.measurementType === 'area' || mObj.measurementType === 'perimeter') {
                    const val = smartValue !== null ? smartValue : 0;
                    const manualDist = Math.sqrt((x2-x1)**2 + (y2-y1)**2) * scaleFactor;
                    displayVal = (mObj.measurementType === 'perimeter' && !refObj) ? manualDist : val;
                    
                    const prefix = mObj.measurementType === 'area' ? 'A' : 'P';
                    const unitSuffix = mObj.measurementType === 'area' ? '²' : '';
                    label = `${prefix}: ${displayVal.toFixed(2)} ${units}${unitSuffix}`;
                    return `<text x="${mObj.x1}" y="${mObj.y1}" fill="${mObj.textColor}" stroke="white" stroke-width="3" font-size="${mObj.fontSize}" font-family="${mObj.fontFamily}" text-anchor="middle" dominant-baseline="middle" paint-order="stroke">${escapeXml(label)}</text>`;
                } else {
                    // Distance/Line based
                    const dx = mObj.x2 - mObj.x1;
                    const dy = mObj.y2 - mObj.y1;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
                    let textRot = angleDeg;
                    let isFlipped = false;
                    if (textRot > 90) { textRot -= 180; isFlipped = true; }
                    if (textRot < -90) { textRot += 180; isFlipped = true; }
                    
                    if (['radius', 'diameter', 'circumference'].includes(mObj.measurementType)) {
                        const manualVal = len * scaleFactor;
                        let val = 0;
                        if (mObj.measurementType === 'radius') val = refObj ? smartValue! : manualVal;
                        else if (mObj.measurementType === 'diameter') val = refObj ? smartValue! : manualVal;
                        else val = refObj ? smartValue! : (Math.PI * manualVal);

                        const prefix = mObj.measurementType === 'radius' ? 'R' : (mObj.measurementType === 'diameter' ? 'Ø' : 'C');
                        label = `${prefix}: ${val.toFixed(2)} ${units}`;
                    } else {
                        const lengthVal = len * scaleFactor;
                        const labelParts = [];
                        if (mObj.showLength) labelParts.push(`${lengthVal.toFixed(2)} ${units}`);
                        if (mObj.showAngle) labelParts.push(`${angleDeg.toFixed(1)}°`);
                        label = labelParts.join('  ');
                    }

                    const midX = (mObj.x1 + mObj.x2) / 2;
                    const midY = (mObj.y1 + mObj.y2) / 2;
                    
                    const userOffset = mObj.measurementOffset ?? 20;
                    const transformAmount = isFlipped ? userOffset : -userOffset;
                    
                    const px = -dy / len;
                    const py = dx / len;
                    const tickSize = 5;

                    return `<g opacity="${mObj.opacity}">
                        <line x1="${mObj.x1}" y1="${mObj.y1}" x2="${mObj.x2}" y2="${mObj.y2}" stroke="${mObj.stroke}" stroke-width="${mObj.strokeWidth}" opacity="${mObj.strokeOpacity}" />
                        <line x1="${mObj.x1 - px * tickSize}" y1="${mObj.y1 - py * tickSize}" x2="${mObj.x1 + px * tickSize}" y2="${mObj.y1 + py * tickSize}" stroke="${mObj.stroke}" stroke-width="${mObj.strokeWidth}" />
                        <line x1="${mObj.x2 - px * tickSize}" y1="${mObj.y2 - py * tickSize}" x2="${mObj.x2 + px * tickSize}" y2="${mObj.y2 + py * tickSize}" stroke="${mObj.stroke}" stroke-width="${mObj.strokeWidth}" />
                        <text x="${midX}" y="${midY}" fill="${mObj.textColor}" stroke="white" stroke-width="3" font-size="${mObj.fontSize}" font-family="${mObj.fontFamily}" text-anchor="middle" transform="rotate(${textRot}, ${midX}, ${midY}) translate(0, ${transformAmount})" paint-order="stroke">${escapeXml(label)}</text>
                    </g>`;
                }
            }
            default: return '';
        }
    };
    
    layers.forEach(layer => {
        if (!layer.visible) return;
        
        let layerContent = '';

        if (layer.useClipping && layer.isClipPolygonClosed && layer.clipPolygonPoints.length > 2) {
            let clipD = getPolygonPathWithCurves(layer.clipPolygonPoints, true);
            if (layer.clipMode === 'inverted') {
                 const w = width + 2, h = height + 2;
                 clipD = `M-1,-1 H${w} V${h} H-1 Z ${clipD}`;
            }
            addDef(`<clipPath id="clip-${layer.id}"><path d="${escapeXml(clipD)}" fill-rule="${layer.clipMode === 'inverted' ? 'evenodd' : 'nonzero'}" /></clipPath>`);
        }
        
        const ownedObjectIds = new Set<string>();
        layer.objects.forEach(o => {
            if (o.type === 'path-group') {
                ownedObjectIds.add(o.pathId);
                o.templateObjectIds.forEach(id => ownedObjectIds.add(id));
            }
        });

        const objectsToRender: {obj: VectorObject, originalId?: string}[] = [];
        layer.objects.forEach(obj => {
            if (ownedObjectIds.has(obj.id)) return;
            if (obj.type === 'flow-guide') return;

            if (obj.type === 'path-group') {
                const pathObject = layer.objects.find(o => o.id === obj.pathId);
                if (!pathObject) return;

                objectsToRender.push({obj: pathObject});

                const templateObjects = obj.templateObjectIds.map(id => layer.objects.find(o => o.id === id)).filter(Boolean) as VectorObject[];
                if (templateObjects.length === 0) return;

                const pathD = getSVGPathFromObject(pathObject);
                if (!pathD) return;

                const totalLength = getPathTotalLength(pathD);
                if (totalLength === 0) return;
                
                const isPathClosed = pathD.trim().endsWith('Z') || pathD.trim().endsWith('z');
                const { distributionMode, count, distance, startOffset, endOffset, alignToPath, rotationOffset = 0, perpendicularOffset = 0 } = obj.settings;
                const pathStart = totalLength * Math.max(0, Math.min(1, startOffset));
                const pathEnd = totalLength * Math.max(0, Math.min(1, endOffset));
                const effectiveLength = Math.max(0, pathEnd - pathStart);
                
                const numInstances = distributionMode === 'count' ? count : (distance > 0 ? Math.floor(effectiveLength / distance) + 1 : 0);

                if (!Number.isFinite(numInstances) || numInstances < 0) return;

                for (let i = 0; i < numInstances; i++) {
                    let lengthOnPath = 0;
                    if (distributionMode === 'count') {
                        let fraction = 0;
                        if (numInstances > 1) {
                            fraction = i / (numInstances - 1);
                            if (isPathClosed) fraction = i / numInstances;
                        } else {
                            fraction = 0.5;
                        }
                        lengthOnPath = pathStart + (fraction * effectiveLength);
                    } else {
                        lengthOnPath = pathStart + (i * distance);
                    }
                    
                    if (lengthOnPath > pathEnd + 0.01) break;

                    const posAndTan = getPointAndTangentAtLength(pathD, lengthOnPath);
                    if (!posAndTan) continue;
                    const { point, angle } = posAndTan;

                    const template = templateObjects[i % templateObjects.length];
                    if (!template) continue;
                    
                    const instanceObject = JSON.parse(JSON.stringify(template));
                    instanceObject.id = `${obj.id}-inst-${i}-tpl-${template.id}`; 
                    instanceObject.rotation = (alignToPath ? template.rotation + angle : template.rotation) + rotationOffset;

                    // Calculate perpendicular offset
                    const normalRad = (angle + 90) * Math.PI / 180;
                    const offsetX = Math.cos(normalRad) * perpendicularOffset;
                    const offsetY = Math.sin(normalRad) * perpendicularOffset;

                    const dx = point[0] - (template.x + template.width / 2) + offsetX;
                    const dy = point[1] - (template.y + template.height / 2) + offsetY;

                    instanceObject.x += dx;
                    instanceObject.y += dy;
                    
                    if (instanceObject.type === 'polygon') {
                        instanceObject.points = (template as PolygonObject).points.map((p: any) => ({
                            anchor: [p.anchor[0] + dx, p.anchor[1] + dy],
                            handle1: [p.handle1[0] + dx, p.handle1[1] + dy],
                            handle2: [p.handle2[0] + dx, p.handle2[1] + dy],
                        }));
                    } else if ((instanceObject.type === 'path' || instanceObject.type === 'flow-guide')) {
                        instanceObject.points = (template as PathObject).points.map((p: any) => [p[0] + dx, p[1] + dy]);
                    } else if (instanceObject.type === 'line') {
                        (instanceObject as LineObject).x1 += dx;
                        (instanceObject as LineObject).y1 += dy;
                        (instanceObject as LineObject).x2 += dx;
                        (instanceObject as LineObject).y2 += dy;
                    }
                    
                    objectsToRender.push({obj: instanceObject, originalId: template.id});
                }
                
            } else {
                objectsToRender.push({obj});
            }
        });

        objectsToRender.forEach(({obj, originalId}) => {
            layerContent += renderObjectToString(obj, layer.id, originalId, layer);
        });

        const layerTransform = `translate(${layer.offsetX + width / 2}, ${layer.offsetY + height / 2}) rotate(${layer.rotation || 0}) scale(${layer.scale || 1}) skewX(${layer.skewX || 0}) skewY(${layer.skewY || 0}) translate(${-width/2}, ${-height/2})`;
        
        content += `<g transform="${layerTransform}" clip-path="${layer.useClipping && layer.isClipPolygonClosed ? `url(#clip-${layer.id})` : ''}" style="mix-blend-mode: ${layer.blendMode === 'normal' ? 'none' : layer.blendMode};">${layerContent}</g>`;
    });

    const filterAttr = options.inverted ? ' filter="url(#invert)"' : '';
    const contentWrapperStart = `<g${filterAttr}>`;
    
    const filter = options.inverted ? `<filter id="invert"><feColorMatrix in="SourceGraphic" type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>` : '';
    let canvasClipPath = '';
    let contentWrapperEnd = '</g>';
    
    if (canvasConfig.clipToCanvas) {
        canvasClipPath = `<clipPath id="canvas-clip"><rect width="${width}" height="${height}" /></clipPath>`;
        content = `<g clip-path="url(#canvas-clip)">${content}</g>`;
    }

    // Determine Google Fonts used dynamically
    const usedGoogleFonts = new Set<string>();
    layers.forEach(layer => {
        if (layer.settings.patternType === 'words' && googleFonts.includes(layer.settings.wordFontFamily)) {
            usedGoogleFonts.add(layer.settings.wordFontFamily);
        }
        layer.objects.forEach(obj => {
            if (obj.type === 'text' && googleFonts.includes((obj as TextObject).fontFamily)) {
                usedGoogleFonts.add((obj as TextObject).fontFamily);
            }
            if (obj.type === 'measurement' && googleFonts.includes((obj as MeasurementObject).fontFamily)) {
                usedGoogleFonts.add((obj as MeasurementObject).fontFamily);
            }
        });
    });

    let fontImportStyles = '';
    if (usedGoogleFonts.size > 0) {
        fontImportStyles += '<style type="text/css"><![CDATA[\n';
        usedGoogleFonts.forEach(font => {
            const fontUrl = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            fontImportStyles += `@import url('${fontUrl}');\n`;
        });
        fontImportStyles += ']]></style>';
    }

    return `<svg width="${widthAttr}" height="${heightAttr}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<defs>${filter}${canvasClipPath}${fontImportStyles}${defs}</defs>` +
        `<rect width="100%" height="100%" fill="white"/>` +
        contentWrapperStart +
        content +
        contentWrapperEnd +
        `</svg>`;
};

/**
 * Utility to convert an ArrayBuffer directly to a binary Base64 string safely.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Asynchronously preloads any Google Fonts used in the project and embeds them as Base64-encoded Data URIs.
 * This is critical for canvas-based exports (like PNG/PDF) where external webfont CSS gets sandboxed by the standard img loading lifecycle.
 */
export async function inlineFontsInSVG(svgString: string, appState: AppState): Promise<string> {
    const { layers } = appState;
    const usedGoogleFonts = new Set<string>();
    
    layers.forEach(layer => {
        if (layer.settings.patternType === 'words' && googleFonts.includes(layer.settings.wordFontFamily)) {
            usedGoogleFonts.add(layer.settings.wordFontFamily);
        }
        layer.objects.forEach(obj => {
            if (obj.type === 'text' && googleFonts.includes((obj as TextObject).fontFamily)) {
                usedGoogleFonts.add((obj as TextObject).fontFamily);
            }
            if (obj.type === 'measurement' && googleFonts.includes((obj as MeasurementObject).fontFamily)) {
                usedGoogleFonts.add((obj as MeasurementObject).fontFamily);
            }
        });
    });

    if (usedGoogleFonts.size === 0) {
        return svgString;
    }

    let embeddedStyles = '';

    for (const fontFamily of usedGoogleFonts) {
        try {
            const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
            const cssResponse = await fetch(cssUrl);
            if (!cssResponse.ok) continue;
            let cssText = await cssResponse.text();

            // Find all font URLs in the CSS
            const urlCleanRegex = /url\(([^)]+)\)/g;
            let match;
            const parsedUrls = new Set<string>();
            while ((match = urlCleanRegex.exec(cssText)) !== null) {
                const rawUrl = match[1].replace(/['"]/g, '').trim();
                if (rawUrl.startsWith('http')) {
                    parsedUrls.add(rawUrl);
                }
            }

            for (const url of parsedUrls) {
                try {
                    const fontResponse = await fetch(url);
                    if (!fontResponse.ok) continue;
                    const fontBuffer = await fontResponse.arrayBuffer();
                    const base64 = arrayBufferToBase64(fontBuffer);
                    const format = url.endsWith('.woff2') ? 'woff2' : url.endsWith('.woff') ? 'woff' : url.endsWith('.ttf') ? 'truetype' : 'woff2';
                    const dataUri = `data:font/${format};base64,${base64}`;
                    
                    cssText = cssText.split(url).join(dataUri);
                } catch (err) {
                    console.error(`Failed to fetch font file from url: ${url}`, err);
                }
            }
            embeddedStyles += `${cssText}\n`;
        } catch (e) {
            console.error(`Failed to inline font: ${fontFamily}`, e);
        }
    }

    if (embeddedStyles) {
        const styleBlock = `<style type="text/css"><![CDATA[\n${embeddedStyles}\n]]></style>`;
        
        // Find </defs> and insert the base64 styles just before it
        if (svgString.includes('</defs>')) {
            return svgString.replace('</defs>', `${styleBlock}</defs>`);
        } else {
            return svgString.replace('<svg ', `<svg><style type="text/css"><![CDATA[\n${embeddedStyles}\n]]></style>`);
        }
    }

    return svgString;
}
