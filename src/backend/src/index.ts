import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeSupabase } from './lib/supabase.js';
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import vitalsRoutes from './routes/vitals.js';
import appointmentsRoutes from './routes/appointments.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase
initializeSupabase();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/patients', authMiddleware, patientsRoutes);
app.use('/api/vitals', authMiddleware, vitalsRoutes);
app.use('/api/appointments', authMiddleware, appointmentsRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
