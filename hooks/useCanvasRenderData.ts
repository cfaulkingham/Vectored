
import React, { useMemo } from 'react';
import type { Layer, RenderableElement, Gradient, TextObject, PathObject, GenericPathObject, ImageObject, VectorObject, PolygonObject, LineObject, FlowGuideObject, PathGroupObject, MeasurementObject, Units } from '../types';
import { getPolygonPathWithCurves, getSmoothedPolylinePath, getShapePath, calculateGenericPathBounds, getSVGPathFromObject, getPathTotalLength, getPointAndTangentAtLength, calculatePolygonArea, calculatePolygonPerimeter, getObjectVisualBounds } from '../lib/geometry';

interface UseCanvasRenderDataProps {
  /** List of layers to be rendered */
  layers: Layer[];
  /** Current canvas configuration (width, height) */
  canvasConfig: { width: number; height: number };
  /** Measurement units (mm or inches) for label scaling */
  units: Units;
  /** Dots Per Inch for unit conversion */
  dpi: number;
}

/**
 * Custom hook that prepares the rendering data for the canvas.
 * It processes the application state (layers, objects) and converts it into
 * a structure of React Elements (SVG paths, shapes, text, etc.) suitable for rendering.
 * Handles complex logic like gradients, clipping paths, and path groups.
 *
 * @param props.layers - The list of layers to render.
 * @param props.canvasConfig - The configuration of the canvas (width, height).
 * @param props.units - The current unit system (mm or in).
 * @param props.dpi - The dots per inch setting for conversion.
 * @returns An object containing:
 * - `defs`: An array of React elements for SVG definitions (gradients, clips).
 * - `layers`: An array of objects, each containing the layer data and its rendered elements.
 */
export const useCanvasRenderData = ({ layers, canvasConfig, units, dpi }: UseCanvasRenderDataProps) => {
  const { width: contentWidth, height: contentHeight } = canvasConfig;

  const renderData = useMemo(() => {
    const defs: React.ReactElement[] = [];
    const layerData: { layer: Layer; elements: RenderableElement[] }[] = [];

    layers.forEach((layer) => {
        if (!layer.visible) return;

        if (layer.useClipping && layer.isClipPolygonClosed && layer.clipPolygonPoints.length > 2) {
            let clipD = getPolygonPathWithCurves(layer.clipPolygonPoints, true);

            if (layer.clipMode === 'inverted') {
                 const w = contentWidth + 2;
                 const h = contentHeight + 2;
                 const fullCanvasRectForInvert = `M-1,-1 H${w} V${h} H-1 Z`;
                 clipD = `${fullCanvasRectForInvert} ${clipD}`;
            }
            defs.push(
                React.createElement('clipPath', { key: `clip-${layer.id}`, id: `clip-${layer.id}` },
                    React.createElement('path', { d: clipD, fillRule: layer.clipMode === 'inverted' ? 'evenodd' : 'nonzero' })
                )
            );
        }

        const elements: RenderableElement[] = [];
        
        // Identify objects owned by path-groups to hide them from main loop
        const ownedObjectIds = new Set<string>();
        layer.objects.forEach(o => {
            if (o.type === 'path-group') {
                ownedObjectIds.add(o.pathId);
                o.templateObjectIds.forEach(id => ownedObjectIds.add(id));
            }
        });

        // Helper function to render a single VectorObject
        const processRenderableObject = (obj: VectorObject, keyOverride?: string): RenderableElement | null => {
            if (obj.visible === false) return null;
            
            const isGradient = typeof obj.fill === 'object' && obj.fill !== null;
            let fillProp: string | undefined = undefined;
            const objectKey = keyOverride || `${layer.id}-obj-${obj.id}`;

            if (isGradient) {
                const gradient = obj.fill as Gradient;
                const gradientId = `grad-${objectKey}`;
                fillProp = `url(#${gradientId})`;

                if (gradient.type === 'linear') {
                    if (gradient.units === 'userSpaceOnUse' && gradient.coords) {
                        defs.push(
                            React.createElement('linearGradient', 
                                { 
                                    key: gradientId, 
                                    id: gradientId, 
                                    x1: gradient.coords.x1, 
                                    y1: gradient.coords.y1, 
                                    x2: gradient.coords.x2, 
                                    y2: gradient.coords.y2, 
                                    gradientUnits: "userSpaceOnUse"
                                },
                                gradient.stops.map((stop, i) => (
                                    React.createElement('stop', { key: i, offset: `${stop.offset * 100}%`, stopColor: stop.color })
                                ))
                            )
                        );
                    } else {
                        const angleRad = (gradient.angle - 90) * Math.PI / 180;
                        const x1 = 0.5 - Math.cos(angleRad) * 0.5;
                        const y1 = 0.5 - Math.sin(angleRad) * 0.5;
                        const x2 = 0.5 + Math.cos(angleRad) * 0.5;
                        const y2 = 0.5 + Math.sin(angleRad) * 0.5;
                        defs.push(
                            React.createElement('linearGradient', { key: gradientId, id: gradientId, x1, y1, x2, y2, gradientUnits: "objectBoundingBox" },
                                gradient.stops.map((stop, i) => (
                                    React.createElement('stop', { key: i, offset: `${stop.offset * 100}%`, stopColor: stop.color })
                                ))
                            )
                        );
                    }
                } else { // radial
                    defs.push(
                        React.createElement('radialGradient', { key: gradientId, id: gradientId, cx: gradient.cx, cy: gradient.cy, r: gradient.r, gradientUnits: "objectBoundingBox" },
                             gradient.stops.map((stop, i) => (
                                React.createElement('stop', { key: i, offset: `${stop.offset * 100}%`, stopColor: stop.color })
                            ))
                        )
                    );
                }
            } else {
                fillProp = obj.fill as string;
            }

            const baseProps = {
                fill: fillProp,
                stroke: obj.stroke,
                strokeWidth: obj.strokeWidth,
                strokeLinecap: obj.strokeLinecap,
                strokeLinejoin: obj.strokeLinejoin,
                strokeDasharray: obj.strokeDasharray,
                strokeDashoffset: obj.strokeDashoffset,
                opacity: obj.opacity,
                fillOpacity: obj.fillOpacity,
                strokeOpacity: obj.strokeOpacity,
                style: { 
                    mixBlendMode: obj.blendMode,
                    pointerEvents: obj.isLocked ? 'none' : 'auto'
                }
            };
            
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            let transform = `translate(${cx}, ${cy}) rotate(${obj.rotation})`;
            if (obj.skewX) transform += ` skewX(${obj.skewX})`;
            if (obj.skewY) transform += ` skewY(${obj.skewY})`;
            // Apply flip transforms
            if (obj.flipX) transform += ` scale(-1, 1)`;
            if (obj.flipY) transform += ` scale(1, -1)`;
            
            transform += ` translate(${-cx}, ${-cy})`;

            if (obj.type === 'polygon') {
                const pathData = getPolygonPathWithCurves(obj.points, obj.isClosed);
                if (pathData) {
                    const props = { ...baseProps, d: pathData, transform };
                    return {key: objectKey, type: 'path', props};
                }
            } else if (obj.type === 'path') {
                const pathData = getSmoothedPolylinePath(obj.points, (obj as PathObject).smoothing ?? 0);
                if (pathData) {
                    const props = { ...baseProps, d: pathData, transform };
                    return {key: objectKey, type: 'path', props};
                }
            } else if (obj.type === 'flow-guide') {
                const pathData = getSmoothedPolylinePath(obj.points, 0);
                if (pathData) {
                    const props = {
                        d: pathData,
                        fill: 'none',
                        stroke: 'rgba(192, 132, 252, 0.8)',
                        strokeWidth: 1.5,
                        strokeDasharray: '4 4'
                    };
                    return {key: objectKey, type: 'path', props};
                }
            } else if (obj.type === 'line') {
                const props = { ...baseProps, x1: obj.x1, y1: obj.y1, x2: obj.x2, y2: obj.y2, transform };
                return {key: objectKey, type: 'line', props};
            } else if (obj.type === 'measurement') {
                const mObj = obj as MeasurementObject;
                const { x1, y1, x2, y2, showLength, showAngle, fontSize, fontFamily, fontWeight, stroke, strokeWidth, strokeOpacity, textColor, measurementType, referenceId } = mObj;
                
                // Get reference object if available to recalculate dynamic values (Area, etc)
                let refObj: VectorObject | undefined;
                if (referenceId) {
                    refObj = layer.objects.find(o => o.id === referenceId);
                }

                const groupChildren: React.ReactElement[] = [];
                const textStyle: React.CSSProperties = { paintOrder: 'stroke', whiteSpace: 'pre', pointerEvents: 'none', userSelect: 'none' };
                const scaleFactor = units === 'mm' ? (25.4 / dpi) : (units === 'in' ? 1/dpi : 1);

                // Helper to get smart value from reference object
                const getSmartValue = (): number | null => {
                    if (!refObj) return null;
                    
                    // 1. Area
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

                    // 2. Perimeter / Length
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

                    // 3. Radius / Diameter / Circumference
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
                             // Ramanujan Approx
                             return (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))) * scaleFactor;
                         }
                         return Math.PI * dimension * scaleFactor;
                    }
                    return null;
                };

                const smartValue = getSmartValue();
                
                // --- Render based on type ---
                
                if (measurementType === 'area' || measurementType === 'perimeter') {
                    const val = smartValue !== null ? smartValue : 0;
                    // Fallback manual calc for perimeter if not smart
                    const manualDist = Math.sqrt((x2-x1)**2 + (y2-y1)**2) * scaleFactor;
                    const displayVal = (measurementType === 'perimeter' && !refObj) ? manualDist : val;
                    
                    const prefix = measurementType === 'area' ? 'A' : 'P';
                    const unitSuffix = measurementType === 'area' ? '²' : '';
                    const label = `${prefix}: ${displayVal.toFixed(2)} ${units}${unitSuffix}`;
                    
                    groupChildren.push(React.createElement('text', {
                        key: 'label',
                        x: x1,
                        y: y1,
                        fill: textColor,
                        stroke: 'rgba(255,255,255,0.8)',
                        strokeWidth: 3,
                        fontSize,
                        fontFamily,
                        fontWeight,
                        textAnchor: 'middle',
                        dominantBaseline: 'middle',
                        style: textStyle,
                    }, label));

                } else if (['radius', 'diameter', 'circumference'].includes(measurementType)) {
                    const dx_orig = x2 - x1;
                    const dy_orig = y2 - y1;
                    const len = Math.sqrt(dx_orig*dx_orig + dy_orig*dy_orig);
                    const manualVal = len * scaleFactor;
                    
                    let val = 0;
                    if (measurementType === 'radius') val = refObj ? smartValue! : manualVal;
                    else if (measurementType === 'diameter') val = refObj ? smartValue! : manualVal;
                    else val = refObj ? smartValue! : (Math.PI * manualVal);

                    const prefix = measurementType === 'radius' ? 'R' : (measurementType === 'diameter' ? 'Ø' : 'C');
                    const label = `${prefix}: ${val.toFixed(2)} ${units}`;

                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    let angleDeg = Math.atan2(dy_orig, dx_orig) * 180 / Math.PI;
                    
                    let textRot = angleDeg;
                    let isFlipped = false;
                    if (textRot > 90) { textRot -= 180; isFlipped = true; }
                    if (textRot < -90) { textRot += 180; isFlipped = true; }

                    const userOffset = mObj.measurementOffset ?? 20;
                    const transformAmount = isFlipped ? userOffset : -userOffset;

                    groupChildren.push(React.createElement('line', { key: 'main', x1, y1, x2, y2, stroke, strokeWidth, opacity: strokeOpacity, strokeDasharray: mObj.strokeDasharray }));
                    
                    groupChildren.push(React.createElement('text', {
                        key: 'label',
                        x: midX,
                        y: midY,
                        fill: textColor,
                        stroke: 'rgba(255,255,255,0.8)',
                        strokeWidth: 3,
                        fontSize,
                        fontFamily,
                        fontWeight,
                        textAnchor: 'middle',
                        dominantBaseline: 'auto',
                        transform: `rotate(${textRot}, ${midX}, ${midY}) translate(0, ${transformAmount})`,
                        style: textStyle,
                    }, label));

                } else {
                    // Standard Distance Logic
                    const dx_orig = x2 - x1;
                    const dy_orig = y2 - y1;
                    const len = Math.sqrt(dx_orig*dx_orig + dy_orig*dy_orig);
                    
                    if (len > 0) {
                        const originalAngleDeg = Math.atan2(dy_orig, dx_orig) * 180 / Math.PI;

                        // Normalize angle for display
                        let ndx = dx_orig;
                        let ndy = dy_orig;
                        if (ndx < 0 || (ndx === 0 && ndy < 0)) {
                            ndx = -ndx;
                            ndy = -ndy;
                        }
                        const displayAngleDeg = Math.atan2(ndy, ndx) * 180 / Math.PI;
                        const lengthVal = len * scaleFactor;
                        
                        const labelParts = [];
                        if (showLength) labelParts.push(`${lengthVal.toFixed(2)} ${units}`);
                        if (showAngle) labelParts.push(`${displayAngleDeg.toFixed(1)}°`);
                        const text = labelParts.join('  ');
                        
                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        const px = -dy_orig / len;
                        const py = dx_orig / len;
                        const tickSize = 5;

                        let textRot = originalAngleDeg;
                        let isFlipped = false;
                        if (textRot > 90) { textRot -= 180; isFlipped = true; }
                        if (textRot < -90) { textRot += 180; isFlipped = true; }

                        const userOffset = mObj.measurementOffset ?? 20;
                        const transformAmount = isFlipped ? userOffset : -userOffset;

                        groupChildren.push(React.createElement('line', { key: 'main', x1, y1, x2, y2, stroke, strokeWidth, opacity: strokeOpacity, strokeDasharray: mObj.strokeDasharray }));
                        groupChildren.push(React.createElement('line', { key: 'tick1', x1: x1 - px * tickSize, y1: y1 - py * tickSize, x2: x1 + px * tickSize, y2: y1 + py * tickSize, stroke, strokeWidth, opacity: strokeOpacity }));
                        groupChildren.push(React.createElement('line', { key: 'tick2', x1: x2 - px * tickSize, y1: y2 - py * tickSize, x2: x2 + px * tickSize, y2: y2 + py * tickSize, stroke, strokeWidth, opacity: strokeOpacity }));
                        
                        if (text) {
                            groupChildren.push(React.createElement('text', {
                                key: 'label',
                                x: midX,
                                y: midY,
                                fill: textColor,
                                stroke: 'rgba(255,255,255,0.8)',
                                strokeWidth: 3,
                                fontSize,
                                fontFamily,
                                fontWeight,
                                textAnchor: 'middle',
                                dominantBaseline: 'middle',
                                transform: `rotate(${textRot}, ${midX}, ${midY}) translate(0, ${transformAmount})`,
                                style: textStyle,
                            }, text));
                        }
                    }
                }
                
                return { key: objectKey, type: 'g', props: { children: groupChildren, opacity: obj.opacity } };
            } else if (obj.type === 'text') {
                if (obj.isForeignObject) {
                    const style: React.CSSProperties = {
                        fontFamily: obj.fontFamily,
                        fontSize: obj.fontSize,
                        fontWeight: obj.fontWeight,
                        lineHeight: obj.lineHeight ?? 1.2,
                        letterSpacing: obj.letterSpacing ? `${obj.letterSpacing}px` : 'normal',
                        color: typeof obj.fill === 'string' ? obj.fill : '#000',
                        backgroundColor: obj.backgroundColor || 'transparent',
                        width: '100%',
                        height: '100%',
                        padding: '10px',
                        boxSizing: 'border-box',
                        display: 'flex',
                        textAlign: obj.textAlign || 'left',
                        justifyContent: obj.textAlign === 'center' ? 'center' : 'flex-start',
                        alignItems: obj.verticalAlign === 'middle' ? 'center' : 'flex-start',
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                    };
                    const children = React.createElement('div', {
                        xmlns: "http://www.w3.org/1999/xhtml",
                        style: style,
                    }, obj.text);
                    const props = {
                        ...baseProps,
                        x: obj.x,
                        y: obj.y,
                        width: obj.width,
                        height: obj.height,
                        transform,
                        children,
                    };
                    return { key: objectKey, type: 'foreignObject', props };
                } else {
                    const lines = obj.text.split('\n');
                    const lineHeightEm = obj.lineHeight ?? 1.2;
                    const letterSpacingAttr = obj.letterSpacing ?? 0;
                    
                    return {
                        key: objectKey,
                        type: 'text',
                        props: {
                            ...baseProps,
                            x: obj.x,
                            y: obj.y,
                            fontSize: obj.fontSize,
                            fontFamily: obj.fontFamily,
                            fontWeight: obj.fontWeight,
                            letterSpacing: letterSpacingAttr,
                            transform,
                            dominantBaseline: 'hanging',
                            style: { paintOrder: 'stroke', whiteSpace: 'pre', userSelect: 'none', mixBlendMode: obj.blendMode },
                            children: lines.map((line, index) => (
                                React.createElement('tspan', { key: index, x: obj.x, dy: index === 0 ? 0 : `${lineHeightEm}em` }, line || ' ')
                            ))
                        }
                    };
                }
            } else if (obj.type === 'shape') {
                const pathData = getShapePath(obj.shapeType, obj.width, obj.height, obj.cornerRadius);
                const shapeTransform = `translate(${obj.x}, ${obj.y}) translate(${obj.width/2}, ${obj.height/2}) rotate(${obj.rotation}) skewX(${obj.skewX || 0}) skewY(${obj.skewY || 0}) ${obj.flipX ? 'scale(-1, 1) ' : ''}${obj.flipY ? 'scale(1, -1) ' : ''}translate(${-obj.width/2}, ${-obj.height/2})`;
                const props = { ...baseProps, d: pathData, transform: shapeTransform };
                return {key: objectKey, type: 'path', props};
            } else if (obj.type === 'generic-path') {
                const genericPathObj = obj as GenericPathObject;
                const originalBounds = calculateGenericPathBounds(genericPathObj.d);
                const scaleX = originalBounds.width > 0 ? genericPathObj.width / originalBounds.width : 1;
                const scaleY = originalBounds.height > 0 ? genericPathObj.height / originalBounds.height : 1;
                const dx = genericPathObj.x - originalBounds.x * scaleX;
                const dy = genericPathObj.y - originalBounds.y * scaleY;

                const rotCenterX = genericPathObj.x + genericPathObj.width / 2;
                const rotCenterY = genericPathObj.y + genericPathObj.height / 2;

                let transformStr = `translate(${rotCenterX}, ${rotCenterY}) rotate(${obj.rotation}) skewX(${obj.skewY || 0}) skewY(${obj.skewY || 0}) `;
                
                if (obj.flipX) transformStr += `scale(-1, 1) `;
                if (obj.flipY) transformStr += `scale(1, -1) `;
                
                transformStr += `translate(${-rotCenterX}, ${-rotCenterY}) translate(${dx}, ${dy}) scale(${scaleX}, ${scaleY})`;

                return {
                    key: objectKey,
                    type: 'path',
                    props: { ...baseProps, d: genericPathObj.d, transform: transformStr }
                };
            } else if (obj.type === 'image') {
                const imageObj = obj as ImageObject;
                 const props = {
                    ...baseProps,
                    href: imageObj.href,
                    x: imageObj.x,
                    y: imageObj.y,
                    width: imageObj.width,
                    height: imageObj.height,
                    transform,
                    preserveAspectRatio: "none"
                };
                return { key: objectKey, type: 'image', props };
            }
            return null;
        };

        // Iterate over all objects in layer
        layer.objects.forEach(obj => {
            if (ownedObjectIds.has(obj.id)) return; // Skip hidden templates/paths
            
            if (obj.type === 'flow-guide') {
                const pathData = getSmoothedPolylinePath(obj.points, 0);
                if (pathData) {
                    const props = {
                        d: pathData,
                        fill: 'none',
                        stroke: 'rgba(192, 132, 252, 0.8)',
                        strokeWidth: 1.5,
                        strokeDasharray: '4 4'
                    };
                    elements.push({key: `${layer.id}-obj-${obj.id}`, type: 'path', props});
                }
                return;
            }

            if (obj.type === 'path-group') {
                const pathObject = layer.objects.find(o => o.id === obj.pathId);
                if (!pathObject) return;

                // Render the path object itself (usually visible underneath instances)
                const pathEl = processRenderableObject(pathObject);
                if (pathEl) elements.push(pathEl);

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
                    
                    // Create a transient instance object
                    const instanceObject = JSON.parse(JSON.stringify(template));
                    instanceObject.id = `${obj.id}-inst-${i}-tpl-${template.id}`; 
                    instanceObject.rotation = (alignToPath ? template.rotation + angle : template.rotation) + rotationOffset;

                    // Normal vector calculation
                    const normalRad = (angle + 90) * Math.PI / 180;
                    const offsetX = Math.cos(normalRad) * perpendicularOffset;
                    const offsetY = Math.sin(normalRad) * perpendicularOffset;

                    // Transform position
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
                    
                    // Render the instance
                    const instanceEl = processRenderableObject(instanceObject, `${layer.id}-pg-${instanceObject.id}`);
                    if (instanceEl) elements.push(instanceEl);
                }

            } else {
                // Standard object rendering
                const el = processRenderableObject(obj);
                if (el) elements.push(el);
            }
        });

        layerData.push({ layer, elements });
    });

    return { defs, layers: layerData };
  }, [layers, contentWidth, contentHeight, units, dpi]);

  return renderData;
};
