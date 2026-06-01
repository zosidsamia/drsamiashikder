import React, { useEffect } from 'react';
import { usePrescriptions } from '@/hooks';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

const PrescriptionListPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { prescriptions, loading, error, fetchByPatientId, delete: deletePrescription } = usePrescriptions();

  useEffect(() => {
    if (patientId) {
      fetchByPatientId(patientId);
    }
  }, [patientId]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this prescription?')) {
      try {
        await deletePrescription(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Prescriptions</h1>
        <button
          className="btn-primary"
          onClick={() => navigate(`/patients/${patientId}/prescriptions/new`)}
        >
          + Add Prescription
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Loading prescriptions...</div>}

      <div className="prescriptions-list">
        {prescriptions.map((prescription) => (
          <div key={prescription.id} className="prescription-card">
            <div className="prescription-header">
              <div>
                <h3>Prescription #{prescription.id.slice(0, 8)}</h3>
                <p className="date">
                  {new Date(prescription.prescriptionDate).toLocaleDateString()}
                </p>
              </div>
              <div className="actions">
                <button
                  className="btn-sm btn-warning"
                  onClick={() =>
                    navigate(
                      `/patients/${patientId}/prescriptions/${prescription.id}/edit`
                    )
                  }
                >
                  Edit
                </button>
                <button
                  className="btn-sm btn-danger"
                  onClick={() => handleDelete(prescription.id)}
                >
                  Delete
                </button>
              </div>
            </div>

            {prescription.diagnosis && (
              <div className="prescription-section">
                <strong>Diagnosis:</strong>
                <p>{prescription.diagnosis}</p>
              </div>
            )}

            <div className="prescription-section">
              <strong>Medications:</strong>
              <table className="medications-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Dose</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescription.medications.map((med, idx) => (
                    <tr key={idx}>
                      <td>{med.name}</td>
                      <td>{med.dose}</td>
                      <td>{med.frequency}</td>
                      <td>{med.duration}</td>
                      <td>{med.instructions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {prescription.notes && (
              <div className="prescription-section">
                <strong>Notes:</strong>
                <p>{prescription.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && prescriptions.length === 0 && (
        <div className="empty-state">
          <p>No prescriptions found</p>
        </div>
      )}
    </div>
  );
};

export default PrescriptionListPage;
