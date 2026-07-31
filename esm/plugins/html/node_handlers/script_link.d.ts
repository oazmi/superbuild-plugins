/** this node-handler intercepts all `<script src="...">` html nodes,
 * and bundles the referenced javascript (or typescript) file.
 * however, if an `external` attribute is present (i.e. `<script external src="...">`),
 * then the referenced resource will not be resolved nor bundled.
 *
 * @module
*/
import type { HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.js";
export declare const scriptLinkHandlerFilter: HtmlDependencyFilter;
export declare const scriptLinkHandlerCallback: HtmlDependencyCallback;
declare const _default: {
    filter: HtmlDependencyFilter;
    callback: HtmlDependencyCallback;
};
export default _default;
//# sourceMappingURL=script_link.d.ts.map