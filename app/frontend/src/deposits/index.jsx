import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DepositLayout from './components/DepositLayout';
import DepositList from './components/DepositList';
import CreateDeposit from './components/CreateDeposit';
import './styles/index.css';

const DepositsApp = () => {
  // Get the deposit ID from the window global variable (could be null)
  const depositId = window.DEPOSIT_ID;

  return (
    <Router>
      <Routes>
        {/* Route with URL parameter */}
        <Route path="/deposits/:depositId" element={<DepositLayout />} />
        
        {/* Create new deposit */}
        <Route path="/deposits/create" element={<CreateDeposit />} />
        
        {/* List view */}
        <Route path="/deposits" element={<DepositList />} />
        
        {/* Default route */}
        <Route path="/" element={
          depositId ? <DepositLayout /> : <DepositList />
        } />
      </Routes>
    </Router>
  );
};

// Mount the app to a specific element for the deposits module
const depositsRoot = document.getElementById('deposits-root');
if (depositsRoot) {
  ReactDOM.render(
    <React.StrictMode>
      <DepositsApp />
    </React.StrictMode>,
    depositsRoot
  );
}

export default DepositsApp; 