import React, { useEffect, useState } from 'react';
import { usePatients } from '@/hooks';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/form.css';

const PatientFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchById, create, update, loading, error } = usePatients();
  const [formData, setFormData] = useState({
    fullName: '',
    nameBn: '',
    dateOfBirth: '',
    gender: 'male',
    phone: '',
    email: '',
    address: '',
    bloodGroup: '',
    weight: '',
    height: '',
    allergies: '',
    chronicConditions: '',
    pastSurgicalHistory: '',
    patientType: 'outdoor',
    consultantEmail: '',
    consultantName: '',
  });

  useEffect(() => {
    if (id && id !== 'new') {
      loadPatient(id);
    }
  }, [id]);

  const loadPatient = async (patientId: string) => {
    try {
      const patient = await fetchById(patientId);
      setFormData({
        fullName: patient.fullName,
        nameBn: patient.nameBn || '',
        dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
        gender: patient.gender,
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || '',
        bloodGroup: patient.bloodGroup || '',
        weight: patient.weight?.toString() || '',
        height: patient.height?.toString() || '',
        allergies: patient.allergies.join(', '),
        chronicConditions: patient.chronicConditions.join(', '),
        pastSurgicalHistory: patient.pastSurgicalHistory || '',
        patientType: patient.patientType,
        consultantEmail: patient.consultantEmail || '',
        consultantName: patient.consultantName || '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        allergies: formData.allergies
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a),
        chronicConditions: formData.chronicConditions
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c),
      };

      if (id && id !== 'new') {
        await update(id, payload);
      } else {
        await create(payload);
      }
      navigate('/patients');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container">
      <h1>{id && id !== 'new' ? 'Edit Patient' : 'Add New Patient'}</h1>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="patient-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Name (Bengali)</label>
            <input
              type="text"
              name="nameBn"
              value={formData.nameBn}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Contact Information</h2>
          
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Medical Information</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Blood Group</label>
              <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}>
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div className="form-group">
              <label>Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Height (cm)</label>
              <input
                type="number"
                step="0.1"
                name="height"
                value={formData.height}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Allergies (comma-separated)</label>
            <textarea
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              placeholder="e.g. Penicillin, Peanuts"
            />
          </div>

          <div className="form-group">
            <label>Chronic Conditions (comma-separated)</label>
            <textarea
              name="chronicConditions"
              value={formData.chronicConditions}
              onChange={handleChange}
              placeholder="e.g. Diabetes, Hypertension"
            />
          </div>

          <div className="form-group">
            <label>Past Surgical History</label>
            <textarea
              name="pastSurgicalHistory"
              value={formData.pastSurgicalHistory}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Additional Information</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Patient Type *</label>
              <select name="patientType" value={formData.patientType} onChange={handleChange} required>
                <option value="outdoor">Outdoor</option>
                <option value="admitted">Admitted</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Consultant Name</label>
            <input
              type="text"
              name="consultantName"
              value={formData.consultantName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Consultant Email</label>
            <input
              type="email"
              name="consultantEmail"
              value={formData.consultantEmail}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Patient'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientFormPage;
