"use client";
import dynamic from "next/dynamic";
const DemoApp = dynamic(() => import("../../features/product/DemoApp"), {
  ssr: false,
  loading: () => (
    <main className="workspace-loading">
      <h1>Explore the farm experience</h1>
      <p role="status">Opening the illustrative demo…</p>
    </main>
  ),
});
export function DemoEntry() {
  return <DemoApp />;
}
