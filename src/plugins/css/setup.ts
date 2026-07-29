/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/

import type { EsbuildPlugin, EsbuildPluginBuild, ImportedEntity, ImportEntity, OnEmitOptions, OnTransformArgs, OnTransformOptions, Require, SuperPluginBuild, SuperPluginSetup } from "../../deps.ts"
import { INNER_PLUGIN_BUILD } from "../../deps.ts"
import type { EsbuildWarningsAndErrors } from "../../typedefs.ts"


/** setup configuration options for the {@link cssPluginSetup}.
 *
 * @defaultValue {@link defaultCssPluginSetupConfig}.
*/
export interface CssPluginSetupConfig {
	/** specify which loaded files/resoruces will need to be intercepted by the css plugin.
	 *
	 * @defaultValue `{ filter: new RegExp(".*"), loader: "css", namespace: undefined }`
	*/
	transformFilter?: Require<OnTransformOptions, "loader">
}

/** the default configuration for {@link cssPluginSetup}. */
export const defaultCssPluginSetupConfig: Required<CssPluginSetupConfig> = {
	// TODO: also include "local-css" loader separately.
	transformFilter: { filter: /.*/, loader: "css", namespace: undefined },
}

/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it. */
export const cssPluginSetup = (config?: CssPluginSetupConfig): SuperPluginSetup => {
	return (build: SuperPluginBuild) => cssPluginSetupBase(build, config)
}

const cssPluginSetupBase = (build: SuperPluginBuild, config?: CssPluginSetupConfig): ReturnType<SuperPluginSetup> => {
	const
		{ transformFilter } = { ...defaultCssPluginSetupConfig, ...config },
		emitFilter: OnEmitOptions = { filter: /.*/, inputs: [transformFilter] }

	build.onTransform(transformFilter, async (args) => {
		const
			{ loader, ...rest_args } = args,
			{ contents, imports, warnings, errors } = await extractCssDeps(build, { ...rest_args, loader: loader as "css" | "local-css" })
		return { loader: "copy", contents, imports, warnings, errors }
	})

	const ALREADY_CAPTURED = Symbol()

	build.onEmit(emitFilter, async (args) => {
		if (args.reEmitData?.[ALREADY_CAPTURED]) { return }
		const imported_entities = args.imports.map((imported_entity): ImportedEntity<number> => {
			const
				{ key: _key, initialPath, outputPath, external: _external, ...rest_props } = imported_entity,
				key = _key as number,
				// external MUST be set to true so that my `rerouteImports` method does not try to compute the relative path between the old path and the new path.
				// our purpose for using `rerouteImports` is to select and replace the `CSS_IMPORT:${number}` imports with the original `initialPath`.
				external = true,
				select_initialPath = `${css_dependency_path_prefix}${key}`,
				replace_outputPath = initialPath ?? outputPath
			return { key, initialPath: select_initialPath, outputPath: replace_outputPath, external, ...rest_props }
		})
		const
			new_args: typeof args = { ...args, imports: imported_entities },
			result = await build.rerouteImports(new_args, "css"),
			reEmitData = (args.reEmitData ?? {})
		reEmitData[ALREADY_CAPTURED] = true
		return { ...result, reEmit: true, reEmitData }
	})
}

type CssDependency = Pick<ImportEntity<number>, "key" | "path" | "kind">

interface ExtractCssDepsResult extends Required<EsbuildWarningsAndErrors> {
	contents: Uint8Array<ArrayBuffer>
	imports: Array<CssDependency>
}

const css_dependency_path_prefix = `CSS_IMPORT:`

const extractCssDepsPluginSetupFactory = (
	all_imports: Array<CssDependency>,
	build: EsbuildPluginBuild,
) => {
	let key_counter: number = 0
	build.onResolve({ filter: /.*/ }, (args) => {
		const { kind, path } = args
		// we do not intercept nor process the entry-point entity. only imported entities get their paths processed.
		if (kind === "entry-point") { return }
		const
			key = key_counter++,
			new_path = `${css_dependency_path_prefix}${key}`
		all_imports.push({ key, kind, path })
		// we can't use the `"file"` namespace, as esbuild will complain about the path not being a local file path,
		// even though `external` is set to `true`.
		return { path: new_path, namespace: "discard-this", external: true }
	})
}

const extractCssDeps = async (
	build: SuperPluginBuild | EsbuildPluginBuild,
	args: Pick<
		OnTransformArgs,
		| "contents" | "loader" | "namespace" | "path" | "resolveDir"
	> & { loader: "css" | "local-css" },
): Promise<ExtractCssDepsResult> => {
	const
		{ absWorkingDir, nodePaths, alias } = build.initialOptions,
		{ path, contents, loader, resolveDir } = args,
		all_imports: Array<CssDependency> = [],
		extractCssDepsPlugin: EsbuildPlugin = {
			name: "does-not-matter",
			setup: extractCssDepsPluginSetupFactory.bind(undefined, all_imports),
		}
	const base_esbuild = INNER_PLUGIN_BUILD in build
		? build[INNER_PLUGIN_BUILD].esbuild
		: build.esbuild
	const build_result = await base_esbuild.build({
		stdin: { contents, loader, resolveDir, sourcefile: path },
		plugins: [extractCssDepsPlugin],
		absWorkingDir,
		nodePaths,
		alias,
		format: "esm",
		write: false,
		bundle: true,
		minify: true,
		treeShaking: false,
	})

	const
		warnings: EsbuildWarningsAndErrors["warnings"] = [...build_result.warnings],
		errors: EsbuildWarningsAndErrors["errors"] = [...build_result.errors],
		output_files = build_result.outputFiles,
		output_css_contents = (output_files.at(0)?.contents ?? new Uint8Array()) as Uint8Array<ArrayBuffer>
	if (output_files.length !== 1) {
		errors.push({
			text: `[cssPlugin:extractCssDeps]: expected only a single file to be emitted, found "${output_files.length}".`,
			location: { file: path },
		})
	}

	return {
		contents: output_css_contents,
		imports: all_imports,
		warnings,
		errors,
	}
}
