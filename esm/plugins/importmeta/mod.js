/** the import-meta plugin lets you include up files referenced by your `import.meta.resolve("...")` statements inside your js-like source files.
 *
 * @module
*/
import { importmetaPluginSetup } from "./setup.js";
export { defaultImportmetaPluginSetupConfig, importmetaPluginSetup } from "./setup.js";
/** {@inheritDoc importmetaPluginSetup} */
export const importmetaPlugin = (config) => {
    return {
        name: "oazmi-superbuild-plugin-importmeta",
        setup: importmetaPluginSetup(config),
    };
};
