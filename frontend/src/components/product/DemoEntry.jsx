"use client";
import dynamic from "next/dynamic";
const DemoApp = dynamic(() => import("../../features/product/DemoApp"), {
  ssr: false,
  loading: () => (
    <main className="workspace-loading">
      <h1>Example field</h1>
      <p role="status">Opening the example field…</p>
    </main>
  ),
});
export function DemoEntry() {
  return <DemoApp />;
}
