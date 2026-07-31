/** the html plugin lets you bundle up html files, along side bundling any standard resource links that it might reference.
 *
 * @module
*/

import type { SuperPluginType } from "../../deps.ts"
import { htmlPluginSetup, type HtmlPluginSetupConfig } from "./setup.ts"


export { default as scriptLinkHandler } from "./node_handlers/script_link.ts"
export type * from "./setup.ts"
export { defaultHtmlPluginSetupConfig, htmlPluginSetup } from "./setup.ts"
export type * from "./typedefs.ts"

/** {@inheritDoc htmlPluginSetup} */
export const htmlPlugin = (config?: HtmlPluginSetupConfig): SuperPluginType => {
	return {
		name: "oazmi-superbuild-plugin-html",
		setup: htmlPluginSetup(config),
	}
}
