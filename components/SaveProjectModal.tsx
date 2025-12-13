import React, { useState, useEffect } from 'react';

/**
 * Props for the SaveProjectModal component.
 * @property isOpen - Whether the modal is currently visible.
 * @property onClose - Callback function to close the modal.
 * @property onSave - Callback function to save the project with the specified filename.
 * @property initialFilename - The initial value for the filename input.
 */
interface SaveProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (filename: string) => void;
    initialFilename: string;
}

/**
 * Modal component for saving the current project state to a file.
 * Allows the user to input a filename and triggers the save action.
 *
 * @param props - The properties for the modal.
 * @returns The rendered modal component or null if not open.
 */
const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ isOpen, onClose, onSave, initialFilename }) => {
    const [filename, setFilename] = useState(initialFilename);

    useEffect(() => {
        if (isOpen) {
            setFilename(initialFilename);
        }
    }, [isOpen, initialFilename]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (filename.trim()) {
            onSave(filename.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Save Project</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 space-y-4">
                    <div>
                        <label htmlFor="filename-save-modal" className="block text-sm font-medium text-gray-300 mb-1">Filename</label>
                        <div className="relative">
                            <input 
                                id="filename-save-modal" 
                                type="text" 
                                value={filename} 
                                onChange={(e) => setFilename(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-gray-700 rounded-lg p-2 pr-12 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500" 
                                placeholder="project-name"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                            />
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">.json</span>
                        </div>
                    </div>
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">Save</button>
                </footer>
            </div>
        </div>
    );
};

export default SaveProjectModal;
