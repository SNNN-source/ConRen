// Import StrictMode from React to highlight potential problems in the app during development.
import {StrictMode} from 'react';
// Import the tool needed to render our React app into the browser's HTML.
import {createRoot} from 'react-dom/client';
// Import the main App component, which holds our entire frontend application.
import App from './App.tsx';
// Import the main CSS file which contains our styling rules (like Tailwind).
import './index.css';

// Find the HTML element with the ID 'root' (this is in index.html) and render our React app inside it.
createRoot(document.getElementById('root')!).render(
  // Wrap the App in StrictMode to catch bad coding practices during development.
  <StrictMode>
    {/* This is the main application component that we imported from App.tsx */}
    <App />
  </StrictMode>,
);
