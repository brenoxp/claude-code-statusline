import { build, type Plugin } from "esbuild";
import { compile } from "svelte/compiler";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";

// Bake the package version into the bundle so update detection works regardless
// of layout (npm dist/ sibling package.json vs the self-contained plugin bundle
// which ships no package.json next to it).
const packageVersion = JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
).version;

// Force all svelte imports to resolve from our node_modules, using client entry
const svelteDedup: Plugin = {
  name: "svelte-dedup",
  setup(build) {
    build.onResolve({ filter: /^svelte/ }, (args) => {
      // Map bare "svelte" to client entry, subpaths like "svelte/internal/client" resolve normally
      if (args.path === "svelte") {
        return { path: resolve("node_modules/svelte/src/index-client.js") };
      }
      return {
        path: require.resolve(args.path, {
          paths: [resolve("node_modules")],
        }),
      };
    });
  },
};

const sveltePlugin: Plugin = {
  name: "svelte",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, (args) => {
      const source = readFileSync(args.path, "utf8");
      const result = compile(source, {
        filename: args.path,
        generate: "client",
        css: "injected",
        dev: false,
      });
      return {
        contents: result.js.code,
        loader: "js",
        resolveDir: dirname(args.path),
      };
    });
  },
};

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  banner: { js: "#!/usr/bin/env node" },
  target: "esnext",
  minify: true,
  define: { __STATUSLINE_VERSION__: JSON.stringify(packageVersion) },
  conditions: ["browser"],
  plugins: [svelteDedup, sveltePlugin],
  external: [],
});

console.log("Build complete: dist/index.js");
