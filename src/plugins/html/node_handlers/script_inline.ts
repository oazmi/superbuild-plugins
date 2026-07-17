/** @module */

import { contentsToString, isNull } from "../../../deps.ts"
import type { HtmlDependency, HtmlDependencyArgs, HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler } from "../typedefs.ts"
import { HTML_NODE_TYPE, type HtmlNode } from "./../deps.ts"


export const scriptInlineHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script" }

export const scriptInlineHandlerCallback: HtmlDependencyCallback = (args: HtmlDependencyArgs) => {
	if ("src" in (args.htmlNode.attributes ?? {})) { return }
	const
		{ contentStore, htmlNode, htmlPath, htmlNamespace } = args,
		child_nodes: HtmlNode[] = htmlNode.children,
		// the js script's text contents are stored as a child text node.
		script_text_content = child_nodes.find((child_node) => (child_node.type === HTML_NODE_TYPE.TEXT))
	if (isNull(script_text_content)) { return }
	const js_string = script_text_content.value
	const virtual_src_path = contentStore.add({
		importerPath: htmlPath,
		importerNamespace: htmlNamespace,
		loader: "ts",
		contents: js_string,
	})

	return {
		// TODO: add arbitrary `handlerData` field for the `replaceContent` function to receive. this would be a much better generalization.
		path: virtual_src_path,
		external: false,
		replaceContent: replaceContentFactory(virtual_src_path),
	}
}

const replaceContentFactory = (virtual_src_path: string): HtmlDependency["replaceContent"] => {
	return (ctx, node, output_path, config) => {
		const
			{ contents } = ctx.contentStore.getOutput(virtual_src_path),
			child_nodes: HtmlNode[] = node.children,
			// the js script's text contents are stored as a child text node.
			script_text_content = child_nodes.find((child_node) => (child_node.type === HTML_NODE_TYPE.TEXT))!
		script_text_content.value = contentsToString(contents)
	}
}

export default {
	filter: scriptInlineHandlerFilter,
	callback: scriptInlineHandlerCallback,
} satisfies NodeHandler
