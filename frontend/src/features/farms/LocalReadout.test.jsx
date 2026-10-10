import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import LocalReadout, { selectedDeviceVoice } from "./LocalReadout";
import { useProductLocale } from "../product/ProductLocale";
import { workspaceSpeech } from "../product/workspaceSpeech";

jest.mock("../product/ProductLocale", () => ({ useProductLocale: jest.fn() }));
jest.mock("../product/workspaceSpeech", () => ({
  workspaceSpeech: { capabilities: jest.fn(), synthesize: jest.fn() },
}));
const workspace = {
  farmer: { id: "owner-a" },
  selected: "field-a",
  offline: false,
  consents: ["speech_processing"],
};
let voices, cancel, speak;
beforeEach(() => {
  voices = [];
  cancel = jest.fn();
  speak = jest.fn();
  window.speechSynthesis = {
    getVoices: () => voices,
    cancel,
    speak,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  window.SpeechSynthesisUtterance = function (text) {
    this.text = text;
  };
  useProductLocale.mockReturnValue({
    tx: (value) => value,
    language: "hi",
    info: { speechCode: "hi-IN" },
  });
  workspaceSpeech.capabilities.mockResolvedValue({ tts_languages: ["hi"] });
  workspaceSpeech.synthesize.mockReset();
});
afterEach(() => {
  delete window.AudioContext;
});

test("device selection never substitutes English or an unconsented remote voice", () => {
  const english = { localService: true, lang: "en-IN" };
  const remote = { localService: false, lang: "hi-IN" };
  const hindi = { localService: true, lang: "hi-IN" };
  expect(selectedDeviceVoice([english, remote], "hi")).toBeNull();
  expect(selectedDeviceVoice([english, remote, hindi], "hi")).toBe(hindi);
});
test("installed selected-language voice works offline without a provider request", () => {
  voices = [{ localService: true, lang: "hi-IN" }];
  render(
    <LocalReadout
      text="खेत देखें"
      workspace={{ ...workspace, offline: true, consents: [] }}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Read today’s advice aloud" }),
  );
  expect(speak.mock.calls[0][0].lang).toBe("hi-IN");
  expect(speak.mock.calls[0][0].text).toBe("खेत देखें");
  expect(workspaceSpeech.synthesize).not.toHaveBeenCalled();
});
test("missing consent keeps private advice off the speech provider", () => {
  render(
    <LocalReadout
      text="खेत देखें"
      workspace={{ ...workspace, consents: [] }}
    />,
  );
  expect(screen.getByRole("button")).toBeDisabled();
  expect(screen.getByRole("link")).toHaveAttribute(
    "href",
    "/app/more/settings",
  );
  expect(workspaceSpeech.capabilities).not.toHaveBeenCalled();
});
test("withdrawal aborts an in-flight read and prevents late playback", async () => {
  let resolve;
  workspaceSpeech.synthesize.mockReturnValue(
    new Promise((finish) => {
      resolve = finish;
    }),
  );
  const player = { connect: jest.fn(), start: jest.fn(), stop: jest.fn() };
  const audio = {
    resume: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue(),
    decodeAudioData: jest.fn().mockResolvedValue({}),
    createBufferSource: () => player,
  };
  window.AudioContext = jest.fn(() => audio);
  const { rerender } = render(
    <LocalReadout text="खेत देखें" workspace={workspace} />,
  );
  await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(workspaceSpeech.synthesize).toHaveBeenCalled());
  const signal = workspaceSpeech.synthesize.mock.calls[0][2];
  rerender(
    <LocalReadout
      text="खेत देखें"
      workspace={{ ...workspace, consents: [] }}
    />,
  );
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ audios: [btoa("fixture")] }));
  expect(player.start).not.toHaveBeenCalled();
  expect(audio.close).toHaveBeenCalled();
});
test("selected language and quota errors are handled without automatic retries", async () => {
  window.AudioContext = jest.fn(() => ({
    resume: async () => {},
    close: async () => {},
  }));
  workspaceSpeech.synthesize.mockRejectedValue({ status: 429 });
  render(<LocalReadout text="खेत देखें" workspace={workspace} />);
  await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("status");
  expect(workspaceSpeech.synthesize).toHaveBeenCalledTimes(1);
  expect(workspaceSpeech.synthesize.mock.calls[0][1]).toBe("hi");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Speech usage limit reached",
  );
});
