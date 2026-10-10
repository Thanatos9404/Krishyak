import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir(resolve("public/map"), { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(resolve("node_modules/maplibre-gl/dist", name), resolve("public/map", name));
}
