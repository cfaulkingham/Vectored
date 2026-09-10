

/**
 * A seeded pseudo-random number generator (PRNG) using the Mulberry32 algorithm.
 * Useful for creating deterministic patterns based on a seed.
 * @param a - The seed value.
 * @returns A function that returns a random number between 0 and 1 each time it is called.
 */
export function mulberry32(a: number) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

/**
 * A list of Google Fonts available for selection in the application.
 * Used to populate font selection dropdowns.
 */
export const googleFonts = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway', 'Nunito', 'Bebas Neue',
  'Playfair Display', 'Merriweather', 'Lora',
  'Lobster', 'Pacifico', 'Dancing Script', 'Shadows Into Light',
  'Source Code Pro', 'Inconsolata', 'Roboto Mono',
  'Bangers', 'Patrick Hand', 'Permanent Marker'
];

/**
 * Dynamically loads Google Fonts into the document head.
 * Checks if the font is already loaded to prevent duplication.
 * @param fontsToLoad - A Set of font family names to load.
 */
export const loadGoogleFonts = (fontsToLoad: Set<string>) => {
    fontsToLoad.forEach(fontFamily => {
      const fontId = `google-font-${fontFamily.replace(/\s+/g, '-')}`;
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
        document.head.appendChild(link);
      }
    });
};

/**
 * Inverts a hex color string.
 * Calculates the negative of the given color.
 * @param hex - The hex color string (e.g., "#FFFFFF" or "000").
 * @returns The inverted hex color string (e.g., "#000000").
 */
export const invertHexColor = (hex: string): string => {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }
    if (hex.length !== 6) {
        return '#000000'; // fallback for invalid hex
    }
    const r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16).padStart(2, '0');
    const g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16).padStart(2, '0');
    const b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
};

// Cached canvas context for color conversion
let ctx: CanvasRenderingContext2D | null = null;

/**
 * Converts a CSS color string to a 6-digit Hex string.
 * Handles named colors, rgb(), rgba(), and hex formats.
 * @param color - The input color string.
 * @returns The hex string (e.g. '#ffffff') or original if conversion fails/not needed.
 */
export const colorToHex = (color: string): string => {
    if (!color || color === 'none' || color === 'transparent' || color.trim().toLowerCase().startsWith('url')) {
        return color;
    }
    
    if (!ctx) {
        const canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
    }
    if (!ctx) return color;

    // Reset to black to detect invalid colors if needed, though usually we trust input or fallback
    ctx.fillStyle = '#000000'; 
    ctx.fillStyle = color;
    const computed = ctx.fillStyle;

    if (computed.startsWith('#')) {
        // Standardize 3-digit hex if returned
        if (computed.length === 4) {
             return '#' + computed[1] + computed[1] + computed[2] + computed[2] + computed[3] + computed[3];
        }
        return computed;
    }
    
    // Handle rgba coming back from canvas
    if (computed.startsWith('rgba')) {
         const match = computed.match(/(\d+),\s*(\d+),\s*(\d+)/);
         if (match) {
             const r = parseInt(match[1]);
             const g = parseInt(match[2]);
             const b = parseInt(match[3]);
             return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
         }
    }

    return computed;
};
