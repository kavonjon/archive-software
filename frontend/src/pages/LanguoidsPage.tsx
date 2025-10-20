import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LanguoidsList, LanguoidDetail, LanguoidCreate, LanguoidBatchEditor } from '../components/languoids';

const LanguoidsPage: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LanguoidsList />} />
      <Route path="/create" element={<LanguoidCreate />} />
      <Route path="/batch" element={<LanguoidBatchEditor />} />
      <Route path="/:id" element={<LanguoidDetail />} />
    </Routes>
  );
};

export default LanguoidsPage;
