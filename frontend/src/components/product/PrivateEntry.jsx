"use client";
import dynamic from "next/dynamic";
const ProductApp = dynamic(() => import("../../features/product/ProductApp"), {
  ssr: false,
  loading: () => (
    <main className="workspace-loading" id="workspace-content">
      <h1>Your farm workspace</h1>
      <p role="status">Opening Krishyak…</p>
      <a href="/">Back to website</a>
    </main>
  ),
});
export function PrivateEntry() {
  return <ProductApp />;
}
