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
import type { HtmlDependencyCallback, HtmlDependencyFilter, NodeHandler } from "../typedefs.js";
export declare const imgLinkHandlerFilter: HtmlDependencyFilter;
export declare const imgLinkHandlerCallback: HtmlDependencyCallback;
export declare const videoLinkHandlerFilter: HtmlDependencyFilter;
export declare const videoLinkHandlerCallback: HtmlDependencyCallback;
export declare const audioLinkHandlerFilter: HtmlDependencyFilter;
export declare const audioLinkHandlerCallback: HtmlDependencyCallback;
export declare const embedLinkHandlerFilter: HtmlDependencyFilter;
export declare const embedLinkHandlerCallback: HtmlDependencyCallback;
export declare const iframeLinkHandlerFilter: HtmlDependencyFilter;
export declare const iframeLinkHandlerCallback: HtmlDependencyCallback;
export declare const iconLinkHandlerFilter: HtmlDependencyFilter;
export declare const iconLinkHandlerCallback: HtmlDependencyCallback;
export declare const allMediaLinkHandlers: NodeHandler[];
export default allMediaLinkHandlers;
//# sourceMappingURL=media_link.d.ts.map