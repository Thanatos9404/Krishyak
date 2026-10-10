import { PublicPage } from "../../components/public/PublicPages";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/about",
  "The story behind Krishyak",
  "Meet the developer behind Krishyak and understand how farm simulations became a connected, evidence-first field workspace.",
);
export default function Page() {
  return <PublicPage kind="about" />;
}
