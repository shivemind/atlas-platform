import { readFileSync } from "fs";
import { resolve } from "path";

const specPath = resolve("openapi/openapi.yaml");

try {
  const content = readFileSync(specPath, "utf-8");

  const errors = [];

  if (!content.includes("openapi:")) {
    errors.push("Missing openapi version field.");
  }
  if (!content.includes("info:")) {
    errors.push("Missing info section.");
  }
  if (!content.includes("paths:")) {
    errors.push("Missing paths section.");
  }

  const opIds = [...content.matchAll(/operationId:\s*(\S+)/g)].map((m) => m[1]);
  const dupes = opIds.filter((id, i) => opIds.indexOf(id) !== i);
  if (dupes.length > 0) {
    errors.push(`Duplicate operationIds: ${[...new Set(dupes)].join(", ")}`);
  }

  const v1Ops = [
    ...content.matchAll(
      /\/api\/v1\/[\s\S]*?security:\s*\n\s*-\s*(\w+)/g,
    ),
  ];
  for (const match of v1Ops) {
    if (match[1] !== "MerchantKeyAuth") {
      errors.push(
        `v1 operation uses ${match[1]} instead of MerchantKeyAuth.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("OpenAPI validation errors:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log("OpenAPI spec is valid.");
} catch (err) {
  console.error(`Failed to read spec: ${err.message}`);
  process.exit(1);
}
