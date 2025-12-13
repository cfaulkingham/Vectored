import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * The entry point of the application.
 * It finds the root element in the DOM and renders the React application into it.
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to draw to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
