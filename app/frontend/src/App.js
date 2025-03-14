import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DepositLayout from './deposits/components/DepositLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/deposits/:depositId" element={<DepositLayout />} />
        {/* Add other routes as needed */}
      </Routes>
    </Router>
  );
}

export default App; 