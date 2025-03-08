import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DepositLayout from './deposits/components/DepositLayout';
import './deposits/styles/index.css';

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