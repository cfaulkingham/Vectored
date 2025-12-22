
import React from 'react';

/**
 * Represents the available types of generative patterns that can be created.
 */
export type PatternType = 'voronoi' | 'circles' | 'halftone' | 'sine' | 'stipple' | 'words' | 'topo' | 'reaction-diffusion' | 'lsystem' | 'colonization' | 'crosshatch' | 'glitch' | 'rose-curve' | 'flow-field' | 'truchet' | 'hatch' | 'living-hinge' | 'spirograph' | 'guilloche' | 'gears' | 'jigsaw' | 'maze' | 'box-joint' | 'none';

/**
 * Represents the units of measurement supported by the application.
 */
export type Units = 'mm' | 'in' | 'px';

/**
 * Represents the blend modes available for composing layers and objects.
 */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

/**
 * Represents the mirroring mode for drawing operations.
 */
export type MirrorMode = 'off' | 'horizontal' | 'vertical';

/**
 * Represents the shape of the ends of stroke lines.
 */
export type StrokeLineCap = 'butt' | 'round' | 'square';

/**
 * Represents the shape of the corners where stroke lines meet.
 */
export type StrokeLineJoin = 'miter' | 'round' | 'bevel';


/**
 * Represents a point in 2D space as a tuple of [x, y] coordinates.
 */
export type Point = [number, number];

/**
 * Represents a vertex in a polygon, including its anchor point and control handles for Bezier curves.
 */
export type PolygonVertex = {
  /** The main anchor point of the vertex. */
  anchor: Point;
  /** Control point for the incoming curve segment. */
  handle1: Point; 
  /** Control point for the outgoing curve segment. */
  handle2: Point; 
};

/**
 * Represents the raw, calculated data for a pattern before it's styled or converted for rendering.
 */
export type PrimitivePatternData = 
  | { type: 'voronoi' | 'sine' | 'topo' | 'reaction-diffusion' | 'lsystem' | 'colonization' | 'crosshatch' | 'glitch' | 'rose-curve' | 'flow-field' | 'truchet' | 'hatch' | 'living-hinge' | 'spirograph' | 'guilloche' | 'gears' | 'jigsaw' | 'maze' | 'box-joint', paths: string[] } 
  | { type: 'circles' | 'halftone' | 'stipple', circles: { cx: number, cy: number, r: number }[] } 
  | { type: 'words', words: { text: string, lines: string[], x: number, y: number, fontSize: number, fontFamily: string, fontWeight: string, rotation: number }[] } 
  | null;

/**
 * Represents a final, drawable SVG element for the canvas.
 */
export type RenderableElement =
  | {
      key: string;
      type: 'path';
      props: React.SVGProps<SVGPathElement>;
    }
  | {
      key: string;
      type: 'circle';
      props: React.SVGProps<SVGCircleElement>;
    }
  | {
      key: string;
      type: 'text';
      props: React.SVGProps<SVGTextElement> & { children?: React.ReactNode };
    }
  | {
      key: string;
      type: 'rect';
      props: React.SVGProps<SVGRectElement>;
    }
  | {
      key: string;
      type: 'ellipse';
      props: React.SVGProps<SVGEllipseElement>;
    }
  | {
      key: string;
      type: 'line';
      props: React.SVGProps<SVGLineElement>;
    }
  | {
      key: string;
      type: 'image';
      props: React.SVGProps<SVGImageElement>;
    }
  | {
      key: string;
      type: 'foreignObject';
      props: React.SVGProps<SVGForeignObjectElement> & { children?: React.ReactNode };
    }
  | {
      key: string;
      type: 'g';
      props: React.SVGProps<SVGGElement> & { children?: React.ReactNode };
    };


/**
 * Represents the type of resize handle being interacted with.
 */
export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right' | 'start' | 'end';

/**
 * Represents information about what is currently being hovered over in the canvas.
 */
export type HoverInfo = 
  | { type: 'anchor'; vertexIndex: number }
  | { type: 'handle'; vertexIndex: number; handleKey: 'handle1' | 'handle2' }
  | { type: 'segment'; segmentIndex: number }
  | { type: 'layer_handle' }
  | { type: 'object'; layerId: string; objectId: string }
  | { type: 'resize_handle'; layerId: string; objectId: string; handle: ResizeHandle }
  | { type: 'rotate_handle'; layerId: string; objectId: string }
  | { type: 'polygon_anchor'; layerId: string; objectId: string; vertexIndex: number }
  | { type: 'polygon_handle'; layerId: string; objectId: string; vertexIndex: number; handleKey: 'handle1' | 'handle2' }
  | { type: 'polygon_segment'; layerId: string; objectId: string; segmentIndex: number }
  | { type: 'layer_resize_handle'; handle: ResizeHandle }
  | { type: 'layer_rotate_handle' }
  | { type: 'measure_segment'; p1: Point; p2: Point; objectId: string }
  | { type: 'close_polygon' }
  | { type: 'guide'; guide: Guide };

/**
 * Represents the type of a vector object.
 */
export type VectorObjectType = 'polygon' | 'text' | 'path' | 'line' | 'shape' | 'generic-path' | 'flow-guide' | 'path-group' | 'group' | 'image' | 'measurement';

/**
 * Represents a color stop in a gradient.
 */
export type ColorStop = {
  /** The offset of the color stop, from 0 to 1. */
  offset: number; 
  /** The color value at this stop. */
  color: string;
};

/**
 * Represents a linear gradient definition.
 */
export interface LinearGradient {
  type: 'linear';
  angle: number;
  units?: 'objectBoundingBox' | 'userSpaceOnUse';
  coords?: { x1: number; y1: number; x2: number; y2: number };
  stops: ColorStop[];
}

/**
 * Represents a radial gradient definition.
 */
export interface RadialGradient {
  type: 'radial';
  /** The x-coordinate of the center of the gradient (0 to 1). */
  cx: number; 
  /** The y-coordinate of the center of the gradient (0 to 1). */
  cy: number; 
  /** The radius of the gradient (0 to 1). */
  r: number; 
  stops: ColorStop[];
}

/**
 * Represents a gradient, either linear or radial.
 */
export type Gradient = LinearGradient | RadialGradient;

/**
 * Base interface for all vector objects, containing common properties.
 */
interface BaseVectorObject {
  id: string;
  type: VectorObjectType;
  rotation: number;
  skewX: number;
  skewY: number;
  fill: string | Gradient;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number; // Added to support rounded corners
  groupId?: string;
  strokeLinecap?: StrokeLineCap;
  strokeLinejoin?: StrokeLineJoin;
  strokeDasharray?: string;
  strokeDashoffset?: number;
  opacity: number;
  fillOpacity: number;
  strokeOpacity: number;
  blendMode: BlendMode;
  flipX?: boolean;
  flipY?: boolean;
}

/**
 * Represents a polygon object.
 */
export interface PolygonObject extends BaseVectorObject {
  type: 'polygon';
  points: PolygonVertex[];
  isClosed: boolean;
  // Bounding box for rotation/selection
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a text object.
 */
export interface TextObject extends BaseVectorObject {
    type: 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    lineHeight?: number;
    letterSpacing?: number;
    // Text on Path properties
    textPathId?: string; // ID of the path/shape object
    textPathStartOffset?: number; // 0 to 100 (percentage)
    textPathAlign?: 'start' | 'middle' | 'end';
    textPathSide?: 'left' | 'right'; // Uses dy to flip side
    // Foreign Object properties
    isForeignObject?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    backgroundColor?: string;
}

/**
 * Represents a freehand path object.
 */
export interface PathObject extends BaseVectorObject {
    type: 'path';
    points: Point[];
    // Bounding box for selection/transform
    x: number;
    y: number;
    width: number;
    height: number;
    smoothing: number;
}

/**
 * Represents a flow guide object used for controlling flow fields.
 */
export interface FlowGuideObject extends BaseVectorObject {
  type: 'flow-guide';
  points: Point[];
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a straight line object.
 */
export interface LineObject extends BaseVectorObject {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    // Bounding box for rotation/selection
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Represents a measurement object (dimension line or label).
 */
export interface MeasurementObject extends BaseVectorObject {
    type: 'measurement';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    // Bounding box
    x: number;
    y: number;
    width: number;
    height: number;
    // Specifics
    measurementType: 'distance' | 'radius' | 'diameter' | 'circumference' | 'area' | 'perimeter';
    referenceId?: string; // Optional: ID of object being measured
    showLength: boolean;
    showAngle: boolean;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    textColor: string;
    measurementOffset?: number;
}

/**
 * Represents the type of geometric shape.
 */
export type ShapeType = 'rectangle' | 'ellipse' | 'triangle' | 'star' | 'heart' | 'moon' | 'hexagon' | 'diamond' | 'pentagon' | 'octagon' | 'arrow' | 'cross' | 'ring';

/**
 * Represents a geometric shape object.
 */
export interface ShapeObject extends BaseVectorObject {
    type: 'shape';
    x: number;
    y: number;
    width: number;
    height: number;
    shapeType: ShapeType;
}

/**
 * Represents a generic path object defined by an SVG path data string.
 */
export interface GenericPathObject extends BaseVectorObject {
    type: 'generic-path';
    d: string;
    // Bounding box
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Represents an image object.
 */
export interface ImageObject extends BaseVectorObject {
    type: 'image';
    href: string; // URL or data URL
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Settings for a path group, controlling how objects are distributed along a path.
 */
export interface PathGroupSettings {
  distributionMode: 'count' | 'distance';
  count: number;
  distance: number;
  startOffset: number; // 0-1
  endOffset: number; // 0-1
  alignToPath: boolean;
  rotationOffset: number;
  perpendicularOffset: number;
}


/**
 * Represents a group of objects distributed along a path.
 */
export interface PathGroupObject extends BaseVectorObject {
  type: 'path-group';
  pathId: string;
  templateObjectIds: string[];
  settings: PathGroupSettings;
  // Bounding box properties
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupObject extends BaseVectorObject {
    type: 'group';
    objectIds: string[];
    x: number;
    y: number;
    width: number;
    height: number;
}

export type VectorObject = 
  | PolygonObject 
  | TextObject 
  | PathObject 
  | LineObject 
  | ShapeObject 
  | GenericPathObject 
  | FlowGuideObject 
  | PathGroupObject 
  | ImageObject 
  | MeasurementObject 
  | GroupObject;

export type BrushPatternType = 'stipple' | 'words' | 'hatch' | 'circles';

export interface LayerSettings {
    patternType: PatternType;
    strokeWidth: number;
    pointCount: number;
    minCircleRadius: number;
    maxCircleRadius: number;
    circlePacking: number;
    densityRadius: number;
    gridSpacing: number;
    radiusDistribution: number;
    sineAmplitude: number;
    sineFrequency: number;
    sineWaveCount: number;
    sineThickness: number;
    sineThicknessVariation: number;
    sineThicknessFrequency: number;
    relaxationIterations: number;
    densityImageURL: string | null;
    densityImageInvert: boolean;
    wordText: string;
    wordFontFamily: string;
    wordMinFontSize: number;
    wordMaxFontSize: number;
    wordFontSizeDistribution: number;
    wordFontWeight: string;
    wordRotation: number;
    topoLineCount: number;
    topoNoise: number;
    topoBlur: number;
    topoNoiseScale: number;
    rdFeed: number;
    rdKill: number;
    rdIterations: number;
    rdLineCount: number;
    lsAxiom: string;
    lsRules: string;
    lsIterations: number;
    lsAngle: number;
    lsStep: number;
    lsSmoothing: number;
    colonizationAttractionPoints: number;
    colonizationInfluenceRadius: number;
    colonizationKillRadius: number;
    colonizationBranchLength: number;
    colonizationIterations: number;
    colonizationRoots: number;
    colonizationWaviness: number;
    colonizationSmoothing: number;
    seed: number;
    hatchAngle1: number;
    hatchSpacing1: number;
    hatchAngle2: number;
    hatchSpacing2: number;
    hatchJitter: number;
    hatchDensityStrength: number;
    hatchSpacing: number;
    hatchAngleRandomness: number;
    hatchCurviness: number;
    glitchRectCount: number;
    glitchLineCount: number;
    glitchDisplacement: number;
    roseN: number;
    roseD: number;
    roseKMax: number;
    flowLineCount: number;
    flowStepLength: number;
    flowMaxSteps: number;
    flowNoiseScale: number;
    flowGridResolution: number;
    flowSmoothing: number;
    truchetTileSize: number;
    truchetVariant: 'arcs' | 'diagonal' | 'cross';
    truchetMinTileSize: number;
    livingHingeCutLength: number;
    livingHingeGapSize: number;
    livingHingeLineSpacing: number;
    livingHingeMargin: number;
    livingHingeOrientation: 'vertical' | 'horizontal';
    spirographrRatio: number;
    spirographdRatio: number;
    spirographLaps: number;
    guillocheAmplitude1: number;
    guillocheFrequency1: number;
    guillocheAmplitude2: number;
    guillocheFrequency2: number;
    guillocheLaps: number;
    gearTeeth: number;
    gearModule: number;
    gearPressureAngle: number;
    gearHoleRadius: number;
    jigsawColumns: number;
    jigsawRows: number;
    jigsawTabSize: number;
    jigsawJitter: number;
    jigsawRoundness: number;
    mazeCellSize: number;
    mazeAlgorithm: 'recursive-backtracker' | 'prim';
    mazeType: 'square' | 'polar';
    mazePadding: number;
    boxWidth: number;
    boxHeight: number;
    boxDepth: number;
    materialThickness: number;
    jointSize: number;
    brushPatternType: BrushPatternType;
    brushSize: number;
    brushDensity: number;
    brushScaleJitter: number;
    brushAngleJitter: number;
    wordBrushGrowthMode: 'random' | 'grow' | 'shrink';
}

export interface Layer {
    id: string;
    name: string;
    visible: boolean;
    settings: LayerSettings;
    points: Point[];
    objects: VectorObject[];
    useClipping: boolean;
    clipMode: 'normal' | 'inverted';
    clipPolygonPoints: PolygonVertex[];
    isClipPolygonClosed: boolean;
    offsetX: number;
    offsetY: number;
    rotation: number;
    scale: number;
    skewX: number;
    skewY: number;
    color: string;
    blendMode: BlendMode;
    isLocked: boolean;
    patternData: PrimitivePatternData | null;
    isGenerating: boolean;
}

export interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
}

export interface AppState {
    layers: Layer[];
    activeLayerId: string | null;
    canvasConfig: { width: number, height: number };
    guides: Guide[];
}

export type InteractionState = 
    | { mode: 'idle' }
    | { mode: 'dragging_new_guide'; orientation: 'horizontal' | 'vertical'; guide: Guide }
    | { mode: 'moving_guide'; guide: Guide }
    | { mode: 'drawing'; vertexIndex: number }
    | { mode: 'drawing_polygon'; object: PolygonObject; vertexIndex: number; mirroredObjectId?: string }
    | { mode: 'drawing_path'; object: PathObject; mirroredObjectId?: string }
    | { mode: 'drawing_line'; object: LineObject; mirroredObjectId?: string }
    | { mode: 'drawing_object'; object: ShapeObject; startPoint: Point; mirroredObjectId?: string }
    | { mode: 'drawing_pattern_brush'; points: Point[]; mirroredStrokeId?: string }
    | { mode: 'drawing_measurement'; object: MeasurementObject; mirroredObjectId?: string; startPoint: Point }
    | { mode: 'measuring'; startPoint: Point; currentPoint: Point }
    | { mode: 'marquee_selection'; startPoint: Point; currentPoint: Point; shiftKey: boolean }
    | { mode: 'moving_clip_path'; startPoint: Point; startClipPoints: PolygonVertex[] }
    | { mode: 'moving_anchor'; vertexIndex: number; startPoint: Point; startVertex: PolygonVertex }
    | { mode: 'moving_handle'; vertexIndex: number; handleKey: 'handle1' | 'handle2' }
    | { mode: 'moving_polygon_anchor'; layerId: string; objectId: string; vertexIndex: number; startPoint: Point; startVertex: PolygonVertex }
    | { mode: 'moving_polygon_handle'; layerId: string; objectId: string; vertexIndex: number; handleKey: 'handle1' | 'handle2' }
    | { mode: 'moving_polygon_segment'; layerId: string; objectId: string; segmentIndex: number; startPoint: Point; startVertex: PolygonVertex }
    | { mode: 'moving_layer'; startPoint: Point; startOffsetX: number; startOffsetY: number }
    | { mode: 'resizing_layer'; startLayer: Layer; handle: ResizeHandle; startPoint: Point; pivotPoint: Point }
    | { mode: 'rotating_layer'; startLayer: Layer; center: Point; startAngle: number }
    | { mode: 'moving_object'; layerId: string; startPoint: Point; startObjects: VectorObject[] }
    | { mode: 'resizing_object'; layerId: string; objectId: string; startObject: VectorObject; handle: ResizeHandle; mirroredObjectId?: string }
    | { mode: 'rotating_object'; layerId: string; objectId: string; startObject: VectorObject; center: Point; startAngle: number; mirroredObjectId?: string; startMirroredObject?: VectorObject }
    | { mode: 'resizing_group'; layerId: string; startObjects: VectorObject[]; handle: ResizeHandle; startGroupBounds: {x:number, y:number, width:number, height:number}; pivotPoint: Point }
    | { mode: 'rotating_group'; layerId: string; startObjects: VectorObject[]; groupCenter: Point; startAngle: number }
    | { mode: 'editing_text'; layerId: string; objectId: string };

export interface ActiveGuide {
    type: 'vertical' | 'horizontal';
    position: number;
    start: number;
    end: number;
}

export interface SnapSettings {
    grid: boolean;
    gridSize: number;
    smart: boolean;
    threshold: number;
}

export interface ParsedElement {
    type: 'path' | 'text' | 'image';
    id?: string;
    d?: string; // for path
    text?: string; // for text
    href?: string; // for image
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string | Gradient;
    stroke?: string;
    strokeWidth?: number;
    strokeLinecap?: StrokeLineCap;
    strokeLinejoin?: StrokeLineJoin;
    strokeDasharray?: string;
    strokeDashoffset?: number;
    opacity?: number;
    fillOpacity?: number;
    strokeOpacity?: number;
    blendMode?: BlendMode;
    // Text specific
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    isForeignObject?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    backgroundColor?: string;
}

export type ParsedPathElement = ParsedElement & { type: 'path', d: string };
export type ParsedTextElement = ParsedElement & { type: 'text', text: string, x: number, y: number };
export type ParsedImageElement = ParsedElement & { type: 'image', href: string, x: number, y: number, width: number, height: number };

export type AlignmentType = 'align-left' | 'align-center-h' | 'align-right' | 'align-top' | 'align-center-v' | 'align-bottom' | 'distribute-h' | 'distribute-v';

export interface NestingResult {
    placements: NestedPlacement[];
    fitness: number;
    generation: number;
    bounds: { width: number; height: number };
}

export interface NestedPlacement {
    id: string;
    x: number;
    y: number;
    rotation: number;
}
