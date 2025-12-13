
import { useEffect } from 'react';
import type { Layer } from '../types';
import { googleFonts, loadGoogleFonts } from '../lib/utils';

/**
 * Custom hook that monitors the application layers for font usage.
 * It scans all layers for `text` objects and pattern settings (like 'words') 
 * to identify any Google Fonts that are being used. It then dynamically loads 
 * these fonts into the document head to ensure they render correctly.
 *
 * @param layers - The current list of application layers to scan for font families.
 */
export const useFontLoader = (layers: Layer[]) => {
  useEffect(() => {
    const usedFonts = new Set<string>();
    layers.forEach(layer => {
      // Check font usage in generator settings (e.g. 'words' pattern)
      if (layer.settings.patternType === 'words' && googleFonts.includes(layer.settings.wordFontFamily)) {
        usedFonts.add(layer.settings.wordFontFamily);
      }
      // Check font usage in direct text objects
      layer.objects.forEach(obj => {
        if (obj.type === 'text' && googleFonts.includes(obj.fontFamily)) {
          usedFonts.add(obj.fontFamily);
        }
      });
    });
    loadGoogleFonts(usedFonts);
  }, [layers]);
};
