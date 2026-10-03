import { DemoEntry } from "../../components/product/DemoEntry";
import "../../design/legacy-tools.css";
export const metadata = {
  title: "Illustrative farm demo",
  description: "Explore a clearly marked example farm without an account.",
  robots: { index: false, follow: false },
};
export default function DemoPage() {
  return <DemoEntry />;
}
