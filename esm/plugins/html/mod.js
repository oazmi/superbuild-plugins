/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/
import { htmlPluginSetup } from "./setup.js";
export { default as scriptLinkHandler } from "./node_handlers/script_link.js";
export { defaultHtmlPluginSetupConfig, htmlPluginSetup } from "./setup.js";
/** {@inheritDoc htmlPluginSetup} */
export const htmlPlugin = (config) => {
    return {
        name: "oazmi-superbuild-plugin-html",
        setup: htmlPluginSetup(config),
    };
};
