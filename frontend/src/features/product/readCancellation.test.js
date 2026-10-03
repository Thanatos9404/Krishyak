import { cancelReadsOnExit } from "./readCancellation";
beforeEach(() => window.dispatchEvent(new Event("pageshow")));
test.each(["beforeunload", "pagehide"])(
  "%s cancels in-flight passive reads before document replacement",
  (event) => {
    const controller = new AbortController();
    const cleanup = cancelReadsOnExit(controller);
    expect(controller.signal.aborted).toBe(false);
    window.dispatchEvent(new Event(event));
    expect(controller.signal.aborted).toBe(true);
    cleanup();
  },
);
test("cleanup aborts and removes both navigation listeners", () => {
  const controller = new AbortController();
  const abort = jest.spyOn(controller, "abort");
  const cleanup = cancelReadsOnExit(controller);
  cleanup();
  expect(abort).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("beforeunload"));
  window.dispatchEvent(new Event("pagehide"));
  expect(abort).toHaveBeenCalledTimes(1);
});

test("late deferred reads are cancelled until the document is restored", () => {
  const first = new AbortController();
  const cleanup = cancelReadsOnExit(first);
  window.dispatchEvent(new Event("beforeunload"));
  cleanup();
  const late = new AbortController();
  const endLate = cancelReadsOnExit(late);
  expect(late.signal.aborted).toBe(true);
  endLate();
  window.dispatchEvent(new Event("pageshow"));
  const restored = new AbortController();
  const endRestored = cancelReadsOnExit(restored);
  expect(restored.signal.aborted).toBe(false);
  endRestored();
});
