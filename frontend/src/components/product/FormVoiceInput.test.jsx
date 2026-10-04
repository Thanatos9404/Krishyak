import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FormVoiceInput } from "./FormVoiceInput";
import useSarvamRecognition from "../../hooks/useSarvamRecognition";

jest.mock("../../hooks/useSarvamRecognition", () => ({
  __esModule: true,
  default: jest.fn(),
}));
const reset = jest.fn();
const workspace = {
  farmer: { id: "test-owner" },
  consents: [],
  offline: false,
};
let engines;
beforeEach(() => {
  engines = [];
  window.SpeechRecognition = class {
    constructor() {
      engines.push(this);
    }
    start = jest.fn();
    stop = jest.fn();
    abort = jest.fn();
  };
  useSarvamRecognition.mockReturnValue({
    resetTranscript: reset,
    isSupported: false,
    status: "idle",
    transcript: "",
  });
});
afterEach(() => {
  delete window.SpeechRecognition;
  document
    .querySelectorAll("[data-test-form]")
    .forEach((form) => form.remove());
});
function inputInForm(dialog = false) {
  const container = document.createElement(dialog ? "dialog" : "form");
  container.dataset.testForm = "true";
  if (dialog) container.setAttribute("open", "");
  container.innerHTML = dialog
    ? '<div class="dialog-body"><label>Field name<input /></label></div>'
    : "<label>Field name<input /></label><label>Other<input /></label>";
  document.body.append(container);
  return container;
}
test("voice transcription is a reviewed draft until the farmer applies it and does not submit", () => {
  const form = inputInForm();
  const input = form.querySelector("input");
  const submit = jest.fn();
  form.addEventListener("submit", submit);
  render(<FormVoiceInput target={input} workspace={workspace} />);
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  expect(engines[0].lang).toBe("en-IN");
  act(() => {
    engines[0].onresult({ results: [[{ transcript: "Wheat field" }]] });
    engines[0].onend();
  });
  expect(input.value).toBe("");
  expect(screen.getByLabelText("Review spoken text").value).toBe("Wheat field");
  fireEvent.click(screen.getByRole("button", { name: "Use this value" }));
  expect(input.value).toBe("Wheat field");
  expect(submit).not.toHaveBeenCalled();
});
test("switching form targets stops recording and ignores the old result", () => {
  const form = inputInForm();
  const inputs = form.querySelectorAll("input");
  const { rerender } = render(
    <FormVoiceInput target={inputs[0]} workspace={workspace} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  rerender(<FormVoiceInput target={inputs[1]} workspace={workspace} />);
  expect(engines[0].abort).toHaveBeenCalled();
  act(() => {
    engines[0].onresult({ results: [[{ transcript: "Wrong field" }]] });
  });
  expect(screen.queryByLabelText("Review spoken text")).toBeNull();
  expect(inputs[1].value).toBe("");
});
test("field dialog contains its own voice review controls and unmount releases recognition", () => {
  const dialog = inputInForm(true);
  const { unmount } = render(
    <FormVoiceInput
      target={dialog.querySelector("input")}
      workspace={workspace}
    />,
  );
  expect(dialog.querySelector(".dialog-body .form-voice-entry")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  unmount();
  expect(engines[0].abort).toHaveBeenCalled();
});
test("closing a form outside the voice component stops the recording", async () => {
  const form = inputInForm();
  render(
    <FormVoiceInput
      target={form.querySelector("input")}
      workspace={workspace}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Speak" }));
  await act(async () => form.remove());
  expect(engines[0].abort).toHaveBeenCalled();
});
