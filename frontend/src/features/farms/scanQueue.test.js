import "fake-indexeddb/auto";
import { deserialize, serialize } from "node:v8";
import {
  MAX_WAITING,
  clearScans,
  keepOnlyScansOf,
  queueScan,
  removeScan,
  waitingScans,
} from "./scanQueue";
import { clearOwner } from "./offline";
global.structuredClone = (value) => deserialize(serialize(value));

const photo = { plot_id: "field-a", crop: "Tomato", photo: "jpeg-bytes" };
beforeEach(async () => {
  await clearScans("farmer-a");
  await clearScans("farmer-b");
});

test("waiting photos stay with the farmer who took them", async () => {
  const id = await queueScan("farmer-a", photo);
  await queueScan("farmer-b", { ...photo, plot_id: "field-b" });
  const mine = await waitingScans("farmer-a");
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ id, plot_id: "field-a", crop: "Tomato" });
  expect(Date.parse(mine[0].queued_at)).not.toBeNaN();
  await removeScan("farmer-a", id);
  expect(await waitingScans("farmer-a")).toEqual([]);
  expect(await waitingScans("farmer-b")).toHaveLength(1);
});

test("the queue stops at five photos and says what to do", async () => {
  for (let index = 0; index < MAX_WAITING; index += 1)
    await queueScan("farmer-a", photo);
  await expect(queueScan("farmer-a", photo)).rejects.toThrow(
    /Five photos are already waiting/,
  );
  expect(await waitingScans("farmer-a")).toHaveLength(MAX_WAITING);
});

test("signing out clears only the photos of that farmer", async () => {
  await queueScan("farmer-a", photo);
  await queueScan("farmer-b", photo);
  await clearScans("farmer-a");
  expect(await waitingScans("farmer-a")).toEqual([]);
  expect(await waitingScans("farmer-b")).toHaveLength(1);
});

test("signing out or deleting the account removes waiting photos with the other private records", async () => {
  await queueScan("farmer-a", photo);
  await queueScan("farmer-b", photo);
  await clearOwner("farmer-a", true);
  expect(await waitingScans("farmer-a")).toEqual([]);
  expect(await waitingScans("farmer-b")).toHaveLength(1);
  // Turning off offline records alone keeps a photo the farmer chose to save.
  await clearOwner("farmer-b");
  expect(await waitingScans("farmer-b")).toHaveLength(1);
});

test("a new sign-in on a shared phone removes photos left by another account", async () => {
  await queueScan("farmer-a", photo);
  await queueScan("farmer-b", photo);
  await keepOnlyScansOf("farmer-b");
  expect(await waitingScans("farmer-a")).toEqual([]);
  expect(await waitingScans("farmer-b")).toHaveLength(1);
});
