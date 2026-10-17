// Compiles native/render_page.swift once at install time, so requests never
// pay compilation cost — only the ~110-130ms PDFKit render itself, and only
// on a cache miss (see src/lib/pdf/renderNativePage.server.ts).
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binDir = path.join(rootDir, "native", "bin");
const source = path.join(rootDir, "native", "render_page.swift");
const output = path.join(binDir, "render_page");

mkdirSync(binDir, { recursive: true });
execSync(`swiftc -O -o "${output}" "${source}"`, { stdio: "inherit" });
console.log("Compiled native/bin/render_page");
