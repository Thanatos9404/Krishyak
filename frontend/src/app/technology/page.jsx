import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/technology",
  "The evidence behind Krishyak",
  "Understand Sentinel-2 trends, sourced weather and soil records, crop-photo model limitations, ownership and purpose-based permissions.",
);
export default function Page() {
  return <PublicPage kind="technology" />;
}
