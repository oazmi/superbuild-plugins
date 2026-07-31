/** this node-handler intercepts all `<style> CSS CONTENT </style>` html nodes,
 * and bundles the dependencies of the embedded css rules.
 *
 * you will generally want to include the {@link cssPlugin} along with the html-plugin,
 * for proper bundling of dependency css files referenced inside of the style block.
 *
 * @module
*/
import type { HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.js";
export declare const styleInlineHandlerFilter: HtmlDependencyFilter;
export declare const styleInlineHandlerCallback: HtmlDependencyCallback;
declare const _default: {
    filter: HtmlDependencyFilter;
    callback: HtmlDependencyCallback;
};
export default _default;
//# sourceMappingURL=style_inline.d.ts.map