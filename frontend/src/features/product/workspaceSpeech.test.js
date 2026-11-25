import { farmApi } from "../farms/api";
import { forgetSpeechCapabilities, workspaceSpeech } from "./workspaceSpeech";

jest.mock("../farms/api", () => ({ farmApi: jest.fn() }));

beforeEach(() => {
  forgetSpeechCapabilities();
  farmApi.mockReset();
});

test("every microphone on a screen shares one read of the speech service", async () => {
  farmApi.mockResolvedValue({ configured: true });
  const answers = await Promise.all([
    workspaceSpeech.capabilities(),
    workspaceSpeech.capabilities(new AbortController().signal),
    workspaceSpeech.capabilities(),
  ]);
  expect(answers).toEqual([
    { configured: true },
    { configured: true },
    { configured: true },
  ]);
  await workspaceSpeech.capabilities();
  expect(farmApi).toHaveBeenCalledTimes(1);
});

test("one caller leaving does not cancel the read for the others", async () => {
  let finish;
  farmApi.mockReturnValue(new Promise((resolve) => (finish = resolve)));
  const leaving = new AbortController();
  const first = workspaceSpeech.capabilities(leaving.signal);
  const second = workspaceSpeech.capabilities();
  leaving.abort();
  await expect(first).rejects.toMatchObject({ cancelled: true });
  finish({ configured: true });
  await expect(second).resolves.toEqual({ configured: true });
});

test("a failed read is not remembered", async () => {
  farmApi
    .mockRejectedValueOnce(Object.assign(new Error("down"), { network: true }))
    .mockResolvedValueOnce({ configured: true });
  await expect(workspaceSpeech.capabilities()).rejects.toMatchObject({
    network: true,
  });
  await expect(workspaceSpeech.capabilities()).resolves.toEqual({
    configured: true,
  });
  expect(farmApi).toHaveBeenCalledTimes(2);
});
