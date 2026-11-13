import React from "react";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { VoiceMode } from "./VoiceMode";
import { farmApi } from "../../features/farms/api";
import { workspaceSpeech } from "../../features/product/workspaceSpeech";

jest.mock("../../features/farms/api", () => ({ farmApi: jest.fn() }));
jest.mock("../../features/product/workspaceSpeech", () => ({
  workspaceSpeech: {
    capabilities: jest.fn(),
    transcribe: jest.fn(),
    synthesize: jest.fn(),
  },
}));

const workspace = (overrides = {}) => ({
  farmer: { id: "farmer-a", display_name: "Asha" },
  consents: ["speech_processing"],
  selected: "field-a",
  selectedRef: { current: "field-a" },
  offline: false,
  loadConsents: jest.fn(),
  ...overrides,
});
const typeQuestion = async (text) => {
  fireEvent.click(screen.getByRole("button", { name: /Type instead/ }));
  fireEvent.change(screen.getByLabelText("Type your question"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
};

beforeEach(() => {
  workspaceSpeech.capabilities.mockResolvedValue({
    configured: true,
    stt_languages: ["en", "hi"],
    tts_languages: ["en", "hi"],
  });
  workspaceSpeech.synthesize.mockRejectedValue(new Error("no audio in tests"));
});

test("a typed question is answered with the field and a link to act on it", async () => {
  farmApi.mockResolvedValue({
    answer: "Light rain is likely tomorrow. Wait before spraying.",
    action: "weather",
  });
  render(<VoiceMode workspace={workspace()} onClose={jest.fn()} />);
  expect(
    screen.getByRole("dialog", { name: "Ask Krishyak" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Namaste, Asha! How can I help you today?"),
  ).toBeInTheDocument();
  await typeQuestion("Will it rain?");
  expect(
    await screen.findByText(
      "Light rain is likely tomorrow. Wait before spraying.",
    ),
  ).toBeInTheDocument();
  const [path, options] = farmApi.mock.calls[0];
  expect(path).toBe("/assistant/ask");
  expect(options.body).toEqual({
    question: "Will it rain?",
    language: "en",
    plot_id: "field-a",
    history: [],
  });
  expect(screen.getByRole("link", { name: /See weather/ })).toHaveAttribute(
    "href",
    "/app/today#weather",
  );
});

test("follow-up questions carry the earlier turns", async () => {
  farmApi
    .mockResolvedValueOnce({
      answer: "Wheat is ₹2,450 at Chomu.",
      action: "market",
    })
    .mockResolvedValueOnce({ answer: "It went up a little.", action: "none" });
  render(<VoiceMode workspace={workspace()} onClose={jest.fn()} />);
  await typeQuestion("Wheat price?");
  await screen.findByText("Wheat is ₹2,450 at Chomu.");
  fireEvent.change(screen.getByLabelText("Type your question"), {
    target: { value: "Is it rising?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
  await screen.findByText("It went up a little.");
  expect(farmApi.mock.calls[1][1].body.history).toEqual([
    { role: "farmer", text: "Wheat price?" },
    { role: "assistant", text: "Wheat is ₹2,450 at Chomu." },
  ]);
});

test("voice help asks for permission before anything is sent", async () => {
  const w = workspace({ consents: [] });
  farmApi.mockResolvedValue({});
  render(<VoiceMode workspace={w} onClose={jest.fn()} />);
  expect(
    screen.getByRole("heading", { name: "Allow voice help" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tap to speak" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Allow and start" }));
  await waitFor(() => expect(w.loadConsents).toHaveBeenCalled());
  expect(farmApi).toHaveBeenCalledWith("/consents", {
    method: "POST",
    body: {
      purpose: "speech_processing",
      granted: true,
      policy_version: "2026-10-03",
    },
  });
});

test("limits and outages are explained in plain words", async () => {
  const limit = Object.assign(new Error("limit"), { status: 429 });
  farmApi.mockRejectedValueOnce(limit);
  render(<VoiceMode workspace={workspace()} onClose={jest.fn()} />);
  await typeQuestion("Price?");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "You have asked many questions. Please wait a little and try again.",
  );
});

test("offline farmers are told voice needs the internet", () => {
  render(
    <VoiceMode workspace={workspace({ offline: true })} onClose={jest.fn()} />,
  );
  expect(
    screen.getByText("You are offline. Voice help needs the internet."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tap to speak" })).toBeNull();
});

test("Escape closes voice mode", () => {
  const onClose = jest.fn();
  render(<VoiceMode workspace={workspace()} onClose={onClose} />);
  act(() => {
    fireEvent.keyDown(window, { key: "Escape" });
  });
  expect(onClose).toHaveBeenCalled();
});
