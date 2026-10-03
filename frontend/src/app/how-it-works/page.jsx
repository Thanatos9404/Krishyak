import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/how-it-works",
  "How Krishyak works",
  "From a field record to an informed inspection. Learn how observations, crop photos, weather and source-aware evidence stay connected.",
);
export default function Page() {
  return <PublicPage kind="how-it-works" />;
}
