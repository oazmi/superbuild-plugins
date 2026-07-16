/** @module */

import type { ImportedEntity, ImportEntity, MaybePromise, MaybePromiseOrNull } from "../../deps.ts"
import type { HTML_NODE_TYPE, HtmlNode, StrictOmit } from "./deps.ts"


/** a reference key to use in superbuild's {@link ImportEntity}, to refer back to the original html node and the import insertion function. */
export type HtmlNodeRef = number & {}

/** describes a function that takes in an html node and then updates its referenced contents with the new `output_path`.
 *
 * for instance, if you are updating the content of your `<script src="..."></script>` elements,
 * your content replacement function will simply look like:
 *
 * ```ts
 * const replaceScriptContent: ReplaceContentFn = (node, new_output_path, config) => {
 * 	node.attributes.src = new_output_path
 * }
 * ```
*/
export type ReplaceContentFn = (
	node: HtmlNode,
	output_path: string,
	config: Pick<ImportedEntity, "external" | "with" | "write">,
) => MaybePromise<void>

/** describes a task for replacing the contents of a node with the updated resource output path reference. */
export interface HtmlNodeReplacementContentTask {
	/** the html node to process. */
	htmlNode: HtmlNode

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
	htmlNode: HtmlNode
}

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

export type HtmlDependencyCallback = (args: HtmlDependencyArgs) => MaybePromiseOrNull<StrictOmit<HtmlDependency, "key" | "htmlNode">>
