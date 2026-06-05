export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'consultant' | 'registrar' | 'medical_officer' | 'intern' | 'nurse' | 'reception' | 'patient';
  createdAt: Date;
  updatedAt: Date;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'M' | 'F' | 'O';
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bloodGroup?: string;
  allergies?: string[];
  medicalHistory?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Vitals {
  id: string;
  patientId: string;
  bloodPressure: string; // "120/80"
  pulse: number;
  temperature: number;
  respiratoryRate: number;
  spO2: number;
  bloodGlucose?: number;
  gcs?: number;
  recordedAt: Date;
  recordedBy: string; // User ID
  status: 'drafted' | 'pending_review' | 'verified' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: Date;
  duration: number; // in minutes
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prescription {
  id: string;
  patientId: string;
  medicineId: string;
  dosage: string;
  frequency: string;
  duration: number; // in days
  instructions?: string;
  startDate: Date;
  endDate: Date;
  prescribedBy: string; // User ID
  createdAt: Date;
  updatedAt: Date;
}

export interface Investigation {
  id: string;
  patientId: string;
  testName: string;
  result?: string;
  normalRange?: string;
  unit?: string;
  status: 'pending' | 'completed' | 'reviewed';
  orderedBy: string; // User ID
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
}
