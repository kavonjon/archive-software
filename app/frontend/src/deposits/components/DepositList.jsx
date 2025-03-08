import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const DepositList = () => {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        const response = await axios.get('/api/v1/deposits/');
        setDeposits(response.data.results || response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching deposits:', err);
        setError('Failed to load deposits: ' + (err.response?.data?.error || err.message));
        setLoading(false);
      }
    };

    fetchDeposits();
  }, []);

  if (loading) {
    return <div className="loading">Loading deposits...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="deposit-list">
      <h1>Your Deposits</h1>
      
      <div className="actions">
        <Link to="/deposits/create" className="button">Create New Deposit</Link>
      </div>
      
      {deposits.length === 0 ? (
        <p>No deposits found. Create your first deposit to get started.</p>
      ) : (
        <table className="deposits-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>State</th>
              <th>Created</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map(deposit => (
              <tr key={deposit.id}>
                <td>{deposit.title}</td>
                <td>
                  <span className={`status status-${deposit.state.toLowerCase()}`}>
                    {deposit.state}
                  </span>
                </td>
                <td>{new Date(deposit.created_at).toLocaleDateString()}</td>
                <td>{new Date(deposit.modified_at).toLocaleDateString()}</td>
                <td>
                  <Link to={`/deposits/${deposit.id}`} className="button button-small">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DepositList; 