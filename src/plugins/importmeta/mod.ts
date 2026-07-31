/** the import-meta plugin lets you include up files referenced by your `import.meta.resolve("...")` statements inside your js-like source files.
 *
 * @module
*/

import type { SuperPluginType } from "../../deps.ts"
import { importmetaPluginSetup, type ImportmetaPluginSetupConfig } from "./setup.ts"


export type * from "./setup.ts"
export { defaultImportmetaPluginSetupConfig, importmetaPluginSetup } from "./setup.ts"

/** {@inheritDoc importmetaPluginSetup} */
export const importmetaPlugin = (config?: ImportmetaPluginSetupConfig): SuperPluginType => {
	return {
		name: "oazmi-superbuild-plugin-importmeta",
		setup: importmetaPluginSetup(config),
	}
}
