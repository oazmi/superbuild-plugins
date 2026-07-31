/** an internal super-build plugin that enables the inclusion of additional imports dynamically,
 * as esbuild is transforming the loaded content.
 *
 * the reason why this plugin is called "long build" is because it hangs up at its loader stage and waits for the import requests to come in,
 * until all known entities that had entered the `onResolve` stage have exited through at least one `onLoad` hook.
 *
 * @module
*/

import { array_isEmpty, DEBUG, escapeLiteralStringForRegex, isNull, joinPaths, json_stringify, number_parseInt, parseFilepathInfo, pathToPosixPath, promiseOutside, Require } from "../deps.js"
import type { EsbuildBuildOptions, EsbuildPartialMessage, EsbuildPlugin, EsbuildPluginBuild, EsbuildPluginSetup, EsbuildResolveOptions, OnLoadArgs, OnResolveArgs, OnResolveResult } from "../esbuild/strongtypes.js"
import { cancelableDelayedPromiseResolver, generateUuid, noopLogger } from "../funcdefs.js"
import type { SuperPluginBuild } from "../super/plugin_build.js"
import type { ImportEntity } from "../super/typedefs.js"
import type { LoggerFunction } from "../typedefs.js"


type ResourceId = number & {}

interface WellDefinedImportEntity extends Require<ImportEntity, "namespace" | "importer" | "resolveDir" | "kind" | "external" | "with"> {
	/** this is the properly formatted, posix-compliant, lower-cased `${namespace}:${importer_path}` key that is unique to each importer.
	 * this key will be used to deduce which importer to associate the imported entity with, once the bundle has been emitted.
	*/
	importerKey: string
}

export interface WellDefinedImportedEntity extends WellDefinedImportEntity {
	/** the output path of the eitted imported entity. */
	outputPath: string
}

const enum LONGBUILD {
	/** the minimum amount of time (in ms) that the long build will wait before concluding its `contents`,
	 * after it has determined that no active files remain in circulation.
	 * if a new file is suddenly introduced while the longbuild is waiting for this delay to complete, it will halt the timer,
	 * and wait for all new files in the circulation to complete before beginning this countdown again.
	 *
	 * ideally, this should be set to a safe high value,
	 * where you can be certain that esbuild's go-side transpiler/transformer won't take any longer than that to transform a single file in your bundle.
	 * i.e. the lower bound of this enum value = `max(...all_bundled_files.map((file) => get_transpilation_time(file))`
	*/
	ONLOAD_MIN_DELAY = 500,

	/** the name of the resource-imports storage variable used across the "long build step" js files. */
	RESOURCE_VAR_NAME = "resourceImports",

	/** the name of the iife modules collector variable. it gets used when esbuild's format is set to `"iife"` or `"cjs"` instead of `"esm"`. */
	IIFE_MODULES_VAR_NAME = "iifeModules",

	/** this is just a type annotation for the path name of the resource files.
	 * it's basically just {@link ResourceId | resource id} number, followed by the {@link LongBuildController.resourceExtensionName}.
	*/
	RESOURCE_PATH_TYPE = "`${number}.res`",

	/** this will be common dependency file of each "long build step" js file, so that they all share the same `resourceImports` storage variable.
	 *
	 * the name of this file will be `deps.(${uuid}).js`, defined in the {@link LongBuildController}.
	*/
	DEPS_FILE = `
type ResourceId = number & {}

type ImportStatement = { default?: any }

type ImportPath = ${LONGBUILD.RESOURCE_PATH_TYPE}

export const ${LONGBUILD.RESOURCE_VAR_NAME}: Map<
	ResourceId,                  // a resource id that is unique to the import statement "value".
	ImportStatement | ImportPath // the awaited dynamic import statement, or the resolved path of the resource post-build (during emission).
> = new Map()

// esbuild likes to add a "@__PURE__" annotation to the variable above.
// hence, to ensure that it never gets stripped away (because we want to dynamically import it later),
// we perform an action that has a potential for side-effect, preventing esbuild from ever dropping this variable in the bundle.
${LONGBUILD.RESOURCE_VAR_NAME}.size

export const console_log = (...args: any[]) => {
	// console.log(...args) // for debugging purposes.
}
`,
}

const import_statement_regex = new RegExp("await\\s+import\\s*\\(\\s*(?<quote>[\"'`])(?<importPath>.*?)\\k<quote>\\s*\\)", "g")

export interface LongBuildControllerConfig {
	/** enable internal logging for the {@link LongBuildController}, when {@link DEBUG.LOG} is enabled.
	 *
	 * @defaultValue {@link noopLogger}
	*/
	debuggingLogs?: LoggerFunction

	/** specify what build format is being used by your esbuild's build process.
	 * this is important to specify correctly,
	 * as we will need to manipulate the input and output contents of the long-build file(s) for the following reasons:
	 * - `iife` does not support top-level awaits, hence this mode requires us to wrap the logic inside an async function.
	 *   furthermore, `iife` results in no variable exports;
	 *   hence the bundled output will need to be changed so that it exports the `resourceImports` variable as an es6 module.
	 * - `cjs` does permit top-level awaits, but does not permit es6 exports. hence the need for additional manipulation of the output.
	 * - `esm` faces none of these issues, and it is the base format which we maipulate for the other scenarios.
	 *
	 * @defaultValue `"esm"`
	*/
	format?: EsbuildBuildOptions["format"]
}

/** the controller used for commanding the state of the "long build" plugin. */
export class LongBuildController {
	/** the unique base filename that will be used by the {@link longBuildPluginSetup} plugin to insert its "long build" js file as an entry-point.
	 * the full filename format it will use will be: `${recursion_number}.(${uuid}).js`.
	*/
	public readonly uuid: string

	/** the unique filename(s) that will be used for the "long build" js files.
	 * it is a computed value that evaluates to `.(${uuid}).js`,
	 * and the actual filename that gets inserted/injected will also have a leading number, signifying the "build/recursion number".
	 *
	 * for instance, the entry-point long build js file will be named: `0.(${uuid}).js`,
	 * while the next recursive "long build" import within the `0.(${uuid}).js` file will be named `1.(${uuid}).js`,
	 * and so on (until a "long build" js file with zero external imports/includes is discovered, at which point we shall halt).
	*/
	public readonly baseFilename: string

	/** the name of the "long build dependency" file, as defined in {@link LONGBUILD.DEPS_FILE}.
	 *
	 * its value evaluates to `deps.(${uuid}).js`, and it is imported by each "long build step" js file as a dependency,
	 * in order to have a shared resource variable where all imports will get registered.
	*/
	public readonly depsFilename: string

	/** the custom extension name used by the dynamically imported resources in the "long build step" files.
	 * the paths to all resource imports in the long build step's {@link LongBuildStep.prepareLongBuildFileContent | prepared js file}
	 * will be named `${resource_id as number}.res`.
	*/
	public readonly resourceExtensionName: string = ".res"

	/** the namespace used by the {@link longBuildPlugin}.
	 * it is a computed value that evaluates to `oazmi-superbuild-long_build-plugin-${uuid}`.
	*/
	public readonly pluginNamespace: string

	/** the current build/recursion number. it starts with zero, and it is used for indicating the filename of the current "long build" file. */
	public readonly buildNumber: number

	/** the number of files in the esbuild build process that are currently in circulation.
	 *
	 * - everytime a new file hits the "long build" plugin's `onResolve` hook, this value gets incremented by one,
	 *   since a "new file is currently in circulation".
	 * - whenever a file gets successfully loaded via some plugin's `onLoad` hook,
	 *   the {@link SuperPluginBuild.onLoad} overload decrements this shared-state counter,
	 *   since a "file that was in circulation has exited".
	 * - a caveat to look out for is the fact that if any plugin calls {@link SuperPluginBuild.resolve},
	 *   this counter will get incremented again (double count),
	 *   since the resolve request will go through our "long build" plugin's `onResolve` hook once again.
	 *   to combat this double count, the {@link SuperPluginBuild.resolve} function decrements this counter whenever it gets called.
	*/
	public remainingFilesCounter: number

	/** esbuild caches the loaded result of an `onLoad` hook, based on the result of the `onResolve` hook's `result.path` and `result.namespace`
	 * (I don't know if esbuild also caches with respect to the `with` import attribute).
	 * but we don't want to count any cached paths towards {@link remainingFilesCounter}, since they won't be loaded again;
	 * which is why we need this hash-set to keep track of what has already been seen once.
	*/
	protected encounteredPaths: Set<string> = new Set()

	protected resourceIdCounter: ResourceId = 0

	/** contains the list of all resources referenced by various {@link LongBuildStep}s, using the resource id as the key. */
	public readonly resourceEntities: Map<ResourceId, WellDefinedImportEntity> = new Map()

	public steps: Array<LongBuildStep> = []

	/** a logging function for internal debugging. it gets called only when {@link DEBUG.LOG} is enabled. */
	public log: LoggerFunction

	/** {@inheritDoc LongBuildControllerConfig.format} */
	public format: LongBuildControllerConfig["format"]

	/** indicates that a long-build file termination has been triggered via {@link terminate},
	 * and any internal cancelation of the last {@link steps | step's} {@link LongBuildStep.promise}
	 * (via {@link LongBuildStep.cancelResolve}) will be avoided, so that the long-build will conclude promptly.
	*/
	#shouldTerminate = false

	constructor(config?: LongBuildControllerConfig) {
		const uuid = generateUuid(2)
		this.log = config?.debuggingLogs ?? noopLogger
		this.format = config?.format ?? "esm"
		this.uuid = uuid
		this.baseFilename = `.(${uuid}).js`
		this.depsFilename = `deps.(${uuid}).js`
		this.pluginNamespace = `oazmi-superbuild-long_build-plugin-${uuid}`
		this.remainingFilesCounter = 0
		this.buildNumber = -1
		this.incrementBuild()
	}

	public incrementBuild(): EsbuildPartialMessage[] {
		const warnings: EsbuildPartialMessage[] = []
		if (this.remainingFilesCounter !== 0) {
			warnings.push({
				text: `[LongBuildController.incrementBuild]: the number of remaining files (${this.remainingFilesCounter}) in circulation during th current long-build (${this.buildNumber}) did not reach zero before the build was incremented!`
			})
		}
		// TODO: should I force reset the remaining files counter to zero for the next build even when the assertion above fails?
		// this.remainingFilesCounter = 0
		type CitizenshipTest = number

		// hey! incrementing a readonly number is illegal, IN AMERICA! - bandit keith. (unless they pass the citizenship test)
		this.steps.push(new LongBuildStep(this, ++(this.buildNumber satisfies CitizenshipTest)))
		return warnings
	}

	public incrementFilesCounter(pathname?: string): void {
		// cancel any prior resolve that may have been triggered.
		if (!this.#shouldTerminate) { this.steps[this.buildNumber].cancelResolve() }
		++this.remainingFilesCounter
		if (DEBUG.LOG) { this.log(`[LongBuildController]: increment for: "${pathname}". remaining files: ${this.remainingFilesCounter}.`) }
	}

	public decrementFilesCounter(pathname?: string): void {
		// cancel any prior resolve that may have been triggered,
		// so that we always ensure that the desired amount of time has been waited with absolutely no resource processing in between.
		if (!this.#shouldTerminate) { this.steps[this.buildNumber].cancelResolve() }
		if ((--this.remainingFilesCounter) <= 0) {
			this.steps[this.buildNumber].signalResolve()
		}
		if (DEBUG.LOG) { this.log(`[LongBuildController]: decrement for: "${pathname}". remaining files: ${this.remainingFilesCounter}.`) }
	}

	public cacheResolvedResult(args: OnResolveResult) {
		// first we make sure that if the result is `external`, then we decrement the the file counter,
		// as this resource will never go to the loading stage (never gets passed to an `onLoad`).
		if (args.external) {
			this.decrementFilesCounter(args.path)
			return
		}
		// for all other non-external cases, we expect an `args.path` to exist.
		const
			path = pathToPosixPath(args.path!),
			namespace = args.namespace ?? "file",
			key = namespace + ":" + path // TODO: should I perform a `toLowerCase()` here? I'll need to check if esbuild identifies re-used resolved paths case-insensitively.
		// if the resolved path has already been encountered once, then esbuild will have it cached, and so, no loader hooks will be called,
		// therefore we must immediately decrement the files counter, since the loader can't do it any longer.
		if (this.encounteredPaths.has(key)) {
			if (DEBUG.LOG) { this.log(`[LongBuildController]: already encountered: "${key}"`) }
			this.decrementFilesCounter(args.path)
		}
		else {
			if (DEBUG.LOG) { this.log(`[LongBuildController]: never encountered  : "${key}"`) }
			this.encounteredPaths.add(key)
		}
	}

	/** declare a new resource that is to be appended to the list of all resources referenced by the long build file(s).
	 * the returned value is a new resource id for the added resource,
	 * which can be used as a key for retrieving back the added resource, using the {@link resourceEntities} `Map`.
	*/
	public addResource(resource_props: WellDefinedImportEntity): ResourceId {
		const new_resource_id = this.resourceIdCounter++
		this.resourceEntities.set(new_resource_id, resource_props)
		return new_resource_id
	}

	/** this function does the inverse of {@link prepareLongBuildFileContent};
	 * it parses the js-transpiled contents of the "long build" file and extracts/reconstructs the resource import `Map` from it.
	 *
	 * since I plan on using a dynamic script `import()` to execute the contents of a modified version of the "long build" file content,
	 * this method has to be made asynchronous.
	 * I'm certainly not going to be using `eval` or the `Function` constructor, because they are often restricted in some js-environments.
	*/
	public async parseLongBuildFileContent(longbuild_file_contents: string): Promise<Map<string, WellDefinedImportedEntity[]>> {
		// first, we prepend and append content that is necessary for iife or cjs based bundled output to turn into and esm script.
		if (this.format !== "esm") {
			longbuild_file_contents = `
const fakeGlobalThis = { };
fakeGlobalThis.${LONGBUILD.IIFE_MODULES_VAR_NAME} = [];
// running the script in a separate scope to prevent cjs top-level var-declaration conflict its name with the exported "RESOURCE_VAR_NAME".
(() => {
	${longbuild_file_contents}
})();

await Promise.all(fakeGlobalThis.${LONGBUILD.IIFE_MODULES_VAR_NAME})
export const ${LONGBUILD.RESOURCE_VAR_NAME} = fakeGlobalThis.${LONGBUILD.RESOURCE_VAR_NAME}`
		}
		const
			// now, we first strip away all dynamic import statements and replace them with just the import string.
			// for instance: `await import("./hello-world.xyz")` will transform to just "String.raw`./hello-world.xyz`".
			js_content_without_imports = longbuild_file_contents.replaceAll(import_statement_regex, "String.raw`$<importPath>`"),
			js_blob = new Blob([js_content_without_imports], { type: "text/javascript" }),
			js_blob_url = URL.createObjectURL(js_blob),
			// now we dynamically load our bundled long-build js file that contains import statements, and then return them.
			{ [LONGBUILD.RESOURCE_VAR_NAME]: resourceImports } = await import(js_blob_url)
		// NOTE: it used to be possible for `resourceImports` to be `undefined` in case esbuild was bundling using the `"iife"` format, instead of "esm".
		// I was initially preventing a fatal shutdown of this script under this situation by using null coalescing with an empty array.
		// however, I hope that parsing issues no longer occur now that I've added support for all three bundling formats (esm, iife, cjs).
		// hence is why I've removed the null coalescing with an explicit fata error, so that it becomes clear when an unexpected parsing error has occurred.
		if (!(resourceImports instanceof Map)) {
			const error_message = `[LongBuildController.parseLongBuildFileContent]: expected the parsed "resourceImports" to be a "Map". but found it to be: "${resourceImports}".`
			this.log(error_message)
			throw new Error(error_message)
		}

		// now, we insert the output path of each resource based on the parsed and bundled long build js file.
		const
			original_resource_entities = this.resourceEntities,
			emitted_resource_entities: Map<ResourceId, WellDefinedImportedEntity> = new Map()
		for (const [resource_id, output_path] of (resourceImports as Map<ResourceId, string>)) {
			const import_entity = original_resource_entities.get(resource_id)
			if (isNull(import_entity)) {
				throw new Error("") // TODO
			}
			emitted_resource_entities.set(resource_id, { ...import_entity, outputPath: output_path })
		}

		// finally, we organize the imports using the `importerKey` as the key.
		const importEntities: Map<string, WellDefinedImportedEntity[]> = new Map()
		for (const [resource_id, well_defined_imported_entity] of emitted_resource_entities) {
			const key = well_defined_imported_entity.importerKey
			let entities = importEntities.get(key)
			if (isNull(entities)) {
				entities = []
				importEntities.set(key, entities)
			}
			entities.push(well_defined_imported_entity)
		}
		return importEntities
	}

	/** terminates the long-build completely by forcefully clearing out the last {@link steps | step's} {@link LongBuildStep.resourceEntityIds},
	 * so that its prepared js file ({@link LongBuildStep.prepareLongBuildFileContent}) contains no imports.
	 * moreover, we also forecefully resolve the last step's {@link LongBuildStep.promise} via {@link LongBuildStep.signalResolve}.
	*/
	public terminate() {
		this.#shouldTerminate = true
		this.remainingFilesCounter = -10000
		const last_step = this.steps[this.buildNumber]
		last_step.resourceEntityIds.splice(0)
		last_step.signalResolve()
	}
}

export class LongBuildStep {
	/** the build number of this build step, starting with zero. */
	public readonly buildNumber: number

	/** the unique filename of this "long build step" js file.
	 * it is a computed value that evaluates to `${buildNumber}.(${uuid}).js`.
	*/
	public readonly filename: string

	public readonly promise: Promise<void>

	public readonly signalResolve: (() => void)

	public readonly cancelResolve: (() => void)

	/** contains a list of all the resource ids referenced by _this_ long build step. */
	public readonly resourceEntityIds: Array<ResourceId> = []

	protected readonly controller: LongBuildController

	constructor(parent_controller: LongBuildController, build_number: number) {
		this.controller = parent_controller
		this.buildNumber = build_number
		this.filename = `${build_number}${parent_controller.baseFilename}`
		const [promise, resolve, reject] = promiseOutside<void>();
		[this.signalResolve, this.cancelResolve] = cancelableDelayedPromiseResolver(resolve, LONGBUILD.ONLOAD_MIN_DELAY, parent_controller.log)
		this.promise = promise
	}

	/** register imports performed by some `importer` entity. */
	public pushImports(
		importer: { path: string, namespace?: string, resolveDir?: string },
		imports: ImportEntity[],
	) {
		const
			{ path: _path, namespace: _namespace = "", resolveDir: _resolveDir = "" } = importer,
			importer_namespace = _namespace ? _namespace : "file",
			importer_path = (importer_namespace === "file") ? pathToPosixPath(_path) : _path,
			importer_key = importer_namespace + ":" + importer_path.toLowerCase(),
			controller = this.controller
		for (const import_entity of imports) {
			const {
				importer = _path,
				namespace = importer_namespace,
				resolveDir: importer_resolveDir = _resolveDir,
				kind = "dynamic-import",
				external = false,
				with: with_attr = {},
				...rest_args
			} = import_entity
			const
				resolveDir = importer_resolveDir ? importer_resolveDir
					: importer ? joinPaths(importer, "./")
						: "./",
				well_defined_import_entity: WellDefinedImportEntity = {
					...rest_args,
					importerKey: importer_key,
					importer, namespace, resolveDir,
					kind, with: with_attr, external,
				},
				resource_id = controller.addResource(well_defined_import_entity)
			this.resourceEntityIds.push(resource_id)
		}
	}

	/** prepares the file contents of the "long build" of this "long build step".
	 *
	 * you would use this once you have deduced that all files that were in circulation during this build step have exited,
	 * and therefore your long build plugin must also halt by loading the contents prepared here by this method.
	 *
	 * > [!caution]
	 * > the file's contents are in typescript rather than javascript.
	 * > so make sure to use the `"ts"` esbuild loader for it.
	*/
	public prepareLongBuildFileContent(): string {
		const
			controller = this.controller,
			resource_ext = controller.resourceExtensionName,
			all_resource_entities = controller.resourceEntities,
			all_resource_imports_this_build = this.resourceEntityIds
		let all_imports_js_str = all_resource_imports_this_build.map((resource_id): string => {
			const import_entity = all_resource_entities.get(resource_id)
			if (isNull(import_entity)) { throw new Error(`[LongBuildStep.prepareLongBuildFileContent]: failed to find resource with the id: "${resource_id}". this is unusual!`) }
			// TODO: when I add "with" import attribute support, I'll either need to uncomment these,
			// or declare the "with" attribute import in the resource re-resolution step of the plugin.
			// const
			// { path, with: with_attr = {} } = import_entity,
			// path_str = json_stringify(path),
			// with_str = json_stringify(with_attr),
			const import_statement = `await import("${resource_id}${resource_ext}")`
			return `${LONGBUILD.RESOURCE_VAR_NAME}.set(${resource_id}, ${import_statement})`
		}).join("\n")

		const
			format = controller.format,
			deps_filename = controller.depsFilename,
			next_filename = `${this.buildNumber + 1}${controller.baseFilename}`,
			deps_import_statement = `import { ${LONGBUILD.RESOURCE_VAR_NAME}, console_log } from "${deps_filename}"`,
			recursion_import_statement = !array_isEmpty(all_resource_imports_this_build)
				? `import "${next_filename}" // recursion to the next long-build.`
				: "// no imports were pushed this build-number. hence, this is the final long-build file."

		// exporting the "resourceImports" variable on the very first build step, so that it can be imported by the parser.
		const export_statement = this.buildNumber !== 0 ? ""
			: (format === "esm") ? `export { ${LONGBUILD.RESOURCE_VAR_NAME} }`
				: `fakeGlobalThis.${LONGBUILD.RESOURCE_VAR_NAME} = ${LONGBUILD.RESOURCE_VAR_NAME}`

		// for none-esm formats, we must wrap the awaited dynamic imports inside an iife async function, with its promise pushed to a known global variable.
		if (format !== "esm") {
			all_imports_js_str = `
fakeGlobalThis.${LONGBUILD.IIFE_MODULES_VAR_NAME}.push((async () => {
${all_imports_js_str}
})())`
		}

		return `
${deps_import_statement}
${recursion_import_statement}

console_log("long build: ${this.buildNumber}")
${all_imports_js_str}
${export_statement}
		`.trim()
	}
}

export interface LongBuildPluginSetupConfig {
	controller: LongBuildController
}

/** this plugin that enables the inclusion of additional imports dynamically, as esbuild is transforming the loaded content.
 *
 * the reason why this plugin is called "long build" is because it hangs up at its loader stage and waits for the import requests to come in,
 * until all known entities that had entered the `onResolve` stage have exited through at least one `onLoad` hook.
 *
 * > [!note]
 * > this plugin should be placed at the very beginning, as it needs to inspect all incoming path-resolution requests,
 * > in order to track if any unprocessed files still remain while bundling.
 *
 * > _Mr. Feast_: Hello everyone, it's your host jimmy neutrino,
 * > and today we'll be trafficking 100 foreign slaves to compete against one another in building the longest pyramid.
 * > whichever slave manages to build the tallest pyramid at the 100 hour mark will earn his freedom and a also a free bugatti**!
 * >
 * > _Lapdog #1_: the rules are simple: if a slave falls asleeps, or moves out of the red circle,
 * > they'll get disqualified immediately and be deported back to their original owner.
 * >
 * > _Lapdog #2_: look at this wonderful art piece that I commissioned from epstien himself!
 * > hey! stop criticizing me! I'm doing this for my son! also, I identify as they/them, so you can't criticize me now.
 * >
 * > **no auto insurance will be supplied, and state sales tax will be the responsibility of the winner.
 * > failing to register your prize within 6 hours of winning will indicate that you wish to forfeit from owning it.
*/
export const longBuildPluginSetup = (config: LongBuildPluginSetupConfig): EsbuildPluginSetup => {
	const
		controller = config.controller,
		longbuild_base_filename = controller.baseFilename,
		longbuild_deps_filename = controller.depsFilename,
		longbuild_res_ext = controller.resourceExtensionName,
		plugin_namespace = controller.pluginNamespace

	return (build: EsbuildPluginBuild | SuperPluginBuild) => {
		const
			sbuild = build as SuperPluginBuild, // I can't think of a better way for annotating `build` as a `SuperPluginBuild` without getting a bunch of type errors.
			filter = new RegExp(escapeLiteralStringForRegex(longbuild_base_filename) + "$"),
			deps_file_filter = new RegExp(escapeLiteralStringForRegex(longbuild_deps_filename) + "$"),
			resource_file_filter = new RegExp("(?<resourceId>\\d+)" + escapeLiteralStringForRegex(longbuild_res_ext) + "$")

		build.onResolve({ filter: /.*/ }, (args: OnResolveArgs) => {
			// TODO: I believe `<stdin>` does not go through any `onResolve`, and jumps straight to `onLoad`. so, we must account for not decrementing the counter when it is `<stdin>`.
			controller.incrementFilesCounter(args.path)
			if (!args.path.endsWith(longbuild_base_filename)) { return undefined }
			const filename = parseFilepathInfo(args.path).filename // this is to strip away any directory prefixes.
			return { path: filename, namespace: plugin_namespace } // TODO: should we set `sideEffects` to true?
		})

		build.onResolve({ filter: resource_file_filter, namespace: plugin_namespace }, (args: OnResolveArgs) => {
			const
				resource_id = number_parseInt(resource_file_filter.exec(args.path)!.groups!["resourceId"]),
				import_entity = controller.resourceEntities.get(resource_id)
			if (isNull(import_entity)) {
				const error_text = `[longBuildPlugin::onResolve-imported_resource]: never encountered the resource with the id: "${resource_id}". this is unusual!`
				return { errors: [{ text: error_text }] }
			}

			const
				{ importer, importerKey, key, namespace, path, resolveDir, kind, with: with_attr, pluginData, pluginName, external } = import_entity,
				immediate_result: OnResolveResult = { path, external, namespace, pluginData, pluginName }

			// if the imported resource was declared as external, then there's no need for a re-resolution.
			if (external) { return immediate_result }

			// if the imported entity was originally using the same namespace as this plugin's, then we won't re-resolve the path,
			// as that will lead to an infinite recursion. hence is why we return early.
			// though, I do not expect such a scenario to ever happen, which is why we include a warning along with the result.
			if (namespace === plugin_namespace) {
				const warning_text = `[longBuildPlugin::onResolve-imported_resource]: found resource "${resource_id}" to be using the same namespace as the long build plugin's.`
					+ `this should not normally happen. skipping re-resolution of the said resource, as it'll lead to an infinite resolution recursion.`
					+ `the resolve-args of the associated resource are:\n${json_stringify(args)}`
				return { ...immediate_result, warnings: [{ text: warning_text }] }
			}

			// under regular circumstances, we re-resolve the imported entity based on the resolve-options declared in `LongBuildController.resourceEntities`.
			const resolve_options: EsbuildResolveOptions = { importer, namespace, resolveDir, kind, with: with_attr, pluginData, pluginName }
			return build.resolve(path, resolve_options)
		})

		build.onLoad({ filter: deps_file_filter, namespace: plugin_namespace }, (args: OnLoadArgs) => {
			return { contents: LONGBUILD.DEPS_FILE as string, loader: "ts" }
		})

		build.onLoad({ filter, namespace: plugin_namespace }, async (args: OnLoadArgs) => {
			// the "long build" js files need to temporarily remove themselves from the `remainingFilesCounter` circulation, otherwise it will never drop to zero
			controller.decrementFilesCounter(args.path)
			const
				filename = args.path,
				build_number = Number(filename.slice(0, -longbuild_base_filename.length)),
				build_step = controller.steps[build_number]
			// wait for super-build to externally resolve the promise below to signal that the `remainingFilesCounter` has dropped to zero.
			await build_step.promise
			const
				contents = build_step.prepareLongBuildFileContent(),
				warnings = controller.incrementBuild()
			// we increment the `remainingFilesCounter` because returning from this function will cause it to drop to `-1` if we don't increment.
			++controller.remainingFilesCounter
			return { contents, loader: "ts", resolveDir: "./", warnings }
		})

		// long build file(s) should not be emitted into the filesystem.
		sbuild.onEmit({
			filter: /.*/,
			inputs: [{ filter: /.*/, namespace: plugin_namespace }],
		}, (args) => { return { write: false } })
	}
}

/** {@inheritDoc longBuildPluginSetup} */
export const longBuildPlugin = (config: LongBuildPluginSetupConfig): EsbuildPlugin => {
	return {
		name: "oazmi-superbuild-long_build-plugin",
		setup: longBuildPluginSetup(config),
	}
}
