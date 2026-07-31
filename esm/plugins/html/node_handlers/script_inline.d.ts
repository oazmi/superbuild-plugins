/** this node-handler intercepts all `<script> TS CONTENT </script>` html nodes,
 * and bundles the contained typescript code inside of the script tag.
 *
 * @module
*/
import type { HtmlDependencyCallback, HtmlDependencyFilter } from "../typedefs.js";
export declare const scriptInlineHandlerFilter: HtmlDependencyFilter;
export declare const scriptInlineHandlerCallback: HtmlDependencyCallback;
declare const _default: {
    filter: HtmlDependencyFilter;
    callback: HtmlDependencyCallback;
};
export default _default;
//# sourceMappingURL=script_inline.d.ts.map