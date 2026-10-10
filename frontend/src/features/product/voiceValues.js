// Voice produces a draft only. Never guess a choice or submit a form.
export function voiceDigits(value) {
  const zeroes = [
    0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66,
    0x1c50, 0xabf0,
  ];
  return Array.from(String(value).normalize("NFKC"), (char) => {
    const code = char.codePointAt(0);
    const zero = zeroes.find((start) => code >= start && code <= start + 9);
    return zero === undefined ? char : String(code - zero);
  }).join("");
}
const normalized = (value) =>
  voiceDigits(value)
    .trim()
    .toLocaleLowerCase()
    .replace(/[।.!?]+$/u, "")
    .trim();
export function voiceValue(text, target, locale = "en-IN") {
  const spoken = voiceDigits(text).trim();
  if (!spoken) return null;
  if (target.tagName === "SELECT") {
    const matches = Array.from(target.options).filter(
      (option) =>
        !option.disabled &&
        option.value &&
        normalized(option.textContent) === normalized(spoken),
    );
    return matches.length === 1 ? matches[0].value : null;
  }
  const type = target.type;
  if (type === "number" || target.inputMode === "numeric") {
    const words = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
      half: 0.5,
      एक: 1,
      दो: 2,
      तीन: 3,
      चार: 4,
      पांच: 5,
      पाँच: 5,
      छह: 6,
      सात: 7,
      आठ: 8,
      नौ: 9,
      दस: 10,
      डेढ़: 1.5,
      ढाई: 2.5,
    };
    if (Object.hasOwn(words, normalized(spoken)))
      return String(words[normalized(spoken)]);
    // Units belong to the selected form field. Ambiguous units require correction.
    if (!/^[+-]?\d+(?:[.,]\d+)?[।.!?]?$/u.test(spoken)) return null;
    return spoken.replace(/[,]/g, ".").replace(/[।.!?]$/u, "");
  }
  if (type === "date") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(spoken)) {
      const date = new Date(`${spoken}T12:00:00Z`);
      return Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === spoken
        ? spoken
        : null;
    }
    const year = spoken.match(/\b(20\d{2}|19\d{2})\b/);
    if (!year) return null;
    const rest = spoken.replace(year[0], "");
    const days = rest.match(/\d+/g);
    if (days?.length !== 1) return null;
    const day = Number(days[0]);
    const months = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(Date.UTC(2020, month, 15));
      const names = [locale, "en-IN"].flatMap((language) =>
        ["long", "short"].map((style) =>
          new Intl.DateTimeFormat(language, {
            month: style,
            timeZone: "UTC",
          }).format(date),
        ),
      );
      if (
        names.some(
          (name) =>
            normalized(rest.replace(days[0], "")).replace(/[,]/g, "").trim() ===
            normalized(name),
        )
      )
        months.push(month + 1);
    }
    if (months.length !== 1) return null;
    const iso = `${year[0]}-${String(months[0]).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(`${iso}T12:00:00Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === iso
      ? iso
      : null;
  }
  return spoken.slice(0, target.maxLength > 0 ? target.maxLength : 2000);
}
export function voiceEligible(target) {
  return (
    target?.matches?.("input, textarea, select") &&
    !target.disabled &&
    !target.readOnly &&
    !target.closest("[data-voice-controls]") &&
    ![
      "password",
      "hidden",
      "file",
      "checkbox",
      "radio",
      "range",
      "submit",
      "button",
    ].includes(target.type) &&
    target.autocomplete !== "one-time-code" &&
    target.type !== "tel"
  );
}
export function applyVoiceValue(target, value) {
  if (!target.isConnected || !voiceEligible(target)) return false;
  const prototype =
    target.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : target.tagName === "SELECT"
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(target, value);
  if (target.tagName !== "SELECT")
    target.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: String(value),
      }),
    );
  target.dispatchEvent(new Event("change", { bubbles: true }));
  target.focus();
  return true;
}
