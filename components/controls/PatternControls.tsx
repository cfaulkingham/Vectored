
import React, { useState, useEffect } from 'react';
import type { Layer, LayerSettings, VectorObjectType, PatternType } from '../../types';
import ControlButton from './ControlButton';
import ImageControl from './ImageControl';
import { 
    VoronoiIcon, TopoIcon, ReactionDiffusionIcon, LSystemIcon, ColonizationIcon, CrosshatchIcon, GlitchIcon, RoseCurveIcon, FlowFieldIcon, TruchetIcon, HatchIcon, SpirographIcon, GuillocheIcon, GearIcon, PuzzleIcon, MazeIcon,
    CirclesIcon, HalftoneIcon, StippleIcon, SineIcon, WordsIcon, NoneIcon, LivingHingeIcon
} from './Icons';
import { googleFonts } from '../../lib/utils';
import { ControlSlider, ControlSelect } from './CommonControls';

interface PatternControlsProps {
    activeLayer: Layer;
    onUpdateActiveLayerSettings: (settings: Partial<LayerSettings>) => void;
    onDensityImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onApplyPatternFill: () => void;
    layers: Layer[];
    onUpdateActiveLayer: (updater: (layer: Layer) => void) => void;
    onToolChange: (tool: 'select' | VectorObjectType | 'pattern-brush') => void;
    activeTool: 'select' | 'node' | VectorObjectType | 'pattern-brush' | 'measure';
}

const lSystemPresets = [
    { name: 'Dragon Curve', axiom: 'FX', rules: 'X -> X+YF+\nY -> -FX-Y', angle: 90, iterations: 10, step: 5 },
    { name: 'Twin Dragon', axiom: 'FX+FX+', rules: 'X -> X+YF\nY -> FX-Y', angle: 90, iterations: 10, step: 5 },
    { name: 'Sierpinski Triangle', axiom: 'F-G-G', rules: 'F -> F-G+F+G-F\nG -> GG', angle: 120, iterations: 5, step: 6 },
    { name: 'Koch Snowflake', axiom: 'F++F++F', rules: 'F -> F-F++F-F', angle: 60, iterations: 3, step: 5 },
    { name: 'Hilbert Curve', axiom: 'A', rules: 'A -> -BF+AFA+FB-\nB -> +AF-BFB-FA+', angle: 90, iterations: 5, step: 6 },
    { name: 'Gosper Curve', axiom: 'A', rules: 'A -> A-B--B+A++AA+B-\nB -> +A-BB--B-A++A+B', angle: 60, iterations: 3, step: 7 },
    { name: 'Arrowhead Curve', axiom: 'A', rules: 'A -> B-A-B\nB -> A+B+A', angle: 60, iterations: 6, step: 5 },
    { name: 'Koch Island', axiom: 'F+F+F+F', rules: 'F -> F+F-F-FFF+F+F-F', angle: 90, iterations: 2, step: 4 },
    { name: 'Crystal', axiom: 'F+F+F+F', rules: 'F -> FF+F++F+F', angle: 90, iterations: 3, step: 8 },
    { name: 'Simple Bush', axiom: 'F', rules: 'F -> F[+F]F[-F]F', angle: 25.7, iterations: 4, step: 5 },
];

const standardFonts = ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];

/**
 * Controls for configuring generative patterns on a layer.
 * Handles selection of pattern type (Voronoi, Maze, L-System, etc.) and
 * exposes specific parameter sliders and inputs for each pattern type.
 */
export const PatternControls: React.FC<PatternControlsProps> = ({ activeLayer, onUpdateActiveLayerSettings, onDensityImageChange, onApplyPatternFill, onUpdateActiveLayer, onToolChange, activeTool }) => {
    const { settings, color } = activeLayer;
    const { patternType } = settings;

    const [editingSeed, setEditingSeed] = useState(false);
    const [localSeed, setLocalSeed] = useState(String(settings.seed));
    
    React.useEffect(() => {
        if (!editingSeed) {
            setLocalSeed(String(settings.seed));
        }
    }, [settings.seed, editingSeed]);

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateActiveLayer(layer => { layer.color = e.target.value; });
    };

    const patternGroups = [
        { label: 'Laser / Fabrication', types: [{ type: 'box-joint', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v4h6V3 M21 9h-4v6h4 M15 21v-4H9v4 M3 15h4V9H3" /></svg>, label: 'Box Joint' }, { type: 'living-hinge', icon: <LivingHingeIcon className="w-5 h-5" />, label: 'Living Hinge' }, { type: 'jigsaw', icon: <PuzzleIcon className="w-5 h-5" />, label: 'Jigsaw' }, { type: 'gears', icon: <GearIcon className="w-5 h-5" />, label: 'Gears' }, { type: 'maze', icon: <MazeIcon className="w-5 h-5" />, label: 'Maze' }] },
        { label: 'Geometric', types: [{ type: 'truchet', icon: <TruchetIcon className="w-5 h-5" />, label: 'Truchet' }, { type: 'hatch', icon: <HatchIcon className="w-5 h-5" />, label: 'Hatch' }, { type: 'crosshatch', icon: <CrosshatchIcon className="w-5 h-5" />, label: 'Crosshatch' }, { type: 'rose-curve', icon: <RoseCurveIcon className="w-5 h-5" />, label: 'Rose Curve' }, { type: 'sine', icon: <SineIcon className="w-5 h-5" />, label: 'Sine Wave' }, { type: 'spirograph', icon: <SpirographIcon className="w-5 h-5" />, label: 'Spirograph' }, { type: 'guilloche', icon: <GuillocheIcon className="w-5 h-5" />, label: 'Guilloché' }] },
        { label: 'Generative', types: [{ type: 'voronoi', icon: <VoronoiIcon className="w-5 h-5" />, label: 'Voronoi' }, { type: 'colonization', icon: <ColonizationIcon className="w-5 h-5" />, label: 'Colonization' }, { type: 'lsystem', icon: <LSystemIcon className="w-5 h-5" />, label: 'L-System' }, { type: 'reaction-diffusion', icon: <ReactionDiffusionIcon className="w-5 h-5" />, label: 'Reaction-Diffusion' }, { type: 'flow-field', icon: <FlowFieldIcon className="w-5 h-5" />, label: 'Flow Field' }, { type: 'topo', icon: <TopoIcon className="w-5 h-5" />, label: 'Topo Lines' }] },
        { label: 'Points & Density', types: [{ type: 'circles', icon: <CirclesIcon className="w-5 h-5" />, label: 'Circles' }, { type: 'halftone', icon: <HalftoneIcon className="w-5 h-5" />, label: 'Halftone' }, { type: 'stipple', icon: <StippleIcon className="w-5 h-5" />, label: 'Stipple' }] },
        { label: 'Experimental', types: [{ type: 'words', icon: <WordsIcon className="w-5 h-5" />, label: 'Words' }, { type: 'glitch', icon: <GlitchIcon className="w-5 h-5" />, label: 'Glitch' }] }
    ];

    const findCategoryForPattern = (pt: PatternType) => {
        if (pt === 'none') return patternGroups[0].label;
        return patternGroups.find(g => g.types.some(t => t.type === pt))?.label || patternGroups[0].label;
    };
    
    const [activeCategory, setActiveCategory] = useState(findCategoryForPattern(patternType));
    
    // Update category when pattern changes, unless it's none (keep existing category view)
    useEffect(() => { 
        if (patternType !== 'none') {
            setActiveCategory(findCategoryForPattern(patternType)); 
        }
    }, [patternType]);
    
    const currentGroup = patternGroups.find(g => g.label === activeCategory) || patternGroups[0];

    const showImageControl = ['voronoi', 'circles', 'halftone', 'stipple', 'sine', 'words', 'topo', 'crosshatch', 'truchet'].includes(patternType);
    const showPointCount = ['voronoi', 'circles', 'halftone', 'stipple', 'words', 'hatch'].includes(patternType);
    const showSeedControl = patternType !== 'none' && !['box-joint', 'gears', 'living-hinge', 'rose-curve', 'reaction-diffusion', 'lsystem', 'sine', 'spirograph', 'guilloche'].includes(patternType) && !(patternType === 'topo' && settings.densityImageURL);

    return (
        <fieldset disabled={activeLayer.isLocked} className="space-y-4 disabled:opacity-50">
            <div className="flex items-end space-x-3">
                <div className="flex-none">
                    <label className="block text-xs font-medium text-gray-400 mb-1 opacity-0">Clear</label>
                    <button 
                        onClick={() => onUpdateActiveLayerSettings({ patternType: 'none' })}
                        className={`p-2 rounded-md border transition-all duration-200 ${patternType === 'none' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                        title="No Pattern"
                    >
                        <NoneIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
                    <ControlSelect label="" value={activeCategory} onChange={setActiveCategory}>
                        {patternGroups.map(g => (<option key={g.label} value={g.label}>{g.label}</option>))}
                    </ControlSelect>
                </div>
                <div>
                    <div className="w-9 h-9 rounded border border-gray-600 relative mb-0 overflow-hidden" style={{ backgroundColor: color }} title="Pattern Color">
                         <input type="color" value={color} onChange={handleColorChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
                {currentGroup.types.map(p => (
                    <ControlButton key={p.type} onClick={() => onUpdateActiveLayerSettings({ patternType: p.type as PatternType })} active={patternType === p.type} title={p.label}>{p.icon}</ControlButton>
                ))}
            </div>
            
            {showImageControl && (
                <ImageControl
                    imageURL={settings.densityImageURL}
                    onChange={onDensityImageChange}
                    onClear={() => onUpdateActiveLayerSettings({ densityImageURL: null })}
                    isInverted={settings.densityImageInvert}
                    onInvertChange={(v) => onUpdateActiveLayerSettings({ densityImageInvert: v })}
                    label={patternType === 'topo' ? "Upload Image (Optional)" : "Upload Density Map"}
                />
            )}

            {(showSeedControl || showPointCount) && (
                <div className="grid grid-cols-1 gap-3">
                    {showSeedControl && <ControlSlider label="Seed" value={settings.seed} min={0} max={99999} onChange={(val) => onUpdateActiveLayerSettings({ seed: val })} />}
                    {showPointCount && <ControlSlider label="Point Count" value={settings.pointCount} min={10} max={2000} step={10} onChange={(val) => onUpdateActiveLayerSettings({ pointCount: val })} />}
                </div>
            )}

            {/* Dynamic Pattern Settings */}
            <div className="space-y-3 pt-2">
                {['voronoi', 'topo', 'reaction-diffusion', 'lsystem', 'colonization', 'crosshatch', 'glitch', 'rose-curve', 'flow-field', 'hatch', 'living-hinge', 'spirograph', 'guilloche', 'gears', 'jigsaw', 'maze', 'box-joint'].includes(patternType) && (
                    <ControlSlider label="Stroke Width" value={settings.strokeWidth} min={0.1} max={10} step={0.1} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ strokeWidth: val })} />
                )}

                {patternType === 'box-joint' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Width" value={settings.boxWidth} min={10} max={500} unit="mm" onChange={(val) => onUpdateActiveLayerSettings({ boxWidth: val })} />
                            <ControlSlider label="Height" value={settings.boxHeight} min={10} max={500} unit="mm" onChange={(val) => onUpdateActiveLayerSettings({ boxHeight: val })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Depth" value={settings.boxDepth} min={10} max={500} unit="mm" onChange={(val) => onUpdateActiveLayerSettings({ boxDepth: val })} />
                            <ControlSlider label="Thickness" value={settings.materialThickness} min={0.5} max={20} step={0.1} unit="mm" onChange={(val) => onUpdateActiveLayerSettings({ materialThickness: val })} />
                        </div>
                        <ControlSlider label="Joint Size" value={settings.jointSize} min={2} max={50} unit="mm" onChange={(val) => onUpdateActiveLayerSettings({ jointSize: val })} />
                    </>
                )}

                {patternType === 'maze' && (
                    <>
                        <ControlSlider label="Cell Size" value={settings.mazeCellSize} min={5} max={100} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ mazeCellSize: val })} />
                        <ControlSlider label="Padding" value={settings.mazePadding} min={0} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ mazePadding: val })} />
                        <ControlSelect label="Algorithm" value={settings.mazeAlgorithm} onChange={(val) => onUpdateActiveLayerSettings({ mazeAlgorithm: val as any })}>
                            <option value="recursive-backtracker">Recursive Backtracker</option>
                            <option value="prim">Prim's</option>
                        </ControlSelect>
                        <ControlSelect label="Style" value={settings.mazeType} onChange={(val) => onUpdateActiveLayerSettings({ mazeType: val as any })}>
                            <option value="square">Square</option>
                            <option value="polar">Polar</option>
                        </ControlSelect>
                    </>
                )}
                
                {patternType === 'gears' && (
                    <>
                        <ControlSlider label="Teeth" value={settings.gearTeeth} min={6} max={60} onChange={(val) => onUpdateActiveLayerSettings({ gearTeeth: val })} />
                        <ControlSlider label="Module (Scale)" value={settings.gearModule} min={1} max={50} onChange={(val) => onUpdateActiveLayerSettings({ gearModule: val })} />
                        <ControlSlider label="Pressure Angle" value={settings.gearPressureAngle} min={10} max={30} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ gearPressureAngle: val })} />
                        <ControlSlider label="Hole Radius" value={settings.gearHoleRadius} min={0} max={50} onChange={(val) => onUpdateActiveLayerSettings({ gearHoleRadius: val })} />
                    </>
                )}

                {patternType === 'jigsaw' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Columns" value={settings.jigsawColumns} min={2} max={20} onChange={(val) => onUpdateActiveLayerSettings({ jigsawColumns: val })} />
                            <ControlSlider label="Rows" value={settings.jigsawRows} min={2} max={20} onChange={(val) => onUpdateActiveLayerSettings({ jigsawRows: val })} />
                        </div>
                        <ControlSlider label="Tab Size" value={settings.jigsawTabSize} min={0.1} max={0.4} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ jigsawTabSize: val })} />
                        <ControlSlider label="Jitter" value={settings.jigsawJitter} min={0} max={0.2} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ jigsawJitter: val })} />
                        <ControlSlider label="Roundness" value={settings.jigsawRoundness} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ jigsawRoundness: val })} />
                    </>
                )}
                 
                {patternType === 'words' && (
                    <>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Text</label>
                            <textarea value={settings.wordText} onChange={(e) => onUpdateActiveLayerSettings({ wordText: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500" rows={3} placeholder="Enter words..." />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSelect label="Font" value={settings.wordFontFamily} onChange={(val) => onUpdateActiveLayerSettings({ wordFontFamily: val })}>
                                <optgroup label="Google Fonts">{googleFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                                <optgroup label="Standard Fonts">{standardFonts.map(font => <option key={font} value={font}>{font}</option>)}</optgroup>
                            </ControlSelect>
                            <ControlSelect label="Weight" value={settings.wordFontWeight} onChange={(val) => onUpdateActiveLayerSettings({ wordFontWeight: val })}>
                                <option value="normal">Normal</option>
                                <option value="bold">Bold</option>
                            </ControlSelect>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Min Size" value={settings.wordMinFontSize} min={6} max={300} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ wordMinFontSize: Math.min(val, settings.wordMaxFontSize - 1) })} />
                            <ControlSlider label="Max Size" value={settings.wordMaxFontSize} min={6} max={300} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ wordMaxFontSize: Math.max(val, settings.wordMinFontSize + 1)})} />
                        </div>
                        <ControlSlider label="Distribution" value={settings.wordFontSizeDistribution} min={0.2} max={5} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ wordFontSizeDistribution: val })} />
                        <ControlSlider label="Max Rotation" value={settings.wordRotation} min={0} max={180} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ wordRotation: val })} />
                    </>
                )}

                {patternType === 'glitch' && (
                    <>
                        <ControlSlider label="Rect Count" value={settings.glitchRectCount} min={0} max={500} step={5} onChange={(val) => onUpdateActiveLayerSettings({ glitchRectCount: val })} />
                        <ControlSlider label="Line Count" value={settings.glitchLineCount} min={0} max={500} step={5} onChange={(val) => onUpdateActiveLayerSettings({ glitchLineCount: val })} />
                        <ControlSlider label="Displacement" value={settings.glitchDisplacement} min={0} max={100} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ glitchDisplacement: val })} />
                    </>
                )}

                {patternType === 'crosshatch' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Angle 1" value={settings.hatchAngle1} min={-90} max={90} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ hatchAngle1: val })} />
                            <ControlSlider label="Spacing 1" value={settings.hatchSpacing1} min={2} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ hatchSpacing1: val })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Angle 2" value={settings.hatchAngle2} min={-90} max={90} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ hatchAngle2: val })} />
                            <ControlSlider label="Spacing 2" value={settings.hatchSpacing2} min={2} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ hatchSpacing2: val })} />
                        </div>
                        <ControlSlider label="Jitter" value={settings.hatchJitter} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ hatchJitter: val })} />
                        {settings.densityImageURL && <ControlSlider label="Density Strength" value={settings.hatchDensityStrength} min={0.5} max={10} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ hatchDensityStrength: val })} />}
                    </>
                )}

                {patternType === 'hatch' && (
                    <>
                        <ControlSlider label="Spacing" value={settings.hatchSpacing} min={1} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ hatchSpacing: val })} />
                        <ControlSlider label="Angle Randomness" value={settings.hatchAngleRandomness} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ hatchAngleRandomness: val })} />
                        <ControlSlider label="Curviness" value={settings.hatchCurviness} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ hatchCurviness: val })} />
                    </>
                )}

                {patternType === 'colonization' && (
                    <>
                        <ControlSlider label="Attractors" value={settings.colonizationAttractionPoints} min={50} max={1000} step={10} onChange={(val) => onUpdateActiveLayerSettings({ colonizationAttractionPoints: val })} />
                        <ControlSlider label="Influence Radius" value={settings.colonizationInfluenceRadius} min={10} max={200} step={5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ colonizationInfluenceRadius: val })} />
                        <ControlSlider label="Kill Radius" value={settings.colonizationKillRadius} min={1} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ colonizationKillRadius: val })} />
                        <ControlSlider label="Branch Length" value={settings.colonizationBranchLength} min={1} max={20} onChange={(val) => onUpdateActiveLayerSettings({ colonizationBranchLength: val })} />
                        <ControlSlider label="Iterations" value={settings.colonizationIterations} min={10} max={500} step={10} onChange={(val) => onUpdateActiveLayerSettings({ colonizationIterations: val })} />
                        <ControlSlider label="Roots" value={settings.colonizationRoots} min={1} max={10} onChange={(val) => onUpdateActiveLayerSettings({ colonizationRoots: val })} />
                        <ControlSlider label="Waviness" value={settings.colonizationWaviness} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ colonizationWaviness: val })} />
                        <ControlSlider label="Smoothing" value={settings.colonizationSmoothing} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ colonizationSmoothing: val })} />
                    </>
                )}
                
                {(patternType === 'voronoi' || patternType === 'circles' || patternType === 'stipple' || patternType === 'hatch') && (
                    <ControlSlider label="Optimization" value={settings.relaxationIterations} min={0} max={20} onChange={(val) => onUpdateActiveLayerSettings({ relaxationIterations: val})} />
                )}

                {patternType === 'lsystem' && (
                    <>
                        <ControlSelect label="Preset" value="" onChange={(val) => { const preset = lSystemPresets[Number(val)]; if (preset) onUpdateActiveLayerSettings({ lsAxiom: preset.axiom, lsRules: preset.rules, lsAngle: preset.angle, lsIterations: preset.iterations, lsStep: preset.step }); }}>
                            <option value="">Select a preset...</option>
                            {lSystemPresets.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
                        </ControlSelect>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Axiom</label>
                            <input type="text" value={settings.lsAxiom} onChange={(e) => onUpdateActiveLayerSettings({ lsAxiom: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Rules</label>
                            <textarea value={settings.lsRules} onChange={(e) => onUpdateActiveLayerSettings({ lsRules: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500" rows={3} />
                        </div>
                        <ControlSlider label="Iterations" value={settings.lsIterations} min={1} max={12} onChange={(val) => onUpdateActiveLayerSettings({ lsIterations: val })} />
                        <ControlSlider label="Angle" value={settings.lsAngle} min={0} max={180} step={0.5} unit="°" onChange={(val) => onUpdateActiveLayerSettings({ lsAngle: val })} />
                        <ControlSlider label="Step Length" value={settings.lsStep} min={1} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ lsStep: val })} />
                        <ControlSlider label="Smoothing" value={settings.lsSmoothing} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ lsSmoothing: val })} />
                    </>
                )}

                {patternType === 'topo' && (
                    <>
                        <ControlSlider label="Line Count" value={settings.topoLineCount} min={5} max={200} step={5} onChange={(val) => onUpdateActiveLayerSettings({ topoLineCount: val })} />
                        {!settings.densityImageURL && <ControlSlider label="Noise Scale" value={settings.topoNoiseScale} min={1} max={20} step={0.5} onChange={(val) => onUpdateActiveLayerSettings({ topoNoiseScale: val })} />}
                        <ControlSlider label="Blur" value={settings.topoBlur} min={0} max={10} step={0.5} onChange={(val) => onUpdateActiveLayerSettings({ topoBlur: val })} />
                        <ControlSlider label="Waviness" value={settings.topoNoise} min={0} max={10} step={0.5} onChange={(val) => onUpdateActiveLayerSettings({ topoNoise: val })} />
                    </>
                )}

                {patternType === 'reaction-diffusion' && (
                    <>
                        <ControlSlider label="Feed" value={settings.rdFeed} min={0.01} max={0.1} step={0.001} onChange={(val) => onUpdateActiveLayerSettings({ rdFeed: val })} />
                        <ControlSlider label="Kill" value={settings.rdKill} min={0.01} max={0.1} step={0.001} onChange={(val) => onUpdateActiveLayerSettings({ rdKill: val })} />
                        <ControlSlider label="Iterations" value={settings.rdIterations} min={500} max={15000} step={500} onChange={(val) => onUpdateActiveLayerSettings({ rdIterations: val })} />
                        <ControlSlider label="Line Count" value={settings.rdLineCount} min={1} max={20} onChange={(val) => onUpdateActiveLayerSettings({ rdLineCount: val })} />
                    </>
                )}

                {patternType === 'sine' && (
                    <>
                        <ControlSlider label="Wave Count" value={settings.sineWaveCount} min={1} max={50} onChange={(val) => onUpdateActiveLayerSettings({ sineWaveCount: val })} />
                        <ControlSlider label="Amplitude" value={settings.sineAmplitude} min={0} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ sineAmplitude: val })} />
                        <ControlSlider label="Frequency" value={settings.sineFrequency} min={0.001} max={0.2} step={0.001} onChange={(val) => onUpdateActiveLayerSettings({ sineFrequency: val })} />
                        <ControlSlider label="Thickness" value={settings.sineThickness} min={1} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ sineThickness: val })} />
                        <ControlSlider label="Variation" value={settings.sineThicknessVariation} min={0} max={25} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ sineThicknessVariation: val })} />
                        {!settings.densityImageURL && <ControlSlider label="Variation Freq" value={settings.sineThicknessFrequency} min={0.01} max={0.5} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ sineThicknessFrequency: val })} />}
                    </>
                )}

                {patternType === 'halftone' && (
                    <>
                        <ControlSlider label="Grid Spacing" value={settings.gridSpacing} min={5} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ gridSpacing: val })} />
                        {!settings.densityImageURL && <ControlSlider label="Influence Radius" value={settings.densityRadius} min={5} max={100} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ densityRadius: val })} />}
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Min Radius" value={settings.minCircleRadius} min={0} max={25} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ minCircleRadius: Math.min(val, settings.maxCircleRadius - 0.5) })} />
                            <ControlSlider label="Max Radius" value={settings.maxCircleRadius} min={0.5} max={25} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ maxCircleRadius: Math.max(val, settings.minCircleRadius + 0.5)})} />
                        </div>
                        <ControlSlider label="Distribution" value={settings.radiusDistribution} min={0.2} max={5} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ radiusDistribution: val })} />
                    </>
                )}

                {patternType === 'circles' && (
                    <>
                        <ControlSlider label="Packing" value={settings.circlePacking} min={0.5} max={2} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ circlePacking: val})} />
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Min Radius" value={settings.minCircleRadius} min={0} max={50} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ minCircleRadius: Math.min(val, settings.maxCircleRadius - 0.5) })} />
                            <ControlSlider label="Max Radius" value={settings.maxCircleRadius} min={0.5} max={50} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ maxCircleRadius: Math.max(val, settings.minCircleRadius + 0.5)})} />
                        </div>
                    </>
                )}

                {patternType === 'stipple' && (
                     <>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Min Radius" value={settings.minCircleRadius} min={0} max={25} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ minCircleRadius: Math.min(val, settings.maxCircleRadius - 0.5) })} />
                            <ControlSlider label="Max Radius" value={settings.maxCircleRadius} min={0.5} max={25} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ maxCircleRadius: Math.max(val, settings.minCircleRadius + 0.5)})} />
                        </div>
                        <ControlSlider label="Distribution" value={settings.radiusDistribution} min={0.2} max={5} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ radiusDistribution: val })} />
                    </>
                )}

                {patternType === 'rose-curve' && (
                    <>
                        <ControlSlider label="Petals (N)" value={settings.roseN} min={1} max={20} onChange={(val) => onUpdateActiveLayerSettings({ roseN: val })} />
                        <ControlSlider label="Factor (D)" value={settings.roseD} min={0.1} max={10.0} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ roseD: val })} />
                        <ControlSlider label="Resolution" value={settings.roseKMax} min={100} max={1000} step={10} onChange={(val) => onUpdateActiveLayerSettings({ roseKMax: val })} />
                    </>
                )}

                {patternType === 'flow-field' && (
                    <>
                        <ControlSlider label="Line Count" value={settings.flowLineCount} min={10} max={5000} step={10} onChange={(val) => onUpdateActiveLayerSettings({ flowLineCount: val })} />
                        <ControlSlider label="Step Length" value={settings.flowStepLength} min={1} max={10} onChange={(val) => onUpdateActiveLayerSettings({ flowStepLength: val })} />
                        <ControlSlider label="Line Length" value={settings.flowMaxSteps} min={10} max={500} step={10} onChange={(val) => onUpdateActiveLayerSettings({ flowMaxSteps: val })} />
                        <ControlSlider label="Grid Res" value={settings.flowGridResolution} min={5} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ flowGridResolution: val })} />
                        <ControlSlider label="Noise Scale" value={settings.flowNoiseScale} min={0.001} max={0.1} step={0.001} onChange={(val) => onUpdateActiveLayerSettings({ flowNoiseScale: val })} />
                        <ControlSlider label="Smoothing" value={settings.flowSmoothing} min={0} max={1} step={0.05} onChange={(val) => onUpdateActiveLayerSettings({ flowSmoothing: val })} />
                        <button onClick={() => onToolChange('flow-guide')} className={`w-full text-xs font-bold uppercase tracking-wide py-2 rounded transition-colors ${activeTool === 'flow-guide' ? 'bg-cyan-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                            {activeTool === 'flow-guide' ? 'Stop Drawing Guides' : 'Draw Flow Guides'}
                        </button>
                    </>
                )}

                {patternType === 'truchet' && (
                    <>
                        <ControlSlider label="Tile Size" value={settings.truchetTileSize} min={5} max={100} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ truchetTileSize: Math.max(val, (settings.truchetMinTileSize || 0) + 1) })} />
                        {settings.densityImageURL && <ControlSlider label="Min Tile Size" value={settings.truchetMinTileSize} min={1} max={Math.max(1, settings.truchetTileSize - 1)} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ truchetMinTileSize: val })} />}
                        <ControlSelect label="Variant" value={settings.truchetVariant} onChange={(val) => onUpdateActiveLayerSettings({ truchetVariant: val as any })}>
                            <option value="arcs">Arcs</option>
                            <option value="diagonal">Diagonals</option>
                            <option value="cross">Crosses</option>
                        </ControlSelect>
                    </>
                )}

                {patternType === 'living-hinge' && (
                    <>
                        <div className="flex bg-gray-800 p-1 rounded-md border border-gray-700">
                            <button onClick={() => onUpdateActiveLayerSettings({ livingHingeOrientation: 'vertical' })} className={`flex-1 py-1 text-xs rounded transition ${settings.livingHingeOrientation === 'vertical' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Vertical</button>
                            <button onClick={() => onUpdateActiveLayerSettings({ livingHingeOrientation: 'horizontal' })} className={`flex-1 py-1 text-xs rounded transition ${settings.livingHingeOrientation === 'horizontal' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>Horizontal</button>
                        </div>
                        <ControlSlider label="Cut Length" value={settings.livingHingeCutLength} min={1} max={100} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ livingHingeCutLength: val })} />
                        <ControlSlider label="Gap Size" value={settings.livingHingeGapSize} min={0.5} max={20} step={0.5} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ livingHingeGapSize: val })} />
                        <ControlSlider label="Line Spacing" value={settings.livingHingeLineSpacing} min={1} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ livingHingeLineSpacing: val })} />
                        <ControlSlider label="Margin" value={settings.livingHingeMargin} min={0} max={50} unit="px" onChange={(val) => onUpdateActiveLayerSettings({ livingHingeMargin: val })} />
                    </>
                )}

                {patternType === 'spirograph' && (
                    <>
                        <ControlSlider label="Inner Ratio" value={settings.spirographrRatio} min={0.01} max={1} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ spirographrRatio: val })} />
                        <ControlSlider label="Point Dist" value={settings.spirographdRatio} min={0} max={2} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ spirographdRatio: val })} />
                        <ControlSlider label="Laps" value={settings.spirographLaps} min={1} max={50} onChange={(val) => onUpdateActiveLayerSettings({ spirographLaps: val })} />
                    </>
                )}

                {patternType === 'guilloche' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Rad Amp" value={settings.guillocheAmplitude1} min={0} max={0.5} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ guillocheAmplitude1: val })} />
                            <ControlSlider label="Rad Freq" value={settings.guillocheFrequency1} min={1} max={50} step={0.5} onChange={(val) => onUpdateActiveLayerSettings({ guillocheFrequency1: val })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <ControlSlider label="Ang Amp" value={settings.guillocheAmplitude2} min={0} max={1} step={0.01} onChange={(val) => onUpdateActiveLayerSettings({ guillocheAmplitude2: val })} />
                            <ControlSlider label="Ang Freq" value={settings.guillocheFrequency2} min={0.1} max={20} step={0.1} onChange={(val) => onUpdateActiveLayerSettings({ guillocheFrequency2: val })} />
                        </div>
                        <ControlSlider label="Laps" value={settings.guillocheLaps} min={1} max={50} onChange={(val) => onUpdateActiveLayerSettings({ guillocheLaps: val })} />
                    </>
                )}
            </div>
        </fieldset>
    );
};
