# ICP Integration Guide - Dr. Arman Kabir's Care

## 📖 Complete Integration Guide

This guide covers everything you need to deploy and use the enhanced Dr. Arman Kabir's Care healthcare application on the Internet Computer Protocol (ICP).

---

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites

```bash
# Install required tools
npm install -g dfx                    # DFX SDK
brew install mops                     # Motoko package manager
pnpm install -g pnpm@latest           # Package manager
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Update canister ID (after first deployment)
VITE_CANISTER_ID_BACKEND=your-canister-id-here
VITE_ICP_NETWORK=local
```

### 3. Deploy Locally

```bash
# Start local replica
dfx start --background

# Deploy canister
dfx deploy backend

# Get canister ID
dfx canister id backend

# Update .env.local with returned canister ID
```

### 4. Build & Run Frontend

```bash
cd src/frontend
pnpm install
pnpm dev
```

Visit `http://localhost:5173` to access the application.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Frontend (React + Vite)              │
│  ├─ Authentication (AuthClient)             │
│  ├─ Actor Management (ICPActorManager)      │
│  └─ Error Handling & Retry Logic            │
└────────────┬────────────────────────────────┘
             │ HTTP Agent + ICP SDK
┌────────────▼────────────────────────────────┐
│         ICP Network                          │
│  ┌──────────────────────────────────────┐  │
│  │      Backend Canister (Motoko)       │  │
│  │  ├─ Patient Management               │  │
│  │  ├─ Visit Management                 │  │
│  │  ├─ Prescription Management          │  │
│  │  ├─ Authorization & Access Control   │  │
│  │  ├─ Audit Logging (HIPAA)            │  │
│  │  ├─ Rate Limiting                    │  │
│  │  └─ Stable Storage (Persistence)     │  │
│  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 📦 Updated Canister API

### Result Types

All API calls now return `Result<T, ApiError>`:

```typescript
// Success
{ ok: { id: 1, name: "Patient Name", ... } }

// Error
{ err: { unauthorized: "Only users can access this" } }
```

### Error Types

```motoko
public type ApiError = {
  #notFound : Text;          // 404
  #unauthorized : Text;       // 403
  #validationError : Text;    // 400
  #internalError : Text;      // 500
  #rateLimited : Text;        // 429
};
```

### Key Endpoints

#### Patient Management

```typescript
// Create patient
actor.createPatient({
  fullName: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  gender: { male: null },
  patientType: { outdoor: null },
  // ... other fields
})
// Returns: Result<Patient, ApiError>

// Get paginated patients
actor.getPatientsPageinated({
  limit: 50,
  offset: 0
})
// Returns: Result<PaginatedResult<Patient>, ApiError>

// Delete patient
actor.deletePatient(1)
// Returns: Result<(), ApiError>
```

#### Visit Management

```typescript
// Similar to patient management
// createVisit, getVisit, getVisitsPageinated, updateVisit, deleteVisit
```

#### Prescription Management

```typescript
// Similar to patient management
// createPrescription, getPrescription, getPrescriptionsPageinated, updatePrescription, deletePrescription
```

#### Canister Monitoring

```typescript
// Check canister health
actor.getCanisterStatus()
// Returns: {
//   memory_size: Nat,
//   cycles_balance: Nat,
//   total_patients: Nat,
//   total_visits: Nat,
//   total_prescriptions: Nat,
//   total_audit_logs: Nat
// }
```

#### Audit Logging (Admin Only)

```typescript
// Get audit logs with pagination
actor.getAuditLogs({
  limit: 50,
  offset: 0
})
// Returns: Result<PaginatedResult<AuditLog>, ApiError>
```

---

## 🔐 Frontend Integration

### 1. Initialize Actor Manager

```typescript
import { actorManager } from './lib/icp-actor';

// In your App.tsx or main component
useEffect(() => {
  actorManager.initialize().then(() => {
    console.log('✅ ICP initialized');
  }).catch(err => {
    console.error('❌ ICP init failed:', err);
  });
}, []);
```

### 2. Handle Authentication

```typescript
import { actorManager } from './lib/icp-actor';

function LoginButton() {
  const handleLogin = async () => {
    try {
      await actorManager.login();
      const principal = actorManager.getPrincipal();
      console.log('Logged in as:', principal);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return <button onClick={handleLogin}>Login</button>;
}
```

### 3. Make API Calls with Error Handling

```typescript
import { unwrapResult } from './lib/icp-actor';

async function createPatient(patientData) {
  try {
    const actor = actorManager.getAgent();
    const result = await actor.createPatient(patientData);
    
    // Unwrap Result type
    const patient = unwrapResult(result);
    console.log('Patient created:', patient);
    return patient;
  } catch (error) {
    console.error('Failed to create patient:', error);
    // Show error to user
    toast.error(extractErrorMessage(error));
  }
}
```

### 4. Pagination Example

```typescript
async function loadPatients(page = 1, pageSize = 50) {
  try {
    const offset = (page - 1) * pageSize;
    const result = await actor.getPatientsPageinated({
      limit: pageSize,
      offset,
    });
    
    const paginatedData = unwrapResult(result);
    console.log('Total patients:', paginatedData.total);
    console.log('Has more:', paginatedData.hasMore);
    console.log('Current page:', paginatedData.items);
    
    return paginatedData;
  } catch (error) {
    console.error('Failed to load patients:', error);
  }
}
```

---

## 🧪 Testing

### Unit Tests (Motoko)

```bash
# Test backend canister
cd src/backend
mops test
```

### Integration Tests (TypeScript)

```bash
# Start local replica
dfx start --background

# Deploy test canister
dfx deploy backend

# Run integration tests
cd src/frontend
pnpm test:integration
```

### Manual Testing with DFX

```bash
# Get current user
dfx canister call backend getCurrentUser

# Create a patient
dfx canister call backend createPatient '(
  "John Doe",
  opt "জন ডু",
  opt 1000000000000000,
  variant { male },
  opt "+1234567890",
  opt "john@example.com",
  opt "123 Main St",
  opt "O+",
  opt 75.5,
  opt 1.8,
  vec {},
  vec {},
  opt "Prior surgery",
  variant { outdoor },
  opt "consultant@example.com",
  opt "Dr. Smith"
)'

# Get canister status
dfx canister call backend getCanisterStatus
```

---

## 🌍 Deployment to Mainnet

### Step 1: Prepare for Mainnet

```bash
# Update environment
export VITE_ICP_NETWORK=ic
export VITE_ICP_API_URL=https://icp-api.io
export VITE_CANISTER_ID_BACKEND=<your-reserved-canister-id>

# Build canister for production
dfx build backend --network=ic
```

### Step 2: Acquire Cycles

```bash
# Get your principal
dfx identity get-principal

# Fund your account (using ICP)
# Visit https://dashboard.internetcomputer.org/ to purchase cycles
```

### Step 3: Deploy to Mainnet

```bash
# Install code on mainnet
dfx canister install backend --network=ic --mode=upgrade

# Verify deployment
dfx canister status backend --network=ic
```

### Step 4: Update DNS (Optional)

```bash
# Get your frontend canister ID
dfx canister id frontend --network=ic

# Configure DNS to point to:
# https://<FRONTEND_CANISTER_ID>.icp.xyz
```

---

## 📊 Rate Limiting

Rate limiting is **enabled by default**:

- **Max Requests:** 100 per user
- **Time Window:** 60 seconds
- **Response:** `{ err: { rateLimited: "Rate limit exceeded" } }`

### Configuration

```bash
# Edit in src/backend/main.mo (constants)
let MAX_CALLS_PER_WINDOW = 100;
let RATE_LIMIT_WINDOW_SECONDS = 60;
```

### Bypass (Development Only)

```typescript
// Disable rate limiting in local environment
if (import.meta.env.VITE_ICP_NETWORK === 'local') {
  // Skip rate limit check
}
```

---

## 🔍 Monitoring & Debugging

### Check Canister Health

```bash
# Get memory and cycles info
dfx canister call backend getCanisterStatus

# Monitor logs (if using local replica)
dfx replica logs
```

### Enable Debug Logging

```bash
# In .env.local
VITE_DEBUG_MODE=true
```

### View Audit Logs (Admin)

```typescript
const result = await actor.getAuditLogs({
  limit: 50,
  offset: 0,
});

const logs = unwrapResult(result);
logs.items.forEach(log => {
  console.log(`${log.action} by ${log.actor} at ${log.timestamp}`);
});
```

---

## 🔒 Security Best Practices

### 1. Authorization

- All endpoints check user permissions
- Admin-only operations are protected
- Authorization errors return generic messages

```motoko
if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
  return #err(#unauthorized("Access denied"));
};
```

### 2. Input Validation

- Email format validation
- Phone number length validation
- Required field checks

```motoko
if (not isValidEmail(email)) {
  return #err(#validationError("Invalid email format"));
};
```

### 3. Audit Logging (HIPAA)

- All mutations are logged
- Actor principal is recorded
- Timestamps are tracked
- Success/failure is recorded

```typescript
logAction(caller, "createPatient", "Created patient: John", true);
```

### 4. Rate Limiting

- Prevents abuse and DDoS
- Per-user tracking
- Exponential backoff on retry

### 5. Secure Frontend Initialization

```typescript
// DO: Validate environment variables
if (!icpConfig.canisterId) {
  throw new Error('Canister ID not configured');
}

// DON'T: Hardcode canister IDs or secrets
const SECRET_KEY = 'actual-key'; // ❌ WRONG!
```

---

## 🆘 Troubleshooting

### Issue: "Canister ID not configured"

```bash
# Solution: Update .env.local
VITE_CANISTER_ID_BACKEND=rkp4c-7iaaa-aaaaa-aaaca-cai
```

### Issue: "Unauthorized" errors

```bash
# Ensure user is registered/logged in
# Check AccessControl role assignment
dfx canister call backend getCurrentUser
```

### Issue: "Rate limit exceeded"

```bash
# Wait 60 seconds before retrying
# Or increase MAX_CALLS_PER_WINDOW in main.mo
```

### Issue: Memory exhaustion (>2GB)

```bash
# Reduce audit log retention
# Implement log cleanup in heartbeat
# Monitor with getCanisterStatus()
```

### Issue: Cycles running low

```bash
# Top up cycles
# Monitor with getCanisterStatus().cycles_balance
# Upgrade canister with more cycles allocated
```

---

## 📚 Additional Resources

- [ICP Documentation](https://internetcomputer.org/docs)
- [Motoko Documentation](https://internetcomputer.org/docs/current/motoko/main/overview)
- [dfx CLI Reference](https://internetcomputer.org/docs/current/developer-docs/build/cli-reference)
- [DFinity Forum](https://forum.dfinity.org)

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Environment variables configured (.env.production)
- [ ] Backend canister tested locally
- [ ] Frontend builds successfully (`pnpm build`)
- [ ] All API endpoints tested
- [ ] Authorization rules verified
- [ ] Audit logging verified
- [ ] Rate limiting tested
- [ ] Cycles acquired and allocated
- [ ] Mainnet deployment tested
- [ ] DNS configured (if applicable)
- [ ] Monitoring set up
- [ ] Backup plan documented

---

## 🎉 You're Ready!

Your Dr. Arman Kabir's Care application is now ready for ICP deployment!

For support, check the [GitHub Issues](https://github.com/sekabir011-arman/dr-arman-kabir-s-care/issues) or reach out to the development team.

**Happy Deploying! 🚀**
