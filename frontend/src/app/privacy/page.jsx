import { LegalPage } from "../../components/public/LegalPage";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/privacy",
  "Privacy and your farm records",
  "Read the implemented account, consent, private-photo, offline-storage, export and deletion controls, with draft policy and legal-review status.",
);
export default function Page() {
  return <LegalPage kind="privacy" />;
}
