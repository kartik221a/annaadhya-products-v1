/**
 * Generates the self-contained deployable entry for Vercel.
 *
 * Bundles dist/src/boot.js (compiled NestJS bootstrap) plus the entire app graph
 * into ONE CommonJS file at src/.generated-main.js, which src/main.ts loads.
 * The platform's function bundler therefore only has to handle relative imports
 * and node builtins — no bare-specifier resolution, which it cannot do reliably
 * in this pnpm workspace.
 *
 * Externals: the Firebase/Google stack. firebase-admin lazily loads .proto and
 * other data files from disk inside node_modules, so it must stay a runtime
 * require; the platform's file tracer includes those files from the hoisted
 * (real-file) node_modules produced by node-linker=hoisted in .npmrc.
 *
 * Run AFTER `pnpm run build` (needs dist/). Invoked from vercel.json buildCommand.
 */
import { rolldown } from "rolldown";

const EXTERNAL = [
  /^firebase-admin(\/.+)?$/,
  /^@google-cloud\//,
  /^google-gax(\/.+)?$/,
  /^@grpc\//,
  /^google-auth-library(\/.+)?$/,
  /^googleapis-common(\/.+)?$/,
  /^gaxios(\/.+)?$/,
  /^gtoken(\/.+)?$/,
];

const bundle = await rolldown({
  input: new URL("../dist/src/boot.js", import.meta.url).pathname,
  platform: "node",
  external: (id) => EXTERNAL.some((re) => re.test(id)),
});

const result = await bundle.write({
  file: new URL("../src/.generated-main.js", import.meta.url).pathname,
  format: "cjs",
  inlineDynamicImports: true,
  exports: "auto",
});

const files = result.output.map((o) => `${o.fileName}`).join(", ");
console.log(`[bundle-vercel] wrote src/.generated-main.js (${files})`);
