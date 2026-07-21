/** @module */

import { contentsToString, isNull } from "../../../deps.ts"
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.ts"
import { HTML_NODE_TYPE, type HtmlNode } from "./../deps.ts"


export const scriptInlineHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script" }

interface HandlerData {
	virtualSourcePath: string
}

export const scriptInlineHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	if ("src" in (args.htmlNode.attributes ?? {})) { return }
	const
		{ contentStore } = ctx,
		{ htmlNode, htmlPath, htmlNamespace } = args,
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

	const handlerData: HandlerData = { virtualSourcePath: virtual_src_path }

	return {
		// TODO: add arbitrary `handlerData` field for the `replaceContent` function to receive. this would be a much better generalization.
		path: virtual_src_path,
		external: false,
		handlerData,
		replaceContent,
	}
}

const replaceContent: ReplaceContentFn = async (args, ctx) => {
	const
		{ contentStore, build, outputs } = ctx,
		{ htmlNode: node, handlerData, outputPath, initialPath, htmlOutputPath } = args,
		file_entity = outputs.getFile(initialPath ?? outputPath)
	if (isNull(file_entity)) {
		throw new Error(
			`[scriptInline:replaceContent]: expected to find the output entity: "${outputPath}", `
			+ `but couldn't locate it using the key: "${initialPath ?? outputPath}"`
		)
	}
	const
		// the js script's text contents are stored as a child text node.
		child_nodes: HtmlNode[] = node.children,
		script_text_content = child_nodes.find((child_node) => (child_node.type === HTML_NODE_TYPE.TEXT))!

	// we finally re-route all local/bundled import statements to be relative to the host html file,
	// rather than the current `initialPath ?? outputPath` path (which would be in the distribution directory for js-content).
	const { contents: migrated_contents, errors, warnings } = await build.rerouteImports(file_entity.toOnEmitArgs(), "js", htmlOutputPath)

	// console.log(errors, warnings)
	script_text_content.value = contentsToString(migrated_contents!)
}

export default {
	filter: scriptInlineHandlerFilter,
	callback: scriptInlineHandlerCallback,
} satisfies NodeHandler
