/** the {@link SuperPluginBuild} class extends `esbuild.PluginBuild` to introduce additional functionality to esbuild's plugin api.
 *
 * TODO: I think I should begin adding new utility features to the superbuild plugin build, such as "resolvePath" and "resolveOutdirPath", etc...
 *
 * @module
*/

import type { Optional, Require, StrictOmit } from "../deps.js"
import { isNull, isRecord, isRelativePath, joinPaths, parseFilepathInfo, pathToPosixPath } from "../deps.js"
import type {
	EsbuildBuildOptions,
	EsbuildLoaderType,
	EsbuildOnEndCallback,
	OnLoadCallback as EsbuildOnLoadCallback,
	OnLoadResult as EsbuildOnLoadResult,
	EsbuildOnStartCallback,
	EsbuildPartialMessage,
	EsbuildPluginBuild,
	EsbuildResolveOptions,
	EsbuildResolveResult,
	OnResolveArgs,
	OnResolveCallback,
	OnResolveOptions,
} from "../esbuild/strongtypes.js"
import { concatArrays } from "../funcdefs.js"
import type { emissionsDriverPlugin } from "../plugins/emissions_driver.js"
import { importsRerouterPlugin, type ImportsRerouterPluginSetupConfig } from "../plugins/imports_rerouter.js"
import type { EsbuildNativeResolver, nativeReplicaPlugin } from "../plugins/native_replica.js"
import { SuperBuild } from "./build.js"
import type { SuperBuildContext } from "./build_context.js"
import type {
	BundledInputFile,
	OnEmitArgs,
	OnEmitCallback,
	OnEmitOptions,
	OnEmitResult,
	OnLoadArgs,
	OnLoadCallback,
	OnLoadOptions,
	OnTransformArgs,
	OnTransformCallback,
	OnTransformOptions,
	OnTransformResult,
} from "./typedefs.js"
import { INNER_PLUGIN_BUILD } from "./typedefs.js"


/** holds the original user/plugin-provided `OnResolveArgs.pluginData` when the {@link SuperPluginBuild.resolve} method is invoked by some plugin.
 *
 * its presence signifies if the caller of the `onResolve` methods is actually `build.resolve(...)`,
 * in order to hint that the resolved path should neither be cached, nor should the file counter be incremented,
 * as there is no direct "resource loading" that will occur as a consequence of this path resolution.
*/
const ORIGINAL_PLUGINDATA = Symbol()

/** in the context of {@link ORIGINAL_PLUGINDATA}, this symbol indicates that a plugin data does not exist inside the `options` passed to {@link SuperPluginBuild.resolve}. */
const ORIGINAL_PLUGINDATA_DNE = Symbol()

const wrap_resolve_call_options = (options: EsbuildResolveOptions = {}): EsbuildResolveOptions => {
	const
		original_plugindata = ("pluginData" in options) ? options.pluginData : ORIGINAL_PLUGINDATA_DNE,
		wrapped_options: EsbuildResolveOptions = { ...options, pluginData: { [ORIGINAL_PLUGINDATA]: original_plugindata } }
	return wrapped_options
}

const unwrap_resolve_call_options = (
	args: OnResolveArgs & { pluginData: { [ORIGINAL_PLUGINDATA]: any } }
): OnResolveArgs => {
	const
		original_plugindata = args.pluginData[ORIGINAL_PLUGINDATA],
		unwrapped_args = { ...args, pluginData: original_plugindata }
	if (original_plugindata === ORIGINAL_PLUGINDATA_DNE) { delete unwrapped_args["pluginData"] }
	return unwrapped_args
}

const is_wrapped_resolve_call = (args: OnResolveArgs): args is (
	OnResolveArgs & { pluginData: { [ORIGINAL_PLUGINDATA]: any } }
) => { return isRecord(args.pluginData) ? (ORIGINAL_PLUGINDATA in args.pluginData) : false }

/** this is the extension of `esbuild.PluginBuild` that introduces additional functionality to esbuild's plugin api. */
export class SuperPluginBuild implements Omit<EsbuildPluginBuild, "esbuild"> {
	protected ctx: SuperBuildContext
	protected basePluginBuild: EsbuildPluginBuild
	protected readonly pluginName: string
	public initialOptions: EsbuildBuildOptions
	public readonly esbuild: SuperBuild

	/** a reference to the original {@link EsbuildPluginBuild} that was used to construct this class. */
	protected readonly [INNER_PLUGIN_BUILD]: EsbuildPluginBuild

	constructor(ctx: SuperBuildContext, base_plugin_build: EsbuildPluginBuild | SuperPluginBuild, plugin_name: string) {
		base_plugin_build = INNER_PLUGIN_BUILD in base_plugin_build
			? base_plugin_build[INNER_PLUGIN_BUILD]
			: base_plugin_build
		this.ctx = ctx
		this.basePluginBuild = base_plugin_build
		this.pluginName = plugin_name
		this.initialOptions = base_plugin_build.initialOptions
		// the inner `PluginBuild["esbuild"]` gets replaced by a new `SuperBuild` wrapper.
		// TODO: we might want to add a "parent" field to `SuperBuild`, so that it can communicate with the parent super-build,
		// and also `resolve()` with respect to the parent's plugins and `pluginData` context.
		this.esbuild = new SuperBuild(base_plugin_build.esbuild)
		this[INNER_PLUGIN_BUILD] = base_plugin_build
	}

	/** type cast this {@link SuperPluginBuild} as an esbuild-compatible {@link EsbuildPluginBuild}.
	 * there's no logic that gets executed. this function merely performs a type casting for the sake of esbuild-compatibility.
	*/
	public castToEsbuildPluginBuild(): EsbuildPluginBuild { return this as any }

	/** receive the internal {@link EsbuildPluginBuild} that was used to construct _this_ wrapper class.
	 * this is useful when you wish to invoke sub-builds that do not initialize any of super-build's various internal plugins,
	 * either because they slow down the sub-build, or cause some kind of weird compatibility issue with your build,
	 * or because you may wish to bypass super-build's overloaded hooks in order to write low-level plugins _for_ super-build itself,
	 * such as in the case of the {@link nativeReplicaPlugin}, and the underlying {@link EsbuildNativeResolver} it uses.
	 *
	 * you may also use the presence of this method as a means for checking if your plugin is running on super-build, or pure esbuild.
	*/
	public getInnerEsbuildPluginBuild(): EsbuildPluginBuild { return this[INNER_PLUGIN_BUILD] }

	public resolve(path: string, options: EsbuildResolveOptions = {}): Promise<EsbuildResolveResult> {
		// `SuperPluginBuild.resolve` calls should not influence the long-build plugin's `remainingFilesCounter` at all
		// (nor should its result get cached by `LongBuildController.cacheResolvedResult(...)`).
		// however, the `onResolve` hooks have no knowledge of where the path-resolution request comes from;
		// it could either come directly from esbuild (after traversing the parent resource's imports),
		// or it could come from a plugin utilizing `build.resolve(...)`.
		// thus, in order to make `SuperPluginBuild.resolve` calls discoverable, we hijack the `options.pluginData` here,
		// and keep a copy of the original `pluginData` by using the `wrap_resolve_call_options` function.
		// then, the overloaded `onResolve` hook will first check to see if the special `options.pluginData[ORIGINAL_PLUGINDATA]` symbol is present:
		// - if it is, then that will be an indication of `SuperPluginBuild.resolve` being used, in which case we skip caching altogether,
		//   and also decrement the file counter once to compensate for the default increment performed by the long-build plugin's `onResolve` hook.
		// - if the symbol is not present, then it will indicate that it is a natural path-resolution request coming from esbuild (i.e. imports traversal).
		//   in such cases, we carry out our resolved-path cache registration like normal.
		return this.basePluginBuild.resolve(path, wrap_resolve_call_options(options))
	}

	/** this method lets you pass arbitrary loaded content through _all_ available {@link onTransform} handlers/callbacks,
	 * so that you can modularize your plugins further, by making it possible for external plugins to call your plugin's
	 * `onTransform` handlers, or vice-versa.
	 *
	 * the relation between the {@link onTransform} hooks and this method is analogous to what the
	 * {@link resolve} method is to the {@link onResolve} hooks.
	 *
	 * keep in mind that when you use this method to transform some loaded content,
	 * the plugins' {@link OnTransformCallback} functions can tell whether the call request comes from _this_ method,
	 * or from an actual/real loaded resource that is now passing through all available `onTransform` hooks,
	 * by simply observing the state of {@link OnTransformArgs.isTransformCall}.
	*/
	public async transform(
		args: StrictOmit<Optional<OnTransformArgs, "pluginData" | "resolveDir" | "suffix" | "with">, "isTransformCall">
	): Promise<OnTransformResult | null | undefined> {
		return this.performOnTransform({
			pluginData: undefined, resolveDir: "", suffix: "", with: {},
			...args, isTransformCall: true,
		})
	}

	/** passes the provided {@link OnTransformArgs} to _all_ {@link onTransformHandlers | `onTransform` handlers},
	 * and returns the result of the very first handler callback function that produces a non-nullable result.
	*/
	protected async performOnTransform(args: OnTransformArgs): Promise<OnTransformResult | null | undefined> {
		const
			{ path, namespace, loader } = args,
			onTransformHandlers = this.ctx.onTransformHandlers
		for (const handler of onTransformHandlers) {
			const { pluginName: transformerPluginName, filter, namespace: handler_ns, loader: handler_loader } = handler
			if (
				filter.test(path)
				&& (handler_ns ? (handler_ns === namespace) : true)
				&& (handler_loader ? handler_loader === loader : true)
			) {
				const transform_result = await handler.callback(args)
				// if the transformation did not generate any result (i.e. void), then we shall move to testing the next transformation handler.
				if (isNull(transform_result)) { continue }
				transform_result.pluginName ??= transformerPluginName
				return transform_result
			}
		}
	}

	public onStart(callback: EsbuildOnStartCallback): void {
		return this.basePluginBuild.onStart(callback)
	}

	public onEnd(callback: EsbuildOnEndCallback): void {
		/** the {@link emissionsDriverPlugin | "emissions driver" plugin's} `onEnd` stage performs calling each of the registered callbacks. */
		this.ctx.onEndHandlers.push({ pluginName: this.pluginName, callback })
	}

	public onResolve(options: OnResolveOptions, callback: OnResolveCallback): void {
		// NOTE: esbuild's own native resolver never makes it to here because it gets resolved internally, bypassing the plugin api.
		// hence, our cached resolved check is rendered useless because of it.
		// however, this is where our `nativeReplicaPlugin` comes in; it mimics esbuild's native node-resolution through the api layer,
		// and hence all path resolutions get intercepted here by super-build.
		const long_build_controller = this.ctx.longBuildController
		const new_callback: OnResolveCallback = async (args) => {
			// see the long comment under `SuperPluginBuild.resolve` to understand why we try to detect if the caller of this `onResolve`
			// hook comes naturally from esbuild, or if it is a plugin that is performing a `build.resolve` call.
			const
				is_resolve_call = is_wrapped_resolve_call(args),
				result = await callback(is_resolve_call ? unwrap_resolve_call_options(args) : args),
				is_valid_result = !isNull(result?.path) || (result?.external === true)
			if (is_valid_result) {
				// if the caller was not esbuild (i.e. a `buildresolve(...)` was performed by a plugin),
				// then we need only to decrement the file counter to compensate for the initial increment by the long-build plugin's `onResolve` hook.
				// this is because the result of this path resolution will not directly result in the creation of a new file (i.e. an `onLoad` operation),
				// nor will this resolved path contribute to any future path resolution in terms of path caching by esbuild.
				if (is_resolve_call) { long_build_controller.decrementFilesCounter(result.path) }
				// but if the caller was esbuild, then the resolved path will get cached and esbuild will entirely skip loading (i.e. `onLoad` operation)
				// the same file again if the resolved `namespace:path` pair had been encountered before (i.e. resource caching).
				// thus, the file counter must be decremented immediately if the resolved path had been previously cached (since no loading will occur for it anymore),
				// or if the resolved path points towards a new file, then the file counter's decrement will occur later after it has passed through its `onLoad` or `onTransform` stage.
				else { long_build_controller.cacheResolvedResult(result) }
			}
			// if the result of a non-resolve-call produced an error, we must immediately halt the long build controller,
			// so that esbuild can exit and print out the error, instead of being stuck forever due to the long-build.
			if (!is_resolve_call && ((result?.errors?.length ?? 0) > 0)) { long_build_controller.terminate() }
			return result
		}
		return this.basePluginBuild.onResolve(options, new_callback)
	}

	public onLoad(options: OnLoadOptions, callback: OnLoadCallback): void {
		const
			resolvedResourceRegistry = this.ctx.resolvedResourceRegistry,
			long_build_controller = this.ctx.longBuildController

		const transform_interceptor_callback = async (args: OnLoadArgs): Promise<void | [
			onload_results: EsbuildOnLoadResult | null | undefined,
			additional_info: Pick<BundledInputFile, "loader" | "transformLoader" | "emitData">,
		]> => {
			const
				{ namespace, path, suffix, with: with_attr } = args,
				onload_result = await callback(args)
			// if any error occurs during the plugin's `onLoad` callback, we shall halt the build altogether by passing esbuild the error early.
			// also, since generic `loader`s are not permitted by esbuild, so we'll use `as any` to bypass the type error, since the build has failed anyway.
			if ((onload_result?.errors?.length ?? 0) > 0) { return onload_result as any }
			if (isNull(onload_result?.contents)) { return }

			// TODO: inform the user that when `loader` is set to `undefined`, it will get set to an empty string before being transferred to their `onTransform` hook,
			// instead of being converted into "js" (which is esbuild's default interpretation).
			// this is to allow for more flexibility when a user explicitly decides to return a `"js"` loader content vs a more ambiguous empty `""` loader content.
			const
				{ contents, loader = "", resolveDir = "", pluginData } = onload_result,
				loaded_contents = contents as (string | Uint8Array<ArrayBuffer>),
				on_transform_args: OnTransformArgs = {
					loader, namespace, path, pluginData, resolveDir, suffix,
					contents: loaded_contents, with: with_attr, isTransformCall: false,
				},
				on_transform_result = await this.performOnTransform(on_transform_args)

			if (isNull(on_transform_result)) {
				// at this point, we've already tried all available transformation handlers, but none produced a viable result,
				// hence we shall return the original result directly to esbuild.
				return [
					onload_result as EsbuildOnLoadResult,
					{ emitData: undefined, loader: loader, transformLoader: loader as EsbuildLoaderType },
				]
			}

			const { imports = [], emitData, ...transform_result } = on_transform_result
			// there is no possibility of an error from the `onLoad` hook to be introduced, since we've already ruled it out before the loop.
			// transform_result.errors = concatArrays(transform_result.errors, onload_result.errors)
			transform_result.warnings = concatArrays(transform_result.warnings, onload_result.warnings)
			transform_result.watchDirs = concatArrays(transform_result.watchDirs, onload_result.watchDirs)
			transform_result.watchFiles = concatArrays(transform_result.watchDirs, onload_result.watchFiles)
			transform_result.contents ??= loaded_contents
			if (imports.length > 0) {
				long_build_controller.steps.at(-1)!.pushImports({ path, namespace, resolveDir }, imports)
			}
			return [
				transform_result satisfies EsbuildOnLoadResult,
				{ loader, transformLoader: transform_result.loader ?? "", emitData },
			]
		}

		const resource_registry_interceptor_callback: EsbuildOnLoadCallback = async (args) => {
			const [result, additional_info] = await transform_interceptor_callback(args) ?? []
			if (!isNull(result)) {
				const
					{ path: _path, namespace: _namespace, suffix, with: with_attr } = args,
					{ emitData, loader, transformLoader } = additional_info!,
					path = pathToPosixPath(_path),
					namespace = _namespace ? _namespace : "file",
					key = namespace + ":" + path,
					contributing_emit_file: BundledInputFile = { path, namespace, suffix, loader, transformLoader, emitData }
				resolvedResourceRegistry.set(key, contributing_emit_file)
			}
			return result
		}

		const long_build_interceptor_callback: EsbuildOnLoadCallback = async (args) => {
			const result = await resource_registry_interceptor_callback(args)
			// every loaded result indicates that a file has gone out of circulation,
			// and hence we must decrement the `remainingFilesCounter` of the long-build plugin.
			if (!isNull(result)) { long_build_controller.decrementFilesCounter(args.path) }
			// in case an error is introduced in the result, we must terminate the long-build, so that esbuild will exit promptly and display the error.
			if ((result?.errors?.length ?? 0) > 0) { long_build_controller.terminate() }
			// TODO: our `nativeReplicaPlugin` is expected to load everything that is left uncaptured/unloaded.
			// yet, if something comes its way (i.e. the final loader) but fails to get loaded with a valid `result`,
			// then our plugin should throw a warning to indicate that either something is wrong with our
			// `nativeReplicaPlugin` itself, or if the input resolved path may be incorrect.
			return result
		}

		return this.basePluginBuild.onLoad(options, long_build_interceptor_callback)
	}

	public onDispose(callback: () => void): void {
		return this.basePluginBuild.onDispose(callback)
	}

	/** TODO: add documentation and usage examples. */
	public onTransform(options: OnTransformOptions, callback: OnTransformCallback): void {
		const { filter, namespace, loader } = options
		this.ctx.onTransformHandlers.push({ pluginName: this.pluginName, filter, namespace, loader, callback })
	}

	/** TODO: add documentation and usage examples. */
	public onEmit(options: OnEmitOptions, callback: OnEmitCallback): void {
		const { filter, inputs, importedBy } = options
		this.ctx.onEmitHandlers.push({ pluginName: this.pluginName, filter, inputs, importedBy, callback })
	}

	/** a path resolver function that joins `path_segments` wherever they're relative,
	 * and resolves with respect to the current working directory (`cwd`) or the esbuild-provided `absWorkingDir`.
	 *
	 * unlike the {@link resolve} method, this method does not involve any `onResolve` handlers assigned to esbuild,
	 * and it only uses basic relative path and absolute path resolution for the computation, and nothing more.
	*/
	public resolvePath(...path_segments: string[]): string {
		return this.ctx.resolvePath(...path_segments)
	}

	/** re-route the statically analyzable relative imports of an emitted js or css file's contents.
	 * this process is akin to either moving/renaming the base emitted file to a different directory,
	 * and/or individually renaming the import paths of a select number of dependency files.
	 *
	 * @param on_emit_args the same `OnEmitArgs` that you receive in your {@link onEmit} hook's callback function.
	 *   this will describe your emitted output file's contents and its original output path,
	 *   in addition to all of the imports that it performs (and any imported entities that may need to have their paths updated).
	 * @param loader specify the kind of content that's in your emitted file.
	 *   only `js` and `css` files are currently supported,
	 *   as only these two can have their import statements natively parse by esbuild
	 *   (which is what we use for modifying the relative import paths).
	 * @param updated_output_path the new path where your emitted output file is to be migrated to.
	 *   you should ideally provide an absolute path here; but if you don't,
	 *   it will be assumed that the path is relative to `on_emit_args.outputPath`.
	 * @returns the new updated contents of the migrated file, any errors, and the migrated path
	 *   (which is the same as the input {@link updated_output_path}, but resolved to become an absolute path),
	 * 	 using the same interface of an {@link onEmit} hook's callback function's return value.
	 *
	 * > [!note]
	 * > remember, the returned value is merely the transformed input content.
	 * > it does **not** implicitly apply the new contents onto the underlying virtual output file.
	 * > for that, you will have to use the returned value of this method as the returned value for your resource's
	 * > {@link onEmit} hook's callback function.
	*/
	public async rerouteImports(
		on_emit_args: Require<Partial<OnEmitArgs>, "contents" | "outputPath">,
		loader: EsbuildLoaderType & ("js" | "css"),
		updated_output_path?: string,
	): Promise<Pick<OnEmitResult, "contents" | "path" | "warnings" | "errors"> & { contents: Uint8Array<ArrayBuffer> }> {
		const
			{ outputPath: initialPath, contents, imports = [] } = on_emit_args,
			output_dir = pathToPosixPath(parseFilepathInfo(initialPath).dirpath),
			outputPath = isNull(updated_output_path) ? undefined
				// we must resolve `updated_output_path` as an absolute path before passing it on to the sub-build.
				: isRelativePath(updated_output_path)
					? joinPaths(initialPath, updated_output_path)
					: updated_output_path,
			plugin_config: ImportsRerouterPluginSetupConfig = { initialPath, outputPath, imports }

		const build_result = await this.basePluginBuild.esbuild.build({
			stdin: {
				contents: contents,
				loader: loader,
				resolveDir: output_dir,
				sourcefile: initialPath,
			},
			format: "esm",
			write: false,
			bundle: true,
			minify: false,
			treeShaking: false,
			plugins: [importsRerouterPlugin(plugin_config)]
		})

		const
			warnings: EsbuildPartialMessage[] = [...build_result.warnings],
			errors: EsbuildPartialMessage[] = [...build_result.errors],
			output_files = build_result.outputFiles,
			migrated_contents = (output_files.at(0)?.contents ?? new Uint8Array()) as Uint8Array<ArrayBuffer>
		if (output_files.length !== 1) {
			errors.push({
				text: `[SuperBuildPlugin.renameEmittedOutput]: expected only a single file to be emitted when renaming to "${outputPath ?? initialPath}".`,
				location: { file: initialPath },
			})
		}

		return {
			path: outputPath ?? initialPath,
			contents: migrated_contents,
			warnings,
			errors,
		}
	}
}
