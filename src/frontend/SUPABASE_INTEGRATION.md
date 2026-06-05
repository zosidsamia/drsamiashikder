# Supabase Frontend Integration

This frontend is now fully configured to work with Supabase backend.

## Environment Setup

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp src/frontend/.env.local.example src/frontend/.env.local
   ```

2. Fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=http://localhost:3000
   ```

## Key Files Added

### Libraries
- **`src/lib/supabase.ts`** - Supabase client initialization
- **`src/lib/AuthContext.tsx`** - React context for authentication state

### Hooks
- **`src/hooks/useAuth.ts`** - Authentication (login, signup, logout)
- **`src/hooks/usePatients.ts`** - Patient data management
- **`src/hooks/useVitals.ts`** - Vitals recording and verification
- **`src/hooks/useAppointments.ts`** - Appointment scheduling

### Components
- **`src/components/ProtectedRoute.tsx`** - Route protection with role-based access

## Usage

### Wrap your app with AuthProvider

```tsx
import { AuthProvider } from '@/lib/AuthContext';

function App() {
  return (
    <AuthProvider>
      {/* Your routes */}
    </AuthProvider>
  );
}
```

### Use Authentication

```tsx
import { useAuthContext } from '@/lib/AuthContext';

function LoginPage() {
  const { login, loading, error } = useAuthContext();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login({ email, password });
      // Redirect to dashboard
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      {/* Your login form */}
    </div>
  );
}
```

### Use Patient Data

```tsx
import { usePatients } from '@/hooks/usePatients';
import { useAuthContext } from '@/lib/AuthContext';

function PatientsPage() {
  const { token } = useAuthContext();
  const { patients, loading, fetchPatients } = usePatients(token);

  useEffect(() => {
    fetchPatients();
  }, []);

  return (
    <div>
      {patients.map(patient => (
        <div key={patient.id}>
          {patient.firstName} {patient.lastName}
        </div>
      ))}
    </div>
  );
}
```

### Use Vitals

```tsx
import { useVitals } from '@/hooks/useVitals';
import { useAuthContext } from '@/lib/AuthContext';

function VitalsPage({ patientId }: { patientId: string }) {
  const { token } = useAuthContext();
  const { vitals, recordVitals, verifyVitals } = useVitals(token);

  const handleRecordVitals = async () => {
    await recordVitals(patientId, {
      bloodPressure: '120/80',
      pulse: 72,
      temperature: 37,
      respiratoryRate: 16,
      spO2: 98,
      patientId,
    });
  };

  return (
    <div>
      {/* Your vitals form */}
    </div>
  );
}
```

### Use Appointments

```tsx
import { useAppointments } from '@/hooks/useAppointments';
import { useAuthContext } from '@/lib/AuthContext';

function AppointmentsPage({ patientId }: { patientId: string }) {
  const { token } = useAuthContext();
  const { appointments, createAppointment, updateAppointmentStatus } = useAppointments(token);

  const handleCreateAppointment = async () => {
    await createAppointment({
      patientId,
      doctorId: 'doctor-123',
      appointmentDate: new Date().toISOString(),
      duration: 30,
      reason: 'Checkup',
      status: 'scheduled',
    });
  };

  return (
    <div>
      {/* Your appointments form */}
    </div>
  );
}
```

## Protected Routes

```tsx
import { ProtectedRoute } from '@/components/ProtectedRoute';

<ProtectedRoute requiredRoles={['doctor', 'nurse']}>
  <YourComponent />
</ProtectedRoute>
```

## API Integration

All hooks automatically:
- Include JWT token in Authorization header
- Handle errors gracefully
- Manage loading states
- Update local state on success

## Next Steps

1. Start the backend: `pnpm dev` (from `src/backend`)
2. Update your existing components to use the new hooks
3. Wrap routes with `ProtectedRoute` for authentication
4. Replace ICP canister calls with Supabase API calls
