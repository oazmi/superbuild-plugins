/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/
import type { SuperPluginType } from "../../deps.js";
import { type CssPluginSetupConfig } from "./setup.js";
export type * from "./setup.js";
export { cssPluginSetup, defaultCssPluginSetupConfig } from "./setup.js";
/** {@inheritDoc cssPluginSetup} */
export declare const cssPlugin: (config?: CssPluginSetupConfig) => SuperPluginType;
//# sourceMappingURL=mod.d.ts.map