import React from 'react';
import ReactDOM from 'react-dom/client';
import LanguoidSheet from './components/LanguoidSheet';
import { BrowserRouter as Router } from 'react-router-dom';

// Expose React and ReactDOM globally
window.React = React;
window.ReactDOM = ReactDOM;

// Expose your components
window.LanguoidSheet = LanguoidSheet;

// Expose a function to render the LanguoidSheet
window.renderLanguoidSheet = function(containerId, props) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const root = ReactDOM.createRoot(container);
  root.render(
    <Router>
      <LanguoidSheet {...props} />
    </Router>
  );

  return {
    unmount: () => root.unmount()
  };
};