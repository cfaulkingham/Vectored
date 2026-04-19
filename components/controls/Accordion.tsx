
import React, { useState, useEffect, ReactNode, ReactElement, useMemo } from 'react';
import { ChevronDownIcon } from './Icons';

/**
 * A collapsible accordion component.
 * Manages the expanded/collapsed state of its children (AccordionItems) independently.
 *
 * @param props.children - One or more AccordionItem components.
 */
export const Accordion: React.FC<{ children: ReactNode }> = ({ children }) => {

    // Filter out non-valid elements to prevent errors
    const childArray = React.Children.toArray(children).filter(React.isValidElement);

    const titleDeps = childArray.map(c => (c as ReactElement<{ title?: string }>).props?.title).join('|');

    // Memoize the initial state calculation based on child keys/titles
    const getInitialOpenState = useMemo(() => {
        return childArray.reduce((acc, child) => {
            const item = child as ReactElement<React.ComponentProps<typeof AccordionItem>>;
            // Use title as the key for open state
            if (item.props.title) {
                acc[item.props.title] = item.props.defaultOpen ?? false;
            }
            return acc;
        }, {} as Record<string, boolean>);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [titleDeps]);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(getInitialOpenState);

    // Sync open sections when children structure changes significantly (e.g. new items added)
    useEffect(() => {
        setOpenSections(prev => {
            const next = { ...getInitialOpenState };
            // Preserve existing user choices where possible
            Object.keys(prev).forEach(key => {
                if (key in next) {
                    next[key] = prev[key];
                }
            });
            return next;
        });
    }, [getInitialOpenState]);

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
    };

    return (
        <div className="w-full space-y-1">
            {childArray.map((child, index) => {
                const item = child as ReactElement<React.ComponentProps<typeof AccordionItem>>;
                const title = item.props.title;
                
                if (!title) return child; // Render non-accordion items directly (e.g. divs)

                const isOpen = openSections[title] ?? item.props.defaultOpen ?? false;
                
                return (
                <div key={title || index} className="border-b border-slate-800/50 last:border-0">
                    <button
                        id={`accordion-header-${index}`}
                        onClick={() => toggleSection(title)}
                        className={`w-full flex justify-between items-center py-3 px-2 text-sm font-medium text-left rounded-md focus:outline-none transition-colors duration-200 ${isOpen ? 'text-slate-200' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
                        aria-expanded={isOpen}
                        aria-controls={`accordion-content-${index}`}
                    >
                        <span className="tracking-wide">{title}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-500' : 'text-slate-500'}`} />
                    </button>
                    <div
                        id={`accordion-content-${index}`}
                        role="region"
                        aria-labelledby={`accordion-header-${index}`}
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
                        <div className="pt-1 pb-4 px-1 space-y-4">
                            {/* The AccordionItem's children are rendered here */}
                            {item.props.children}
                        </div>
                    </div>
                </div>
            )})}
        </div>
    );
};

/**
 * A single item within an Accordion.
 * Acts as a container for the content and defines the title and default state.
 *
 * @param props.title - The title displayed in the accordion header.
 * @param props.children - The content to display when expanded.
 * @param props.defaultOpen - Whether this section should be open by default.
 */
export const AccordionItem: React.FC<{ title: string; children: ReactNode; defaultOpen?: boolean }> = ({ title, children }) => {
    return <>{children}</>;
};
