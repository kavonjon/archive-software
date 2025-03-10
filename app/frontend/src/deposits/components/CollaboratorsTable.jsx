import React from 'react';
import './CollaboratorsTable.css';

const CollaboratorsTable = ({ collaborators, onEdit, onDelete }) => {
  // Sample data if none provided
  const sampleCollaborators = collaborators || [
    {
      uuid: 'collab1',
      name: 'John Smith',
      firstname: 'John',
      lastname: 'Smith',
      native_languages: ['English'],
      other_languages: ['Spanish', 'French'],
      tribal_affiliations: 'None',
      origin: 'United States'
    },
    {
      uuid: 'collab2',
      name: 'Maria Garcia',
      firstname: 'Maria',
      lastname: 'Garcia',
      native_languages: ['Spanish'],
      other_languages: ['English', 'Portuguese'],
      tribal_affiliations: 'None',
      origin: 'Mexico'
    },
    {
      uuid: 'collab3',
      name: 'David Wilson',
      firstname: 'David',
      lastname: 'Wilson',
      native_languages: ['English'],
      other_languages: ['German'],
      tribal_affiliations: 'Cherokee Nation',
      origin: 'United States'
    }
  ];

  const displayedCollaborators = collaborators || sampleCollaborators;

  return (
    <div className="collaborators-table-container">
      <div className="table-header">
        <h3>Collaborators</h3>
        <button className="add-button">
          <i className="fas fa-plus"></i> Add Collaborator
        </button>
      </div>
      
      {displayedCollaborators.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-users"></i>
          <p>No collaborators have been added to this deposit.</p>
          <button className="add-button">Add Collaborator</button>
        </div>
      ) : (
        <table className="collaborators-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Native Languages</th>
              <th>Other Languages</th>
              <th>Tribal Affiliations</th>
              <th>Origin</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedCollaborators.map(collaborator => (
              <tr key={collaborator.uuid}>
                <td>
                  <div className="collaborator-name">
                    <i className="fas fa-user"></i>
                    <span>{collaborator.name}</span>
                  </div>
                </td>
                <td>{collaborator.native_languages?.join(', ') || '-'}</td>
                <td>{collaborator.other_languages?.join(', ') || '-'}</td>
                <td>{collaborator.tribal_affiliations || '-'}</td>
                <td>{collaborator.origin || '-'}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="edit-button" 
                      onClick={() => onEdit && onEdit(collaborator.uuid)}
                      title="Edit collaborator"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      className="delete-button" 
                      onClick={() => onDelete && onDelete(collaborator.uuid)}
                      title="Remove collaborator"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CollaboratorsTable; 