import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import environment from "vite-plugin-environment";

const ii_url =
  process.env.DFX_NETWORK === "local"
    ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:8081/`
    : `https://identity.internetcomputer.org/`;

process.env.II_URL = process.env.II_URL || ii_url;
process.env.STORAGE_GATEWAY_URL =
  process.env.STORAGE_GATEWAY_URL || "https://blob.caffeine.ai";

// Resolve canister ID from either VITE_-prefixed (Vercel) or plain env var.
// Vercel only injects VITE_-prefixed vars into the browser bundle at build time.
// The Caffeine platform injects CANISTER_-prefixed vars automatically.
// Both are wired here so the same build works on both platforms.
const resolvedCanisterId =
  process.env.VITE_CANISTER_ID_BACKEND ||
  process.env.CANISTER_ID_BACKEND ||
  "";

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_drarmankabir_SUPABASE_URL || "https://hzmvhykjkhgxuclfscye.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_drarmankabir_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bXZoeWtqa2hneHVjbGZzY3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzk1NTcsImV4cCI6MjA5NTg1NTU1N30.zQrS9x_csF6-mJKVlLaRSUu1fnvc8MEYHVFGAQpLlQY";
const backendApiUrl = process.env.VITE_BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:3001";

export default defineConfig({
  logLevel: "error",
  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
  },
  define: {
    // Expose for Vercel deployments (VITE_ prefix required by Vite for custom env vars)
    "import.meta.env.VITE_CANISTER_ID_BACKEND": JSON.stringify(
      process.env.VITE_CANISTER_ID_BACKEND ||
        process.env.CANISTER_ID_BACKEND ||
        ""
    ),
    // Expose for Caffeine platform deployments (no VITE_ prefix)
    "import.meta.env.CANISTER_ID_BACKEND": JSON.stringify(
      process.env.CANISTER_ID_BACKEND ||
        process.env.VITE_CANISTER_ID_BACKEND ||
        ""
    ),
    // Also expose on window for runtime fallback in resolveCanisterId
    "window.__RESOLVED_CANISTER_ID_BACKEND": JSON.stringify(resolvedCanisterId),
    // Supabase configuration
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    "import.meta.env.VITE_BACKEND_API_URL": JSON.stringify(backendApiUrl),
  },
  css: {
    postcss: "./postcss.config.js",
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: backendApiUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      "/dfx-api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dfx-api/, '/api'),
      },
    },
  },
  plugins: [
    {
      name: 'canister-id-embedder',
      buildStart() {
        // Domain → env var suffix mapping
        const CANISTER_KEYS = [
          { key: 'patientData',     envSuffix: 'PATIENT_DATA',     jsonKey: 'patient-data'     },
          { key: 'clinicalData',    envSuffix: 'CLINICAL_DATA',    jsonKey: 'clinical-data'    },
          { key: 'admissionData',   envSuffix: 'ADMISSION_DATA',   jsonKey: 'admission-data'   },
          { key: 'appointmentData', envSuffix: 'APPOINTMENT_DATA', jsonKey: 'appointment-data' },
          { key: 'queueData',       envSuffix: 'QUEUE_DATA',       jsonKey: 'queue-data'       },
          { key: 'alertData',       envSuffix: 'ALERT_DATA',       jsonKey: 'alert-data'       },
          { key: 'authRoles',       envSuffix: 'AUTH_ROLES',       jsonKey: 'auth-roles'       },
          { key: 'syncDevice',      envSuffix: 'SYNC_DEVICE',      jsonKey: 'sync-device'      },
        ];

        // Try to load canister_ids.json from standard locations (priority 2 & 3)
        let canisterIdsJson = null;
        const jsonPaths = [
          path.resolve(process.cwd(), '.dfx', 'local', 'canister_ids.json'),
          path.resolve(process.cwd(), '..', '.dfx', 'local', 'canister_ids.json'),
          path.resolve(process.cwd(), '..', '..', '.dfx', 'local', 'canister_ids.json'),
          path.resolve(process.cwd(), 'canister_ids.json'),
          path.resolve(process.cwd(), '..', 'canister_ids.json'),
          path.resolve(process.cwd(), '..', '..', 'canister_ids.json'),
        ];
        for (const p of jsonPaths) {
          try {
            if (fs.existsSync(p)) {
              canisterIdsJson = JSON.parse(fs.readFileSync(p, 'utf-8'));
              break;
            }
          } catch {}
        }

        // Resolve each canister ID using priority: env var → .dfx json → root json
        const ids = {};
        for (const { key, envSuffix, jsonKey } of CANISTER_KEYS) {
          ids[key] =
            process.env[`CANISTER_ID_${envSuffix}`] ||
            process.env[`VITE_CANISTER_ID_${envSuffix}`] ||
            canisterIdsJson?.[jsonKey]?.ic ||
            canisterIdsJson?.[jsonKey]?.local ||
            '';
        }

        // Legacy single-canister ID for backward compatibility
        const legacyId =
          process.env.CANISTER_ID_BACKEND ||
          process.env.VITE_CANISTER_ID_BACKEND ||
          canisterIdsJson?.backend?.ic ||
          canisterIdsJson?.backend?.local ||
          ids.patientData ||
          '';

        const ts = [
          `// Auto-generated at build time by vite.config.js — do not edit manually`,
          `// Generated: ${new Date().toISOString()}`,
          ``,
          `export const CANISTER_IDS = {`,
          `  patientData:     "${ids.patientData}",`,
          `  clinicalData:    "${ids.clinicalData}",`,
          `  admissionData:   "${ids.admissionData}",`,
          `  appointmentData: "${ids.appointmentData}",`,
          `  queueData:       "${ids.queueData}",`,
          `  alertData:       "${ids.alertData}",`,
          `  authRoles:       "${ids.authRoles}",`,
          `  syncDevice:      "${ids.syncDevice}",`,
          `} as const;`,
          ``,
          `export type CanisterName = keyof typeof CANISTER_IDS;`,
          ``,
          `// Legacy single-ID export — kept for backward compatibility with existing code`,
          `export const BUILD_TIME_CANISTER_ID: string = "${legacyId}";`,
          `// Alias used by older imports`,
          `export const CANISTER_ID_BACKEND: string = "${legacyId}";`,
          `export const CANISTER_HOST: string = "https://icp0.io";`,
          ``,
        ].join('\n');

        const outPath = path.resolve(process.cwd(), 'src', 'canisterConfig.ts');
        fs.writeFileSync(outPath, ts, 'utf-8');
        console.log('[canister-id-embedder] canisterConfig.ts written.');
        for (const { key, envSuffix } of CANISTER_KEYS) {
          console.log(`  ${envSuffix}: ${ids[key] || '(empty)'}`);
        }
        if (!legacyId) {
          console.warn('[canister-id-embedder] WARNING: No canister IDs found. Sync will not work until IDs are set.');
        }
      }
    },
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment(["II_URL"]),
    environment(["STORAGE_GATEWAY_URL"]),
    environment(["VITE_SUPABASE_URL"]),
    environment(["VITE_SUPABASE_ANON_KEY"]),
    environment(["VITE_BACKEND_API_URL"]),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(new URL("../declarations", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
    dedupe: ["@dfinity/agent"]
  },
});
