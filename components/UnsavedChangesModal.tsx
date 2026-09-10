import React, { useEffect, useRef } from 'react';

type Props = {
    action: string | null;
    filename: string;
    onDecision: (decision: 'save' | 'discard' | 'cancel') => void;
};

/** Browser counterpart of the desktop's native Save / Don't Save / Cancel dialog. */
export default function UnsavedChangesModal({ action, filename, onDecision }: Props) {
    const dialog = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!action) return;
        const previous = document.activeElement as HTMLElement | null;
        dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => previous?.focus();
    }, [action]);
    if (!action) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="unsaved-title"
                className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg text-gray-200"
                onKeyDown={event => {
                    if (event.key === 'Escape') { event.stopPropagation(); onDecision('cancel'); }
                    if (event.key === 'Tab') {
                        const buttons = dialog.current?.querySelectorAll('button');
                        if (!buttons?.length) return;
                        const first = buttons[0], last = buttons[buttons.length - 1];
                        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                    }
                }}>
                <h2 id="unsaved-title" className="text-xl font-bold p-5 border-b border-gray-700">Unsaved changes</h2>
                <p className="p-6 text-gray-300">Save changes to “{filename}” before {action}?</p>
                <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
                    <button onClick={() => onDecision('cancel')} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500">Cancel</button>
                    <button onClick={() => onDecision('discard')} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">Don't Save</button>
                    <button onClick={() => onDecision('save')} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 font-semibold">Save</button>
                </div>
            </div>
        </div>
    );
}
