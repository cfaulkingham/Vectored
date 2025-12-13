/**
 * Sanitizes a CSS string, specifically targeting `@font-face` rules to prevent XSS.
 * It ensures that `src` properties only contain whitelisted URL schemes (http, https, data, #)
 * while preserving all other CSS properties within the rule.
 *
 * @param css - The raw CSS string from the SVG file.
 * @returns A sanitized CSS string containing only safe `@font-face` rules.
 */
export function sanitizeFontFaces(css: string): string {
    const fontFaceRegex = /@font-face\s*\{([^\}]+)\}/g;
    let ruleMatch;
    const sanitizedRules = [];

    while ((ruleMatch = fontFaceRegex.exec(css)) !== null) {
        const ruleBody = ruleMatch[1].trim();
        const properties = ruleBody.split(';').map(p => p.trim()).filter(Boolean);

        let srcIndex = -1;
        let originalSrcValue = '';

        for (let i = 0; i < properties.length; i++) {
            if (properties[i].toLowerCase().startsWith('src:')) {
                srcIndex = i;
                originalSrcValue = properties[i].substring(properties[i].indexOf(':') + 1).trim();
                break;
            }
        }

        if (srcIndex === -1) {
            // No src property, keep the rule as is.
            sanitizedRules.push(`@font-face { ${ruleBody} }`);
            continue;
        }

        const urlPartRegex = /url\((['"]?)(.*?)\1\)(\s*format\((['"]?)(.*?)\4\))?/g;
        let urlPartMatch;
        const validSrcParts = [];

        while ((urlPartMatch = urlPartRegex.exec(originalSrcValue)) !== null) {
            const url = urlPartMatch[2].trim();
            if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('#') || url.startsWith('data:')) {
                validSrcParts.push(urlPartMatch[0]);
            }
        }

        if (validSrcParts.length > 0) {
            const newSrcValue = validSrcParts.join(', ');
            properties[srcIndex] = `src: ${newSrcValue}`;
            const newRuleBody = properties.join('; ');
            sanitizedRules.push(`@font-face { ${newRuleBody}; }`); // Add trailing semicolon for consistency
        }
        // If no valid src parts, the rule is dropped.
    }

    return sanitizedRules.join('\n');
}