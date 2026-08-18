import React, { useRef, useEffect } from 'react';
import type { TextObject } from '../../types';

interface InlineTextEditorProps {
    object: TextObject;
    viewState: { zoom: number; pan: { x: number; y: number } };
    rulerBreadth: number;
    onUpdate: (text: string) => void;
    onFinish: () => void;
}

/**
 * Inline text editor overlay for editing text objects directly on the canvas.
 */
export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({ 
    object, 
    viewState, 
    rulerBreadth, 
    onUpdate, 
    onFinish 
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [object.id]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
        }
    };

    const { x, y, width, height, rotation, fontSize, fontFamily, fontWeight, fill, stroke, strokeWidth, text } = object;
    const { zoom, pan } = viewState;
    
    // Transform world coordinates to screen coordinates
    const screenX = x * zoom + pan.x + rulerBreadth;
    const screenY = y * zoom + pan.y + rulerBreadth;
    const screenWidth = width * zoom;
    const screenHeight = height * zoom;

    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${screenWidth + 2}px`,
        height: `${screenHeight}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: `${screenWidth / 2}px ${screenHeight / 2}px`,
        fontFamily,
        fontSize: `${fontSize * zoom}px`,
        fontWeight,
        color: typeof fill === 'string' ? fill : '#ffffff',
        padding: 0,
        margin: 0,
        border: '1px dashed #38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        lineHeight: 1.2,
        whiteSpace: 'pre',
        WebkitTextStroke: `${(strokeWidth || 0) * zoom}px ${stroke}`,
        paintOrder: 'stroke',
    };

    return (
        <textarea
            ref={textareaRef}
            style={style}
            value={text}
            onChange={handleInput}
            onBlur={onFinish}
            onKeyDown={handleKeyDown}
            spellCheck={false}
        />
    );
};
