/** @module */

import { contentsToString, isNull } from "../../../deps.ts"
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.ts"
import { HTML_NODE_TYPE, type HtmlNode } from "./../deps.ts"


export const styleInlineHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "style" }

export const styleInlineHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	const
		{ contentStore } = ctx,
		{ htmlNode, htmlPath, htmlNamespace } = args,
		child_nodes: HtmlNode[] = htmlNode.children,
		// the css style rules are stored in the style element's child text node.
		style_text_content = child_nodes.find((child_node) => (child_node.type === HTML_NODE_TYPE.TEXT))
	if (isNull(style_text_content)) { return }
	const css_string = style_text_content.value
	const virtual_src_path = contentStore.add({
		importerPath: htmlPath,
		importerNamespace: htmlNamespace,
		loader: "css",
		contents: css_string,
	})

	return {
		path: virtual_src_path,
		external: false,
		replaceContent,
	}
}

const replaceContent: ReplaceContentFn = async (args, ctx) => {
	const
		{ build, outputs } = ctx,
		{ htmlNode: node, outputPath, initialPath, htmlOutputPath } = args,
		file_entity = outputs.getFile(initialPath ?? outputPath)
	if (isNull(file_entity)) {
		const error_text = `[styleInline:replaceContent]: expected to find the output entity: "${outputPath}", `
			+ `but couldn't locate it using the key: "${initialPath ?? outputPath}"`
		return { errors: [{ text: error_text, location: { file: args.htmlPath, namespace: args.htmlNamespace } }] }
	}
	const
		// the js script's text contents are stored as a child text node.
		child_nodes: HtmlNode[] = node.children,
		style_text_content = child_nodes.find((child_node) => (child_node.type === HTML_NODE_TYPE.TEXT))!

	// we finally re-route all local/bundled import statements to be relative to the host html file,
	// rather than the current `initialPath ?? outputPath` path (which would be in the distribution directory for js-content).
	const { contents: migrated_contents, errors, warnings } = await build.rerouteImports(file_entity.toOnEmitArgs(), "css", htmlOutputPath)
	style_text_content.value = contentsToString(migrated_contents!)
	return { warnings, errors }
}

export default {
	filter: styleInlineHandlerFilter,
	callback: styleInlineHandlerCallback,
} satisfies NodeHandler
