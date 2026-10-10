import { cp } from "node:fs/promises";
import { spawn } from "node:child_process";

// The standalone server needs the public directory and immutable Next assets.
await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: process.env.PORT || "3000" },
});
child.on("exit", code => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
