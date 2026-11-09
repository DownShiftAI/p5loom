// Metadata for the example specs in examples/. The catalog lives in examples/catalog.json, so the website and the MCP
// server read the same titles. The build copies each spec to /examples/<id>.json and writes /examples/index.json.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const EXAMPLES = JSON.parse(readFileSync(join(here, "..", "examples", "catalog.json"), "utf8"));
