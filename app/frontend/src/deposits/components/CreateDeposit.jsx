import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const CreateDeposit = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    deposit_type: 'NEW'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/v1/deposits/', formData, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        }
      });
      
      // Navigate to the new deposit
      navigate(`/deposits/${response.data.id}`);
    } catch (err) {
      setError('Failed to create deposit: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  return (
    <div className="create-deposit">
      <h1>Create New Deposit</h1>
      
      {error && <div className="error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Deposit Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="deposit_type">Deposit Type</label>
          <select
            id="deposit_type"
            name="deposit_type"
            value={formData.deposit_type}
            onChange={handleChange}
          >
            <option value="NEW">New Deposit</option>
            <option value="CHANGE">Change Request</option>
          </select>
        </div>
        
        <div className="form-actions">
          <button type="button" onClick={() => navigate('/deposits')}>
            Cancel
          </button>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Deposit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateDeposit; 