import React from 'react';

/**
 * A control component for uploading, displaying, and manipulating a density reference image.
 * Used in pattern generation to influence distribution based on image brightness.
 * 
 * @param props.imageURL - The current URL of the uploaded image.
 * @param props.onChange - Callback for when a new file is selected.
 * @param props.onClear - Callback to remove the current image.
 * @param props.isInverted - Whether the image's influence should be inverted.
 * @param props.onInvertChange - Callback for toggling the invert state.
 * @param props.label - The button label for the uploader.
 */
const ImageControl: React.FC<{
    imageURL: string | null;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onClear: () => void;
    isInverted: boolean;
    onInvertChange: (value: boolean) => void;
    label: string;
}> = ({ imageURL, onChange, onClear, isInverted, onInvertChange, label }) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-3">
            <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onChange} />
            {!imageURL ? (
                <button onClick={() => inputRef.current?.click()} className="w-full bg-gray-700 text-gray-200 font-semibold py-2 rounded-lg transition-colors duration-200 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    {label}
                </button>
            ) : (
                <div className="space-y-2">
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative group">
                        <img src={imageURL} alt="Source for pattern" className="w-full h-full object-contain" />
                        <button onClick={onClear} className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0" disabled={!onClear}>&times;</button>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" id="invert-density-image" checked={isInverted} onChange={(e) => onInvertChange(e.target.checked)} className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 disabled:cursor-not-allowed" />
                        <label htmlFor="invert-density-image" className="ml-2 font-medium text-gray-300 select-none">Invert Image</label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageControl;
