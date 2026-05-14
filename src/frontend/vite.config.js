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
        target: "http://127.0.0.1:4943",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment(["II_URL"]),
    environment(["STORAGE_GATEWAY_URL"]),
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
