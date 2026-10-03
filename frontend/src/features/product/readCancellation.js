// Full-document navigation can happen before React runs effect cleanup.
// Cancel passive reads at that boundary as well as on field/account changes.
let leavingDocument = false;
let lifecycleInstalled = false;
export function cancelReadsOnExit(controller) {
  if (!lifecycleInstalled) {
    lifecycleInstalled = true;
    const leaving = () => {
      leavingDocument = true;
    };
    window.addEventListener("beforeunload", leaving);
    window.addEventListener("pagehide", leaving);
    window.addEventListener("pageshow", () => {
      leavingDocument = false;
    });
  }
  // A deferred view may finish loading after beforeunload. It must not start
  // another read into the document that is already being replaced.
  if (leavingDocument) controller.abort();
  const cancel = () => controller.abort();
  window.addEventListener("beforeunload", cancel);
  window.addEventListener("pagehide", cancel);
  return () => {
    cancel();
    window.removeEventListener("beforeunload", cancel);
    window.removeEventListener("pagehide", cancel);
  };
}
