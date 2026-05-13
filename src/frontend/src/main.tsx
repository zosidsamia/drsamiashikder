import { InternetIdentityProvider } from "@caffeineai/core-infrastructure";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// ── React Query client with cross-device sync defaults ────────────────────────
// - staleTime: 10s  — data considered stale quickly so refetches happen often
// - refetchInterval: 15s — both devices poll canister every 15 seconds
// - refetchOnWindowFocus: true  — switching back to the tab triggers an immediate refetch
// - refetchOnReconnect: true — coming back online triggers an immediate refetch
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// Export so useMigration / App.tsx can call invalidateQueries from outside React
export { queryClient };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <InternetIdentityProvider>
      <App />
    </InternetIdentityProvider>
  </QueryClientProvider>,
);
