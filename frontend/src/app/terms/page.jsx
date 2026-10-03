import { LegalPage } from "../../components/public/LegalPage";
import { pageMetadata } from "../../lib/seo";

export const metadata = pageMetadata(
  "/terms",
  "Product terms and evidence limits",
  "Understand farm-decision support, model uncertainty, simulations, demonstration data and official-verification limits before using Krishyak.",
);
export default function Page() {
  return <LegalPage kind="terms" />;
}
