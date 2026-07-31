/** this node-handler intercepts all `<link rel="stylesheet" href="...">` html nodes, and bundles the referenced css file,
 * unless an `external` attribute is present (i.e. `<link external rel="stylesheet" href="...">`),
 * in which case the referenced css resource will not be resolved nor bundled.
 *
 * you will generally want to include the {@link cssPlugin} along with the html-plugin,
 * for proper bundling of dependency css files referenced by your linked css file.
 *
 * @module
*/
import type { HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.js";
export declare const styleLinkHandlerFilter: HtmlDependencyFilter;
export declare const styleLinkHandlerCallback: HtmlDependencyCallback;
declare const _default: {
    filter: HtmlDependencyFilter;
    callback: HtmlDependencyCallback;
};
export default _default;
//# sourceMappingURL=style_link.d.ts.map