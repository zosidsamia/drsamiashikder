import React, { useEffect, useState } from 'react';
import { useVisits, usePatients } from '@/hooks';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/form.css';

const VisitFormPage: React.FC = () => {
  const { patientId, visitId } = useParams<{ patientId: string; visitId?: string }>();
  const navigate = useNavigate();
  const { fetchById } = usePatients();
  const { create, update, loading, error } = useVisits();
  const [patient, setPatient] = useState<any>(null);
  const [formData, setFormData] = useState({
    visitDate: new Date().toISOString().split('T')[0],
    chiefComplaint: '',
    historyOfPresentIllness: '',
    vitalSigns: {
      bloodPressure: '',
      pulse: '',
      temperature: '',
      respiratoryRate: '',
      oxygenSaturation: '',
    },
    physicalExamination: '',
    diagnosis: '',
    notes: '',
    visitType: 'outdoor',
  });

  useEffect(() => {
    if (patientId) {
      loadPatient(patientId);
    }
  }, [patientId]);

  const loadPatient = async (id: string) => {
    try {
      const p = await fetchById(id);
      setPatient(p);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name in formData.vitalSigns) {
      setFormData((prev) => ({
        ...prev,
        vitalSigns: {
          ...prev.vitalSigns,
          [name]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        patientId: patientId!,
      };

      if (visitId) {
        await update(visitId, payload);
      } else {
        await create(payload);
      }
      navigate(`/patients/${patientId}/visits`);
    } catch (err) {
      console.error(err);
    }
  };

  if (!patient && patientId) {
    return <div>Loading patient...</div>;
  }

  return (
    <div className="page-container">
      <h1>{visitId ? 'Edit Visit' : 'New Visit'}</h1>
      {patient && <p>Patient: {patient.fullName}</p>}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="visit-form">
        <div className="form-section">
          <h2>Visit Details</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Visit Date *</label>
              <input
                type="date"
                name="visitDate"
                value={formData.visitDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Visit Type *</label>
              <select name="visitType" value={formData.visitType} onChange={handleChange} required>
                <option value="outdoor">Outdoor</option>
                <option value="admitted">Admitted</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Chief Complaint *</label>
            <textarea
              name="chiefComplaint"
              value={formData.chiefComplaint}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>History of Present Illness</label>
            <textarea
              name="historyOfPresentIllness"
              value={formData.historyOfPresentIllness}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Vital Signs</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Blood Pressure</label>
              <input
                type="text"
                name="bloodPressure"
                value={formData.vitalSigns.bloodPressure}
                onChange={handleChange}
                placeholder="e.g. 120/80"
              />
            </div>
            <div className="form-group">
              <label>Pulse (bpm)</label>
              <input
                type="number"
                name="pulse"
                value={formData.vitalSigns.pulse}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                name="temperature"
                value={formData.vitalSigns.temperature}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Respiratory Rate</label>
              <input
                type="number"
                name="respiratoryRate"
                value={formData.vitalSigns.respiratoryRate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Oxygen Saturation (%)</label>
              <input
                type="number"
                name="oxygenSaturation"
                value={formData.vitalSigns.oxygenSaturation}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Examination & Assessment</h2>

          <div className="form-group">
            <label>Physical Examination</label>
            <textarea
              name="physicalExamination"
              value={formData.physicalExamination}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Diagnosis</label>
            <textarea
              name="diagnosis"
              value={formData.diagnosis}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Visit'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/patients/${patientId}/visits`)}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default VisitFormPage;
