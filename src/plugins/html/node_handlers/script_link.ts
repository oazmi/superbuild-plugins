/** @module */

import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.ts"
import { HTML_NODE_TYPE } from "./../deps.ts"


export const scriptLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script", nodeAttribute: "src" }

export const scriptLinkHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	const src_path: string = args.htmlNode.attributes["src"]
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
	node.attributes["src"] = output_path
}

export default {
	filter: scriptLinkHandlerFilter,
	callback: scriptLinkHandlerCallback,
} satisfies NodeHandler
