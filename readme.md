# @oazmi/superbuild-plugins

A suite of plugins for [superbuild](https://github.com/oazmi/superbuild) (which is a wrapper over esbuild)
for static site generation with full code-splitting and code-sharing support.

# Usage Example

```ts
import esbuild from "npm:esbuild"
import { SuperBuild } from "jsr:@oazmi/superbuild@^3.2" // or use "npm:@oazmi/superbuild@^0.3.2".
import { cssPlugin, htmlPlugin, importmetaPlugin } from "jsr:@oazmi/superbuild-plugins" // or use "npm:@oazmi/superbuild-plugins".
// import { denoPlugins } from "@oazmi/esbuild-plugin-deno" // super useful optional resolver and loader plugins!

const spbuild = new SuperBuild(esbuild)
const result = await spbuild.build({
	entryPoints: ["./mod.ts", "./index.html", "./css/styles.css"],
	format: "esm",
	bundle: true,
	splitting: true,
	outdir: "./dist/",
	loader: { ".html": "html" }, // necessary for the html plugin to work on your ".html" resources.
	// ... other build options.
	plugins: [
		// ..denoPlugins(),
		cssPlugin(),
		htmlPlugin(),
		importmetaPlugin(),
	],
})
```
