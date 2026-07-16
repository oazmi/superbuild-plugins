/** @module */

import type { HtmlDependency, HtmlDependencyArgs, HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.ts"
import { HTML_NODE_TYPE } from "./../deps.ts"


export const scriptLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script", nodeAttribute: "src" }

export const scriptLinkHandlerCallback: HtmlDependencyCallback = (args: HtmlDependencyArgs) => {
	const src_path: string = args.htmlNode.attributes["src"]
	return {
		path: src_path,
		external: false,
		replaceContent,
	}
}

const replaceContent: HtmlDependency["replaceContent"] = (node, output_path, config) => {
	node.attributes["src"] = output_path
}
