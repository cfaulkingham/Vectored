
import React, { useState, useCallback } from 'react';
import { produce } from 'immer';
import { saveFile, showFileError } from '../lib/file-io';
import { renderSVGToCanvas, canvasToPNG } from '../lib/raster-export';
import { parseSVG } from '../lib/svg-parser';
import { sanitizeFontFaces } from '../lib/safe-svg-parser';
import { calculateGenericPathBounds, calculateGroupBounds, getTransformMatrix, applyMirrorToObject, transformPoint, calculatePolygonBounds, calculatePathBounds, transformPathData } from '../lib/geometry';
import type { AppState, GenericPathObject, ImageObject, InteractionState, TextObject, VectorObject, ParsedTextElement, Units, Point, NestingResult, PolygonObject, PathObject, LineObject, MeasurementObject, GroupObject } from '../types';
import { generateSVGString, generateDXFString, inlineFontsInSVG } from '../lib/export-helpers';
import { jsPDF } from 'jspdf';
import { measureText } from '../lib/text-utils';
import { OPTION_PRESETS } from '../imagetracer/presets';


interface UseProjectManagerProps {
    /** Complete application state */
    appState: AppState;
    /** State setter */
    setAppState: (action: AppState | ((prevState: AppState) => AppState), options?: { coalesce?: boolean }) => void;
    /** Function to reset the app state */
    reset: (state: AppState) => void;
    /** Function to create a fresh initial state */
    createInitialState: (dimensions?: { width: number, height: number }) => AppState;
    /** Whether undo action is available */
    canUndo: boolean;
    /** Setter for density images registry */
    setDensityImages: React.Dispatch<React.SetStateAction<Record<string, HTMLImageElement>>>;
    /** Setter for interaction state */
    setInteraction: React.Dispatch<React.SetStateAction<InteractionState>>;
    /** Setter for selected object metadata */
    setSelectedObjectInfo: React.Dispatch<React.SetStateAction<{ layerId: string; objectIds: string[] } | null>>;
    /** Setter for editing mode */
    setEditingMode: React.Dispatch<React.SetStateAction<'shape' | 'clip' | 'layer'>>;
    /** Setter for units */
    setUnits: React.Dispatch<React.SetStateAction<Units>>;
    /** Current mirror mode */
    mirrorMode: any;
    /** Current mirror gap */
    mirrorGap: number;
    /** Current measurement units */
    units: Units; 
}

/**
 * Custom hook for managing project lifecycle events and high-level file operations.
 * Handles New Project workflows, Saving/Loading JSON, Importing files (SVG/Image), 
 * Exporting (SVG, PNG, PDF, DXF), Printing, and Clearing the canvas.
 * Manages the visibility state of various project-level modals.
 *
 * @param props - The hook properties.
 * @returns An object containing state and handlers for all project management UI components.
 */
export const useProjectManager = ({
    appState,
    setAppState,
    reset,
    createInitialState,
    canUndo,
    setDensityImages,
    setInteraction,
    setSelectedObjectInfo,
    setEditingMode,
    setUnits,
    mirrorMode,
    mirrorGap,
    units 
}: UseProjectManagerProps) => {

    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
    const [isNewProjectSettingsOpen, setIsNewProjectSettingsOpen] = useState(false);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isCanvasSettingsModalOpen, setIsCanvasSettingsModalOpen] = useState(false);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
    const [isNestingModalOpen, setIsNestingModalOpen] = useState(false);
    const [filename, setFilename] = useState('pattern');
    const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);
    const [imageToTrace, setImageToTrace] = useState<ImageObject | null>(null);
    const [isExportInverted, setIsExportInverted] = useState(false);
    const [includeMeasurements, setIncludeMeasurements] = useState(true);
    const [pngExportScale, setPngExportScale] = useState(4);
    const [nextAction, setNextAction] = useState<(() => void) | null>(null);
    
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [pendingImport, setPendingImport] = useState<{
        type: 'svg' | 'image';
        content: string; 
        point?: Point; 
    } | null>(null);

    /**
     * Opens a print dialog with a simplified view of the SVG content.
     */
    const handlePrint = useCallback(() => {
        const svgString = generateSVGString(appState, units, { inverted: false, includeMeasurements });
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Print - ${filename}</title>
                        <style>
                            @media print {
                                @page { size: ${appState.canvasConfig.width}px ${appState.canvasConfig.height}px; margin: 0; }
                                body { margin: 0; }
                            }
                            body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #eee; }
                            svg { max-width: 100%; max-height: 100vh; }
                        </style>
                    </head>
                    <body>
                        ${svgString}
                        <script>
                            window.onload = function() {
                                window.print();
                                window.onafterprint = function() { window.close(); };
                            }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            alert('Could not open print window. Please check your popup blocker settings.');
        }
    }, [appState, filename, units, includeMeasurements]);

    /**
     * Initiates the new project flow. Checks for unsaved work if applicable.
     */
    const handleNewProject = useCallback(() => {
        if (canUndo) {
            setIsNewProjectModalOpen(true);
        } else {
            setIsNewProjectSettingsOpen(true);
        }
    }, [canUndo]);

    /**
     * Creates a new project with specified dimensions and units.
     */
    const handleCreateProject = (config: { width: number, height: number, clipToCanvas?: boolean }, units: Units) => {
        setUnits(units);
        reset(createInitialState(config));
        setIsNewProjectSettingsOpen(false);
    };

    /**
     * Flow for saving the current project before creating a new one.
     */
    const handleSaveAndNew = () => {
        setIsNewProjectModalOpen(false);
        setNextAction(() => () => {
            setIsNewProjectSettingsOpen(true);
        });
        setIsSaveModalOpen(true);
    };

    /**
     * Discards changes and proceeds to create a new project.
     */
    const handleNewWithoutSaving = () => {
        setIsNewProjectModalOpen(false);
        setIsNewProjectSettingsOpen(true);
    };

    /**
     * Opens the save modal.
     */
    const handleSaveProjectFile = useCallback(() => {
        setIsSaveModalOpen(true);
    }, []);

    /**
     * Saves the current project state as a JSON file.
     */
    const handleSave = async (newFilename: string) => {
        const projectData = {
            layers: appState.layers,
            activeLayerId: appState.activeLayerId,
            canvasConfig: appState.canvasConfig,
            guides: appState.guides || [], // Ensure guides are saved, default to empty
        };
        const jsonString = JSON.stringify(projectData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        if (!await saveFile(blob, `${newFilename}.json`)) return;
        setIsSaveModalOpen(false);
        setFilename(newFilename);
        if (nextAction) {
            nextAction();
            setNextAction(null);
        }
    };

    /**
     * Loads a project from a JSON file.
     */
    const loadProjectFile = async (file: File) => {
        try {
            const projectData = JSON.parse(await file.text()) as AppState;
            if (!Array.isArray(projectData.layers) || !projectData.canvasConfig) {
                throw new Error('Invalid project file.');
            }
            projectData.guides ||= [];
            projectData.layers.forEach(layer => {
                layer.objects ||= [];
                layer.points ||= [];
            });

            const urls = new Set<string>();
            projectData.layers.forEach(layer => {
                if (layer.settings.densityImageURL) urls.add(layer.settings.densityImageURL);
            });
            const images: Record<string, HTMLImageElement> = {};
            await Promise.all([...urls].map(url => new Promise<void>(resolve => {
                const image = new Image();
                image.onload = () => { images[url] = image; resolve(); };
                image.onerror = () => resolve();
                image.src = url;
            })));
            reset(projectData);
            setDensityImages(images);
            setFilename(file.name.replace(/\.[^/.]+$/, ''));
        } catch (error) {
            await showFileError('Could not open the project.', error);
        }
    };

    const handleFileSelectedForLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void loadProjectFile(file);
    };

    /**
     * Reads a file for import (SVG or Image) and opens the import modal.
     */
    const handleInitiateImport = (file: File, type: 'svg' | 'image', point?: Point) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setPendingImport({ type, content, point });
                setIsImportModalOpen(true);
            }
        };
        if (type === 'svg') {
            reader.readAsText(file);
        } else {
            reader.readAsDataURL(file);
        }
    };

    /**
     * Finalizes the import of a file into the specified layer.
     * Parses SVG content or creates an Image object.
     * Applies scaling (fit to canvas or original size) and optional mirroring.
     */
    const handleConfirmImport = (layerId: string, scaleMode: 'original' | 'fit') => {
        if (!pendingImport) return;
        
        const { type, content, point } = pendingImport;
        const { width: canvasWidth, height: canvasHeight } = appState.canvasConfig;

        if (type === 'image') {
            const img = new Image();
            img.onload = () => {
                const { naturalWidth, naturalHeight } = img;
                let width = naturalWidth;
                let height = naturalHeight;
                let x = 0;
                let y = 0;

                if (scaleMode === 'fit') {
                    const scale = Math.min(canvasWidth / naturalWidth, canvasHeight / naturalHeight) * 0.8; 
                    width = naturalWidth * scale;
                    height = naturalHeight * scale;
                    x = (canvasWidth - width) / 2;
                    y = (canvasHeight - height) / 2;
                } else {
                    if (point) {
                        x = point[0] - width / 2;
                        y = point[1] - height / 2;
                    } else {
                        x = (canvasWidth - width) / 2;
                        y = (canvasHeight - height) / 2;
                    }
                }

                const newImageObject: ImageObject = {
                    id: String(Date.now()),
                    type: 'image',
                    href: content,
                    x, y, width, height,
                    rotation: 0,
                    skewX: 0, skewY: 0,
                    fill: 'none',
                    stroke: 'none',
                    strokeWidth: 0,
                    opacity: 1,
                    fillOpacity: 1,
                    strokeOpacity: 1,
                    blendMode: 'normal'
                };

                const objectsToAdd: VectorObject[] = [newImageObject];
                const idsToSelect = [newImageObject.id];

                if (mirrorMode !== 'off') {
                    const mirroredObject = applyMirrorToObject(newImageObject, mirrorMode, mirrorGap, canvasWidth, canvasHeight);
                    mirroredObject.id = `mirror-${newImageObject.id}`;
                    objectsToAdd.push(mirroredObject);
                    idsToSelect.push(mirroredObject.id);
                }

                setAppState(produce(draft => {
                    const layer = draft.layers.find(l => l.id === layerId);
                    if (layer) {
                        layer.objects.push(...objectsToAdd);
                    }
                }));
                
                setSelectedObjectInfo({ layerId, objectIds: idsToSelect });
                setInteraction({ mode: 'idle' });
            };
            img.src = content;
        } else if (type === 'svg') {
            try {
                const { elements, fontFaces } = parseSVG(content);
                
                const fontFamilies = new Set<string>();
                if (fontFaces && fontFaces.length > 0) {
                    const styleId = 'imported-svg-fonts';
                    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
                    if (!styleElement) {
                        styleElement = document.createElement('style');
                        styleElement.id = styleId;
                        document.head.appendChild(styleElement);
                    }
                    const existingFontFaces = styleElement.textContent || '';
                    const sanitizedFontFaces = fontFaces.map(ff => sanitizeFontFaces(ff)).filter(Boolean);
                    const newFontFaces = sanitizedFontFaces.filter(ff => !existingFontFaces.includes(ff));
                    if (newFontFaces.length > 0) {
                        styleElement.textContent += '\n' + newFontFaces.join('\n');
                        const fontFamilyRegex = /font-family:\s*([^;]+);?/;
                        newFontFaces.forEach(ff => {
                            const match = ff.match(fontFamilyRegex);
                            if (match && match[1]) {
                                const name = match[1].split(',')[0].replace(/['"]/g, '').trim();
                                if (name) fontFamilies.add(name);
                            }
                        });
                    }
                }
                
                const fontPromises = Array.from(fontFamilies).map(font => document.fonts.load(`1em "${font}"`));
                
                Promise.all(fontPromises).catch(err => console.warn("Some fonts failed to load", err)).then(() => {
                    let newObjects: VectorObject[] = elements.map((el, i) => {
                        if (el.type === 'path') {
                            const bounds = calculateGenericPathBounds(el.d);
                            return {
                                id: String(Date.now() + i + Math.random()),
                                type: 'generic-path',
                                d: el.d,
                                ...bounds,
                                rotation: 0, skewX: 0, skewY: 0,
                                fill: el.fill, stroke: el.stroke, strokeWidth: el.strokeWidth,
                                opacity: el.opacity, fillOpacity: el.fillOpacity, strokeOpacity: el.strokeOpacity, blendMode: el.blendMode,
                                strokeLinecap: el.strokeLinecap, strokeLinejoin: el.strokeLinejoin, strokeDasharray: el.strokeDasharray, strokeDashoffset: el.strokeDashoffset
                            } as GenericPathObject;
                        }
                        if (el.type === 'text') {
                            const textEl = el as ParsedTextElement;
                            const { width, height } = (textEl.width != null && textEl.height != null)
                                ? { width: textEl.width, height: textEl.height }
                                : measureText(textEl.text, textEl.fontSize, textEl.fontFamily, textEl.fontWeight);
                            return {
                                id: String(Date.now() + i + Math.random()),
                                type: 'text',
                                text: textEl.text,
                                x: textEl.x, y: textEl.y, width, height,
                                fontSize: textEl.fontSize, fontFamily: textEl.fontFamily, fontWeight: textEl.fontWeight,
                                rotation: 0, skewX: 0, skewY: 0,
                                fill: textEl.fill, stroke: textEl.stroke, strokeWidth: textEl.strokeWidth,
                                opacity: textEl.opacity, fillOpacity: textEl.fillOpacity, strokeOpacity: textEl.strokeOpacity, blendMode: textEl.blendMode,
                                isForeignObject: textEl.isForeignObject, textAlign: textEl.textAlign, verticalAlign: textEl.verticalAlign, backgroundColor: textEl.backgroundColor
                            } as TextObject;
                        }
                        if (el.type === 'image') {
                            return {
                                id: String(Date.now() + i + Math.random()),
                                type: 'image',
                                href: el.href,
                                x: el.x, y: el.y, width: el.width, height: el.height,
                                rotation: 0, skewX: 0, skewY: 0,
                                fill: 'none', stroke: 'none', strokeWidth: 0,
                                opacity: el.opacity, fillOpacity: el.fillOpacity, strokeOpacity: el.strokeOpacity, blendMode: el.blendMode,
                            } as ImageObject;
                        }
                        return null;
                    }).filter(Boolean) as VectorObject[];

                    if (scaleMode === 'fit') {
                        const bounds = calculateGroupBounds(newObjects);
                        if (bounds.width > 0 && bounds.height > 0) {
                            const scale = Math.min(canvasWidth / bounds.width, canvasHeight / bounds.height) * 0.8;
                            const centerX = (canvasWidth - bounds.width * scale) / 2;
                            const centerY = (canvasHeight - bounds.height * scale) / 2;
                            
                            const matrix = new DOMMatrix();
                            matrix.translateSelf(centerX, centerY);
                            matrix.scaleSelf(scale, scale);
                            matrix.translateSelf(-bounds.x, -bounds.y);

                            newObjects.forEach(obj => {
                                if (obj.type === 'generic-path' || obj.type === 'text' || obj.type === 'image') {
                                    const newPos = transformPoint([obj.x, obj.y], matrix);
                                    obj.x = newPos[0];
                                    obj.y = newPos[1];
                                    obj.width *= scale;
                                    obj.height *= scale;
                                    if (obj.type === 'text') {
                                        (obj as TextObject).fontSize *= scale;
                                    }
                                }
                            });
                        }
                    }

                    setAppState(produce(draft => {
                        const layer = draft.layers.find(l => l.id === layerId);
                        if (layer) {
                            layer.objects.push(...newObjects);
                        }
                    }));
                    setSelectedObjectInfo({ layerId, objectIds: newObjects.map(o => o.id) });
                });
            } catch (err) {
                alert("Error importing SVG file.");
                console.error(err);
            }
        }
        setIsImportModalOpen(false);
        setPendingImport(null);
    };

    const handleInitiateTrace = useCallback((image: ImageObject) => {
        setImageToTrace(image);
        setIsTraceModalOpen(true);
    }, []);

    const handleApplyTrace = useCallback((tracedata: any) => {
        if (!imageToTrace || !appState.activeLayerId) return;
    
        setAppState(produce(draft => {
            const layer = draft.layers.find(l => l.id === appState.activeLayerId);
            if (!layer) return;
    
            const originalImageIndex = layer.objects.findIndex(o => o.id === imageToTrace.id);
            if (originalImageIndex === -1) return;
            
            const originalImage = layer.objects[originalImageIndex] as ImageObject;
    
            const newObjects: GenericPathObject[] = [];
    
            tracedata.layers.forEach((pathLayer: any[], lnum: number) => {
                const color = tracedata.palette[lnum];
                const fill = `rgb(${color.r},${color.g},${color.b})`;
                const opacity = color.a / 255.0;
    
                pathLayer.forEach((pathData: any) => {
                    if (!pathData.isholepath) {
                        const segments = pathData.segments;
                        let d = `M ${segments[0].x1} ${segments[0].y1} `;
                        segments.forEach((seg: any) => {
                            d += `${seg.type} ${seg.x2} ${seg.y2} `;
                            if (seg.x3) d += `${seg.x3} ${seg.y3} `;
                        });
                        d += 'Z ';
    
                        // Add holes
                        pathData.holechildren.forEach((holeIdx: number) => {
                            const holePath = pathLayer[holeIdx];
                            const holeSegments = holePath.segments;
                            if (holeSegments.length > 0) {
                                const lastSeg = holeSegments[holeSegments.length - 1];
                                d += `M ${lastSeg.x3 || lastSeg.x2} ${lastSeg.y3 || lastSeg.y2} `;
                                for (let i = holeSegments.length - 1; i >= 0; i--) {
                                    const seg = holeSegments[i];
                                    d += `${seg.type} `;
                                    if (seg.x3) d += `${seg.x2} ${seg.y2} `;
                                    d += `${seg.x1} ${seg.y1} `;
                                }
                                d += 'Z ';
                            }
                        });
    
                        // Scale and position the path to match the original image
                        const scaleX = originalImage.width / tracedata.width;
                        const scaleY = originalImage.height / tracedata.height;
    
                        const matrix = new DOMMatrix();
                        const cx = originalImage.x + originalImage.width / 2;
                        const cy = originalImage.y + originalImage.height / 2;
                        
                        matrix.translateSelf(cx, cy);
                        matrix.rotateSelf(originalImage.rotation || 0);
                        matrix.skewXSelf(originalImage.skewX || 0);
                        matrix.skewYSelf(originalImage.skewY || 0);
                        matrix.scaleSelf(scaleX, scaleY);
                        matrix.translateSelf(-tracedata.width / 2, -tracedata.height / 2);
                        
                        const finalD = transformPathData(d, matrix);
                        const finalBounds = calculateGenericPathBounds(finalD);
    
                        const newPath: GenericPathObject = {
                            id: String(Date.now() + Math.random()),
                            type: 'generic-path',
                            d: finalD,
                            ...finalBounds,
                            rotation: 0, // Baked into path
                            skewX: 0,
                            skewY: 0,
                            fill,
                            stroke: 'none',
                            strokeWidth: 0,
                            opacity: opacity,
                            fillOpacity: 1,
                            strokeOpacity: 1,
                            blendMode: 'normal',
                        };
                        newObjects.push(newPath);
                    }
                });
            });
            
            // Group the new objects
            const groupBounds = calculateGroupBounds(newObjects);
            const groupId = `trace-group-${Date.now()}`;
            const newGroup: GroupObject = {
                id: groupId,
                type: 'group',
                objectIds: newObjects.map(o => o.id),
                ...groupBounds,
                rotation: 0,
                skewX: 0,
                skewY: 0,
                fill: 'none',
                stroke: 'none',
                strokeWidth: 0,
                opacity: 1,
                fillOpacity: 1,
                strokeOpacity: 1,
                blendMode: 'normal',
            };
    
            // Replace original image with the group and its children
            layer.objects.splice(originalImageIndex, 1, ...newObjects, newGroup);
            
            // Select the new group
            setSelectedObjectInfo({ layerId: appState.activeLayerId, objectIds: [groupId] });
        }));
    
        setIsTraceModalOpen(false);
        setImageToTrace(null);
    }, [imageToTrace, appState.activeLayerId, setAppState, setSelectedObjectInfo]);

    /**
     * Applies the result of the Nesting algorithm to the objects on the canvas.
     * Updates positions and rotations of objects to pack them tightly.
     */
    const handleApplyNesting = useCallback((result: NestingResult) => {
        setAppState(produce(draft => {
            const layer = draft.layers.find(l => l.id === appState.activeLayerId);
            if (!layer) return;

            result.placements.forEach(p => {
                const obj = layer.objects.find(o => o.id === p.id);
                if (!obj) return;

                // Nesting Logic:
                // p.x, p.y are the CENTER of the placed object.
                // p.rotation is the absolute rotation applied to the canonical (unrotated) object.
                
                // 1. Set the new rotation
                obj.rotation = p.rotation;
                obj.skewX = 0; 
                obj.skewY = 0;

                // 2. Calculate the center of the object in its new rotation
                // Since obj.rotation rotates around the visual center of the bounds,
                // the center relative to obj.x/obj.y (top-left) is simply w/2, h/2.
                // obj.x and obj.y define the top-left corner of the bounding box.
                
                const currentCenterX = obj.x + obj.width / 2;
                const currentCenterY = obj.y + obj.height / 2;

                const dx = p.x - currentCenterX;
                const dy = p.y - currentCenterY;

                // 3. Move object so its center aligns with p.x, p.y
                obj.x += dx;
                obj.y += dy;

                // 4. Update internal points for point-based objects because their geometry
                // is separate from the object-level transform properties in our data model.
                
                if (obj.type === 'polygon') {
                    const poly = obj as PolygonObject;
                    poly.points.forEach(pt => {
                        pt.anchor[0] += dx; pt.anchor[1] += dy;
                        pt.handle1[0] += dx; pt.handle1[1] += dy;
                        pt.handle2[0] += dx; pt.handle2[1] += dy;
                    });
                } else if (obj.type === 'path' || obj.type === 'flow-guide') {
                    const path = obj as PathObject;
                    path.points.forEach(pt => { pt[0] += dx; pt[1] += dy; });
                } else if (obj.type === 'line') {
                    const line = obj as LineObject;
                    line.x1 += dx; line.y1 += dy;
                    line.x2 += dx; line.y2 += dy;
                } else if (obj.type === 'measurement') {
                    const meas = obj as MeasurementObject;
                    meas.x1 += dx; meas.y1 += dy;
                    meas.x2 += dx; meas.y2 += dy;
                }
            });
        }));
        setIsNestingModalOpen(false);
    }, [appState.activeLayerId, setAppState]);

    /**
     * Exports the project as an SVG file.
     */
    const handleExportSVG = useCallback(async () => {
        const svgString = await inlineFontsInSVG(
            generateSVGString(appState, units, { inverted: isExportInverted, includeMeasurements }), appState
        );
        return saveFile(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`);
    }, [appState, units, isExportInverted, includeMeasurements, filename]);

    const handleExportDXF = useCallback(async () => {
        const dxfString = generateDXFString(appState, units, { includeMeasurements });
        return saveFile(new Blob([dxfString], { type: 'application/dxf' }), `${filename}.dxf`);
    }, [appState, filename, units, includeMeasurements]);

    const handleExportPNG = useCallback(async () => {
        const svgString = await inlineFontsInSVG(
            generateSVGString(appState, units, { inverted: isExportInverted, includeMeasurements }), appState
        );
        const { width, height } = appState.canvasConfig;
        const canvas = await renderSVGToCanvas(svgString, width, height, pngExportScale);
        return saveFile(await canvasToPNG(canvas), `${filename}.png`);
    }, [appState, units, isExportInverted, includeMeasurements, pngExportScale, filename]);

    const handleExportPDF = useCallback(async () => {
        const svgString = await inlineFontsInSVG(
            generateSVGString(appState, units, { inverted: isExportInverted, includeMeasurements }), appState
        );
        const { width, height } = appState.canvasConfig;
        const canvas = await renderSVGToCanvas(svgString, width, height, 4);
        const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'px', format: [width, height] });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, width, height);
        return saveFile(pdf.output('blob'), `${filename}.pdf`);
    }, [appState, units, isExportInverted, includeMeasurements, filename]);

    /**
     * Clears all content from all layers in the project.
     */
    const handleClear = useCallback(() => {
        setDensityImages({});
        setAppState(produce((draft: AppState) => {
          draft.layers.forEach((layer) => {
            layer.settings.densityImageURL = null;
            layer.objects = [];
            layer.clipPolygonPoints = [];
            layer.isClipPolygonClosed = false;
          });
        }));
        setInteraction({ mode: 'idle' });
        setSelectedObjectInfo(null);
        setEditingMode('shape');
      }, [setAppState, setDensityImages, setInteraction, setSelectedObjectInfo, setEditingMode]);


    return {
        isExportModalOpen, setIsExportModalOpen,
        isNewProjectModalOpen, setIsNewProjectModalOpen,
        isSaveModalOpen, setIsSaveModalOpen,
        handleCancelSave: () => { setIsSaveModalOpen(false); setNextAction(null); },
        isCanvasSettingsModalOpen, setIsCanvasSettingsModalOpen,
        isNewProjectSettingsOpen, setIsNewProjectSettingsOpen,
        isHelpModalOpen, setIsHelpModalOpen,
        isNestingModalOpen, setIsNestingModalOpen,
        
        isImportModalOpen, setIsImportModalOpen,
        pendingImport,
        handleInitiateImport,
        isTraceModalOpen, setIsTraceModalOpen,
        imageToTrace,
        handleInitiateTrace,
        handleConfirmImport,

        filename, setFilename,
        isExportInverted, setIsExportInverted,
        includeMeasurements, setIncludeMeasurements,
        pngExportScale, setPngExportScale,
        handleNewProject,
        handleCreateProject,
        handleSaveAndNew,
        handleNewWithoutSaving,
        handleSaveProjectFile,
        handleSave,
        handleFileSelectedForLoad,
        loadProjectFile,
        handleExportSVG,
        handleExportPNG,
        handleExportPDF,
        handleExportDXF,
        handleApplyTrace,
        handleApplyNesting,
        handlePrint,
        handleClear,
    };
};
