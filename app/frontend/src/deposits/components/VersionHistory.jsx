import React from 'react';
import { useDeposit } from '../contexts/DepositContext';
import './VersionHistory.css';

const VersionHistory = () => {
  const { versions, loading, error } = useDeposit();
  
  if (loading) {
    return (
      <div className="version-history">
        <h2 className="version-history-title">Version History</h2>
        <div className="loading-message">Loading versions...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="version-history">
        <h2 className="version-history-title">Version History</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }
  
  // Use versions from context or fallback to empty array
  const versionsList = versions || [];
  
  if (versionsList.length === 0) {
    return (
      <div className="version-history">
        <h2 className="version-history-title">Version History</h2>
        <div className="empty-message">No version history available</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStateLabel = (state) => {
    const stateMap = {
      'DRAFT': 'Draft',
      'REVIEW': 'Under Review',
      'NEEDS_REVISION': 'Needs Revision',
      'REJECTED': 'Rejected',
      'ACCEPTED': 'Accepted',
      'INCOMPLETE': 'Incomplete'
    };
    return stateMap[state] || state;
  };

  const getStateClass = (state) => {
    return `state-${state.toLowerCase()}`;
  };

  return (
    <div className="version-history">
      <h2 className="version-history-title">Version History</h2>
      
      <div className="versions-list">
        {versionsList.map((version, index) => (
          <div key={index} className="version-card">
            <div className="version-header">
              <div className="version-number">Version {version.version}</div>
              <div className={`version-state ${getStateClass(version.state)}`}>
                {getStateLabel(version.state)}
              </div>
            </div>
            
            <div className="version-details">
              <div className="version-timestamp">
                <span className="detail-label">Date:</span>
                <span className="detail-value">{formatDate(version.timestamp)}</span>
              </div>
              
              <div className="version-user">
                <span className="detail-label">User:</span>
                <span className="detail-value">{version.modified_by}</span>
              </div>
              
              {version.comment && (
                <div className="version-comment">
                  <span className="detail-label">Comment:</span>
                  <div className="comment-text">{version.comment}</div>
                </div>
              )}
            </div>
            
            <div className="version-actions">
              <button className="view-button">View</button>
              <button className="diff-button">Compare</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionHistory; 