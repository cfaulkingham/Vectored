import React, { useState } from 'react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="px-2 py-1 text-xs font-mono bg-slate-700 border border-slate-600 rounded text-slate-200 shadow-sm">{children}</kbd>
);

const ShortcutRow: React.FC<{ label: string; keys: React.ReactNode[] }> = ({ label, keys }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
        <span className="text-sm text-slate-400">{label}</span>
        <div className="flex gap-1">
            {keys.map((k, i) => <React.Fragment key={i}>{k}</React.Fragment>)}
        </div>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider mb-3 mt-4 first:mt-0">{children}</h3>
);

const LibraryRow: React.FC<{ name: string; description: string; version?: string }> = ({ name, description, version }) => (
    <div className="flex justify-between items-start py-3 border-b border-slate-700/50 last:border-0">
        <div>
            <div className="font-medium text-slate-200">{name}</div>
            <div className="text-xs text-slate-500 mt-0.5">{description}</div>
        </div>
        {version && <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{version}</span>}
    </div>
);

/**
 * A modal dialog providing documentation, keyboard shortcuts, and guides for the application.
 * Organized into tabs: Shortcuts, Pattern Generators, Basics, and About.
 */
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'shortcuts' | 'generators' | 'basics' | 'about'>('shortcuts');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-slate-200">Help & Documentation</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                </header>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 bg-slate-900/30 px-6 overflow-x-auto custom-scrollbar">
                    <button 
                        onClick={() => setActiveTab('shortcuts')}
                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'shortcuts' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        Keyboard Shortcuts
                    </button>
                    <button 
                        onClick={() => setActiveTab('generators')}
                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'generators' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        Pattern Generators
                    </button>
                    <button 
                        onClick={() => setActiveTab('basics')}
                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'basics' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        Basics
                    </button>
                    <button 
                        onClick={() => setActiveTab('about')}
                        className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'about' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                        About
                    </button>
                </div>
                
                {/* Content */}
                <main className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-800">
                    {activeTab === 'shortcuts' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <SectionTitle>Tools</SectionTitle>
                                <ShortcutRow label="Select Tool" keys={[<Kbd>V</Kbd>]} />
                                <ShortcutRow label="Node Tool" keys={[<Kbd>A</Kbd>]} />
                                <ShortcutRow label="Shape Tool" keys={[<Kbd>R</Kbd>]} />
                                <ShortcutRow label="Line Tool" keys={[<Kbd>L</Kbd>]} />
                                <ShortcutRow label="Pen Tool" keys={[<Kbd>P</Kbd>]} />
                                <ShortcutRow label="Text Tool" keys={[<Kbd>T</Kbd>]} />
                                <ShortcutRow label="Freehand Path" keys={[<Kbd>B</Kbd>]} />
                                <ShortcutRow label="Pattern Brush" keys={[<Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>B</Kbd>]} />
                                <ShortcutRow label="Image Tool" keys={[<Kbd>I</Kbd>]} />
                                <ShortcutRow label="Measure Tool" keys={[<Kbd>M</Kbd>]} />
                            </div>
                            <div>
                                <SectionTitle>Actions</SectionTitle>
                                <ShortcutRow label="Command Palette" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>K</Kbd>]} />
                                <ShortcutRow label="Undo" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>Z</Kbd>]} />
                                <ShortcutRow label="Redo" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>Y</Kbd>]} />
                                <ShortcutRow label="Group" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>G</Kbd>]} />
                                <ShortcutRow label="Ungroup" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>G</Kbd>]} />
                                <ShortcutRow label="Copy" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>C</Kbd>]} />
                                <ShortcutRow label="Paste" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>V</Kbd>]} />
                                <ShortcutRow label="Select All" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>A</Kbd>]} />
                                <ShortcutRow label="Delete Selection" keys={[<Kbd>Del</Kbd>]} />
                                <ShortcutRow label="Cancel / Deselect" keys={[<Kbd>Esc</Kbd>]} />
                            </div>
                            <div>
                                <SectionTitle>Navigation & View</SectionTitle>
                                <ShortcutRow label="Pan Canvas" keys={[<Kbd>Space</Kbd>, <span className="text-slate-500 self-center">+</span>, <span>Drag</span>]} />
                                <ShortcutRow label="Zoom" keys={[<Kbd>Ctrl</Kbd>, <span className="text-slate-500 self-center">+</span>, <span>Scroll</span>]} />
                                <ShortcutRow label="Pan (Alternative)" keys={[<Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <span>Scroll</span>]} />
                            </div>
                            <div>
                                <SectionTitle>Manipulation</SectionTitle>
                                <ShortcutRow label="Nudge Position" keys={[<Kbd>Arrows</Kbd>]} />
                                <ShortcutRow label="Large Nudge" keys={[<Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <Kbd>Arrows</Kbd>]} />
                                <ShortcutRow label="Constrain Ratio" keys={[<Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <span>Resize</span>]} />
                                <ShortcutRow label="Remove Polygon Point" keys={[<Kbd>Shift</Kbd>, <span className="text-slate-500 self-center">+</span>, <span>Click Point</span>]} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'generators' && (
                        <div className="space-y-6 text-slate-300">
                            <div>
                                <SectionTitle>How Patterns Work</SectionTitle>
                                <p className="text-sm leading-relaxed mb-4">
                                    Patterns in Vectored are generative geometry that fill a selected object. Unlike standard hatch fills, these generate real vector paths that can be manipulated, exported to DXF/SVG, and used for laser cutting or plotting.
                                </p>
                                <ol className="list-decimal list-inside text-sm space-y-2 ml-2">
                                    <li>Select a single object (Rectangle, Circle, Polygon, etc).</li>
                                    <li>In the Right Sidebar, go to the <strong>Properties</strong> tab.</li>
                                    <li>Under <strong>Fill</strong>, select <strong>Pattern</strong>.</li>
                                    <li>Choose a pattern type (e.g., Voronoi, Maze, Sine).</li>
                                    <li>Adjust the parameters and click <strong>Generate Pattern Geometry</strong> to bake the result into the layer.</li>
                                </ol>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                    <h4 className="font-bold text-cyan-400 mb-2">Fabrication Patterns</h4>
                                    <ul className="text-xs space-y-2">
                                        <li><strong>Box Joint:</strong> Creates finger-jointed panels for 3D boxes. Use the bounds of your selection to define the layout area.</li>
                                        <li><strong>Living Hinge:</strong> Generates cut lines to make rigid materials (like wood) flexible.</li>
                                        <li><strong>Gears:</strong> Generates accurate involute gear profiles.</li>
                                    </ul>
                                </div>
                                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                    <h4 className="font-bold text-cyan-400 mb-2">Generative Art</h4>
                                    <ul className="text-xs space-y-2">
                                        <li><strong>Voronoi / Delaunay:</strong> Cellular patterns based on point distribution.</li>
                                        <li><strong>Flow Field:</strong> Organic lines that follow a noise field or guide paths.</li>
                                        <li><strong>Reaction-Diffusion:</strong> Biological textures resembling coral or animal skins.</li>
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <SectionTitle>Density Maps</SectionTitle>
                                <p className="text-sm leading-relaxed">
                                    Many patterns (Stipple, Halftone, Voronoi, Sine, Truchet) support <strong>Density Maps</strong>. You can upload an image in the pattern controls. The brightness of the image will influence the density, size, or thickness of the generated pattern elements, allowing you to create vector portraits or textured shading.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'basics' && (
                        <div className="space-y-6 text-slate-300">
                            <div>
                                <SectionTitle>Interface Overview</SectionTitle>
                                <p className="text-sm mb-2">
                                    <strong>Command Palette:</strong> Press <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> (or <Kbd>Cmd</Kbd> + <Kbd>K</Kbd> on Mac) to open the Command Palette to quickly search for tools, actions, and settings.
                                </p>
                                <p className="text-sm mb-2">
                                    <strong>Left Toolbar:</strong> Contains tools for creating objects (Shapes, Lines, Text, Freehand).
                                </p>
                                <p className="text-sm mb-2">
                                    <strong>Right Sidebar:</strong> The main control center.
                                </p>
                                <ul className="list-disc list-inside text-sm ml-4 space-y-1 text-slate-400">
                                    <li><strong>Layers:</strong> Manage visibility, locking, and ordering of layers.</li>
                                    <li><strong>Properties:</strong> Edit the selected object's dimensions, fill, stroke, and typography.</li>
                                    <li><strong>Alignment:</strong> Tools to align, distribute, and group objects.</li>
                                </ul>
                                <p className="text-sm mt-3 mb-2">
                                    <strong>Bottom Status Bar:</strong> Displays useful contextual information, current selection size, layer name, cursor coordinates, and zoom level.
                                </p>
                            </div>

                            <div>
                                <SectionTitle>Node Editing</SectionTitle>
                                <p className="text-sm leading-relaxed mb-2">
                                    The <strong>Node Tool</strong> (shortcut: <Kbd>A</Kbd>) allows you to manipulate the underlying geometry of polygons and paths.
                                </p>
                                <ul className="list-disc list-inside text-sm ml-2 space-y-1 text-slate-400">
                                    <li><strong>Select Nodes:</strong> Click on an anchor point to select it.</li>
                                    <li><strong>Add Point:</strong> Click anywhere on a line segment to add a new point.</li>
                                    <li><strong>Remove Point:</strong> Hold <Kbd>Shift</Kbd> and click on a point to delete it.</li>
                                    <li><strong>Adjust Curves:</strong> Drag the round handles extending from a point to change curvature.</li>
                                    <li><strong>Create Curves:</strong> Hold <Kbd>Alt</Kbd> and drag an anchor point to pull out new bezier handles.</li>
                                </ul>
                            </div>

                            <div>
                                <SectionTitle>Path Groups</SectionTitle>
                                <p className="text-sm leading-relaxed mb-2">
                                    Path Groups allow you to distribute shapes along another path (like beads on a string).
                                </p>
                                <ol className="list-decimal list-inside text-sm ml-2 space-y-1">
                                    <li>Select the object you want to duplicate.</li>
                                    <li>Hold <Kbd>Shift</Kbd> and select the path curve you want to attach to.</li>
                                    <li>In the <strong>Arrange & Align</strong> panel (Right Sidebar), click <strong>Attach to Path</strong>.</li>
                                    <li>Use the Path Group controls to adjust count, spacing, and rotation.</li>
                                    <li>Click <strong>Apply & Ungroup</strong> to bake the result into individual editable objects.</li>
                                </ol>
                            </div>

                            <div>
                                <SectionTitle>Exporting</SectionTitle>
                                <p className="text-sm leading-relaxed">
                                    Vectored supports exporting to <strong>SVG</strong> (web/vector apps), <strong>DXF</strong> (CAD/Laser Cutters), <strong>PDF</strong> (Printing), and <strong>PNG</strong> (Raster images). Use the <strong>Export</strong> button in the top right corner.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="space-y-6 text-slate-300">
                            <div className="text-center mb-8 mt-4">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Vectored</h2>
                                <p className="text-slate-400 text-sm max-w-md mx-auto">
                                    A specialized vector design tool for makers, optimized for creating complex patterns, gears, and generative art for laser cutting and CNC.
                                </p>
                                <div className="mt-4 inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs text-slate-500 font-mono">
                                    v1.0.0
                                </div>
                            </div>

                            <div>
                                <SectionTitle>Core Technologies</SectionTitle>
                                <div className="space-y-1">
                                    <LibraryRow name="React" description="UI Rendering & State Management" version="v19.2.0" />
                                    <LibraryRow name="Paper.js" description="Vector Math, Boolean Operations & Nesting" version="v0.12.18" />
                                    <LibraryRow name="D3.js" description="Voronoi, Delaunay, Contours & Data Viz" version="v7" />
                                    <LibraryRow name="Immer" description="Immutable State Updates" version="v10.2.0" />
                                    <LibraryRow name="jsPDF" description="PDF Generation" version="v2.5.1" />
                                </div>
                            </div>

                            <div>
                                <SectionTitle>Credits</SectionTitle>
                                <div className="space-y-1">
                                    <LibraryRow name="Tailwind CSS" description="Styling Framework" />
                                    <LibraryRow name="Google Fonts" description="Typography" />
                                    <LibraryRow name="Lucide & Heroicons" description="Iconography Concepts" />
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default HelpModal;