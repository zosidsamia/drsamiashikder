import { Actor, HttpAgent } from "@dfinity/agent";

// CHANGE THIS to your canister ID
const CANISTER_ID = import.meta.env.VITE_CANISTER_ID_BACKEND;

const agent = new HttpAgent({
  host: "https://ic0.app",
});

// For local dev only
if (import.meta.env.DEV) {
  agent.fetchRootKey();
}

// Import your candid (adjust path if needed)
export const backend = Actor.createActor(
  ({ IDL }) => {
    return IDL.Service({
      getSyncQueue: IDL.Func([], [IDL.Vec(IDL.Record({}))], ["query"]),
      bulkUpsertPatients: IDL.Func([IDL.Vec(IDL.Record({}))], [], []),
    });
  },
  {
    agent,
    canisterId: CANISTER_ID,
  }
);
