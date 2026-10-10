import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import { act } from "react";
import {
  voiceValue,
  voiceDigits,
  applyVoiceValue,
  voiceEligible,
} from "./voiceValues";

test("all workspace numeral scripts normalize without converting units", () => {
  expect(voiceDigits("۱۲ ३४ ৫৬ ૭૮ ੯੦ ೧೨ ௩௪ ౫౬ ൭൮")).toBe(
    "12 34 56 78 90 12 34 56 78",
  );
  expect(voiceDigits("୧୨ ᱓᱔ ꯵꯶")).toBe("12 34 56");
  const input = document.createElement("input");
  input.type = "number";
  expect(voiceValue("२.५", input, "hi-IN")).toBe("2.5");
  expect(voiceValue("दो", input, "hi-IN")).toBe("2");
  expect(voiceValue("2.", input)).toBe("2");
  expect(voiceValue("two acres", input)).toBeNull();
  expect(voiceValue("2 and 3", input)).toBeNull();
});
test("choice labels require an exact unique match and preserve choice identity", () => {
  const select = document.createElement("select");
  select.innerHTML =
    '<option value="">Choose</option><option value="wheat">गेहूँ</option><option value="tomato">ٹماٹر</option>';
  expect(voiceValue("ٹماٹر", select, "ur-IN")).toBe("tomato");
  expect(voiceValue("गेहूँ।", select, "hi-IN")).toBe("wheat");
  expect(voiceValue("Choose", select)).toBeNull();
  select.add(new Option("गेहूँ", "other"));
  expect(voiceValue("गेहूँ", select)).toBeNull();
});
test("dates validate leap years and reject ambiguous extra words", () => {
  const input = document.createElement("input");
  input.type = "date";
  expect(voiceValue("२९ फ़रवरी २०२४", input, "hi-IN")).toBe("2024-02-29");
  expect(voiceValue("2025-02-29", input)).toBeNull();
  expect(voiceValue("31 March 2026", input)).toBe("2026-03-31");
  expect(voiceValue("maybe May 1 2026", input)).toBeNull();
});
test("reviewed text updates a React controlled field without submitting", () => {
  const submit = jest.fn();
  function Form() {
    const [value, setValue] = useState("");
    return (
      <form onSubmit={submit}>
        <label>
          Name
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <output>{value}</output>
      </form>
    );
  }
  render(<Form />);
  const input = screen.getByLabelText("Name");
  act(() => expect(applyVoiceValue(input, "किसान")).toBe(true));
  expect(screen.getByText("किसान").textContent).toBe("किसान");
  expect(submit).not.toHaveBeenCalled();
  input.disabled = true;
  expect(applyVoiceValue(input, "other")).toBe(false);
});
test("credentials and disconnected controls never receive dictation", () => {
  const input = document.createElement("input");
  input.type = "password";
  expect(voiceEligible(input)).toBe(false);
  input.type = "text";
  input.autocomplete = "one-time-code";
  expect(voiceEligible(input)).toBe(false);
  input.autocomplete = "";
  expect(applyVoiceValue(input, "123456")).toBe(false);
});
