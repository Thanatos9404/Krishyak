import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/for-farmers",
  "A simpler workspace for your farm",
  "Keep fields, crop seasons and observations together. Explore Today, crop checks, market context and offline field records.",
);
export default function Page() {
  return <PublicPage kind="for-farmers" />;
}
