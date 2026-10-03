"""Crawl the public SSR pages and record internal links, schemas and asset status.

Uses only stdlib; never signs in, reads account data or submits forms.
"""
import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen

ROUTES = ["/", "/how-it-works", "/technology", "/for-farmers", "/for-partners", "/about", "/faq", "/privacy", "/terms"]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.assets, self.schemas, self.headings = [], [], [], []
        self.schema_buffer = None
        self.h1_count = 0
        self.canonical = None
        self.description = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"])
        if tag == "img":
            assert "alt" in attributes, "Image is missing its alternative description"
            assert attributes.get("width") and attributes.get("height"), "Image dimensions missing"
            self.assets.append(attributes["src"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "link" and attributes.get("rel") == "canonical":
            self.canonical = attributes.get("href")
        if tag == "meta" and attributes.get("name") == "description":
            self.description = attributes.get("content")
        if tag == "script" and attributes.get("type") == "application/ld+json":
            assert attributes.get("nonce"), "Schema script must carry CSP nonce"
            self.schema_buffer = ""

    def handle_data(self, data):
        if self.schema_buffer is not None:
            self.schema_buffer += data

    def handle_endtag(self, tag):
        if tag == "script" and self.schema_buffer is not None:
            self.schemas.append(json.loads(self.schema_buffer))
            self.schema_buffer = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="http://localhost:3000")
    parser.add_argument("--output", default="output/product/crawl.json")
    options = parser.parse_args()
    checked, pages, inbound = {}, [], set()
    for route in ROUTES:
        with urlopen(urljoin(options.origin, route), timeout=20) as response:
            body = response.read().decode("utf-8")
            assert response.status == 200
            page = Page()
            page.feed(body)
            assert page.h1_count == 1, f"{route} needs exactly one H1"
            assert page.canonical and page.description and page.schemas, f"{route} SEO missing"
            for href in page.links + page.assets:
                parsed = urlparse(href)
                if parsed.scheme or parsed.netloc or not href.startswith("/"):
                    continue
                relative = parsed.path
                if href in page.links:
                    inbound.add(relative)
                if relative not in checked:
                    with urlopen(urljoin(options.origin, relative), timeout=20) as linked:
                        assert linked.status == 200, relative
                        checked[relative] = linked.status
            pages.append({"path": route, "html_bytes": len(body.encode()), "h1_count": page.h1_count, "canonical": page.canonical, "description": page.description, "schema_types": [schema.get("@type") for schema in page.schemas], "links": page.links})
    assert set(ROUTES).issubset(inbound), f"Orphan pages: {set(ROUTES) - inbound}"
    destination = Path(options.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({"origin": options.origin, "public_pages": pages, "checked_internal_resources": checked, "orphan_pages": []}, indent=2), encoding="utf-8")
    print(f"PASS: {len(pages)} SSR pages, {len(checked)} internal resources, no public orphans")


if __name__ == "__main__":
    main()
