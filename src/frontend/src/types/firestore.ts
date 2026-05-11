import { Timestamp } from 'firebase/firestore';

/**
 * Patient document type
 */
export interface Patient {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: Timestamp;
  gender: 'male' | 'female' | 'other';
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Medical Record document type
 */
export interface MedicalRecord {
  patientId: string;
  type: 'diagnosis' | 'prescription' | 'lab' | 'notes';
  title: string;
  content: string;
  createdBy: string; // doctorId
  createdAt: Timestamp;
  attachments: string[]; // file URLs
}

/**
 * Prescription document type
 */
export interface Prescription {
  patientId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  createdBy: string; // doctorId
  createdAt: Timestamp;
  status: 'active' | 'completed' | 'paused';
}

/**
 * Appointment document type
 */
export interface Appointment {
  patientId: string;
  doctorId: string;
  date: Timestamp;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  createdAt: Timestamp;
}

/**
 * User document type
 */
export interface User {
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'staff' | 'admin';
  designation?: string;
  avatar?: string; // URL
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Staff document type
 */
export interface Staff {
  name: string;
  email: string;
  role: 'doctor' | 'nurse' | 'intern' | 'admin';
  specialization?: string;
  phone: string;
  department: string;
  createdAt: Timestamp;
}

/**
 * Audit Log document type
 */
export interface AuditLog {
  userId: string;
  action: string;
  target: string;
  timestamp: Timestamp;
  details: Record<string, unknown>;
}

/**
 * Lab Result document type
 */
export interface LabResult {
  patientId: string;
  testName: string;
  result: string;
  unit?: string;
  referenceRange?: string;
  createdBy: string; // doctorId
  createdAt: Timestamp;
  attachments: string[];
}

/**
 * Vital Signs document type (sub-collection)
 */
export interface VitalSigns {
  patientId: string;
  bloodPressure: string; // "120/80"
  heartRate: number; // bpm
  temperature: number; // Celsius
  respiratoryRate: number; // breaths per minute
  spO2: number; // oxygen saturation percentage
  weight?: number; // kg
  height?: number; // cm
  recordedAt: Timestamp;
  recordedBy: string; // doctorId
}

export default {
  Patient,
  MedicalRecord,
  Prescription,
  Appointment,
  User,
  Staff,
  AuditLog,
  LabResult,
  VitalSigns,
};
