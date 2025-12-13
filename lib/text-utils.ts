
/**
 * Measures the visual dimensions of a text string using an off-screen SVG element.
 * Handles multiline text by breaking lines into tspans.
 * 
 * @param text - The string to measure. Can include newlines ('\n').
 * @param fontSize - The font size in pixels.
 * @param fontFamily - The font family name (e.g., 'Roboto').
 * @param fontWeight - The font weight (e.g., 'normal', 'bold').
 * @param lineHeight - The line height multiplier (default 1.2).
 * @param letterSpacing - The letter spacing in pixels (default 0).
 * @returns An object containing the width and height of the rendered text bounding box.
 */
export const measureText = (text: string, fontSize: number, fontFamily: string, fontWeight: string, lineHeight: number = 1.2, letterSpacing: number = 0): { width: number, height: number } => {
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
    // Match the dominant-baseline used in the Canvas renderer to ensure accurate height measurement
    textEl.setAttribute('dominant-baseline', 'hanging');
    textEl.style.whiteSpace = 'pre';

    // Handle multiline text
    const lines = text.split('\n');
    textEl.textContent = null; // Clear any previous content
    lines.forEach((line, index) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', '0');
        tspan.setAttribute('dy', index === 0 ? '0' : `${lineHeight}em`); // Standard line height
        tspan.textContent = line || ' '; // Use a space for empty lines to maintain height
        textEl.appendChild(tspan);
    });

    svg.appendChild(textEl);
    document.body.appendChild(svg);
    const bbox = textEl.getBBox();
    document.body.removeChild(svg);

    // Add padding to the bounding box to ensure it fully covers the text (including some ascenders/descenders or italic spill)
    // and provides a better visual selection area.
    // Increased padding to ensure text is easily clickable and fully encompassed.
    const paddingX = fontSize * .2;
    const paddingY = fontSize * .2;

    // Ensure we capture the full visual extent if it starts offset from 0
    const width = Math.max(bbox.width, bbox.x + bbox.width) + paddingX;
    const height = Math.max(bbox.height, bbox.y + bbox.height) + paddingY;

    return { 
        width: Math.ceil(width), 
        height: Math.ceil(height) 
    };
};
