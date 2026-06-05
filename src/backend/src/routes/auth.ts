import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../lib/supabase.js';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const router = Router();

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['patient', 'nurse', 'intern', 'medical_officer', 'registrar', 'consultant', 'reception', 'admin']),
});

// Sign Up
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const data = SignupSchema.parse(req.body);
    const supabase = getSupabaseClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message, code: 'AUTH_ERROR' });
    }

    // Create user profile
    const { error: profileError } = await supabase.from('users').insert([
      {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role,
      },
    ]);

    if (profileError) {
      return res.status(400).json({ error: profileError.message, code: 'PROFILE_ERROR' });
    }

    // Generate JWT
    const token = jwt.sign(
      { sub: authData.user.id, email: data.email, role: data.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.json({
      user: {
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role,
      },
      token,
      expiresIn: 604800, // 7 days in seconds
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

// Sign In
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = AuthSchema.parse(req.body);
    const supabase = getSupabaseClient();

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ error: 'User profile not found', code: 'PROFILE_NOT_FOUND' });
    }

    // Generate JWT
    const token = jwt.sign(
      { sub: authData.user.id, email: userProfile.email, role: userProfile.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.json({
      user: userProfile,
      token,
      expiresIn: 604800,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }
});

export default router;
