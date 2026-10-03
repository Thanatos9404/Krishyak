// Explicit development step. Builds and language selection never translate.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { parse } = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const directories = ["src/components/product", "src/features/product", "src/features/farms"];
const records = new Map();
const human = (value) => /[A-Za-z]/.test(value) &&
  !value.includes("SameSite=") &&
  /[A-Z]/.test(value) && !/^;/.test(value) && !/^(\d{4}-\d{2}-\d{2}T|\{\{v\d+\}\}T\d)/.test(value) &&
  !/^(\/|\.\.\/|https?:)/.test(value) && !value.includes("${") &&
  !/^[a-z][\w.-]*$/.test(value) && !/^#[\da-f]+$/i.test(value) &&
  !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|Content-Type|X-CSRF-Token|SameSite|UTF-8)$/.test(value);
const cleanText = (value) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" ");
function collect(value, file, line, kind, force = false) {
  const text = cleanText(value);
  if (!text || (!force && !human(text))) return;
  const entry = records.get(text) || { source: text, sha256: createHash("sha256").update(text).digest("hex"), references: [] };
  entry.references.push({ file, line, kind });
  records.set(text, entry);
}
for (const directory of directories) {
  for (const name of fs.readdirSync(path.join(root, "frontend", directory)).sort()) {
    if (!/\.(js|jsx)$/.test(name) || /\.test\./.test(name) || name === "strings.js") continue;
    const file = `${directory}/${name}`;
    const ast = parse(fs.readFileSync(path.join(root, "frontend", file), "utf8"), { sourceType: "module", plugins: ["jsx"] });
    traverse(ast, {
      StringLiteral({ node, parent }) {
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(parent.type)) return;
        if (parent.type === "JSXAttribute" && !["aria-label", "placeholder", "title", "alt", "label"].includes(parent.name.name)) return;
        collect(node.value, file, node.loc.start.line, "literal", parent.type === "CallExpression" && parent.callee.name === "tx");
      },
      JSXText({ node }) { collect(node.value, file, node.loc.start.line, "jsx", /[A-Za-z]/.test(node.value)); },
      TemplateLiteral({ node }) {
        const text = node.quasis.map((part, index) => part.value.cooked + (index < node.expressions.length ? `{{v${index}}}` : "")).join("");
        collect(text, file, node.loc.start.line, "template");
      },
    });
  }
}
const serverInventory = path.join(root, "docs/release/SERVER_STRING_INVENTORY.json");
if (fs.existsSync(serverInventory))
  for (const row of JSON.parse(fs.readFileSync(serverInventory, "utf8"))) collect(row.source, row.file, row.line, "server");
const entries = [...records.values()].sort((a, b) => a.source.localeCompare(b.source, "en"));
const destination = path.join(root, "frontend/src/features/product/locales");
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, "en.json"), JSON.stringify(Object.fromEntries(entries.map(({ source }) => [source, source])), null, 2) + "\n");
fs.writeFileSync(path.join(destination, "version.json"), JSON.stringify({ source_sha256: createHash("sha256").update(fs.readFileSync(path.join(destination, "en.json"))).digest("hex") }, null, 2) + "\n");
fs.writeFileSync(path.join(root, "docs/release/WORKSPACE_STRING_MANIFEST.json"), JSON.stringify({ extractor: "Babel AST; literals, JSX text, positional template placeholders", source_strings: entries.length, strings: entries }, null, 2) + "\n");
console.log(JSON.stringify({ strings: entries.length, characters: entries.reduce((sum, row) => sum + row.source.length, 0), source: "frontend/src/features/product/locales/en.json" }));
