

import type { Gradient, ColorStop, StrokeLineCap, StrokeLineJoin, BlendMode, ParsedElement, ParsedPathElement, ParsedTextElement, ParsedImageElement } from '../types';
import { colorToHex } from './utils';

/**
 * Helper to retrieve an attribute from an element as a float.
 * @param el - The DOM element.
 * @param attr - The attribute name.
 * @param fallback - Default value if attribute is missing (default: 0).
 * @returns The parsed float value.
 */
function getAttr(el: Element, attr: string, fallback: number = 0): number {
    const val = el.getAttribute(attr);
    return val ? parseFloat(val) : fallback;
}

/**
 * Gets a style property value from a single element, checking inline styles,
 * presentation attributes, and class-based styles in the correct order of precedence.
 * @param element - The element to check.
 * @param prop - The CSS property to look for (e.g., 'fill').
 * @param styles - A map of class names to their style properties.
 * @returns The style value string, or null if not found directly on the element.
 */
function getDirectStyle(element: Element, prop: string, styles: Map<string, Record<string, string>>): string | null {
    // 1. Inline style (highest precedence)
    const styleAttr = element.getAttribute('style');
    if (styleAttr) {
        const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
        const match = styleAttr.match(regex);
        if (match) {
            const val = match[1].trim();
            if (val && val !== 'inherit') return val;
        }
    }

    // 2. Presentation attributes
    const attr = element.getAttribute(prop);
    if (attr && attr !== 'inherit') {
        return attr;
    }

    // 3. Class-based styles
    const className = element.getAttribute('class');
    if (className) {
        const classes = className.split(/\s+/);
        // Iterate backwards because later classes in the list have precedence
        for (let i = classes.length - 1; i >= 0; i--) {
            const c = classes[i];
            if (styles.has(c)) {
                const classStyle = styles.get(c)![prop];
                if (classStyle && classStyle !== 'inherit') {
                    return classStyle;
                }
            }
        }
    }
    return null;
}


/**
 * Recursively gets an inherited style property, checking the element itself,
 * any override element (like a <use> tag), and walking up the DOM tree.
 * @param el - The element being styled.
 * @param prop - The CSS property to find.
 * @param styles - A map of parsed CSS styles from a <style> block.
 * @param overrideEl - An optional element (like <use>) whose attributes should override `el`.
 * @returns The computed style value string, or null if not found.
 */
function getInheritedStyle(el: Element, prop: string, styles: Map<string, Record<string, string>>, overrideEl?: Element): string | null {
    // 1. Check override element (<use>) for direct styles
    if (overrideEl) {
        const overrideVal = getDirectStyle(overrideEl, prop, styles);
        if (overrideVal) return overrideVal;
    }

    // 2. Check the actual element (<path> in <defs>) for direct styles
    const elVal = getDirectStyle(el, prop, styles);
    if (elVal) return elVal;

    // 3. Walk up the DOM tree from the element in the document flow
    let current: Element | null = overrideEl ? overrideEl.parentElement : el.parentElement;
    
    while (current) {
        const val = getDirectStyle(current, prop, styles);
        if (val && val !== 'inherit') return val;
        if (current.tagName.toLowerCase() === 'svg') break;
        current = current.parentElement;
    }
    return null;
}


/**
 * Parses an SVG transform attribute string into a DOMMatrix.
 * Supports matrix, translate, scale, rotate, skewX, and skewY.
 * @param transform - The SVG transform string.
 * @returns A DOMMatrix representing the combined transformation.
 */
function parseSVGTransform(transform: string): DOMMatrix {
    const matrix = new DOMMatrix();
    const transformRegex = /(\w+)\s*\(([^)]*)\)/g;
    let match;

    while ((match = transformRegex.exec(transform)) !== null) {
        const name = match[1].toLowerCase();
        const args = match[2].split(/[\s,]+/).filter(s => s.trim() !== '').map(parseFloat);

        switch (name) {
            case 'matrix':
                if (args.length === 6) {
                    const m = new DOMMatrix();
                    m.a = args[0]; m.b = args[1];
                    m.c = args[2]; m.d = args[3];
                    m.e = args[4]; m.f = args[5];
                    matrix.multiplySelf(m);
                }
                break;
            case 'translate':
                if (args.length === 1) matrix.translateSelf(args[0], 0);
                else if (args.length >= 2) matrix.translateSelf(args[0], args[1]);
                break;
            case 'scale':
                if (args.length === 1) matrix.scaleSelf(args[0], args[0]);
                else if (args.length >= 2) matrix.scaleSelf(args[0], args[1]);
                break;
            case 'rotate':
                if (args.length === 1) {
                    matrix.rotateSelf(args[0]);
                } else if (args.length === 3) {
                    // SVG rotate(a, x, y) -> translate(x, y) rotate(a) translate(-x, -y)
                    matrix.translateSelf(args[1], args[2]);
                    matrix.rotateSelf(args[0]);
                    matrix.translateSelf(-args[1], -args[2]);
                }
                break;
            case 'skewx':
                if (args.length === 1) matrix.skewXSelf(args[0]);
                break;
            case 'skewy':
                if (args.length === 1) matrix.skewYSelf(args[0]);
                break;
        }
    }
    return matrix;
}

// --- Shape to Path Converters ---

/** Converts a <rect> element to an SVG path string. */
function rectToPath(el: Element): string {
    const x = getAttr(el, 'x');
    const y = getAttr(el, 'y');
    const width = getAttr(el, 'width');
    const height = getAttr(el, 'height');
    const rx = getAttr(el, 'rx');
    const ry = getAttr(el, 'ry');

    if (rx || ry) {
        const rxa = Math.min(rx || ry || 0, width / 2);
        const rya = Math.min(ry || rx || 0, height / 2);
        return `M ${x + rxa} ${y} ` +
               `h ${width - 2 * rxa} ` +
               `a ${rxa} ${rya} 0 0 1 ${rxa} ${rya} ` +
               `v ${height - 2 * rya} ` +
               `a ${rxa} ${rya} 0 0 1 ${-rxa} ${rya} ` +
               `h ${-(width - 2 * rxa)} ` +
               `a ${rxa} ${rya} 0 0 1 ${-rxa} ${-rya} ` +
               `v ${-(height - 2 * rya)} ` +
               `a ${rxa} ${rya} 0 0 1 ${rxa} ${-rya} ` +
               `Z`;
    }
    return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
}

/** Converts a <circle> element to an SVG path string. */
function circleToPath(el: Element): string {
    const cx = getAttr(el, 'cx');
    const cy = getAttr(el, 'cy');
    const r = getAttr(el, 'r');
    if (r <= 0) return '';
    return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`;
}

/** Converts an <ellipse> element to an SVG path string. */
function ellipseToPath(el: Element): string {
    const cx = getAttr(el, 'cx');
    const cy = getAttr(el, 'cy');
    const rx = getAttr(el, 'rx');
    const ry = getAttr(el, 'ry');
    if (rx <= 0 || ry <= 0) return '';
    return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 -${rx * 2},0`;
}

/** Converts a <line> element to an SVG path string. */
function lineToPath(el: Element): string {
    const x1 = getAttr(el, 'x1');
    const y1 = getAttr(el, 'y1');
    const x2 = getAttr(el, 'x2');
    const y2 = getAttr(el, 'y2');
    return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/** Converts a <polygon> element to an SVG path string. */
function polygonToPath(el: Element): string {
    const points = el.getAttribute('points')?.trim() || '';
    if (!points) return '';
    return `M ${points} Z`;
}

/** Converts a <polyline> element to an SVG path string. */
function polylineToPath(el: Element): string {
    const points = el.getAttribute('points')?.trim() || '';
    if (!points) return '';
    return `M ${points}`;
}

// --- Path Data Transformation ---

/**
 * Applies a DOMMatrix to a path string, converting everything to absolute coordinates.
 * Handles all basic SVG path commands (M, L, H, V, C, S, Q, T, A, Z).
 * 
 * @param d - The path data string.
 * @param matrix - The transformation matrix.
 * @returns The transformed path data string.
 */
export function transformPathData(d: string, matrix: DOMMatrix): string {
    // Regex to tokenize path data: command letter or number
    const tokens = d.match(/([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g);
    if (!tokens) return '';

    let result = '';
    let currentX = 0;
    let currentY = 0;
    
    // Control point for cubic bezier (absolute)
    let lastControlX = 0;
    let lastControlY = 0;
    
    // Control point for quadratic bezier (absolute)
    let lastQuadControlX = 0;
    let lastQuadControlY = 0;
    
    // Start of subpath (for Z command)
    let subpathStartX = 0;
    let subpathStartY = 0;

    let i = 0;
    while (i < tokens.length) {
        const command = tokens[i++];
        const isRelative = command.toLowerCase() === command;
        const upperCommand = command.toUpperCase();

        // Helper to get next number
        const nextNum = () => parseFloat(tokens[i++]);
        // Helper to transform a point
        const tr = (x: number, y: number) => {
            const p = new DOMPoint(x, y).matrixTransform(matrix);
            return { x: p.x, y: p.y };
        };

        switch (upperCommand) {
            case 'M': {
                const x = nextNum() + (isRelative ? currentX : 0);
                const y = nextNum() + (isRelative ? currentY : 0);
                const p = tr(x, y);
                result += `M ${p.x} ${p.y} `;
                currentX = x; currentY = y;
                subpathStartX = x; subpathStartY = y;
                // Subsequent pairs are implicit L commands
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const lx = nextNum() + (isRelative ? currentX : 0);
                    const ly = nextNum() + (isRelative ? currentY : 0);
                    const lp = tr(lx, ly);
                    result += `L ${lp.x} ${lp.y} `;
                    currentX = lx; currentY = ly;
                }
                break;
            }
            case 'L': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);
                    const p = tr(x, y);
                    result += `L ${p.x} ${p.y} `;
                    currentX = x; currentY = y;
                }
                break;
            }
            case 'H': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const x = nextNum() + (isRelative ? currentX : 0);
                    // H uses current Y
                    const p = tr(x, currentY);
                    result += `L ${p.x} ${p.y} `;
                    currentX = x;
                }
                break;
            }
            case 'V': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const y = nextNum() + (isRelative ? currentY : 0);
                    // V uses current X
                    const p = tr(currentX, y);
                    result += `L ${p.x} ${p.y} `;
                    currentY = y;
                }
                break;
            }
            case 'C': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const c1x = nextNum() + (isRelative ? currentX : 0);
                    const c1y = nextNum() + (isRelative ? currentY : 0);
                    const c2x = nextNum() + (isRelative ? currentX : 0);
                    const c2y = nextNum() + (isRelative ? currentY : 0);
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);
                    
                    const p1 = tr(c1x, c1y);
                    const p2 = tr(c2x, c2y);
                    const p = tr(x, y);
                    
                    result += `C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p.x} ${p.y} `;
                    
                    lastControlX = c2x; lastControlY = c2y;
                    currentX = x; currentY = y;
                }
                break;
            }
            case 'S': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    // First control point is reflection of last control point
                    let c1x = currentX;
                    let c1y = currentY;
                    
                    c1x = 2 * currentX - lastControlX;
                    c1y = 2 * currentY - lastControlY;

                    const c2x = nextNum() + (isRelative ? currentX : 0);
                    const c2y = nextNum() + (isRelative ? currentY : 0);
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);
                    
                    const p1 = tr(c1x, c1y);
                    const p2 = tr(c2x, c2y);
                    const p = tr(x, y);

                    result += `C ${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p.x} ${p.y} `;
                    
                    lastControlX = c2x; lastControlY = c2y;
                    currentX = x; currentY = y;
                }
                break;
            }
            case 'Q': {
                 while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const c1x = nextNum() + (isRelative ? currentX : 0);
                    const c1y = nextNum() + (isRelative ? currentY : 0);
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);
                    
                    const p1 = tr(c1x, c1y);
                    const p = tr(x, y);
                    
                    result += `Q ${p1.x} ${p1.y} ${p.x} ${p.y} `;
                    
                    lastQuadControlX = c1x; lastQuadControlY = c1y;
                    currentX = x; currentY = y;
                 }
                 break;
            }
            case 'T': {
                while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    let c1x = 2 * currentX - lastQuadControlX;
                    let c1y = 2 * currentY - lastQuadControlY;
                    
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);
                    
                    const p1 = tr(c1x, c1y);
                    const p = tr(x, y);

                    result += `Q ${p1.x} ${p1.y} ${p.x} ${p.y} `;
                    
                    lastQuadControlX = c1x; lastQuadControlY = c1y;
                    currentX = x; currentY = y;
                }
                break;
            }
            case 'A': {
                 while (i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])) {
                    const rx = nextNum();
                    const ry = nextNum();
                    const angle = nextNum();
                    const largeArcFlag = nextNum();
                    const sweepFlag = nextNum();
                    const x = nextNum() + (isRelative ? currentX : 0);
                    const y = nextNum() + (isRelative ? currentY : 0);

                    const p = tr(x, y);
                    
                    // Estimate scale from matrix
                    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b);
                    const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d);
                    
                    // Approximate rotation from matrix a,b
                    const rot = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
                    
                    result += `A ${rx * scaleX} ${ry * scaleY} ${angle + rot} ${largeArcFlag} ${sweepFlag} ${p.x} ${p.y} `;
                    
                    currentX = x; currentY = y;
                 }
                 break;
            }
            case 'Z': {
                result += 'Z ';
                currentX = subpathStartX;
                currentY = subpathStartY;
                break;
            }
        }
        // Reset control points if command wasn't curve-related (simplified)
        if (!['C', 'S'].includes(upperCommand)) {
            lastControlX = currentX; lastControlY = currentY;
        }
        if (!['Q', 'T'].includes(upperCommand)) {
            lastQuadControlX = currentX; lastQuadControlY = currentY;
        }
    }
    return result;
}

// --- Gradient Parsing ---

/**
 * Parses <stop> elements within a gradient definition.
 * @param el - The gradient element.
 * @returns Array of ColorStop objects.
 */
function parseStops(el: Element): ColorStop[] {
    const stops: ColorStop[] = [];
    const stopElements = el.querySelectorAll('stop');
    stopElements.forEach(stop => {
        let offsetStr = stop.getAttribute('offset') || '0';
        let offset = 0;
        if (offsetStr.endsWith('%')) {
            offset = parseFloat(offsetStr) / 100;
        } else {
            offset = parseFloat(offsetStr);
        }
        offset = Math.max(0, Math.min(1, isNaN(offset) ? 0 : offset));
        
        let color = stop.getAttribute('stop-color');
        const style = stop.getAttribute('style');
        if (!color && style) {
             const match = style.match(/stop-color:\s*([^;"]+)/);
             if (match) color = match[1];
        }
        // Normalize stop color to hex
        stops.push({ offset, color: colorToHex(color || '#000000') });
    });
    if (stops.length === 0) {
        stops.push({ offset: 0, color: '#000000' });
        stops.push({ offset: 1, color: '#ffffff' });
    }
    return stops;
}

/**
 * Scans an SVG document for gradient definitions and parses them.
 * @param doc - The SVG document.
 * @returns A Map of gradient IDs to Gradient objects.
 */
function parseGradients(doc: Document): Map<string, Gradient> {
    const gradients = new Map<string, Gradient>();
    
    doc.querySelectorAll('linearGradient').forEach(lg => {
        const id = lg.getAttribute('id');
        if (!id) return;
        
        const stops = parseStops(lg);
        const units = lg.getAttribute('gradientUnits') === 'userSpaceOnUse' ? 'userSpaceOnUse' : 'objectBoundingBox';
        
        if (units === 'userSpaceOnUse') {
            const x1 = parseFloat(lg.getAttribute('x1') || '0');
            const y1 = parseFloat(lg.getAttribute('y1') || '0');
            const x2 = parseFloat(lg.getAttribute('x2') || '100%') || 0;
            const y2 = parseFloat(lg.getAttribute('y2') || '0');
            
            gradients.set(id, {
                type: 'linear',
                angle: 0,
                units: 'userSpaceOnUse',
                coords: { x1, y1, x2, y2 },
                stops
            });
        } else {
            const x1Str = lg.getAttribute('x1') || '0%';
            const y1Str = lg.getAttribute('y1') || '0%';
            const x2Str = lg.getAttribute('x2') || '100%';
            const y2Str = lg.getAttribute('y2') || '0%';
            
            const val = (s: string) => s.endsWith('%') ? parseFloat(s) : parseFloat(s) * 100;
            
            const x1 = val(x1Str);
            const y1 = val(y1Str);
            const x2 = val(x2Str);
            const y2 = val(y2Str);
            
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI + 90;
            
            gradients.set(id, {
                type: 'linear',
                angle,
                stops
            });
        }
    });

    doc.querySelectorAll('radialGradient').forEach(rg => {
        const id = rg.getAttribute('id');
        if (!id) return;
        const stops = parseStops(rg);
        
        const val = (s: string | null, def: number) => {
            if (!s) return def;
            if (s.endsWith('%')) return parseFloat(s) / 100;
            return parseFloat(s);
        };
        
        const cx = val(rg.getAttribute('cx'), 0.5);
        const cy = val(rg.getAttribute('cy'), 0.5);
        const r = val(rg.getAttribute('r'), 0.5);
        
        gradients.set(id, {
            type: 'radial',
            cx, cy, r,
            stops
        });
    });

    return gradients;
}

// --- Main Parser ---

/**
 * Parses an SVG string into an array of internal representation objects (ParsedElements).
 * Handles defs, gradients, styles (including @font-face), and nested transforms.
 * Robust error handling for invalid or unsupported SVG features.
 * 
 * @param svgString - The raw SVG XML string.
 * @returns An object containing the parsed elements list and any embedded font-face rules.
 * @throws Will throw an error if the string cannot be parsed as SVG.
 */
export function parseSVG(svgString: string): { elements: ParsedElement[]; fontFaces: string[] } {
    console.debug('--- Starting SVG Parse ---');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    
    const svgError = doc.querySelector('parsererror');
    if (svgError) {
        console.error("Critical Error: Could not parse SVG string. Details:", svgError.textContent);
        throw new Error("Invalid SVG file");
    }
    
    const svg = doc.documentElement;
    if (svg.tagName.toLowerCase() !== 'svg') {
        console.error(`Critical Error: Root element is not <svg>, but <${svg.tagName}>.`);
        throw new Error("Not a valid SVG file");
    }

    const gradients = parseGradients(doc);
    const elementsData: ParsedElement[] = [];

    const fontFaces: string[] = [];
    const styles = new Map<string, Record<string, string>>();
    const styleEls = doc.querySelectorAll('style');
    
    styleEls.forEach(styleEl => {
        const cssText = styleEl.textContent || '';

        // Extract @font-face rules
        const fontFaceRegex = /@font-face\s*\{[^\}]+\}/g;
        const fontFaceMatches = cssText.match(fontFaceRegex);
        if (fontFaceMatches) {
            fontFaces.push(...fontFaceMatches);
        }

        // Parse class-based styles
        const ruleRegex = /\.([^\{]+)\s*\{([^\}]+)\}/g;
        let match;
        // Reset regex state for each style block if needed
        ruleRegex.lastIndex = 0; 
        while ((match = ruleRegex.exec(cssText)) !== null) {
            const classNames = match[1].trim();
            const declarations = match[2].trim();
            const styleProps: Record<string, string> = {};
            declarations.split(';').forEach(decl => {
                if (decl.trim()) {
                    const [prop, value] = decl.split(':');
                    if (prop && value) {
                        styleProps[prop.trim().toLowerCase()] = value.trim();
                    }
                }
            });
            classNames.split(',').forEach(cn => {
                styles.set(cn.trim(), styleProps);
            });
        }
    });

    const defsMap = new Map<string, Element>();
    doc.querySelectorAll('defs > [id]').forEach(def => {
        defsMap.set(def.id, def);
    });
    
    const svgWidth = getAttr(svg, 'width');
    const svgHeight = getAttr(svg, 'height');

    function processElement(el: Element, currentMatrix: DOMMatrix, defs: Map<string, Element>, overrideStyleElement?: Element, forceProcess = false) {
        // Filter out likely background elements
        if (el.tagName.toLowerCase() === 'rect') {
            const x = getAttr(el, 'x');
            const y = getAttr(el, 'y');
            const width = getAttr(el, 'width');
            const height = getAttr(el, 'height');
            if (x <= 0 && y <= 0 && width >= svgWidth && height >= svgHeight) {
                return;
            }
        }
        if (el.tagName.toLowerCase() === 'path') {
            const d = el.getAttribute('d')?.trim() || '';
            const bgPathRegex = new RegExp(`^[mM]\\s*0[,\\s]*0\\s*[hH]\\s*${svgWidth}\\s*[vV]\\s*${svgHeight}\\s*[hH]\\s*[-]?${svgWidth}\\s*[zZ]`, 'i');
            if (bgPathRegex.test(d)) {
                return;
            }
        }

        // Update Matrix if transform exists
        let nextMatrix = currentMatrix;
        const transformAttr = el.getAttribute('transform');
        if (transformAttr) {
            const transformMatrix = parseSVGTransform(transformAttr);
            nextMatrix = currentMatrix.multiply(transformMatrix);
        }

        // Handle Groups recursively
        if (el.tagName.toLowerCase() === 'g' || el.tagName.toLowerCase() === 'svg') {
            Array.from(el.children).forEach(child => processElement(child, nextMatrix, defs, overrideStyleElement, forceProcess));
            return;
        }

        if (!forceProcess && el.closest('defs')) return;

        // Handle <use> elements
        if (el.tagName.toLowerCase() === 'use') {
            const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (href && href.startsWith('#')) {
                const id = href.substring(1);
                const defElement = defs.get(id);
                if (defElement) {
                    const useTransform = new DOMMatrix();
                    const x = getAttr(el, 'x');
                    const y = getAttr(el, 'y');
                    if (x !== 0 || y !== 0) {
                        useTransform.translateSelf(x, y);
                    }
                    const useTransformAttr = el.getAttribute('transform');
                    if (useTransformAttr) {
                        useTransform.multiplySelf(parseSVGTransform(useTransformAttr));
                    }

                    const nextMatrixForUsed = currentMatrix.multiply(useTransform);
                    
                    // Recursively process the defined element, passing the <use> element for style overrides
                    processElement(defElement, nextMatrixForUsed, defs, el, true);
                }
            }
            return;
        }

        const id = el.getAttribute('id') || undefined;
        
        // Handle Text elements
        if (el.tagName.toLowerCase() === 'text') {
            const tspans = Array.from(el.children).filter(c => c.tagName.toLowerCase() === 'tspan');
            
            const processTextChunk = (sourceEl: Element, text: string) => {
                if (!text.trim()) return;

                const x = getAttr(sourceEl, 'x', getAttr(el, 'x'));
                const y = getAttr(sourceEl, 'y', getAttr(el, 'y'));
                const p = new DOMPoint(x, y).matrixTransform(nextMatrix);

                const getTextStyle = (prop: string) => getInheritedStyle(sourceEl, prop, styles, overrideStyleElement) || getInheritedStyle(el, prop, styles, overrideStyleElement);
                
                const fontSizeStr = getTextStyle('font-size');
                const fontSize = fontSizeStr ? parseFloat(fontSizeStr) : 16;
                const fontFamily = getTextStyle('font-family') || 'sans-serif';
                const fontWeight = getTextStyle('font-weight') || 'normal';
                
                let fillVal = getTextStyle('fill') || '#000000';
                let fill: string | Gradient = colorToHex(fillVal);

                if (typeof fill === 'string' && fill.startsWith('url(#')) {
                    const gradId = fill.substring(5, fill.length - 1);
                    if (gradients.has(gradId)) fill = gradients.get(gradId)!;
                    else fill = '#000000';
                }
                let strokeVal = getTextStyle('stroke') || 'none';
                const stroke = colorToHex(strokeVal);

                const strokeWidthStr = getTextStyle('stroke-width');
                const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : 1;
                const opacityStr = getInheritedStyle(el, 'opacity', styles, overrideStyleElement);
                const opacity = opacityStr ? parseFloat(opacityStr) : 1;
                const fillOpacityStr = getInheritedStyle(el, 'fill-opacity', styles, overrideStyleElement);
                const fillOpacity = fillOpacityStr ? parseFloat(fillOpacityStr) : 1;
                const strokeOpacityStr = getInheritedStyle(el, 'stroke-opacity', styles, overrideStyleElement);
                const strokeOpacity = strokeOpacityStr ? parseFloat(strokeOpacityStr) : 1;
                const blendMode = (getTextStyle('mix-blend-mode') as BlendMode) || 'normal';
                
                elementsData.push({
                    type: 'text', text: text.trim(), x: p.x, y: p.y, fontSize, fontFamily, fontWeight, fill, stroke, strokeWidth, opacity,
                    fillOpacity, strokeOpacity, blendMode
                });
            };

            if (tspans.length > 0) {
                tspans.forEach(tspan => processTextChunk(tspan, tspan.textContent || ''));
            } else {
                processTextChunk(el, el.textContent || '');
            }
            return;
        }

        // Handle ForeignObject elements
        if (el.tagName.toLowerCase() === 'foreignobject') {
            const rawX = getAttr(el, 'x');
            const rawY = getAttr(el, 'y');
            const width = getAttr(el, 'width');
            const height = getAttr(el, 'height');

            const div = el.querySelector('div');
            if (!div) return;

            const textContent = div.textContent?.trim() || '';
            if (!textContent) return;
            
            // Styles can be on the main div (common for Excalidraw/etc exports) or a specific inner div.
            // We check the root div first as it often acts as the container with inherited font properties.
            let styleAttr = div.getAttribute('style') || '';
            
            // If the root div doesn't have a font-family, we try to find a child that does, to be safe,
            // but we prioritize the root to properly capture inheritance.
            if (!styleAttr.includes('font-family')) {
                const childWithStyle = div.querySelector('div[style*="font-family"]');
                if (childWithStyle) {
                    styleAttr += '; ' + childWithStyle.getAttribute('style');
                } else {
                    // Fallback: try any style div if root has none
                     const anyStyleDiv = div.querySelector('div[style]');
                     if (anyStyleDiv) styleAttr += '; ' + anyStyleDiv.getAttribute('style');
                }
            }
            
            const fontFamilyMatch = styleAttr.match(/font-family:\s*([^;]+)/);
            const fontFamily = fontFamilyMatch ? fontFamilyMatch[1].split(',')[0].replace(/['"]/g, '').trim() : 'sans-serif';
            
            const fontSizeMatch = styleAttr.match(/font-size:\s*([^;]+)/);
            const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 16;
            
            const colorMatch = styleAttr.match(/color:\s*([^;]+)/);
            let fillVal = colorMatch ? colorMatch[1] : (getInheritedStyle(el, 'fill', styles, overrideStyleElement) || '#000000');
            let fill: string | Gradient = colorToHex(fillVal);

            if (typeof fill === 'string' && fill.startsWith('url(#')) {
                const gradId = fill.substring(5, fill.length - 1);
                if (gradients.has(gradId)) {
                    fill = gradients.get(gradId)!;
                } else {
                    fill = '#000000'; // Fallback
                }
            }

            const fontWeightMatch = styleAttr.match(/font-weight:\s*([^;]+)/);
            const fontWeight = fontWeightMatch ? fontWeightMatch[1] : (getInheritedStyle(el, 'font-weight', styles, overrideStyleElement) || 'normal');

            const textAlignMatch = styleAttr.match(/text-align:\s*([^;]+)/);
            const textAlign = (textAlignMatch ? textAlignMatch[1].trim() : 'left') as 'left' | 'center' | 'right';

            const alignItemsMatch = styleAttr.match(/align-items:\s*([^;]+)/);
            const verticalAlign = (alignItemsMatch && alignItemsMatch[1].trim() === 'center') ? 'middle' : 'top';

            const backgroundColorMatch = styleAttr.match(/background-color:\s*([^;]+)/);
            const backgroundColor = backgroundColorMatch ? colorToHex(backgroundColorMatch[1].trim()) : 'transparent';

            // Get common styles from the <foreignObject> element itself
            let strokeVal = getInheritedStyle(el, 'stroke', styles, overrideStyleElement) || 'none';
            const stroke = colorToHex(strokeVal);

            const strokeWidthStr = getInheritedStyle(el, 'stroke-width', styles, overrideStyleElement);
            const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : 1;
            const opacityStr = getInheritedStyle(el, 'opacity', styles, overrideStyleElement);
            const opacity = opacityStr ? parseFloat(opacityStr) : 1;
            const fillOpacityStr = getInheritedStyle(el, 'fill-opacity', styles, overrideStyleElement);
            const fillOpacity = fillOpacityStr ? parseFloat(fillOpacityStr) : 1;
            const strokeOpacityStr = getInheritedStyle(el, 'stroke-opacity', styles, overrideStyleElement);
            const strokeOpacity = strokeOpacityStr ? parseFloat(strokeOpacityStr) : 1;
            const blendMode = (getInheritedStyle(el, 'mix-blend-mode', styles, overrideStyleElement) as BlendMode) || 'normal';

            // Transform the bounding box of the foreignObject
            const corners: [number, number][] = [
                [rawX, rawY],
                [rawX + width, rawY],
                [rawX + width, rawY + height],
                [rawX, rawY + height]
            ];
            const transformedCorners = corners.map(p => new DOMPoint(p[0], p[1]).matrixTransform(nextMatrix));
            const minX = Math.min(...transformedCorners.map(p => p.x));
            const minY = Math.min(...transformedCorners.map(p => p.y));
            const maxX = Math.max(...transformedCorners.map(p => p.x));
            const maxY = Math.max(...transformedCorners.map(p => p.y));

            elementsData.push({
                type: 'text',
                id,
                text: textContent,
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                fontSize,
                fontFamily,
                fontWeight,
                fill,
                stroke,
                strokeWidth,
                opacity,
                fillOpacity,
                strokeOpacity,
                blendMode,
                isForeignObject: true,
                textAlign,
                verticalAlign,
                backgroundColor,
            });
            return;
        }


        // Common style extraction
        let fillVal = getInheritedStyle(el, 'fill', styles, overrideStyleElement) || '#000000';
        let fill: string | Gradient = colorToHex(fillVal);

        if (typeof fill === 'string' && fill.startsWith('url(#')) {
            const gradId = fill.substring(5, fill.length - 1);
            if (gradients.has(gradId)) {
                fill = gradients.get(gradId)!;
            } else {
                fill = '#000000'; // Fallback
            }
        }
        
        let strokeVal = getInheritedStyle(el, 'stroke', styles, overrideStyleElement) || 'none';
        const stroke = colorToHex(strokeVal);

        const strokeWidthStr = getInheritedStyle(el, 'stroke-width', styles, overrideStyleElement);
        const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : 1;

        const strokeLinecap = getInheritedStyle(el, 'stroke-linecap', styles, overrideStyleElement) as StrokeLineCap | undefined;
        const strokeLinejoin = getInheritedStyle(el, 'stroke-linejoin', styles, overrideStyleElement) as StrokeLineJoin | undefined;
        const strokeDasharray = getInheritedStyle(el, 'stroke-dasharray', styles, overrideStyleElement) || undefined;
        const strokeDashoffsetStr = getInheritedStyle(el, 'stroke-dashoffset', styles, overrideStyleElement);
        const strokeDashoffset = strokeDashoffsetStr ? parseFloat(strokeDashoffsetStr) : undefined;

        const opacityStr = getInheritedStyle(el, 'opacity', styles, overrideStyleElement);
        const opacity = opacityStr ? parseFloat(opacityStr) : 1;

        const fillOpacityStr = getInheritedStyle(el, 'fill-opacity', styles, overrideStyleElement);
        const fillOpacity = fillOpacityStr ? parseFloat(fillOpacityStr) : 1;

        const strokeOpacityStr = getInheritedStyle(el, 'stroke-opacity', styles, overrideStyleElement);
        const strokeOpacity = strokeOpacityStr ? parseFloat(strokeOpacityStr) : 1;

        const blendMode = (getInheritedStyle(el, 'mix-blend-mode', styles, overrideStyleElement) as BlendMode) || 'normal';

        // Handle Image elements
        if (el.tagName.toLowerCase() === 'image') {
            const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
            if (!href) return;

            const rawX = getAttr(el, 'x');
            const rawY = getAttr(el, 'y');
            const width = getAttr(el, 'width');
            const height = getAttr(el, 'height');

            const corners: [number, number][] = [
                [rawX, rawY],
                [rawX + width, rawY],
                [rawX + width, rawY + height],
                [rawX, rawY + height]
            ];

            const transformedCorners = corners.map(p => new DOMPoint(p[0], p[1]).matrixTransform(nextMatrix));
            
            const minX = Math.min(...transformedCorners.map(p => p.x));
            const minY = Math.min(...transformedCorners.map(p => p.y));
            const maxX = Math.max(...transformedCorners.map(p => p.x));
            const maxY = Math.max(...transformedCorners.map(p => p.y));
            
            elementsData.push({
                type: 'image',
                id,
                href,
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                fill: 'none',
                stroke: 'none',
                strokeWidth: 0,
                opacity,
                fillOpacity,
                strokeOpacity,
                blendMode,
            });
            return;
        }

        let d = '';
        switch (el.tagName.toLowerCase()) {
            case 'path': d = el.getAttribute('d') || ''; break;
            case 'rect': d = rectToPath(el); break;
            case 'circle': d = circleToPath(el); break;
            case 'ellipse': d = ellipseToPath(el); break;
            case 'line': d = lineToPath(el); break;
            case 'polygon': d = polygonToPath(el); break;
            case 'polyline': d = polylineToPath(el); break;
        }
        
        if (d) {
            const transformedD = transformPathData(d, nextMatrix);

            elementsData.push({ 
                type: 'path',
                id,
                d: transformedD, fill, stroke, strokeWidth,
                strokeLinecap, strokeLinejoin, strokeDasharray, strokeDashoffset,
                opacity, fillOpacity, strokeOpacity, blendMode
            });
        }
    }

    processElement(svg, new DOMMatrix(), defsMap);

    return { elements: elementsData, fontFaces };
}
