/** the import-meta plugin lets you include up files referenced by your `import.meta.resolve("...")` statements inside your js-like source files.
 *
 * @module
*/
import type { SuperPluginType } from "../../deps.js";
import { type ImportmetaPluginSetupConfig } from "./setup.js";
export type * from "./setup.js";
export { defaultImportmetaPluginSetupConfig, importmetaPluginSetup } from "./setup.js";
/** {@inheritDoc importmetaPluginSetup} */
export declare const importmetaPlugin: (config?: ImportmetaPluginSetupConfig) => SuperPluginType;
//# sourceMappingURL=mod.d.ts.map