/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/
import type { OnTransformOptions, Require, SuperPluginSetup } from "../../deps.js";
/** setup configuration options for the {@link cssPluginSetup}.
 *
 * @defaultValue {@link defaultCssPluginSetupConfig}.
*/
export interface CssPluginSetupConfig {
    /** specify which loaded files/resoruces will need to be intercepted by the css plugin.
     *
     * @defaultValue `{ filter: new RegExp(".*"), loader: "css", namespace: undefined }`
    */
    transformFilter?: Require<OnTransformOptions, "loader">;
}
/** the default configuration for {@link cssPluginSetup}. */
export declare const defaultCssPluginSetupConfig: Required<CssPluginSetupConfig>;
/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it. */
export declare const cssPluginSetup: (config?: CssPluginSetupConfig) => SuperPluginSetup;
//# sourceMappingURL=setup.d.ts.map