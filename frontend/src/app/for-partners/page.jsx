import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/for-partners",
  "Pilot infrastructure for FPOs and agronomists",
  "Explore consent-based field cohorts, source-aware evidence, institution access and the validation a responsible agricultural pilot needs.",
);
export default function Page() {
  return <PublicPage kind="for-partners" />;
}
