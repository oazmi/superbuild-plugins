/** the css plugin lets you bundle up css files, without getting any annoying js-files emitted along side with it.
 *
 * @module
*/

import type { SuperPluginType } from "../../deps.ts"
import { cssPluginSetup, type CssPluginSetupConfig } from "./setup.ts"


export type * from "./setup.ts"
export { cssPluginSetup, defaultCssPluginSetupConfig } from "./setup.ts"

/** {@inheritDoc cssPluginSetup} */
export const cssPlugin = (config?: CssPluginSetupConfig): SuperPluginType => {
	return {
		name: "oazmi-superbuild-plugin-css",
		setup: cssPluginSetup(config),
	}
}
