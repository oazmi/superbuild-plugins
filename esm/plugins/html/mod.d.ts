/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/
import type { SuperPluginType } from "../../deps.js";
import { type HtmlPluginSetupConfig } from "./setup.js";
export { default as scriptLinkHandler } from "./node_handlers/script_link.js";
export type * from "./setup.js";
export { defaultHtmlPluginSetupConfig, htmlPluginSetup } from "./setup.js";
export type * from "./typedefs.js";
/** {@inheritDoc htmlPluginSetup} */
export declare const htmlPlugin: (config?: HtmlPluginSetupConfig) => SuperPluginType;
//# sourceMappingURL=mod.d.ts.map