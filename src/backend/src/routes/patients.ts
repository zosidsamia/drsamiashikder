import { Router } from 'express';
import { getSupabaseClient } from '../lib/supabase.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const PatientSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['M', 'F', 'O']),
  phone: z.string(),
  email: z.string().email().optional(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  bloodGroup: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  medicalHistory: z.array(z.string()).optional(),
});

// Get all patients
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('patients').select('*').order('createdAt', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'DATABASE_ERROR' });
  }
});

// Get patient by ID
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('patients').select('*').eq('id', req.params.id).single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Patient not found', code: 'NOT_FOUND' });

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'DATABASE_ERROR' });
  }
});

// Create patient
router.post('/', requireRole('admin', 'reception', 'medical_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = PatientSchema.parse(req.body);
    const supabase = getSupabaseClient();

    const { data: newPatient, error } = await supabase.from('patients').insert([data]).select().single();

    if (error) throw error;
    res.status(201).json(newPatient);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// Update patient
router.put('/:id', requireRole('admin', 'reception', 'medical_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = PatientSchema.partial().parse(req.body);
    const supabase = getSupabaseClient();

    const { data: updatedPatient, error } = await supabase
      .from('patients')
      .update(data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!updatedPatient) return res.status(404).json({ error: 'Patient not found', code: 'NOT_FOUND' });

    res.json(updatedPatient);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

export default router;
