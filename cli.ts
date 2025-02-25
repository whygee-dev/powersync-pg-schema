import { parse } from "https://deno.land/std@0.193.0/flags/mod.ts";
import { generateSchema } from "./index.ts";

async function cli(): Promise<void> {
  const args = parse(Deno.args) as { [key: string]: string | string[]; _: string[] };
  const pgUrl = (typeof args.pgUrl === "string" && args.pgUrl) || (Array.isArray(args._) && args._[0]) || "";
  if (!pgUrl) {
    console.error("Usage: deno run --allow-net --allow-write --allow-env cli.ts --pgUrl <postgres-url> [--tableFilter <regex>] [--lang <kotlin|ts>]");
    Deno.exit(1);
  }
  const tableFilter = typeof args.tableFilter === "string" ? args.tableFilter : "*";
  const lang = typeof args.lang === "string" ? args.lang.toLowerCase() : "kotlin";

  const schema = await generateSchema(pgUrl, tableFilter, lang as "kt" | "kotlin" | "ts" | "typescript");

  if (lang === "ts" || lang === "typescript") {
    await Deno.writeTextFile("schema.ts", schema);
  } else {
    await Deno.writeTextFile("schema.kt", schema);
  }
}

if (import.meta.main) {
  cli().catch((err) => {
    console.error("Error:", err);
    Deno.exit(1);
  });
}
