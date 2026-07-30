/** the node-handlers in this module intercept the elements listed below, and bundles/imports their referenced `src` or `href` paths,
 * unless these elements include a special `external` attribute in them (for instance `<iframe external src="...">`),
 * in which case the referenced resource will be treated as external and not bundled.
 *
 * list of elements that get bundled:
 * - `<img src="...">`
 * - `<video src="...">`
 * - `<audio src="...">`
 * - `<embed src="...">`
 * - `<iframe src="...">`
 * - `<link rel="icon" href="...">`
 *
 * @module
*/

import { isString } from "../../../deps.ts"
import { HTML_NODE_TYPE } from "../deps.ts"
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.ts"


const srcAttributeHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	const src_path: string = args.htmlNode.attributes["src"]
	// if an `external` attribute is present in the node, then we'll not bundle the referenced resource.
	const is_external = "external" in args.htmlNode.attributes
	return {
		path: src_path,
		external: is_external,
		replaceContent: replaceSrcContent,
	}
}

const replaceSrcContent: ReplaceContentFn = (args, ctx) => {
	const
		node = args.htmlNode,
		output_path = args.relativePath ?? args.outputPath
	node.attributes["src"] = output_path
}

const replaceHrefContent: ReplaceContentFn = (args, ctx) => {
	const
		node = args.htmlNode,
		output_path = args.relativePath ?? args.outputPath
	node.attributes["href"] = output_path
}

export const imgLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "img", nodeAttribute: "src" }

export const imgLinkHandlerCallback: HtmlDependencyCallback = srcAttributeHandlerCallback

export const videoLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "video", nodeAttribute: "src" }

export const videoLinkHandlerCallback: HtmlDependencyCallback = srcAttributeHandlerCallback

export const audioLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "audio", nodeAttribute: "src" }

export const audioLinkHandlerCallback: HtmlDependencyCallback = srcAttributeHandlerCallback

export const embedLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "embed", nodeAttribute: "src" }

export const embedLinkHandlerCallback: HtmlDependencyCallback = srcAttributeHandlerCallback

export const iframeLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "iframe", nodeAttribute: "src" }

export const iframeLinkHandlerCallback: HtmlDependencyCallback = srcAttributeHandlerCallback

export const iconLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "link", nodeAttribute: "rel" }

export const iconLinkHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	// first, we ensure that an icon is being linked, and that an href has been provided.
	const
		html_node_attrs = args.htmlNode.attributes,
		rel_tokens = (html_node_attrs["rel"] as string).toLowerCase().split(" ")
	if (!rel_tokens.includes("icon")) { return }
	if (!isString(html_node_attrs["href"])) { return }
	const
		src_path: string = html_node_attrs["href"],
		is_external = "external" in args.htmlNode.attributes
	return {
		path: src_path,
		external: is_external,
		replaceContent: replaceHrefContent,
	}
}

export const allMediaLinkHandlers: NodeHandler[] = [
	{ filter: imgLinkHandlerFilter, callback: imgLinkHandlerCallback },
	{ filter: videoLinkHandlerFilter, callback: videoLinkHandlerCallback },
	{ filter: audioLinkHandlerFilter, callback: audioLinkHandlerCallback },
	{ filter: embedLinkHandlerFilter, callback: embedLinkHandlerCallback },
	{ filter: iframeLinkHandlerFilter, callback: iframeLinkHandlerCallback },
	{ filter: iconLinkHandlerFilter, callback: iconLinkHandlerCallback },
]

export default allMediaLinkHandlers
