
import React from 'react';
import { EditorProvider } from './context/EditorContext';
import { EditorLayout } from './components/EditorLayout';

/**
 * The main application component.
 * It initializes the application by wrapping the layout in the EditorProvider,
 * which provides global state management (history, layers, selection, tools).
 * 
 * @returns {JSX.Element} The root application component tree.
 */
function App() {
  return (
    <EditorProvider>
        <EditorLayout />
    </EditorProvider>
  );
}

export default App;
