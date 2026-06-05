# Supabase Backend

Comprehensive backend for Dr. Arman Kabir's Care using Supabase and Express.js.

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Database Setup

Run migrations in Supabase dashboard:
- Navigate to SQL Editor
- Create new query
- Copy content from `supabase/migrations/001_init_schema.sql`
- Execute

### 4. Development

```bash
pnpm dev
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Patients (Protected)
- `GET /api/patients` - List all patients
- `GET /api/patients/:id` - Get patient details
- `POST /api/patients` - Create patient
- `PUT /api/patients/:id` - Update patient

### Vitals (Protected)
- `GET /api/vitals/patient/:patientId` - Get patient vitals
- `POST /api/vitals` - Record vitals
- `PATCH /api/vitals/:id/verify` - Verify vitals status

### Appointments (Protected)
- `GET /api/appointments/patient/:patientId` - Get patient appointments
- `POST /api/appointments` - Create appointment
- `PATCH /api/appointments/:id/status` - Update appointment status

## Authentication

All protected endpoints require Bearer token:

```
Authorization: Bearer <token>
```

## Role-Based Access Control

- **Admin**: Full access
- **Consultant**: Clinical access, can finalize notes
- **Registrar**: Senior medical officer access
- **Medical Officer**: Can write SOAP notes, verify vitals
- **Intern**: Can draft notes
- **Nurse**: Can record vitals and MAR
- **Reception**: Can manage appointments and billing
- **Patient**: Can view own data

## Database Schema

See `supabase/migrations/001_init_schema.sql` for full schema definition.

## Development Commands

```bash
# Type checking
pnpm typecheck

# Format and lint
pnpm fix

# Build
pnpm build

# Start production
pnpm start
```
