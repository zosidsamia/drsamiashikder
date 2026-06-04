import fs from 'fs';
import path from 'path';
import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ii_url =
  process.env.DFX_NETWORK === "local"
    ? `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:8081/`
    : `https://identity.internetcomputer.org/`;

process.env.II_URL = process.env.II_URL || ii_url;

process.env.STORAGE_GATEWAY_URL =
  process.env.STORAGE_GATEWAY_URL || "https://blob.caffeine.ai";

// Resolve canister ID safely
const resolvedCanisterId =
  process.env.VITE_CANISTER_ID_BACKEND ||
  process.env.CANISTER_ID_BACKEND ||
  "";

// Supabase SAFE defaults (NO plugin required)
const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  "https://hzmvhykjkhgxuclfscye.supabase.co";

const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "demo_key";

const backendApiUrl =
  process.env.VITE_BACKEND_API_URL ||
  "http://127.0.0.1:4943";

export default defineConfig({
  logLevel: "error",

  build: {
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
  },

  define: {
    // ICP canister ID
    "import.meta.env.VITE_CANISTER_ID_BACKEND": JSON.stringify(
      process.env.VITE_CANISTER_ID_BACKEND ||
      process.env.CANISTER_ID_BACKEND ||
      ""
    ),

    "import.meta.env.CANISTER_ID_BACKEND": JSON.stringify(
      process.env.CANISTER_ID_BACKEND ||
      process.env.VITE_CANISTER_ID_BACKEND ||
      ""
    ),

    "window.__RESOLVED_CANISTER_ID_BACKEND": JSON.stringify(resolvedCanisterId),

    // Supabase (SAFE defaults)
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),

    // Backend API
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
        rewrite: (path) => path,
      },

      "/dfx-api": {
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dfx-api/, "/api"),
      },
    },
  },

  plugins: [
    {
      name: "canister-id-embedder",

      buildStart() {
        const CANISTER_KEYS = [
          { key: "patientData", envSuffix: "PATIENT_DATA", jsonKey: "patient-data" },
          { key: "clinicalData", envSuffix: "CLINICAL_DATA", jsonKey: "clinical-data" },
          { key: "admissionData", envSuffix: "ADMISSION_DATA", jsonKey: "admission-data" },
          { key: "appointmentData", envSuffix: "APPOINTMENT_DATA", jsonKey: "appointment-data" },
          { key: "queueData", envSuffix: "QUEUE_DATA", jsonKey: "queue-data" },
          { key: "alertData", envSuffix: "ALERT_DATA", jsonKey: "alert-data" },
          { key: "authRoles", envSuffix: "AUTH_ROLES", jsonKey: "auth-roles" },
          { key: "syncDevice", envSuffix: "SYNC_DEVICE", jsonKey: "sync-device" },
        ];

        let canisterIdsJson = null;

        const jsonPaths = [
          path.resolve(process.cwd(), ".dfx/local/canister_ids.json"),
          path.resolve(process.cwd(), "../.dfx/local/canister_ids.json"),
          path.resolve(process.cwd(), "../../.dfx/local/canister_ids.json"),
        ];

        for (const p of jsonPaths) {
          try {
            if (fs.existsSync(p)) {
              canisterIdsJson = JSON.parse(fs.readFileSync(p, "utf-8"));
              break;
            }
          } catch {}
        }

        const ids = {};

        for (const { key, envSuffix, jsonKey } of CANISTER_KEYS) {
          ids[key] =
            process.env[`CANISTER_ID_${envSuffix}`] ||
            process.env[`VITE_CANISTER_ID_${envSuffix}`] ||
            canisterIdsJson?.[jsonKey]?.ic ||
            canisterIdsJson?.[jsonKey]?.local ||
            "";
        }

        const legacyId =
          process.env.CANISTER_ID_BACKEND ||
          process.env.VITE_CANISTER_ID_BACKEND ||
          canisterIdsJson?.backend?.ic ||
          canisterIdsJson?.backend?.local ||
          ids.patientData ||
          "";

        const ts = `
// Auto-generated at build time — do not edit
export const CANISTER_IDS = {
  patientData:     "${ids.patientData}",
  clinicalData:    "${ids.clinicalData}",
  admissionData:   "${ids.admissionData}",
  appointmentData: "${ids.appointmentData}",
  queueData:       "${ids.queueData}",
  alertData:       "${ids.alertData}",
  authRoles:       "${ids.authRoles}",
  syncDevice:      "${ids.syncDevice}",
} as const;

export type CanisterName = keyof typeof CANISTER_IDS;

export const BUILD_TIME_CANISTER_ID = "${legacyId}";
export const CANISTER_ID_BACKEND = "${legacyId}";
export const CANISTER_HOST = "https://icp0.io";
`;

        const outPath = path.resolve(process.cwd(), "src/canisterConfig.ts");
        fs.writeFileSync(outPath, ts, "utf-8");

        console.log("[canister-id-embedder] generated");

        if (!legacyId) {
          console.warn("[ICP WARNING] No canister ID found. Run dfx deploy.");
        }
      }
    },

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
    dedupe: ["@dfinity/agent"],
  },
});