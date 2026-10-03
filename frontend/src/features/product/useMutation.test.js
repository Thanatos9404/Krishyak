import { renderHook, act } from "@testing-library/react";
import { useMutation } from "./useMutation";
test("concurrent button activation cannot start a second mutation", async () => {
  let resolve;
  const first = jest.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
    second = jest.fn();
  const { result } = renderHook(useMutation);
  let pending;
  act(() => {
    pending = result.current.act(first);
  });
  await act(async () => result.current.act(second));
  expect(second).not.toHaveBeenCalled();
  await act(async () => {
    resolve();
    await pending;
  });
  expect(result.current.busy).toBe(false);
});
test("a failed mutation remains visible and a retry clears the previous error", async () => {
  const { result } = renderHook(useMutation);
  await act(async () =>
    result.current.act(async () => {
      throw new Error("Revision changed. Refresh your field.");
    }),
  );
  expect(result.current.error).toContain("Revision changed");
  await act(async () => result.current.act(async () => {}));
  expect(result.current.error).toBe("");
  expect(result.current.busy).toBe(false);
});
