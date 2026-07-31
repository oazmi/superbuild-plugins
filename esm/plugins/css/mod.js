/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/
import { cssPluginSetup } from "./setup.js";
export { cssPluginSetup, defaultCssPluginSetupConfig } from "./setup.js";
/** {@inheritDoc cssPluginSetup} */
export const cssPlugin = (config) => {
    return {
        name: "oazmi-superbuild-plugin-css",
        setup: cssPluginSetup(config),
    };
};
