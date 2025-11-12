import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { LanguoidsList, LanguoidDetail, LanguoidCreate, LanguoidBatchEditor } from '../components/languoids';

const LanguoidsPage: React.FC = () => {
  usePageTitle('Languoids');
  
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
