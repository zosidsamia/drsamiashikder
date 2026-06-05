import { Router } from 'express';
import { getSupabaseClient } from '../lib/supabase.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const AppointmentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  appointmentDate: z.string().datetime(),
  duration: z.number().int().min(15),
  reason: z.string(),
  notes: z.string().optional(),
});

// Get appointments for patient
router.get('/patient/:patientId', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('patientId', req.params.patientId)
      .order('appointmentDate', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'DATABASE_ERROR' });
  }
});

// Create appointment
router.post('/', requireRole('reception', 'medical_officer', 'consultant'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = AppointmentSchema.parse(req.body);
    const supabase = getSupabaseClient();

    const { data: newAppointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          ...data,
          status: 'scheduled',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newAppointment);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// Update appointment status
router.patch('/:id/status', requireRole('reception', 'medical_officer', 'consultant'), async (req: AuthenticatedRequest, res) => {
  try {
    const { status } = z.object({ status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']) }).parse(req.body);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Appointment not found', code: 'NOT_FOUND' });

    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

export default router;
