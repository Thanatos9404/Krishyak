export function deviceSession(action, value) {
  try {
    if (action === "get")
      return JSON.parse(sessionStorage.getItem("krishyak_v2_offline_owner"));
    if (action === "clear") {
      sessionStorage.removeItem("krishyak_v2_offline_owner");
      sessionStorage.removeItem("krishyak_v2_field_choice");
    }
    if (action === "set")
      sessionStorage.setItem(
        "krishyak_v2_offline_owner",
        JSON.stringify(value),
      );
  } catch {
    /* Offline opt-in reports storage failures through IndexedDB. */
  }
  return null;
}

export function fieldChoice(owner, field) {
  try {
    if (field)
      sessionStorage.setItem(
        "krishyak_v2_field_choice",
        JSON.stringify({ owner, field }),
      );
    const saved = JSON.parse(
      sessionStorage.getItem("krishyak_v2_field_choice"),
    );
    return saved?.owner === owner ? saved.field : null;
  } catch {
    return null;
  }
}
