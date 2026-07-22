/** this module exports a content-storage for storing and loading inlined contents in your html files.
 * only a single instance of {@link ContentStore} is needed per build.
 *
 * TODO: consider if this module should be moved up top,
 * since it is generic enough to be useful for other plugins that I plan on adding later.
 *
 * @module
*/

import { isNull } from "@oazmi/kitchensink/struct"
import type { EsbuildPartialMessage, OnLoadResult, SuperPluginBuild } from "../../deps.ts"
import { contentsToUint8Array, ensureEndSlash, escapeLiteralStringForRegex, joinPosixPaths, number_isNaN, parseFilepathInfo } from "../../deps.ts"


const content_store_name = "oazmi-superbuild-plugin-html-content_store"

type FileId = number & {}

/** this interface describes an virtual file entry stored inside {@link ContentStore}. */
interface ContentStoreFile extends ContentStoreAddFile {
	/** the resource's unique id number. */
	id: FileId

	/** the contents of the resource. */
	contents: Uint8Array<ArrayBuffer>
}

export interface ContentStoreAddFile {
	/** this resource's importer's resolved path. */
	importerPath: string

	/** this resource's importer's resolved namespace. */
	importerNamespace?: string

	/** the loader to be used on this resource. */
	loader: OnLoadResult["loader"]

	/** the contents of this virtual resource. */
	contents: string | Uint8Array<ArrayBuffer>
}

export class ContentStore {
	/** the prefix that must be attached to stored resources' initial path (i.e. the path passed to `build.resolve(...)`). */
	public readonly prefix: string = `${content_store_name}:`

	/** the namespace that will be attached to resolved virtual contents' "path". */
	public readonly namespace: string = `${content_store_name}-ns`

	/** contains all of the files inserted via the {@link add} method. */
	protected files: Map<FileId, ContentStoreFile> = new Map()

	/** contains all of the emitted files that originated from the virtual resource {@link files}. */
	protected outputFiles: Map<FileId, ContentStoreFile> = new Map()

	/** a unique resource id that is incremented for each new resource. */
	private resourceId: FileId = 0

	constructor(build: SuperPluginBuild) {
		const
			prefix = this.prefix,
			namespace = this.namespace,
			filter = new RegExp(escapeLiteralStringForRegex("/" + prefix) + "\\d+$")
		const self = this

		build.onResolve({ filter }, (args) => {
			// we MUST report the `path` to be that of the importer,
			// because only then will relative links within the content of the virtual/inlined resource be resolved relative to the html file.
			// TODO: there's a flaw with this: `args.importer` will only ever get resolved once with the given namespace.
			// all additional resources with the same importer will receive the previously loaded content.
			// ideally, I should extract the dirname of the importer, and then append our `${prefix}:${resource_id}` to it,
			// so that this virtual inlined content looks like its in the same directory as the importer.
			// setting the original namespace of this virtual resource lets us re-introduce this namespace when the imports of _this_
			// resource go through path resolution once _this_ resource has been parsed by esbuild,
			// instead of being stuck with our `this.namespace` forever.
			self.getInput(args.path).importerNamespace = args.namespace
			return {
				path: args.path,
				namespace: namespace,
				// we propagate the plugin data in case it contains crucial contextual information for other plugins to make use of.
				pluginData: args.pluginData,
			}
		})

		build.onLoad({ filter: /.*/, namespace: namespace }, (args) => {
			const
				{ importerPath, contents, loader } = self.getInput(args.path),
				resolveDir = ensureEndSlash(parseFilepathInfo(importerPath).dirpath)
			return { contents, loader, resolveDir, pluginData: args.pluginData }
		})

		// here we "revert" any captured virtual resource's imports to return back to their expected regular namespace (or lack thereof).
		build.onResolve({ filter: /.*/, namespace: namespace }, (args) => {
			const
				{ path, importer, namespace: _namespace, ...rest_args } = args,
				{ importerPath: original_importer, importerNamespace: original_importer_namespace } = self.getInput(importer)
			return build.resolve(path, { ...rest_args, importer: original_importer, namespace: original_importer_namespace })
		})

		const ALREADY_ENCOUNTERED = Symbol()

		build.onEmit({
			filter: /.*/,
			inputs: [{ filter: /.*/, namespace }],
		}, (args, output_file_registry) => {
			if (args.reEmitData?.[ALREADY_ENCOUNTERED] === true) { return }

			const
				errors: EsbuildPartialMessage[] = [],
				{ outputPath, contents, inputs } = args,
				sources_from_namespace = inputs.filter((input) => { return input.namespace === namespace }),
				number_of_sources_from_namespace = sources_from_namespace.length
			// note: one drawback related to strictly expecting just a single virtual file input source is that virtual files won't be able to import other virtual files!
			if (number_of_sources_from_namespace !== 1) {
				errors.push({
					location: { file: outputPath },
					text: `[ContentStore]: expected output virtual file to be constituted of just a single primary input file, `
						+ `but found it to be made out of "${number_of_sources_from_namespace}" primary source files.`
						+ `input sources: [${sources_from_namespace.map((input_file) => (input_file.namespace + ":" + input_file.path)).join("\n")}]`
				})
				return { errors }
			}

			const
				reEmitData = args.reEmitData ?? {},
				{ path: resolved_path, loader } = sources_from_namespace[0],
				id = self.decodeResolvedPath(resolved_path)
			self.outputFiles.set(id, { id, importerPath: resolved_path, loader, contents })
			reEmitData[ALREADY_ENCOUNTERED] = true
			return { write: false, reEmit: true, reEmitData }
		})
	}

	/** encode a virtual resource file's id to an esbuild-resolvable path.
	 *
	 * the reason why encode the virtual file in a certain way is because we want its content's relative references to still stay intact.
	 * the way by which we encode the resource path is: `${importer_dir}/${prefix}${id}`,
	 * where `importer_dir` is the directory of `importer.importerPath`, and `prefix` is {@link prefix}.
	*/
	protected encodeResolvedPath(id: FileId, importer: Pick<ContentStoreAddFile, "importerPath">): string {
		const
			{ importerPath } = importer,
			importer_dir = ensureEndSlash(parseFilepathInfo(importerPath).dirpath),
			resource_filename = `./${this.prefix}${id}`,
			resource_path = joinPosixPaths(importer_dir, resource_filename)
		return resource_path
	}

	/** decode the output of {@link encodeResolvedPath} to get back the original unique file/resource {@link FileId} from it. */
	protected decodeResolvedPath(resolved_path: string): FileId {
		const
			resource_filename = parseFilepathInfo(resolved_path).filename,
			id: FileId = Number(resource_filename.slice(this.prefix.length))
		if (number_isNaN(id)) { throw new Error(`[ContentStore.decodeResolvedPath]: could not decode the resource id number of the resolved path: "${resolved_path}".`) }
		return id
	}

	/** acquire a unique new resource id. */
	protected newId(): FileId { return this.resourceId++ }

	/** add a new content to this content-storage.
	 * the returned value will reflect the unique resource id assigned to your newly added content.
	*/
	public add(config: ContentStoreAddFile): string {
		const
			id = this.newId(),
			{ contents: _contents, importerPath, importerNamespace, loader } = config,
			contents = contentsToUint8Array(_contents),
			resource_path = this.encodeResolvedPath(id, config)
		this.files.set(id, { id, importerPath, importerNamespace, loader, contents })
		return resource_path
	}

	/** load a content from the content-storage, based on the unique resource file path it was assigned during the {@link add} method. */
	public getInput(resolved_path: string): ContentStoreFile {
		const
			id = this.decodeResolvedPath(resolved_path),
			file = this.files.get(id)
		if (isNull(file)) { throw new Error(`[ContentStore.getInput]: couldn't find the resource with the following id: "${resolved_path}".`) }
		return file
	}

	/** get the contents of the bundled/emitted output virtual resource. */
	public getOutput(resolved_path: string): ContentStoreFile {
		const
			id = this.decodeResolvedPath(resolved_path),
			file = this.outputFiles.get(id)
		if (isNull(file)) { throw new Error(`[ContentStore.getOutput]: couldn't find the resource with the following id: "${resolved_path}".`) }
		return file
	}
}
