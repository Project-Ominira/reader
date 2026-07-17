#!/usr/bin/env bun
// Regenerates lib/book/schema.generated.ts from schema/book-document.schema.json.
// Run via `bun run schema:generate` whenever the JSON Schema file changes — never by hand.
import path from "node:path";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { jsonSchemaToZod } from "json-schema-to-zod";

const PROJECT_ROOT = process.cwd();
const SCHEMA_PATH = path.join(PROJECT_ROOT, "schema", "book-document.schema.json");
const OUT_PATH = path.join(PROJECT_ROOT, "lib", "book", "schema.generated.ts");

async function main() {
  const resolved = await $RefParser.dereference(SCHEMA_PATH);
  const zodSource = jsonSchemaToZod(resolved as never, {
    name: "BookDocumentSchema",
    type: "BookDocument",
    module: "esm",
    // Section is self-referential (children: Section[]) for arbitrary-depth
    // nesting. json-schema-to-zod can't emit a true z.lazy() cycle from a
    // dereferenced schema, so it unrolls the recursion this many levels deep
    // before falling back to z.any() — comfortably past anything a real
    // book's TOC nests (Part > Chapter is 2 levels; this covers up to 5).
    // JSDoc/describe() are dropped since they'd otherwise duplicate at every
    // unrolled level — this file is generated and never read directly.
    depth: 5,
    withJsdocs: false,
    withoutDescribes: true,
  });

  const banner = `// GENERATED FILE — DO NOT EDIT.
// Source of truth: schema/book-document.schema.json
// Regenerate with: bun run schema:generate
`;

  await Bun.write(OUT_PATH, banner + "\n" + zodSource);
  console.log(`Generated ${path.relative(PROJECT_ROOT, OUT_PATH)} from ${path.relative(PROJECT_ROOT, SCHEMA_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
