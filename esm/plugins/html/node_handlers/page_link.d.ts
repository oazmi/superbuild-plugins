/** this node-handler intercepts all `<a href="...">` html nodes, and bundles/imports the referenced `href` link,
 * given that the `href` does not reference a local element (i.e. starts with `#`),
 * nor does the `<a>` element include a special `external` attribute in it (i.e. `<a external href="...">`),
 * as that would hint that the resource being referenced is external.
 *
 * @module
*/
import type { HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.js";
export declare const pageLinkHandlerFilter: HtmlDependencyFilter;
export declare const pageLinkHandlerCallback: HtmlDependencyCallback;
declare const _default: {
    filter: HtmlDependencyFilter;
    callback: HtmlDependencyCallback;
};
export default _default;
//# sourceMappingURL=page_link.d.ts.map