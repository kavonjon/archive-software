import React from 'react';

const DebugStyles = () => {
  return (
    <div style={{ padding: '20px', border: '2px solid red', margin: '20px' }}>
      <h2 style={{ color: 'red' }}>Style Debug</h2>
      <p>If you can see this with red border and heading, inline styles are working.</p>
      
      <div className="button" style={{ marginTop: '10px', marginBottom: '10px' }}>
        If this has white text on blue background, CSS classes are working.
      </div>
      
      <div>
        <h3 style={{ color: 'blue' }}>CSS Loading Test</h3>
        <div className="three-pane-layout" style={{ height: '50px', marginTop: '10px', border: '1px dashed black' }}>
          <div className="left-pane" style={{ backgroundColor: 'rgba(0,0,255,0.1)' }}>Left Pane</div>
          <div className="center-pane" style={{ backgroundColor: 'rgba(0,255,0,0.1)' }}>Center Pane</div>
          <div className="right-pane" style={{ backgroundColor: 'rgba(255,0,0,0.1)' }}>Right Pane</div>
        </div>
        <p style={{ marginTop: '10px' }}>
          If the above shows as a horizontal layout with three colored sections, component CSS is working.
        </p>
      </div>
    </div>
  );
};

export default DebugStyles; 