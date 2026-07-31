/** this node-handler intercepts all `<script src="...">` html nodes,
 * and bundles the referenced javascript (or typescript) file.
 * however, if an `external` attribute is present (i.e. `<script external src="...">`),
 * then the referenced resource will not be resolved nor bundled.
 *
 * @module
*/
import { HTML_NODE_TYPE } from "../deps.js";
export const scriptLinkHandlerFilter = { nodeType: HTML_NODE_TYPE.ELEMENT, nodeName: "script", nodeAttribute: "src" };
export const scriptLinkHandlerCallback = (args, ctx) => {
    const src_path = args.htmlNode.attributes["src"];
    // if an `external` attribute is present in the node, then we'll not bundle the referenced resource.
    const is_external = "external" in args.htmlNode.attributes;
    return {
        path: src_path,
        external: is_external,
        replaceContent,
    };
};
const replaceContent = (args, ctx) => {
    const node = args.htmlNode, output_path = args.relativePath ?? args.outputPath;
    node.attributes["src"] = output_path;
};
export default {
    filter: scriptLinkHandlerFilter,
    callback: scriptLinkHandlerCallback,
};
