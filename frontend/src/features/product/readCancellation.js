// Full-document navigation can happen before React runs effect cleanup.
// Cancel passive reads at that boundary as well as on field/account changes.
export function cancelReadsOnExit(controller) {
  const cancel = () => controller.abort();
  window.addEventListener("beforeunload", cancel);
  window.addEventListener("pagehide", cancel);
  return () => {
    cancel();
    window.removeEventListener("beforeunload", cancel);
    window.removeEventListener("pagehide", cancel);
  };
}
