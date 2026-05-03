

import type { Layer, LayerSettings, AppState } from '../types';

/**
 * The default configuration settings for a new layer.
 * Includes default values for all supported pattern generators (Voronoi, L-System, Maze, etc.)
 * to ensure generators have valid inputs upon initialization.
 */
export const defaultLayerSettings: LayerSettings = {
  patternType: 'none',
  strokeWidth: 1,
  pointCount: 300,
  minCircleRadius: 1,
  maxCircleRadius: 8,
  circlePacking: 1.2,
  densityRadius: 25,
  gridSpacing: 12,
  radiusDistribution: 1.0,
  sineAmplitude: 10,
  sineFrequency: 0.05,
  sineWaveCount: 10,
  sineThickness: 10,
  sineThicknessVariation: 5,
  sineThicknessFrequency: 0.1,
  relaxationIterations: 3,
  densityImageURL: null,
  densityImageInvert: false,
  wordText: 'Live\nLong\nand\nProsper',
  wordFontFamily: 'Roboto',
  wordMinFontSize: 12,
  wordMaxFontSize: 22,
  wordFontSizeDistribution: 1.0,
  wordFontWeight: 'bold',
  wordRotation: 45,
  topoLineCount: 50,
  topoNoise: 0,
  topoBlur: 2,
  topoNoiseScale: 4.0,
  rdFeed: 0.055,
  rdKill: 0.062,
  rdIterations: 4000,
  rdLineCount: 10,
  lsAxiom: 'F',
  lsRules: 'F -> FF+[+F-F-F]-[-F+F+F]',
  lsIterations: 4,
  lsAngle: 22.5,
  lsStep: 5,
  lsSmoothing: 0,
  colonizationAttractionPoints: 400,
  colonizationInfluenceRadius: 80,
  colonizationKillRadius: 10,
  colonizationBranchLength: 5,
  colonizationIterations: 200,
  colonizationRoots: 1,
  colonizationWaviness: 0,
  colonizationSmoothing: 0,
  seed: Math.floor(Math.random() * 100000),
  // Crosshatch defaults
  hatchAngle1: -45,
  hatchSpacing1: 10,
  hatchAngle2: 45,
  hatchSpacing2: 10,
  hatchJitter: 0,
  hatchDensityStrength: 1,
  // Hatch defaults
  hatchSpacing: 5,
  hatchAngleRandomness: 1,
  hatchCurviness: 0.2,
  // Glitch defaults
  glitchRectCount: 50,
  glitchLineCount: 100,
  glitchDisplacement: 20,
  // Rose Curve defaults
  roseN: 5,
  roseD: 1.0,
  roseKMax: 360,
  // Flow Field defaults
  flowLineCount: 1000,
  flowStepLength: 2,
  flowMaxSteps: 100,
  flowNoiseScale: 0.01,
  flowGridResolution: 20,
  flowSmoothing: 0.5,
  // Truchet defaults
  truchetTileSize: 20,
  truchetVariant: 'arcs',
  truchetMinTileSize: 5,
  // Living Hinge defaults
  livingHingeCutLength: 10,
  livingHingeGapSize: 2,
  livingHingeLineSpacing: 3,
  livingHingeMargin: 5,
  livingHingeOrientation: 'vertical',
  // Spirograph defaults
  spirographrRatio: 0.6,
  spirographdRatio: 0.8,
  spirographLaps: 5,
  // Guilloche defaults
  guillocheAmplitude1: 0.1,
  guillocheFrequency1: 12,
  guillocheAmplitude2: 0.2,
  guillocheFrequency2: 5,
  guillocheLaps: 12,
  // Gears defaults
  gearTeeth: 12,
  gearModule: 10,
  gearPressureAngle: 20,
  gearHoleRadius: 5,
  // Jigsaw defaults
  jigsawColumns: 5,
  jigsawRows: 5,
  jigsawTabSize: 0.2,
  jigsawJitter: 0.05,
  jigsawRoundness: 0.5,
  // Maze Defaults
  mazeCellSize: 20,
  mazeAlgorithm: 'recursive-backtracker',
  mazeType: 'square',
  mazePadding: 0,
  // Box Joint defaults
  boxWidth: 100,
  boxHeight: 60,
  boxDepth: 60,
  materialThickness: 3,
  jointSize: 10,
  // Pattern Brush defaults
  brushPatternType: 'stipple',
  brushSize: 50,
  brushDensity: 0.5,
  brushScaleJitter: 0.5,
  brushAngleJitter: 15,
  wordBrushGrowthMode: 'random',
};

/**
 * Creates a new Layer object with a unique ID and default settings.
 * Initializes all transform properties (scale, rotation, skew) to identity values.
 * 
 * @returns A new, initialized Layer object.
 */
export const createNewLayer = (): Layer => ({
  id: Date.now().toString() + Math.random().toString(),
  name: 'New Layer',
  visible: true,
  settings: { ...defaultLayerSettings },
  points: [],
  objects: [],
  useClipping: false,
  clipMode: 'normal',
  clipPolygonPoints: [],
  isClipPolygonClosed: false,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scale: 1,
  skewX: 0,
  skewY: 0,
  color: '#000000',
  blendMode: 'normal',
  isLocked: false,
  patternData: null,
  isGenerating: false,
});

/**
 * Creates the initial application state structure.
 * Sets up a default "Layer 1" and configures the canvas dimensions (defaults to Letter size 96DPI).
 * 
 * @param dimensions - Optional initial width and height for the canvas.
 * @returns The initial AppState object ready for use.
 */
export const createInitialState = (dimensions?: { width: number, height: number, clipToCanvas?: boolean }): AppState => {
    const initialLayer = createNewLayer();
    initialLayer.name = "Layer 1";
    // Default to Letter size (8.5 x 11 inches @ 96 DPI) -> 816 x 1056 px
    const defaults = { width: 816, height: 1056, clipToCanvas: false };
    return {
        layers: [initialLayer],
        activeLayerId: initialLayer.id,
        canvasConfig: dimensions || defaults, 
        guides: [],
    };
};