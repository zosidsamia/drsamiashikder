import React, { useEffect, useState } from 'react';
import { usePatients } from '@/hooks';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const PatientListPage: React.FC = () => {
  const { patients, loading, error, fetchAll, delete: deletePatient } = usePatients();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredPatients = patients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this patient?')) {
      try {
        await deletePatient(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Patients</h1>
        <button 
          className="btn-primary"
          onClick={() => navigate('/patients/new')}
        >
          + Add Patient
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Loading patients...</div>}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Blood Group</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.fullName}</td>
                <td>{patient.email || '-'}</td>
                <td>{patient.phone || '-'}</td>
                <td>
                  <span className={`badge badge-${patient.patientType}`}>
                    {patient.patientType}
                  </span>
                </td>
                <td>{patient.bloodGroup || '-'}</td>
                <td>
                  <button
                    className="btn-sm btn-info"
                    onClick={() => navigate(`/patients/${patient.id}`)}
                  >
                    View
                  </button>
                  <button
                    className="btn-sm btn-warning"
                    onClick={() => navigate(`/patients/${patient.id}/edit`)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-sm btn-danger"
                    onClick={() => handleDelete(patient.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filteredPatients.length === 0 && (
          <div className="empty-state">
            <p>No patients found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientListPage;
