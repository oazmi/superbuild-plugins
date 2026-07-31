/** this node-handler intercepts all `<link rel="stylesheet" href="...">` html nodes, and bundles the referenced css file,
 * unless an `external` attribute is present (i.e. `<link external rel="stylesheet" href="...">`),
 * in which case the referenced css resource will not be resolved nor bundled.
 *
 * you will generally want to include the {@link cssPlugin} along with the html-plugin,
 * for proper bundling of dependency css files referenced by your linked css file.
 *
 * @module
*/
import { isString } from "../../../deps.js";
import { HTML_NODE_TYPE } from "../deps.js";
export const styleLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "link", nodeAttribute: "rel" };
export const styleLinkHandlerCallback = (args, ctx) => {
    // first, we ensure that a stylesheet is being linked, and that an href has been provided.
    const html_node_attrs = args.htmlNode.attributes, rel_tokens = html_node_attrs["rel"].toLowerCase().split(" ");
    if (!rel_tokens.includes("stylesheet")) {
        return;
    }
    if (!isString(html_node_attrs["href"])) {
        return;
    }
    const src_path = html_node_attrs["href"], is_external = "external" in args.htmlNode.attributes;
    return {
        path: src_path,
        external: is_external,
        replaceContent,
    };
};
const replaceContent = (args, ctx) => {
    const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
    node.attributes["href"] = output_path;
};
export default {
    filter: styleLinkHandlerFilter,
    callback: styleLinkHandlerCallback,
};
