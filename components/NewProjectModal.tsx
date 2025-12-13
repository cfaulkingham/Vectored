import React from 'react';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaveAndNew: () => void;
    onNewWithoutSaving: () => void;
}

/**
 * Modal prompted when the user attempts to create a new project while there are unsaved changes.
 * Offers options to save current work before clearing, discard changes, or cancel the action.
 */
const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onSaveAndNew, onNewWithoutSaving }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md text-gray-200" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold">New Project</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-2xl">&times;</button>
                </header>
                
                <main className="p-6">
                    <p className="text-gray-300">You have unsaved changes. Do you want to save your current project before creating a new one?</p>
                </main>

                <footer className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors">Cancel</button>
                    <button onClick={onNewWithoutSaving} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors">New without Saving</button>
                    <button onClick={onSaveAndNew} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors">Save and New</button>
                </footer>
            </div>
        </div>
    );
};

export default NewProjectModal;