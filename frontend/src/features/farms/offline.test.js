import "fake-indexeddb/auto";
import { deserialize, serialize } from "node:v8";
import {
  clearOwner,
  activateOwner,
  pendingOperations,
  queueOperation,
  readRecord,
  saveRecord,
  synchronize,
} from "./offline";
global.structuredClone = (value) => deserialize(serialize(value));

beforeEach(async () => {
  await clearOwner("farmer-a");
  await clearOwner("farmer-b");
});

test("account caches and pending observations remain isolated and logout clears only its owner", async () => {
  await saveRecord("farmer-a", "fields", { plots: ["private-a"] });
  await saveRecord("farmer-b", "fields", { plots: ["private-b"] });
  await queueOperation("farmer-a", {
    operation_id: "a1",
    path: "/plots/a/observations",
    body: { note: "a" },
  });
  await queueOperation("farmer-b", {
    operation_id: "b1",
    path: "/plots/b/observations",
    body: { note: "b" },
  });
  expect(
    (await pendingOperations("farmer-a")).map((x) => x.operation_id),
  ).toEqual(["a1"]);
  await clearOwner("farmer-a");
  expect(await readRecord("farmer-a", "fields")).toBeUndefined();
  expect(await pendingOperations("farmer-a")).toEqual([]);
  expect((await readRecord("farmer-b", "fields")).data.plots).toEqual([
    "private-b",
  ]);
  expect((await pendingOperations("farmer-b")).length).toBe(1);
});

test("failed synchronization retains the conflicting operation and later observations for review", async () => {
  for (const id of ["a1", "a2", "a3"])
    await queueOperation("farmer-a", {
      operation_id: id,
      path: "/plots/a/observations",
      body: { operation_id: id },
    });
  const send = jest
    .fn()
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(
      Object.assign(new Error("Conflict"), { status: 409 }),
    );
  const outcome = await synchronize("farmer-a", send);
  expect(outcome.sent).toBe(1);
  expect(outcome.pending).toBe(2);
  expect(
    (await pendingOperations("farmer-a")).map((x) => x.operation_id),
  ).toEqual(["a2", "a3"]);
  expect(send).toHaveBeenCalledTimes(2);
});

test("offline operation IDs cannot silently overwrite a pending observation", async () => {
  await queueOperation("farmer-a", {
    operation_id: "same",
    body: { note: "original" },
  });
  await expect(
    queueOperation("farmer-a", {
      operation_id: "same",
      body: { note: "changed" },
    }),
  ).rejects.toThrow();
  expect((await pendingOperations("farmer-a"))[0].body.note).toBe("original");
});

test("logout prevents a late background cache write or queued observation from restoring private data", async () => {
  activateOwner("farmer-a");
  await saveRecord("farmer-a", "fields", { plots: ["private"] });
  await clearOwner("farmer-a", true);
  await saveRecord("farmer-a", "fields", { plots: ["late"] });
  expect(await readRecord("farmer-a", "fields")).toBeUndefined();
  await expect(
    queueOperation("farmer-a", { operation_id: "late", body: {} }),
  ).rejects.toThrow();
  activateOwner("farmer-a");
  await saveRecord("farmer-a", "fields", { plots: ["new verified session"] });
  expect((await readRecord("farmer-a", "fields")).data.plots).toEqual([
    "new verified session",
  ]);
});
