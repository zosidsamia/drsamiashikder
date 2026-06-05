-- Enable extensions
create extension if not exists "uuid-ossp";

-- Users table
create table public.users (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  name text not null,
  role text not null check (role in ('admin', 'consultant', 'registrar', 'medical_officer', 'intern', 'nurse', 'reception', 'patient')),
  phone text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Patients table
create table public.patients (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('M', 'F', 'O')),
  phone text not null,
  email text,
  address text not null,
  city text not null,
  state text not null,
  zip_code text not null,
  blood_group text,
  allergies text[],
  medical_history text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Vitals table
create table public.vitals (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients on delete cascade,
  blood_pressure text not null,
  pulse integer not null,
  temperature numeric not null,
  respiratory_rate integer not null,
  sp_o2 integer not null,
  blood_glucose numeric,
  gcs integer,
  recorded_at timestamp with time zone default now(),
  recorded_by uuid not null references public.users on delete restrict,
  status text default 'drafted' check (status in ('drafted', 'pending_review', 'verified', 'rejected')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Appointments table
create table public.appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients on delete cascade,
  doctor_id uuid not null references public.users on delete restrict,
  appointment_date timestamp with time zone not null,
  duration integer not null,
  reason text not null,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Prescriptions table
create table public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients on delete cascade,
  medicine_id text not null,
  dosage text not null,
  frequency text not null,
  duration integer not null,
  instructions text,
  start_date date not null,
  end_date date not null,
  prescribed_by uuid not null references public.users on delete restrict,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Investigations table
create table public.investigations (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients on delete cascade,
  test_name text not null,
  result text,
  normal_range text,
  unit text,
  status text default 'pending' check (status in ('pending', 'completed', 'reviewed')),
  ordered_by uuid not null references public.users on delete restrict,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index idx_vitals_patient on public.vitals(patient_id);
create index idx_vitals_recorded_at on public.vitals(recorded_at desc);
create index idx_appointments_patient on public.appointments(patient_id);
create index idx_appointments_date on public.appointments(appointment_date);
create index idx_prescriptions_patient on public.prescriptions(patient_id);
create index idx_investigations_patient on public.investigations(patient_id);

-- Enable RLS (Row Level Security)
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.vitals enable row level security;
alter table public.appointments enable row level security;
alter table public.prescriptions enable row level security;
alter table public.investigations enable row level security;

-- RLS Policies
create policy "Users can view their own profile" on public.users
  for select using (auth.uid() = id);

create policy "Admins can view all users" on public.users
  for select using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Patients can view their own data" on public.patients
  for select using (true);

create policy "Vitals visible to patient and medical staff" on public.vitals
  for select using (true);
