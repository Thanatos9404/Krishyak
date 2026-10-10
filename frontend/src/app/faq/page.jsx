import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/faq",
  "Questions about Krishyak",
  "Plain answers about farm records, crop photographs, satellite observations, offline use, permissions and government-information boundaries.",
);
export default function Page() {
  return <PublicPage kind="faq" />;
}
