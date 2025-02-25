import { build, emptyDir } from "https://deno.land/x/dnt@0.33.0/mod.ts";

await emptyDir("./npm");
await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  typeCheck: false,
  compilerOptions: {
    lib: ["dom", "dom.iterable", "esnext"],
  },
  shims: { deno: true }, // add shim for Deno globals
  package: {
    name: "powersync-pg-schema",
    version: "0.0.2",
    description: "Generate a schema from a PostgreSQL database for Powersync",
    repository: {
      type: "git",
      url: "https://github.com/whygee-dev/powersync-pg-schema",
    },
    license: "MIT",
  },
});
