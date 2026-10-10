import {
  breadcrumbSchema,
  canonical,
  pageMetadata,
  PUBLIC_ROUTES,
} from "./seo";
test("canonicals use the verified production domain and strip trailing slashes", () => {
  expect(canonical("/")).toBe("https://krishyak.vercel.app");
  expect(canonical("/about/")).toBe("https://krishyak.vercel.app/about");
  expect(() => canonical("//other.example")).toThrow();
  expect(() => canonical("https://other.example")).toThrow();
});
test("public metadata has an absolute branded title and private pages remain excluded", () => {
  const result = pageMetadata(
    "/about",
    "Our story",
    "Useful account of this publicly documented project.",
  );
  expect(result.title.absolute).toBe("Our story | Krishyak");
  expect(result.robots).toEqual({ index: true, follow: true });
  expect(
    pageMetadata("/demo", "Example farm", "Synthetic.", false).robots.index,
  ).toBe(false);
  expect(PUBLIC_ROUTES).toHaveLength(9);
  expect(PUBLIC_ROUTES).not.toContain("/demo");
});
test("breadcrumbs are ordered, canonical and correspond to visible navigation", () => {
  const schema = breadcrumbSchema([
    { name: "Technology", href: "/technology" },
  ]);
  expect(
    schema.itemListElement.map((item) => [item.position, item.name, item.item]),
  ).toEqual([
    [1, "Home", "https://krishyak.vercel.app"],
    [2, "Technology", "https://krishyak.vercel.app/technology"],
  ]);
});
