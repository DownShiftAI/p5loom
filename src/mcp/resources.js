// MCP resources: documents a client can read. The reference, the spec's JSON Schema and each example spec. Read-only,
// and nothing here reads a path from the request: a resource is found by its URI in a fixed list.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REFERENCE } from "./tools.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "..", "..");
const CATALOG = JSON.parse(readFileSync(join(ROOT, "examples", "catalog.json"), "utf8"));
const SCHEMA_TEXT = readFileSync(join(ROOT, "schema", "p5loom-spec-1.schema.json"), "utf8");

export class ResourceError extends Error {
  constructor(message) {
    super(message);
    this.code = -32002; // the MCP code for "resource not found"
  }
}

export function listResources() {
  return [
    { uri: "p5loom://reference", name: "Spec reference", description: "The p5loom spec format in one page.", mimeType: "text/markdown" },
    { uri: "p5loom://schema", name: "Spec JSON Schema", description: "JSON Schema (draft 2020-12) for version 1 specs.", mimeType: "application/schema+json" },
    ...CATALOG.map((e) => ({
      uri: `p5loom://examples/${e.id}`,
      name: e.title,
      description: e.summary,
      mimeType: "application/json",
    })),
  ];
}

export function readResource(uri) {
  if (typeof uri !== "string") throw new ResourceError("uri: a string");
  if (uri === "p5loom://reference") return { uri, mimeType: "text/markdown", text: REFERENCE };
  if (uri === "p5loom://schema") return { uri, mimeType: "application/schema+json", text: SCHEMA_TEXT };
  const m = /^p5loom:\/\/examples\/([a-z0-9-]{1,64})$/.exec(uri);
  if (m && CATALOG.some((e) => e.id === m[1])) {
    return { uri, mimeType: "application/json", text: readFileSync(join(ROOT, "examples", `${m[1]}.json`), "utf8") };
  }
  throw new ResourceError(`no resource at ${uri}`);
}
