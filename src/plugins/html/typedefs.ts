/** @module */

import type { ImportedEntity, ImportEntity, MaybePromise, MaybePromiseOrNull, OnResolveResult, ReducedMetafile, SuperPluginBuild } from "../../deps.ts"
import type { EsbuildWarningsAndErrors } from "../../typedefs.ts"
import type { ContentStore } from "./content_store.ts"
import type { HTML_NODE_TYPE, HtmlNode, StrictOmit } from "./deps.ts"


/** a reference key to use in superbuild's {@link ImportEntity}, to refer back to the original html node and the import insertion function. */
export type HtmlNodeRef = number & {}

export interface ReplaceContentFnContext {
	/** the plugin-build object. do not use it for creating any new hooks.
	 * it should only be used for its {@link SuperPluginBuild.resolvePath} and {@link SuperPluginBuild.rerouteImports} methods.
	*/
	build: SuperPluginBuild

	/** a metafile containing the contents of all outputs. */
	outputs: ReducedMetafile

	/** a content store for creating and loading virtual file resources. */
	contentStore: ContentStore
}

/** the arguments passed to a {@link ReplaceContentFn} function.
 * the most notably important fields are:
 * - `htmlNode`: read {@link HtmlDependencyArgs.htmlNode}.
 * - `htmlOutputPath`: read {@link htmlOutputPath}.
 * - `outputPath`: the current absolute output path of the emitted dependency file resource.
 * - `initialPath`: the initial absolute output path of the emitted dependency file resource.
 *   it is only present if the output path (`outputPath`) of this dependency entity was altered.
 * - `relativePath`:
 * - `external`: specifies if this dependency resource was resolved to be an external (non-bundled) reference.
 * - `write`: specifies if this dependency resource was declared to be written onto the disk.
 * - `handlerData`: read {@link handlerData}.
*/
export interface ReplaceContentFnArgs extends HtmlDependencyArgs, ImportedEntity {
	/** the finalized absolute output path of the emitted host html file. */
	htmlOutputPath: string

	/** the relative path of this output dependency file ({@link outputPath}),
	 * with respect to the emitted host html file ({@link htmlOutputPath}).
	 * this field is **only** present when `external` is `false`.
	*/
	relativePath?: string

	/** any arbitrary data that was passed from your {@link HtmlDependencyCallback} function's returned value will get passed here. */
	handlerData?: any
}

/** describes a function that takes in an html node and then updates its referenced contents with the new `output_path`.
 *
 * for instance, if you are updating the content of your `<script src="..."></script>` elements,
 * your content replacement function will simply look like:
 *
 * ```ts
 * const replaceScriptContent: ReplaceContentFn = (args, ctx) => {
 * 	const
 * 		new_output_path = args.outputPath,
 * 		node = args.htmlNode
 * 	htmlNode.attributes.src = new_output_path
 * }
 * ```
 *
 * TODO: the replace content function should return esbuild-compatible warnings and errors.
*/
export type ReplaceContentFn = (
	args: ReplaceContentFnArgs,
	ctx: ReplaceContentFnContext,
) => MaybePromise<void | undefined | EsbuildWarningsAndErrors>

/** describes a task for replacing the contents of a node with the updated resource output path reference. */
export interface HtmlNodeReplacementContentTask {
	/** contains the original arguments of the node callback function ({@link HtmlDependencyArgs}),
	 * in order to construct the {@link ReplaceContentFnArgs}.
	*/
	originalArgs: HtmlDependencyArgs

	/** pass some arbitrary data to your {@link replaceContent} function's context ({@link ReplaceContentFnContext}). */
	handlerData?: any

	/** the html node content replacement function. its first argument will be the {@link htmlNode} that is to be processed.
	 *
	 * this function is supposed to re-insert the import reference/link back into the html node from which it was originally extracted from.
	*/
	replaceContent: ReplaceContentFn
}

/** a generic dependency of an html file. */
export interface HtmlDependency extends
	ImportEntity<HtmlNodeRef>,
	HtmlNodeReplacementContentTask { }

/** the data passed from the transformation-stage to the emission-stage via the `emitData` return field. */
export interface HtmlDependencyEmitData {
	/** the AST of the html document that was processed in the `onTransform` hook. */
	htmlDocument: HtmlNode

	/** an array of all the content-replacement/path-substitution nodes and functions that will need to take place,
	 * after the initial bundle has been emitted (i.e. when in the `onEmit` stage).
	 *
	 * the index of each element reflects its {@link HtmlNodeRef} number,
	 * which gets passed over to superbuild's {@link ImportEntity.key} (since it has to be json serializable).
	*/
	replacementTaskList: Array<HtmlNodeReplacementContentTask>
}

/** the html node data passed to each registered node handler. */
export interface HtmlDependencyArgs extends Pick<HtmlDependencyEmitData, "htmlDocument"> {
	/** the `ultrahtml` node associated with this dependency. */
	htmlNode: HtmlNode

	/** the path that was used by the html file when it was resolve (i.e. {@link OnResolveResult.path}). */
	htmlPath: string

	/** the namespace that was used by the html file when it was loaded (i.e. {@link OnLoadResult.namespace}). */
	htmlNamespace: string
}

/** describes a {@link NodeHandler}'s html-node filter,
 * so that irrelevant html nodes can be ignored and never passed onto your {@link HtmlDependencyCallback} function.
 *
 * this is modeled closely to esbuild's `onResolve` and `onLoad` hook's filter system, since it is quite speedy,
 * and reduces the logic inside of the callback function, while also keeping things more concise and clear.
*/
export interface HtmlDependencyFilter {
	/** the node type to intercept. */
	nodeType: HTML_NODE_TYPE

	/** filter in only nodes/elements with the given name.
	 * examples: `"script"`, `"style"`, `"h2"`, `"canvas"`, etc...
	*/
	nodeName?: string

	/** test for the existence of a certain node attribute. */
	nodeAttribute?: string
}

/** the callback function of a {@link NodeHandler}, which gets called once its {@link NodeHandler.filter}
 * lets through a certain input html-node ({@link HtmlDependencyArgs.htmlNode | `args.htmlNode`})
*/
export type HtmlDependencyCallback = (
	args: HtmlDependencyArgs,
	ctx: Pick<ReplaceContentFnContext, "build" | "contentStore">,
) => MaybePromiseOrNull<StrictOmit<HtmlDependency, "key" | "originalArgs">>

/** describes an html-node handler that will extract any present inlined/linked resource that might need to be bundled along with your html. */
export interface NodeHandler {
	filter: HtmlDependencyFilter
	callback: HtmlDependencyCallback
}
