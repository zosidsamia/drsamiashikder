import { backend } from "../icp";
import { nhost } from "../nhost";

let isRunning = false;

export function startSyncEngine() {
  if (isRunning) return;
  isRunning = true;

  run();
}

async function run() {
  while (true) {
    try {
      const queue = await backend.getSyncQueue();
      const pending = queue.filter((q: any) => !q.synced);

      for (const item of pending) {
        await syncItem(item);
      }
    } catch (e) {
      console.error("sync error", e);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }
}

async function syncItem(item: any) {
  if (item.entityType === "patient") {
    const patient = await backend.getPatient(item.entityId);

    if (!patient) return;

    await nhost.graphql.request(`
      mutation {
        insert_patients_one(object: {
          id: "${patient.id}",
          full_name: "${patient.fullName}"
        }) {
          id
        }
      }
    `);
  }
}
