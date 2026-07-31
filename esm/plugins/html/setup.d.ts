/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/
import type { OnTransformOptions, Require, SuperPluginSetup } from "../../deps.js";
import type { NodeHandler } from "./typedefs.js";
/** setup configuration options for the {@link htmlPluginSetup}.
 *
 * @defaultValue {@link defaultHtmlPluginSetupConfig}.
*/
export interface HtmlPluginSetupConfig {
    /** specify which loaded files/resoruces will need to be intercepted by the html plugin.
     *
     * @defaultValue `{ filter: new RegExp(".*"), loader: "html", namespace: undefined }`
    */
    transformFilter?: Require<OnTransformOptions, "loader">;
    /** specify your node handlers that will extract the linked/inlined resources that need to be bundled along with the html.
     *
     * @defaultValue all filters under [`./node_handlers/`](./node_handlers/) are included.
    */
    nodeHandlers?: Array<NodeHandler>;
}
/** the default configuration for {@link htmlPluginSetup}. */
export declare const defaultHtmlPluginSetupConfig: Required<HtmlPluginSetupConfig>;
/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference. */
export declare const htmlPluginSetup: (config?: HtmlPluginSetupConfig) => SuperPluginSetup;
//# sourceMappingURL=setup.d.ts.map