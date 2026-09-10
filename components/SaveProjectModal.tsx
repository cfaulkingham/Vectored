import React, { useState, useEffect } from 'react';
import { showFileError } from '../lib/file-io';

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
    onSave: (filename: string) => Promise<void>;
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
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFilename(initialFilename);
        }
    }, [isOpen, initialFilename]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!filename.trim() || isSaving) return;
        setIsSaving(true);
        try {
            await onSave(filename.trim());
        } catch (error) {
            await showFileError('Could not save the project.', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose}>
            <div role="dialog" aria-modal="true" aria-label="Save project" className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">Save Project</h2>
                    <button onClick={onClose} disabled={isSaving} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6 space-y-4">
                    <div>
                        <label htmlFor="filename-save-modal" className="block text-sm font-medium text-gray-300 mb-1">Filename</label>
                        <div className="relative">
                            <input 
                                id="filename-save-modal" 
                                type="text" 
                                value={filename}
                                disabled={isSaving}
                                onChange={(e) => setFilename(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-full bg-gray-700 rounded-lg p-2 pr-28 text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                placeholder="project-name"
                                autoFocus
                                onFocus={(e) => e.target.select()}
                            />
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">.vectored</span>
                        </div>
                    </div>
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors disabled:opacity-50">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || !filename.trim()} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button>
                </footer>
            </div>
        </div>
    );
};

export default SaveProjectModal;
