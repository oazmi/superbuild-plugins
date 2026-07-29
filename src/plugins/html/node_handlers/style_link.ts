/** @module */

import { isString } from "../../../deps.ts"
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.ts"
import { HTML_NODE_TYPE } from "./../deps.ts"


export const styleLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "link", nodeAttribute: "rel" }

export const styleLinkHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	// first, we ensure that a stylesheet is being linked, and that an href has been provided.
	const html_node_attrs = args.htmlNode.attributes
	if (html_node_attrs["rel"].toLowerCase() !== "stylesheet") { return }
	if (!isString(html_node_attrs["href"])) { return }
	const src_path: string = html_node_attrs["href"]
	return {
		path: src_path,
		external: false,
		replaceContent,
	}
}

const replaceContent: ReplaceContentFn = (args, ctx) => {
	const
		node = args.htmlNode,
		output_path = args.relativePath ?? args.outputPath
	node.attributes["href"] = output_path
}

export default {
	filter: styleLinkHandlerFilter,
	callback: styleLinkHandlerCallback,
} satisfies NodeHandler
