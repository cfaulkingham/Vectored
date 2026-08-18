/**
 * Measures the visual dimensions of a text string using an off-screen SVG element.
 * Handles multiline text by breaking lines into tspans, with robust fallback for non-DOM environments.
 * 
 * @param text - The string to measure. Can include newlines ('\n').
 * @param fontSize - The font size in pixels.
 * @param fontFamily - The font family name (e.g., 'Roboto').
 * @param fontWeight - The font weight (e.g., 'normal', 'bold').
 * @param lineHeight - The line height multiplier (default 1.2).
 * @param letterSpacing - The letter spacing in pixels (default 0).
 * @returns An object containing the width and height of the rendered text bounding box.
 */
export const measureText = (
    text: string, 
    fontSize: number, 
    fontFamily: string, 
    fontWeight: string, 
    lineHeight: number = 1.2, 
    letterSpacing: number = 0
): { width: number; height: number } => {
    if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') {
        const lines = text.split('\n');
        const maxLineLength = Math.max(...lines.map(l => l.length), 1);
        const charWidth = fontSize * 0.6;
        return {
            width: Math.ceil(maxLineLength * charWidth + letterSpacing * maxLineLength + fontSize * 0.2),
            height: Math.ceil(lines.length * fontSize * lineHeight + fontSize * 0.2),
        };
    }

    try {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.visibility = 'hidden';
        svg.style.width = 'auto';
        svg.style.height = 'auto';

        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('font-size', String(fontSize));
        textEl.setAttribute('font-family', fontFamily);
        textEl.setAttribute('font-weight', fontWeight);
        textEl.setAttribute('letter-spacing', String(letterSpacing));
        textEl.setAttribute('dominant-baseline', 'hanging');
        textEl.style.whiteSpace = 'pre';

        // Handle multiline text
        const lines = text.split('\n');
        textEl.textContent = null;
        lines.forEach((line, index) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', '0');
            tspan.setAttribute('dy', index === 0 ? '0' : `${lineHeight}em`);
            tspan.textContent = line || ' ';
            textEl.appendChild(tspan);
        });

        svg.appendChild(textEl);
        document.body.appendChild(svg);
        const bbox = typeof textEl.getBBox === 'function' ? textEl.getBBox() : { width: 100, height: 20, x: 0, y: 0 };
        document.body.removeChild(svg);

        const paddingX = fontSize * 0.2;
        const paddingY = fontSize * 0.2;

        const width = Math.max(bbox.width, bbox.x + bbox.width) + paddingX;
        const height = Math.max(bbox.height, bbox.y + bbox.height) + paddingY;

        return { 
            width: Math.ceil(width), 
            height: Math.ceil(height) 
        };
    } catch {
        const lines = text.split('\n');
        const maxLineLength = Math.max(...lines.map(l => l.length), 1);
        const charWidth = fontSize * 0.6;
        return {
            width: Math.ceil(maxLineLength * charWidth + letterSpacing * maxLineLength + fontSize * 0.2),
            height: Math.ceil(lines.length * fontSize * lineHeight + fontSize * 0.2),
        };
    }
};
