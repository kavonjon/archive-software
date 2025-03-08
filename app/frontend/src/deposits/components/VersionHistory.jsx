import React from 'react';
import './VersionHistory.css';

const VersionHistory = ({ versions }) => {
  // Sample versions data if not provided
  const sampleVersions = versions || [
    {
      version: 3,
      state: 'ACCEPTED',
      timestamp: '2024-03-20T15:30:00Z',
      modified_by: 'archivist@example.com',
      comment: 'Approved deposit after review of metadata and files.'
    },
    {
      version: 2,
      state: 'REVIEW',
      timestamp: '2024-03-19T10:45:00Z',
      modified_by: 'depositor@example.com',
      comment: 'Updated metadata fields as requested.'
    },
    {
      version: 1,
      state: 'NEEDS_REVISION',
      timestamp: '2024-03-18T14:20:00Z',
      modified_by: 'reviewer@example.com',
      comment: 'Please update the language codes and add more specific descriptions.'
    },
    {
      version: 0,
      state: 'DRAFT',
      timestamp: '2024-03-17T09:15:00Z',
      modified_by: 'depositor@example.com',
      comment: 'Initial deposit creation.'
    }
  ];

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
        {sampleVersions.map((version) => (
          <div key={version.version} className="version-card">
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