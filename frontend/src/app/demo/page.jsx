import { DemoEntry } from "../../components/product/DemoEntry";
import "../../design/legacy-tools.css";
export const metadata = {
  title: "Example field",
  description:
    "See the Krishyak dashboard for an example wheat field near Jaipur, with real current weather, prices and district records.",
  robots: { index: false, follow: false },
};
export default function DemoPage() {
  return <DemoEntry />;
}
