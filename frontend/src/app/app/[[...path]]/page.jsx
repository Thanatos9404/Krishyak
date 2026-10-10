import { notFound } from "next/navigation";
import { PrivateEntry } from "../../../components/product/PrivateEntry";
const ALLOWED = new Set([
  "today",
  "farm",
  "health",
  "market",
  "more",
  "more/settings",
  "more/planning",
  "more/benefits",
]);
export const metadata = {
  title: "Farm workspace",
  description: "Private farm records and source-aware field context.",
  robots: { index: false, follow: false },
};
export default async function WorkspacePage({ params }) {
  const { path } = await params;
  const route = (path || []).join("/");
  if (!ALLOWED.has(route) && !/^farm\/[a-f0-9-]{36}$/.test(route)) notFound();
  return <PrivateEntry />;
}
