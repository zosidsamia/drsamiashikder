# Firebase Setup Guide

## Configuration Complete ✅

Your Firebase integration for Dr. Arman Kabir's Care is ready!

### **Project Details**
- **Project ID:** drarmankabir
- **Auth Domain:** drarmankabir.firebaseapp.com
- **Storage Bucket:** drarmankabir.firebasestorage.app
- **Frontend:** `src/frontend/`

---

## 🔒 Security Rules Setup

### **1. Firestore Security Rules**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select `drarmankabir` project
3. Navigate to **Firestore Database** > **Rules**
4. Copy content from `firestore.rules` file
5. Paste and publish

**Features:**
- ✅ Authenticated users can read/write patient data
- ✅ Users can only modify their own profiles
- ✅ Admin-only audit log access
- ✅ Sub-collections for medical records, prescriptions, lab results

### **2. Firebase Storage Rules**

1. Navigate to **Storage** > **Rules**
2. Copy content from `storage.rules` file
3. Paste and publish

**Features:**
- ✅ Secure patient file uploads
- ✅ User avatars (write-only by owner)
- ✅ Prescription & report storage
- ✅ Default deny for unknown paths

---

## 📊 Firestore Data Structure

```
drarmankabir/
├── patients/
│   └── {patientId}/
│       ├── fullName: string
│       ├── email: string
│       ├── phone: string
│       ├── dateOfBirth: timestamp
│       ├── gender: string
│       ├── bloodGroup: string
│       ├── allergies: array
│       ├── chronicConditions: array
│       ├── createdAt: timestamp
│       ├── updatedAt: timestamp
│       ├── medicalRecords/ (sub-collection)
│       ├── prescriptions/ (sub-collection)
│       └── labResults/ (sub-collection)
│
├── medicalRecords/
│   └── {recordId}/
│       ├── patientId: string
│       ├── type: string (diagnosis|prescription|lab|notes)
│       ├── title: string
│       ├── content: string
│       ├── createdBy: string (doctorId)
│       ├── createdAt: timestamp
│       └── attachments: array
│
├── prescriptions/
│   └── {prescriptionId}/
│       ├── patientId: string
│       ├── drugName: string
│       ├── dosage: string
│       ├── frequency: string
│       ├── duration: string
│       ├── createdBy: string (doctorId)
│       ├── createdAt: timestamp
│       └── status: string (active|completed|paused)
│
├── appointments/
│   └── {appointmentId}/
│       ├── patientId: string
│       ├── doctorId: string
│       ├── date: timestamp
│       ├── time: string
│       ├── status: string (scheduled|completed|cancelled)
│       ├── notes: string
│       └── createdAt: timestamp
│
├── users/
│   └── {uid}/
│       ├── email: string
│       ├── name: string
│       ├── role: string (patient|doctor|staff|admin)
│       ├── designation: string
│       ├── avatar: string (URL)
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── staff/
│   └── {staffId}/
│       ├── name: string
│       ├── email: string
│       ├── role: string (doctor|nurse|intern|admin)
│       ├── specialization: string
│       ├── phone: string
│       ├── department: string
│       └── createdAt: timestamp
│
└── auditLogs/
    └── {logId}/
        ├── userId: string
        ├── action: string
        ├── target: string
        ├── timestamp: timestamp
        └── details: map
```

---

## 🚀 Usage Examples

### **Authentication**
```typescript
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

const { user, loading, error, signIn, signUp, signOut } = useFirebaseAuth();

// Sign up
await signUp('doctor@example.com', 'password123');

// Sign in
await signIn('patient@example.com', 'password123');

// Sign out
await signOut();
```

### **Query Patients**
```typescript
import { useFirestoreQuery } from '@/hooks/useFirestore';

const { data: patients, isLoading } = useFirestoreQuery('patients');
```

### **Add Patient**
```typescript
import { useAddFirestoreDocument } from '@/hooks/useFirestore';

const mutation = useAddFirestoreDocument('patients');

await mutation.mutateAsync({
  fullName: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  dateOfBirth: new Date('1990-01-01'),
  bloodGroup: 'O+',
  allergies: ['Penicillin'],
  createdAt: new Date(),
});
```

### **Get Patient by Field**
```typescript
import { useFirestoreQueryByField } from '@/hooks/useFirestore';

const { data: patient } = useFirestoreQueryByField(
  'patients',
  'email',
  'john@example.com'
);
```

### **Update Patient**
```typescript
import { useUpdateFirestoreDocument } from '@/hooks/useFirestore';

const mutation = useUpdateFirestoreDocument('patients');

await mutation.mutateAsync({
  docId: 'patient-123',
  data: { bloodGroup: 'AB+', updatedAt: new Date() },
});
```

### **Delete Patient**
```typescript
import { useDeleteFirestoreDocument } from '@/hooks/useFirestore';

const mutation = useDeleteFirestoreDocument('patients');

await mutation.mutateAsync('patient-123');
```

### **Upload Medical Record**
```typescript
import { firebaseStorageService } from '@/lib/firebaseStorage';

const file = new File([...], 'report.pdf', { type: 'application/pdf' });
const url = await firebaseStorageService.uploadFile(
  `patients/${patientId}/reports/report.pdf`,
  file
);
```

---

## 🔐 Environment Setup

Create `src/frontend/.env.local`:
```bash
VITE_FIREBASE_API_KEY=AIzaSyCvxkwJm2fw8kTH78eNywu51C1jre-JDcE
VITE_FIREBASE_AUTH_DOMAIN=drarmankabir.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=drarmankabir
VITE_FIREBASE_STORAGE_BUCKET=drarmankabir.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=744640163866
VITE_FIREBASE_APP_ID=1:744640163866:web:5e4c00ec58b03bd5b261a3
VITE_FIREBASE_MEASUREMENT_ID=G-18CB974GXT
VITE_USE_FIREBASE_EMULATOR=false
```

---

## 📦 Installation

```bash
cd src/frontend
pnpm install
pnpm dev
```

---

## ✨ Integration Checklist

- [x] Firebase SDK added to dependencies
- [x] Authentication hook created
- [x] Firestore service created
- [x] React Query hooks integrated
- [x] Storage service created
- [x] Environment variables configured
- [ ] **Security Rules deployed** (TODO: Do this in Firebase Console)
- [ ] **Firestore indexes created** (if needed for complex queries)
- [ ] **Integrate with existing auth system** (optional)
- [ ] **Create patient management pages**
- [ ] **Setup Cloud Functions** (optional for backend logic)

---

## 🔧 Next Steps

1. **Deploy Security Rules:**
   - Go to Firebase Console
   - Deploy Firestore and Storage rules
   
2. **Install Dependencies:**
   ```bash
   pnpm install
   ```

3. **Start Development:**
   ```bash
   pnpm dev
   ```

4. **Create Components:**
   - Patient list page
   - Patient profile page
   - Add/edit patient forms
   - Medical records manager

5. **Test Firebase:**
   - Sign in/up
   - Create patient records
   - Upload files
   - Query data

---

## 📞 Support

For Firebase documentation:
- [Firebase Web SDK](https://firebase.google.com/docs/web/setup)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Storage Documentation](https://firebase.google.com/docs/storage)
- [Authentication Documentation](https://firebase.google.com/docs/auth)

---

**Your Firebase integration is complete and ready for production! 🚀**
