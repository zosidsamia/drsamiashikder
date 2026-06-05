import { Router } from 'express';
import { getSupabaseClient } from '../lib/supabase.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

const VitalsSchema = z.object({
  patientId: z.string(),
  bloodPressure: z.string(), // "120/80"
  pulse: z.number().int().min(0).max(300),
  temperature: z.number().min(30).max(45),
  respiratoryRate: z.number().int().min(0).max(100),
  spO2: z.number().min(0).max(100),
  bloodGlucose: z.number().optional(),
  gcs: z.number().int().min(3).max(15).optional(),
});

// Get vitals for patient
router.get('/patient/:patientId', async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vitals')
      .select('*')
      .eq('patientId', req.params.patientId)
      .order('recordedAt', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message, code: 'DATABASE_ERROR' });
  }
});

// Create vitals
router.post('/', requireRole('nurse', 'medical_officer', 'registrar'), async (req: AuthenticatedRequest, res) => {
  try {
    const data = VitalsSchema.parse(req.body);
    const supabase = getSupabaseClient();

    const { data: newVitals, error } = await supabase
      .from('vitals')
      .insert([
        {
          ...data,
          recordedBy: req.userId,
          status: 'drafted',
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newVitals);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// Verify vitals (update status)
router.patch('/:id/verify', requireRole('medical_officer', 'registrar', 'consultant'), async (req: AuthenticatedRequest, res) => {
  try {
    const supabase = getSupabaseClient();
    const { status } = z.object({ status: z.enum(['pending_review', 'verified', 'rejected']) }).parse(req.body);

    const { data, error } = await supabase
      .from('vitals')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Vitals not found', code: 'NOT_FOUND' });

    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

export default router;
