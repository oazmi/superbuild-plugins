/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/

import type { SuperPluginType } from "../../deps.js"
import { cssPluginSetup, type CssPluginSetupConfig } from "./setup.js"


export type * from "./setup.js"
export { cssPluginSetup, defaultCssPluginSetupConfig } from "./setup.js"

/** {@inheritDoc cssPluginSetup} */
export const cssPlugin = (config?: CssPluginSetupConfig): SuperPluginType => {
	return {
		name: "oazmi-superbuild-plugin-css",
		setup: cssPluginSetup(config),
	}
}
