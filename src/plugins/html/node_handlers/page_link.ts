/** this node-handler intercepts all `<a href="...">` html nodes, and bundles/imports the referenced `href` link,
 * given that the `href` does not reference a local element (i.e. starts with `#`),
 * nor does the `<a>` element include a special `external` attribute in it (i.e. `<a external href="...">`),
 * as that would hint that the resource being referenced is external.
 *
 * @module
*/

import { HTML_NODE_TYPE } from "../deps.js"
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler, ReplaceContentFn } from "../typedefs.js"


export const pageLinkHandlerFilter: HtmlDependencyFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "a", nodeAttribute: "href" }

export const pageLinkHandlerCallback: HtmlDependencyCallback = (args, ctx) => {
	const href_path: string = args.htmlNode.attributes["href"]
	// we do not process links to local elements/ids.
	if (href_path.startsWith("#")) { return }
	// if an `external` attribute is present in the node, then we'll not bundle the referenced resource.
	const is_external = "external" in args.htmlNode.attributes
	return {
		path: href_path,
		external: is_external,
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
	filter: pageLinkHandlerFilter,
	callback: pageLinkHandlerCallback,
} satisfies NodeHandler
