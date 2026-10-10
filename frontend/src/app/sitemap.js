import { PUBLIC_ROUTES, canonical } from "../lib/seo";

export default function sitemap() {
  return PUBLIC_ROUTES.map((path) => ({ url: canonical(path) }));
}
